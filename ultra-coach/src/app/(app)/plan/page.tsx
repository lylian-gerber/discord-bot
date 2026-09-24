import { ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";
import { addDays, fmtDur, PHASE_LABELS, type WeekDayPlan } from "@/engine";
import { PageHeader } from "@/components/ui";
import { WorkoutRow } from "@/components/WorkoutRow";
import { requireAthlete } from "@/lib/auth";
import { db } from "@/lib/db";
import { dbDate, formatDayFr, isoDay, localToday, weekdayName } from "@/lib/day";
import { activePlan, ensureWeekWorkouts, weekFor } from "@/server/plan";
import { updateWeekFootball } from "./actions";

export const dynamic = "force-dynamic";

const CONTEXT: Record<string, string> = { in_season: "En saison", break: "Trêve", off_season: "Hors saison" };
const FOOT: [WeekDayPlan["football"], string][] = [
  ["none", "—"],
  ["light", "Léger"],
  ["moderate", "Modéré"],
  ["hard", "Intense"],
  ["match", "Match"],
];

export default async function PlanPage({ searchParams }: { searchParams: Promise<{ w?: string }> }) {
  const { user, profile } = await requireAthlete();
  const today = localToday(user.timezone);
  const plan = await activePlan(user.id);
  if (!plan) return <PageHeader title="Plan" subtitle="Aucun plan actif" />;

  const current = await weekFor(user.id, today);
  const { w } = await searchParams;
  const index = w !== undefined ? Number(w) : (current?.index ?? 0);
  const week = await db.trainingWeek.findUnique({ where: { planId_index: { planId: plan.id, index } } });
  if (!week) return <PageHeader title="Plan" subtitle="Semaine introuvable" />;
  await ensureWeekWorkouts(user.id, week, profile, today);

  const monday = isoDay(week.monday);
  const [workouts, fresh, total] = await Promise.all([
    db.workout.findMany({ where: { userId: user.id, day: { gte: dbDate(monday), lte: dbDate(addDays(monday, 6)) } }, orderBy: [{ day: "asc" }, { sport: "asc" }] }),
    db.trainingWeek.findUnique({ where: { id: week.id } }),
    db.trainingWeek.count({ where: { planId: plan.id } }),
  ]);
  const football = (fresh?.footballDays as WeekDayPlan[] | null) ?? [];
  const runMin = workouts.filter((x) => x.sport === "trail").reduce((a, x) => a + (x.durationMin ?? 0), 0);

  return (
    <>
      <PageHeader
        title={`Semaine ${week.index + 1}`}
        subtitle={`${formatDayFr(monday, { day: "numeric", month: "short" })} → ${formatDayFr(addDays(monday, 6), { day: "numeric", month: "short" })}`}
        action={
          <div className="flex gap-2">
            <Link aria-label="Semaine précédente" href={`/plan?w=${Math.max(0, index - 1)}`} className="btn-ghost h-10 w-10 p-0">
              <ChevronLeft size={18} />
            </Link>
            <Link aria-label="Semaine suivante" href={`/plan?w=${Math.min(total - 1, index + 1)}`} className="btn-ghost h-10 w-10 p-0">
              <ChevronRight size={18} />
            </Link>
          </div>
        }
      />

      <Link href="/plan/timeline" className="card mb-3 block">
        <div className="flex flex-wrap gap-2">
          <span className="chip border-accent/50 text-accent">{PHASE_LABELS[week.phase]}</span>
          <span className="chip">
            {week.phaseWeek}/{week.phaseWeeks}
          </span>
          <span className="chip">{CONTEXT[week.context]}</span>
          {week.isDeload && <span className="chip border-good/40 text-good">Semaine allégée</span>}
          {week.appliedFactor !== 1 && <span className="chip border-warn/40 text-warn">Volume ×{week.appliedFactor} (charge)</span>}
        </div>
        <p className="num mt-3 text-sm text-muted">
          Course prévue <b className="text-fg">{fmtDur(runMin)}</b> · sortie longue <b className="text-fg">{fmtDur(week.targetLongRunMin)}</b> · D+ cible{" "}
          <b className="text-fg">{week.targetDplusM} m</b>
        </p>
        <p className="mt-1 text-xs text-faint">Focus : {week.focus.join(", ")}</p>
      </Link>

      <div className="space-y-2">
        {Array.from({ length: 7 }, (_, i) => {
          const day = addDays(monday, i);
          const items = workouts.filter((x) => isoDay(x.day) === day);
          const isToday = day === today;
          return (
            <section key={day} className={`card py-3 ${isToday ? "border-accent/50" : ""}`}>
              <p className={`text-sm font-semibold capitalize ${isToday ? "text-accent" : "text-muted"}`}>
                {formatDayFr(day, { weekday: "long", day: "numeric" })}
                {isToday && " · aujourd'hui"}
              </p>
              {items.length === 0 ? <p className="py-2 text-sm text-faint">Repos</p> : items.map((x) => <WorkoutRow key={x.id} w={x} />)}
            </section>
          );
        })}
      </div>

      <details className="card mt-3">
        <summary className="cursor-pointer font-semibold">Modifier le football de cette semaine</summary>
        <p className="mt-2 text-sm text-muted">Match décalé, séance annulée, double séance… Le plan trail se recalcule autour.</p>
        <form key={JSON.stringify(football)} action={updateWeekFootball} className="mt-3 space-y-2">
          <input type="hidden" name="weekId" value={week.id} />
          {Array.from({ length: 7 }, (_, i) => (
            <div key={i} className="flex items-center justify-between gap-3">
              <span className="w-24 capitalize">{weekdayName(i)}</span>
              <select name={`d${i}`} defaultValue={football.find((d) => d.weekday === i)?.football ?? "none"} className="field h-10 flex-1">
                {FOOT.map(([v, l]) => (
                  <option key={v} value={v}>
                    {l}
                  </option>
                ))}
              </select>
            </div>
          ))}
          <button className="btn-primary mt-2 w-full">Recalculer la semaine</button>
        </form>
      </details>
    </>
  );
}
