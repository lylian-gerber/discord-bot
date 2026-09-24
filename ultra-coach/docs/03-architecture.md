# 3. Architecture technique

## 3.1 Choix de stack (et pourquoi)

| Couche | Choix | Justification |
|---|---|---|
| Frontend | **Next.js (App Router) + React + TypeScript** | SSR, server actions, PWA, un seul langage partout |
| UI | Tailwind CSS + shadcn/ui | Rapide, entièrement personnalisable |
| Backend | **Route handlers / server actions Next.js** (pas NestJS au MVP) | Pour un développeur seul, NestJS double la surface de code sans bénéfice à ce stade. Le domaine est isolé dans des packages (`engine`, `db`, `ai`), donc migrer vers un service séparé plus tard est simple. |
| Jobs asynchrones | **Worker Node séparé + pg-boss** (file d'attente dans PostgreSQL) | Import Strava, analyses IA, jobs du soir, notifications. Pas besoin de Redis. |
| Base | PostgreSQL 16 (Neon / Supabase / Railway) | Relationnel + JSONB pour les structures souples |
| ORM | Prisma | Schéma : `prisma/schema.prisma` (validé) |
| IA | **Claude API** (`@anthropic-ai/sdk`), modèle `claude-opus-5` par défaut, vision + tool use + structured outputs + prompt caching | Voir `06-moteur-ia.md` |
| Stockage | S3-compatible (Cloudflare R2 : pas de frais de sortie) | Photos, streams d'activités (JSON gzip) |
| Graphiques | Recharts | Demandé, suffisant |
| Auth | Better Auth (sessions en base, cookies httpOnly) + passkeys | Sessions sécurisées, pas de JWT long |
| Météo | Open-Meteo | Gratuit, sans clé, prévisions horaires |
| Notifications | Web Push (VAPID) | PWA ; sur iOS uniquement si l'app est ajoutée à l'écran d'accueil (iOS ≥ 16.4) |
| Mobile | PWA → app native **Expo/React Native** en V3 | Le natif est obligatoire pour Apple Health (voir 09) |
| Hébergement | Vercel (web) + Railway/Fly (worker) + Neon (DB) + R2 | Coût < 30 €/mois pour un utilisateur, hors IA |
| Observabilité | Sentry + logs structurés + table d'usage IA | Suivre erreurs et coût IA par utilisateur |

## 3.2 Organisation du code (monorepo pnpm)

```
ultra-coach/
├─ apps/
│  ├─ web/            Next.js : pages, route handlers, server actions, PWA
│  └─ worker/         Jobs pg-boss : sync, analyses IA, jobs planifiés, push
├─ packages/
│  ├─ engine/         Moteur déterministe (actuel src/engine) — 0 dépendance, 100 % testé
│  ├─ db/             Prisma schema + client + repositories
│  ├─ ai/             Client Claude, prompts versionnés, outils, context builder, mémoire, évals
│  ├─ integrations/   Providers Strava/Garmin/Whoop/… derrière une interface commune
│  └─ ui/             Composants partagés
└─ docs/
```

État actuel du dépôt : `src/engine/` (moteur + tests), `prisma/schema.prisma`, `docs/`. La migration en monorepo est la tâche de la semaine 1.

## 3.3 Flux principaux

### Import d'activité (Strava)

```
Strava ──webhook──► POST /api/webhooks/strava  (répond < 2 s, enfile un job)
                               │
                          pg-boss: strava.import(activityId)
                               │
     GET /activities/{id} + /streams ──► Activity + StravaActivity + streams → R2
                               │
     engine: sRPE (RPE demandé si absent), durabilité, charge du jour
                               │
     job ai.analyzeActivity ──► Activity.aiAnalysis (structured output)
                               │
     job plan.adaptTomorrow ──► Workout(s) de demain adaptés + push "Analyse prête"
```

### Message au coach

```
POST /api/coach/messages
  1. safety.checkSafety(texte, douleur du jour)       ← déterministe
  2. context builder → AthleteSnapshot (JSON compact)
  3. Claude (system figé + snapshot + historique + images) avec outils
  4. outils exécutés côté serveur ; toute modification de plan passe par le moteur
  5. réponse streamée (SSE) + cartes d'action à confirmer
  6. job memory.extract (asynchrone)
```

### Job du soir (21 h locale) et job du matin (5 h locale)

- **Soir** : synchro des sources, charge, prévision readiness, adaptation de demain, heure de coucher, notification « Demain : … ».
- **Matin** : après check-in → readiness réel → adaptation finale de la séance du jour → cibles nutrition/hydratation → notifications de la journée.

## 3.4 Couche d'intégrations extensible

```ts
interface ActivityProvider {
  id: "strava" | "garmin" | "coros" | "polar" | "apple_health" | "whoop";
  authorizeUrl(state: string): string;
  exchangeCode(code: string): Promise<TokenSet>;
  refresh(tokens: TokenSet): Promise<TokenSet>;
  listActivities(since: Date): Promise<NormalizedActivity[]>;
  getStreams?(externalId: string): Promise<StreamPoint[]>;
  handleWebhook?(payload: unknown): Promise<WebhookEvent[]>;
}
interface WellnessProvider {
  getSleep(since: Date): Promise<NormalizedSleep[]>;
  getHrv?(since: Date): Promise<{ day: string; rmssd: number }[]>;
  getRestingHr?(since: Date): Promise<{ day: string; bpm: number }[]>;
}
```

Tout ce qui entre est normalisé (`NormalizedActivity`) avant d'atteindre la base : ajouter Garmin ou Coros = écrire un adaptateur, rien d'autre ne change. Dédoublonnage : même heure de début ± 2 min et durée ± 5 % → une seule `Activity` (priorité de source configurable).

## 3.5 Sécurité et données de santé

- Tokens OAuth chiffrés (AES-256-GCM, clé hors base).
- Photos privées en R2, accès par URL signée de courte durée.
- Isolation stricte par `userId` dans chaque repository (jamais de requête sans filtre utilisateur).
- Export complet et suppression de compte (RGPD — ce sont des données de santé, catégorie particulière).
- Aucune donnée utilisateur utilisée pour entraîner un modèle ; configuration de rétention minimale chez le fournisseur IA.
- Rate limiting sur `/api/coach` et les uploads.

## 3.6 Versionnage du moteur

Chaque sortie calculée (plan, readiness, nutrition) enregistre `engineVersion`. Changer une formule ne réécrit pas silencieusement l'historique ; on peut rejouer un calcul pour comprendre une recommandation passée.
