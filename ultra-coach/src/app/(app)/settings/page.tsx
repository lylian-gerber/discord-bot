import Link from "next/link";
import { logout } from "@/app/(auth)/actions";
import { PageHeader } from "@/components/ui";
import { requireAthlete } from "@/lib/auth";
import { db } from "@/lib/db";
import { stravaConfigured } from "@/server/strava/client";
import { disconnectStrava, syncStrava } from "./actions";

const STRAVA_MSG: Record<string, { text: string; ok: boolean }> = {
  connected: { text: "Strava connecté. Ton historique des 12 dernières semaines s'importe en arrière-plan (1-2 min).", ok: true },
  synced: { text: "Synchronisation terminée.", ok: true },
  disconnected: { text: "Strava déconnecté.", ok: true },
  denied: { text: "Connexion Strava annulée.", ok: false },
  missing_scope: { text: "Il faut autoriser l'accès à tes activités pour que l'import fonctionne.", ok: false },
  error: { text: "Erreur pendant la connexion à Strava. Réessaie.", ok: false },
  already_linked: { text: "Ce compte Strava est déjà lié à un autre compte Ultra Coach. Déconnecte-le d'abord de l'autre compte.", ok: false },
  sync_error: { text: "Erreur de synchronisation (limite Strava atteinte ?). Réessaie dans 15 min.", ok: false },
  not_configured: { text: "Strava n'est pas encore configuré sur le serveur (STRAVA_CLIENT_ID / STRAVA_CLIENT_SECRET / TOKEN_ENC_KEY).", ok: false },
};

export default async function SettingsPage({ searchParams }: { searchParams: Promise<{ strava?: string }> }) {
  const { user } = await requireAthlete();
  const { strava } = await searchParams;
  const aiReady = Boolean(process.env.ANTHROPIC_API_KEY);
  const integration = await db.integration.findUnique({ where: { userId_provider: { userId: user.id, provider: "strava" } } });
  const imported = integration ? await db.activity.count({ where: { userId: user.id, source: "strava" } }) : 0;
  const msg = strava ? STRAVA_MSG[strava] : undefined;

  return (
    <>
      <PageHeader title="Réglages" subtitle={user.email} raw />
      <div className="space-y-3">
        {msg && <p className={`rounded-xl border p-3 text-sm ${msg.ok ? "border-good/40 text-good" : "border-bad/40 text-bad"}`}>{msg.text}</p>}

        <section className="card">
          <div className="flex items-center justify-between">
            <p className="font-semibold">Strava</p>
            <span className={`chip ${integration?.status === "active" ? "border-good/40 text-good" : ""}`}>
              {integration ? (integration.status === "active" ? "Connecté" : "À reconnecter") : "Non connecté"}
            </span>
          </div>
          {integration ? (
            <>
              <p className="mt-1 text-sm text-muted">
                {imported} activité(s) importée(s)
                {integration.lastSyncAt && ` · dernière synchro ${integration.lastSyncAt.toLocaleString("fr-FR", { timeZone: user.timezone, dateStyle: "short", timeStyle: "short" })}`}
              </p>
              <p className="mt-1 text-xs text-faint">Tes nouvelles activités arrivent automatiquement quelques secondes après leur envoi sur Strava.</p>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <form action={syncStrava}>
                  <button className="btn-ghost h-10 w-full text-sm">Synchroniser</button>
                </form>
                <form action={disconnectStrava}>
                  <button className="btn-ghost h-10 w-full text-sm text-bad">Déconnecter</button>
                </form>
              </div>
            </>
          ) : (
            <>
              <p className="mt-1 text-sm text-muted">Import automatique de tes sorties : allure, FC, D+, analyse de durabilité.</p>
              {stravaConfigured() ? (
                <a href="/api/strava/connect" className="btn mt-3 w-full bg-[#fc4c02] text-white">
                  Connecter Strava
                </a>
              ) : (
                <p className="mt-2 text-xs text-faint">Pas encore configuré sur le serveur (voir README).</p>
              )}
            </>
          )}
        </section>

        <Link href="/onboarding" className="card block">
          <p className="font-semibold">Profil, football & objectif</p>
          <p className="mt-1 text-sm text-muted">Modifier ton profil, ta semaine type ou ta course régénère le plan.</p>
        </Link>
        <Link href="/plan/timeline" className="card block">
          <p className="font-semibold">Timeline de préparation</p>
          <p className="mt-1 text-sm text-muted">Toutes les semaines jusqu&apos;au jour J.</p>
        </Link>
        <div className="card">
          <p className="font-semibold">Coach IA</p>
          <p className="mt-1 text-sm text-muted">{aiReady ? "✅ Actif" : "⚠️ Clé ANTHROPIC_API_KEY manquante sur le serveur"}</p>
        </div>
        <form action={logout}>
          <button className="btn-ghost w-full text-bad">Se déconnecter</button>
        </form>
      </div>
    </>
  );
}
