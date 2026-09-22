# 4. Logique de calcul de la charge & logique de récupération

Tout ce document est implémenté dans `packages/core/load`, `packages/core/readiness` et `packages/core/recovery`, sous forme de fonctions pures testées. Les seuils sont des **paramètres** (fichier de config), pas des constantes enfouies dans le code, pour pouvoir les ajuster à tes données réelles après quelques semaines.

---

## PARTIE A — CHARGE D'ENTRAÎNEMENT

### A.1 Charge d'une séance (sRPE, méthode de Foster)

```
charge = RPE (CR-10, 1–10) × durée (min)
```

| Cas | Règle |
|-----|-------|
| Entraînement foot | RPE × durée totale de la séance |
| Match | RPE × minutes jouées **+** échauffement (défaut 20 min × RPE 4 = 80) |
| Remplaçant non entré | Échauffement seul. Le moteur propose une séance de compensation le lendemain ou le dimanche (30–40 min) |
| Trail | RPE × durée totale (pauses comprises si < 10 min) |
| Renfo | RPE × durée |
| Mobilité / récup active | Comptée à part (non incluse dans la charge totale si RPE ≤ 2) |

Le RPE est demandé 30 min après la fin (la valeur est plus fiable qu'à chaud).
S'il n'est pas saisi, on met une valeur par défaut selon le type prévu, marquée `estimée` et exclue des alertes critiques.

**Indicateurs spécifiques trail** (en plus de la charge) :
- `kmEffort = km + D+ / 100` (ex. 20 km / 1 000 D+ → 30 km-effort) ;
- `D−` cumulé sur 72 h, qui sert d'indice de **stress excentrique** (principal ennemi du match du samedi).

### A.2 Agrégats

Pour chaque jour et chaque domaine (FOOTBALL, TRAIL, STRENGTH, OTHER) :

```
charge_jour_domaine = Σ charges des séances du domaine ce jour-là
charge_jour_totale  = Σ domaines
semaine_glissante   = Σ charges des 7 derniers jours
semaine_calendaire  = Σ lun → dim (affichage)
moyenne_4_semaines  = Σ 28 derniers jours / 4
variation_semaine   = semaine_glissante / semaine_glissante(J-7) − 1
```

### A.3 Ratio aigu / chronique (EWMA)

On utilise des moyennes mobiles exponentielles (plus robustes que les moyennes simples, Williams et al. 2017) :

```
λa = 2 / (7 + 1)  = 0.25
λc = 2 / (28 + 1) ≈ 0.069

aigu_t    = λa × charge_t + (1 − λa) × aigu_{t-1}
chronique_t = λc × charge_t + (1 − λc) × chronique_{t-1}
ACWR_t    = aigu_t / chronique_t
```

- **Calibrage** : tant qu'on a moins de 28 jours de données, le chronique est initialisé à partir du volume déclaré à l'onboarding (4 dernières semaines). Le ratio est affiché « en calibrage » et seule la variation semaine / semaine déclenche des alertes.
- **Interprétation prudente** : on s'en sert comme d'un voyant, pas comme d'une prédiction de blessure.

### A.4 Monotonie et contrainte (Foster)

```
monotonie = moyenne(charges 7 j) / écart-type(charges 7 j)   (jours à 0 inclus)
contrainte = semaine_glissante × monotonie
```
Une monotonie > 2,0 veut dire que les journées se ressemblent trop, sans vrais jours faciles. Le moteur force alors un jour réellement léger.

### A.5 Fatigue musculaire (0–100, 100 = très fatigué)

```
subjectif   = moyenne pondérée( jambes × 0.5 , courbatures × 0.5 ) → ramené sur 100
excentrique = min(100, D−_72h / 15)            // 1 500 m de D− en 72 h ≈ 100
match_recent = 30 si match ≥ 60 min dans les 48 h, 15 si 30–59 min, sinon 0
fatigue_musc = 0.6 × subjectif + 0.25 × excentrique + 0.15 × match_recent
```

### A.6 Risque de surcharge (faible / modéré / élevé)

Chaque condition vaut des points :

| Condition | Points |
|-----------|--------|
| ACWR > 1,3 | +2 |
| ACWR > 1,5 | +2 (cumulatif → 4) |
| variation semaine > +15 % | +1 |
| variation semaine > +25 % | +1 (cumulatif → 2) |
| monotonie > 2,0 | +1 |
| forme en zone orange ou rouge 3 jours sur les 4 derniers | +2 |
| douleur active ≥ 3/10 | +2 |
| dette de sommeil > 5 h | +1 |

Résultat : 0–2 → **faible**, 3–4 → **modéré**, ≥ 5 → **élevé**. Le risque est toujours affiché avec ses contributeurs (« pourquoi »).

### A.7 Catalogue d'alertes de charge

| ID | Déclencheur | Sévérité | Message type |
|----|-------------|----------|--------------|
| `LOAD_SPIKE_WEEK` | variation semaine > +20 % **et** (jambes ≥ 7 ou forme < 60) | WARNING | « Tes jambes sont très fatiguées et ta charge a augmenté de 24 % cette semaine. Je réduis la sortie d'aujourd'hui de 30 %. » |
| `LOAD_SPIKE_ACWR` | ACWR > 1,5 | WARNING | « Ta charge des 7 derniers jours est 1,6× ta moyenne habituelle. On stabilise cette semaine. » |
| `MONOTONY` | monotonie > 2,0 | INFO | « Tes journées se ressemblent trop. Demain = vraie journée facile. » |
| `TRAIL_LONGRUN_JUMP` | sortie longue prévue > max(+15 min, +10 %) de la plus longue récente | Bloquée par le moteur | (jamais proposée) |
| `DETRAINING` | ACWR < 0,7 pendant 10 j hors trêve/blessure | INFO | « Volume en baisse depuis 10 jours. On reprend progressivement. » |
| `NO_TRAIL_BEFORE_MATCH` | séance trail posée à J-1 | CRITICAL / bloquée | « Tu as un match demain. Pas de séance trail. » |

---

## PARTIE B — SCORES SOMMEIL / RÉCUPÉRATION / FORME

### B.1 Besoin de sommeil du jour

```
besoin = 510 min (8h30, paramètre profil)
  + 30 min  si la veille = match, grosse séance (mer) ou trail ≥ 120 min
  + 30 min  si dette de sommeil > 3 h
  + 15 min  si charge_aiguë > 1,2 × chronique
plafond 600 min (10 h)

coucher recommandé = lever imposé − besoin − 15 min (latence d'endormissement)
```

**Dette de sommeil** : `max(0, Σ_{14 j} (besoin_i − sommeil_i − sieste_i))`.

### B.2 Score sommeil (0–100)

```
r = sommeil_réel / besoin
durée     = 60 × clamp((r − 0.6) / 0.4, 0, 1)     // 60 pts si besoin atteint
qualité   = 30 × (qualité_ressentie − 1) / 9
régularité = 10 × (1 − clamp(|coucher − coucher_moyen_7j| / 90 min, 0, 1))
score_sommeil = durée + qualité + régularité
```

### B.3 Score bien-être subjectif (inspiré de l'indice de Hooper)

Chaque item est ramené à une échelle où 10 = bon (on inverse fatigue, jambes, courbatures et stress : `11 − x`).

```
bien_être = 100 × ( 0.25·fatigue' + 0.25·jambes' + 0.20·courbatures' + 0.15·stress' + 0.15·motivation − 1 ) / 9
```

### B.4 Score physiologique (si montre)

Uniquement si on a au moins 14 valeurs sur les 28 derniers jours (sinon composante ignorée).

- **HRV** (rMSSD du matin ou nocturne) : on travaille en `ln(rMSSD)`.
  `z = (ln_rMSSD_jour − moyenne_28j) / écart-type_28j`
  - z ≥ −0,5 → 100
  - −0,5 > z ≥ −1,5 → interpolation 100 → 40
  - z < −1,5 → 20
- **FC repos** : `Δ = FC_jour − moyenne_28j`
  - Δ ≤ +2 → 100
  - +3 à +7 → interpolation 100 → 40
  - Δ > +7 → 20
- `physio = moyenne des composantes disponibles`

Sur l'HRV, une valeur isolée ne veut rien dire. On affiche aussi la moyenne sur 7 j, et c'est la **tendance** qui pèse dans les décisions hebdomadaires.

### B.5 Score récupération (0–100)

```
avec physio  : 0.35 × sommeil + 0.40 × bien_être + 0.25 × physio
sans physio  : 0.45 × sommeil + 0.55 × bien_être
```

### B.6 Score de forme du jour (0–100)

On combine la récupération et l'état de charge :

```
état_charge = 100
  si ACWR ∈ [1.3, 1.5[ : 100 → 50 (linéaire)
  si ACWR ≥ 1.5        : 30
  − 15 si J+1 d'un match ≥ 60 min ou d'une grosse séance
  − 10 si D− > 800 m dans les 48 h

forme = 0.75 × récupération + 0.25 × clamp(état_charge, 0, 100)
```

**Zones** : 🟢 ≥ 75 · 🟡 60–74 · 🟠 45–59 · 🔴 < 45

**Plafonds liés à la douleur (priment sur le score)** :

| Douleur | Effet |
|---------|-------|
| 1–2 /10 | Info, surveillance |
| 3–5 /10 | Zone max 🟠 pour les séances qui sollicitent la zone concernée (course pour membre inférieur). Alternative sans impact proposée |
| ≥ 6 /10, **ou** > 5 jours consécutifs, **ou** en aggravation sur 3 jours | Zone 🔴 forcée + **message d'orientation vers un médecin ou un kiné** + séances d'impact bloquées jusqu'à nouvel avis (l'athlète peut déclarer « vu par un pro, reprise autorisée ») |
| Signaux d'alarme (douleur thoracique, malaise, palpitations, essoufflement anormal au repos, gonflement important, impossibilité d'appui, fièvre) | Arrêt complet, message d'urgence (médecin / 15 / 112), aucune séance proposée |

