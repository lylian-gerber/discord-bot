/**
 * Bibliothèque de séances : transforme un créneau planifié (type + durée)
 * en séance détaillée (objectif, blocs, allures, FC, RPE, nutrition,
 * échauffement, retour au calme).
 *
 * Allures dérivées de la VMA quand elle est connue, sinon prescription
 * au RPE / à la FC. Zones FC en % de FC max.
 */
import type { PlannedSession, TrailSessionType } from "./weekPlanner";

export interface AthletePaces {
  /** km/h */
  vma?: number;
  maxHr?: number;
}

export interface SessionBlock {
  label: string;
  durationMin?: number;
  pace?: string;
  hr?: [number, number];
  rpe?: number;
  note?: string;
}

export interface SessionDetail {
  title: string;
  objective: string;
  warmup?: string;
  cooldown?: string;
  blocks: SessionBlock[];
  targetRpe: number;
  hrRange?: [number, number];
  fueling: { carbsPerHour: number; note: string };
}

/** "5:20" à partir d'un % de VMA. */
export function paceAt(vma: number, pct: number): string {
  const secPerKm = 3600 / (vma * pct);
  const m = Math.floor(secPerKm / 60);
  const s = Math.round(secPerKm % 60);
  return s === 60 ? `${m + 1}:00` : `${m}:${String(s).padStart(2, "0")}`;
}

function hr(p: AthletePaces, lo: number, hi: number): [number, number] | undefined {
  return p.maxHr ? [Math.round(p.maxHr * lo), Math.round(p.maxHr * hi)] : undefined;
}

function pace(p: AthletePaces, lo: number, hi: number): string | undefined {
  // lo/hi en % de VMA : allure la plus lente d'abord
  return p.vma ? `${paceAt(p.vma, lo)}-${paceAt(p.vma, hi)}/km` : undefined;
}

export function fuelingFor(durationMin: number, gutStep = 40): SessionDetail["fueling"] {
  if (durationMin < 75) return { carbsPerHour: 0, note: "Eau seule, pas besoin de manger." };
  if (durationMin < 120) return { carbsPerHour: Math.min(gutStep, 40), note: "Commence à manger à 30-40 min, puis toutes les 20-30 min." };
  return {
    carbsPerHour: gutStep,
    note: `Palier digestif actuel : ${gutStep} g/h. Note ce que tu prends et tes symptômes après la sortie.`,
  };
}

const EASY_WARMUP = "10 min très facile, mobilité chevilles/hanches.";
const QUALITY_WARMUP = "15 min progressif + 4 lignes droites de 20 s.";
const COOLDOWN = "10 min très facile + 5 min de marche.";

