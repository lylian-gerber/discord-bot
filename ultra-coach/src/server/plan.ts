import "server-only";
import {
  addDays,
  adaptSession,
  daysBetween,
  buildMacrocycle,
  describeSession,
  macroWarnings,
  mondayOf,
  planWeek,
  plannedVolumeFactor,
  type MacroInput,
  type PlannedSession,
  type PlannedWeek,
  type ReadinessResult,
  type SessionDetail,
  type WeekDayPlan,
} from "@/engine";
import { Prisma, type AthleteProfile, type TrainingWeek } from "@prisma/client";
import { db } from "@/lib/db";
import { dbDate, isoDay } from "@/lib/day";
import { ENGINE_VERSION, gutState, lastMatchInfo, loadSummary } from "./metrics";

export const DEFAULT_FOOTBALL_WEEK: WeekDayPlan[] = [
  { weekday: 0, football: "light" },
  { weekday: 1, football: "moderate" },
  { weekday: 2, football: "light" },
  { weekday: 3, football: "none" },
  { weekday: 4, football: "light" },
  { weekday: 5, football: "match" },
  { weekday: 6, football: "none" },
];

export const FOOTBALL_LABEL: Record<WeekDayPlan["football"], string> = {
  none: "Pas de foot",
  light: "Football léger",
  moderate: "Football modéré",
  hard: "Football intense",
  match: "Match",
};

const FOOTBALL_MIN: Record<WeekDayPlan["football"], number> = { none: 0, light: 75, moderate: 90, hard: 90, match: 95 };
const FOOTBALL_RPE: Record<WeekDayPlan["football"], number> = { none: 0, light: 4, moderate: 6, hard: 7, match: 8 };

/** Ce qui est stocké dans Workout.structure pour une séance trail/muscu. */
export interface StoredSession {
  session: PlannedSession;
  detail: SessionDetail;
}

export async function footballTemplate(userId: string): Promise<WeekDayPlan[]> {
  const t = await db.footballWeekTemplate.findFirst({ where: { userId, isDefault: true } });
  return (t?.days as WeekDayPlan[] | undefined) ?? DEFAULT_FOOTBALL_WEEK;
}

export function macroInputFor(profile: AthleteProfile, goal: { targetDate: Date; distanceKm: number; dPlusM: number }, start: string, current: { weeklyRunHours: number; longestRunMin: number }): MacroInput {
  return {
    start,
    raceDate: isoDay(goal.targetDate),
    raceDistanceKm: goal.distanceKm,
    raceDplusM: goal.dPlusM,
    currentWeeklyRunHours: current.weeklyRunHours,
    currentLongestRunMin: current.longestRunMin,
    seasonEnd: profile.seasonEnd ? isoDay(profile.seasonEnd) : undefined,
    breaks: profile.winterBreakFrom && profile.winterBreakTo ? [{ from: isoDay(profile.winterBreakFrom), to: isoDay(profile.winterBreakTo) }] : [],
  };
}

/** Crée (ou remplace) le plan actif à partir du profil et de l'objectif. */
export async function createPlan(userId: string, goalId: string, input: MacroInput) {
  const weeks = buildMacrocycle(input);
  const warnings = macroWarnings(weeks, input);
  await db.trainingPlan.updateMany({ where: { userId, isActive: true }, data: { isActive: false } });
  // Les séances futures non réalisées de l'ancien plan sont retirées.
  await db.workout.deleteMany({ where: { userId, day: { gte: dbDate(input.start) }, activityId: null } });
  return db.trainingPlan.create({
    data: {
      userId,
      goalId,
      engineVersion: ENGINE_VERSION,
      inputs: input as unknown as Prisma.InputJsonValue,
      warnings,
      weeks: {
        create: weeks.map((w) => ({
          index: w.index,
          monday: dbDate(w.monday),
          phase: w.phase,
          phaseWeek: w.phaseWeek,
          phaseWeeks: w.phaseWeeks,
          isDeload: w.isDeload,
          context: w.context,
          targetRunHours: w.runHours,
          targetLongRunMin: w.longRunMin,
          targetDplusM: w.dPlusM,
          backToBack: w.backToBack,
          gutTraining: w.gutTraining,
          raceSimulation: w.raceSimulation,
          focus: w.focus,
        })),
      },
    },
  });
}

