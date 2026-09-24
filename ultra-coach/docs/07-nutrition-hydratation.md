# 7. Module nutrition et hydratation

Implémentation : `src/engine/nutrition.ts`, `hydration.ts`, `gutTraining.ts`.

## 7.1 Profil nutritionnel (onboarding)

Poids, taille, âge, sexe, % de masse grasse (optionnel, pour l'énergie disponible), objectif de poids, habitudes, aliments aimés/détestés, allergies, budget hebdo, nombre de repas.

## 7.2 Besoins quotidiens périodisés

**Dépense** = Mifflin-St Jeor × 1,35 (activité hors sport) + dépense des séances (mesurée par Strava/montre, sinon estimée).

**Glucides par type de journée** (g/kg/j — Burke 2011, position ACSM 2016) :

| Type de journée | g/kg | Exemple 75 kg |
|---|---|---|
| Repos | 3-4 | ~260 g |
| Légère | 4-5 | ~340 g |
| Modérée | 5-7 | ~450 g |
| Dure | 6-8 | ~525 g |
| Veille de match | 6-8 | ~525 g |
| Match | 6-8 | ~525 g |
| Sortie longue | 7-9 | ~600 g |
| Très longue / back-to-back | 8-10 | ~675 g |
| Charge glucidique (36-48 h avant ultra) | 10-12 | ~825 g |

**Protéines** : 1,8 g/kg (2,0 g/kg si objectif de perte de poids). **Lipides** : le reste, **minimum 0,8 g/kg**. **Eau** : 35 ml/kg + 80 % des pertes sudorales de la journée. **Sodium** : ~2 g + pertes à l'effort.

**Garde-fous** : aucun déficit un jour dur/de match ; déficit plafonné à −500 kcal ; perte max 0,5 kg/sem ; énergie disponible < 30 kcal/kg MM → alerte RED-S.

Le type de journée est déduit automatiquement du plan (séance la plus exigeante + proximité du match) et recalculé si la séance est adaptée.

## 7.3 Plan de repas

Créneaux : petit-déjeuner, déjeuner, collation, pré-entraînement, pendant, post-entraînement, dîner, collation du soir. `distributeMeals` répartit les macros selon les créneaux actifs (les glucides consommés pendant l'effort sont retranchés).

Pour chaque créneau, **2-3 options** (A/B/C) générées à partir d'une base d'aliments (Ciqual/ANSES) + goûts/allergies/budget, avec quantités, kcal, G/P/L :

```
Petit-déjeuner A : 90 g flocons d'avoine + 1 banane + 15 g miel + 200 g yaourt grec
                   ≈ 690 kcal · G 110 · P 30 · L 12
Petit-déjeuner B : 120 g pain complet + 3 œufs + 1 fruit
                   ≈ 640 kcal · G 80 · P 30 · L 18
```

Génération : le **moteur** fixe les cibles, un **solveur simple** (combinaisons de recettes de base ajustées en quantités) atteint ±10 % des cibles ; le LLM ne sert qu'à varier et formuler. Pas de calculs de macros par le LLM.

## 7.4 Photo de repas

Estimation en fourchette, puis conseil **lié au plan** : « Grosse séance demain : ajoute ~80 g de glucides (riz, pain) ce soir. » / « Très bon repas de récupération. » L'écart estimé vs cible du jour est affiché, jamais présenté comme exact.

## 7.5 Hydratation

**Test de sudation** : poids avant/après (nu, sec), boissons, urines éventuelles, durée → taux de sudation (L/h) et % de perte de poids.

- Perte > 2 % → performance probablement affectée ; > 3 % → déshydratation notable.
- **Prise de poids pendant l'effort → alerte hyponatrémie** (boire trop est dangereux sur ultra).

**Plan à l'effort** (`drinkPlan`) : remplacer 65-75 % des pertes, **jamais plus que le taux de sudation**, plafond 1 L/h ; correction chaleur (~+8 %/°C au-dessus de 20 °C, + humidité). Sodium : ~60 % des pertes pour les efforts > 2 h (900 mg/L par défaut tant qu'aucun test de sueur n'est fait).

Rappels du jour (« Bois 400 ml avant 16 h ») générés à partir de la cible et de l'heure de la séance.

## 7.6 Entraînement du ventre (nutrition ultra)

Paliers : **30 → 40 → 50 → 60 → 70 → 80 → 90 g/h**. Au-delà de 60 g/h, mélange glucose + fructose obligatoire.

Après chaque sortie ≥ 75 min : produits consommés (gels, boissons, compotes, fruits, barres, salé) + symptômes 0-10 (nausée, ballonnement, faim, écœurement, crampes, diarrhée, vomissement).

Règles (`nextGutTarget`) : 2 sorties bien tolérées (score ≤ 3) au palier → palier suivant ; symptômes ≥ 6 → palier précédent ; palier non atteint → on le retente. Un produit associé 2 fois à des symptômes ≥ 5 passe en « à éviter » et devient une mémoire du coach. La faim n'est pas une intolérance (c'est un signe de sous-alimentation).

Objectif réaliste pour juin 2027 : **70-90 g/h tolérés** sur 4-5 h, testés en simulation avec les produits de la course.
