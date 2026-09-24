"use client";

import { useActionState } from "react";
import { saveSweatTest } from "./actions";

export function SweatTestForm() {
  const [state, action, pending] = useActionState(saveSweatTest, undefined);
  return (
    <form action={action} className="mt-3 space-y-3">
      <div className="grid grid-cols-2 gap-3">
        {[
          ["weightBeforeKg", "Poids avant (kg)", "0.1"],
          ["weightAfterKg", "Poids après (kg)", "0.1"],
          ["fluidIntakeMl", "Bu pendant (ml)", "50"],
          ["durationMin", "Durée (min)", "1"],
          ["temperatureC", "Température (°C)", "1"],
        ].map(([n, l, step]) => (
          <label key={n}>
            <span className="mb-1.5 block text-sm text-muted">{l}</span>
            <input name={n} type="number" step={step} inputMode="decimal" className="field" required={n !== "temperatureC"} />
          </label>
        ))}
      </div>
      <p className="text-xs text-faint">Pèse-toi nu et sec, avant et juste après la séance, sans uriner entre les deux si possible.</p>
      <button className="btn-ghost w-full" disabled={pending}>
        Calculer mon taux de sudation
      </button>
      {state?.error && <p className="text-sm text-bad">{state.error}</p>}
      {state?.result && (
        <div className="rounded-xl bg-surface-2 p-3">
          <p className="num text-lg font-semibold">{state.result.sweatRateLph} L/h</p>
          <p className="text-sm text-muted">Perte de poids : {state.result.bodyMassLossPct} %</p>
          {state.result.warnings.map((w) => (
            <p key={w} className="mt-1 text-sm text-warn">
              {w}
            </p>
          ))}
        </div>
      )}
    </form>
  );
}
