# 5. Algorithmes principaux, système de charge et de progression

Tout est implémenté dans `src/engine/` et couvert par `src/engine/__tests__/engine.test.ts` (31 tests, `npm test`).

| Module | Fichier | Rôle |
|---|---|---|
| Charge | `load.ts` | sRPE, aigu/chronique, ACWR, monotonie, alertes, facteur de réduction |
| Readiness | `readiness.ts` | Score /100 + sous-scores + garde-fous douleur |
| Durabilité | `durability.ts` | Rétention d'efficience par heure, découplage, finish ratio |
| Périodisation | `periodization.ts` | Macrocycle, phases, contexte football, alertes de faisabilité |
| Semaine | `weekPlanner.ts` | Placement des séances autour des matchs, adaptation au readiness |
| Nutrition | `nutrition.ts` | kcal/G/P/L/eau/sodium par type de journée, répartition des repas |
| Hydratation | `hydration.ts` | Taux de sudation, plan ml/h + sodium/h, correction chaleur |
| Ventre | `gutTraining.ts` | Progression 30 → 90 g/h, produits à éviter |
| Sommeil | `sleep.ts` | Dette, moyenne 7 j, heure de coucher |
| Matériel | `gear.ts` | Usure chaussures, checklist automatique |
| Sécurité | `safety.ts` | Détection de signaux d'alerte avant le LLM |

---

## 5.1 Système de charge

**Méthode** : sRPE de Foster = durée (min) × RPE (0-10), saisi ~30 min après la séance. Exemple : 90 min × 7 = 630 UA.

Pourquoi sRPE et pas TSS/TRIMP : c'est la seule mesure **comparable entre football et course** (le football sans capteurs n'a ni puissance ni allure exploitable), et elle est validée en sport collectif. Quand la FC est disponible, on calcule en plus un TRIMP (V2) pour croiser.

**Indicateurs calculés chaque jour** (`summarizeLoad`) :

| Indicateur | Formule | Lecture |
|---|---|---|
| Aigu 7 j | Σ charges 7 derniers jours | fatigue récente |
| Chronique | Σ 28 j / 4 (moyenne hebdo) | forme / capacité |
| ACWR rolling | aigu / chronique | |
| ACWR EWMA | EWMA(7) / EWMA(28), λ = 2/(N+1) | plus robuste aux pics isolés |
| Variation hebdo | (aigu − chronique) / chronique | « Charge +28 % par rapport à ta moyenne récente » dès +20 % |
| Monotonie | moyenne / écart-type sur 7 j | > 2 = jours trop uniformes |
| Strain | aigu × monotonie | |
| Par catégorie | football, running, trail, strength, cross | graphiques empilés |

**Statut** (on prend le **plus élevé** des deux ACWR, par prudence) : < 0,8 sous-charge · 0,8-1,3 optimal · 1,3-1,5 prudence · > 1,5 danger.

**Action automatique** (`plannedVolumeFactor`) : prudence → volume trail ×0,8 ; danger → ×0,6 ; sous-charge → ×1,1. **Le football n'est jamais modifié par l'app** : c'est le club qui décide, l'app ajuste uniquement le trail et la muscu.

> ⚠️ Honnêteté scientifique : l'ACWR comme *prédicteur de blessure* est contesté (Impellizzeri et al., 2020). On l'utilise comme détecteur de pics brutaux, jamais comme vérité. L'UI dit « signal », pas « risque de blessure X % ».

## 5.2 Readiness score

Entrées : check-in (échelles 0-10 ; 10 = mieux pour sommeil/jambes/motivation/énergie, 10 = pire pour fatigue/douleur/stress/courbatures), FC repos et HRV comparées à **ta propre baseline** (moyenne ± σ sur 28 j, z-score ; HRV en ln(RMSSD)), contexte (heures depuis le match × minutes jouées, statut de charge, dette de sommeil).

```
sommeil   = 50 % qualité + 50 % (durée / besoin)          − 10 si dette > 3 h
cardio    = z-scores FC repos & HRV (75 à z=0, −15/σ)     sinon énergie + fatigue
jambes    = 50 % jambes + 30 % courbatures + 20 % douleur − pénalité post-match (≤ 20)
récup     = 40 % fatigue + 30 % énergie + 30 % cardio     − 7/15 si charge prudence/danger
mental    = 50 % motivation + 50 % stress
TOTAL     = 30 % récup + 25 % jambes + 15 % cardio + 20 % sommeil + 10 % mental
```

Paliers : ≥ 80 feu vert · 65-79 normal · 50-64 adapter · 35-49 facile · < 35 repos.
**Garde-fous prioritaires** : douleur ≥ 7 → total plafonné à 30 et `blockRunning` ; douleur 5-6 → plafonné à 55.

La recommandation est choisie par le moteur (ex. jambes nettement sous le cardio → « garde l'intensité, réduis la descente et l'excentrique »). Le LLM la reformule, il ne la change pas.

**Calibrage** : les pondérations sont des heuristiques de départ. En V2, on mesure la corrélation entre le readiness et la qualité réelle des séances (RPE attendu vs obtenu, durabilité) et on ajuste les poids par utilisateur.

## 5.3 Durability score

Objectif : mesurer la capacité à **rester efficace après 1 h, 2 h, 3 h, 4 h**.

