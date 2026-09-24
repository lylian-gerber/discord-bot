"use client";

import { useActionState, useState } from "react";
import { logActivity } from "./actions";

const SPORTS = [
  ["trail", "Trail"],
  ["running", "Course route"],
  ["football", "Football"],
  ["strength", "Muscu"],
  ["hiking", "Rando"],
  ["cycling", "Vélo"],
  ["walking", "Marche"],
  ["mobility", "Mobilité"],
  ["swimming", "Natation"],
  ["other", "Autre"],
] as const;

const RPE_HELP = ["Repos", "Très très facile", "Très facile", "Facile", "Modéré", "Un peu dur", "Dur", "Très dur", "Très très dur", "Quasi max", "Maximal"];

export function LogForm({ defaults }: { defaults: { workoutId?: string; sport: string; day: string; durationMin?: number; isMatch?: boolean } }) {
  const [state, action, pending] = useActionState(logActivity, undefined);
  const [sport, setSport] = useState(defaults.sport);
  const [rpe, setRpe] = useState(5);
  const [duration, setDuration] = useState(defaults.durationMin ?? 60);
  const [isMatch, setIsMatch] = useState(Boolean(defaults.isMatch));
  const endurance = ["trail", "running", "hiking", "cycling"].includes(sport);

  return (
    <form action={action} className="space-y-3">
      {defaults.workoutId && <input type="hidden" name="workoutId" value={defaults.workoutId} />}
      <section className="card space-y-3">
        <div className="flex flex-wrap gap-2">
          {SPORTS.map(([v, l]) => (
            <label key={v} className={`chip cursor-pointer px-3 py-1.5 text-sm ${sport === v ? "border-accent bg-accent text-accent-ink" : ""}`}>
              <input type="radio" name="sport" value={v} checked={sport === v} onChange={() => setSport(v)} className="sr-only" />
              {l}
            </label>
          ))}
        </div>
        {sport === "football" && (
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="isMatch" checked={isMatch} onChange={(e) => setIsMatch(e.target.checked)} className="h-4 w-4" /> C&apos;était un match
          </label>
        )}
        <div className="grid grid-cols-2 gap-3">
          <label>
            <span className="mb-1.5 block text-sm text-muted">Date</span>
            <input name="day" type="date" defaultValue={defaults.day} max={defaults.day} className="field" />
          </label>
          <label>
            <span className="mb-1.5 block text-sm text-muted">Durée (min)</span>
            <input name="durationMin" type="number" inputMode="numeric" value={duration} onChange={(e) => setDuration(Number(e.target.value))} className="field" required />
          </label>
          {isMatch && sport === "football" && (
            <label>
              <span className="mb-1.5 block text-sm text-muted">Minutes jouées</span>
              <input name="minutesPlayed" type="number" inputMode="numeric" className="field" />
            </label>
          )}
          {endurance && (
            <>
              <label>
                <span className="mb-1.5 block text-sm text-muted">Distance (km)</span>
                <input name="distanceKm" type="number" step="0.01" inputMode="decimal" className="field" />
              </label>
              <label>
                <span className="mb-1.5 block text-sm text-muted">D+ (m)</span>
                <input name="dPlusM" type="number" inputMode="numeric" className="field" />
              </label>
            </>
          )}
          <label>
            <span className="mb-1.5 block text-sm text-muted">FC moyenne</span>
            <input name="avgHr" type="number" inputMode="numeric" className="field" />
          </label>
        </div>
      </section>

      <section className="card">
        <div className="flex items-baseline justify-between">
          <span className="font-medium">Effort ressenti (RPE)</span>
          <span className="num text-lg font-bold text-accent">{rpe}</span>
        </div>
        <input type="range" name="rpe" min={0} max={10} value={rpe} onChange={(e) => setRpe(Number(e.target.value))} className="mt-2 w-full" />
        <p className="text-sm text-muted">{RPE_HELP[rpe]}</p>
        <p className="num mt-1 text-xs text-faint">Charge = {duration} × {rpe} = {duration * rpe} UA</p>
      </section>

      {endurance && duration >= 45 && (
        <details className="card">
          <summary className="cursor-pointer font-medium">Ravitaillement & digestion</summary>
          <div className="mt-3 space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <label>
                <span className="mb-1.5 block text-sm text-muted">Glucides pris (g total)</span>
                <input name="carbsTotalG" type="number" inputMode="numeric" className="field" />
              </label>
              <label>
                <span className="mb-1.5 block text-sm text-muted">Produits</span>
                <input name="products" placeholder="gel X, compote…" className="field" />
              </label>
            </div>
            <p className="text-sm text-muted">Symptômes (0 = aucun, 10 = très fort)</p>
            <div className="grid grid-cols-2 gap-3">
              {[
                ["nausea", "Nausée"],
                ["bloating", "Ballonnement"],
                ["cramps", "Crampes ventre"],
                ["hunger", "Faim"],
              ].map(([n, l]) => (
                <label key={n}>
                  <span className="mb-1.5 block text-sm text-muted">{l}</span>
                  <input name={n} type="number" min={0} max={10} defaultValue={0} className="field" />
                </label>
              ))}
            </div>
          </div>
        </details>
      )}

      <section className="card">
        <label>
          <span className="mb-1.5 block font-medium">Ressenti</span>
          <textarea name="feeling" rows={2} placeholder="ex. jambes lourdes dans la dernière montée" className="field h-auto py-3" />
        </label>
      </section>

      {state?.error && <p className="text-sm text-bad">{state.error}</p>}
      <button className="btn-primary w-full" disabled={pending}>
        {pending ? "…" : "Enregistrer"}
      </button>
    </form>
  );
}
