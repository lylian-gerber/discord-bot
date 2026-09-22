# 5. Logique nutrition & logique hydratation

Implémentation : `packages/core/nutrition`, `packages/core/hydration`, `packages/core/ultra/fueling`.
Les fourchettes s'appuient sur les consensus de nutrition sportive (IOC 2018, ISSN, ACSM/AND 2016). Ce sont des **points de départ** que l'app individualise ensuite avec ton poids, ta tolérance et tes retours. Ça ne remplace pas un diététicien du sport, et c'est d'ailleurs le type de profil à inviter comme « staff ».

**Exemple chiffré utilisé dans tout le document : athlète de 75 kg, 180 cm, 23 ans.** Toutes les valeurs sont recalculées avec ton vrai profil.

---

## PARTIE A — NUTRITION

### A.1 Type de journée

Le type de journée dépend de la séance la plus exigeante du jour **et** de ce qui vient le lendemain :

| Type (`DayType`) | Cas typique |
|------------------|-------------|
| `REST` | Dimanche sans séance, jeudi sans trail |
| `LIGHT` | Lundi (foot récup), footing ≤ 45 min |
| `MODERATE` | Mardi, trail 60–90 min facile |
| `HARD` | Mercredi, trail 90–150 min |
| `PRE_MATCH` | Vendredi (veille de match) |
| `MATCH` | Samedi |
| `POST_MATCH` | Dimanche après ≥ 60 min jouées |
| `LONG_TRAIL` | Sortie ≥ 150 min |
| `BACK_TO_BACK` | 2 sorties longues consécutives (mai) |

Veille de sortie longue ≥ 3 h : le type passe au niveau supérieur (+1 g/kg de glucides).

### A.2 Macros par type de journée (g/kg/jour)

| Type | Glucides | Protéines | Lipides (plancher) |
|------|----------|-----------|--------------------|
| REST | 3–4 (3,5) | 1,8 | ≥ 0,8 |
| LIGHT | 4–5 (4,5) | 1,8 | ≥ 0,8 |
| MODERATE | 5–6 (5,5) | 1,8 | ≥ 0,8 |
| HARD | 6–7 (6,5) | 1,8 | ≥ 0,8 |
| PRE_MATCH | 6–8 (7) | 1,8 | ≥ 0,8 (repas du soir pauvre en fibres) |
| MATCH | 6–8 (7) | 1,8 | ≥ 0,8 |
| POST_MATCH | 5–7 (6) | 2,0 | ≥ 0,8 |
| LONG_TRAIL (2 h 30–4 h) | 7–9 (8) | 1,8 | ≥ 0,8 |
| LONG_TRAIL (> 4 h) / BACK_TO_BACK | 8–10 (9) | 2,0 | ≥ 0,8 |

Les glucides consommés **pendant** l'effort comptent dans le total du jour.

**Protéines** : réparties en 4 à 5 prises de 0,3–0,4 g/kg (≈ 25–35 g), plus 30–40 g de protéines « lentes » avant le coucher (fromage blanc, skyr) les jours de grosse charge.

### A.3 Énergie totale

```
Métabolisme de repos (Mifflin-St Jeor, homme) = 10·poids + 6,25·taille − 5·âge + 5
Dépense hors sport = MR × 1,4                       (paramètre selon mode de vie)
Dépense des séances = kcal montre, sinon MET × poids × heures
   MET défaut : foot léger 5, modéré 7, intense 8,5, match 9,
                trail facile 8 (+ 1 par tranche de 50 m D+/h au-delà de 300 m), renfo 5
Dépense totale estimée (TDEE) = dépense hors sport + séances

Glucides (g) = coef_G × poids   → kcal = ×4
Protéines (g) = coef_P × poids  → kcal = ×4
Lipides (g) = max(0,8 × poids, (TDEE − kcal_G − kcal_P) / 9)
Total kcal = somme
```

Exemple (75 kg), **mercredi, grosse séance 100 min** :
- MR = 1 765 → ×1,4 = 2 471 ; séance ≈ 1 060 kcal ; TDEE ≈ 3 530 kcal.
- Glucides 6,5 × 75 = **488 g** ; protéines 1,8 × 75 = **135 g** ; lipides = (3 530 − 1 952 − 540) / 9 ≈ **115 g**.

