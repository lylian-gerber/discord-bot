import type { ISODate } from "@/engine";

/** Date du jour dans le fuseau de l'athlète, "YYYY-MM-DD". */
export function localToday(timezone = "Europe/Paris", now = new Date()): ISODate {
  return new Intl.DateTimeFormat("en-CA", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}

/** ISODate → Date UTC minuit (pour les colonnes @db.Date). */
export function dbDate(day: ISODate): Date {
  return new Date(`${day}T00:00:00Z`);
}

/** Date (colonne @db.Date) → ISODate. */
export function isoDay(d: Date): ISODate {
  return d.toISOString().slice(0, 10);
}

const WEEKDAYS = ["lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi", "dimanche"];
const WEEKDAYS_SHORT = ["lun.", "mar.", "mer.", "jeu.", "ven.", "sam.", "dim."];

export function weekdayName(i: number, short = false): string {
  return (short ? WEEKDAYS_SHORT : WEEKDAYS)[i] ?? "";
}

export function formatDayFr(day: ISODate, opts: Intl.DateTimeFormatOptions = { weekday: "long", day: "numeric", month: "long" }): string {
  return new Intl.DateTimeFormat("fr-FR", { ...opts, timeZone: "UTC" }).format(dbDate(day));
}
