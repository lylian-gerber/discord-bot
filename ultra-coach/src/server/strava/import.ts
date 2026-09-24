import "server-only";
import { computeDurability, sessionLoad } from "@/engine";
import type { Integration, Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { dbDate } from "@/lib/day";
import { linkPlannedWorkout } from "../activities";
import { DEFAULT_RPE } from "../metrics";
import { stravaGet } from "./client";
import { estimateRpe, localDay, mapSport, toStreamPoints, type StravaStreams, type StravaSummary } from "./map";

const STREAM_KEYS = "time,distance,altitude,heartrate,cadence,watts,moving";
const ENDURANCE = new Set(["running", "trail", "hiking", "cycling", "walking"]);

/**
 * Importe (ou met à jour) une activité Strava. Idempotent.
 * - dédoublonne avec une saisie manuelle du même jour (même sport, durée ±20 %)
 * - calcule la durabilité à partir des streams pour les sorties d'endurance ≥ 45 min
 * - rattache l'activité à la séance planifiée du jour
 */
export async function importStravaActivity(integration: Integration, summary: StravaSummary, opts: { withStreams?: boolean } = {}) {
  const userId = integration.userId;
  const profile = await db.athleteProfile.findUnique({ where: { userId } });
  const sport = mapSport(summary.sport_type);
  const day = localDay(summary);
  const durationS = summary.moving_time;
  const externalId = String(summary.id);

  const existing = await db.activity.findUnique({ where: { userId_source_externalId: { userId, source: "strava", externalId } } });
  // Une saisie manuelle équivalente devient l'activité Strava (on garde le RPE et le ressenti saisis).
  const manual = existing
    ? null
    : await db.activity.findFirst({
        where: {
          userId,
          source: "manual",
          sport,
          day: dbDate(day),
          durationS: { gte: Math.round(durationS * 0.8), lte: Math.round(durationS * 1.2) },
        },
      });
  const keep = existing ?? manual;

  const est = estimateRpe(summary, profile?.maxHr);
  // Priorité : RPE saisi par l'athlète dans l'appli > ressenti saisi dans Strava > estimation FC > défaut du sport.
  const userRpe = keep && keep.rpe !== null && !keep.rpeEstimated ? keep.rpe : null;
  const rpe = userRpe ?? est.rpe ?? DEFAULT_RPE[sport];
  const rpeEstimated = userRpe === null && est.estimated;

  let durability: Prisma.InputJsonValue | undefined;
  if (opts.withStreams && ENDURANCE.has(sport) && durationS >= 45 * 60 && summary.distance > 0) {
    const streams = await stravaGet<StravaStreams>(integration, `/activities/${summary.id}/streams?keys=${STREAM_KEYS}&key_by_type=true`);
    const result = computeDurability(toStreamPoints(streams));
    if (result) durability = result as unknown as Prisma.InputJsonValue;
  }

  const data = {
    userId,
    source: "strava",
    externalId,
    sport,
    name: summary.name,
    startAt: new Date(summary.start_date),
    day: dbDate(day),
    durationS,
    elapsedS: summary.elapsed_time,
    distanceM: summary.distance || null,
    dPlusM: summary.total_elevation_gain ?? null,
    avgHr: summary.average_heartrate ?? null,
    maxHr: summary.max_heartrate ?? null,
    avgCadence: summary.average_cadence ? summary.average_cadence * (sport === "cycling" ? 1 : 2) : null,
    avgPowerW: summary.average_watts ?? null,
    avgSpeedMps: summary.average_speed ?? null,
    // kJ de travail mécanique ≈ kcal dépensées (rendement ~24 %)
    calories: summary.calories ?? summary.kilojoules ?? null,
    polyline: summary.map?.summary_polyline ?? null,
    rpe,
    rpeEstimated,
    trainingLoad: sessionLoad({ durationMin: Math.round(durationS / 60), rpe }),
    ...(durability ? { durability } : {}),
  };

  const activity = keep ? await db.activity.update({ where: { id: keep.id }, data }) : await db.activity.create({ data });
  await db.stravaActivity.upsert({
    where: { stravaId: BigInt(summary.id) },
    create: { activityId: activity.id, stravaId: BigInt(summary.id), sportType: summary.sport_type, raw: summary as unknown as Prisma.InputJsonValue, streamsFetched: Boolean(durability) },
    update: { activityId: activity.id, sportType: summary.sport_type, raw: summary as unknown as Prisma.InputJsonValue, ...(durability ? { streamsFetched: true } : {}) },
  });
  if (!keep) await linkPlannedWorkout(userId, activity.id, sport, day);
  return activity;
}

export async function importStravaById(integration: Integration, stravaId: number) {
  const summary = await stravaGet<StravaSummary>(integration, `/activities/${stravaId}`);
  return importStravaActivity(integration, summary, { withStreams: true });
}

export async function deleteStravaActivity(integration: Integration, stravaId: number) {
  const link = await db.stravaActivity.findUnique({ where: { stravaId: BigInt(stravaId) }, include: { activity: true } });
  if (!link || link.activity.userId !== integration.userId) return;
  await db.workout.updateMany({ where: { activityId: link.activityId }, data: { activityId: null, status: "planned" } });
  await db.activity.delete({ where: { id: link.activityId } });
}

/**
 * Import de l'historique récent (charge chronique + baselines).
 * Économe en requêtes : streams uniquement pour les 21 derniers jours (max 15).
 */
export async function backfillStrava(integration: Integration, days = 84) {
  const after = Math.floor(Date.now() / 1000) - days * 86_400;
  const recentCutoff = Date.now() - 21 * 86_400_000;
  let streamsBudget = 15;
  let imported = 0;
  for (let page = 1; page <= 5; page++) {
    const list = await stravaGet<StravaSummary[]>(integration, `/athlete/activities?after=${after}&per_page=100&page=${page}`);
    for (const a of list) {
      const withStreams = streamsBudget > 0 && new Date(a.start_date).getTime() > recentCutoff;
      const act = await importStravaActivity(integration, a, { withStreams });
      if (withStreams && act.durability) streamsBudget--;
      imported++;
    }
    if (list.length < 100) break;
  }
  await db.integration.update({ where: { id: integration.id }, data: { lastSyncAt: new Date() } });
  return imported;
}
