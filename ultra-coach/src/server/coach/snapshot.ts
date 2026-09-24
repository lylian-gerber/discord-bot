import "server-only";
import { addDays, daysBetween, PHASE_LABELS } from "@/engine";
import type { AthleteProfile, User } from "@prisma/client";
import { db } from "@/lib/db";
import { dbDate, isoDay, localToday, weekdayName } from "@/lib/day";
import { weekdayMon0 } from "@/engine";
import { gutState } from "../metrics";
import { todayData } from "../today";

/**
 * Contexte compact injecté à chaque échange avec le coach : c'est ce qui
 * garantit que l'IA ne répond jamais uniquement sur le dernier message.
 */
export async function buildAthleteSnapshot(user: User, profile: AthleteProfile) {
  const day = localToday(user.timezone);
  const t = await todayData(user.id, profile, day);
  const [recent, injuries, nextDays, gut, checkins] = await Promise.all([
    db.activity.findMany({
      where: { userId: user.id, day: { gte: dbDate(addDays(day, -13)) } },
      orderBy: { startAt: "asc" },
      include: { match: true },
    }),
    db.injuryNote.findMany({ where: { userId: user.id, status: { not: "resolved" } }, orderBy: { day: "desc" }, take: 5 }),
    db.workout.findMany({ where: { userId: user.id, day: { gte: dbDate(day), lte: dbDate(addDays(day, 6)) } }, orderBy: { day: "asc" } }),
    gutState(user.id),
    db.dailyCheckin.findMany({ where: { userId: user.id, day: { gte: dbDate(addDays(day, -6)) } }, orderBy: { day: "asc" } }),
  ]);

  const goal = t.plan?.goal;
  return {
    today: day,
    weekday: weekdayName(weekdayMon0(day)),
    athlete: {
      name: user.name,
      age: Math.floor(daysBetween(isoDay(profile.birthDate), day) / 365.25),
      weightKg: profile.weightKg,
      heightCm: profile.heightCm,
      football: { level: profile.footballLevel, position: profile.footballPosition },
      vma: profile.vma,
      maxHr: profile.maxHr,
      allergies: profile.allergies,
      dislikedFoods: profile.dislikedFoods,
    },
    goal: goal && {
      race: goal.race?.name,
      date: isoDay(goal.targetDate),
      distanceKm: goal.distanceKm,
      dPlusM: goal.dPlusM,
      daysLeft: t.daysToRace,
      targetTimeH: goal.targetTimeMin ? goal.targetTimeMin / 60 : "finir",
    },
    planWarnings: t.plan?.warnings ?? [],
    phase: t.week && {
      name: PHASE_LABELS[t.week.phase],
      week: t.week.phaseWeek,
      of: t.week.phaseWeeks,
      footballContext: t.week.context,
      isDeload: t.week.isDeload,
      targetRunHours: t.week.runHours,
      targetLongRunMin: t.week.longRunMin,
    },
    football: {
      nextMatch: t.match ? { date: t.match.day, inDays: t.match.inDays } : null,
      lastMatch: t.lastMatch ? { hoursAgo: Math.round(t.lastMatch.hoursSince), minutesPlayed: t.lastMatch.minutesPlayed } : null,
    },
    readinessToday: t.readiness
      ? {
          total: t.readiness.total,
          recovery: t.readiness.recovery,
          legs: t.readiness.legs,
          cardio: t.readiness.cardio,
          sleep: t.readiness.sleep,
          tier: t.readiness.tier,
          blockRunning: t.readiness.blockRunning,
          flags: t.readiness.flags,
          engineRecommendation: t.readiness.recommendation,
        }
      : "check-in du jour non fait",
    checkinsLast7Days: checkins.map((c) => ({
      day: isoDay(c.day),
      sleepH: c.sleepHours,
      fatigue: c.fatigue,
      legs: c.legs,
      pain: c.pain,
      painWhere: c.painLocation,
      note: c.freeText,
    })),
    load: {
      acute7: t.load.acute7,
      chronicWeeklyAvg: t.load.chronic28WeeklyAvg,
      acwr: t.load.acwrEwma ?? t.load.acwrRolling,
      weeklyChangePct: t.load.weeklyChangePct,
      status: t.load.status,
      byCategory7: t.load.byCategory7,
      alerts: t.load.alerts,
    },
    next7DaysPlan: nextDays.map((w) => ({
      day: isoDay(w.day),
      title: w.title,
      type: w.sessionType,
      durationMin: w.durationMin,
      maxDescentM: w.maxDescentM,
      status: w.status,
    })),
    last14DaysActivities: recent.map((a) => ({
      day: isoDay(a.day),
      sport: a.sport,
      match: a.match ? { minutesPlayed: a.match.minutesPlayed } : undefined,
      durationMin: Math.round(a.durationS / 60),
      distanceKm: a.distanceM ? Math.round(a.distanceM / 100) / 10 : undefined,
      dPlusM: a.dPlusM ?? undefined,
      avgHr: a.avgHr ?? undefined,
      rpe: a.rpe ?? undefined,
      load: a.trainingLoad ?? undefined,
      feeling: a.feeling ?? undefined,
    })),
    sleep: { lastNightH: t.sleep.lastNight, avg7H: t.sleep.avg7, debtH: t.sleep.debtHours, suggestedBedtime: t.bedtime },
    nutritionToday: { dayType: t.nutrition.label, ...t.nutrition.targets, drankMl: t.hydrationMl },
    gutTraining: { currentCarbsPerHour: gut.nextTarget, productsToAvoid: gut.productsToAvoid },
    openInjuries: injuries.map((i) => ({ since: isoDay(i.day), where: i.location, pain: i.pain, context: i.context })),
  };
}
