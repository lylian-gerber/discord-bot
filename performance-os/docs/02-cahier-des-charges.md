# 2. Cahier des charges fonctionnel

Convention : **[MVP]** = première version ; **[V2]** = plus tard. Priorité : P0 (bloquant), P1 (important), P2 (confort).

## 2.0 Acteurs

- **Athlète** : saisit, consulte, valide, discute avec le coach IA.
- **Staff** (prépa physique, coach, kiné, nutritionniste), optionnel : consulte, commente, valide ou refuse les séances clés. [V2]
- **Moteur** : calcule et adapte.
- **Coach IA** : explique, répond, propose.

## 2.1 Onboarding — P0 [MVP]

- Profil : date de naissance, sexe, taille, poids, poids cible, poste, FC max/repos si connues.
- Template football hebdo pré-rempli (lun léger, mar modéré, mer intense, jeu off, ven veille de match, sam match, dim repos), modifiable, avec horaires habituels.
- Heure de lever habituelle, contraintes (travail/études), jours indisponibles.
- Objectifs : ultra 80 km (date, D+ si connu), Dodo Trail (date, distance, D+), maintien N2.
- Niveau trail actuel : plus longue sortie récente, volume des 4 dernières semaines.
- Préférences alimentaires : aliments non aimés, allergies, régime, budget. Caféine (oui/non, heure limite).
- Historique de blessures (texte libre + zones) : sert uniquement à la prudence, jamais à un diagnostic.
- Calendrier des matchs : saisie ou import (fichier .ics).

## 2.2 Tableau de bord — P0 [MVP]

Scores :
- forme du jour /100 (+ zone couleur + tendance 7 j) ;
- récupération /100 ;
- sommeil /100.

Charge :
- charge 7 j vs 28 j, ratio, variation vs semaine précédente ;
- fatigue musculaire (issue du check-in + charge excentrique trail récente) ;
- risque de surcharge (faible / modéré / élevé, avec la raison).

À venir :
- prochaine séance ;
- prochain match (compte à rebours J-x) ;
- volume trail et D+ prévus cette semaine.

Besoins du jour : sommeil recommandé (heure de coucher), eau (L), kcal, glucides / protéines / lipides, sodium.

Dernière séance : type, durée, km, D+, FC moy, kcal, RPE, charge.

Bloc **« Ce que tu dois faire aujourd'hui »** : de 5 à 8 actions maximum, cochables, générées par le moteur et rédigées par l'IA.

Alertes actives, en bandeau, triées par sévérité.

## 2.3 Check-in matinal — P0 [MVP]

- Sliders 1–10 : qualité de sommeil, fatigue générale, fatigue des jambes, courbatures, motivation, stress.
- Heures de coucher / lever (pré-remplies depuis la montre si dispo).
- Douleur : oui/non. Si oui : zone (silhouette cliquable), côté, intensité 0–10, depuis quand, type (sourde, aiguë, articulaire, musculaire).
- FC repos et HRV (facultatifs, auto si montre).
- Moins de 45 secondes pour remplir.
- Rappel push si non rempli à H+1 après le lever habituel.

## 2.4 Saisie des séances — P0 [MVP]

- Types : entraînement foot, match, trail, footing route, renforcement, mobilité, récupération, autre.
- Champs communs : date/heure, durée, RPE 1–10 (échelle CR-10), notes.
- Foot : intensité perçue, contenu (optionnel).
- Match : minutes jouées, titulaire/remplaçant, adversaire, domicile/extérieur, heure du coup d'envoi.
- Trail : km, D+, D−, FC moy/max, terrain, technicité 1–5, météo, nutrition consommée (journal gels / boissons / aliments), questionnaire digestif.
- Renfo : exercices, séries, reps, charges.
- Import `.FIT`/`.GPX` [MVP], sync montres [V2].
- Demande de RPE 30 min après la fin (notification) si pas encore saisi.

## 2.5 Planificateur hebdomadaire — P0 [MVP]

