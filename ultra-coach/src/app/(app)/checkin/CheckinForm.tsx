"use client";

import { useActionState, useState } from "react";
import { saveCheckin } from "./actions";

type Slider = { name: string; label: string; low: string; high: string; inverted?: boolean };

const SLIDERS: Slider[] = [
  { name: "sleepQuality", label: "Qualité du sommeil", low: "horrible", high: "parfait" },
  { name: "energy", label: "Énergie", low: "vide", high: "pleine forme" },
  { name: "legs", label: "Jambes", low: "mortes", high: "fraîches" },
  { name: "fatigue", label: "Fatigue", low: "aucune", high: "épuisé", inverted: true },
  { name: "soreness", label: "Courbatures", low: "aucune", high: "partout", inverted: true },
  { name: "pain", label: "Douleur", low: "aucune", high: "forte", inverted: true },
  { name: "stress", label: "Stress", low: "zen", high: "max", inverted: true },
  { name: "motivation", label: "Motivation", low: "zéro", high: "à fond" },
];

function color(v: number, inverted?: boolean) {
  const good = inverted ? 10 - v : v;
  return good >= 7 ? "text-good" : good >= 4 ? "text-warn" : "text-bad";
}

export function CheckinForm({ defaults }: { defaults: Record<string, number | string> }) {
  const [state, action, pending] = useActionState(saveCheckin, undefined);
  const [vals, setVals] = useState<Record<string, number>>(() =>
    Object.fromEntries(SLIDERS.map((s) => [s.name, Number(defaults[s.name] ?? (s.inverted ? 2 : 7))])),
  );
  return (
    <form action={action} className="space-y-3">
      <section className="card">
        <label className="flex items-center justify-between">
          <span className="font-medium">Heures de sommeil</span>
          <input name="sleepHours" type="number" step="0.25" min={0} max={16} defaultValue={defaults.sleepHours ?? 8} className="field h-10 w-24 text-center" />
        </label>
      </section>

      <section className="card space-y-5">
        {SLIDERS.map((s) => (
          <div key={s.name}>
            <div className="flex items-baseline justify-between">
              <span className="font-medium">{s.label}</span>
              <span className={`num text-lg font-bold ${color(vals[s.name] ?? 0, s.inverted)}`}>{vals[s.name]}</span>
            </div>
            <input
              type="range"
              name={s.name}
              min={0}
              max={10}
              value={vals[s.name]}
              onChange={(e) => setVals((p) => ({ ...p, [s.name]: Number(e.target.value) }))}
              className="mt-2 w-full"
            />
            <div className="flex justify-between text-[11px] text-faint">
              <span>{s.low}</span>
              <span>{s.high}</span>
            </div>
            {s.name === "pain" && (vals.pain ?? 0) >= 3 && (
              <input name="painLocation" placeholder="Où ? (ex. mollet gauche)" defaultValue={String(defaults.painLocation ?? "")} className="field mt-2" />
            )}
          </div>
        ))}
      </section>

      <section className="card grid grid-cols-2 gap-3">
        <label>
          <span className="mb-1.5 block text-sm text-muted">FC repos (bpm)</span>
          <input name="restingHr" type="number" inputMode="numeric" defaultValue={defaults.restingHr ?? ""} className="field" />
        </label>
        <label>
          <span className="mb-1.5 block text-sm text-muted">HRV (ms)</span>
          <input name="hrvRmssd" type="number" inputMode="decimal" defaultValue={defaults.hrvRmssd ?? ""} className="field" />
        </label>
      </section>

      <section className="card">
        <label>
          <span className="mb-1.5 block font-medium">Comment tu te sens ?</span>
          <textarea
            name="freeText"
            rows={3}
            defaultValue={String(defaults.freeText ?? "")}
            placeholder="ex. quadris un peu lourds mais cardio nickel"
            className="field h-auto py-3"
          />
        </label>
      </section>

      {(vals.pain ?? 0) >= 7 && (
        <p className="rounded-xl border border-bad/40 bg-bad/10 p-3 text-sm text-bad">
          Douleur forte : pas de course aujourd&apos;hui. Si elle persiste ou augmente, fais-toi examiner (médecin, kiné, staff du club).
        </p>
      )}
      {state?.error && <p className="text-sm text-bad">{state.error}</p>}
      <button className="btn-primary w-full" disabled={pending}>
        {pending ? "Calcul…" : "Valider"}
      </button>
    </form>
  );
}
