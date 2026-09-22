# 1. Architecture complète du projet

## 1.1 Choix de stack (et pourquoi)

| Couche | Choix | Justification |
|--------|-------|---------------|
| Frontend | **Next.js 15 (App Router) + React + TypeScript** | SSR, routes serveur, PWA possible, un seul langage partout |
| UI | **Tailwind CSS + shadcn/ui (Radix)** | Composants accessibles, thème sombre natif, pas de look « template » si on customise les tokens |
| Graphiques | **Recharts** (+ visx si besoin de graphes custom) | Suffisant pour charge, sommeil, progression |
| Backend | **Route handlers + Server Actions Next.js**, logique dans des packages TS | NestJS est surdimensionné pour 1 athlète + staff. Si l'app devient multi-clubs, on extrait l'API plus tard (la logique métier vit déjà hors de Next) |
| Base | **PostgreSQL** (Neon ou Supabase) | Relationnel, JSONB pour les payloads flexibles, séries temporelles modestes |
| ORM | **Prisma** | Schéma lisible, migrations, types générés |
| Auth | **Better Auth** (sessions HTTP-only + passkeys / magic link) | Sessions sécurisées, rôles athlète / staff |
| Jobs planifiés | **Inngest** (ou Vercel Cron au début) | Brief quotidien, recalcul hebdo, sync montres, rappels hydratation |
| Notifications | **Web Push (PWA)** puis push natif (Expo) | iOS supporte le Web Push pour une PWA installée (iOS ≥ 16.4) |
| IA | **API Claude (Anthropic)** avec tool use et prompt caching | Sonnet pour le chat coach, Haiku pour le parsing et les tâches courtes |
| Météo | **Open-Meteo** | Gratuit, sans clé, température et humidité pour l'hydratation |
| Aliments | **Table CIQUAL (ANSES)** importée en base | Référence française gratuite, aliments génériques FR |
| Mobile | **PWA d'abord**, puis **Expo (React Native)** en V2 | L'app native est obligatoire pour Apple HealthKit |
| Tests | **Vitest** (moteur), **Playwright** (E2E) | Le moteur de calcul doit être couvert à ~100 % |
| Hébergement | **Vercel** + Postgres managé (région UE) | Simple ; données en UE |

## 1.2 Structure monorepo

```
performance-os/
├── apps/
│   ├── web/                    # Next.js (PWA) : UI + API routes
│   │   ├── app/
│   │   │   ├── (auth)/
│   │   │   ├── (app)/dashboard/
│   │   │   ├── (app)/checkin/
│   │   │   ├── (app)/planning/
│   │   │   ├── (app)/calendar/
│   │   │   ├── (app)/activities/
│   │   │   ├── (app)/nutrition/
│   │   │   ├── (app)/match-day/
│   │   │   ├── (app)/hydration/
│   │   │   ├── (app)/ultra/
│   │   │   ├── (app)/sleep/
│   │   │   ├── (app)/recovery/
│   │   │   ├── (app)/load/
│   │   │   ├── (app)/strength/
│   │   │   ├── (app)/coach/
│   │   │   ├── (app)/goals/
│   │   │   ├── (app)/settings/
│   │   │   └── api/            # webhooks, imports, cron endpoints
│   │   └── components/
│   └── mobile/                 # V2 : Expo (HealthKit, push natif)
├── packages/
│   ├── core/                   # ⚙️ MOTEUR — TS pur, zéro dépendance framework
│   │   ├── load/               # sRPE, ACWR, monotonie, alertes
│   │   ├── readiness/          # scores sommeil / récup / forme, décisions
│   │   ├── nutrition/          # besoins, répartition repas, substitutions
│   │   ├── hydration/          # sudation, besoins eau/sodium
│   │   ├── planning/           # macrocycle, génération semaine, contraintes
│   │   ├── ultra/              # progression, entraînement digestif
│   │   ├── recovery/           # bain froid, mobilité
│   │   └── rules/              # garde-fous santé partagés (hard rules)
│   ├── db/                     # schéma Prisma, client, seeds (CIQUAL, exercices)
│   ├── ai/                     # construction du contexte, prompts, outils, garde-fous
│   ├── integrations/           # adapters Garmin / Strava / Apple Health / FIT
│   └── ui/                     # design system (tokens, composants partagés)
└── docs/
```

**Règle d'or :** `packages/core` ne connaît ni Prisma, ni Next, ni le LLM. Il prend des objets en entrée et renvoie des objets. On peut donc le tester unitairement, le réutiliser dans l'app mobile et l'auditer.

## 1.3 Découpage modulaire (domaines)