- Vue de la semaine avec les séances prévues (foot fixes + trail + renfo + récup).
- Chaque séance affiche : objectif, durée, distance, D+ cible, zone d'intensité (RPE / FC), consignes, nutrition d'effort si ≥ 75 min.
- Génération automatique chaque dimanche (voir doc 6), régénérable à la demande.
- Séances clés (sortie longue, séance D+, back-to-back) marquées « à valider ».
- Historique des versions : on garde l'original et l'ajusté, avec la raison de chaque modification.

## 2.6 Adaptation automatique — P0 [MVP]

- Chaque jour, la séance prévue est réévaluée après le check-in (matrice de décision, doc 4).
- Actions possibles : maintenir, augmenter légèrement (+5 à 10 %, jamais plus), réduire, convertir en récupération, supprimer, décaler.
- Chaque modification est expliquée en une phrase et peut être annulée par l'athlète. Les garde-fous (hard rules) ne sont jamais contournables.
- Semaine allégée automatique toutes les 3 à 4 semaines, plus des allègements déclenchés (fatigue cumulée).

## 2.7 Nutrition — P0 [MVP] (plans de repas détaillés P1)

- Calcul quotidien : kcal, glucides, protéines, lipides, eau, sodium, selon le type de journée (doc 5).
- Plan de repas : petit-déj, collation, déjeuner, pré-training, pendant l'effort, post-training, dîner, collation du soir. Chaque repas affiche kcal, G, P, L et eau.
- Alternatives par équivalence glucidique (riz ↔ pâtes ↔ pommes de terre ↔ semoule ↔ pain…), en respectant les aliments exclus.
- Journal rapide : « plan suivi » / « partiellement » / « autre », avec saisie libre analysée par l'IA.
- Liste de courses hebdomadaire agrégée par rayon. [P1]
- Poids : tendance lissée sur 7 jours, ajustement calorique plafonné (doc 5).

## 2.8 Jour de match — P0 [MVP]

- Saisir l'heure du coup d'envoi génère la timeline complète : repas, collations, hydratation, échauffement, mi-temps, post-match, dîner.
- Quantités chiffrées, calculées sur le poids de l'athlète.
- La veille : plan de charge glucidique et coucher recommandé.
- Le lendemain (J+1) : protocole de récupération.

## 2.9 Hydratation — P1 [MVP]

- Test de sudation : poids avant/après, volume bu, urine (optionnel), durée, température. Calcul du taux de sudation.
- Historique des tests et taux moyen par contexte (foot / trail / chaleur).
- Recommandations par heure (eau + sodium) pour entraînement, match et trail.
- Rappels : « Bois 500 ml dans les 2 prochaines heures », selon l'écart entre l'objectif du jour et la consommation saisie. Fréquence plafonnée (4 max par jour).

## 2.10 Module ultra-trail — P0 [MVP]

- Indicateurs :
  - plus longue sortie (km, durée) ;
  - D+ max en une sortie ;
  - temps max sur les jambes ;
  - volume hebdo (temps, km, D+) ;
  - moyenne sur 4 semaines ;
  - glucides max tolérés par heure.
- Jalons progressifs (10 → 80 km). Un jalon n'est validé que si les critères associés sont remplis (durée, D+, récupération à J+2 correcte), pas seulement la distance.
- Courbe de progression prévue vs réalisée jusqu'à juin 2027.
- Compteurs : semaines restantes avant chaque objectif, phase actuelle.

## 2.11 Nutrition ultra / entraînement digestif — P1 [MVP]

- Journal nutrition pendant la sortie (produit, heure, glucides, sodium, liquide) avec une bibliothèque de produits perso (gels, boissons, barres, compote, banane, salé).
- Calcul automatique des g/h réels.
- Questionnaire post-sortie : aucun, ballonnements, nausées, douleurs, envie de vomir, diarrhée, faim, écœurement, plus la sévérité 0–10.
- Palier cible g/h mis à jour automatiquement pour la prochaine sortie longue (doc 5).
- Plan de ravitaillement généré pour chaque sortie ≥ 90 min (quoi prendre, à quelle minute).

## 2.12 Sommeil — P0 [MVP]

- Heure de coucher et de réveil recommandées (selon la charge du jour, le lendemain et le lever imposé).
- Sommeil réel, moyenne 7 j, dette de sommeil (sur 14 j glissants).
- Conseils contextuels (caféine, repas du soir, routine, chambre fraîche, lumière), limités à 1 ou 2 par jour.
- Une mauvaise nuit est prise en compte dans l'adaptation de la séance.

