/**
 * DURABILITY SCORE — capacité à rester efficace avec la fatigue.
 *
 * Principe : on compare, par tranche horaire, l'efficience
 *   EF = vitesse ajustée à la pente (GAP, m/min) / FC
 * à celle de la 1ʳᵉ heure (hors 10 premières minutes d'échauffement).
 * Sans FC, on compare la vitesse GAP seule (moins fiable : dépend de l'intention).
 *
 * Ajustement pente : coût énergétique de Minetti et al. (2002),
 * gradient borné à ±45 % (au-delà le modèle n'est plus valide).
 * En descente technique le modèle surestime la vitesse "attendue" :
 * c'est une approximation assumée, affichée comme telle dans l'UI.
 */
import { clamp } from "./dates";

export interface StreamPoint {
  /** secondes depuis le départ */
  t: number;
  /** distance cumulée en mètres */
  d: number;
  /** altitude en mètres */
  alt?: number;
  hr?: number;
  cadence?: number;
  power?: number;
  moving?: boolean;
}

/** Coût énergétique (J/kg/m) en fonction du gradient (fraction). */
export function minettiCost(grade: number): number {
  const i = clamp(grade, -0.45, 0.45);
  return 155.4 * i ** 5 - 30.4 * i ** 4 - 43.3 * i ** 3 + 46.3 * i ** 2 + 19.5 * i + 3.6;
}

/** Facteur multiplicatif pour convertir une vitesse en pente vers son équivalent plat. */
export function gradeFactor(grade: number): number {
  return minettiCost(grade) / 3.6;
}

export interface Bucket {
  startMin: number;
  endMin: number;
  gapSpeedMpm: number;
  avgHr?: number;
  efficiency?: number;
  avgCadence?: number;
  avgPower?: number;
}

export interface DurabilityResult {
  buckets: Bucket[];
  /** Score 0-100 par jalon horaire (1h, 2h, 3h, 4h…) : 100 = aucune dégradation. */
  retentionByHour: { hour: number; retentionPct: number; score: number }[];
  /** Découplage aérobie (Friel) 1ʳᵉ moitié vs 2ⁿᵈᵉ moitié, en %. < 5 % = très bon. */
  decouplingPct?: number;
  /** Rapport vitesse GAP dernier 10 % / premiers 25 % (hors échauffement). >1 = finish fast. */
  finishRatio: number;
  score: number;
  basis: "efficiency" | "speed";
  notes: string[];
}

const WARMUP_S = 600;

/** Moyenne glissante de l'altitude (±2 points) : le bruit GPS créerait sinon de fausses pentes. */
export function smoothAltitude(points: StreamPoint[], half = 2): StreamPoint[] {
  return points.map((p, i) => {
    if (p.alt === undefined) return p;
    let sum = 0;
    let n = 0;
    for (let k = Math.max(0, i - half); k <= Math.min(points.length - 1, i + half); k++) {
      const a = points[k]!.alt;
      if (a !== undefined) {
        sum += a;
        n++;
      }
    }
    return { ...p, alt: sum / n };
  });
}

