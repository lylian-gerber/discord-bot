# 6. Logique de génération des programmes

Implémentation : `packages/core/planning` + `packages/core/ultra`.
Principe : **périodisation en trois niveaux** (macrocycle → mésocycle → semaine), puis **ajustement quotidien** (doc 4). Rien n'est figé : chaque dimanche, la semaine suivante est régénérée à partir de ce qui a réellement été fait.

---

## 6.1 Hiérarchie des objectifs (contrainte centrale)

1. **Football N2 = contrainte dure en saison.** Le trail ne doit jamais dégrader le match du samedi.
2. **Ultra 80 km (juin 2027) = objectif A** : le finir en bon état.
3. **Dodo Trail 2027 = objectif A'**. La date exacte est à saisir : son placement par rapport à l'ultra change l'affûtage.

Conséquence : en saison, le trail sert à construire de l'**endurance fondamentale**, du **temps sur les jambes**, de la **montée** et de la **résistance musculaire**, pas de l'intensité. Le gros volume se place dans les fenêtres sans match : trêve hivernale, week-ends sans match, fin de saison.

## 6.2 Règles dures (jamais contournables, ni par l'IA, ni par l'utilisateur sans un avertissement explicite)

| ID | Règle |
|----|-------|
| H1 | Jour de match : aucune séance ajoutée (activation seulement) |
| H2 | J-1 match : aucune séance trail ni renfo |
| H3 | J-2 match (jeudi) en saison : trail ≤ plafond de phase (max 150 min), RPE ≤ 4, **D− ≤ 500 m** (600 m si forme 🟢 et phase BUILD), pas de fractionné, de préférence le matin |
| H4 | J+1 match ≥ 60 min joué : récup uniquement (≤ 45 min, RPE ≤ 3) |
| H5 | Temps trail hebdo ≤ +10 % vs moyenne des 3 dernières semaines non allégées (pas minimum +10 min pour les petits volumes) |
| H6 | Sortie longue ≤ plus longue sortie des 6 dernières semaines + max(15 min, 10 %) |
| H7 | D+ hebdo ≤ +15 % vs moyenne des 3 dernières semaines |
| H8 | Semaine allégée au plus tard toutes les 4 semaines |
| H9 | Renfo : jamais à J-2 / J-1 ; renfo lourd ≥ J-4 |
| H10 | Pas de fractionné ni de tempo trail en saison (sauf trêve / intersaison) |
| H11 | Douleur ≥ 6 ou persistante (doc 4) : séances d'impact bloquées |
| H12 | Deux séances trail « longues » (≥ 90 min) jamais à moins de 48 h d'intervalle, sauf back-to-back programmé hors saison |
| H13 | Séance manquée = séance perdue : jamais de « rattrapage » en doublant la suivante |

## 6.3 Macrocycle (22 sept. 2026 → juin 2027)

Proposition initiale, recalculée chaque semaine. Les dates de trêve et de fin de saison sont à confirmer dans le profil.

| Phase | Période indicative | Sorties / sem. | Sortie longue | D+ par sortie longue | Focus |
|-------|-------------------|----------------|---------------|----------------------|-------|
| **BASE 1** | 22 sept → 1er nov | 1 | 60 → 90 min | 200 → 500 m | Régularité, Z1–Z2, habitude du jeudi |
| **BASE 2** | 2 nov → trêve (~mi-déc.) | 1 + parfois 1 très légère (dim. si peu joué, ou lundi 30–40 min) | 90 → 150 min | 400 → 900 m | Temps sur les jambes, technique de montée, bâtons |
| **TRÊVE** | ~mi-déc. → ~début janv. | 2–3 | jusqu'à 3 h | jusqu'à 1 200 m | 1er bloc de volume ; **descente enfin autorisée** ; la dernière semaine redevient compatible avec la reprise foot |
| **BUILD 1** | janv. → fév. | 1–2 | 2 h → 2 h 30 le jeudi ; 3 h si week-end sans match | 800 → 1 500 m | D+ progressif, D− encadré, nutrition P2–P3 |
| **BUILD 2** | mars → avril | 1–2 | 2 h 30 le jeudi ; **3 h → 4 h 30 uniquement les week-ends sans match** (≈ une toutes les 2–3 semaines) | 1 200 → 2 000 m | Nutrition longue distance P3–P5, matériel, marche active en côte |
| **SPÉCIFIQUE** | fin de saison N2 (~mi-mai) → J-14 | 3–4 | 4 h → 6 h, back-to-back | 1 800 → 2 500 m | Simulation 35–45 km, nutrition course, descente, nuit si l'ultra en comporte |
| **AFFÛTAGE** | J-14 → course | 2–3 courtes | ≤ 2 h | modéré | Volume −40 à −60 %, fraîcheur |
| **COURSE** | juin 2027 | — | 80 km | — | — |
| **RÉCUP** | 2–3 sem. après | — | — | — | Puis bloc Dodo Trail selon sa date |

