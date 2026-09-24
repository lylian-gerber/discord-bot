/**
 * Readiness score /100 — heuristique transparente, pas une mesure physiologique.
 *
 * Convention des échelles du check-in (toutes 0-10) :
 *   10 = meilleur : sleepQuality, legs, motivation, energy
 *   10 = pire     : fatigue, pain, stress, soreness
 *
 * Les marqueurs objectifs (FC repos, HRV) sont comparés à la baseline
 * personnelle (moyenne ± écart-type sur 28 j), jamais à des normes génériques.
 */
import { clamp } from "./dates";
import type { LoadSummary } from "./load";

export interface DailyCheckinInput {
  sleepQuality: number;
  sleepHours: number;
  fatigue: number;
  legs: number;
  pain: number;
  motivation: number;
  stress: number;
  energy: number;
  soreness: number;
  restingHr?: number;
  /** RMSSD en ms */
  hrvRmssd?: number;
}

export interface Baselines {
  restingHrMean?: number;
  restingHrSd?: number;
  /** moyenne / écart-type de ln(RMSSD) */
  lnRmssdMean?: number;
  lnRmssdSd?: number;
  sleepNeedHours: number;
}

export interface ReadinessContext {
  load?: LoadSummary;
  hoursSinceMatch?: number;
  minutesPlayedLastMatch?: number;
  sleepDebtHours?: number;
}

export type ReadinessTier = "green" | "normal" | "adapt" | "easy" | "rest";

export interface ReadinessResult {
  total: number;
  recovery: number;
  legs: number;
  cardio: number;
  sleep: number;
  mind: number;
  tier: ReadinessTier;
  flags: string[];
  recommendation: string;
  /** vrai si la douleur doit bloquer la course — décision non négociable par le LLM */
  blockRunning: boolean;
}

const inv = (x: number) => 10 - x;
const pct = (x: number) => clamp(x, 0, 10) * 10;

/** z-score → score 0-100 (z = 0 → 75, chaque σ défavorable retire 15 pts). */
function zToScore(zUnfavourable: number): number {
  return clamp(75 - zUnfavourable * 15, 0, 100);
}

export function computeReadiness(
  c: DailyCheckinInput,
  b: Baselines,
  ctx: ReadinessContext = {},
): ReadinessResult {
  const flags: string[] = [];

  // --- Sommeil
  const durationRatio = clamp(c.sleepHours / b.sleepNeedHours, 0, 1.1);
  let sleep = 0.5 * pct(c.sleepQuality) + 0.5 * clamp(durationRatio * 100, 0, 100);
  if ((ctx.sleepDebtHours ?? 0) > 3) {
    sleep -= 10;
    flags.push(`Dette de sommeil ~${ctx.sleepDebtHours!.toFixed(1)} h`);
  }
  if (c.sleepHours < 6.5) flags.push(`Nuit courte (${formatH(c.sleepHours)})`);

  // --- Cardio / système nerveux autonome
  const cardioParts: number[] = [];
  if (c.restingHr !== undefined && b.restingHrMean !== undefined && b.restingHrSd) {
    const z = (c.restingHr - b.restingHrMean) / b.restingHrSd; // FC haute = défavorable
    cardioParts.push(zToScore(z));
    if (z > 1.5) flags.push(`FC repos +${Math.round(c.restingHr - b.restingHrMean)} bpm vs ta normale`);
  }
  if (c.hrvRmssd !== undefined && c.hrvRmssd > 0 && b.lnRmssdMean !== undefined && b.lnRmssdSd) {
    const z = (b.lnRmssdMean - Math.log(c.hrvRmssd)) / b.lnRmssdSd; // HRV basse = défavorable
    cardioParts.push(zToScore(z));
    if (z > 1.5) flags.push("HRV nettement sous ta baseline");
  }
  const cardio = cardioParts.length
    ? cardioParts.reduce((a, x) => a + x, 0) / cardioParts.length
    : 0.5 * pct(c.energy) + 0.5 * pct(inv(c.fatigue));

  // --- Jambes
  let legs = 0.5 * pct(c.legs) + 0.3 * pct(inv(c.soreness)) + 0.2 * pct(inv(c.pain));
  if (ctx.hoursSinceMatch !== undefined && ctx.hoursSinceMatch < 48) {
    const minutes = ctx.minutesPlayedLastMatch ?? 90;
    legs -= (minutes / 90) * (ctx.hoursSinceMatch < 24 ? 20 : 10);
    flags.push(`Match il y a ${Math.round(ctx.hoursSinceMatch)} h`);
  }

  // --- Récupération globale
  let recovery = 0.4 * pct(inv(c.fatigue)) + 0.3 * pct(c.energy) + 0.3 * cardio;
  if (ctx.load?.status === "danger") {
    recovery -= 15;
    flags.push("Charge aiguë très au-dessus de la chronique");
  } else if (ctx.load?.status === "caution") {
    recovery -= 7;
  }

  // --- Mental
  const mind = 0.5 * pct(c.motivation) + 0.5 * pct(inv(c.stress));

  const s = {
    recovery: clamp(Math.round(recovery), 0, 100),
    legs: clamp(Math.round(legs), 0, 100),
    cardio: clamp(Math.round(cardio), 0, 100),
    sleep: clamp(Math.round(sleep), 0, 100),
    mind: clamp(Math.round(mind), 0, 100),
  };
  let total = Math.round(0.3 * s.recovery + 0.25 * s.legs + 0.15 * s.cardio + 0.2 * s.sleep + 0.1 * s.mind);

  // --- Garde-fous douleur (priment sur le score)
  let blockRunning = false;
  if (c.pain >= 7) {
    blockRunning = true;
    total = Math.min(total, 30);
    flags.push("Douleur importante : pas de course, avis d'un professionnel de santé recommandé");
  } else if (c.pain >= 5) {
    total = Math.min(total, 55);
    flags.push("Douleur modérée : séance sans impact ou adaptée");
  }

  const tier: ReadinessTier =
    blockRunning || total < 35 ? "rest" : total < 50 ? "easy" : total < 65 ? "adapt" : total < 80 ? "normal" : "green";

  return { total, ...s, tier, flags, recommendation: recommend(tier, s, blockRunning), blockRunning };
}

