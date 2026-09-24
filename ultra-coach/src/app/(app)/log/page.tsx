import { PageHeader } from "@/components/ui";
import { requireAthlete } from "@/lib/auth";
import { db } from "@/lib/db";
import { isoDay, localToday } from "@/lib/day";
import { LogForm } from "./LogForm";

export default async function LogPage({ searchParams }: { searchParams: Promise<{ workout?: string }> }) {
  const { user } = await requireAthlete();
  const { workout } = await searchParams;
  const today = localToday(user.timezone);
  const w = workout ? await db.workout.findFirst({ where: { id: workout, userId: user.id } }) : null;
  const sport = w ? (w.sport === "mobility" ? "mobility" : w.sport) : "trail";
  return (
    <>
      <PageHeader title={w ? w.title : "Ajouter une séance"} subtitle={w ? "Séance réalisée" : "Foot, match, trail, muscu…"} />
      <LogForm
        defaults={{
          workoutId: w?.id,
          sport,
          day: w && isoDay(w.day) <= today ? isoDay(w.day) : today,
          durationMin: w?.durationMin ?? undefined,
          isMatch: w?.sessionType === "match",
        }}
      />
    </>
  );
}
