import "server-only";
import {
  addDays,
  computeBaselines,
  computeReadiness,
  nextGutTarget,
  sleepSummary,
  summarizeLoad,
  type GutSessionLog,
  type ISODate,
  type LoadCategory,
  type LoadSession,
  type ReadinessResult,
} from "@/engine";
import type { DailyCheckin, Sport } from "@prisma/client";
import { db } from "@/lib/db";
import { dbDate, isoDay } from "@/lib/day";

export const ENGINE_VERSION = "0.2.0";

const CATEGORY: Record<Sport, LoadCategory> = {
  football: "football",
  running: "running",
  trail: "trail",
  hiking: "trail",
  cycling: "cross",
  walking: "other",
  strength: "strength",
  mobility: "other",
  swimming: "cross",
  other: "other",
};

/** RPE par défaut quand l'athlète ne l'a pas saisi (marqué comme estimé dans l'UI). */
export const DEFAULT_RPE: Record<Sport, number> = {
  football: 6,
  running: 5,
  trail: 5,
  hiking: 4,
  cycling: 4,
  walking: 2,
  strength: 6,
  mobility: 2,
  swimming: 4,
  other: 4,
};

export async function loadSessions(userId: string, endDay: ISODate, days = 56): Promise<LoadSession[]> {
  const acts = await db.activity.findMany({
    where: { userId, day: { gte: dbDate(addDays(endDay, -days + 1)), lte: dbDate(endDay) } },
    select: { day: true, sport: true, durationS: true, rpe: true },
  });
  return acts.map((a) => ({
    date: isoDay(a.day),
    category: CATEGORY[a.sport],
    durationMin: Math.round(a.durationS / 60),
    rpe: a.rpe ?? DEFAULT_RPE[a.sport],
  }));
}

export async function loadSummary(userId: string, day: ISODate) {
  return summarizeLoad(await loadSessions(userId, day), day);
}

export async function sleepInfo(userId: string, day: ISODate, needHours: number) {
  const nights = await db.sleep.findMany({
    where: { userId, day: { gte: dbDate(addDays(day, -6)), lte: dbDate(day) } },
    orderBy: { day: "asc" },
  });
  return sleepSummary(nights.map((n) => ({ date: isoDay(n.day), hours: n.hours })), needHours);
}

export async function lastMatchInfo(userId: string, now = new Date()) {
  const m = await db.match.findFirst({ where: { userId, kickoffAt: { lt: now } }, orderBy: { kickoffAt: "desc" } });
  if (!m) return null;
  return { hoursSince: (now.getTime() - m.kickoffAt.getTime()) / 3_600_000, minutesPlayed: m.minutesPlayed ?? 90, recoveryRating: m.recoveryRating };
}

export async function computeReadinessFor(userId: string, checkin: DailyCheckin, sleepNeedHours: number): Promise<ReadinessResult> {
  const day = isoDay(checkin.day);
  const history = await db.dailyCheckin.findMany({
    where: { userId, day: { gte: dbDate(addDays(day, -28)), lt: dbDate(day) } },
    select: { restingHr: true, hrvRmssd: true },
  });
  const baselines = computeBaselines(
    history.map((h) => ({ restingHr: h.restingHr ?? undefined, hrvRmssd: h.hrvRmssd ?? undefined })),
    sleepNeedHours,
  );
  const [load, sleep, match] = await Promise.all([loadSummary(userId, addDays(day, -1)), sleepInfo(userId, day, sleepNeedHours), lastMatchInfo(userId)]);
  return computeReadiness(
    {
      sleepQuality: checkin.sleepQuality,
      sleepHours: checkin.sleepHours,
      fatigue: checkin.fatigue,
      legs: checkin.legs,
      pain: checkin.pain,
      motivation: checkin.motivation,
      stress: checkin.stress,
      energy: checkin.energy,
      soreness: checkin.soreness,
      restingHr: checkin.restingHr ?? undefined,
      hrvRmssd: checkin.hrvRmssd ?? undefined,
    },
    baselines,
    {
      load,
      sleepDebtHours: sleep.debtHours,
      hoursSinceMatch: match?.hoursSince,
      minutesPlayedLastMatch: match?.minutesPlayed,
    },
  );
}

export async function gutState(userId: string) {
  const logs = await db.fuelingLog.findMany({ where: { userId }, orderBy: { day: "asc" }, take: 60 });
  const history: GutSessionLog[] = logs.map((l) => ({
    date: isoDay(l.day),
    durationMin: l.durationMin,
    targetCarbsPerHour: l.targetCarbsPerHour,
    actualCarbsPerHour: l.actualCarbsPerHour,
    symptoms: (l.symptoms ?? {}) as GutSessionLog["symptoms"],
    products: ((l.products ?? []) as { name: string }[]).map((p) => p.name),
  }));
  return nextGutTarget(history);
}
