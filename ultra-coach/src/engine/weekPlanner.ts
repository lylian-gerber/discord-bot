/**
 * Placement des séances dans la semaine autour du football.
 *
 * Les règles raisonnent en jours relatifs au match (MD-n / MD+n),
 * pas en jours de la semaine : si le match passe au dimanche, tout suit.
 *
 *   MD      : match, rien d'autre
 *   MD-1    : activation uniquement
 *   MD-2    : qualité courte possible (≤ 75 min), peu de descente, pas de muscu lourde
 *   MD+1    : récupération (sauf si < 45 min jouées)
 *   ≥ MD+2 et ≤ MD-3 : fenêtre pour la sortie longue et la muscu lourde
 */
import type { PlannedWeek } from "./periodization";
import type { ReadinessResult } from "./readiness";
import type { WeekDayPlan } from "./types";

export type TrailSessionType =
  | "easy"
  | "hilly"
  | "tempo"
  | "threshold"
  | "progressive"
  | "long"
  | "hike_run"
  | "hill_repeats"
  | "downhill"
  | "power_hike"
  | "back_to_back"
  | "finish_fast"
  | "recovery"
  | "strength_heavy"
  | "strength_light";

export interface PlannedSession {
  type: TrailSessionType;
  durationMin: number;
  dPlusM?: number;
  maxDescentM?: number;
  note?: string;
  doubleDay?: boolean;
}

export interface PlannedDay {
  weekday: number;
  football: WeekDayPlan["football"];
  daysToMatch: number | null;
  daysSinceMatch: number | null;
  sessions: PlannedSession[];
}

export interface WeekPlanOptions {
  lastMatchMinutes?: number;
  /** Jours où rien ne doit être ajouté : jours passés ou séance déjà réalisée. */
  blockedWeekdays?: number[];
  /** Minutes de course/trail déjà réalisées cette semaine (déduites du volume). */
  doneRunMin?: number;
  /** Une sortie longue a déjà été faite cette semaine. */
  longRunDone?: boolean;
}

const QUALITY_BY_PHASE: Record<PlannedWeek["phase"], TrailSessionType[]> = {
  base: ["progressive", "easy"],
  endurance: ["tempo", "progressive"],
  trail: ["hill_repeats", "power_hike", "downhill"],
  specific: ["threshold", "hilly", "finish_fast"],
  peak: ["finish_fast", "threshold"],
  taper: ["tempo"],
};

