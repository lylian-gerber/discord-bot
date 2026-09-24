import Anthropic from "@anthropic-ai/sdk";
import type { Prisma } from "@prisma/client";
import { z } from "zod";
import { checkSafety } from "@/engine";
import { getUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { dbDate, localToday } from "@/lib/day";
import { COACH_PROMPT_VERSION, COACH_SYSTEM_PROMPT } from "@/server/coach/prompt";
import { buildAthleteSnapshot } from "@/server/coach/snapshot";

export const runtime = "nodejs";
export const maxDuration = 120;

const MODEL = "claude-opus-5";
const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"] as const;

const bodySchema = z.object({
  message: z.string().trim().max(4000),
  images: z
    .array(z.object({ mediaType: z.enum(IMAGE_TYPES), data: z.string().max(7_000_000) }))
    .max(4)
    .default([]),
});

type StoredContent = { text: string; images?: number };

export async function POST(req: Request) {
  const user = await getUser();
  if (!user) return new Response("Non connecté", { status: 401 });
  const profile = await db.athleteProfile.findUnique({ where: { userId: user.id } });
  if (!profile) return new Response("Profil manquant", { status: 400 });

  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success || (!parsed.data.message && parsed.data.images.length === 0)) {
    return new Response("Message invalide", { status: 400 });
  }
  const { message, images } = parsed.data;

  // Conversation courante (une conversation continue pour le MVP)
  const conversation =
    (await db.aIConversation.findFirst({ where: { userId: user.id }, orderBy: { createdAt: "desc" } })) ??
    (await db.aIConversation.create({ data: { userId: user.id, title: "Coach" } }));

  // 1. Garde-fou déterministe, avant tout appel au modèle
  const today = localToday(user.timezone);
  const checkin = await db.dailyCheckin.findUnique({ where: { userId_day: { userId: user.id, day: dbDate(today) } } });
  const safety = checkSafety(message, checkin?.pain);

  await db.aIMessage.create({
    data: {
      conversationId: conversation.id,
      role: "user",
      content: { text: message, images: images.length || undefined } as Prisma.InputJsonValue,
      safetyLevel: safety.level,
    },
  });

  const encoder = new TextEncoder();
  const save = (text: string, extra: Partial<Prisma.AIMessageUncheckedCreateInput> = {}) =>
    db.aIMessage.create({
      data: { conversationId: conversation.id, role: "assistant", content: { text } as Prisma.InputJsonValue, safetyLevel: safety.level, ...extra },
    });

  // Urgence : pas d'appel au modèle, réponse fixe
  if (safety.level === "emergency") {
    const text = `${safety.preamble}\n\nQuand tu auras été vu par un médecin, reviens me dire ce qu'il en est et on adaptera le plan ensemble.`;
    await save(text);
    return new Response(text, { headers: { "content-type": "text/plain; charset=utf-8" } });
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    const text = "Le coach IA n'est pas encore activé : il manque la clé ANTHROPIC_API_KEY dans la configuration du serveur.";
    await save(text);
    return new Response(text, { headers: { "content-type": "text/plain; charset=utf-8" } });
  }

  // 2. Contexte athlète + historique
  const [snapshot, history] = await Promise.all([
    buildAthleteSnapshot(user, profile),
    db.aIMessage.findMany({ where: { conversationId: conversation.id }, orderBy: { createdAt: "desc" }, take: 21 }),
  ]);
  const past: Anthropic.Beta.BetaMessageParam[] = history
    .reverse()
    .slice(0, -1) // le message qu'on vient d'enregistrer est ajouté avec ses images ci-dessous
    .filter((m) => m.role === "user" || m.role === "assistant")
    .map((m) => {
      const c = m.content as StoredContent;
      return { role: m.role as "user" | "assistant", content: c.text + (c.images ? `\n[${c.images} photo(s) envoyée(s)]` : "") || "(photo)" };
    });
  // L'API exige une alternance commençant par "user"
  while (past.length && past[0]!.role !== "user") past.shift();

  const userContent: Anthropic.Beta.BetaContentBlockParam[] = [
    ...images.map((img) => ({ type: "image" as const, source: { type: "base64" as const, media_type: img.mediaType, data: img.data } })),
    { type: "text", text: message || "Voici une photo." },
  ];
  const guard =
    safety.level === "medical"
      ? `\n\nIMPORTANT : le message contient un signal médical (${safety.reasons.join(", ")}). Commence ta réponse par cette phrase exacte, puis reste prudent et n'ajoute aucune séance intense : « ${safety.preamble} »`
      : "";

  const client = new Anthropic();
  const stream = client.beta.messages.stream({
    model: MODEL,
    max_tokens: 16000,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    output_config: { effort: "medium" },
    system: [
      { type: "text", text: COACH_SYSTEM_PROMPT, cache_control: { type: "ephemeral" } },
      { type: "text", text: `SNAPSHOT ATHLÈTE (JSON)\n${JSON.stringify(snapshot)}${guard}`, cache_control: { type: "ephemeral" } },
    ],
    messages: [...past, { role: "user", content: userContent }],
  });

  const body = new ReadableStream<Uint8Array>({
    async start(controller) {
      let text = "";
      try {
        for await (const event of stream) {
          if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
            text += event.delta.text;
            controller.enqueue(encoder.encode(event.delta.text));
          }
        }
        const final = await stream.finalMessage();
        if (final.stop_reason === "refusal") {
          const note = "\n\nJe ne peux pas répondre à cette demande. Reformule ou demande autre chose sur ton entraînement.";
          text += note;
          controller.enqueue(encoder.encode(note));
        }
        await save(text, {
          model: final.model,
          inputTokens: final.usage.input_tokens,
          outputTokens: final.usage.output_tokens,
          cacheReadTokens: final.usage.cache_read_input_tokens ?? undefined,
        });
      } catch (err) {
        const note =
          err instanceof Anthropic.RateLimitError
            ? "\n\nLe coach est surchargé, réessaie dans une minute."
            : err instanceof Anthropic.AuthenticationError
              ? "\n\nClé API invalide : vérifie ANTHROPIC_API_KEY."
              : "\n\nErreur de connexion au coach IA, réessaie.";
        console.error("[coach]", err);
        controller.enqueue(encoder.encode(note));
        await save(text + note).catch(() => undefined);
      } finally {
        controller.close();
      }
    },
  });

  return new Response(body, {
    headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store", "x-prompt-version": COACH_PROMPT_VERSION },
  });
}
