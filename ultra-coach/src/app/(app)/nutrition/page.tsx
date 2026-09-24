import { distributeMeals, drinkPlan, type MealSlot } from "@/engine";
import { Bar, PageHeader } from "@/components/ui";
import { requireAthlete } from "@/lib/auth";
import { db } from "@/lib/db";
import { dbDate, localToday } from "@/lib/day";
import { nutritionFor } from "@/server/today";
import { addWater } from "./actions";
import { SweatTestForm } from "./SweatTestForm";

export const dynamic = "force-dynamic";

const SLOT_LABEL: Record<MealSlot, string> = {
  breakfast: "Petit-déjeuner",
  lunch: "Déjeuner",
  snack: "Collation",
  pre_workout: "Avant la séance",
  during_workout: "Pendant la séance",
  post_workout: "Après la séance",
  dinner: "Dîner",
  evening_snack: "Collation du soir",
};

export default async function NutritionPage() {
  const { user, profile } = await requireAthlete();
  const day = localToday(user.timezone);
  const [{ targets, label, dayType }, water, workouts] = await Promise.all([
    nutritionFor(profile, user.id, day),
    db.hydration.aggregate({ where: { userId: user.id, day: dbDate(day) }, _sum: { ml: true } }),
    db.workout.findMany({ where: { userId: user.id, day: dbDate(day), status: { not: "skipped" } } }),
  ]);
  const drank = water._sum.ml ?? 0;
  const session = workouts.filter((w) => w.sport !== "mobility").sort((a, b) => (b.durationMin ?? 0) - (a.durationMin ?? 0))[0];
  const training = Boolean(session);
  const fueling = session?.fueling as { carbsPerHour?: number } | null;
  const duringCarbs = session && fueling?.carbsPerHour ? Math.round((fueling.carbsPerHour * (session.durationMin ?? 0)) / 60) : 0;
  const slots: MealSlot[] = training
    ? ["breakfast", "lunch", "pre_workout", ...(duringCarbs ? (["during_workout"] as MealSlot[]) : []), "post_workout", "dinner"]
    : ["breakfast", "lunch", "snack", "dinner"];
  const meals = distributeMeals(targets, slots, duringCarbs);
  const plan = session && (session.durationMin ?? 0) >= 60 ? drinkPlan({ sweatRateLph: profile.sweatRateLph ?? 0.8, temperatureC: 18, durationMin: session.durationMin ?? 60 }) : null;

  return (
    <>
      <PageHeader title="Nutrition" subtitle={label} />

      <section className="card mb-3">
        <div className="flex items-end justify-between">
          <div>
            <p className="label">Énergie</p>
            <p className="num text-3xl font-bold">
              {targets.kcal}
              <span className="text-base font-normal text-muted"> kcal</span>
            </p>
          </div>
          <span className="chip">{dayType === "match_eve" ? "Charge glucidique" : label}</span>
        </div>
        <div className="num mt-4 grid grid-cols-3 gap-3 text-center">
          {[
            ["Glucides", targets.carbsG],
            ["Protéines", targets.proteinG],
            ["Lipides", targets.fatG],
          ].map(([l, v]) => (
            <div key={l} className="rounded-xl bg-surface-2 p-3">
              <p className="text-xl font-semibold">{v} g</p>
              <p className="text-xs text-faint">{l}</p>
            </div>
          ))}
        </div>
        {targets.warnings.map((w) => (
          <p key={w} className="mt-3 text-sm text-warn">
            {w}
          </p>
        ))}
      </section>

      <section className="card mb-3">
        <div className="flex items-end justify-between">
          <div>
            <p className="label">Hydratation</p>
            <p className="num text-2xl font-bold">
              {(drank / 1000).toFixed(2)}
              <span className="text-base font-normal text-muted"> / {(targets.waterMl / 1000).toFixed(1)} L</span>
            </p>
          </div>
          <p className="num text-xs text-faint">Sodium ~{targets.sodiumMg} mg</p>
        </div>
        <Bar value={drank} max={targets.waterMl} className="mt-3" />
        <div className="mt-3 grid grid-cols-3 gap-2">
          {[250, 500, 750].map((ml) => (
            <form key={ml} action={addWater}>
              <input type="hidden" name="ml" value={ml} />
              <button className="btn-ghost h-10 w-full text-sm">+{ml} ml</button>
            </form>
          ))}
        </div>
      </section>

      <section className="card mb-3">
        <p className="label mb-2">Répartition de la journée</p>
        <ul className="divide-y divide-line">
          {slots.map((s) => {
            const m = meals[s];
            return (
              <li key={s} className="flex items-center justify-between py-2.5">
                <span className="font-medium">{SLOT_LABEL[s]}</span>
                <span className="num text-sm text-muted">
                  G {m.carbsG} · P {m.proteinG} · L {m.fatG}
                </span>
              </li>
            );
          })}
        </ul>
        <p className="mt-2 text-xs text-faint">Quantités en grammes de macronutriments. Les idées de repas détaillées (options A/B/C) arrivent dans la prochaine version.</p>
      </section>

      {plan && (
        <section className="card mb-3">
          <p className="label">Boire pendant ta séance</p>
          <p className="num mt-1 text-lg font-semibold">
            {plan.mlPerHour} ml/h · {plan.sodiumMgPerHour} mg sodium/h
          </p>
          {plan.notes.map((n) => (
            <p key={n} className="mt-1 text-sm text-muted">
              {n}
            </p>
          ))}
          {!profile.sweatRateLph && <p className="mt-1 text-xs text-faint">Estimation par défaut (0,8 L/h) : fais un test de sudation pour personnaliser.</p>}
        </section>
      )}

      <details className="card">
        <summary className="cursor-pointer font-semibold">
          Test de sudation {profile.sweatRateLph ? <span className="font-normal text-muted">· actuel {profile.sweatRateLph} L/h</span> : null}
        </summary>
        <SweatTestForm />
      </details>
    </>
  );
}
