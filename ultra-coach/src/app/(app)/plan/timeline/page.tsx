import { AlertTriangle } from "lucide-react";
import Link from "next/link";
import { fmtDur, mondayOf, PHASE_LABELS } from "@/engine";
import { PageHeader } from "@/components/ui";
import { requireAthlete } from "@/lib/auth";
import { db } from "@/lib/db";
import { dbDate, formatDayFr, isoDay, localToday } from "@/lib/day";
import { activePlan } from "@/server/plan";

const PHASE_COLOR: Record<string, string> = {
  base: "#3f3f46",
  endurance: "#52525b",
  trail: "#65a30d",
  specific: "#84cc16",
  peak: "#c6ff3d",
  taper: "#a3a3a3",
};

export default async function TimelinePage() {
  const { user } = await requireAthlete();
  const plan = await activePlan(user.id);
  if (!plan) return <PageHeader title="Timeline" subtitle="Aucun plan" />;
  const weeks = await db.trainingWeek.findMany({ where: { planId: plan.id }, orderBy: { index: "asc" } });
  const thisMonday = dbDate(mondayOf(localToday(user.timezone))).getTime();
  const maxH = Math.max(...weeks.map((w) => w.targetRunHours));

  return (
    <>
      <PageHeader title={plan.goal.race?.name ?? "Objectif"} subtitle={`Aujourd'hui → ${formatDayFr(isoDay(plan.goal.targetDate), { day: "numeric", month: "long", year: "numeric" })}`} />

      {plan.warnings.length > 0 && (
        <section className="card mb-3 space-y-2 border-warn/30">
          {plan.warnings.map((w) => (
            <p key={w} className="flex items-start gap-2 text-sm">
              <AlertTriangle size={16} className="mt-0.5 shrink-0 text-warn" />
              {w}
            </p>
          ))}
        </section>
      )}

      <section className="card mb-3">
        <p className="label mb-3">Volume de course prévu par semaine</p>
        <div className="flex h-28 items-end gap-[2px]">
          {weeks.map((w) => (
            <Link
              key={w.id}
              href={`/plan?w=${w.index}`}
              title={`S${w.index + 1} · ${PHASE_LABELS[w.phase]} · ${w.targetRunHours} h`}
              className={`flex-1 rounded-t-sm ${w.monday.getTime() === thisMonday ? "outline outline-2 outline-fg" : ""}`}
              style={{ height: `${(w.targetRunHours / maxH) * 100}%`, background: PHASE_COLOR[w.phase], opacity: w.isDeload ? 0.5 : 1 }}
            />
          ))}
        </div>
        <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted">
          {Object.entries(PHASE_LABELS).map(([k, v]) => (
            <span key={k} className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-sm" style={{ background: PHASE_COLOR[k] }} />
              {v}
            </span>
          ))}
        </div>
      </section>

      <div className="space-y-1.5">
        {weeks.map((w) => {
          const current = w.monday.getTime() === thisMonday;
          return (
            <Link key={w.id} href={`/plan?w=${w.index}`} className={`card flex items-center gap-3 py-2.5 ${current ? "border-accent/60" : ""}`}>
              <span className="h-8 w-1.5 rounded-full" style={{ background: PHASE_COLOR[w.phase] }} />
              <span className="num w-10 text-sm text-muted">S{w.index + 1}</span>
              <span className="flex-1">
                <span className="block text-sm font-semibold">
                  {PHASE_LABELS[w.phase]} {w.isDeload && <span className="font-normal text-good">· allégée</span>}
                  {current && <span className="font-normal text-accent"> · maintenant</span>}
                </span>
                <span className="block text-xs text-faint">{formatDayFr(isoDay(w.monday), { day: "numeric", month: "short" })}</span>
              </span>
              <span className="num text-right text-sm">
                {fmtDur(Math.round(w.targetRunHours * 60))}
                <span className="block text-xs text-faint">long {fmtDur(w.targetLongRunMin)}</span>
              </span>
            </Link>
          );
        })}
      </div>
    </>
  );
}