**Sur ton plan initial, franchement** :
- Des sorties de 3 à 4 h 30 en mars-avril le jeudi, avec un match le samedi, ce n'est **pas compatible** avec la priorité football.
- Le moteur les place donc sur les week-ends libres et garde le jeudi à 2 h 30 maximum avec D− plafonné.
- Pour compenser le temps sur les jambes : cumul jeudi + dimanche (si peu de temps de jeu), et montée en marche active (tapis incliné, escaliers, remontées avec descente en transport) qui coûte peu en excentrique.

## 6.4 Mésocycles

- Cycles **3 + 1** : 3 semaines de progression, puis 1 semaine allégée (trail −30 à −40 %, foot inchangé puisque c'est le club qui décide).
- Allégement **anticipé** si, sur 7 jours : forme moyenne < 60, ou ACWR > 1,4, ou douleur active ≥ 3, ou 2 séances clés ratées pour cause de fatigue.
- Pendant la trêve : 2 + 1 (bloc court mais dense).

## 6.5 Semaine type en saison (match le samedi)

| Jour | Foot (club) | Ajouté par l'app | Nutrition (`DayType`) |
|------|-------------|------------------|-----------------------|
| Lun | Léger / récup | Renfo #1 (20–30 min, J-5) · mobilité 15 min · BASE 2+ : footing 30–40 min Z1 facultatif | LIGHT |
| Mar | Modéré | Renfo #2 court (facultatif, J-4) · mobilité 10 min | MODERATE |
| Mer | Intense | Rien · bain froid · mobilité 15 min | HARD |
| Jeu | — | **Trail principal** (Z1–Z2, H3) | MODERATE → HARD selon la durée |
| Ven | Veille de match | Rien (activation club) | PRE_MATCH |
| Sam | **Match** | Rien · bain froid après | MATCH |
| Dim | — | Conditionnel : ≥ 60 min joué → récup active ; < 30 min → trail 45–75 min Z1–Z2 | POST_MATCH / LIGHT |

**Séances conditionnelles** : certaines séances ont deux variantes, résolues automatiquement une fois le match saisi.
Exemple pour dimanche : « si < 30 min jouées → 60 min trail facile ; sinon → 30 min de vélo + mobilité ».

**Semaines spéciales** détectées depuis le calendrier :
- *Match de coupe en milieu de semaine* : le jeudi est supprimé ou réduit à 45 min, pas de renfo.
- *Week-end sans match* : c'est la fenêtre pour la sortie longue de la phase (samedi ou dimanche) ; le jeudi redevient court.
- *Deux matchs dans la semaine* : aucune séance trail hors récup.

## 6.6 Algorithme de génération hebdomadaire

Tourne chaque dimanche à 20 h (ou à la demande) pour la semaine S+1.

```
ENTRÉES
  profil, objectifs (dates), macrocycle, calendrier foot S+1 (template + matchs réels),
  historique 6 semaines (activités, TrainingLoad), forme moyenne 7 j,
  douleurs actives, compliance S (réalisé / prévu), plus longue sortie 6 sem.

1. PHASE & MÉSO
   phase = macrocycle.phaseAt(S+1)
   allégée = (mesoWeek == 4) OR déclencheurs d'allégement anticipé (6.4)

2. VOLUME TRAIL CIBLE (minutes)
   ref = moyenne des 3 dernières semaines non allégées (réalisé)
   si allégée                          → cible = ref × 0,65
   sinon si compliance ≥ 90 % et forme ≥ 65 → cible = ref × 1,05–1,10 (+10 min min.)
   sinon si compliance 70–90 %         → cible = ref
   sinon (< 70 %)                      → cible = ref × 0,9
       (si les séances ont été manquées pour une raison de vie et non de fatigue → cible = ref)
   cible = clamp(cible, phase.min, phase.max) puis règle H5

3. SORTIE LONGUE
   durée = min(phase.longMax, H6(plusLongue), plafondDuCréneau)
   plafondDuCréneau = 150 min si jeudi J-2 en saison, sinon phase.longMax
   D+ = durée × ratio D+/h de la phase (ex. 300 → 450 m/h), plafonné H7
   D− max = 500 m si J-2 (H3)

4. PLACEMENT (solveur de contraintes simple : placement glouton + score)
   a. Poser le foot fixe (template + matchs S+1)
   b. Calculer pour chaque jour : J-x / J+x du match, disponibilité, règles H1–H12
   c. Créneau de la sortie longue :
        score(jour) = +3 week-end sans match, +2 jeudi, −∞ si règle violée,
                      −1 si lendemain de grosse séance, +1 le matin
   d. Séance secondaire (si phase et forme le permettent) : dimanche conditionnel ou lundi Z1
   e. Renfo : lundi (J-5), puis mardi si 2 séances
   f. Mobilité quotidienne, récup après mercredi et après le match
   g. Répartir le reste du volume cible sur les séances secondaires

5. CONTRÔLE DE CHARGE PRÉVISIONNELLE
   charge_foot_prévue = Σ (RPE attendu × durée) du template
   charge_trail_prévue = Σ (RPE cible × durée)
   si l'ACWR projeté fin de semaine > 1,3 → réduire le trail (pas le foot) jusqu'à ≤ 1,3

6. SÉANCES CLÉS
   isKey = sortie ≥ 120 min OU D+ ≥ 800 m OU back-to-back OU simulation
   → validation = PENDING (athlète, et staff si relié)

7. SORTIES ANNEXES
   plan de ravito pour les sorties ≥ 90 min (doc 5, D.4), MealPlan × 7, ShoppingList

8. JUSTIFICATION
   raisons structurées (ex. {volume: +8 %, cause: "compliance 100 %, forme moy. 72"})
   → le LLM rédige le paragraphe « Pourquoi cette semaine » (sans changer les chiffres)

SORTIE : WeekPlan (version n+1) + PlannedSession[]
```

## 6.7 Ajustement quotidien

Après le check-in :

1. Calcul de la forme (doc 4, B.6) et des déclencheurs (B.7).
2. Pour la séance prévue du jour (si contrôlée par l'app) : application de la matrice de décision.
3. Si modification : nouvelle `PlannedSession` (origin = ENGINE, originalId = version précédente, modificationReason) + `AIRecommendation` de type SESSION_ADJUSTMENT.
4. Si une séance clé est annulée : le moteur propose de la **décaler** vers un créneau valide dans les 3 jours (s'il existe), sinon elle est perdue (H13). **Pas de rattrapage cumulé.**
5. L'athlète peut refuser l'ajustement (sauf règle dure). Le refus est tracé et pris en compte dans l'analyse de la semaine.

## 6.8 Déplacement d'une séance (calendrier)

```
onMove(session, nouvelleDate):
  violations = checkHardRules(session, nouvelleDate, semaine)
  si violations:
     refuser + expliquer + proposer les 2 créneaux valides les plus proches
  sinon:
     appliquer
     recalculer la semaine : ordre des séances (H12), charge prévisionnelle (étape 5),
                             DayType et MealPlan des jours touchés, ravito, liste de courses
     afficher un aperçu d'impact AVANT confirmation :
       « Sortie longue déplacée au dimanche → footing de lundi supprimé (48 h minimum),
         dimanche passe en LONG_TRAIL (+180 g de glucides), vendredi redevient PRE_MATCH »
```

## 6.9 Progression ultra & jalons

Un jalon n'est **validé** que si tous ses critères sont remplis, pas seulement la distance :

| # | Jalon | Critères supplémentaires |
|---|-------|--------------------------|
| 1 | 15 km / 400 D+ | jambes J+2 ≤ 5/10, aucune douleur ≥ 3 |
| 2 | 20 km / 700 D+ | idem + nutrition ≥ P1 tenue |
| 3 | 25 km / 1 000 D+ (~3 h) | idem + P2 tolérée |
| 4 | 30 km / 1 300 D+ | idem + P3 tolérée, match suivant non impacté (RPE match et forme J+0 normaux) |
| 5 | 35 km / 1 500 D+ (~4 h 30) | P3–P4 tolérée |
| 6 | Back-to-back 25 + 15 km | forme J+2 ≥ 60 |
| 7 | Simulation 40–45 km / 1 800–2 500 D+ (5–6 h) | P4+ tolérée, stratégie de course validée |

Pas besoin de courir 80 km à l'entraînement : une sortie la plus longue de 40–50 km (ou 6–7 h), plus un back-to-back, suffit classiquement pour **finir** un 80 km.
Le moteur n'ajoute jamais un jalon au plan si les règles H5–H7 ne le permettent pas encore. La date affichée pour chaque jalon est une projection, pas un engagement.

**Indicateur de confiance objectif** (affiché dans l'espace ultra) : compare la courbe réalisée (temps sur les jambes, plus longue sortie, D+) à la courbe minimale nécessaire. Trois états : « en avance », « dans les temps », « en retard, il faut revoir l'objectif ou le calendrier ». L'app le dit franchement si l'objectif 80 km devient irréaliste.
