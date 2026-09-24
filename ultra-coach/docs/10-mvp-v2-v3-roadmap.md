# 10. MVP, V2, V3 et roadmap semaine par semaine

## 10.1 Principe de découpage

L'app doit être **utile pour ton entraînement dès la semaine 2**, pas dans 4 mois : ta préparation a déjà commencé. Chaque semaine livre quelque chose d'utilisable. Hypothèse : un développeur, ~10-15 h/semaine, avec Claude Code.

## 10.2 MVP — « je sais quoi faire chaque jour » (semaines 1-6)

| Inclus | Exclu (volontairement) |
|---|---|
| Auth, onboarding, profil, semaine football éditable | Plans de repas détaillés |
| Macrocycle + timeline + plan hebdo généré par le moteur | Photo de repas |
| Check-in matin → readiness → séance adaptée | Garmin / Apple / Whoop |
| Saisie manuelle foot/match/muscu + RPE | Plan de course |
| **Strava** (OAuth, webhook, streams) | Tests structurés |
| Charge 7/28 j, alertes, graphique | Mémoire éditable |
| Analyse IA de séance + comparaison + durabilité | Notifications avancées |
| **Chat coach** avec snapshot + outils de base + garde-fous | App native |
| Captures d'activités (extraction + confirmation) | |
| Cibles nutrition/hydratation du jour (chiffres) | |
| Sommeil manuel + heure de coucher | |
| PWA installable + push de base (séance du lendemain) | |

**Critère de sortie** : pendant 2 semaines, tu ouvres l'app chaque matin et chaque soir, et tu ne consultes plus rien d'autre pour savoir quoi faire.

## 10.3 V2 — « coach complet » (semaines 7-14, trêve incluse)

Nutrition complète (plans A/B/C, photo de repas, journal) · entraînement du ventre + symptômes · hydratation (test de sudation, plan ml/h) · Recovery Center + bain froid · renforcement guidé · Gear + checklists · tests + recalibrage des zones · dashboard Progrès complet · **mémoire sportive** + page « Ce que le coach sait de moi » · Whoop et/ou Raccourci iOS pour Apple Health · notifications intelligentes · jeu d'évaluation IA en CI · export charge pour le staff du club.

## 10.4 V3 — « jour de course et au-delà » (semaines 15-28)

Plan de course (GPX, ravitos, tronçons, nutrition, mental) · météo course + acclimatation chaleur (Maurice) · simulations de course guidées · app native Expo (HealthKit, notifications fiables iOS) · Garmin Connect direct (si accès accordé) · calibrage personnalisé des poids du readiness · motifs statistiques (récupération par type de match, effet du froid) · multi-utilisateurs + mode coach/préparateur · (optionnel) recherche sémantique dans la mémoire.

## 10.5 Roadmap détaillée

Semaine 1 = lundi 28/09/2026.

| Sem. | Dates | Livrable | Utilisable pour toi |
|---|---|---|---|
| **1** | 28/09 | Monorepo pnpm (web, worker, engine, db, ai) ; Next.js + Tailwind + shadcn ; Postgres Neon + migration Prisma ; auth ; CI (lint, typecheck, tests moteur) ; déploiement Vercel/Railway | — |
| **2** | 05/10 | Onboarding + profil + semaine football type ; génération macrocycle + timeline ; plan hebdo | **Oui : plan de la semaine** |
| **3** | 12/10 | Check-in matin → readiness → adaptation de la séance ; écran Aujourd'hui ; saisie manuelle + RPE ; charge 7/28 j + alertes | **Oui : boucle du matin** |
| **4** | 19/10 | Strava : OAuth, webhook, import activité + streams, historique 12 sem. ; worker pg-boss ; durabilité | Oui : import auto |
| **5** | 26/10 | Package `ai` : client Claude, prompt système v1, snapshot, outils de base, garde-fous ; chat streamé ; analyse IA post-séance + comparaison | **Oui : coach IA** |
| **6** | 02/11 | Captures d'activités (vision) ; cibles nutrition/hydratation ; sommeil + heure de coucher ; PWA + push ; job du soir « adapter demain » ; **stabilisation MVP** | **MVP complet** |
| **7** | 09/11 | Plans de repas A/B/C (base Ciqual, solveur) ; journal repas | |
| **8** | 16/11 | Photo de repas ; conseils liés au plan | |
| **9** | 23/11 | Ravitaillement + symptômes + progression g/h ; test de sudation + plan ml/h | Avant la trêve |
| **10** | 30/11 | Mémoire sportive (extraction, règles, page d'édition) ; jeu d'évaluation IA en CI | |
| **11** | 07/12 | Recovery Center + bain froid ; renforcement guidé | |
| **12** | 14/12 | Gear + km chaussures + checklists ; Whoop ou Raccourci Apple Santé | Bloc trail de la trêve |
| **13** | 21/12 | (trêve — priorité à l'entraînement) corrections, retours d'usage | |
| **14** | 28/12 | Tests + recalibrage des zones ; dashboard Progrès complet ; export staff ; **fin V2** | |
| **15-16** | 04/01 → 17/01 | Notifications intelligentes ; motifs statistiques ; perf/accessibilité | |
| **17-19** | 18/01 → 07/02 | App Expo (HealthKit, push natif) ; partage du code `engine`/`ai` | |
| **20-22** | 08/02 → 28/02 | Plan de course (GPX, tronçons, ravitos, nutrition, matériel, mental) | |
| **23-24** | 01/03 → 14/03 | Météo course + acclimatation ; simulations guidées | |
| **25-26** | 15/03 → 28/03 | Garmin direct (si accès obtenu) ; calibrage personnalisé du readiness | |
| **27-28** | 29/03 → 11/04 | Durcissement : sécurité, RGPD (export/suppression), sauvegardes, monitoring coût IA | |
| — | avril → juin | **Gel des fonctionnalités** : uniquement corrections. Ta priorité est la fin de saison et le pic d'entraînement. | Course fin juin |

## 10.6 Risques principaux

| Risque | Impact | Parade |
|---|---|---|
| Le dev de l'app mange le temps d'entraînement/sommeil | Élevé | Le plan d'entraînement n'attend pas l'app : suis dès maintenant le macrocycle généré ; limite le dev à des créneaux fixes |
| Conditions Strava (IA, multi-utilisateurs) | Moyen (perso) / Élevé (produit) | Usage personnel ; relire les conditions avant toute ouverture |
| Accès Garmin/Coros refusé ou lent | Faible | Strava comme hub ; demander l'accès tôt |
| Coût IA | Moyen | Cache, effort par route, Batch pour le nocturne, suivi du coût/jour |
| Recommandations IA erronées | Élevé | Moteur déterministe + garde-fous + évals en CI + l'utilisateur confirme toute modification |
| Readiness mal calibré au début | Moyen | Afficher les facteurs, recalibrer après 6-8 semaines de données |
