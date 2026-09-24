/**
 * Matériel : usure des chaussures et checklist automatique par séance.
 */
export interface ShoeWear {
  km: number;
  /** Durée de vie estimée (défaut 700 km, ajustable par modèle / ressenti). */
  lifespanKm?: number;
}

export type WearLevel = "ok" | "watch" | "replace_soon" | "replace";

export function shoeStatus(s: ShoeWear): { level: WearLevel; pct: number; message?: string } {
  const life = s.lifespanKm ?? 700;
  const pct = Math.round((s.km / life) * 100);
  if (pct >= 100) return { level: "replace", pct, message: `${s.km} km : remplacement conseillé.` };
  if (pct >= 85) return { level: "replace_soon", pct, message: `${s.km} km : prévois la relève.` };
  if (pct >= 70) return { level: "watch", pct, message: "Commence à surveiller l'usure." };
  return { level: "ok", pct };
}

export interface ChecklistInput {
  durationMin: number;
  distanceKm: number;
  night: boolean;
  temperatureC?: number;
  rainProbabilityPct?: number;
  remote?: boolean;
  carbsPerHour?: number;
  mlPerHour?: number;
}

export interface ChecklistItem {
  id: string;
  label: string;
  why?: string;
}

export function gearChecklist(i: ChecklistInput): ChecklistItem[] {
  const items: ChecklistItem[] = [
    { id: "shoes", label: "Chaussures adaptées au terrain" },
    { id: "watch", label: "Montre chargée" },
    { id: "phone", label: "Téléphone chargé" },
  ];
  const hours = i.durationMin / 60;
  if (hours >= 1.25 || i.distanceKm >= 15) {
    const ml = Math.round((i.mlPerHour ?? 500) * hours);
    items.push({ id: "water", label: `Eau : ~${ml} ml (flasques / poche)`, why: "Au-delà de 75 min, boire devient utile." });
    items.push({ id: "fuel", label: `Nutrition : ~${Math.round((i.carbsPerHour ?? 40) * hours)} g de glucides` });
  }
  if (hours >= 2 || i.distanceKm >= 25) {
    items.push({ id: "vest", label: "Gilet / sac d'hydratation" });
    items.push({ id: "electrolytes", label: "Électrolytes / sel" });
    items.push({ id: "jacket", label: "Veste coupe-vent / imperméable" });
  }
  if (hours >= 4 || i.distanceKm >= 45 || i.remote) {
    items.push({ id: "blanket", label: "Couverture de survie" });
    items.push({ id: "firstaid", label: "Mini trousse : pansements, ampoules, anti-frottement" });
    items.push({ id: "cash", label: "Argent / carte + pièce d'identité" });
    items.push({ id: "poles", label: "Bâtons (si fort D+)" });
  }
  if (i.night || hours >= 5) {
    items.push({ id: "headlamp", label: "Frontale", why: "Nuit ou retard possible." });
    items.push({ id: "battery", label: "Deuxième batterie frontale / batterie externe" });
  }
  if (i.temperatureC !== undefined && i.temperatureC <= 5) items.push({ id: "warm", label: "Gants, bonnet, couche chaude" });
  if (i.temperatureC !== undefined && i.temperatureC >= 25) items.push({ id: "sun", label: "Casquette, lunettes, crème solaire" });
  if ((i.rainProbabilityPct ?? 0) >= 50 && !items.some((x) => x.id === "jacket")) items.push({ id: "jacket", label: "Veste imperméable" });
  if (i.distanceKm >= 80) {
    items.push({ id: "drop", label: "Sac d'allègement : chaussettes, t-shirt, chaussures de rechange" });
    items.push({ id: "mandatory", label: "Vérifier la liste de matériel obligatoire de l'organisation" });
  }
  return items;
}
