import { after, NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { deleteStravaActivity, importStravaById } from "@/server/strava/import";

/** Validation de l'abonnement (Strava envoie un GET avec hub.challenge). */
export async function GET(req: NextRequest) {
  const p = req.nextUrl.searchParams;
  if (p.get("hub.mode") === "subscribe" && p.get("hub.verify_token") && p.get("hub.verify_token") === process.env.STRAVA_VERIFY_TOKEN) {
    return NextResponse.json({ "hub.challenge": p.get("hub.challenge") });
  }
  return new NextResponse("forbidden", { status: 403 });
}

const eventSchema = z.object({
  object_type: z.enum(["activity", "athlete"]),
  object_id: z.number(),
  aspect_type: z.enum(["create", "update", "delete"]),
  owner_id: z.number(),
  updates: z.record(z.string(), z.unknown()).optional(),
});

/**
 * Événements Strava. Strava ne signe pas ses webhooks : on ne fait donc
 * jamais confiance au contenu de l'événement, on s'en sert seulement comme
 * déclencheur pour relire la donnée depuis l'API Strava avec le token de
 * l'athlète. Réponse immédiate (< 2 s exigé), traitement en arrière-plan.
 */
export async function POST(req: NextRequest) {
  const parsed = eventSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ ok: true });
  const e = parsed.data;
  const integration = await db.integration.findUnique({ where: { provider_externalUserId: { provider: "strava", externalUserId: String(e.owner_id) } } });
  if (!integration || integration.status !== "active") return NextResponse.json({ ok: true });

  after(async () => {
    try {
      if (e.object_type === "athlete" && e.updates?.authorized === "false") {
        await db.integration.delete({ where: { id: integration.id } });
      } else if (e.object_type === "activity" && e.aspect_type === "delete") {
        await deleteStravaActivity(integration, e.object_id);
      } else if (e.object_type === "activity") {
        await importStravaById(integration, e.object_id);
        await db.integration.update({ where: { id: integration.id }, data: { lastSyncAt: new Date() } });
      }
    } catch (err) {
      console.error("[strava webhook]", err);
    }
  });
  return NextResponse.json({ ok: true });
}
