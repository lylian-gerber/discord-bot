import { notFound } from "next/navigation";
import Link from "next/link";
import { fmtDur, gearChecklist } from "@/engine";
import { PageHeader } from "@/components/ui";
import { requireAthlete } from "@/lib/auth";
import { db } from "@/lib/db";
import { formatDayFr, isoDay } from "@/lib/day";
import type { StoredSession } from "@/server/plan";

export default async function WorkoutPage({ params }: { params: Promise<{ id: string }> }) {
  const { user } = await requireAthlete();
  const { id } = await params;
  const w = await db.workout.findFirst({ where: { id, userId: user.id }, include: { activity: true } });
  if (!w) notFound();
  const stored = w.structure as unknown as StoredSession | null;
  const detail = stored?.detail;
  const original = w.originalPlan as unknown as StoredSession | null;
  const fueling = detail?.fueling;
  const checklist =
    w.sport === "trail" && w.durationMin
      ? gearChecklist({ durationMin: w.durationMin, distanceKm: Math.round((w.durationMin / 60) * 9), night: false, carbsPerHour: fueling?.carbsPerHour })
      : [];

  return (
    <>
      <PageHeader title={w.title} subtitle={formatDayFr(isoDay(w.day))} />

      {w.adaptedReason && (
        <section className="card mb-3 border-warn/40">
          <p className="label text-warn">Adaptée à ta forme</p>
          <p className="mt-1 text-sm">{w.adaptedReason}</p>
          {original && <p className="mt-1 text-xs text-faint">Prévu à l&apos;origine : {original.detail.title}</p>}
        </section>
      )}

      <section className="card mb-3 grid grid-cols-3 gap-3">
        <div>
          <p className="label">Durée</p>
          <p className="num mt-1 text-lg font-semibold">{w.durationMin ? fmtDur(w.durationMin) : "—"}</p>
        </div>
        <div>
          <p className="label">RPE</p>
          <p className="num mt-1 text-lg font-semibold">{w.targetRpe ?? "—"}/10</p>
        </div>
        <div>
          <p className="label">FC cible</p>
          <p className="num mt-1 text-lg font-semibold">{w.targetHrLow ? `${w.targetHrLow}-${w.targetHrHigh}` : "—"}</p>
        </div>
        {(w.dPlusM || w.maxDescentM !== null) && (
          <div className="col-span-3 flex gap-6 text-sm text-muted">
            {w.dPlusM ? <span>D+ ~{w.dPlusM} m</span> : null}
            {w.maxDescentM !== null && <span>Descente max {w.maxDescentM} m</span>}
          </div>
        )}
      </section>

      {w.sport === "football" && (
        <section className="card mb-3">
          <p className="label">Séance du club</p>
          <p className="mt-1 text-sm text-muted">
            Le contenu est décidé par ton coach de football. Après la séance, renseigne ta durée réelle et ton RPE : c&apos;est ce qui permet de calculer ta charge
            totale et d&apos;adapter le trail autour.
          </p>
        </section>
      )}

      {w.objective && (
        <section className="card mb-3">
          <p className="label">Objectif</p>
          <p className="mt-1">{w.objective}</p>
        </section>
      )}

      {detail && (
        <section className="card mb-3 space-y-3">
          {w.warmup && (
            <div>
              <p className="label">Échauffement</p>
              <p className="mt-1 text-sm">{w.warmup}</p>
            </div>
          )}
          <div>
            <p className="label mb-2">Déroulé</p>
            <ol className="space-y-2">
              {detail.blocks.map((b, i) => (
                <li key={i} className="rounded-xl bg-surface-2 p-3">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="font-semibold">{b.label}</span>
                    {b.durationMin ? <span className="num text-sm text-muted">{fmtDur(b.durationMin)}</span> : null}
                  </div>
                  <div className="num mt-1 flex flex-wrap gap-x-3 text-sm text-muted">
                    {b.pace && <span>{b.pace}</span>}
                    {b.hr && <span>FC {b.hr[0]}-{b.hr[1]}</span>}
                    {b.rpe && <span>RPE {b.rpe}</span>}
                  </div>
                  {b.note && <p className="mt-1 text-sm text-faint">{b.note}</p>}
                </li>
              ))}
            </ol>
          </div>
          {w.cooldown && (
            <div>
              <p className="label">Retour au calme</p>
              <p className="mt-1 text-sm">{w.cooldown}</p>
            </div>
          )}
        </section>
      )}

      {fueling && w.sport === "trail" && (
        <section className="card mb-3">
          <p className="label">Nutrition pendant la séance</p>
          <p className="num mt-1 text-lg font-semibold">{fueling.carbsPerHour ? `${fueling.carbsPerHour} g glucides/h` : "Eau seule"}</p>
          <p className="mt-1 text-sm text-muted">{fueling.note}</p>
        </section>
      )}

      {checklist.length > 0 && (
        <section className="card mb-3">
          <p className="label mb-2">Matériel</p>
          <ul className="space-y-1.5">
            {checklist.map((c) => (
              <li key={c.id} className="flex items-center gap-2 text-sm">
                <input type="checkbox" className="h-4 w-4 accent-[var(--color-accent)]" /> {c.label}
              </li>
            ))}
          </ul>
        </section>
      )}

      {w.activity ? (
        <Link href={`/activity/${w.activity.id}`} className="btn-ghost w-full">
          Voir la séance réalisée
        </Link>
      ) : (
        <Link href={`/log?workout=${w.id}`} className="btn-primary w-full">
          J&apos;ai fait cette séance
        </Link>
      )}
    </>
  );
}
