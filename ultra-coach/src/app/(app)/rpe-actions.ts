"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { sessionLoad } from "@/engine";
import { requireAthlete } from "@/lib/auth";
import { db } from "@/lib/db";

/** Confirme le RPE d'une activité importée (recalcule sa charge). */
export async function confirmRpe(form: FormData) {
  const { user } = await requireAthlete();
  const id = z.string().parse(form.get("activityId"));
  const rpe = z.coerce.number().int().min(1).max(10).parse(form.get("rpe"));
  const a = await db.activity.findFirst({ where: { id, userId: user.id } });
  if (!a) return;
  await db.activity.update({
    where: { id },
    data: { rpe, rpeEstimated: false, trainingLoad: sessionLoad({ durationMin: Math.round(a.durationS / 60), rpe }) },
  });
  revalidatePath("/");
  revalidatePath(`/activity/${id}`);
}
