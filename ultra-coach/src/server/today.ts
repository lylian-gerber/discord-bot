import "server-only";
import {
  addDays,
  bedtime,
  daysBetween,
  dailyTargets,
  phaseLabel,
  PHASE_LABELS,
  type NutritionDayType,
} from "@/engine";
import type { AthleteProfile, Workout } from "@prisma/client";
import { db } from "@/lib/db";
import { dbDate, isoDay } from "@/lib/day";
import { lastMatchInfo, loadSummary, sleepInfo } from "./metrics";
import { activePlan, ensureWeekWorkouts, toPlannedWeek, weekFor } from "./plan";

const MET: Record<string, number> = {
  easy: 8, hilly: 8.5, tempo: 10, threshold: 10.5, progressive: 9.5, long: 8, hike_run: 7.5, hill_repeats: 10,
  downhill: 8, power_hike: 7, back_to_back: 8, finish_fast: 9, recovery: 3, strength_heavy: 5, strength_light: 3.5,
  football_light: 5, football_moderate: 7, football_hard: 8, match: 9,
};

const QUALITY = new Set(["tempo", "threshold", "progressive", "hill_repeats", "finish_fast", "downhill"]);

export function estimateKcal(workouts: Pick<Workout, "sessionType" | "durationMin">[], weightKg: number): number {
  return Math.round(workouts.reduce((a, w) => a + ((MET[w.sessionType] ?? 6) * weightKg * (w.durationMin ?? 0)) / 60, 0));
}

export function nutritionDayType(today: Workout[], tomorrow: Workout[]): NutritionDayType {
  if (today.some((w) => w.sessionType === "match")) return "match_day";
  if (tomorrow.some((w) => w.sessionType === "match")) return "match_eve";
  const run = today.filter((w) => w.sport === "trail");
  const longest = Math.max(0, ...run.map((w) => w.durationMin ?? 0));
  if (run.some((w) => w.sessionType === "long" || w.sessionType === "hike_run" || w.sessionType === "back_to_back")) {
    return longest >= 180 ? "very_long" : "long_run";
  }
  // Séance qualité : "dure" seulement si elle est longue, sinon charge modérée.
  if (run.some((w) => QUALITY.has(w.sessionType))) return longest >= 75 ? "hard" : "moderate";
  if (today.some((w) => w.sessionType === "football_hard")) return "hard";
  if (today.some((w) => w.sessionType === "football_moderate" || w.sessionType === "football_hard")) return "moderate";
  if (today.length > 0 && today.some((w) => w.sessionType !== "recovery")) return "light";
  return "rest";
}

export const DAY_TYPE_LABEL: Record<NutritionDayType, string> = {
  rest: "journée repos",
  light: "journée légère",
  moderate: "charge modérée",
  hard: "grosse séance",
  match_eve: "veille de match",
  match_day: "jour de match",
  long_run: "sortie longue",
  very_long: "très longue sortie",
  carb_load: "charge glucidique",
};

export function ageFrom(birth: Date, day: string): number {
  return Math.floor(daysBetween(isoDay(birth), day) / 365.25);
}

export async function nutritionFor(profile: AthleteProfile, userId: string, day: string) {
  const [today, tomorrow] = await Promise.all([
    db.workout.findMany({ where: { userId, day: dbDate(day), status: { not: "skipped" } } }),
    db.workout.findMany({ where: { userId, day: dbDate(addDays(day, 1)) } }),
  ]);
  const dayType = nutritionDayType(today, tomorrow);
  const exerciseMin = today.reduce((a, w) => a + (w.durationMin ?? 0), 0);
  const weightGoal = profile.targetWeightKg ? Math.max(-0.5, Math.min(0.5, (profile.targetWeightKg - profile.weightKg) / 12)) : 0;
  const targets = dailyTargets(
    {
      weightKg: profile.weightKg,
      heightCm: profile.heightCm,
      age: ageFrom(profile.birthDate, day),
      sex: profile.sex,
      bodyFatPct: profile.bodyFatPct ?? undefined,
      weightGoalKgPerWeek: weightGoal,
    },
    { dayType, exerciseKcal: estimateKcal(today, profile.weightKg), exerciseMin, sweatRateLph: profile.sweatRateLph ?? undefined, sweatSodiumMgPerL: profile.sweatSodiumMgPerL ?? undefined },
  );
  return { dayType, label: DAY_TYPE_LABEL[dayType], targets };
}

export async function nextMatch(userId: string, day: string) {
  const w = await db.workout.findFirst({ where: { userId, sessionType: "match", day: { gte: dbDate(day) } }, orderBy: { day: "asc" } });
  return w ? { day: isoDay(w.day), inDays: daysBetween(day, isoDay(w.day)) } : null;
}

/** Toutes les données de l'écran « Aujourd'hui ». */
export async function todayData(userId: string, profile: AthleteProfile, day: string) {
  const plan = await activePlan(userId);
  const week = await weekFor(userId, day);
  if (week) await ensureWeekWorkouts(userId, week, profile, day);
  const nextWeek = await weekFor(userId, addDays(day, 7));
  if (nextWeek && daysBetween(day, isoDay(nextWeek.monday)) <= 2) await ensureWeekWorkouts(userId, nextWeek, profile, day);

  const [workoutsToday, workoutsTomorrow, readiness, checkin, load, sleep, hydration, match, lastMatch] = await Promise.all([
    db.workout.findMany({ where: { userId, day: dbDate(day) }, orderBy: [{ sport: "asc" }], include: { activity: true } }),
    db.workout.findMany({ where: { userId, day: dbDate(addDays(day, 1)) } }),
    db.readinessScore.findUnique({ where: { userId_day: { userId, day: dbDate(day) } } }),
    db.dailyCheckin.findUnique({ where: { userId_day: { userId, day: dbDate(day) } } }),
    loadSummary(userId, day),
    sleepInfo(userId, day, profile.sleepNeedHours),
    db.hydration.aggregate({ where: { userId, day: dbDate(day) }, _sum: { ml: true } }),
    nextMatch(userId, day),
    lastMatchInfo(userId),
  ]);
  const nutrition = await nutritionFor(profile, userId, day);
  const bigTomorrow = workoutsTomorrow.some((w) => w.sessionType === "match" || QUALITY.has(w.sessionType) || w.sessionType === "long" || w.sessionType === "hike_run");

  return {
    plan,
    week: week ? toPlannedWeek(week) : null,
    phaseLabel: week ? phaseLabel(toPlannedWeek(week)) : null,
    phaseName: week ? PHASE_LABELS[week.phase] : null,
    daysToRace: plan ? daysBetween(day, isoDay(plan.goal.targetDate)) : null,
    workoutsToday,
    workoutsTomorrow,
    readiness,
    checkin,
    load,
    sleep,
    bedtime: bedtime(profile.usualWakeTime, profile.sleepNeedHours, sleep.debtHours, bigTomorrow),
    hydrationMl: hydration._sum.ml ?? 0,
    nutrition,
    match,
    lastMatch,
  };
}