export function toPlannedWeek(w: TrainingWeek): PlannedWeek {
  return {
    index: w.index,
    monday: isoDay(w.monday),
    phase: w.phase,
    phaseWeek: w.phaseWeek,
    phaseWeeks: w.phaseWeeks,
    isDeload: w.isDeload,
    context: w.context,
    runHours: w.targetRunHours,
    longRunMin: w.targetLongRunMin,
    dPlusM: w.targetDplusM,
    backToBack: w.backToBack,
    gutTraining: w.gutTraining,
    raceSimulation: w.raceSimulation,
    focus: w.focus,
  };
}

export async function activePlan(userId: string) {
  return db.trainingPlan.findFirst({ where: { userId, isActive: true }, include: { goal: { include: { race: true } } } });
}

export async function weekFor(userId: string, day: string) {
  const plan = await activePlan(userId);
  if (!plan) return null;
  return db.trainingWeek.findFirst({ where: { planId: plan.id, monday: dbDate(mondayOf(day)) } });
}

/** Génère les séances de la semaine si ce n'est pas déjà fait. */
export async function ensureWeekWorkouts(userId: string, week: TrainingWeek, profile: AthleteProfile, today: string) {
  if (week.workoutsGeneratedAt) return;
  await generateWeekWorkouts(userId, week, profile, today);
}

/**
 * (Re)génère les séances de la semaine à partir d'aujourd'hui.
 * Les jours passés et les séances déjà réalisées ne sont jamais touchés,
 * et le volume déjà couru cette semaine est déduit.
 */
export async function generateWeekWorkouts(userId: string, week: TrainingWeek, profile: AthleteProfile, today: string) {
  const monday = isoDay(week.monday);
  const sunday = addDays(monday, 6);
  if (today > sunday) return; // semaine passée : on ne réécrit pas l'historique
  const fromDay = today > monday ? today : monday;
  const days = (week.footballDays as WeekDayPlan[] | null) ?? (await footballTemplate(userId));

  const [doneActivities, doneWorkouts] = await Promise.all([
    db.activity.findMany({ where: { userId, day: { gte: dbDate(monday), lte: dbDate(sunday) } }, select: { day: true, sport: true, durationS: true } }),
    db.workout.findMany({ where: { userId, weekId: week.id, activityId: { not: null } }, select: { day: true, sport: true } }),
  ]);
  const RUN = new Set(["running", "trail", "hiking"]);
  const runActs = doneActivities.filter((a) => RUN.has(a.sport));
  const doneRunMin = Math.round(runActs.reduce((a, x) => a + x.durationS, 0) / 60);
  const blockedWeekdays = new Set<number>();
  for (let i = 0; i < 7; i++) if (addDays(monday, i) < fromDay) blockedWeekdays.add(i);
  for (const a of doneActivities) if (a.sport !== "football") blockedWeekdays.add(daysBetween(monday, isoDay(a.day)));
  const footballDone = new Set(doneWorkouts.filter((w) => w.sport === "football").map((w) => isoDay(w.day)));

  // Ajustement automatique du volume selon l'état de charge à l'entrée de la semaine.
  const load = await loadSummary(userId, addDays(monday, -1));
  const factor = plannedVolumeFactor(load);
  const base = toPlannedWeek(week);
  const pw: PlannedWeek = {
    ...base,
    runHours: Math.round(base.runHours * factor * 4) / 4,
    longRunMin: Math.round((base.longRunMin * Math.min(factor, 1)) / 5) * 5,
  };
  const lastMatch = await lastMatchInfo(userId, new Date(`${monday}T00:00:00Z`));
  const planned = planWeek(days, pw, {
    lastMatchMinutes: lastMatch?.minutesPlayed,
    blockedWeekdays: [...blockedWeekdays],
    doneRunMin,
    longRunDone: runActs.some((a) => a.durationS / 60 >= pw.longRunMin * 0.8),
  });
  const gut = await gutState(userId);
  const paces = { vma: profile.vma ?? undefined, maxHr: profile.maxHr ?? undefined };

  const rows: Prisma.WorkoutCreateManyInput[] = [];
  for (const d of planned) {
    const iso = addDays(monday, d.weekday);
    if (iso < fromDay) continue;
    const day = dbDate(iso);
    if (d.football !== "none" && !footballDone.has(iso)) {
      rows.push({
        userId,
        weekId: week.id,
        day,
        sport: "football",
        sessionType: d.football === "match" ? "match" : `football_${d.football}`,
        title: FOOTBALL_LABEL[d.football],
        durationMin: FOOTBALL_MIN[d.football],
        targetRpe: FOOTBALL_RPE[d.football],
      });
    }
    for (const s of d.sessions) rows.push(sessionRow(userId, week.id, day, s, paces, week.gutTraining ? gut.nextTarget : 30));
  }

  await db.$transaction([
    db.workout.deleteMany({ where: { weekId: week.id, activityId: null, day: { gte: dbDate(fromDay) } } }),
    db.workout.createMany({ data: rows }),
    db.trainingWeek.update({ where: { id: week.id }, data: { workoutsGeneratedAt: new Date(), appliedFactor: factor, footballDays: days as unknown as Prisma.InputJsonValue } }),
  ]);
}

