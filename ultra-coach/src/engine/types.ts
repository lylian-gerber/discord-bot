/**
 * Types partagés du moteur de coaching.
 * Le moteur est 100 % déterministe et pur (aucun I/O) : il est testable,
 * rejouable, et c'est lui — pas le LLM — qui produit les chiffres.
 * Le LLM explique, contextualise et converse ; il ne calcule pas.
 */

export type ISODate = string; // "2026-09-24"

export type LoadCategory = "football" | "running" | "trail" | "strength" | "cross" | "other";

export interface LoadSession {
  date: ISODate;
  category: LoadCategory;
  durationMin: number;
  /** RPE de séance (CR-10, 0-10), saisi ~30 min après la séance. */
  rpe: number;
}

export type DayKind =
  | "rest"
  | "football_light"
  | "football_moderate"
  | "football_hard"
  | "match"
  | "trail_easy"
  | "trail_quality"
  | "long_run"
  | "back_to_back"
  | "strength";

export interface WeekDayPlan {
  /** 0 = lundi … 6 = dimanche */
  weekday: number;
  football: "none" | "light" | "moderate" | "hard" | "match";
}
