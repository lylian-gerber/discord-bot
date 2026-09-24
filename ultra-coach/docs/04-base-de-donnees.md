# 4. Base de données

Schéma complet et validé : [`prisma/schema.prisma`](../prisma/schema.prisma) (`npx prisma validate` ✅).

## 4.1 Vue d'ensemble

```
User ─┬─ AthleteProfile (1-1)          ─ BodyMetric (poids dans le temps)
      ├─ Goal ── Race                   ─ RaceStrategy (1-1)
      │    └─ TrainingPlan ── TrainingWeek ── Workout ──(1-1)── Activity
      ├─ FootballWeekTemplate
      ├─ Activity ─┬─ FootballSession | Match | TrailActivity | StrengthSession  (tables filles 1-1)
      │            ├─ StravaActivity (payload brut)
      │            ├─ GearUsage ── Gear ── Shoe
      │            └─ FuelingLog (glucides/h + symptômes digestifs)
      ├─ DailyCheckin → ReadinessScore (calculé)
      ├─ Sleep, Recovery (dont bain froid), InjuryNote
      ├─ TrainingLoad (1 ligne/jour, calculée)
      ├─ NutritionDay ── Meal ──(1-1)── PhotoAnalysis
      ├─ Hydration, SweatTest
      ├─ AIConversation ── AIMessage
      ├─ AthleteMemory, AIRecommendation
      ├─ TestResult, Notification
      └─ Integration (tokens chiffrés), Session (auth)
```

## 4.2 Correspondance avec la liste demandée

| Demandé | Modèle | Remarque |
|---|---|---|
| User | `User` | |
| AthleteProfile | `AthleteProfile` | inclut saison foot, trêve, préférences nutrition, taux de sudation |
| Goal / Race | `Goal`, `Race` | un objectif peut viser une course réelle ou être « custom » |
| TrainingPlan / TrainingWeek / Workout | idem | `TrainingPlan.inputs` fige les entrées → plan reproductible ; `Workout.originalPlan` garde la version avant adaptation |
| Activity | `Activity` | table pivot unique, toutes sources |
| FootballSession, Match, TrailActivity, StrengthSession | idem | tables filles 1-1 d'`Activity` (`Match` peut exister avant d'être joué) |
| StravaActivity | `StravaActivity` | payload brut conservé pour ré-analyse |
| Sleep, DailyCheckin, Recovery | idem | bain froid = `Recovery(type="cold_bath", temperatureC, durationMin, nextDayLegs)` |
| Nutrition, Meal, Hydration | `NutritionDay`, `Meal`, `Hydration` (+ `SweatTest`, `FuelingLog`) | |
| Gear, Shoe | `Gear`, `Shoe`, `GearUsage` | km chaussure = `initialKm + Σ GearUsage.km` |
| InjuryNote | `InjuryNote` | |
| AIConversation, AIRecommendation | idem + `AIMessage` | |
| TrainingLoad, ReadinessScore | idem | valeurs **calculées**, recalculables |
| PhotoAnalysis | `PhotoAnalysis` | |
| — (ajouts) | `AthleteMemory`, `Integration`, `TestResult`, `Notification`, `BodyMetric`, `FootballWeekTemplate`, `RaceStrategy`, `Session` | nécessaires aux fonctions décrites |

## 4.3 Règles de conception

1. **Données saisies vs calculées** : les tables calculées (`TrainingLoad`, `ReadinessScore`, `NutritionDay`) peuvent être supprimées et régénérées par le moteur à partir des données brutes.
2. **`day` en `@db.Date`** = date locale de l'athlète (fuseau `User.timezone`), `at`/`startAt` en UTC. Évite les bugs « séance de 23 h comptée le lendemain ».
3. **JSONB** uniquement pour ce qui est structuré mais variable (blocs de séance, produits de ravitaillement, sortie IA). Tout ce qui est filtré ou agrégé est en colonne.
4. **Streams GPS/FC hors base** (R2, JSON gzip, ~100-500 Ko/activité) ; seule la clé est stockée.
5. **Contraintes d'unicité** pour l'idempotence des imports : `@@unique([userId, source, externalId])`.
6. **Traçabilité** : chaque recommandation garde ses entrées (`AIRecommendation.reasoning`) et la version du moteur.

## 4.4 Index de requêtes critiques

- Écran Aujourd'hui : `Workout(userId, day)`, `ReadinessScore(userId, day)`, `NutritionDay(userId, day)`, `Match(userId, kickoffAt)`.
- Charge : `Activity(userId, day)` sur 56 jours.
- Contexte IA : `AthleteMemory(userId, kind, active)`.
- Notifications : `Notification(scheduledFor, sentAt)`.
