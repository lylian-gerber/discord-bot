"use client";

import { useActionState } from "react";
import { saveOnboarding } from "./actions";

const FOOT_OPTIONS = [
  ["none", "Pas de foot"],
  ["light", "Léger"],
  ["moderate", "Modéré"],
  ["hard", "Intense"],
  ["match", "Match"],
] as const;

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium text-muted">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-faint">{hint}</span>}
    </label>
  );
}

function Section({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <section className="card space-y-4">
      <h2 className="flex items-center gap-3 text-lg font-semibold">
        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-accent text-sm font-bold text-accent-ink">{n}</span>
        {title}
      </h2>
      {children}
    </section>
  );
}

export function OnboardingForm({
  defaults: v,
  weekdays,
  editing,
  name,
}: {
  defaults: Record<string, string>;
  weekdays: string[];
  editing: boolean;
  name: string;
}) {
  const [state, action, pending] = useActionState(saveOnboarding, undefined);
  return (
    <main className="mx-auto max-w-lg px-4 pb-16 pt-8">
      <h1 className="text-3xl font-bold tracking-tight">{editing ? "Profil & objectif" : `Salut ${name} 👋`}</h1>
      <p className="mb-6 mt-2 text-muted">
        {editing
          ? "Modifier ces infos régénère ton plan à partir d'aujourd'hui. Tes séances déjà faites sont conservées."
          : "5 blocs rapides et ton coach construit ta préparation jusqu'au jour J."}
      </p>

      <form action={action} className="space-y-4">
        <Section n={1} title="Toi">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Naissance">
              <input name="birthDate" type="date" defaultValue={v.birthDate} className="field" required />
            </Field>
            <Field label="Sexe">
              <select name="sex" defaultValue={v.sex} className="field">
                <option value="male">Homme</option>
                <option value="female">Femme</option>
              </select>
            </Field>
            <Field label="Taille (cm)">
              <input name="heightCm" type="number" inputMode="numeric" defaultValue={v.heightCm} className="field" required />
            </Field>
            <Field label="Poids (kg)">
              <input name="weightKg" type="number" step="0.1" inputMode="decimal" defaultValue={v.weightKg} className="field" required />
            </Field>
            <Field label="Poids visé (kg)" hint="Optionnel">
              <input name="targetWeightKg" type="number" step="0.1" inputMode="decimal" defaultValue={v.targetWeightKg} className="field" />
            </Field>
            <Field label="Masse grasse (%)" hint="Optionnel">
              <input name="bodyFatPct" type="number" step="0.1" inputMode="decimal" defaultValue={v.bodyFatPct} className="field" />
            </Field>
            <Field label="FC max" hint="Optionnel, pour les zones">
              <input name="maxHr" type="number" inputMode="numeric" defaultValue={v.maxHr} className="field" />
            </Field>
            <Field label="VMA (km/h)" hint="Optionnel, pour les allures">
              <input name="vma" type="number" step="0.1" inputMode="decimal" defaultValue={v.vma} className="field" />
            </Field>
            <Field label="Réveil habituel">
              <input name="usualWakeTime" type="time" defaultValue={v.usualWakeTime} className="field" />
            </Field>
            <Field label="Besoin de sommeil (h)">
              <input name="sleepNeedHours" type="number" step="0.25" defaultValue={v.sleepNeedHours} className="field" />
            </Field>
          </div>
        </Section>

        <Section n={2} title="Football">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Niveau">
              <input name="footballLevel" defaultValue={v.footballLevel} className="field" />
            </Field>
            <Field label="Poste">
              <input name="footballPosition" defaultValue={v.footballPosition} placeholder="ex. milieu" className="field" />
            </Field>
            <Field label="Dernier match de la saison">
              <input name="seasonEnd" type="date" defaultValue={v.seasonEnd} className="field" />
            </Field>
            <div />
            <Field label="Trêve : début">
              <input name="winterBreakFrom" type="date" defaultValue={v.winterBreakFrom} className="field" />
            </Field>
            <Field label="Trêve : fin">
              <input name="winterBreakTo" type="date" defaultValue={v.winterBreakTo} className="field" />
            </Field>
          </div>
          <div>
            <span className="mb-2 block text-sm font-medium text-muted">Semaine type (modifiable chaque semaine)</span>
            <div className="space-y-2">
              {weekdays.map((d, i) => (
                <div key={d} className="flex items-center justify-between gap-3">
                  <span className="w-24 capitalize">{d}</span>
                  <select name={`d${i}`} defaultValue={v[`d${i}`]} className="field h-10 flex-1">
                    {FOOT_OPTIONS.map(([val, lab]) => (
                      <option key={val} value={val}>
                        {lab}
                      </option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
          </div>
        </Section>

        <Section n={3} title="Objectif">
          <Field label="Nom de la course">
            <input name="raceName" defaultValue={v.raceName} className="field" />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Type">
              <select name="raceType" defaultValue={v.raceType} className="field">
                <option value="ultra_trail">Ultra-trail</option>
                <option value="trail">Trail</option>
                <option value="road">Route</option>
              </select>
            </Field>
            <Field label="Priorité">
              <select name="priority" defaultValue={v.priority} className="field">
                <option value="A">A — objectif principal</option>
                <option value="B">B</option>
                <option value="C">C</option>
              </select>
            </Field>
            <Field label="Distance (km)">
              <input name="distanceKm" type="number" defaultValue={v.distanceKm} className="field" />
            </Field>
            <Field label="D+ (m)">
              <input name="dPlusM" type="number" defaultValue={v.dPlusM} className="field" />
            </Field>
            <Field label="Date">
              <input name="targetDate" type="date" defaultValue={v.targetDate} className="field" required />
            </Field>
            <Field label="Chrono visé (h)" hint="Vide = finir">
              <input name="targetTimeH" type="number" step="0.5" defaultValue={v.targetTimeH} className="field" />
            </Field>
          </div>
        </Section>

        <Section n={4} title="Ton niveau course aujourd'hui">
          <Field label="Niveau">
            <input name="currentLevel" defaultValue={v.currentLevel} className="field" />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Course / semaine (h)" hint="Moyenne du dernier mois">
              <input name="weeklyRunHours" type="number" step="0.25" defaultValue={v.weeklyRunHours} className="field" />
            </Field>
            <Field label="Plus longue sortie (min)" hint="Sur les 2 derniers mois">
              <input name="longestRunMin" type="number" defaultValue={v.longestRunMin} className="field" />
            </Field>
          </div>
        </Section>

        <Section n={5} title="Nutrition">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Repas / jour">
              <input name="mealsPerDay" type="number" defaultValue={v.mealsPerDay} className="field" />
            </Field>
            <Field label="Régime">
              <input name="dietaryPattern" defaultValue={v.dietaryPattern} className="field" />
            </Field>
          </div>
          <Field label="Aliments que tu aimes" hint="Séparés par des virgules">
            <input name="likedFoods" defaultValue={v.likedFoods} placeholder="riz, poulet, banane…" className="field" />
          </Field>
          <Field label="Aliments que tu n'aimes pas">
            <input name="dislikedFoods" defaultValue={v.dislikedFoods} className="field" />
          </Field>
          <Field label="Allergies / intolérances">
            <input name="allergies" defaultValue={v.allergies} className="field" />
          </Field>
        </Section>

        {state?.error && <p className="rounded-xl border border-bad/40 bg-bad/10 p-3 text-sm text-bad">{state.error}</p>}
        <button className="btn-primary w-full" disabled={pending}>
          {pending ? "Construction du plan…" : editing ? "Enregistrer et régénérer le plan" : "Construire ma préparation"}
        </button>
      </form>
    </main>
  );
}
