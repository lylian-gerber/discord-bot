import type { ISODate } from "./types";

const DAY_MS = 86_400_000;

export function toUTC(date: ISODate): number {
  return Date.parse(`${date}T00:00:00Z`);
}

export function fromUTC(ms: number): ISODate {
  return new Date(ms).toISOString().slice(0, 10);
}

export function addDays(date: ISODate, days: number): ISODate {
  return fromUTC(toUTC(date) + days * DAY_MS);
}

export function daysBetween(from: ISODate, to: ISODate): number {
  return Math.round((toUTC(to) - toUTC(from)) / DAY_MS);
}

/** 0 = lundi … 6 = dimanche */
export function weekdayMon0(date: ISODate): number {
  return (new Date(toUTC(date)).getUTCDay() + 6) % 7;
}

export function mondayOf(date: ISODate): ISODate {
  return addDays(date, -weekdayMon0(date));
}

export function clamp(x: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, x));
}

export function mean(xs: number[]): number {
  return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0;
}

export function stdDev(xs: number[]): number {
  if (xs.length < 2) return 0;
  const m = mean(xs);
  return Math.sqrt(xs.reduce((a, x) => a + (x - m) ** 2, 0) / (xs.length - 1));
}
