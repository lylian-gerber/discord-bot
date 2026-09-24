import { notFound } from "next/navigation";
import { fmtDur, type DurabilityResult } from "@/engine";
import { RpePrompt } from "@/components/RpePrompt";
import { PageHeader, Stat } from "@/components/ui";
import { requireAthlete } from "@/lib/auth";
import { db } from "@/lib/db";
import { formatDayFr, isoDay } from "@/lib/day";

const SPORT_LABEL: Record<string, string> = {
  football: "Football", running: "Course", trail: "Trail", hiking: "Randonnée", cycling: "Vélo",
  walking: "Marche", strength: "Musculation", mobility: "Mobilité", swimming: "Natation", other: "Autre",
};

function pace(mps?: number | null): string | null {
  if (!mps) return null;
  const s = 1000 / mps;
  return `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, "0")}/km`;
}

export default async function ActivityPage({ params }: { params: Promise<{ id: string }> }) {
  const { user } = await requireAthlete();
  const { id } = await params;
  const a = await db.activity.findFirst({ where: { id, userId: user.id }, include: { match: true, fueling: true, workout: true } });
  if (!a) notFound();

  // Comparaison déterministe avec une séance similaire antérieure (même sport, durée ±25 %).
  const similar = await db.activity.findFirst({
    where: {
      userId: user.id,
      sport: a.sport,
      id: { not: a.id },
      day: { lt: a.day },
      durationS: { gte: Math.round(a.durationS * 0.75), lte: Math.round(a.durationS * 1.25) },
      avgSpeedMps: { not: null },
    },
    orderBy: { day: "desc" },
  });
  let comparison: string | null = null;
  if (similar && a.avgSpeedMps && similar.avgSpeedMps) {
    const dSec = Math.round(1000 / a.avgSpeedMps - 1000 / similar.avgSpeedMps);
    const weeks = Math.round((a.day.getTime() - similar.day.getTime()) / (7 * 86_400_000));
    const hr = a.avgHr && similar.avgHr ? Math.round(a.avgHr - similar.avgHr) : null;
    comparison =
      `${Math.abs(dSec)} s/km ${dSec <= 0 ? "plus rapide" : "plus lent"} que sur une séance similaire il y a ${weeks || "moins d'une"} semaine${weeks > 1 ? "s" : ""}` +
      (hr !== null ? `, avec une FC moyenne ${Math.abs(hr)} bpm ${hr <= 0 ? "plus basse" : "plus haute"}.` : ".");
  }

  return (
    <>
      <PageHeader title={a.name ?? SPORT_LABEL[a.sport] ?? "Séance"} subtitle={formatDayFr(isoDay(a.day))} />
      <section className="card mb-3 grid grid-cols-3 gap-4">
        <Stat label="Durée" value={fmtDur(Math.round(a.durationS / 60))} />
        <Stat label="Distance" value={a.distanceM ? (a.distanceM / 1000).toFixed(1) : "—"} unit={a.distanceM ? "km" : undefined} />
        <Stat label="Allure" value={pace(a.avgSpeedMps) ?? "—"} />
        <Stat label="D+" value={a.dPlusM ?? "—"} unit={a.dPlusM ? "m" : undefined} />
        <Stat label="FC moy" value={a.avgHr ?? "—"} />
        <Stat label="Charge" value={a.trainingLoad ?? "—"} unit="UA" sub={`RPE ${a.rpe ?? "?"}`} />
      </section>

      {a.match && (
        <section className="card mb-3">
          <p className="label">Match</p>
          <p className="mt-1">{a.match.minutesPlayed ?? "?"} minutes jouées</p>
        </section>
      )}

      <section className="card mb-3">
        <p className="label">Analyse</p>
        {comparison ? <p className="mt-1">{comparison}</p> : <p className="mt-1 text-muted">Pas encore de séance comparable. La comparaison apparaîtra dès la prochaine séance similaire.</p>}
        {a.feeling && <p className="mt-3 text-sm text-muted">Ton ressenti : « {a.feeling} »</p>}
        {!a.durability && (
          <p className="mt-3 text-xs text-faint">
            {a.source === "strava"
              ? "Analyse de durabilité disponible pour les sorties d'endurance de plus de 45 min."
              : "Connecte Strava pour l'analyse détaillée (durabilité, découplage cardiaque, allure ajustée à la pente)."}
          </p>
        )}
      </section>

      {a.rpeEstimated && (
        <div className="mb-3">
          <RpePrompt activities={[a]} />
        </div>
      )}

      {a.durability && <DurabilityCard d={a.durability as unknown as DurabilityResult} />}

      {a.fueling && (
        <section className="card mb-3">
          <p className="label">Ravitaillement</p>
          <p className="num mt-1 text-lg font-semibold">{a.fueling.actualCarbsPerHour} g/h</p>
          <p className="text-sm text-muted">Objectif du palier : {a.fueling.targetCarbsPerHour} g/h</p>
        </section>
      )}
    </>
  );
}

function DurabilityCard({ d }: { d: DurabilityResult }) {
  const tone = d.score >= 85 ? "text-good" : d.score >= 70 ? "text-accent" : d.score >= 55 ? "text-warn" : "text-bad";
  return (
    <section className="card mb-3">
      <div className="flex items-end justify-between">
        <div>
          <p className="label">Durability score</p>
          <p className={`num text-3xl font-bold ${tone}`}>
            {d.score}
            <span className="text-base font-normal text-muted">/100</span>
          </p>
        </div>
        <div className="num text-right text-sm text-muted">
          {d.decouplingPct !== undefined && <p>Découplage {d.decouplingPct} %</p>}
          <p>Finish {d.finishRatio >= 1 ? "+" : ""}{Math.round((d.finishRatio - 1) * 100)} %</p>
        </div>
      </div>
      <p className="mt-1 text-xs text-faint">
        Capacité à rester efficace ({d.basis === "efficiency" ? "allure ajustée à la pente / FC" : "allure ajustée à la pente"}) au fil des heures, comparée à ta 1re heure.
      </p>
      {d.buckets.length > 0 && (
        <table className="num mt-3 w-full text-sm">
          <thead className="text-left text-xs text-faint">
            <tr>
              <th className="py-1 font-medium">Tranche</th>
              <th className="font-medium">Allure aj.</th>
              <th className="font-medium">FC</th>
              <th className="font-medium">Maintien</th>
            </tr>
          </thead>
          <tbody>
            {d.buckets.map((b, i) => {
              const secPerKm = 60000 / b.gapSpeedMpm;
              const r = i === 0 ? null : d.retentionByHour[i - 1];
              return (
                <tr key={b.startMin} className="border-t border-line">
                  <td className="py-1.5">{fmtDur(b.startMin)}–{fmtDur(b.endMin)}</td>
                  <td>{Math.floor(secPerKm / 60)}:{String(Math.round(secPerKm % 60)).padStart(2, "0")}/km</td>
                  <td>{b.avgHr ? Math.round(b.avgHr) : "—"}</td>
                  <td>{r ? `${r.retentionPct} %` : "réf."}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
      {d.notes.map((n) => (
        <p key={n} className="mt-2 text-sm text-muted">
          {n}
        </p>
      ))}
    </section>
  );
}