**Objectif de poids** :
- Tendance = moyenne mobile du poids sur 7 jours (le poids d'un seul jour ne sert à rien).
- Perte visée : déficit de **300 kcal maximum**, appliqué **uniquement** les jours REST / LIGHT / MODERATE, en retirant d'abord sur les lipides. Jamais de déficit les jours HARD, PRE_MATCH, MATCH, POST_MATCH ou LONG_TRAIL.
- Vitesse plafonnée à −0,5 % du poids par semaine. Au-delà, le moteur remonte automatiquement les apports.
- **Alerte faible disponibilité énergétique (RED-S)** : si `(apports − dépense des séances) / masse maigre < 30 kcal/kg` sur 5 jours ou plus, alerte + recommandation de consulter un professionnel. Si le % de masse grasse n'est pas connu, la masse maigre est estimée (et c'est signalé comme estimation).

### A.4 Répartition dans la journée

Gabarit pour une séance de foot le soir (≈ 19 h). Le moteur décale selon l'horaire réel.

| Créneau | Heure type | Part des glucides | Protéines | Remarques |
|---------|-----------|-------------------|-----------|-----------|
| Petit-déjeuner | 07:30 | 20–25 % | 25–30 g | |
| Collation matin | 10:30 | 5–10 % | 10–15 g | facultatif les jours REST |
| Déjeuner | 12:30 | 20–25 % | 30–35 g | |
| Pré-training | H−1 h 30 | 10–15 % | faible | pauvre en fibres et en graisses |
| Pendant | — | 30–60 g/h si > 75 min | — | foot intense ou trail |
| Post-training | fin +30 min | 1–1,2 g/kg | 0,3–0,4 g/kg | |
| Dîner | ~21:00 | 15–20 % | 30–35 g | |
| Collation soir | coucher −45 min | — | 30–40 g | jours HARD+ |

### A.5 Génération des repas

1. **Bibliothèque de gabarits de repas** (~60 au départ) : chaque gabarit a un créneau, des composants (féculent, protéine, légume, matière grasse, fruit, laitage) et des tags (`PRE_MATCH_OK`, `LOW_FIBER`, `QUICK`, `PORTABLE`).
2. **Filtrage** : aliments exclus (préférences, allergies), créneau, contraintes du jour (ex. veille de match → pauvre en fibres le soir).
3. **Rotation** : pas le même déjeuner deux jours d'affilée ; au moins 3 sources de protéines différentes par semaine.
4. **Mise à l'échelle** : la portion de féculent est ajustée pour atteindre les glucides du créneau, la protéine pour atteindre les protéines ; les lipides ajustent l'énergie.
5. **Arrondis pratiques** : pâtes / riz par pas de 10 g cru, pain par tranche, fruits à l'unité.
6. **Contrôle** : écart total ≤ 5 % sur glucides et protéines, sinon on réajuste le dernier créneau.
7. **Alternatives** : pour chaque féculent, 3 équivalents de même quantité de glucides.

**Table d'équivalence glucidique (≈ 60 g de glucides, valeurs indicatives, à caler sur CIQUAL à l'implémentation)** :

| Aliment | Quantité |
|---------|----------|
| Pâtes (cru) | ~85 g |
| Riz (cru) | ~77 g |
| Semoule (crue) | ~83 g |
| Quinoa (cru) | ~100 g |
| Pommes de terre (cuites) | ~350 g |
| Patate douce (cuite) | ~300 g |
| Pain (baguette) | ~110 g |
| Flocons d'avoine | ~100 g |

Exemple : « je n'aime pas le riz ». Le riz est exclu de toutes les générations, et chaque repas qui en contenait est construit avec pâtes, semoule, pommes de terre ou pain à glucides équivalents.

### A.6 Liste de courses hebdomadaire