function sessionRow(
  userId: string,
  weekId: string,
  day: Date,
  s: PlannedSession,
  paces: { vma?: number; maxHr?: number },
  gutStep: number,
): Prisma.WorkoutCreateManyInput {
  const detail = describeSession(s, paces, gutStep);
  const sport = s.type.startsWith("strength") ? "strength" : s.type === "recovery" ? "mobility" : "trail";
  const stored: StoredSession = { session: s, detail };
  return {
    userId,
    weekId,
    day,
    sport,
    sessionType: s.type,
    title: detail.title,
    objective: detail.objective,
    durationMin: s.durationMin,
    dPlusM: s.dPlusM,
    maxDescentM: s.maxDescentM,
    targetRpe: detail.targetRpe,
    targetHrLow: detail.hrRange?.[0],
    targetHrHigh: detail.hrRange?.[1],
    structure: stored as unknown as Prisma.InputJsonValue,
    warmup: detail.warmup,
    cooldown: detail.cooldown,
    fueling: detail.fueling as unknown as Prisma.InputJsonValue,
  };
}

/** Adapte les séances trail/muscu du jour au readiness. Le football n'est jamais touché. */
export async function adaptDay(userId: string, day: string, r: ReadinessResult, profile: AthleteProfile) {
  const workouts = await db.workout.findMany({
    where: { userId, day: dbDate(day), sport: { not: "football" }, status: { in: ["planned", "adapted"] }, activityId: null },
  });
  const paces = { vma: profile.vma ?? undefined, maxHr: profile.maxHr ?? undefined };
  for (const w of workouts) {
    const stored = (w.originalPlan ?? w.structure) as unknown as StoredSession | null;
    if (!stored?.session) continue;
    const adapted = adaptSession(stored.session, r);
    const unchanged = adapted && JSON.stringify(adapted) === JSON.stringify(stored.session);
    if (unchanged) {
      if (w.status === "adapted") {
        await db.workout.update({ where: { id: w.id }, data: { ...detailFields(stored), status: "planned", adaptedReason: null, originalPlan: Prisma.DbNull } });
      }
      continue;
    }
    if (!adapted) {
      await db.workout.update({ where: { id: w.id }, data: { status: "skipped", adaptedReason: r.recommendation, originalPlan: stored as unknown as Prisma.InputJsonValue } });
      continue;
    }
    const gut = (stored.detail.fueling?.carbsPerHour ?? 40) || 40;
    const next: StoredSession = { session: adapted, detail: describeSession(adapted, paces, gut) };
    await db.workout.update({
      where: { id: w.id },
      data: { ...detailFields(next), status: "adapted", adaptedReason: r.recommendation, originalPlan: stored as unknown as Prisma.InputJsonValue },
    });
  }
}

function detailFields(s: StoredSession) {
  return {
    sessionType: s.session.type,
    title: s.detail.title,
    objective: s.detail.objective,
    durationMin: s.session.durationMin,
    dPlusM: s.session.dPlusM ?? null,
    maxDescentM: s.session.maxDescentM ?? null,
    targetRpe: s.detail.targetRpe,
    targetHrLow: s.detail.hrRange?.[0] ?? null,
    targetHrHigh: s.detail.hrRange?.[1] ?? null,
    structure: s as unknown as Prisma.InputJsonValue,
    warmup: s.detail.warmup ?? null,
    cooldown: s.detail.cooldown ?? null,
    fueling: s.detail.fueling as unknown as Prisma.InputJsonValue,
  };
}
