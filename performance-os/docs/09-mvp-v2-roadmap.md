# 9. MVP, fonctionnalités V2 & roadmap

## 9.1 Philosophie du MVP

Le MVP doit être **utile dès la semaine 1 pour toi**, pas complet. Il couvre :
- la boucle quotidienne (check-in → forme → séance ajustée → besoins du jour) ;
- la boucle hebdomadaire (plan S+1 généré autour du foot) ;
- la charge ;
- le jour de match ;
- le coach IA.

Le reste (montres, staff, app native) vient ensuite. Tant que tu n'as pas **6 semaines de données réelles**, les seuils ne peuvent de toute façon pas être calibrés sur toi.

## 9.2 Périmètre MVP

| Module | Inclus au MVP |
|--------|---------------|
| Auth & onboarding | Compte, profil, template foot, matchs (saisie + .ics), objectifs, niveau trail, préférences alimentaires |
| Check-in | Complet (sliders, sommeil, douleur, FC repos / HRV manuels) |
| Activités | Saisie manuelle tous types + **import FIT/GPX** |
| Charge | sRPE, agrégats, EWMA / ACWR, monotonie, alertes |
| Scores | Sommeil, récupération, forme, fatigue musculaire, risque |
| Planning | Macrocycle, génération hebdo, ajustement quotidien, séances conditionnelles, validation |
| Calendrier | Vues mois / semaine, glisser-déposer avec vérification et recalcul |
| Nutrition | Cibles par type de journée + plan de repas (gabarits) + alternatives |
| Jour de match | Timeline complète |
| Hydratation | Objectif du jour, saisie rapide, test de sudation, recommandations |
| Ultra | Indicateurs, jalons, paliers digestifs, journal de ravito, questionnaire |
| Sommeil / Récup | Recommandations, dette, bain froid (décision + journal), routines mobilité |
| Renfo | 2 séances types progressives, placement automatique |
| Coach IA | Chat + snapshot + outils de lecture + propositions (modif, saisie, mémoire) + garde-fous |
| Brief quotidien | Oui |
| Notifications | Web Push : check-in, RPE, hydratation, match |
| PWA | Installable, hors ligne pour le check-in et la saisie |

**Exclu du MVP** : synchro automatique des montres, staff, liste de courses, app native, cartes GPS, météo automatique (saisie manuelle de la température au MVP).

## 9.3 Fonctionnalités V2+

