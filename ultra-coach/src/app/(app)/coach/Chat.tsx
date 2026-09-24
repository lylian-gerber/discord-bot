"use client";

import { ImagePlus, Send, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";

export type ChatMessage = { role: "user" | "assistant"; text: string; images?: string[] };

const SUGGESTIONS = [
  "Qu'est-ce que je dois faire demain ?",
  "J'ai joué 90 minutes hier, je fais quoi aujourd'hui ?",
  "J'ai mal aux mollets",
  "Qu'est-ce que je mange ce soir ?",
  "Je prends un bain froid ou pas ?",
  "Est-ce que je dois acheter des bâtons ?",
];

/** Redimensionne une photo côté client (max 1568 px) pour limiter le poids envoyé. */
async function toJpeg(file: File): Promise<{ mediaType: "image/jpeg"; data: string; preview: string }> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, 1568 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  const url = canvas.toDataURL("image/jpeg", 0.85);
  return { mediaType: "image/jpeg", data: url.split(",")[1]!, preview: url };
}

export function Chat({ initial }: { initial: ChatMessage[] }) {
  const [messages, setMessages] = useState<ChatMessage[]>(initial);
  const [input, setInput] = useState("");
  const [images, setImages] = useState<{ mediaType: "image/jpeg"; data: string; preview: string }[]>([]);
  const [busy, setBusy] = useState(false);
  const bottom = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => bottom.current?.scrollIntoView({ behavior: "smooth" }), [messages]);

  async function send(text: string) {
    if (busy || (!text.trim() && images.length === 0)) return;
    const sent = images;
    setMessages((m) => [...m, { role: "user", text, images: sent.map((i) => i.preview) }, { role: "assistant", text: "" }]);
    setInput("");
    setImages([]);
    setBusy(true);
    try {
      const res = await fetch("/api/coach", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ message: text, images: sent.map(({ mediaType, data }) => ({ mediaType, data })) }),
      });
      if (!res.ok || !res.body) throw new Error(await res.text());
      const reader = res.body.getReader();
      const dec = new TextDecoder();
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = dec.decode(value, { stream: true });
        setMessages((m) => {
          const copy = [...m];
          const last = copy[copy.length - 1]!;
          copy[copy.length - 1] = { ...last, text: last.text + chunk };
          return copy;
        });
      }
    } catch {
      setMessages((m) => {
        const copy = [...m];
        copy[copy.length - 1] = { role: "assistant", text: "Impossible de joindre le coach. Réessaie." };
        return copy;
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-[calc(100dvh-10rem)] flex-col">
      <div className="flex-1 space-y-3 pb-4">
        {messages.length === 0 && (
          <div className="space-y-2">
            <p className="text-muted">Pose-moi n&apos;importe quelle question. Je connais ton plan, ta forme, ta charge et tes matchs.</p>
            <div className="flex flex-wrap gap-2">
              {SUGGESTIONS.map((s) => (
                <button key={s} onClick={() => send(s)} className="chip px-3 py-2 text-left text-sm text-fg">
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}
        {messages.map((m, i) => (
          <div key={i} className={m.role === "user" ? "flex justify-end" : ""}>
            <div
              className={
                m.role === "user"
                  ? "max-w-[85%] rounded-2xl rounded-br-md bg-accent px-4 py-2.5 text-accent-ink"
                  : "max-w-[92%] whitespace-pre-wrap rounded-2xl rounded-bl-md bg-surface px-4 py-3 leading-relaxed"
              }
            >
              {m.images?.map((src, j) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img key={j} src={src} alt="Photo envoyée" className="mb-2 max-h-48 rounded-lg" />
              ))}
              {m.text || (m.role === "assistant" && busy && i === messages.length - 1 ? <span className="animate-pulse text-muted">Le coach réfléchit…</span> : null)}
            </div>
          </div>
        ))}
        <div ref={bottom} />
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          send(input);
        }}
        className="sticky bottom-24 space-y-2 rounded-2xl border border-line bg-surface p-2"
      >
        {images.length > 0 && (
          <div className="flex gap-2 px-1 pt-1">
            {images.map((img, i) => (
              <div key={i} className="relative">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={img.preview} alt="" className="h-14 w-14 rounded-lg object-cover" />
                <button type="button" aria-label="Retirer" onClick={() => setImages((x) => x.filter((_, j) => j !== i))} className="absolute -right-1.5 -top-1.5 rounded-full bg-bg p-0.5">
                  <X size={14} />
                </button>
              </div>
            ))}
          </div>
        )}
        <div className="flex items-end gap-2">
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            multiple
            hidden
            onChange={async (e) => {
              const files = Array.from(e.target.files ?? []).slice(0, 4 - images.length);
              const converted = await Promise.all(files.map(toJpeg));
              setImages((x) => [...x, ...converted].slice(0, 4));
              e.target.value = "";
            }}
          />
          <button type="button" aria-label="Ajouter une photo" onClick={() => fileRef.current?.click()} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-muted">
            <ImagePlus size={22} />
          </button>
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send(input);
              }
            }}
            rows={1}
            placeholder="Écris à ton coach…"
            className="max-h-32 min-h-11 flex-1 resize-none bg-transparent py-2.5 text-base outline-none placeholder:text-faint"
          />
          <button aria-label="Envoyer" disabled={busy} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-accent text-accent-ink disabled:opacity-40">
            <Send size={18} />
          </button>
        </div>
      </form>
    </div>
  );
}
