/**
 * Hydratation : taux de sudation et plan de boisson à l'effort.
 *
 * Taux de sudation (L/h) = (poids avant - poids après + boissons - urine) / durée
 * Recommandation : remplacer ~60-80 % des pertes, JAMAIS plus que le taux
 * de sudation (risque d'hyponatrémie), plafond 1 L/h.
 */
import { clamp } from "./dates";

export interface SweatTestInput {
  weightBeforeKg: number;
  weightAfterKg: number;
  fluidIntakeMl: number;
  urineMl?: number;
  durationMin: number;
  temperatureC?: number;
}

export interface SweatTestResult {
  sweatRateLph: number;
  bodyMassLossPct: number;
  warnings: string[];
}

export function sweatRate(i: SweatTestInput): SweatTestResult {
  if (i.durationMin <= 0) throw new RangeError("durée > 0 requise");
  const lossKg = i.weightBeforeKg - i.weightAfterKg;
  const sweatL = lossKg + i.fluidIntakeMl / 1000 - (i.urineMl ?? 0) / 1000;
  const sweatRateLph = Math.round((sweatL / (i.durationMin / 60)) * 100) / 100;
  const bodyMassLossPct = Math.round((lossKg / i.weightBeforeKg) * 1000) / 10;
  const warnings: string[] = [];
  if (lossKg < 0) {
    warnings.push("Tu as pris du poids pendant l'effort : tu bois trop. Risque d'hyponatrémie, bois selon la soif et le plan.");
  } else if (bodyMassLossPct > 3) {
    warnings.push(`Perte de ${bodyMassLossPct} % du poids : déshydratation notable, augmente l'apport à l'effort.`);
  } else if (bodyMassLossPct > 2) {
    warnings.push(`Perte de ${bodyMassLossPct} % : limite haute, performance probablement affectée.`);
  }
  return { sweatRateLph, bodyMassLossPct, warnings };
}

export interface DrinkPlanInput {
  sweatRateLph: number;
  temperatureC: number;
  humidityPct?: number;
  /** Concentration sodique de la sueur si connue (mg/L), sinon 900 par défaut. */
  sweatSodiumMgPerL?: number;
  durationMin: number;
}

export interface DrinkPlan {
  mlPerHour: number;
  sodiumMgPerHour: number;
  totalMl: number;
  notes: string[];
}

/** Correction du taux de sudation mesuré selon la chaleur du jour (heuristique ~+8 %/°C au-dessus de 20 °C). */
export function heatAdjustedSweatRate(baseLph: number, temperatureC: number, humidityPct = 50): number {
  const heat = 1 + Math.max(temperatureC - 20, 0) * 0.08 + Math.max(humidityPct - 60, 0) * 0.005;
  const cold = temperatureC < 10 ? 0.8 : 1;
  return Math.round(baseLph * heat * cold * 100) / 100;
}

export function drinkPlan(i: DrinkPlanInput): DrinkPlan {
  const notes: string[] = [];
  const adjusted = heatAdjustedSweatRate(i.sweatRateLph, i.temperatureC, i.humidityPct);
  const replacement = i.durationMin > 150 ? 0.75 : 0.65;
  const mlPerHour = Math.round(clamp(adjusted * 1000 * replacement, 300, Math.min(1000, adjusted * 1000)) / 50) * 50;
  const sodiumConc = i.sweatSodiumMgPerL ?? 900;
  // Sodium : on remplace ~50-70 % des pertes pour les efforts > 2 h, sinon minimal
  const sodiumMgPerHour =
    i.durationMin >= 120 ? Math.round((adjusted * sodiumConc * 0.6) / 50) * 50 : Math.round((adjusted * sodiumConc * 0.3) / 50) * 50;
  if (i.durationMin < 60) notes.push("Séance < 1 h : boire selon la soif suffit.");
  if (i.temperatureC >= 28) notes.push("Chaleur : ralentis l'effort (allure + lente de 5-10 %), pars plus tôt, mouille nuque/avant-bras.");
  if (i.durationMin >= 240) notes.push("Effort > 4 h : alterne eau et boisson électrolytée, surveille les signes d'hyponatrémie (nausées, maux de tête, gonflement).");
  return { mlPerHour, sodiumMgPerHour, totalMl: Math.round((mlPerHour * i.durationMin) / 60), notes };
}
