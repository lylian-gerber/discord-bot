"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import type { Prisma } from "@prisma/client";
import type { WeekDayPlan } from "@/engine";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { dbDate, localToday } from "@/lib/day";
import { createPlan, macroInputFor } from "@/server/plan";

const opt = <T extends z.ZodType>(s: T) => z.preprocess((v) => (v === "" || v === null ? undefined : v), s.optional());
const list = z.preprocess(
  (v) =>
    String(v ?? "")
      .split(",")
      .map((x) => x.trim())
      .filter(Boolean),
  z.array(z.string().max(60)).max(40),
);
const FOOT = z.enum(["none", "light", "moderate", "hard", "match"]);

const schema = z.object({
  birthDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date de naissance"),
  sex: z.enum(["male", "female"]),
  heightCm: z.coerce.number().min(120).max(230),
  weightKg: z.coerce.number().min(35).max(200),
  targetWeightKg: opt(z.coerce.number().min(35).max(200)),
  bodyFatPct: opt(z.coerce.number().min(3).max(50)),
  maxHr: opt(z.coerce.number().int().min(140).max(230)),
  vma: opt(z.coerce.number().min(10).max(26)),
  usualWakeTime: z.string().regex(/^\d{2}:\d{2}$/),
  sleepNeedHours: z.coerce.number().min(6).max(10),
  footballLevel: z.string().max(60),
  footballPosition: z.string().max(60).optional(),
  seasonEnd: opt(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)),
  winterBreakFrom: opt(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)),
  winterBreakTo: opt(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)),
  d0: FOOT, d1: FOOT, d2: FOOT, d3: FOOT, d4: FOOT, d5: FOOT, d6: FOOT,
  raceName: z.string().trim().min(1).max(100),
  raceType: z.string().max(40),
  distanceKm: z.coerce.number().min(10).max(400),
  dPlusM: z.coerce.number().int().min(0).max(30000),
  targetDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  targetTimeH: opt(z.coerce.number().min(1).max(100)),
  priority: z.enum(["A", "B", "C"]),
  currentLevel: z.string().max(60),
  weeklyRunHours: z.coerce.number().min(0).max(30),
  longestRunMin: z.coerce.number().min(0).max(1200),
  mealsPerDay: z.coerce.number().int().min(2).max(8),
  dietaryPattern: z.string().max(60).optional(),
  likedFoods: list,
  dislikedFoods: list,
  allergies: list,
});

export type OnboardingState = { error?: string } | undefined;

export async function saveOnboarding(_: OnboardingState, form: FormData): Promise<OnboardingState> {
  const user = await requireUser();
  const parsed = schema.safeParse(Object.fromEntries(form));
  if (!parsed.success) {
    const i = parsed.error.issues[0];
    return { error: `Champ invalide : ${String(i?.path[0] ?? "")} — ${i?.message ?? ""}` };
  }
  const v = parsed.data;
  const today = localToday(user.timezone);
  if (v.targetDate <= today) return { error: "La date de course doit être dans le futur." };

  const profileData = {
    birthDate: dbDate(v.birthDate),
    sex: v.sex,
    heightCm: v.heightCm,
    weightKg: v.weightKg,
    targetWeightKg: v.targetWeightKg ?? null,
    bodyFatPct: v.bodyFatPct ?? null,
    maxHr: v.maxHr ?? null,
    vma: v.vma ?? null,
    usualWakeTime: v.usualWakeTime,
    sleepNeedHours: v.sleepNeedHours,
    footballLevel: v.footballLevel,
    footballPosition: v.footballPosition || null,
    seasonEnd: v.seasonEnd ? dbDate(v.seasonEnd) : null,
    winterBreakFrom: v.winterBreakFrom ? dbDate(v.winterBreakFrom) : null,
    winterBreakTo: v.winterBreakTo ? dbDate(v.winterBreakTo) : null,
    mealsPerDay: v.mealsPerDay,
    dietaryPattern: v.dietaryPattern || null,
    likedFoods: v.likedFoods,
    dislikedFoods: v.dislikedFoods,
    allergies: v.allergies,
  };
  const profile = await db.athleteProfile.upsert({
    where: { userId: user.id },
    create: { userId: user.id, ...profileData },
    update: profileData,
  });

  const days: WeekDayPlan[] = [v.d0, v.d1, v.d2, v.d3, v.d4, v.d5, v.d6].map((football, weekday) => ({ weekday, football }));
  const existing = await db.footballWeekTemplate.findFirst({ where: { userId: user.id, isDefault: true } });
  const daysJson = days as unknown as Prisma.InputJsonValue;
  if (existing) await db.footballWeekTemplate.update({ where: { id: existing.id }, data: { days: daysJson } });
  else await db.footballWeekTemplate.create({ data: { userId: user.id, days: daysJson } });

  await db.goal.updateMany({ where: { userId: user.id, status: "active" }, data: { status: "replaced" } });
  const race = await db.race.create({ data: { name: v.raceName, distanceKm: v.distanceKm, dPlusM: v.dPlusM, date: dbDate(v.targetDate) } });
  const goal = await db.goal.create({
    data: {
      userId: user.id,
      raceId: race.id,
      type: v.raceType,
      distanceKm: v.distanceKm,
      dPlusM: v.dPlusM,
      targetDate: dbDate(v.targetDate),
      targetTimeMin: v.targetTimeH ? Math.round(v.targetTimeH * 60) : null,
      priority: v.priority,
      currentLevel: v.currentLevel,
    },
  });

  try {
    await createPlan(user.id, goal.id, macroInputFor(profile, goal, today, { weeklyRunHours: v.weeklyRunHours, longestRunMin: v.longestRunMin }));
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Impossible de générer le plan." };
  }
  redirect("/");
}
