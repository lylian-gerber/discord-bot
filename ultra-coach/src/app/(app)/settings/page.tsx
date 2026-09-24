import Link from "next/link";
import { logout } from "@/app/(auth)/actions";
import { PageHeader } from "@/components/ui";
import { requireAthlete } from "@/lib/auth";

export default async function SettingsPage() {
  const { user } = await requireAthlete();
  const aiReady = Boolean(process.env.ANTHROPIC_API_KEY);
  return (
    <>
      <PageHeader title="Réglages" subtitle={user.email} />
      <div className="space-y-3">
        <Link href="/onboarding" className="card block">
          <p className="font-semibold">Profil, football & objectif</p>
          <p className="mt-1 text-sm text-muted">Modifier ton profil, ta semaine type ou ta course régénère le plan.</p>
        </Link>
        <Link href="/plan/timeline" className="card block">
          <p className="font-semibold">Timeline de préparation</p>
          <p className="mt-1 text-sm text-muted">Toutes les semaines jusqu&apos;au jour J.</p>
        </Link>
        <div className="card">
          <p className="font-semibold">Connexions</p>
          <p className="mt-1 text-sm text-muted">Coach IA : {aiReady ? "✅ actif" : "⚠️ clé ANTHROPIC_API_KEY manquante"}</p>
          <p className="mt-1 text-sm text-muted">Strava : bientôt</p>
        </div>
        <form action={logout}>
          <button className="btn-ghost w-full text-bad">Se déconnecter</button>
        </form>
      </div>
    </>
  );
}