L'app ne nomme **jamais** une blessure (« c'est une tendinite »). Elle décrit uniquement ce qu'elle observe et oriente.

### B.7 Matrice de décision quotidienne

S'applique **aux séances que l'app contrôle** (trail, renfo, footing, récup).
Les séances du club ne sont pas annulées par l'app : elle informe (« forme 🔴, signale-le à ton staff ») et ajuste tout le reste autour.

| Zone | Trail / footing | Renfo | Foot club |
|------|-----------------|-------|-----------|
| 🟢 | Maintien. Légère hausse possible (+5 à 10 % de durée) **seulement si** 3 jours verts consécutifs, ACWR < 1,3, pas à ≤ J-2 d'un match, et plafonds hebdo respectés | Maintien | RAS |
| 🟡 | Volume maintenu, RPE plafonné à 5, D− −30 % | Maintien, charges −10 % | RAS |
| 🟠 | Durée −30 à −50 %, terrain plat ou montée, Z1 uniquement, ou conversion en marche / vélo facile | Remplacé par 15 min de mobilité | « Préviens ton staff si ça ne s'améliore pas » |
| 🔴 | Annulé → repos ou 20–30 min de marche / mobilité | Annulé | Message staff recommandé |

**Déclencheurs spécifiques** (s'appliquent même si le score global est bon) :

| Règle | Condition | Action |
|-------|-----------|--------|
| `SHORT_SLEEP` | sommeil < 6 h 15 | Trail → max 40–45 min facile ; séance clé décalée si possible |
| `HEAVY_LEGS` | jambes ≥ 8 | Pas de descente, D− plafonné à 150 m |
| `SPIKE_AND_TIRED` | variation semaine > +20 % et jambes ≥ 7 | Sortie −30 % |
| `THREE_BAD_NIGHTS` | 3 nuits < 7 h d'affilée | Aucune séance clé, conseil sommeil prioritaire |
| `LOW_MOTIVATION` | motivation ≤ 3 deux jours de suite + fatigue ≥ 7 | Signal de fatigue globale → séance allégée, message bienveillant |

**Règle de symétrie** : l'app baisse vite mais remonte lentement. Il faut 1 signal rouge pour réduire, et 3 jours verts pour réaugmenter.

---

## PARTIE C — RÉCUPÉRATION

### C.1 Recommandations du jour (moteur)

Selon le type de journée et la fatigue, le moteur sélectionne :

| Élément | Déclencheur | Recommandation |
|---------|-------------|----------------|
| Mobilité | Tous les jours | 10 min (léger) / 15 min (après grosse séance) / 20 min (J+1 match, J+1 sortie longue) |
| Récup active | J+1 match (si > 45 min joué), J+1 sortie ≥ 2 h 30 | 20–40 min vélo / marche / nage, RPE ≤ 3 |
| Auto-massage / foam roller | fatigue_musc > 50 | 10 min, zones sollicitées |
| Collation post-effort | Toute séance ≥ 45 min ou RPE ≥ 6 | Dans les 30–60 min (doc 5) |
| Sommeil | Toujours | Heure de coucher (B.1) |
| Hydratation | Toujours | Doc 5 |
| Bain froid | C.2 | Oui / non / facultatif |

### C.2 Décision bain froid

```
recommandé SI au moins un :
  - match joué ≥ 45 min (même jour ou la veille au soir)
  - grosse séance foot (mercredi / RPE ≥ 7)
  - trail ≥ 120 min OU D− ≥ 800 m
  - courbatures ≥ 7 ET séance importante dans les 48 h

ET aucun des bloqueurs :
  - séance de renforcement dans les 6 h précédentes
      (l'immersion froide juste après la musculation réduit les gains de force et d'hypertrophie, cf. Roberts et al. 2015)
  - contre-indication déclarée (Raynaud, problème cardiaque, maladie en cours)
  - séance très facile / journée légère → « pas nécessaire »

nuance selon la phase :
  - en saison : priorité à la fraîcheur pour le match → bain froid après match et mercredi OK
  - bloc de développement trail (trêve, mai) : on veut l'adaptation → facultatif,
    sauf si séance importante < 48 h (ex. back-to-back)
```

**Protocole par défaut** : eau à 10–15 °C, 8–12 min, jambes immergées jusqu'aux hanches, dans l'heure qui suit l'effort si possible.
**Journal** : température, durée, sensation avant / après (1–10). Si l'athlète ne ressent aucun bénéfice sur 5 utilisations, l'app le signale pour qu'il décide (l'effet est en partie individuel et perceptif).

### C.3 Protocole J+1 match (dimanche)

1. Check-in.
2. Si ≥ 60 min jouées : 20–30 min de récup active + 20 min de mobilité, pas de trail, bain froid la veille si possible.
3. Si < 30 min jouées : séance de compensation possible (footing trail 45–75 min en Z1–Z2), c'est une opportunité de volume.
4. Nutrition : pas de déficit, glucides modérés à élevés (reconstitution du glycogène), protéines réparties.