function recommend(
  tier: ReadinessTier,
  s: { legs: number; cardio: number },
  blockRunning: boolean,
): string {
  if (blockRunning) {
    return "Pas de course aujourd'hui. Repos ou activité sans douleur ; consulte un professionnel si la douleur persiste.";
  }
  switch (tier) {
    case "rest":
      return "Repos ou récupération active très légère (marche, mobilité).";
    case "easy":
      return "Séance facile uniquement, courte, en endurance fondamentale.";
    case "adapt":
      return s.legs < s.cardio - 15
        ? "Cardio OK mais jambes entamées : garde l'intensité, réduis le dénivelé négatif et l'excentrique."
        : "Séance prévue possible mais réduite d'environ 20 %.";
    case "normal":
      return s.legs < 65
        ? "S'entraîner normalement mais éviter une grosse séance excentrique."
        : "S'entraîner normalement.";
    case "green":
      return "Feu vert : bonne journée pour la séance clé.";
  }
}

function formatH(h: number): string {
  const hh = Math.floor(h);
  return `${hh}h${String(Math.round((h - hh) * 60)).padStart(2, "0")}`;
}

/** Baselines à partir de l'historique (≥ 7 valeurs requises, idéalement 28). */
export function computeBaselines(
  history: { restingHr?: number; hrvRmssd?: number }[],
  sleepNeedHours = 8,
): Baselines {
  const rhr = history.map((h) => h.restingHr).filter((x): x is number => x !== undefined);
  const ln = history
    .map((h) => h.hrvRmssd)
    .filter((x): x is number => x !== undefined && x > 0)
    .map(Math.log);
  const stat = (xs: number[]) => {
    if (xs.length < 7) return undefined;
    const m = xs.reduce((a, b) => a + b, 0) / xs.length;
    const sd = Math.sqrt(xs.reduce((a, x) => a + (x - m) ** 2, 0) / (xs.length - 1));
    return { m, sd: Math.max(sd, 1e-6) };
  };
  const r = stat(rhr);
  const h = stat(ln);
  return {
    sleepNeedHours,
    restingHrMean: r?.m,
    restingHrSd: r?.sd,
    lnRmssdMean: h?.m,
    lnRmssdSd: h?.sd,
  };
}
