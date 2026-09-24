"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireAthlete } from "@/lib/auth";
import { db } from "@/lib/db";
import { dbDate, localToday } from "@/lib/day";
import { ENGINE_VERSION, computeReadinessFor } from "@/server/metrics";
import { adaptDay } from "@/server/plan";

const scale = z.coerce.number().int().min(0).max(10);
const schema = z.object({
  sleepQuality: scale,
  sleepHours: z.coerce.number().min(0).max(16),
  fatigue: scale,
  legs: scale,
  pain: scale,
  painLocation: z.string().max(100).optional(),
  motivation: scale,
  stress: scale,
  energy: scale,
  soreness: scale,
  restingHr: z.preprocess((v) => (v === "" ? undefined : v), z.coerce.number().int().min(25).max(120).optional()),
  hrvRmssd: z.preprocess((v) => (v === "" ? undefined : v), z.coerce.number().min(5).max(300).optional()),
  freeText: z.string().max(1000).optional(),
});

export type CheckinState = { error?: string } | undefined;

export async function saveCheckin(_: CheckinState, form: FormData): Promise<CheckinState> {
  const { user, profile } = await requireAthlete();
  const parsed = schema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: "Vérifie les valeurs saisies." };
  const v = parsed.data;
  const day = localToday(user.timezone);
  const data = { ...v, painLocation: v.painLocation || null, freeText: v.freeText || null, restingHr: v.restingHr ?? null, hrvRmssd: v.hrvRmssd ?? null };

  const checkin = await db.dailyCheckin.upsert({
    where: { userId_day: { userId: user.id, day: dbDate(day) } },
    create: { userId: user.id, day: dbDate(day), ...data },
    update: data,
  });
  await db.sleep.upsert({
    where: { userId_day_source: { userId: user.id, day: dbDate(day), source: "manual" } },
    create: { userId: user.id, day: dbDate(day), hours: v.sleepHours, quality: v.sleepQuality, source: "manual" },
    update: { hours: v.sleepHours, quality: v.sleepQuality },
  });
  if (v.pain >= 4 && v.painLocation) {
    await db.injuryNote.create({ data: { userId: user.id, day: dbDate(day), location: v.painLocation, pain: v.pain, context: v.freeText || null } });
  }

  const r = await computeReadinessFor(user.id, checkin, profile.sleepNeedHours);
  const row = { total: r.total, recovery: r.recovery, legs: r.legs, cardio: r.cardio, sleep: r.sleep, mind: r.mind, tier: r.tier, blockRunning: r.blockRunning, flags: r.flags, recommendation: r.recommendation, engineVersion: ENGINE_VERSION };
  await db.readinessScore.upsert({
    where: { userId_day: { userId: user.id, day: dbDate(day) } },
    create: { userId: user.id, day: dbDate(day), ...row },
    update: row,
  });
  await adaptDay(user.id, day, r, profile);
  revalidatePath("/");
  redirect("/");
}
