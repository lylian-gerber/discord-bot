import { addDays, dailyLoads, fmtDur, mondayOf, type LoadCategory } from "@/engine";
import { ReadinessChart, RunVolumeChart, WeeklyLoadChart, type WeeklyLoadPoint } from "@/components/charts";
import { PageHeader, Stat } from "@/components/ui";
import { requireAthlete } from "@/lib/auth";
import { db } from "@/lib/db";
import { dbDate, formatDayFr, isoDay, localToday } from "@/lib/day";
import { loadSessions, loadSummary } from "@/server/metrics";

export const dynamic = "force-dynamic";
const WEEKS = 12;

export default async function ProgressPage() {
  const { user } = await requireAthlete();
  const today = localToday(user.timezone);
  const lastMonday = mondayOf(today);
  const firstMonday = addDays(lastMonday, -(WEEKS - 1) * 7);
  const sessions = await loadSessions(user.id, addDays(lastMonday, 6), WEEKS * 7 + 21);

  const weekLabel = (m: string) => formatDayFr(m, { day: "numeric", month: "short" });
  const weekly: WeeklyLoadPoint[] = [];
  for (let i = 0; i < WEEKS; i++) {
    const monday = addDays(firstMonday, i * 7);
    const end = addDays(monday, 6);
    const sum = (c: LoadCategory[]) => dailyLoads(sessions, end, 7, c).reduce((a, b) => a + b, 0);
    const chronic = Math.round(dailyLoads(sessions, end, 28).reduce((a, b) => a + b, 0) / 4);
    weekly.push({ week: weekLabel(monday), football: sum(["football"]), running: sum(["running", "cross", "other"]), trail: sum(["trail"]), strength: sum(["strength"]), chronic });
  }

  const [readiness, runs, load] = await Promise.all([
    db.readinessScore.findMany({ where: { userId: user.id, day: { gte: dbDate(addDays(today, -29)) } }, orderBy: { day: "asc" } }),
    db.activity.findMany({
      where: { userId: user.id, sport: { in: ["running", "trail", "hiking"] }, day: { gte: dbDate(firstMonday) } },
      select: { day: true, durationS: true, distanceM: true, dPlusM: true },
    }),
    loadSummary(user.id, today),
  ]);
  const byDay = new Map(readiness.map((r) => [isoDay(r.day), r.total]));
  const readinessData = Array.from({ length: 30 }, (_, i) => {
    const d = addDays(today, i - 29);
    return { day: formatDayFr(d, { day: "numeric", month: "numeric" }), total: byDay.get(d) ?? null };
  });
  const volume = Array.from({ length: WEEKS }, (_, i) => {
    const monday = addDays(firstMonday, i * 7);
    const s = runs.filter((r) => isoDay(r.day) >= monday && isoDay(r.day) <= addDays(monday, 6));
    return { week: weekLabel(monday), hours: Math.round((s.reduce((a, r) => a + r.durationS, 0) / 3600) * 10) / 10 };
  });
  const last7 = runs.filter((r) => isoDay(r.day) > addDays(today, -7));
  const longest = runs.reduce((a, r) => Math.max(a, r.durationS), 0);
  const longestKm = runs.reduce((a, r) => Math.max(a, r.distanceM ?? 0), 0);

  return (
    <>
      <PageHeader title="Progrès" subtitle="12 dernières semaines" />

      <section className="card mb-3 grid grid-cols-3 gap-4">
        <Stat label="Km 7 j" value={(last7.reduce((a, r) => a + (r.distanceM ?? 0), 0) / 1000).toFixed(1)} />
        <Stat label="D+ 7 j" value={Math.round(last7.reduce((a, r) => a + (r.dPlusM ?? 0), 0))} unit="m" />
        <Stat label="Plus long" value={longest ? fmtDur(Math.round(longest / 60)) : "—"} sub={longestKm ? `${(longestKm / 1000).toFixed(1)} km max` : undefined} />
        <Stat label="Charge 7 j" value={load.acute7} unit="UA" />
        <Stat label="ACWR" value={load.acwrEwma ?? load.acwrRolling ?? "—"} sub={load.acwrEwma === null && load.acwrRolling === null ? "3 sem. d'historique requises" : undefined} />
        <Stat label="Monotonie" value={load.monotony} />
      </section>

      <section className="card mb-3">
        <p className="label mb-3">Charge hebdomadaire (durée × RPE)</p>
        <WeeklyLoadChart data={weekly} />
      </section>

      <section className="card mb-3">
        <p className="label mb-3">Forme (30 jours)</p>
        {readiness.length ? <ReadinessChart data={readinessData} /> : <p className="text-sm text-muted">Fais ton check-in chaque matin pour voir ta courbe de forme.</p>}
      </section>

      <section className="card mb-3">
        <p className="label mb-3">Volume course + trail (h/sem)</p>
        <RunVolumeChart data={volume} />
      </section>

      <details className="card">
        <summary className="cursor-pointer text-sm font-semibold">Voir les données en tableau</summary>
        <table className="num mt-3 w-full text-sm">
          <thead className="text-left text-xs text-faint">
            <tr>
              <th className="py-1 font-medium">Semaine</th>
              <th className="font-medium">Foot</th>
              <th className="font-medium">Course</th>
              <th className="font-medium">Trail</th>
              <th className="font-medium">Muscu</th>
            </tr>
          </thead>
          <tbody>
            {weekly.map((w) => (
              <tr key={w.week} className="border-t border-line">
                <td className="py-1.5">{w.week}</td>
                <td>{w.football}</td>
                <td>{w.running}</td>
                <td>{w.trail}</td>
                <td>{w.strength}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </>
  );
}
