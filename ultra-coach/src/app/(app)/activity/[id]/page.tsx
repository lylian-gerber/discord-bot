import { notFound } from "next/navigation";
import { fmtDur } from "@/engine";
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
        <p className="mt-3 text-xs text-faint">L&apos;analyse détaillée (durabilité, découplage cardiaque, allure ajustée à la pente) arrive avec l&apos;import Strava, qui fournit les données seconde par seconde.</p>
      </section>

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
