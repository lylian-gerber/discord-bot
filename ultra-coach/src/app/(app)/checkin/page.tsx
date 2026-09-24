import { PageHeader } from "@/components/ui";
import { requireAthlete } from "@/lib/auth";
import { db } from "@/lib/db";
import { dbDate, localToday } from "@/lib/day";
import { CheckinForm } from "./CheckinForm";

export default async function CheckinPage() {
  const { user } = await requireAthlete();
  const day = localToday(user.timezone);
  const existing = await db.dailyCheckin.findUnique({ where: { userId_day: { userId: user.id, day: dbDate(day) } } });
  const defaults: Record<string, number | string> = existing
    ? {
        sleepQuality: existing.sleepQuality,
        sleepHours: existing.sleepHours,
        fatigue: existing.fatigue,
        legs: existing.legs,
        pain: existing.pain,
        painLocation: existing.painLocation ?? "",
        motivation: existing.motivation,
        stress: existing.stress,
        energy: existing.energy,
        soreness: existing.soreness,
        restingHr: existing.restingHr ?? "",
        hrvRmssd: existing.hrvRmssd ?? "",
        freeText: existing.freeText ?? "",
      }
    : {};
  return (
    <>
      <PageHeader title="Check-in" subtitle={existing ? "Modifier le check-in du jour" : "60 secondes"} />
      <CheckinForm defaults={defaults} />
    </>
  );
}
