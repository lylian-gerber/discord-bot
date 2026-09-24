# 8. Récupération, sommeil, renforcement et matériel

## 8.1 Recovery Center

Le coach choisit **1 à 3 actions**, jamais une liste exhaustive. Règles du moteur :

| Contexte | Actions prioritaires | Bain froid ? |
|---|---|---|
| Après match | Hydratation (150 % des pertes estimées), repas glucides + protéines < 1 h, sommeil | Possible si match dans < 72 h ; ressenti suivi |
| Après footing facile | Rien de spécial, repas normal | **Non** (inutile) |
| Après séance de force / côtes en bloc de développement | Protéines, sommeil | **Éviter dans les 4-6 h** : l'immersion froide peut atténuer les adaptations de force/hypertrophie |
| Après sortie longue | Glucides + protéines, marche 10-15 min, jambes surélevées, sommeil | Optionnel si match proche |
| Readiness < 50 | Sommeil, mobilité, marche, vélo très facile | |
| Dette de sommeil > 3 h | Coucher plus tôt, sieste 20 min | |

Principe clé : **la récupération « active » la plus efficace reste sommeil + nutrition**. Les outils (froid, compression, massage) viennent après et sont suivis par leur effet ressenti.

## 8.2 Tracker bain froid

Saisie : température, durée, moment (post-match, soir…), ressenti avant/après, **jambes le lendemain** (demandé automatiquement au check-in suivant).

Analyse (V2, après ≥ 8 bains) : comparaison du score « jambes » à J+1 avec vs sans bain froid dans des contextes comparables (même type de séance). Le coach présente le résultat honnêtement : « Chez toi, pas de différence nette pour l'instant (n = 9). »

## 8.3 Sommeil

Sources : saisie manuelle au check-in (MVP), puis Garmin / Whoop / Apple Health.

Affichage : heures, qualité, **dette sur 7 j** (déficits comptés intégralement, surplus à 50 %), moyenne 7 j.

Chaque soir : heure de coucher = réveil − besoin − latence (15 min) − bonus dette (≤ 45 min) − 15 min si grosse journée le lendemain. Exemple : réveil 7 h 00, besoin 8 h, pas de dette → « Couche-toi vers 22 h 45 ».

Post-match en soirée : l'app anticipe l'endormissement tardif (adrénaline, caféine) et décale l'objectif sur la sieste du lendemain.

## 8.4 Renforcement

Séances de 20-40 min, placées par le moteur :

- **Lourde** (split squat, RDL, step-up haut, mollets lourds, soléaire genou fléchi) : à ≥ MD-4 et ≥ MD+2 ; 3-4 × 4-6 reps, charge lourde, RIR 2.
- **Légère / prévention** (pied, cheville, soléaire, ischio nordique en volume faible, gainage, fessiers) : possible jusqu'à MD-2.
- **Excentrique de descente** (step-down lents) : introduit progressivement en phase trail, jamais la veille d'une séance clé.
- Progression : charge +2,5-5 % quand toutes les séries sont faites à RIR ≥ 2 ; allègement en semaine allégée ; muscu lourde retirée en affûtage.

Si le club a déjà une séance de muscu, l'app la **compte dans la charge** et ne duplique pas.

## 8.5 Matériel

- Inventaire : chaussures, montre, frontale, sac, flasques, bâtons, chaussettes, veste, lunettes.
- **Chaussures** : km = km initiaux + km des activités associées (auto via le `gear_id` Strava). Alertes à 70 % (« Commence à surveiller l'usure »), 85 % (« Prévois la relève »), 100 % de la durée de vie (700 km par défaut, ajustable par modèle et selon l'usure observée en photo).
- **Checklist automatique** (`gearChecklist`) selon durée, distance, nuit, météo, isolement :
  - < 75 min / 15 km : léger (chaussures, montre, téléphone)
  - ~30 km / > 2 h : gilet, eau, nutrition, électrolytes, veste
  - ~50 km / > 4 h : complet (+ couverture de survie, trousse, argent, bâtons)
  - nuit ou > 5 h : frontale + 2ᵉ batterie
  - ≥ 80 km : sac d'allègement + vérification du matériel obligatoire de l'organisation
- Cases à cocher dans le détail de la séance, notification la veille (« Sortie trail demain : prépare tes flasques »).

## 8.6 Plan de course (V3)

Entrées : GPX, ravitaillements, barrières horaires, météo, données de l'athlète (allure à FC seuil, durabilité, glucides/h tolérés, taux de sudation).

Sortie par tronçon (ravito à ravito) : distance, D+/D−, temps visé, stratégie marche/course (marche au-delà d'une pente seuil personnalisée, ~12-15 % au départ), glucides/eau/sodium, ce qu'on prend au ravito, changement de chaussures/vêtements, **zones critiques** (grosse descente après le km 60, passage de nuit, chaleur de midi).

Stratégie mentale : découpage en tronçons, mantras choisis par l'athlète, plan pour les moments bas prévisibles (nuit, km 60-75), règles de décision (« si nausée : ralentir, eau + salé, 15 min, puis reprendre à 30 g/h »).

## 8.7 Météo

Open-Meteo pour le lieu de la séance/course : température, ressenti, humidité, vent, pluie, UV. Ajustements automatiques : eau et sodium (`heatAdjustedSweatRate`), vêtements (checklist), allure (≥ 28 °C → effort ralenti de 5-10 %), **heure de départ** conseillée (éviter 12-16 h par forte chaleur). Pour Maurice : protocole d'acclimatation chaleur 10-14 jours avant (séances en conditions chaudes, sauna post-séance si pas d'accès à la chaleur).