**V2 (après ~2–3 mois d'usage)**
- Synchro automatique : Strava (après vérification des conditions API), intervals.icu, Garmin (si accès partenaire obtenu).
- App native **Expo** : Apple HealthKit (sommeil, HRV, FC repos), push natif, widget « forme du jour ».
- Liste de courses hebdomadaire.
- Météo automatique (Open-Meteo) pour l'hydratation et le placement des séances.
- Espace staff : invitations, validation, commentaires, permissions.
- Calibrage personnel des seuils : régression forme ↔ performance ressentie en match, poids des composantes ajusté sur tes données.
- Charge basée sur la FC (TRIMP) en complément du sRPE, quand les données FC sont fiables.

**V3**
- Plan de course détaillé ultra et Dodo : profil GPX de la course, barrières horaires, ravitos, allure par section, plan nutrition par segment.
- Acclimatation chaleur / humidité pour Maurice (protocole sur 10–14 jours).
- Analyse des traces : allure en montée / descente, VAM, dérive cardiaque.
- Photo de repas → estimation des macros (vision), toujours avec confirmation.
- Rapports PDF mensuels pour le staff.
- Multi-athlètes (si ça devient un produit), avec conformité RGPD / HDS renforcée.

## 9.4 Roadmap de développement (module par module)

Hypothèse : un développeur à temps partiel (~10–15 h / semaine), avec l'aide de Claude Code. Chaque sprint dure environ 1 semaine et se termine par quelque chose d'**utilisable**.

| Sprint | Module | Livrable | Définition de « fini » |
|--------|--------|----------|------------------------|
| 0 | Fondations | Monorepo (pnpm + Turborepo), Next.js, Tailwind + shadcn, Prisma + Postgres, Better Auth, CI (lint, typecheck, tests), déploiement Vercel | Page connectée déployée |
| 1 | Profil & onboarding | Schéma Prisma v1, onboarding complet, template foot, matchs | Profil et calendrier foot en base |
| 2 | Activités & charge | Saisie séances, `core/load` (sRPE, agrégats, EWMA, monotonie), page Charge | Tests unitaires du moteur à 100 %, graphes affichés |
| 3 | Check-in & scores | `core/readiness`, check-in, scores, douleurs + règles de santé | Forme calculée chaque matin, orientation santé testée |
| 4 | Dashboard v1 | Anneaux, séance du jour, charge, dernière séance, besoins (provisoires) | Dashboard utilisable au quotidien |
| 5 | Planning v1 | Macrocycle, génération hebdo, règles H1–H13, page Planning | Semaine générée autour du foot, règles couvertes par les tests |
| 6 | Ajustement & calendrier | Matrice quotidienne, séances conditionnelles, calendrier + glisser-déposer + recalcul | Déplacer une séance recalcule la semaine avec un aperçu d'impact |
| 7 | Nutrition v1 | `core/nutrition`, import CIQUAL, cibles, gabarits de repas, alternatives | Plan de repas du jour cohérent (écart ≤ 5 %) |
| 8 | Match & hydratation | Timeline jour de match, test de sudation, objectif eau, rappels push | Timeline correcte pour tout horaire de match |
| 9 | Ultra & digestif | Espace ultra, jalons, paliers g/h, journal ravito, questionnaire, plan de ravito | Palier ajusté automatiquement après une sortie |
| 10 | Sommeil, récup, renfo | Pages sommeil / récup, bain froid, mobilité, renfo | Recos du jour complètes |
| 11 | Coach IA | Snapshot, outils, garde-fous, propositions, mémoire, brief quotidien | Évals de sécurité à 100 % |
| 12 | Import FIT + PWA + polish | Parse FIT/GPX, hors ligne, notifications, accessibilité, performance | App installée sur ton téléphone, usage quotidien sans friction |
| 13+ | V2 | Montres, Expo, courses, staff… | — |

**Calendrier réaliste** : MVP en **~3 mois** à ce rythme, donc une première version complète vers fin décembre 2026, pile pour la trêve et avant la phase BUILD.
En attendant, les sprints 1 à 5 donnent déjà un outil utile (charge + forme + plan hebdo) dès la fin octobre.

## 9.5 Risques projet

| Risque | Impact | Parade |
|--------|--------|--------|
| Trop de saisie manuelle → abandon | Élevé | Check-in < 45 s, import FIT tôt, valeurs par défaut intelligentes |
| Seuils génériques inadaptés | Moyen | Paramètres configurables + calibrage V2 sur tes données |
| Surconfiance dans les scores | Élevé | Affichage systématique du « pourquoi », ton prudent, validation humaine des séances clés |
| Accès API montres refusé | Moyen | FIT/GPX + intervals.icu comme plans B |
| Dérive du périmètre | Élevé | MVP figé ; tout le reste en V2 |
| Données de santé exposées | Élevé | Chiffrement, hébergement UE, pas de logs sensibles, export / suppression |

## 9.6 Prochaine étape proposée

**Sprint 0 + Sprint 1** : initialiser le monorepo et poser le schéma Prisma v1 (doc 3), puis l'onboarding.
Avant de coder, deux décisions sont à prendre de ton côté :
1. **Emplacement du code** : nouveau dépôt dédié (recommandé) ou ce dépôt `discord-bot` ?
2. **Dates clés** : fin de saison N2, trêve hivernale, date exacte de l'ultra 80 km, date du Dodo Trail.
