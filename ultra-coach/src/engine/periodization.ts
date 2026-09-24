/**
 * Macrocycle : de aujourd'hui à la course, découpé en phases.
 *
 * Les 10 étapes du cahier des charges sont regroupées en 6 phases
 * (certaines étapes — nutrition longue distance, simulations — sont des
 * fils continus qui démarrent à une phase donnée, pas des blocs isolés).
 *
 * Le volume trail dépend du CONTEXTE football de la semaine :
 *   in_season  → plafond bas (le foot consomme déjà 5-7 h/sem)
 *   break      → trêve : fenêtre pour un bloc trail
 *   off_season → fin de saison : fenêtre pour le pic de volume
 * Progression : +10 %/sem max sur les semaines chargées, 1 semaine
 * allégée (70 %) toutes les 4.
 */
import type { ISODate } from "./types";
import { addDays, daysBetween, mondayOf, toUTC } from "./dates";

export type Phase = "base" | "endurance" | "trail" | "specific" | "peak" | "taper";
export type FootballContext = "in_season" | "break" | "off_season";

export const PHASE_LABELS: Record<Phase, string> = {
  base: "Base aérobie",
  endurance: "Développement endurance",
  trail: "Développement trail & côtes",
  specific: "Temps sur les jambes & dénivelé",
  peak: "Sorties longues, back-to-back & simulations",
  taper: "Affûtage",
};

export interface MacroInput {
  start: ISODate;
  raceDate: ISODate;
  raceDistanceKm: number;
  raceDplusM: number;
  currentWeeklyRunHours: number;
  currentLongestRunMin: number;
  /** Dernier match officiel de la saison. */
  seasonEnd?: ISODate;
  /** Trêves (ex. hivernale). */
  breaks?: { from: ISODate; to: ISODate }[];
  /** Plafond d'heures de course en saison. Défaut 4,5 h. */
  inSeasonRunHoursCap?: number;
}

export interface PlannedWeek {
  index: number;
  monday: ISODate;
  phase: Phase;
  phaseWeek: number;
  phaseWeeks: number;
  isDeload: boolean;
  context: FootballContext;
  runHours: number;
  longRunMin: number;
  dPlusM: number;
  backToBack: boolean;
  gutTraining: boolean;
  raceSimulation: boolean;
  focus: string[];
}

const SHARES: [Phase, number][] = [
  ["base", 0.25],
  ["endurance", 0.2],
  ["trail", 0.2],
  ["specific", 0.2],
  ["peak", 0.15],
];

const PHASE_VOLUME: Record<Phase, number> = {
  base: 0.45,
  endurance: 0.6,
  trail: 0.72,
  specific: 0.85,
  peak: 1,
  taper: 0.5,
};

const FOCUS: Record<Phase, string[]> = {
  base: ["endurance fondamentale", "renforcement pieds/chevilles/mollets", "force jambes"],
  endurance: ["sorties longues progressives", "tempo", "force jambes"],
  trail: ["côtes", "technique descente", "marche rapide en pente", "entraînement digestif"],
  specific: ["temps sur les jambes", "dénivelé", "seuil", "nutrition longue durée"],
  peak: ["back-to-back", "simulations course (matériel + nutrition)", "finish fast"],
  taper: ["réduction volume", "maintien intensité", "sommeil", "stratégie course"],
};

export function footballContext(monday: ISODate, input: MacroInput): FootballContext {
  const mid = addDays(monday, 3);
  if (input.seasonEnd && toUTC(mid) > toUTC(input.seasonEnd)) return "off_season";
  for (const b of input.breaks ?? []) {
    if (toUTC(mid) >= toUTC(b.from) && toUTC(mid) <= toUTC(b.to)) return "break";
  }
  return "in_season";
}

