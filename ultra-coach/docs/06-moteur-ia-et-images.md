# 6. Moteur IA, mémoire et analyse d'images

## 6.1 Rôle du LLM (et ce qu'il ne fait pas)

| Le LLM FAIT | Le LLM NE FAIT PAS |
|---|---|
| Comprendre le texte libre (« quadris lourds mais cardio nickel ») et le convertir en données | Calculer la charge, le readiness, les macros, les allures |
| Expliquer le *pourquoi* d'une recommandation à partir des facteurs du moteur | Modifier le plan sans validation du moteur |
| Analyser les images (captures, repas, chaussures, pieds) | Diagnostiquer une blessure |
| Comparer des séances et raconter la progression | Passer outre un garde-fou (`blockRunning`, plafonds de rampe) |
| Extraire des faits durables pour la mémoire | Inventer une donnée absente : il doit dire « je n'ai pas cette info » |

## 6.2 Modèle et paramètres

- **Modèle** : `claude-opus-5` (vision, tool use, structured outputs), via `@anthropic-ai/sdk`.
- **Thinking adaptatif** ; niveau d'`effort` réglé par route : `high` pour l'adaptation du plan et l'analyse de séance, `low`/`medium` pour les échanges courts et l'extraction — à mesurer sur les évaluations avant de figer.
- **Streaming** pour le chat (SSE vers le client).
- **Fallback serveur en cas de refus** activé (paramètre `fallbacks`) pour ne pas laisser l'utilisateur sans réponse.
- **Structured outputs** (`output_config.format` avec JSON Schema) pour toutes les sorties consommées par du code : analyse de séance, extraction d'image, extraction de mémoire, check-in en texte libre.
- **Prompt caching** : le prompt système figé et les outils en préfixe (mis en cache), puis le snapshot athlète du jour (2ᵉ point de cache), puis la conversation. Aucun horodatage dans le prompt système (sinon le cache est invalidé à chaque requête).

## 6.3 Pipeline d'un message

```
message utilisateur (+ images)
   │
   ├─1─ safety.checkSafety()              urgence → préambule imposé, pas de conseil sportif
   ├─2─ buildAthleteSnapshot(userId, day) JSON compact (~3-6 k tokens)
   ├─3─ Claude(system, tools, snapshot, historique, message)
   │        └─ appels d'outils (boucle) ──► exécutés côté serveur
   ├─4─ validation : toute proposition de séance passe par engine.validateWorkoutChange()
   ├─5─ réponse streamée + cartes d'action (« Appliquer », « Garder le plan »)
   └─6─ job asynchrone memory.extract(conversation)
```

### Snapshot athlète (contexte injecté à chaque échange)

Garantit que l'IA « ne répond jamais uniquement sur le dernier message ».

```jsonc
{
  "today": "2026-10-08", "weekday": "jeudi",
  "goal": { "race": "Ultra 100 km", "date": "2027-06-26", "dPlus": 4500, "daysLeft": 261, "priority": "A" },
  "phase": { "name": "Base aérobie", "week": 3, "of": 10, "context": "in_season", "isDeload": false },
  "football": { "nextMatch": { "in_days": 2, "kickoff": "samedi 18:00" }, "lastMatch": { "days_ago": 5, "minutes": 90, "recoveryRating": 6 } },
  "readiness": { "total": 74, "recovery": 78, "legs": 61, "cardio": 85, "sleep": 70, "tier": "normal", "flags": ["Nuit courte (6h20)"], "blockRunning": false },
  "load": { "acute7": 2840, "chronicWeekly": 2350, "acwr": 1.21, "weeklyChangePct": 21, "status": "optimal", "byCategory7": { "football": 1900, "trail": 640, "strength": 300 } },
  "todayPlan": [{ "type": "progressive", "durationMin": 60, "maxDescentM": 150 }],
  "tomorrowPlan": [{ "football": "light" }],
  "last14Days": [ /* 1 ligne par activité : jour, sport, durée, distance, D+, RPE, FC moy, sRPE */ ],
  "sleep": { "lastNight": 6.3, "avg7": 7.1, "debtHours": 4.2 },
  "nutritionToday": { "dayType": "moderate", "kcal": 3100, "carbsG": 450, "proteinG": 135, "waterMl": 3400 },
  "gut": { "currentCarbsPerHour": 40, "productsToAvoid": ["gel X"] },
  "openInjuries": [{ "location": "mollet gauche", "pain": 3, "since": "2026-10-02" }],
  "gearAlerts": ["Salomon Ultra Glide : 612 km"],
  "weather": { "tomorrow": { "tmax": 24, "rainPct": 10 } },
  "memories": [ /* top 15 mémoires actives, les plus pertinentes */ ]
}
```