export function describeSession(s: PlannedSession, p: AthletePaces = {}, gutStep = 40): SessionDetail {
  const d = s.durationMin;
  const descent = s.maxDescentM !== undefined ? ` Descente cumulée max ${s.maxDescentM} m.` : "";
  const base = (x: Omit<SessionDetail, "fueling">): SessionDetail => ({ ...x, fueling: fuelingFor(d, gutStep) });
  const t: TrailSessionType = s.type;

  switch (t) {
    case "easy":
      return base({
        title: `Footing facile ${d} min`,
        objective: "Endurance fondamentale : capillarisation, économie de course, récupération active.",
        blocks: [{ label: "Continu", durationMin: d, pace: pace(p, 0.62, 0.68), hr: hr(p, 0.65, 0.75), rpe: 3, note: "Tu dois pouvoir parler en phrases complètes." }],
        targetRpe: 3,
        hrRange: hr(p, 0.65, 0.75),
        warmup: "Les 10 premières minutes encore plus lentes.",
      });
    case "hilly":
      return base({
        title: `Trail vallonné ${d} min`,
        objective: "Endurance sur terrain varié, gestion de l'effort en montée." + descent,
        blocks: [{ label: "Continu vallonné", durationMin: d, hr: hr(p, 0.68, 0.8), rpe: 4, note: "Marche dès que la pente dépasse ~15 % ou que la FC s'emballe." }],
        targetRpe: 4,
        hrRange: hr(p, 0.68, 0.8),
        warmup: EASY_WARMUP,
        cooldown: COOLDOWN,
      });
    case "tempo": {
      const work = Math.max(15, Math.round((d - 30) / 5) * 5);
      return base({
        title: `Tempo ${d} min`,
        objective: "Élever l'allure soutenable longtemps (seuil aérobie haut)." + descent,
        warmup: QUALITY_WARMUP,
        cooldown: COOLDOWN,
        blocks: [
          { label: "Échauffement", durationMin: 15 },
          { label: `Tempo continu`, durationMin: work, pace: pace(p, 0.78, 0.82), hr: hr(p, 0.82, 0.87), rpe: 6, note: "Confortablement difficile." },
          { label: "Retour au calme", durationMin: d - 15 - work },
        ],
        targetRpe: 6,
        hrRange: hr(p, 0.82, 0.87),
      });
    }
    case "threshold": {
      const reps = Math.max(3, Math.min(5, Math.floor((d - 30) / 10)));
      return base({
        title: `Seuil ${reps} × 8 min`,
        objective: "Repousser le seuil lactique : tenir plus vite plus longtemps." + descent,
        warmup: QUALITY_WARMUP,
        cooldown: COOLDOWN,
        blocks: [
          { label: "Échauffement", durationMin: 15 },
          { label: `${reps} × 8 min seuil, récup 2 min trot`, durationMin: reps * 10, pace: pace(p, 0.84, 0.88), hr: hr(p, 0.87, 0.91), rpe: 7 },
          { label: "Retour au calme", durationMin: Math.max(5, d - 15 - reps * 10) },
        ],
        targetRpe: 7,
        hrRange: hr(p, 0.87, 0.91),
      });
    }
    case "progressive": {
      const q = Math.round(d / 4);
      return base({
        title: `Sortie progressive ${d} min`,
        objective: "Développer la capacité à accélérer avec la fatigue." + descent,
        warmup: "Intégré : le premier quart sert d'échauffement.",
        cooldown: "5 min très facile.",
        blocks: [
          { label: "1er quart", durationMin: q, pace: pace(p, 0.64, 0.68), rpe: 3 },
          { label: "2e quart", durationMin: q, pace: pace(p, 0.7, 0.74), rpe: 4 },
          { label: "3e quart", durationMin: q, pace: pace(p, 0.76, 0.8), rpe: 6 },
          { label: "Dernier quart", durationMin: d - 3 * q - 5, pace: pace(p, 0.82, 0.86), rpe: 7, note: "Finis fort mais contrôlé." },
          { label: "Retour au calme", durationMin: 5 },
        ],
        targetRpe: 5,
      });
    }
    case "long":
      return base({
        title: `Sortie longue ${fmtDur(d)}`,
        objective: "Temps sur les jambes, endurance, économie. C'est la séance la plus importante de la semaine.",
        warmup: "Les 15 premières minutes très lentes.",
        blocks: [{ label: "Continu", durationMin: d, pace: pace(p, 0.6, 0.68), hr: hr(p, 0.65, 0.76), rpe: 4, note: "Si le dernier quart est bon, accélère légèrement (finish fast)." }],
        targetRpe: 4,
        hrRange: hr(p, 0.65, 0.76),
      });
    case "hike_run":
      return base({
        title: `Sortie longue trail ${fmtDur(d)}${s.dPlusM ? ` · ${s.dPlusM} m D+` : ""}`,
        objective: "Temps sur les jambes en terrain trail, alternance marche/course, habituer les quadriceps à la descente.",
        warmup: "Les 15 premières minutes très lentes.",
        blocks: [
          { label: "Course sur le plat et les faux-plats", hr: hr(p, 0.65, 0.78), rpe: 4 },
          { label: "Marche rapide active dans les pentes > 15 %", note: "Mains sur les cuisses, pas courts." },
          { label: "Descentes relâchées", note: "Regard 3-4 m devant, cadence élevée, ne freine pas avec les talons." },
        ],
        targetRpe: 4,
        hrRange: hr(p, 0.65, 0.78),
      });
    case "hill_repeats":
      return base({
        title: "Côtes 8 × 90 s",
        objective: "Force spécifique et puissance aérobie en montée." + descent,
        warmup: QUALITY_WARMUP,
        cooldown: COOLDOWN,
        blocks: [
          { label: "Échauffement", durationMin: 15 },
          { label: "8 × 90 s en côte (6-10 %), récup descente en trottinant", durationMin: 25, hr: hr(p, 0.88, 0.93), rpe: 8, note: "Garde la même vitesse sur toutes les répétitions." },
          { label: "Retour au calme", durationMin: Math.max(5, d - 40) },
        ],
        targetRpe: 7,
      });
    case "downhill":
      return base({
        title: "Technique de descente",
        objective: "Apprendre à descendre vite et relâché, préparer les quadriceps à l'excentrique.",
        warmup: QUALITY_WARMUP,
        cooldown: COOLDOWN,
        blocks: [
          { label: "Montée facile", rpe: 4 },
          { label: "6 × descente de 1-2 min, cadence élevée", rpe: 5, note: "Volume faible au début : les courbatures arrivent 24-48 h après." },
        ],
        targetRpe: 5,
      });
    case "power_hike":
      return base({
        title: `Marche rapide en pente ${d} min`,
        objective: "Efficacité de la marche en montée — tu marcheras une grosse partie de l'ultra.",
        warmup: EASY_WARMUP,
        blocks: [{ label: "Montées en marche active (15-30 %)", durationMin: d - 10, hr: hr(p, 0.75, 0.85), rpe: 6, note: "Bâtons si tu comptes les utiliser en course." }],
        targetRpe: 6,
      });
    case "back_to_back":
      return base({
        title: `Back-to-back ${fmtDur(d)}`,
        objective: "Courir sur des jambes déjà fatiguées par la sortie longue de la veille : simule la 2e moitié de l'ultra.",
        blocks: [{ label: "Continu très facile", durationMin: d, hr: hr(p, 0.65, 0.75), rpe: 4 }],
        targetRpe: 4,
      });
    case "finish_fast":
      return base({
        title: `Finish fast ${d} min`,
        objective: "Rester rapide en fin de sortie : le cœur de la durabilité." + descent,
        blocks: [
          { label: "Endurance", durationMin: Math.round(d * 0.75), pace: pace(p, 0.64, 0.7), rpe: 4 },
          { label: "Dernier quart allure seuil", durationMin: d - Math.round(d * 0.75), pace: pace(p, 0.82, 0.86), rpe: 7 },
        ],
        targetRpe: 5,
      });
    case "recovery":
      return base({
        title: "Récupération active",
        objective: "Faire circuler sans fatiguer.",
        blocks: [{ label: s.note ?? "Marche, vélo très facile ou mobilité", durationMin: d, rpe: 2 }],
        targetRpe: 2,
      });
    case "strength_heavy":
      return base({
        title: "Renforcement lourd",
        objective: "Force des jambes et résistance musculaire, compatible football.",
        warmup: "5 min vélo/corde + mobilité hanches.",
        blocks: [
          { label: "Split squat bulgare", note: "4 × 5/jambe, lourd, 2 reps en réserve" },
          { label: "Soulevé de terre roumain (RDL)", note: "4 × 6" },
          { label: "Step-up haut", note: "3 × 6/jambe" },
          { label: "Mollets debout lourds", note: "3 × 8" },
          { label: "Soléaire genou fléchi", note: "3 × 12" },
          { label: "Gainage", note: "3 × 40 s face + côtés" },
        ],
        targetRpe: 7,
      });
    case "strength_light":
      return base({
        title: "Prévention pieds / chevilles / gainage",
        objective: "Solidifier les zones qui lâchent en ultra, sans fatigue pour le football.",
        blocks: [
          { label: "Montées sur pointes unipodales", note: "3 × 15" },
          { label: "Équilibre unipodal yeux fermés", note: "3 × 30 s" },
          { label: "Short foot / serviette", note: "2 × 1 min" },
          { label: "Pont fessier unilatéral", note: "3 × 12" },
          { label: "Gainage latéral", note: "3 × 30 s" },
        ],
        targetRpe: 3,
      });
  }
}

export function fmtDur(min: number): string {
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m ? `${h}h${String(m).padStart(2, "0")}` : `${h}h`;
}
