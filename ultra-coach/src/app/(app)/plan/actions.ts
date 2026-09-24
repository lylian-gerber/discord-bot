"use server";

import type { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { WeekDayPlan } from "@/engine";
import { requireAthlete } from "@/lib/auth";
import { db } from "@/lib/db";
import { localToday } from "@/lib/day";
import { activePlan, generateWeekWorkouts } from "@/server/plan";

const FOOT = z.enum(["none", "light", "moderate", "hard", "match"]);

/** Modifie les jours de football d'une semaine précise et régénère ses séances non réalisées. */
export async function updateWeekFootball(form: FormData) {
  const { user, profile } = await requireAthlete();
  const weekId = String(form.get("weekId"));
  const plan = await activePlan(user.id);
  const week = await db.trainingWeek.findFirst({ where: { id: weekId, planId: plan?.id ?? "" } });
  if (!week) return;
  const days: WeekDayPlan[] = Array.from({ length: 7 }, (_, weekday) => ({ weekday, football: FOOT.parse(form.get(`d${weekday}`)) }));
  const updated = await db.trainingWeek.update({
    where: { id: week.id },
    data: { footballDays: days as unknown as Prisma.InputJsonValue, workoutsGeneratedAt: null },
  });
  await generateWeekWorkouts(user.id, updated, profile, localToday(user.timezone));
  revalidatePath("/plan");
  revalidatePath("/");
}
