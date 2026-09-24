/**
 * Entraînement digestif : progression des glucides/heure pendant l'effort.
 * Paliers 30 → 90 g/h. Au-delà de 60 g/h, mélange glucose:fructose
 * (~2:1 ou 1:0,8) nécessaire (transporteurs SGLT1 + GLUT5).
 */

export const CARB_LADDER = [30, 40, 50, 60, 70, 80, 90] as const;

export type GiSymptom = "nausea" | "bloating" | "hunger" | "cloying" | "cramps" | "diarrhea" | "vomiting";

export interface GutSessionLog {
  date: string;
  durationMin: number;
  targetCarbsPerHour: number;
  actualCarbsPerHour: number;
  /** Symptômes avec intensité 0-10 */
  symptoms: Partial<Record<GiSymptom, number>>;
  products: string[];
}

export interface GutState {
  currentStep: number; // g/h
  /** Produits associés à des symptômes ≥ 5 au moins 2 fois */
  productsToAvoid: string[];
  nextTarget: number;
  rationale: string;
}

/** Score GI 0-10 : la pire intensité, avec poids renforcé pour vomissement/diarrhée. */
export function giScore(symptoms: GutSessionLog["symptoms"]): number {
  let worst = 0;
  for (const [k, v] of Object.entries(symptoms)) {
    if (v === undefined || k === "hunger") continue; // la faim = sous-alimentation, pas intolérance
    const w = k === "vomiting" || k === "diarrhea" ? Math.min(10, v + 3) : v;
    worst = Math.max(worst, w);
  }
  return worst;
}

export function nextGutTarget(history: GutSessionLog[], startStep = 30): GutState {
  // Seules les sorties ≥ 75 min sont informatives
  const relevant = history.filter((h) => h.durationMin >= 75).sort((a, b) => a.date.localeCompare(b.date));

  // Produits à éviter
  const bad = new Map<string, number>();
  for (const h of relevant) {
    if (giScore(h.symptoms) >= 5) for (const p of h.products) bad.set(p, (bad.get(p) ?? 0) + 1);
  }
  const productsToAvoid = [...bad.entries()].filter(([, n]) => n >= 2).map(([p]) => p);

  let step = startStep;
  let okStreak = 0;
  let rationale = "Démarrage de la progression.";
  for (const h of relevant) {
    const s = giScore(h.symptoms);
    const reached = h.actualCarbsPerHour >= step * 0.9;
    if (s >= 6) {
      step = prevStep(step);
      okStreak = 0;
      rationale = `Symptômes marqués le ${h.date} : on redescend à ${step} g/h.`;
    } else if (s <= 3 && reached) {
      okStreak++;
      if (okStreak >= 2) {
        step = nextStep(step);
        okStreak = 0;
        rationale = `Deux sorties bien tolérées : on monte à ${step} g/h.`;
      } else {
        rationale = `Palier ${step} g/h toléré une fois : on le confirme.`;
      }
    } else {
      okStreak = 0;
      rationale = reached
        ? `Tolérance moyenne à ${step} g/h : on reste au palier.`
        : `Palier ${step} g/h non atteint : on le retente avant de monter.`;
    }
  }
  return { currentStep: step, productsToAvoid, nextTarget: step, rationale };
}

function nextStep(s: number): number {
  return CARB_LADDER.find((x) => x > s) ?? CARB_LADDER[CARB_LADDER.length - 1]!;
}
function prevStep(s: number): number {
  return [...CARB_LADDER].reverse().find((x) => x < s) ?? CARB_LADDER[0];
}
