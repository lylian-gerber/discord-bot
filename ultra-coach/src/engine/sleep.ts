/**
 * Sommeil : dette glissante et heure de coucher conseillée.
 */
export interface SleepNight {
  date: string;
  hours: number;
}

export interface SleepSummary {
  avg7: number;
  debtHours: number;
  lastNight?: number;
}

/** Dette sur 7 j : somme des déficits (les surplus ne compensent qu'à 50 %). */
export function sleepSummary(nights: SleepNight[], needHours = 8): SleepSummary {
  const last7 = nights.slice(-7);
  const avg7 = last7.length ? last7.reduce((a, n) => a + n.hours, 0) / last7.length : 0;
  let debt = 0;
  for (const n of last7) {
    const delta = needHours - n.hours;
    debt += delta > 0 ? delta : delta * 0.5;
  }
  return { avg7: round1(avg7), debtHours: round1(Math.max(debt, 0)), lastNight: last7.at(-1)?.hours };
}

/**
 * Heure de coucher = réveil - besoin - latence d'endormissement - bonus dette.
 * Le bonus est plafonné à 45 min : on ne "rembourse" pas une dette en une nuit.
 */
export function bedtime(wakeTime: string, needHours: number, debtHours: number, bigDayTomorrow: boolean, latencyMin = 15): string {
  const [h, m] = wakeTime.split(":").map(Number) as [number, number];
  const bonus = Math.min(45, debtHours * 10) + (bigDayTomorrow ? 15 : 0);
  let minutes = h * 60 + m - needHours * 60 - latencyMin - bonus;
  minutes = ((minutes % 1440) + 1440) % 1440;
  const rounded = Math.round(minutes / 5) * 5;
  return `${String(Math.floor(rounded / 60) % 24).padStart(2, "0")}h${String(rounded % 60).padStart(2, "0")}`;
}

const round1 = (x: number) => Math.round(x * 10) / 10;
