import type { Activity } from "@prisma/client";
import Link from "next/link";
import { fmtDur } from "@/engine";
import { confirmRpe } from "@/app/(app)/rpe-actions";

/** Demande en 1 tap le RPE des activités importées sans ressenti. */
export function RpePrompt({ activities }: { activities: Activity[] }) {
  if (!activities.length) return null;
  return (
    <section className="card space-y-3 border-accent/40">
      <p className="label">Ressenti à confirmer</p>
      {activities.map((a) => (
        <div key={a.id}>
          <Link href={`/activity/${a.id}`} className="text-sm font-semibold">
            {a.name ?? a.sport} · {fmtDur(Math.round(a.durationS / 60))}
          </Link>
          <p className="text-xs text-faint">Effort de 1 (très facile) à 10 (max) {a.rpe ? `· estimé ${a.rpe} d'après ta FC` : ""}</p>
          <form action={confirmRpe} className="mt-2 grid grid-cols-10 gap-1">
            <input type="hidden" name="activityId" value={a.id} />
            {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
              <button
                key={n}
                name="rpe"
                value={n}
                className={`num h-9 rounded-lg text-sm font-semibold ${n === a.rpe ? "bg-accent text-accent-ink" : "bg-surface-2"}`}
              >
                {n}
              </button>
            ))}
          </form>
        </div>
      ))}
    </section>
  );
}