- Agrégation des grammes crus de tous les `MealPlanItem` de la semaine S+1.
- Conversion en unités d'achat (paquet de 500 g, barquette, pièce) et arrondi supérieur.
- Regroupement par rayon (féculents, fruits & légumes, frais, protéines, épicerie, nutrition d'effort).
- Déduction des produits « en stock » cochés par l'athlète (placard).
- Ajout automatique des produits d'effort nécessaires (gels, boissons) selon les sorties longues prévues.

---

## PARTIE B — JOUR DE MATCH

### B.1 Règles (K = heure du coup d'envoi, P = poids)

| Moment | Horaire | Contenu |
|--------|---------|---------|
| Veille | — | Glucides 7 g/kg, dîner riche en féculents, pauvre en fibres et en graisses ; coucher recommandé (doc 4) |
| Petit-déjeuner | K − 8 h (au plus tôt au lever) | 1–1,5 g/kg de glucides + 25–30 g de protéines |
| Repas d'avant-match | K − 4 h 30 à K − 3 h 30 | 1,5–2 g/kg de glucides, ~0,3 g/kg de protéines, peu de graisses et de fibres, rien de nouveau |
| Hydratation | K − 4 h → K − 2 h | 5–7 ml/kg (≈ 400–500 ml) ; +3–5 ml/kg si urines foncées |
| Collation | K − 1 h 30 | 30–50 g de glucides faciles (banane, compote, pain d'épices, barre) |
| Pré-échauffement | K − 45 min | 200–300 ml d'eau ou de boisson électrolytes |
| Pendant | arrêts de jeu | petites gorgées selon la chaleur |
| Mi-temps | K + 45 | 300–500 ml + 20–30 g de glucides (boisson d'effort ou gel) |
| Post-match | fin + 30 min | 1–1,2 g/kg de glucides + 0,3–0,4 g/kg de protéines ; boire 1,25–1,5 L par kg perdu sur 2–4 h, avec du sodium |
| Dîner | fin + 2 h à 3 h | 1,5 g/kg de glucides + 0,4 g/kg de protéines + légumes |
| Avant coucher | — | 30–40 g de protéines (fromage blanc / skyr) |

Si K − 4 h 30 tombe avant 11 h (match tôt), le petit-déjeuner et le repas d'avant-match fusionnent en un brunch à K − 4 h, suivi d'une collation à K − 2 h.

### B.2 Exemple : match à 17 h, 75 kg

| Heure | Quoi | Environ |
|-------|------|---------|
| 09:00 | 120 g de pain + 20 g de miel ou confiture + 1 banane + 150 g de skyr + 300 ml d'eau | ~100 g G / 25 g P |
| 12:30 | 150 g de pâtes (cru) + 120 g de poulet ou poisson blanc + carottes cuites + 50 g de pain + filet d'huile d'olive + 500 ml d'eau | ~130 g G / 35 g P |
| 13:00–15:00 | 400–500 ml d'eau réparties | |
| 15:30 | 1 banane + 50 g de pain d'épices | ~45 g G |
| 16:15 | 250 ml de boisson électrolytes | |
| Mi-temps | 400 ml de boisson d'effort (6 %) | ~25 g G |
| ~19:00 | 500 ml de lait chocolaté + 1 banane + eau selon la pesée | ~75 g G / 17 g P |
| 20:30 | 110 g de riz ou pâtes (cru) + saumon + légumes + pain | ~110 g G / 35 g P |
| Coucher | 200 g de fromage blanc | ~16 g P |

L'app affiche aussi : « Pèse-toi avant l'échauffement et après le match pour calibrer ton hydratation ».

---

## PARTIE C — HYDRATATION

### C.1 Taux de sudation

```
taux (L/h) = (poids_avant − poids_après + boisson_L − urine_L) / durée_h
perte (%)  = (poids_avant − poids_après) / poids_avant × 100
```
Conditions du test : pesée en sous-vêtements, séchage avant la pesée d'après, vessie vidée avant.
Le taux est stocké par contexte (foot, match, trail frais, trail chaud) avec la température. Recommandation : un test dans chaque contexte au cours des 2 premiers mois.

### C.2 Besoins quotidiens

```
base = 35 ml/kg                          (75 kg → 2,6 L)
+ pertes des séances = taux_sudation_contexte × durée   (défaut 0,8 L/h si aucun test)
+10 % si T° max > 25 °C, +20 % si > 30 °C (Open-Meteo)
objectif_boisson_jour = base + pertes (arrondi à 0,1 L)
```

### C.3 Pendant l'effort

| Paramètre | Règle |
|-----------|-------|
| Objectif | Perte < 2 % du poids, **sans jamais prendre de poids** (risque d'hyponatrémie) |
| Eau / h | 60–80 % du taux de sudation, entre 400 et 900 ml/h ; défaut 500–750 ml/h |
| Sodium / h | Séances > 2 h ou chaleur : 300–600 mg/h par défaut ; jusqu'à ~1 000 mg/h si taux de sudation > 1,2 L/h ou traces de sel sur les vêtements |
| < 60 min, frais | Eau à la soif |
| Après | 1,25–1,5 L par kg perdu sur 2–4 h, avec du sodium (repas salé ou boisson) |

### C.4 Rappels intelligents

- Courbe de consommation attendue : de la levée à 2 h avant le coucher, plus des pics autour des séances.
- Points de contrôle à 10 h, 13 h, 16 h et 19 h. Si la consommation saisie est inférieure à 70 % de l'attendu et que l'écart dépasse 400 ml, notification : « Bois 500 ml dans les 2 prochaines heures ».
- Maximum 4 rappels par jour, aucun dans les 2 h avant le coucher.
- Saisie en un tap (+250 / +500 / +750 ml).

### C.5 Alertes

| ID | Condition | Message |
|----|-----------|---------|
| `HIGH_SWEAT` | Taux mesuré > 1,5 L/h ou perte > 2 % | « Ton taux de sudation est élevé aujourd'hui. Augmente eau + sodium : vise 750 ml/h et 700 mg de sodium/h sur ta prochaine sortie. » |
| `HEAT_DAY` | T° > 28 °C et séance prévue | Objectif du jour relevé, séance à décaler aux heures fraîches si c'est l'app qui la contrôle |
| `OVERDRINK` | Poids après > poids avant | « Tu as bu plus que tu n'as perdu. Réduis légèrement : trop boire n'est pas sans risque. » |

---

## PARTIE D — NUTRITION ULTRA & ENTRAÎNEMENT DIGESTIF

### D.1 Paliers de glucides par heure

| Palier | g/h | Remarque |
|--------|-----|----------|
| P1 | 30–40 | Point de départ |
| P2 | 40–50 | |
| P3 | 50–60 | Limite pratique avec du glucose seul |
| P4 | 60–70 | Produits glucose + fructose nécessaires |
| P5 | 70–80 | |
| P6 | 80–90 | Seulement si P5 est parfaitement toléré à plusieurs reprises |

Ne s'applique qu'aux sorties **≥ 90 min**.

### D.2 Règle de progression (après chaque sortie ≥ 90 min)

```
consommé_réel ≥ 90 % de la cible ?
  NON → pas de changement ; message : « Tu n'as consommé que 35 g/h sur ta sortie de 3 h.
        Teste 45 g/h aujourd'hui, avec une prise toutes les 20 min. »
  OUI →
    sévérité digestive 0–2 et aucun symptôme majeur      → palier +1 (max un palier par semaine)
    sévérité 3–5 ou symptôme mineur (ballonnements, faim) → palier maintenu + ajustement ciblé
    sévérité ≥ 6 ou nausées fortes / envie de vomir / diarrhée → palier −1 + changement de produit
« Nutrition maximale tolérée » = plus haut g/h atteint avec une sévérité ≤ 2 sur une sortie ≥ 2 h
```

### D.3 Ajustements par symptôme

| Symptôme | Ajustement proposé pour la sortie suivante |
|----------|--------------------------------------------|
| Ballonnements | Repas d'avant-sortie plus tôt (≥ 3 h) et pauvre en fibres ; prises plus petites et plus fréquentes |
| Nausées | Plus d'eau avec chaque gel (150–200 ml), produits moins concentrés, alterner avec du salé, baisser l'intensité en montée |
| Douleurs abdominales | Fractionner (toutes les 15 min), vérifier la caféine, éviter les produits nouveaux |
| Envie de vomir | Palier −1, boisson plus diluée, aliments simples |
| Diarrhée | Moins de fibres et de lactose la veille, repas ≥ 3 h avant, vérifier la caféine, ratio glucose/fructose |
| Faim | Ajouter du solide (barre, riz, pomme de terre salée), commencer à manger dès 20–30 min |
| Écœurement | Alterner sucré et salé (crackers, bouillon, pommes de terre salées, compote) |

### D.4 Plan de ravitaillement généré (sortie ≥ 90 min)

- Première prise à 20–30 min, puis toutes les 20 min : `cible_g/h ÷ 3` par prise.
- Alternance des formats (boisson / gel / solide) selon les produits de la bibliothèque perso et les préférences.
- Eau par heure et sodium par heure selon la partie C.
- La veille d'une sortie ≥ 3 h : glucides 7–8 g/kg ; repas 2–3 h avant le départ : 1–2 g/kg de glucides.
- Journal pendant la sortie (ou saisie après coup : « 3 gels, 1 barre, 1,5 L de boisson ») : g/h réels calculés automatiquement.
