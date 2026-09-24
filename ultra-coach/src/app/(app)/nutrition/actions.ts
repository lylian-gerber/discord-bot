"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { sweatRate } from "@/engine";
import { requireAthlete } from "@/lib/auth";
import { db } from "@/lib/db";
import { dbDate, localToday } from "@/lib/day";

export async function addWater(form: FormData) {
  const { user } = await requireAthlete();
  const ml = z.coerce.number().int().min(50).max(2000).parse(form.get("ml"));
  await db.hydration.create({ data: { userId: user.id, at: new Date(), day: dbDate(localToday(user.timezone)), ml } });
  revalidatePath("/nutrition");
  revalidatePath("/");
}

const sweatSchema = z.object({
  weightBeforeKg: z.coerce.number().min(35).max(200),
  weightAfterKg: z.coerce.number().min(35).max(200),
  fluidIntakeMl: z.coerce.number().min(0).max(10000),
  durationMin: z.coerce.number().min(20).max(1440),
  temperatureC: z.preprocess((v) => (v === "" ? undefined : v), z.coerce.number().min(-20).max(50).optional()),
});

export type SweatState = { result?: { sweatRateLph: number; bodyMassLossPct: number; warnings: string[] }; error?: string } | undefined;

export async function saveSweatTest(_: SweatState, form: FormData): Promise<SweatState> {
  const { user } = await requireAthlete();
  const parsed = sweatSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: "Vérifie les valeurs." };
  const v = parsed.data;
  const r = sweatRate(v);
  await db.sweatTest.create({
    data: { userId: user.id, day: dbDate(localToday(user.timezone)), ...v, fluidIntakeMl: Math.round(v.fluidIntakeMl), durationMin: Math.round(v.durationMin), sweatRateLph: r.sweatRateLph, bodyMassLossPct: r.bodyMassLossPct },
  });
  // Moyenne des tests récents → profil (utilisée par tous les calculs d'hydratation)
  const tests = await db.sweatTest.findMany({ where: { userId: user.id }, orderBy: { day: "desc" }, take: 5 });
  const valid = tests.filter((t) => t.sweatRateLph > 0);
  if (valid.length) {
    const avg = valid.reduce((a, t) => a + t.sweatRateLph, 0) / valid.length;
    await db.athleteProfile.update({ where: { userId: user.id }, data: { sweatRateLph: Math.round(avg * 100) / 100 } });
  }
  revalidatePath("/nutrition");
  return { result: r };
}