1. Filtrer les pauses et trous GPS ; exclure les 10 premières minutes (échauffement).
2. Ajuster chaque segment à la pente avec le coût énergétique de **Minetti (2002)** → vitesse ajustée (GAP).
3. Découper en tranches d'une heure ; pour chaque tranche : GAP, FC moyenne, cadence, puissance.
4. **Efficience** = GAP / FC. Rétention(h) = efficience(h) / efficience(1ʳᵉ heure).
5. Score par jalon = 100 − 4 × (points de rétention perdus) → 10 % de perte = 60.
6. Score global = moyenne pondérée par l'heure (tenir à 3 h compte 3× plus que tenir à 1 h).
7. En complément : **découplage aérobie** (Friel) 1ʳᵉ vs 2ᵉ moitié (< 5 % = très bon) et **finish ratio** = GAP des 10 % finaux / GAP des 25 % initiaux (> 1 = tu finis plus vite).

Sans FC fiable, le calcul se fait sur la GAP seule (signalé dans l'UI, moins fiable car dépend de l'intention). Limite connue : Minetti surestime la vitesse « attendue » en descente technique.

**Suivi** : courbe du score sur les sorties > 90 min ; séances « finish fast » prescrites pour le travailler (dernier quart à allure seuil).

## 5.4 Système de progression (périodisation)

### Phases

Les 10 étapes demandées sont regroupées en **6 phases** ; la nutrition longue distance et les simulations sont des fils continus qui démarrent à une phase donnée.

| Phase | Part du temps | Étapes couvertes | Focus |
|---|---|---|---|
| Base aérobie | 25 % | 1 | endurance fondamentale, pieds/chevilles/mollets, force |
| Développement endurance | 20 % | 2 | sorties longues progressives, tempo |
| Développement trail | 20 % | 3 | côtes, descente, marche rapide en pente, **début entraînement digestif** |
| Temps sur les jambes & D+ | 20 % | 4, 5, 8 | volume, dénivelé, seuil, nutrition longue durée |
| Pic | 15 % | 6, 7, 9 | back-to-back, simulations (matériel + nutrition), finish fast |
| Affûtage | 2 sem. (3 si ≥ 150 km) | 10 | volume ↓, intensité maintenue, sommeil, stratégie |

### Règles de volume

- Volume cible = pic × coefficient de phase (0,45 → 1). Pic ≈ 4 + distance/25 h (100 km → 8 h/sem hors saison).
- **Contexte football** : en saison plafond 4,5 h de course/sem et sortie longue ≤ 2 h 30 ; trêve jusqu'à 90 % du pic ; hors saison 100 %.
- Rampe : **+10 %/sem max** sur les semaines chargées, sortie longue **+20 min/sem max**.
- **1 semaine allégée sur 4** (70 %).
- Affûtage calculé sur le volume **réellement atteint** (75 % → 60 % → 40 %), pas sur le pic théorique.
- D+ hebdo proportionnel au volume, pic ≈ 70 % du D+ de la course.
- `macroWarnings` : signale une fenêtre hors saison trop courte ou une sortie la plus longue trop faible par rapport à la durée de course estimée (km-effort = km + D+/100, ~8,5 km-effort/h pour un premier ultra).

### Placement dans la semaine (`planWeek`)

Raisonne en **jours relatifs au match**, donc s'adapte tout seul si le match change de jour :

| Jour | Autorisé |
|---|---|
| MD (match) | rien |
| MD-1 | activation uniquement |
| MD-2 | qualité ≤ 75 min, **descente ≤ 150 m**, muscu légère seulement |
| MD+1 | récupération (marche, vélo facile, mobilité) sauf si < 45 min jouées |
| MD+2 → MD-3 | sortie longue, muscu lourde (≥ MD-4), footings |

Ordre de placement : sortie longue (score : pas de foot > foot léger ; loin des matchs) → séance qualité → muscu lourde puis légère → récupération MD+1 → footings faciles pour compléter le volume. Hors saison : sortie longue le week-end + back-to-back le lendemain.

Avec ta semaine type (lun léger, mar modéré, mer léger, jeu libre, ven léger, sam match), le moteur produit en phase endurance : **lundi** sortie longue (double journée avec foot léger le soir), **mardi** muscu lourde, **jeudi** séance progressive ≤ 75 min avec descente limitée, **dimanche** récupération.

### Adaptation quotidienne (`adaptSession`)

| Readiness | Effet sur la séance prévue |
|---|---|
| Douleur bloquante | remplacée par mobilité douce / repos |
| Repos (< 35) | récupération 20 min |
| Facile (35-49) | endurance fondamentale, 60 % de la durée ; muscu lourde → légère |
| Adapter (50-64) | 80 % de la durée ; si jambes ≪ cardio, descente ≤ 100 m |
| Normal / feu vert | inchangée |

### Exemple de séance générée (jeudi, phase endurance)

```
JEUDI — 12 km progressif (~60 min) · MD-2
Échauffement : 10 min très facile + 4 lignes droites
Km 1-3 : 5:20/km   (FC < 150)
Km 4-7 : 5:00/km   (FC 150-160)
Km 8-10 : 4:40/km  (FC 160-170)
Km 11 : 4:25/km    (RPE 8)
Km 12 : retour au calme
Descente cumulée max : 150 m (match samedi)
Nutrition : eau seule (< 75 min)
Objectif : développer la capacité à accélérer avec fatigue.
```

Les allures sont dérivées de la VMA / des tests (`TestResult`) et affinées par la relation allure-FC observée sur les activités récentes.

## 5.5 Tests et suivi

Tests proposés toutes les 6-8 semaines, jamais en MD-2/MD-1 : 5 km, 10 km, 20 min, 30 min (FC seuil), VMA (demi-Cooper ou VAMEVAL), montée chronométrée (1 km à ~10 %), sortie longue de référence (durabilité). Le moteur recalibre les zones d'allure et de FC après chaque test.