### Outils exposés au modèle

| Outil | Effet |
|---|---|
| `get_activity(id)` / `get_activity_streams_summary(id)` | Détail d'une séance |
| `find_similar_activities(id, n)` | Séances comparables (même type, durée ±20 %, D+ ±30 %) pour « tu es 12 s/km plus rapide qu'il y a 4 semaines avec 5 bpm de moins » |
| `get_metric_history(metric, days)` | Séries : charge, readiness, sommeil, poids, allure à FC fixe… |
| `propose_workout_change(day, change)` | Proposition **validée par le moteur** → carte à confirmer (jamais appliquée directement) |
| `log_checkin_from_text(text)` | Transforme « jambes lourdes, dormi 6 h » en champs de check-in (confirmation) |
| `log_activity_manual(...)`, `log_meal(...)`, `log_fueling(...)`, `log_recovery(...)` | Saisie par la conversation |
| `get_nutrition_targets(day)`, `get_meal_options(slot)` | Nutrition |
| `get_weather(date, place)` | Open-Meteo |
| `gear_checklist(workoutId)` | Checklist matériel |
| `remember(kind, statement, evidence)` | Propose une mémoire (validée par les règles 6.5) |

Définitions d'outils en `strict: true` (arguments conformes au schéma) ; toutes les entrées d'outil sont revalidées côté serveur (Zod) avant exécution.

## 6.4 Prompt système (structure)

1. **Rôle** : coach d'endurance et préparateur physique pour un footballeur N2 préparant un ultra ; ton de pote direct, honnête, sans flatterie.
2. **Priorités, dans l'ordre** : sécurité → performance football → progression ultra → confort.
3. **Contrat avec le moteur** : les chiffres du snapshot font foi ; ne jamais en inventer ; toute modification de plan passe par `propose_workout_change`.
4. **Garde-fous médicaux** (section 1.7) formulés explicitement.
5. **Style** : réponse courte d'abord (quoi faire), puis le pourquoi (2-3 facteurs cités), puis le détail si demandé. Français, unités métriques.
6. **Incertitude** : dire quand une estimation est approximative (photo de repas, VO2max, durabilité sans FC).

Le prompt est **versionné** (`packages/ai/prompts/coach.v3.md`) et chaque réponse enregistre sa version.

## 6.5 Mémoire sportive

Trois couches :

| Couche | Contenu | Stockage |
|---|---|---|
| Faits bruts | Activités, check-ins, repas, symptômes | Tables métier |
| **Mémoires** | Faits durables en langage naturel, sourcés | `AthleteMemory` |
| Motifs statistiques | Corrélations calculées (ex. readiness J+1 après match selon les minutes, effet du bain froid) | Jobs hebdo → mémoires `kind=recovery_pattern` |

**Extraction** (job après chaque conversation et chaque soir) : Claude en sortie structurée propose des candidats `{kind, statement, evidence[], confidence}`. Règles :

