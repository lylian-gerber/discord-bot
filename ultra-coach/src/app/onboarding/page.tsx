import type { WeekDayPlan } from "@/engine";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { isoDay, weekdayName } from "@/lib/day";
import { DEFAULT_FOOTBALL_WEEK } from "@/server/plan";
import { OnboardingForm } from "./OnboardingForm";

export default async function OnboardingPage() {
  const user = await requireUser();
  const [profile, template, goal] = await Promise.all([
    db.athleteProfile.findUnique({ where: { userId: user.id } }),
    db.footballWeekTemplate.findFirst({ where: { userId: user.id, isDefault: true } }),
    db.goal.findFirst({ where: { userId: user.id, status: "active" }, include: { race: true } }),
  ]);
  const days = (template?.days as WeekDayPlan[] | undefined) ?? DEFAULT_FOOTBALL_WEEK;

  const d = (x: Date | null | undefined, fallback = "") => (x ? isoDay(x) : fallback);
  const defaults: Record<string, string> = {
    birthDate: d(profile?.birthDate),
    sex: profile?.sex ?? "male",
    heightCm: String(profile?.heightCm ?? ""),
    weightKg: String(profile?.weightKg ?? ""),
    targetWeightKg: String(profile?.targetWeightKg ?? ""),
    bodyFatPct: String(profile?.bodyFatPct ?? ""),
    maxHr: String(profile?.maxHr ?? ""),
    vma: String(profile?.vma ?? ""),
    usualWakeTime: profile?.usualWakeTime ?? "07:30",
    sleepNeedHours: String(profile?.sleepNeedHours ?? 8),
    footballLevel: profile?.footballLevel ?? "National 2",
    footballPosition: profile?.footballPosition ?? "",
    seasonEnd: d(profile?.seasonEnd, "2027-05-22"),
    winterBreakFrom: d(profile?.winterBreakFrom, "2026-12-19"),
    winterBreakTo: d(profile?.winterBreakTo, "2027-01-04"),
    raceName: goal?.race?.name ?? "Ultra-trail 100 km",
    raceType: goal?.type ?? "ultra_trail",
    distanceKm: String(goal?.distanceKm ?? 100),
    dPlusM: String(goal?.dPlusM ?? 4500),
    targetDate: d(goal?.targetDate, "2027-06-26"),
    targetTimeH: goal?.targetTimeMin ? String(goal.targetTimeMin / 60) : "",
    priority: goal?.priority ?? "A",
    currentLevel: goal?.currentLevel ?? "Débutant trail, bonne base football",
    weeklyRunHours: "1.5",
    longestRunMin: "75",
    mealsPerDay: String(profile?.mealsPerDay ?? 4),
    dietaryPattern: profile?.dietaryPattern ?? "omnivore",
    likedFoods: profile?.likedFoods.join(", ") ?? "",
    dislikedFoods: profile?.dislikedFoods.join(", ") ?? "",
    allergies: profile?.allergies.join(", ") ?? "",
  };
  days.forEach((x) => (defaults[`d${x.weekday}`] = x.football));

  return (
    <OnboardingForm
      defaults={defaults}
      weekdays={Array.from({ length: 7 }, (_, i) => weekdayName(i))}
      editing={Boolean(profile)}
      name={user.name ?? ""}
    />
  );
}