```
┌────────────────────────────────────────────────────────────────────┐
│                           apps/web (UI)                            │
└───────────────┬────────────────────────────────────┬───────────────┘
                │ Server Actions / API               │ Chat
┌───────────────▼────────────────────┐  ┌────────────▼───────────────┐
│       Services applicatifs         │  │        packages/ai         │
│  (orchestrent db + core + ai)      │◄─┤ context builder · tools    │
└───┬───────────┬───────────┬────────┘  │ safety filter · LLM client │
    │           │           │           └────────────────────────────┘
┌───▼───┐  ┌────▼────┐  ┌───▼──────────┐
│  db   │  │  core   │  │ integrations │
│Prisma │  │ moteur  │  │ FIT/Strava/… │
└───────┘  └─────────┘  └──────────────┘
```

Domaines métier :

1. **Identity** : User, rôles, lien staff.
2. **Athlete** : profil, préférences alimentaires, template hebdo football.
3. **Activity** : séances réalisées (foot, match, trail, muscu, récup), imports.
4. **Wellness** : check-in matinal, sommeil, douleurs, métriques corporelles.
5. **Load** : agrégats quotidiens, ratios, alertes.
6. **Planning** : macrocycle, semaines, séances prévues, validation staff.
7. **Nutrition** : besoins, plans de repas, aliments, liste de courses, nutrition d'effort.
8. **Hydration** : prises, tests de sudation, rappels.
9. **Recovery** : protocoles, bains froids, mobilité.
10. **Goals** : objectifs A/B/C, jalons ultra.
11. **Coach (IA)** : conversations, mémoire, recommandations.

## 1.4 Flux de données clés

### Flux quotidien (automatique)
```
05:30  Job "daily-prep"   → sync montres (si connectées), météo du jour
Réveil Check-in (30 s)    → DailyReadiness
       ↓
       core.readiness     → scores + zone (vert/jaune/orange/rouge)
       core.planning      → ajuste la séance du jour (règles déterministes)
       core.nutrition     → besoins du jour selon type de journée ajusté
       core.hydration     → eau + sodium (météo + séance)
       ↓
       ai.dailyBrief      → rédige « Ce que tu dois faire aujourd'hui »
                            (chiffres injectés, le LLM ne les modifie pas)
       ↓
       Dashboard + notification
```

### Flux post-séance
```
Saisie manuelle / import FIT
  → Activity (+ RPE demandé si absent)
  → core.load recalcule TrainingLoad (jour + fenêtres 7/28 j)
  → alertes éventuelles (hausse trop rapide, monotonie)
  → si trail ≥ 90 min : questionnaire digestif → core.ultra ajuste la cible g/h
  → core.recovery : bain froid oui/non + collation post
```

### Flux hebdomadaire (dimanche soir)
```
Bilan semaine (charge réalisée vs prévue, sommeil, douleurs, compliance)
  → core.planning.generateWeek(S+1)
  → séances clés marquées "à valider" (athlète / staff)
  → liste de courses S+1
```

## 1.5 Intégrations montres (architecture prévue)

Interface unique côté `packages/integrations` :

```ts
interface ActivityProvider {
  id: 'garmin' | 'strava' | 'apple_health' | 'fit_file';
  fetchActivities(since: Date): Promise<NormalizedActivity[]>;
  fetchSleep?(since: Date): Promise<NormalizedSleep[]>;
  fetchDailyPhysio?(since: Date): Promise<NormalizedPhysio[]>; // RHR, HRV
}
```

Tout est normalisé (`NormalizedActivity` : type, début, durée, distance, D+/D−, FC moy/max, zones, trace simplifiée) puis dédupliqué via `(source, externalId)` et un rapprochement par horaire (±10 min) avec la saisie manuelle.

| Source | Données | Réalité d'accès |
|--------|---------|-----------------|
| Fichiers **.FIT / .GPX** | Activité complète | ✅ Immédiat : export depuis Garmin Connect, parse avec `fit-file-parser` |
| **Strava** | Activités, FC, D+ | OAuth simple, **mais** les conditions API restreignent l'usage avec l'IA : à vérifier avant de brancher le coach dessus |
| **Garmin Connect** | Activités, sommeil, HRV, RHR | API Health/Activity réservée aux partenaires approuvés (demande via Garmin Connect Developer Program) |
| **Apple Health** | Tout (si montre Apple ou sync Garmin → Santé) | Nécessite l'app **native iOS** (Expo + HealthKit) → V2 |
| Alternative | intervals.icu | API perso ouverte, synchronise Garmin : bon plan B à évaluer |

La saisie manuelle reste toujours possible et prioritaire en cas de conflit (l'athlète corrige la donnée).

## 1.6 Sécurité

- Sessions HTTP-only, SameSite=Lax, rotation. Passkeys ou magic link, pas de mot de passe faible.
- Rôles : `ATHLETE` (propriétaire), `STAFF` (lecture + validation des séances clés + commentaires), `ADMIN`.
- Tokens OAuth des montres chiffrés au repos (AES-256-GCM, clé en variable d'environnement).
- Secrets uniquement en variables d'environnement, jamais dans le code.
- Export et suppression complète des données (RGPD).
- Logs sans données de santé en clair.
