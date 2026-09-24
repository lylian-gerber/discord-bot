/**
 * Conversion des données Strava vers le modèle de l'appli (pur, testable).
 */
import type { Sport } from "@prisma/client";
import type { StreamPoint } from "@/engine";

export interface StravaSummary {
  id: number;
  name: string;
  sport_type: string;
  start_date: string; // UTC ISO
  start_date_local: string; // "2026-09-24T18:02:00Z" (heure locale marquée Z)
  moving_time: number;
  elapsed_time: number;
  distance: number;
  total_elevation_gain?: number;
  average_heartrate?: number;
  max_heartrate?: number;
  average_cadence?: number;
  average_watts?: number;
  average_speed?: number;
  calories?: number;
  kilojoules?: number;
  gear_id?: string | null;
  map?: { summary_polyline?: string | null };
  perceived_exertion?: number | null;
}

export type StravaStreams = Partial<
  Record<"time" | "distance" | "altitude" | "heartrate" | "cadence" | "watts" | "moving", { data: (number | boolean)[] }>
>;

const SPORT_MAP: Record<string, Sport> = {
  Run: "running",
  VirtualRun: "running",
  TrailRun: "trail",
  Hike: "hiking",
  Walk: "walking",
  Ride: "cycling",
  VirtualRide: "cycling",
  GravelRide: "cycling",
  MountainBikeRide: "cycling",
  EBikeRide: "cycling",
  Soccer: "football",
  WeightTraining: "strength",
  Crossfit: "strength",
  Workout: "other",
  Yoga: "mobility",
  Swim: "swimming",
};

export function mapSport(sportType: string): Sport {
  return SPORT_MAP[sportType] ?? "other";
}

/** Jour local de l'activité (Strava encode l'heure locale avec un faux "Z"). */
export function localDay(a: Pick<StravaSummary, "start_date_local">): string {
  return a.start_date_local.slice(0, 10);
}

/**
 * RPE : Strava fournit parfois un "perceived_exertion" (1-10). Sinon on
 * l'estime depuis la FC moyenne en % de FC max (marqué comme estimé → l'app
 * demande à l'athlète de confirmer).
 */
export function estimateRpe(a: Pick<StravaSummary, "average_heartrate" | "perceived_exertion">, maxHr?: number | null): { rpe: number | null; estimated: boolean } {
  if (a.perceived_exertion) return { rpe: Math.min(10, Math.max(1, Math.round(a.perceived_exertion))), estimated: false };
  if (a.average_heartrate && maxHr) {
    const pct = a.average_heartrate / maxHr;
    const rpe = pct < 0.65 ? 2 : pct < 0.72 ? 3 : pct < 0.78 ? 4 : pct < 0.83 ? 5 : pct < 0.87 ? 6 : pct < 0.9 ? 7 : pct < 0.93 ? 8 : 9;
    return { rpe, estimated: true };
  }
  return { rpe: null, estimated: true };
}

export function toStreamPoints(s: StravaStreams): StreamPoint[] {
  const time = s.time?.data as number[] | undefined;
  const dist = s.distance?.data as number[] | undefined;
  if (!time || !dist || time.length !== dist.length) return [];
  const alt = s.altitude?.data as number[] | undefined;
  const hr = s.heartrate?.data as number[] | undefined;
  const cad = s.cadence?.data as number[] | undefined;
  const watts = s.watts?.data as number[] | undefined;
  const moving = s.moving?.data as boolean[] | undefined;
  return time.map((t, i) => ({
    t,
    d: dist[i]!,
    alt: alt?.[i],
    hr: hr?.[i] || undefined,
    // Strava donne la cadence de course par jambe : ×2 pour des pas/min
    cadence: cad?.[i] ? cad[i]! * 2 : undefined,
    power: watts?.[i] || undefined,
    moving: moving?.[i],
  }));
}
