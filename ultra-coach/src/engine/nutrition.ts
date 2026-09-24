/**
 * Besoins nutritionnels quotidiens périodisés selon la journée.
 *
 * Références : Burke et al. 2011 / Thomas, Erdman & Burke 2016 (ACSM/AND/DC)
 * pour les glucides en g/kg ; ISSN pour les protéines (1,6-2,0 g/kg) ;
 * Mifflin-St Jeor pour le métabolisme de base.
 *
 * Garde-fous : pas de déficit les jours durs, déficit plafonné,
 * énergie disponible (EA) surveillée pour prévenir le RED-S.
 */
import { clamp } from "./dates";

export type NutritionDayType =
  | "rest"
  | "light"
  | "moderate"
  | "hard"
  | "match_eve"
  | "match_day"
  | "long_run"
  | "very_long"
  | "carb_load";

export interface BodyProfile {
  weightKg: number;
  heightCm: number;
  age: number;
  sex: "male" | "female";
  bodyFatPct?: number;
  /** kg/semaine visé : négatif = perte. Plafonné à -0,5. */
  weightGoalKgPerWeek?: number;
}

export interface DayNutritionInput {
  dayType: NutritionDayType;
  /** Dépense des séances (kcal) — mesurée (Strava/montre) ou estimée. */
  exerciseKcal: number;
  /** Durée d'exercice planifiée, pour l'hydratation. */
  exerciseMin: number;
  sweatRateLph?: number;
  sweatSodiumMgPerL?: number;
}

export interface MacroTargets {
  kcal: number;
  carbsG: number;
  proteinG: number;
  fatG: number;
  waterMl: number;
  sodiumMg: number;
  energyAvailability?: number;
  warnings: string[];
}

/** g/kg/j de glucides par type de journée [min, max]. */
export const CARB_G_PER_KG: Record<NutritionDayType, [number, number]> = {
  rest: [3, 4],
  light: [4, 5],
  moderate: [5, 7],
  hard: [6, 8],
  match_eve: [6, 8],
  match_day: [6, 8],
  long_run: [7, 9],
  very_long: [8, 10],
  carb_load: [10, 12],
};

export function bmrMifflin(p: BodyProfile): number {
  const base = 10 * p.weightKg + 6.25 * p.heightCm - 5 * p.age;
  return base + (p.sex === "male" ? 5 : -161);
}

export function dailyTargets(p: BodyProfile, day: DayNutritionInput): MacroTargets {
  const warnings: string[] = [];
  const bmr = bmrMifflin(p);
  // NEAT modeste (étudiant/sédentaire hors sport) ; l'exercice est ajouté explicitement.
  const tdee = bmr * 1.35 + day.exerciseKcal;

  const heavy: NutritionDayType[] = ["hard", "match_eve", "match_day", "long_run", "very_long", "carb_load"];
  let goal = clamp(p.weightGoalKgPerWeek ?? 0, -0.5, 0.5);
  if (goal < 0 && heavy.includes(day.dayType)) {
    goal = 0;
    warnings.push("Pas de déficit calorique un jour de grosse charge ou de match.");
  }
  const adjustment = clamp((goal * 7700) / 7, -500, 400);
  let kcal = Math.round(tdee + adjustment);

  const [cMin, cMax] = CARB_G_PER_KG[day.dayType];
  const carbsG = Math.round(((cMin + cMax) / 2) * p.weightKg);
  const proteinG = Math.round((goal < 0 ? 2.0 : 1.8) * p.weightKg);
  const minFatG = Math.round(0.8 * p.weightKg);
  let fatG = Math.round((kcal - carbsG * 4 - proteinG * 4) / 9);
  if (fatG < minFatG) {
    fatG = minFatG;
    kcal = carbsG * 4 + proteinG * 4 + fatG * 9; // les glucides priment : on relève l'apport
  }

  // Énergie disponible = (apport - dépense exercice) / masse maigre
  let energyAvailability: number | undefined;
  if (p.bodyFatPct !== undefined) {
    const ffm = p.weightKg * (1 - p.bodyFatPct / 100);
    energyAvailability = Math.round((kcal - day.exerciseKcal) / ffm);
    if (energyAvailability < 30) {
      warnings.push("Énergie disponible basse (< 30 kcal/kg MM) : risque RED-S, augmente l'apport.");
    }
  }

  // Hydratation : base 35 ml/kg + remplacement ~80 % des pertes sudorales à l'effort
  const sweatRate = day.sweatRateLph ?? 0.8;
  const exerciseLoss = (sweatRate * 1000 * day.exerciseMin) / 60;
  const waterMl = Math.round((35 * p.weightKg + 0.8 * exerciseLoss) / 50) * 50;
  const sodiumMg = Math.round(2000 + (exerciseLoss / 1000) * (day.sweatSodiumMgPerL ?? 900));

  return { kcal, carbsG, proteinG, fatG, waterMl, sodiumMg, energyAvailability, warnings };
}

/** Répartition des glucides/protéines sur les prises de la journée. */
export type MealSlot =
  | "breakfast"
  | "lunch"
  | "snack"
  | "pre_workout"
  | "during_workout"
  | "post_workout"
  | "dinner"
  | "evening_snack";

export function distributeMeals(
  t: MacroTargets,
  slots: MealSlot[],
  duringWorkoutCarbsG = 0,
): Record<MealSlot, { carbsG: number; proteinG: number; fatG: number }> {
  const weights: Record<MealSlot, [number, number, number]> = {
    // [glucides, protéines, lipides]
    breakfast: [0.2, 0.2, 0.2],
    lunch: [0.25, 0.25, 0.3],
    snack: [0.08, 0.1, 0.1],
    pre_workout: [0.1, 0.05, 0.02],
    during_workout: [0, 0, 0],
    post_workout: [0.12, 0.15, 0.03],
    dinner: [0.22, 0.25, 0.3],
    evening_snack: [0.05, 0.1, 0.05],
  };
  const active = slots.filter((s) => s !== "during_workout");
  const sum = (i: 0 | 1 | 2) => active.reduce((a, s) => a + weights[s][i], 0);
  const [sc, sp, sf] = [sum(0), sum(1), sum(2)];
  const carbsRemaining = Math.max(t.carbsG - duringWorkoutCarbsG, 0);
  const out = {} as Record<MealSlot, { carbsG: number; proteinG: number; fatG: number }>;
  for (const s of slots) {
    if (s === "during_workout") {
      out[s] = { carbsG: duringWorkoutCarbsG, proteinG: 0, fatG: 0 };
      continue;
    }
    out[s] = {
      carbsG: Math.round((carbsRemaining * weights[s][0]) / sc),
      proteinG: Math.round((t.proteinG * weights[s][1]) / sp),
      fatG: Math.round((t.fatG * weights[s][2]) / sf),
    };
  }
  return out;
}
