"use client";

import Link from "next/link";
import { useActionState } from "react";
import type { AuthState } from "./actions";

export function AuthForm({
  mode,
  action,
}: {
  mode: "login" | "signup";
  action: (s: AuthState, f: FormData) => Promise<AuthState>;
}) {
  const [state, formAction, pending] = useActionState(action, undefined);
  const signup = mode === "signup";
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-6 py-10">
      <div className="mb-10">
        <div className="mb-6 flex h-12 w-12 items-center justify-center rounded-2xl bg-surface">
          <svg viewBox="0 0 512 512" className="h-7 w-7" aria-hidden>
            <path d="M96 368 L200 176 L264 288 L312 216 L416 368 Z" fill="none" stroke="#c6ff3d" strokeWidth="40" strokeLinejoin="round" />
          </svg>
        </div>
        <h1 className="text-3xl font-bold tracking-tight">{signup ? "Crée ton compte" : "Content de te revoir"}</h1>
        <p className="mt-2 text-muted">Ton coach ultra-trail qui s&apos;adapte au football.</p>
      </div>
      <form action={formAction} className="space-y-3">
        {signup && <input name="name" placeholder="Prénom" autoComplete="given-name" className="field" required />}
        <input name="email" type="email" placeholder="Email" autoComplete="email" className="field" required />
        <input
          name="password"
          type="password"
          placeholder="Mot de passe"
          autoComplete={signup ? "new-password" : "current-password"}
          minLength={signup ? 8 : undefined}
          className="field"
          required
        />
        {state?.error && <p className="text-sm text-bad">{state.error}</p>}
        <button className="btn-primary w-full" disabled={pending}>
          {pending ? "…" : signup ? "Créer mon compte" : "Se connecter"}
        </button>
      </form>
      <p className="mt-6 text-center text-sm text-muted">
        {signup ? "Déjà un compte ? " : "Pas encore de compte ? "}
        <Link href={signup ? "/login" : "/signup"} className="font-semibold text-fg underline underline-offset-4">
          {signup ? "Se connecter" : "Créer un compte"}
        </Link>
      </p>
    </main>
  );
}
