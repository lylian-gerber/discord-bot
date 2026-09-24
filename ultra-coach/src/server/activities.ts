import "server-only";
import type { Sport } from "@prisma/client";
import { db } from "@/lib/db";
import { dbDate } from "@/lib/day";

/** Rattache une activité réalisée à la séance planifiée correspondante du même jour. */
export async function linkPlannedWorkout(userId: string, activityId: string, sport: Sport, day: string, workoutId?: string) {
  const planned = workoutId
    ? await db.workout.findFirst({ where: { id: workoutId, userId, activityId: null } })
    : await db.workout.findFirst({
        where: {
          userId,
          day: dbDate(day),
          activityId: null,
          status: { in: ["planned", "adapted"] },
          sport: sport === "football" ? "football" : sport === "strength" ? "strength" : { in: ["trail", "mobility"] },
        },
        orderBy: { durationMin: "desc" },
      });
  if (!planned) return null;
  return db.workout.update({ where: { id: planned.id }, data: { activityId, status: "done" } });
}
