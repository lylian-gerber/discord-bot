"use server";

import type { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { sessionLoad } from "@/engine";
import { requireAthlete } from "@/lib/auth";
import { db } from "@/lib/db";
import { dbDate, localToday } from "@/lib/day";
import { linkPlannedWorkout } from "@/server/activities";

const num = (min: number, max: number) => z.preprocess((v) => (v === "" || v === null ? undefined : v), z.coerce.number().min(min).max(max).optional());
const SPORTS = ["football", "running", "trail", "hiking", "cycling", "walking", "strength", "mobility", "swimming", "other"] as const;

const schema = z.object({
  workoutId: z.string().optional(),
  sport: z.enum(SPORTS),
  isMatch: z.preprocess((v) => v === "on", z.boolean()),
  day: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  durationMin: z.coerce.number().int().min(1).max(2000),
  distanceKm: num(0, 400),
  dPlusM: num(0, 20000),
  avgHr: num(40, 230),
  rpe: z.coerce.number().min(0).max(10),
  minutesPlayed: num(0, 130),
  feeling: z.string().max(1000).optional(),
  carbsTotalG: num(0, 2000),
  products: z.string().max(300).optional(),
  nausea: num(0, 10),
  bloating: num(0, 10),
  cramps: num(0, 10),
  hunger: num(0, 10),
});

export type LogState = { error?: string } | undefined;

export async function logActivity(_: LogState, form: FormData): Promise<LogState> {
  const { user } = await requireAthlete();
  const parsed = schema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: `Vérifie : ${String(parsed.error.issues[0]?.path[0] ?? "")}` };
  const v = parsed.data;
  if (v.day > localToday(user.timezone)) return { error: "Impossible d'enregistrer une séance dans le futur." };

  const activity = await db.activity.create({
    data: {
      userId: user.id,
      source: "manual",
      sport: v.sport,
      name: v.isMatch ? "Match" : undefined,
      startAt: new Date(`${v.day}T12:00:00Z`),
      day: dbDate(v.day),
      durationS: v.durationMin * 60,
      distanceM: v.distanceKm !== undefined ? v.distanceKm * 1000 : undefined,
      dPlusM: v.dPlusM,
      avgHr: v.avgHr,
      avgSpeedMps: v.distanceKm ? (v.distanceKm * 1000) / (v.durationMin * 60) : undefined,
      rpe: v.rpe,
      feeling: v.feeling || undefined,
      trainingLoad: sessionLoad({ durationMin: v.durationMin, rpe: v.rpe }),
    },
  });

  if (v.sport === "football") {
    if (v.isMatch) {
      await db.match.create({
        data: { userId: user.id, activityId: activity.id, kickoffAt: new Date(`${v.day}T17:00:00Z`), minutesPlayed: v.minutesPlayed ?? v.durationMin },
      });
    }
  }

  // Rattachement à la séance planifiée
  const planned = await linkPlannedWorkout(user.id, activity.id, v.sport, v.day, v.workoutId);

  // Ravitaillement / entraînement du ventre
  if (v.carbsTotalG !== undefined && v.durationMin >= 45) {
    const fueling = planned?.fueling as { carbsPerHour?: number } | null;
    await db.fuelingLog.create({
      data: {
        userId: user.id,
        activityId: activity.id,
        day: dbDate(v.day),
        durationMin: v.durationMin,
        targetCarbsPerHour: fueling?.carbsPerHour ?? 30,
        actualCarbsPerHour: Math.round((v.carbsTotalG / (v.durationMin / 60)) * 10) / 10,
        products: (v.products ?? "")
          .split(",")
          .map((p) => p.trim())
          .filter(Boolean)
          .map((name) => ({ name })) as unknown as Prisma.InputJsonValue,
        symptoms: { nausea: v.nausea ?? 0, bloating: v.bloating ?? 0, cramps: v.cramps ?? 0, hunger: v.hunger ?? 0 },
      },
    });
  }

  revalidatePath("/");
  revalidatePath("/plan");
  redirect(`/activity/${activity.id}`);
}