- Un fait n'est retenu que s'il est **sourcé** (id d'activité, de check-in, de message).
- Doublon sémantique → on incrémente `occurrences`, `lastSeen`, et `confidence`.
- Intolérance digestive : ≥ 2 occurrences avec symptôme ≥ 5 (cohérent avec `gutTraining.ts`).
- Les mémoires non confirmées depuis 90 jours perdent en confiance ; les blessures ne s'effacent jamais (historique).
- **L'utilisateur voit, corrige et supprime tout** dans « Ce que le coach sait de moi ».

Exemples produits : « Mollets douloureux (4/10) après la séance de côtes du 14/10. » · « Le gel X a provoqué des nausées 2 fois. » · « Préfère courir le jeudi. » · « Readiness moyen 58 à J+1 des matchs sur synthétique vs 69 sur naturel. »

**Sélection pour le contexte** : blessures ouvertes et intolérances toujours incluses ; le reste est classé par pertinence (type de séance/jour concerné, récence, confiance), 15 max. Recherche sémantique (pgvector) seulement en V3 si le volume le justifie.

## 6.6 Analyse automatique après séance

Sortie structurée (extrait du schéma) :

```jsonc
{
  "summary": "Bonne sortie d'endurance, départ un peu rapide.",
  "ratings": { "endurance": "très bonne", "pacing": "départ trop rapide", "hr_stability": "stable", "climbing": "bonne gestion du D+", "descending": "jambes encore peu adaptées" },
  "observations": ["Baisse d'allure GAP de 6 % après le km 10", "Découplage 4,1 %"],
  "comparison": { "activityId": "…", "text": "12 s/km plus rapide qu'il y a 4 semaines avec une FC moyenne 5 bpm plus basse" },
  "estimatedRecoveryHours": 24,
  "impactOnPlan": "Aucun changement pour demain.",
  "confidence": 0.8
}
```

Les **chiffres** (GAP, découplage, écart d'allure, écart de FC) sont calculés par le moteur et passés au modèle ; le modèle rédige et qualifie.

## 6.7 Analyse d'images

### Pipeline

```
upload → R2 (privé) → job photo.analyze
  1. classification (1 appel court) : activity_screenshot | meal | shoe | body | gear | terrain | other
  2. extraction spécialisée (sortie structurée propre au type)
  3. score de confiance ; champs < seuil → "needs_confirmation"
  4. confirmation utilisateur (formulaire pré-rempli) → écriture en base
  5. réponse du coach avec le contexte du snapshot
```

| Type | Extraction | Précautions |
|---|---|---|
| Capture Strava / Garmin / Apple Fitness | distance, durée, allure, FC moy/max, D+, cadence, calories, date | Dédoublonnage avec l'import API (même jour, durée ± 5 %) ; confirmation des chiffres |
| Courbe de FC / carte | zones approximatives, profil | Qualitatif seulement |
| Repas | aliments, portions estimées, **fourchettes** kcal/G/P/L, qualité | Erreur typique ±20-40 % : affichée comme estimation ; conseil lié au lendemain (« grosse séance demain, ajoute des glucides ») |
| Chaussure | zones d'usure (semelle, amorti, tige), km connus | Conseil de remplacement combiné au kilométrage |
| Pied / ampoule / jambe | description visuelle uniquement | **Aucun diagnostic** ; soins de base généraux ; orientation pro si signe inquiétant (rougeur qui s'étend, plaie, gonflement) ; passage par `safety.ts` |
| Matériel / terrain | identification, adéquation à la séance | |

## 6.8 Qualité et évaluation

- **Jeu d'évaluation** (~60 scénarios au départ) : fatigue après match, douleur thoracique, envie de 30 km la veille d'un match, capture floue, repas ambigu, intolérance au gel, question hors sujet…
- **Assertions déterministes** (préambule médical présent, pas de séance intense à MD-1, pas de chiffres absents du snapshot) + **juge LLM** sur l'utilité et le ton.
- Lancé en CI à chaque changement de prompt ou de modèle.

## 6.9 Coût estimé (ordre de grandeur, à mesurer)

Par message de chat : ~6 k tokens de préfixe en cache + ~2 k non cachés + ~1 k de sortie ≈ **3-5 centimes** avec `claude-opus-5`. Usage intensif personnel (~20 messages/jour + analyses + photos) ≈ **20-35 €/mois**. Leviers si besoin : cache, effort plus bas sur les routes simples, Batch API (-50 %) pour les analyses nocturnes non urgentes.
