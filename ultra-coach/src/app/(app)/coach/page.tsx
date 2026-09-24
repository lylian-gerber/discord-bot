import { PageHeader } from "@/components/ui";
import { requireAthlete } from "@/lib/auth";
import { db } from "@/lib/db";
import { Chat, type ChatMessage } from "./Chat";

export const dynamic = "force-dynamic";

export default async function CoachPage() {
  const { user } = await requireAthlete();
  const conversation = await db.aIConversation.findFirst({ where: { userId: user.id }, orderBy: { createdAt: "desc" } });
  const messages = conversation
    ? await db.aIMessage.findMany({ where: { conversationId: conversation.id }, orderBy: { createdAt: "desc" }, take: 40 })
    : [];
  const initial: ChatMessage[] = messages
    .reverse()
    .filter((m) => m.role === "user" || m.role === "assistant")
    .map((m) => {
      const c = m.content as { text: string; images?: number };
      return { role: m.role as "user" | "assistant", text: c.text + (c.images ? `${c.text ? "\n" : ""}📷 ${c.images} photo(s)` : "") };
    });
  return (
    <>
      <PageHeader title="Coach" subtitle="Ton coach IA" />
      <Chat initial={initial} />
    </>
  );
}
