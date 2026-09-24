import type { Workout } from "@prisma/client";
import clsx from "clsx";
import { ChevronRight, Dumbbell, Footprints, Mountain, Sparkles, Trophy } from "lucide-react";
import Link from "next/link";
import { fmtDur } from "@/engine";

export function workoutIcon(w: Pick<Workout, "sport" | "sessionType">) {
  if (w.sessionType === "match") return Trophy;
  if (w.sport === "football") return Footprints;
  if (w.sport === "strength") return Dumbbell;
  if (w.sport === "mobility") return Sparkles;
  return Mountain;
}

const STATUS: Record<string, { label: string; cls: string }> = {
  adapted: { label: "Adaptée", cls: "border-warn/40 text-warn" },
  done: { label: "Faite", cls: "border-good/40 text-good" },
  skipped: { label: "Annulée", cls: "border-bad/40 text-bad" },
};

export function WorkoutRow({ w, big = false }: { w: Workout; big?: boolean }) {
  const Icon = workoutIcon(w);
  const status = STATUS[w.status];
  const meta = [
    w.durationMin ? fmtDur(w.durationMin) : null,
    w.dPlusM ? `${w.dPlusM} m D+` : null,
    w.maxDescentM !== null && w.maxDescentM !== undefined ? `D− max ${w.maxDescentM} m` : null,
    w.targetRpe ? `RPE ${w.targetRpe}` : null,
  ].filter(Boolean);
  return (
    <Link href={`/workout/${w.id}`} className="flex items-center gap-3 py-2">
      <span
        className={clsx(
          "flex shrink-0 items-center justify-center rounded-xl",
          big ? "h-12 w-12" : "h-10 w-10",
          w.sport === "football" ? "bg-surface-2 text-muted" : "bg-accent/15 text-accent",
        )}
      >
        <Icon size={big ? 22 : 18} />
      </span>
      <span className="min-w-0 flex-1">
        <span className={clsx("block font-semibold", big ? "line-clamp-2 text-lg leading-snug" : "truncate", w.status === "skipped" && "line-through opacity-60")}>{w.title}</span>
        {meta.length > 0 && <span className="num block truncate text-sm text-muted">{meta.join(" · ")}</span>}
      </span>
      {status && <span className={clsx("chip shrink-0", status.cls)}>{status.label}</span>}
      <ChevronRight size={18} className="shrink-0 text-faint" />
    </Link>
  );
}
