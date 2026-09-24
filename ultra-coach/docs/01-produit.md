# 1. Définition du produit

## 1.1 En une phrase

**Ultra Coach** est un coach d'endurance IA qui prépare un footballeur de National 2 à un ultra-trail de 100 km (juin/juillet 2027) **sans dégrader sa performance football**, en recalculant chaque jour ce qu'il doit faire, manger, boire et récupérer à partir de ce qu'il a réellement fait et ressenti.

## 1.2 Le problème réel

Les apps existantes sont bonnes sur un seul axe :

| App | Force | Ce qui manque pour ce profil |
|---|---|---|
| Strava | Enregistrement, social | Aucun plan, aucune notion de charge football |
| TrainingPeaks | Planification, charge (TSS) | Plan statique écrit par un humain, pas de football, pas de conversation |
| Garmin Connect | Données physiologiques | Coach générique (route), ignore le club |
| Whoop | Récupération / sommeil | Ne planifie rien |
| MyFitnessPal | Nutrition | Pas périodisée selon la charge |

**Aucune ne gère le conflit central de ce profil** : le football (5-7 h/sem, match le samedi, calendrier imposé par le club) consomme déjà une grosse partie de la capacité de récupération, et l'ultra demande du volume. L'app doit **arbitrer**, pas empiler.

## 1.3 Principe d'architecture produit : « le moteur décide, l'IA explique »

C'est la décision la plus importante du projet.

- **Moteur déterministe** (TypeScript pur, testé — `src/engine/`) : calcule la charge, le readiness, la durabilité, les besoins nutritionnels, le taux de sudation, place les séances autour des matchs, applique les garde-fous. Mêmes entrées → mêmes sorties, toujours.
- **LLM (Claude, avec vision)** : comprend le langage libre et les images, explique le *pourquoi*, converse, extrait des faits pour la mémoire, propose des ajustements **que le moteur valide** avant qu'ils touchent le plan.

Pourquoi : un LLM seul invente des chiffres, se contredit d'un jour à l'autre et peut être convaincu par l'utilisateur de faire n'importe quoi (« allez, 35 km demain ça passe »). Le moteur est la ceinture de sécurité.

## 1.4 Boucle quotidienne (cœur du produit)

```
MATIN (≤ 60 s)                         SOIR (≤ 3 min)
check-in 10 curseurs + texte libre     import Strava auto / capture
        │                               RPE + ressenti + ravitaillement
        ▼                                       │
readiness /100 + flags                          ▼
        │                               analyse IA de la séance
        ▼                               charge 7/28 j recalculée
séance du jour ADAPTÉE                  mémoire mise à jour
+ nutrition du jour + hydratation               │
        │                                       ▼
        └──────────── coach IA ◄──── plan de DEMAIN adapté + heure de coucher
```

## 1.5 Utilisateur cible

- **V1** : un seul athlète (toi). Ça simplifie énormément (pas de multi-tenant complexe, pas de validation Strava pour plusieurs athlètes, coûts IA maîtrisés).
- **V3** : athlètes hybrides (sport collectif + endurance), puis coachs/préparateurs physiques.

Le schéma de données est multi-utilisateur dès le départ (tout est rattaché à `userId`) pour ne rien réécrire plus tard.

## 1.6 Ce que l'utilisateur doit savoir en ouvrant l'app le matin

1. Comment il va → readiness + 4 sous-scores + flags
2. Ce qu'il doit faire → séance du jour (déjà adaptée)
3. Pourquoi → une phrase générée à partir des facteurs du moteur
4. Quoi manger / boire → cibles du jour + options de repas
5. Comment récupérer → 1 à 3 actions, pas une liste de 10
6. Quelle séance vient ensuite → demain + prochaine séance clé
7. Où il en est → timeline « Aujourd'hui → objectif », phase, semaine

## 1.7 Garde-fous (non négociables, codés dans le moteur)

| Situation | Comportement |
|---|---|
| Douleur thoracique, malaise, perte de connaissance, palpitations, gêne respiratoire, urines foncées après effort | Détection **avant** l'appel LLM (`safety.ts`). Réponse qui commence obligatoirement par : arrêter l'effort, appeler le 15/112 si en cours. Aucun conseil d'entraînement. |
| Douleur ≥ 7/10 | `blockRunning = true` : la course est retirée du plan, le LLM ne peut pas la réintroduire. Orientation vers un professionnel. |
| Douleur 5-6/10 | Séance sans impact ou fortement adaptée. |
| Suspicion de lésion (gonflement, craquement, boiterie, douleur osseuse localisée) | Orientation médecin/kiné/staff du club, jamais de diagnostic. |
| Photo de blessure / ampoule | Description prudente + soins de base généraux, jamais de diagnostic. |
| Demande d'augmentation brutale (« 30 km demain ») | Le moteur plafonne (sortie longue +20 min/sem, volume +10 %/sem). Le coach explique le refus et propose l'alternative. |
| Déficit calorique un jour de grosse charge | Interdit par le moteur. |
| Énergie disponible < 30 kcal/kg MM | Alerte RED-S. |
| Prise de poids pendant l'effort | Alerte hyponatrémie (trop boire est aussi dangereux). |

## 1.8 Réalité terrain — ce que l'app doit dire franchement

Le moteur a été lancé sur ton cas (départ 24/09/2026, course fin juin 2027, 100 km / 4 500 D+, fin de saison N2 ~22 mai). Constats :

1. **Finir un 100 km en ~9 mois depuis une base football est réaliste. Viser un chrono ambitieux, non.** Un footballeur N2 a un moteur aérobie correct et de la vitesse, mais ni les tendons, ni les quadriceps en excentrique, ni le tube digestif d'un ultra-traileur. Ces adaptations sont lentes.
2. **Le vrai goulot d'étranglement, c'est la saison de football, pas le temps.** En saison, le volume course réaliste plafonne autour de **3,5-4,5 h/sem** et la sortie longue autour de **2 h 30** (au-delà, tu arrives cramé au match). La fenêtre de gros volume n'existe qu'à la **trêve** (fin déc.) et **après la fin de saison** (fin mai), soit ~3 semaines chargées avant l'affûtage. C'est court. Le moteur le signale (`macroWarnings`).
3. **Jeudi = MD-2.** C'est un bon jour pour une séance de *qualité* courte (tempo, progressif, côtes), mais **pas pour une sortie longue avec beaucoup de descente** : l'excentrique de la descente est exactement ce qui dégrade les jambes pour le match du samedi. La sortie longue en saison se place mieux en **début de semaine (MD+2 / MD+3)**, quitte à doubler avec un foot léger le soir, ou le dimanche si tu as peu joué.
4. **Parle-en au préparateur physique du club.** Ajouter 3-4 h de course par semaine modifie ta charge totale ; si le staff l'ignore, il peut te surcharger sans le savoir. L'app peut exporter un résumé hebdo de charge à lui transmettre.
5. **Si ton objectif est la performance plutôt que le finish**, une course en septembre/octobre 2027 te donnerait tout l'été hors saison pour construire. À considérer honnêtement. Si tu gardes juin/juillet, vise un **objectif intermédiaire** : un trail de 40-60 km pendant la trêve ou au printemps (hors week-end de match) pour tester nutrition et matériel.
6. **Dodo Trail (Maurice)** : vérifie la date et le format exacts de l'édition visée avant de l'intégrer au plan (priorité A/B/C). Chaleur et humidité tropicales = protocole d'acclimatation et d'hydratation spécifique.

Ces avertissements ne sont pas là pour décourager : un plan qui ment sur sa faisabilité produit soit une blessure, soit un abandon au km 60.