export function computeDurability(points: StreamPoint[], bucketMin = 60): DurabilityResult | null {
  const pts = smoothAltitude(points.filter((p) => p.moving !== false));
  if (pts.length < 10) return null;
  const totalS = pts[pts.length - 1]!.t - pts[0]!.t;
  if (totalS < 45 * 60) return null; // < 45 min : pas de signal de durabilité exploitable

  const hasHr = pts.filter((p) => p.hr).length > pts.length * 0.8;
  const t0 = pts[0]!.t;

  // Segments élémentaires → accumulation par bucket
  type Acc = { dist: number; gapDist: number; time: number; hrT: number; hrSum: number; cadSum: number; cadT: number; powSum: number; powT: number };
  const accs = new Map<number, Acc>();
  const segs: { tMid: number; dt: number; gapDist: number; hr?: number }[] = [];

  for (let k = 1; k < pts.length; k++) {
    const a = pts[k - 1]!;
    const b = pts[k]!;
    const dt = b.t - a.t;
    const dd = b.d - a.d;
    if (dt <= 0 || dt > 60 || dd < 0) continue; // pauses / trous GPS
    const grade = dd > 1 && a.alt !== undefined && b.alt !== undefined ? (b.alt - a.alt) / dd : 0;
    const gapDist = dd * gradeFactor(grade);
    const tMid = (a.t + b.t) / 2 - t0;
    segs.push({ tMid, dt, gapDist, hr: b.hr });
    if (tMid < WARMUP_S) continue;
    const idx = Math.floor(tMid / (bucketMin * 60));
    const acc = accs.get(idx) ?? { dist: 0, gapDist: 0, time: 0, hrT: 0, hrSum: 0, cadSum: 0, cadT: 0, powSum: 0, powT: 0 };
    acc.dist += dd;
    acc.gapDist += gapDist;
    acc.time += dt;
    if (b.hr) {
      acc.hrSum += b.hr * dt;
      acc.hrT += dt;
    }
    if (b.cadence) {
      acc.cadSum += b.cadence * dt;
      acc.cadT += dt;
    }
    if (b.power) {
      acc.powSum += b.power * dt;
      acc.powT += dt;
    }
    accs.set(idx, acc);
  }

  const buckets: Bucket[] = [...accs.entries()]
    .sort(([x], [y]) => x - y)
    .filter(([, a]) => a.time >= bucketMin * 60 * 0.5) // bucket final partiel accepté s'il fait ≥ 50 %
    .map(([idx, a]) => {
      const gapSpeedMpm = a.gapDist / (a.time / 60);
      const avgHr = a.hrT ? a.hrSum / a.hrT : undefined;
      return {
        startMin: idx * bucketMin,
        endMin: (idx + 1) * bucketMin,
        gapSpeedMpm: r1(gapSpeedMpm),
        avgHr: avgHr ? r1(avgHr) : undefined,
        efficiency: avgHr ? r3(gapSpeedMpm / avgHr) : undefined,
        avgCadence: a.cadT ? r1(a.cadSum / a.cadT) : undefined,
        avgPower: a.powT ? r1(a.powSum / a.powT) : undefined,
      };
    });

  if (buckets.length === 0) return null;
  const basis: DurabilityResult["basis"] = hasHr && buckets.every((b) => b.efficiency) ? "efficiency" : "speed";
  const metric = (b: Bucket) => (basis === "efficiency" ? b.efficiency! : b.gapSpeedMpm);
  const ref = metric(buckets[0]!);

  const retentionByHour = buckets.slice(1).map((b) => {
    const retentionPct = r1((metric(b) / ref) * 100);
    // 100 % de rétention → 100 ; chaque point perdu → -4 (10 % de perte = 60)
    return { hour: b.startMin / 60, retentionPct, score: Math.round(clamp(100 - (100 - retentionPct) * 4, 0, 100)) };
  });

  // Découplage aérobie : EF 1ʳᵉ moitié vs 2ⁿᵈᵉ (hors échauffement)
  let decouplingPct: number | undefined;
  const work = segs.filter((s) => s.tMid >= WARMUP_S);
  if (hasHr && work.length > 4) {
    const half = (work[0]!.tMid + work[work.length - 1]!.tMid) / 2;
    const ef = (xs: typeof work) => {
      const time = xs.reduce((a, s) => a + s.dt, 0);
      const dist = xs.reduce((a, s) => a + s.gapDist, 0);
      const hr = xs.reduce((a, s) => a + (s.hr ?? 0) * s.dt, 0) / time;
      return dist / time / hr;
    };
    const ef1 = ef(work.filter((s) => s.tMid < half));
    const ef2 = ef(work.filter((s) => s.tMid >= half));
    decouplingPct = r1(((ef1 - ef2) / ef1) * 100);
  }

  // Finish ratio
  const span = work.length ? work[work.length - 1]!.tMid - work[0]!.tMid : 0;
  const speedIn = (from: number, to: number) => {
    const xs = work.filter((s) => s.tMid >= from && s.tMid < to);
    const time = xs.reduce((a, s) => a + s.dt, 0);
    return time ? xs.reduce((a, s) => a + s.gapDist, 0) / time : 0;
  };
  const start = work[0]?.tMid ?? 0;
  const first = speedIn(start, start + span * 0.25);
  const last = speedIn(start + span * 0.9, start + span + 1);
  const finishRatio = first ? r3(last / first) : 1;

  // Score global : moyenne pondérée par la durée (tenir 3 h compte plus que tenir 1 h)
  const notes: string[] = [];
  let score: number;
  if (retentionByHour.length) {
    const wSum = retentionByHour.reduce((a, r) => a + r.hour, 0);
    score = Math.round(retentionByHour.reduce((a, r) => a + r.score * r.hour, 0) / wSum);
  } else {
    // Séance < 2 h : on se base sur le découplage
    score = decouplingPct !== undefined ? Math.round(clamp(100 - Math.max(decouplingPct, 0) * 6, 0, 100)) : 50;
    notes.push("Séance courte : score indicatif basé sur le découplage.");
  }
  if (basis === "speed") notes.push("Sans FC fiable : score basé sur l'allure seule (moins précis).");
  if (decouplingPct !== undefined && decouplingPct > 8) notes.push("Dérive cardiaque marquée en 2ᵉ moitié.");
  if (finishRatio >= 1.02) notes.push("Tu as fini plus vite que tu n'as commencé : bon signe de durabilité.");

  return { buckets, retentionByHour, decouplingPct, finishRatio, score, basis, notes };
}

const r1 = (x: number) => Math.round(x * 10) / 10;
const r3 = (x: number) => Math.round(x * 1000) / 1000;