export function planWeek(days: WeekDayPlan[], week: PlannedWeek, opts: WeekPlanOptions = {}): PlannedDay[] {
  const matchDays = days.filter((d) => d.football === "match").map((d) => d.weekday);
  const rel = (wd: number) => {
    if (!matchDays.length) return { dtm: null, dsm: null };
    // on considère le match de la semaine précédente / suivante au même jour
    const all = matchDays.flatMap((m) => [m - 7, m, m + 7]);
    const next = all.filter((m) => m >= wd).sort((a, b) => a - b)[0];
    const prev = all.filter((m) => m < wd).sort((a, b) => b - a)[0];
    return { dtm: next === undefined ? null : next - wd, dsm: prev === undefined ? null : wd - prev };
  };

  const out: PlannedDay[] = days
    .slice()
    .sort((a, b) => a.weekday - b.weekday)
    .map((d) => {
      const { dtm, dsm } = rel(d.weekday);
      return { weekday: d.weekday, football: d.football, daysToMatch: dtm, daysSinceMatch: dsm, sessions: [] };
    });

  const blocked = new Set(opts.blockedWeekdays ?? []);
  const noMatch = matchDays.length === 0;
  const lowMinutes = (opts.lastMatchMinutes ?? 90) < 45;
  const isFree = (d: PlannedDay) => d.football === "none";
  // Un jour bloqué est traité comme indisponible pour toute séance ajoutée.
  const isMatch = (d: PlannedDay) => d.football === "match" || blocked.has(d.weekday);

  // 1) Sortie longue
  const longScore = (d: PlannedDay): number => {
    if (isMatch(d)) return -Infinity;
    if (noMatch) return isFree(d) ? (d.weekday >= 5 ? 5 : 2) : -Infinity;
    if (d.daysToMatch !== null && d.daysToMatch < 3) return -Infinity;
    if (d.daysSinceMatch === 1 && !lowMinutes) return -Infinity;
    let s = 0;
    s += d.football === "none" ? 3 : d.football === "light" ? 1 : -3;
    s += (d.daysSinceMatch ?? 7) >= 2 ? 2 : 0;
    s += (d.daysToMatch ?? 7) >= 4 ? 1 : 0;
    return s;
  };
  const longDay = [...out].sort((a, b) => longScore(b) - longScore(a))[0];
  let longPlaced: PlannedDay | undefined;
  if (!opts.longRunDone && longDay && longScore(longDay) > -Infinity && longScore(longDay) >= -1) {
    longPlaced = longDay;
    longDay.sessions.push({
      type: week.phase === "trail" || week.phase === "specific" || week.phase === "peak" ? "hike_run" : "long",
      durationMin: week.longRunMin,
      dPlusM: Math.round(week.dPlusM * 0.4),
      doubleDay: longDay.football !== "none",
      note: longDay.football !== "none" ? "Double journée : sortie longue le matin, football léger le soir." : undefined,
    });
    if (week.backToBack) {
      const next = out.find((d) => d.weekday === longDay.weekday + 1);
      if (next && !isMatch(next) && (next.daysToMatch ?? 7) >= 2) {
        next.sessions.push({ type: "back_to_back", durationMin: Math.round(week.longRunMin * 0.6), dPlusM: Math.round(week.dPlusM * 0.2) });
      }
    }
  }

  // 2) Séance qualité (préférence : jour sans foot à MD-2 ou mieux)
  const qualityType = QUALITY_BY_PHASE[week.phase][week.index % QUALITY_BY_PHASE[week.phase].length]!;
  const qualityCandidates = out.filter(
    (d) => d !== longPlaced && !isMatch(d) && d.sessions.length === 0 && (noMatch || (d.daysToMatch ?? 7) >= 2) && (d.daysSinceMatch ?? 7) >= 2,
  );
  const qualityDay =
    qualityCandidates.find((d) => isFree(d)) ?? qualityCandidates.find((d) => d.football === "light");
  if (qualityDay && !week.isDeload) {
    const md2 = qualityDay.daysToMatch === 2;
    qualityDay.sessions.push({
      type: qualityType,
      durationMin: round5(md2 ? Math.min(75, 45 + week.runHours * 5) : 60 + week.runHours * 5),
      maxDescentM: md2 ? 150 : undefined,
      doubleDay: qualityDay.football !== "none",
      note: md2 ? "MD-2 : intensité OK, mais limite la descente pour préserver les jambes du match." : undefined,
    });
  }

  // 3) Renforcement : lourd loin du match, léger (pieds/chevilles/gainage) ailleurs
  const heavy = out.find(
    (d) => !isMatch(d) && (noMatch || ((d.daysToMatch ?? 7) >= 4 && (d.daysSinceMatch ?? 7) >= 2)) && d !== longPlaced,
  );
  if (heavy && week.phase !== "taper") heavy.sessions.push({ type: "strength_heavy", durationMin: 40 });
  const light = out.find((d) => !isMatch(d) && d !== heavy && (d.daysToMatch ?? 7) >= 2 && d.sessions.every((s) => s.type !== "strength_heavy"));
  if (light) light.sessions.push({ type: "strength_light", durationMin: 20, note: "Pieds, chevilles, soléaire, gainage." });

  // 4) Récupération MD+1
  for (const d of out) if (d.daysSinceMatch === 1 && d.sessions.length === 0 && !isMatch(d) && d.football !== "match") {
    d.sessions.push({ type: "recovery", durationMin: 30, note: "Marche, vélo très facile ou mobilité." });
  }

  // 5) Compléter le volume par des footings faciles
  const planned = () =>
    out.flatMap((d) => d.sessions).filter((s) => !s.type.startsWith("strength") && s.type !== "recovery").reduce((a, s) => a + s.durationMin, 0);
  const easyDays = out.filter(
    (d) => !isMatch(d) && d.sessions.every((s) => s.type.startsWith("strength")) && (d.football === "none" || d.football === "light") && (noMatch || (d.daysToMatch ?? 7) >= 2) && (d.daysSinceMatch ?? 7) >= 2,
  );
  for (const d of easyDays) {
    const remaining = week.runHours * 60 - (opts.doneRunMin ?? 0) - planned();
    if (remaining < 25) break;
    d.sessions.push({ type: "easy", durationMin: Math.min(60, Math.round(remaining / 5) * 5), doubleDay: d.football !== "none" });
  }
  return out;
}

/** Adapte une séance planifiée au readiness du jour. Le LLM explique, cette fonction décide. */
export function adaptSession(s: PlannedSession, r: ReadinessResult): PlannedSession | null {
  if (r.blockRunning) {
    return s.type.startsWith("strength") ? null : { type: "recovery", durationMin: 20, note: "Douleur : pas de course. Mobilité douce si indolore." };
  }
  switch (r.tier) {
    case "rest":
      return { type: "recovery", durationMin: 20, note: "Récupération : marche / mobilité." };
    case "easy":
      return s.type === "strength_heavy"
        ? { type: "strength_light", durationMin: 15 }
        : { type: "easy", durationMin: Math.round(s.durationMin * 0.6), note: "Allégé : endurance fondamentale uniquement." };
    case "adapt":
      return { ...s, durationMin: Math.round(s.durationMin * 0.8), maxDescentM: r.legs < r.cardio - 15 ? 100 : s.maxDescentM };
    default:
      return s;
  }
}

const round5 = (x: number) => Math.round(x / 5) * 5;