export function buildMacrocycle(input: MacroInput): PlannedWeek[] {
  const firstMonday = mondayOf(input.start);
  const raceMonday = mondayOf(input.raceDate);
  const totalWeeks = Math.floor(daysBetween(firstMonday, raceMonday) / 7) + 1;
  if (totalWeeks < 8) throw new RangeError("Moins de 8 semaines : un plan ultra structuré n'est pas raisonnable.");

  const taperWeeks = input.raceDistanceKm >= 150 ? 3 : 2;
  const buildWeeks = totalWeeks - taperWeeks;

  // Répartition des phases (arrondi, le reste va à la base)
  const phaseLengths = SHARES.map(([p, s]) => [p, Math.max(2, Math.round(buildWeeks * s))] as [Phase, number]);
  const diff = buildWeeks - phaseLengths.reduce((a, [, n]) => a + n, 0);
  phaseLengths[0]![1] += diff;
  phaseLengths.push(["taper", taperWeeks]);

  const peakHours = 4 + input.raceDistanceKm / 25; // 100 km → 8 h de course/sem au pic hors saison
  const inSeasonCap = input.inSeasonRunHoursCap ?? 4.5;
  const peakLong = Math.min(390, 60 + input.raceDistanceKm * 3); // 100 km → 6 h
  const peakDplus = input.raceDplusM * 0.7;

  const weeks: PlannedWeek[] = [];
  let prevLoadedHours = input.currentWeeklyRunHours;
  let prevLong = input.currentLongestRunMin;
  let maxLoadedHours = input.currentWeeklyRunHours;
  let maxLong = input.currentLongestRunMin;
  let idx = 0;

  for (const [phase, n] of phaseLengths) {
    for (let w = 1; w <= n; w++, idx++) {
      const monday = addDays(firstMonday, idx * 7);
      const context = footballContext(monday, input);
      const isDeload = phase !== "taper" && idx > 0 && (idx + 1) % 4 === 0;

      let hours = peakHours * PHASE_VOLUME[phase];
      let long = peakLong * PHASE_VOLUME[phase];
      if (phase === "taper") {
        // L'affûtage part du volume réellement atteint, pas du pic théorique.
        const f = [0.75, 0.6, 0.4].slice(-n)[w - 1] ?? 0.5;
        hours = maxLoadedHours * f;
        long = maxLong * f * 0.7;
      }
      const cap = context === "in_season" ? inSeasonCap : context === "break" ? peakHours * 0.9 : peakHours;
      hours = Math.min(hours, cap);
      if (context === "in_season") long = Math.min(long, 150);

      if (phase !== "taper") {
        hours = Math.min(hours, prevLoadedHours * 1.1 + 0.25); // rampe douce (+0,25 h pour décoller d'un volume faible)
        long = Math.min(long, prevLong + 20);
      }
      if (isDeload) {
        hours *= 0.7;
        long *= 0.7;
      } else if (phase !== "taper") {
        prevLoadedHours = hours;
        prevLong = Math.max(prevLong, long);
        maxLoadedHours = Math.max(maxLoadedHours, hours);
        maxLong = Math.max(maxLong, long);
      }

      const dPlusM = Math.round((peakDplus * (hours / peakHours)) / 50) * 50;
      const late = phase === "specific" || phase === "peak";
      weeks.push({
        index: idx,
        monday,
        phase,
        phaseWeek: w,
        phaseWeeks: n,
        isDeload,
        context,
        runHours: Math.round(hours * 4) / 4,
        longRunMin: Math.round(long / 5) * 5,
        dPlusM,
        backToBack: phase === "peak" && context !== "in_season" && !isDeload,
        gutTraining: phase !== "base" && phase !== "endurance",
        raceSimulation: late && context !== "in_season" && !isDeload && w % 2 === 0,
        focus: FOCUS[phase],
      });
    }
  }
  return weeks;
}

/**
 * Alertes de faisabilité — dites franchement à l'utilisateur, pas cachées.
 */
export function macroWarnings(plan: PlannedWeek[], input: MacroInput): string[] {
  const out: string[] = [];
  const loadedOff = plan.filter((w) => w.phase !== "taper" && !w.isDeload && w.context === "off_season").length;
  if (loadedOff < 4) {
    out.push(
      `Seulement ${loadedOff} semaine(s) chargée(s) hors saison avant l'affûtage : le pic de volume sera court. Utilise la trêve à fond et envisage une course plus tardive si l'objectif est la performance plutôt que le finish.`,
    );
  }
  const maxLong = Math.max(...plan.map((w) => w.longRunMin));
  // km-effort (distance + D+/100) à ~8,5 km-effort/h : ordre de grandeur pour un premier ultra
  const expectedRaceHours = (input.raceDistanceKm + input.raceDplusM / 100) / 8.5;
  if (maxLong / 60 < expectedRaceHours * 0.35) {
    out.push(
      `Sortie la plus longue prévue ${Math.round(maxLong / 6) / 10} h pour une course estimée ~${Math.round(expectedRaceHours)} h : objectif réaliste = finir, pas chrono.`,
    );
  }
  return out;
}

export function currentWeek(plan: PlannedWeek[], today: ISODate): PlannedWeek | undefined {
  const m = mondayOf(today);
  return plan.find((w) => w.monday === m);
}

/** "Phase actuelle : Base / Semaine 2 sur 8." */
export function phaseLabel(w: PlannedWeek): string {
  return `Phase actuelle : ${PHASE_LABELS[w.phase]} / Semaine ${w.phaseWeek} sur ${w.phaseWeeks}`;
}
