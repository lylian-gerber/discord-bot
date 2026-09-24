/**
 * Charge d'entraînement — méthode sRPE (Foster 2001) : durée (min) × RPE.
 *
 * Indicateurs :
 *  - aigu 7 j (somme), chronique 28 j (moyenne hebdo = somme28 / 4)
 *  - ACWR rolling + ACWR EWMA (Williams 2017, plus robuste)
 *  - monotonie (Foster) = moyenne quotidienne / écart-type sur 7 j
 *  - strain = charge 7 j × monotonie
 *
 * ⚠️ L'ACWR est un indicateur de tendance, PAS un prédicteur de blessure
 * validé (cf. critiques Impellizzeri 2020). On l'utilise pour détecter
 * des pics brutaux, jamais comme vérité absolue.
 */
import type { ISODate, LoadCategory, LoadSession } from "./types";
import { addDays, daysBetween, mean, stdDev } from "./dates";

export function sessionLoad(s: Pick<LoadSession, "durationMin" | "rpe">): number {
  if (s.durationMin < 0 || s.rpe < 0 || s.rpe > 10) {
    throw new RangeError("durationMin >= 0 et 0 <= rpe <= 10 requis");
  }
  return Math.round(s.durationMin * s.rpe);
}

/** Série de charge quotidienne sur `days` jours se terminant à `endDate` inclus. */
export function dailyLoads(
  sessions: LoadSession[],
  endDate: ISODate,
  days: number,
  categories?: LoadCategory[],
): number[] {
  const out = new Array<number>(days).fill(0);
  for (const s of sessions) {
    if (categories && !categories.includes(s.category)) continue;
    const idx = days - 1 - daysBetween(s.date, endDate);
    if (idx >= 0 && idx < days) out[idx]! += sessionLoad(s);
  }
  return out;
}

/** EWMA avec λ = 2 / (N + 1). */
export function ewma(series: number[], n: number): number {
  const lambda = 2 / (n + 1);
  let v = series[0] ?? 0;
  for (let i = 1; i < series.length; i++) v = series[i]! * lambda + v * (1 - lambda);
  return v;
}

export type LoadStatus = "detraining" | "optimal" | "caution" | "danger";

export interface LoadSummary {
  date: ISODate;
  acute7: number;
  chronic28WeeklyAvg: number;
  acwrRolling: number | null;
  acwrEwma: number | null;
  monotony: number;
  strain: number;
  /** Variation de la semaine en cours vs moyenne hebdo des 4 dernières semaines, en %. */
  weeklyChangePct: number | null;
  byCategory7: Record<LoadCategory, number>;
  status: LoadStatus;
  alerts: string[];
}

const CATEGORIES: LoadCategory[] = ["football", "running", "trail", "strength", "cross", "other"];

export function summarizeLoad(sessions: LoadSession[], date: ISODate): LoadSummary {
  // 56 jours pour stabiliser l'EWMA chronique.
  const series56 = dailyLoads(sessions, date, 56);
  const last28 = series56.slice(-28);
  const last7 = series56.slice(-7);

  const acute7 = last7.reduce((a, b) => a + b, 0);
  const chronic28WeeklyAvg = last28.reduce((a, b) => a + b, 0) / 4;
  const hasHistory = sessions.some((s) => daysBetween(s.date, date) >= 21);

  const acwrRolling = hasHistory && chronic28WeeklyAvg > 0 ? acute7 / chronic28WeeklyAvg : null;
  const chronicEwma = ewma(series56, 28);
  const acwrEwma = hasHistory && chronicEwma > 0 ? ewma(series56, 7) / chronicEwma : null;

  const sd = stdDev(last7);
  const monotony = sd > 0 ? mean(last7) / sd : last7.some((x) => x > 0) ? 10 : 0;
  const strain = Math.round(acute7 * Math.min(monotony, 10));

  const weeklyChangePct =
    hasHistory && chronic28WeeklyAvg > 0
      ? Math.round(((acute7 - chronic28WeeklyAvg) / chronic28WeeklyAvg) * 100)
      : null;

  const byCategory7 = Object.fromEntries(
    CATEGORIES.map((c) => [c, dailyLoads(sessions, date, 7, [c]).reduce((a, b) => a + b, 0)]),
  ) as Record<LoadCategory, number>;

  // Approche prudente : on retient le plus élevé des deux ratios.
  const ratios = [acwrEwma, acwrRolling].filter((x): x is number => x !== null);
  const ratio = ratios.length ? Math.max(...ratios) : null;
  let status: LoadStatus = "optimal";
  if (ratio !== null) {
    if (ratio > 1.5) status = "danger";
    else if (ratio > 1.3) status = "caution";
    else if (ratio < 0.8) status = "detraining";
  }

  const alerts: string[] = [];
  if (weeklyChangePct !== null && weeklyChangePct >= 20) {
    alerts.push(`Charge +${weeklyChangePct} % par rapport à ta moyenne récente.`);
  }
  if (status === "danger") alerts.push("Pic de charge marqué : la séance clé suivante sera allégée.");
  if (monotony > 2) alerts.push("Monotonie élevée : varie davantage les jours durs et faciles.");

  return {
    date,
    acute7,
    chronic28WeeklyAvg: Math.round(chronic28WeeklyAvg),
    acwrRolling: acwrRolling === null ? null : round2(acwrRolling),
    acwrEwma: acwrEwma === null ? null : round2(acwrEwma),
    monotony: round2(monotony),
    strain,
    weeklyChangePct,
    byCategory7,
    status,
    alerts,
  };
}

/**
 * Facteur de réduction appliqué au volume trail planifié de la semaine
 * suivante selon l'état de charge. Le football n'est jamais réduit par
 * l'app (c'est le club qui décide) : on ajuste uniquement le trail/la muscu.
 */
export function plannedVolumeFactor(summary: LoadSummary): number {
  switch (summary.status) {
    case "danger":
      return 0.6;
    case "caution":
      return 0.8;
    case "detraining":
      return 1.1;
    default:
      return 1;
  }
}

/** Charge totale journalière des N derniers jours (pour les graphiques). */
export function loadHistory(sessions: LoadSession[], endDate: ISODate, days: number) {
  const totals = dailyLoads(sessions, endDate, days);
  return totals.map((load, i) => ({ date: addDays(endDate, i - days + 1), load }));
}

function round2(x: number): number {
  return Math.round(x * 100) / 100;
}