## 2.13 Récupération — P1 [MVP]

- Recommandations du jour : mobilité, récupération active, massage/auto-massage, bain froid, sommeil, hydratation, nutrition.
- Décision bain froid (oui / non / facultatif) avec la raison (doc 4).
- Journal : type, température de l'eau, durée, sensation avant/après.
- Routines mobilité guidées de 10, 15 ou 20 min (liste d'exercices avec durées).

## 2.14 Charge d'entraînement — P0 [MVP]

- Charge = RPE × durée (sRPE), séparée foot / trail / renfo, plus le total.
- Charge quotidienne, hebdo, moyenne 4 semaines, semaine N vs N-1.
- Ratio aigu/chronique, monotonie, contrainte (strain).
- Alertes (doc 4).
- Graphes : barres empilées par domaine, courbe 7 j / 28 j.

## 2.15 Renforcement — P1 [MVP]

- 1 à 2 micro-séances de 20 à 30 min par semaine, placées par le moteur à J-4 / J-5 minimum avant le match.
- Bibliothèque : Bulgarian split squat, step-up, fentes, RDL, mollets tendus / genou fléchi, gainage, pied/cheville, ischios (Nordic, pont), fessiers.
- Progression : séries, reps et charge, avec une consigne de RPE (renfo à RPE ≤ 7 en saison).
- Jamais la veille ni le surlendemain d'un match. Pas de bain froid juste après.

## 2.16 Coach IA — P0 [MVP]

- Chat en langage naturel, en français, avec le contexte complet (doc 8).
- Extraction automatique : « J'ai joué 90 min hier » propose d'enregistrer le match (confirmation en un tap).
- Réponses fondées sur les données, avec citation des chiffres utilisés.
- Propositions de modification de plan soumises à validation, puis contrôlées par les garde-fous.
- Garde-fous santé stricts (doc 8).

## 2.17 Calendrier — P0 [MVP]

- Vue mois / semaine, codes couleur : Football, Match, Trail, Repos, Renforcement, Récupération, Objectif.
- Glisser-déposer d'une séance : le moteur vérifie les contraintes, recalcule le reste de la semaine et affiche l'impact avant de confirmer.
- Import .ics du calendrier de matchs.

## 2.18 Alertes intelligentes — P0 [MVP]

Catalogue initial (déclencheurs détaillés doc 4) :
- hausse de charge trop rapide ;
- match demain, donc pas de trail ;
- sommeil insuffisant, donc séance remplacée ;
- nutrition d'effort sous la cible ;
- sudation élevée / chaleur ;
- douleur persistante, donc orientation vers un professionnel ;
- check-in manquant ;
- dette de sommeil ;
- semaine monotone.

Chaque alerte a une sévérité (info / attention / critique), une action proposée et un bouton « compris ».

## 2.19 Objectifs — P0 [MVP]

- Objectif A : ultra 80 km (juin 2027), terminer.
- Objectif A' : Dodo Trail 2027, performer.
- Objectif permanent : performance football N2. C'est une **contrainte dure** : le trail s'adapte au foot, jamais l'inverse en saison.
- Tableau de bord des objectifs : progression, jalons, semaines restantes, niveau de confiance (basé sur la compliance et la progression réelle).

## 2.20 Staff — P2 [V2]

- Invitation d'un membre du staff avec un rôle.
- File de validation des séances clés.
- Commentaires sur les séances et les semaines.
- Lecture seule sur les données santé, selon les permissions choisies par l'athlète.

## 2.21 Exigences non fonctionnelles

- Mobile-first, utilisable à une main. Check-in en moins de 45 s.
- Mode sombre par défaut, contraste AA minimum.
- Dashboard chargé en moins de 1,5 s en 4G.
- Hors ligne (PWA) : check-in et saisie de séance mis en file d'attente et synchronisés ensuite.
- Toutes les recommandations sont traçables : pourquoi, et avec quelles données.
- Mentions claires : l'app ne remplace pas un médecin, un kiné ou un diététicien.
