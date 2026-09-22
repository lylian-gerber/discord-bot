# 3. Schéma de base de données

## 3.1 Choix de modélisation

- **Une table `Activity` unique + extensions 1:1 par sport** (`FootballDetails`, `TrailDetails`, `StrengthDetails`) plutôt que des tables `FootballSession` / `TrailSession` séparées.
  - Raison : la charge, le calendrier et l'historique requêtent toujours « toutes les séances ».
  - Des tables séparées obligeraient à faire des `UNION` partout.
  - Les entités demandées sont toutes présentes, simplement rattachées à `Activity`.
- **Match** = fixture du calendrier (connue à l'avance). Quand le match est joué, il est lié à une `Activity` (charge réelle, minutes jouées).
- **Prévu ≠ réalisé** : `PlannedSession` (= WorkoutPlan) est distinct de `Activity`. Le lien permet de mesurer la compliance.
- **`TrainingLoad`** est un agrégat quotidien matérialisé (recalculé à chaque modification d'activité), pour avoir des graphes rapides.
- **Versioning des plans** : une séance modifiée pointe vers l'originale (`originalId`), avec `modificationReason`.
- **`AIRecommendation`** stocke tout ce que le système recommande (moteur ou LLM), avec le payload structuré, pour l'audit.
- Mapping des entités demandées :

| Demandé | Implémentation |
|---------|----------------|
| User | `User` |
| AthleteProfile | `AthleteProfile` (+ `FootballWeekTemplate`) |
| FootballSession | `Activity` type `FOOTBALL_TRAINING` + `FootballDetails` |
| TrailSession | `Activity` type `TRAIL_RUN` + `TrailDetails` + `FuelLog` |
| Match | `Match` (fixture) ↔ `Activity` type `MATCH` |
| SleepEntry | `SleepEntry` |
| RecoveryEntry | `RecoveryEntry` |
| NutritionEntry | `NutritionEntry` |
| HydrationEntry | `HydrationEntry` + `SweatTest` |
| BodyMetric | `BodyMetric` |
| DailyReadiness | `DailyReadiness` + `PainReport` |
| TrainingLoad | `TrainingLoad` |
| MealPlan | `MealPlan` + `MealPlanItem` + `Food` + `ShoppingList` |
| WorkoutPlan | `WeekPlan` + `PlannedSession` (+ `TrainingPhase`) |
| Goal | `Goal` + `Milestone` |
| AIRecommendation | `AIRecommendation` + `Conversation` / `ChatMessage` / `AthleteMemory` |

## 3.2 Schéma Prisma

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

// ─────────────────────────── ENUMS ───────────────────────────

enum Role            { ATHLETE STAFF ADMIN }
enum Sex             { MALE FEMALE }
enum StaffRole       { HEAD_COACH FITNESS_COACH PHYSIO NUTRITIONIST DOCTOR OTHER }
enum DataSource      { MANUAL FIT_FILE GARMIN STRAVA APPLE_HEALTH INTERVALS_ICU }
enum ActivityType    { FOOTBALL_TRAINING MATCH TRAIL_RUN ROAD_RUN HIKE STRENGTH MOBILITY RECOVERY CROSS_TRAINING OTHER }
enum LoadDomain      { FOOTBALL TRAIL STRENGTH OTHER }
enum FootballIntensity { RECOVERY LIGHT MODERATE HARD PRE_MATCH }
enum DayType         { REST LIGHT MODERATE HARD PRE_MATCH MATCH POST_MATCH LONG_TRAIL BACK_TO_BACK }
enum ReadinessZone   { GREEN YELLOW ORANGE RED }
enum PlanStatus      { PLANNED ADJUSTED COMPLETED PARTIAL SKIPPED MOVED CANCELLED }
enum PlanOrigin      { TEMPLATE ENGINE USER AI_PROPOSAL STAFF }
enum ValidationState { NOT_REQUIRED PENDING APPROVED REJECTED }
enum PhaseType       { BASE_1 BASE_2 BUILD_1 BUILD_2 SPECIFIC TAPER RACE RECOVERY TRANSITION }
enum GoalType        { RACE FOOTBALL MILESTONE BODY OTHER }
enum GoalPriority    { A B C }
enum GoalStatus      { ACTIVE ACHIEVED MISSED ABANDONED }
enum MealSlot        { BREAKFAST MORNING_SNACK LUNCH AFTERNOON_SNACK PRE_WORKOUT INTRA_WORKOUT POST_WORKOUT DINNER EVENING_SNACK }
enum FuelCategory    { GEL DRINK BAR COMPOTE FRUIT SALTY CHEW SOLID OTHER }
enum GISymptom       { NONE BLOATING NAUSEA ABDOMINAL_PAIN VOMIT_URGE DIARRHEA HUNGER FOOD_AVERSION }
enum RecoveryType    { COLD_WATER_IMMERSION CONTRAST MOBILITY FOAM_ROLLING MASSAGE ACTIVE_RECOVERY COMPRESSION NAP SAUNA OTHER }
enum PainType        { DULL SHARP JOINT MUSCLE TENDON OTHER }
enum Side            { LEFT RIGHT BOTH CENTER }
enum RecoKind        { DAILY_BRIEF ALERT SESSION_ADJUSTMENT PLAN_CHANGE NUTRITION HYDRATION SLEEP RECOVERY HEALTH_REFERRAL CHAT }
enum Severity        { INFO WARNING CRITICAL }
enum RecoStatus      { ACTIVE ACKNOWLEDGED ACCEPTED REJECTED EXPIRED }
enum RecoSource      { ENGINE LLM STAFF }
enum ChatRole        { USER ASSISTANT TOOL SYSTEM }
enum MemoryCategory  { PREFERENCE CONSTRAINT HEALTH_CONTEXT EQUIPMENT GOAL_CONTEXT OTHER }

// ─────────────────────────── IDENTITY ───────────────────────────

model User {
  id         String          @id @default(cuid())
  email      String          @unique
  name       String?
  role       Role            @default(ATHLETE)
  createdAt  DateTime        @default(now())
  updatedAt  DateTime        @updatedAt
  athlete    AthleteProfile?
  staffLinks StaffLink[]     @relation("StaffUser")
}

model StaffLink {
  id          String         @id @default(cuid())
  athleteId   String
  athlete     AthleteProfile @relation(fields: [athleteId], references: [id], onDelete: Cascade)
  staffUserId String
  staffUser   User           @relation("StaffUser", fields: [staffUserId], references: [id], onDelete: Cascade)
  staffRole   StaffRole
  canValidate Boolean        @default(true)
  canSeeHealth Boolean       @default(false)
  createdAt   DateTime       @default(now())

  @@unique([athleteId, staffUserId])
}

// ─────────────────────────── ATHLETE ───────────────────────────

model AthleteProfile {
  id                 String   @id @default(cuid())
  userId             String   @unique
  user               User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  birthDate          DateTime @db.Date
  sex                Sex
  heightCm           Float
  targetWeightKg     Float?
  timezone           String   @default("Europe/Paris")
  footballLevel      String   @default("National 2")
  position           String?
  hrMax              Int?
  hrRestBaseline     Int?
  habitualWakeTime   String   @default("07:30") // HH:mm
  sleepNeedMin       Int      @default(510)     // 8h30, ajusté par la charge
  caffeineCutoff     String?  @default("14:00")
  sweatSodiumMgPerL  Int      @default(800)     // défaut prudent tant qu'aucun test
  foodDislikes       String[]
  foodAllergies      String[]
  dietaryPattern     String?  // omnivore, pesco, végé…
  injuryHistory      Json?    // [{zone, year, note}], contexte uniquement
  seasonStart        DateTime? @db.Date
  seasonEnd          DateTime? @db.Date
  winterBreakStart   DateTime? @db.Date
  winterBreakEnd     DateTime? @db.Date
  createdAt          DateTime @default(now())
  updatedAt          DateTime @updatedAt

  footballTemplate   FootballWeekTemplate[]
  activities         Activity[]
  matches            Match[]
  phases             TrainingPhase[]
  weekPlans          WeekPlan[]
  plannedSessions    PlannedSession[]
  readiness          DailyReadiness[]
  pains              PainReport[]
  sleep              SleepEntry[]
  bodyMetrics        BodyMetric[]
  loads              TrainingLoad[]
  recovery           RecoveryEntry[]
  nutrition          NutritionEntry[]
  mealPlans          MealPlan[]
  shoppingLists      ShoppingList[]
  hydration          HydrationEntry[]
  sweatTests         SweatTest[]
  fuelProducts       FuelProduct[]
  goals              Goal[]
  recommendations    AIRecommendation[]
  conversations      Conversation[]
  memories           AthleteMemory[]
  integrations       Integration[]
  staffLinks         StaffLink[]
}

/// Planning football fixe (lun léger, mar modéré, …)
model FootballWeekTemplate {
  id           String            @id @default(cuid())
  athleteId    String
  athlete      AthleteProfile    @relation(fields: [athleteId], references: [id], onDelete: Cascade)
  dayOfWeek    Int               // 1 = lundi … 7 = dimanche (ISO)
  kind         ActivityType      // FOOTBALL_TRAINING | MATCH | (vide = pas de foot)
  intensity    FootballIntensity?
  startTime    String?           // HH:mm
  durationMin  Int?
  expectedRpe  Int?

  @@unique([athleteId, dayOfWeek, kind])
}

// ─────────────────────────── ACTIVITIES ───────────────────────────

model Activity {
  id               String        @id @default(cuid())
  athleteId        String
  athlete          AthleteProfile @relation(fields: [athleteId], references: [id], onDelete: Cascade)
  type             ActivityType
  loadDomain       LoadDomain
  source           DataSource    @default(MANUAL)
  externalId       String?
  startAt          DateTime
  durationMin      Int
  movingTimeMin    Int?
  rpe              Int?          // CR-10 (1–10)
  sessionLoad      Int?          // rpe × durationMin (calculé)
  distanceKm       Float?
  elevationGainM   Int?
  elevationLossM   Int?
  avgHr            Int?
  maxHr            Int?
  hrZonesSec       Json?         // {z1: 1200, z2: 2400, …}
  kcal             Int?
  tempC            Float?
  humidityPct      Float?
  notes            String?
  plannedSessionId String?       @unique
  plannedSession   PlannedSession? @relation(fields: [plannedSessionId], references: [id])
  createdAt        DateTime      @default(now())
  updatedAt        DateTime      @updatedAt

  football         FootballDetails?
  trail            TrailDetails?
  strength         StrengthDetails?
  match            Match?
  fuelLogs         FuelLog[]
  recoveryEntries  RecoveryEntry[]
  sweatTest        SweatTest?

  @@unique([source, externalId])
  @@index([athleteId, startAt])
}

model FootballDetails {
  activityId String            @id
  activity   Activity          @relation(fields: [activityId], references: [id], onDelete: Cascade)
  intensity  FootballIntensity
  focus      String?           // tactique, athlétique, jeu réduit…
  highSpeedM Int?              // si GPS club disponible (V2)
  sprints    Int?
}

model TrailDetails {
  activityId      String      @id
  activity        Activity    @relation(fields: [activityId], references: [id], onDelete: Cascade)
  terrain         String?     // chemin, single, rocheux, route
  technicality    Int?        // 1–5
  maxAltitudeM    Int?
  kmEffort        Float?      // km + D+/100 (calculé)
  carbsTotalG     Int?
  fluidsTotalMl   Int?
  sodiumTotalMg   Int?
  carbsPerHour    Float?      // calculé depuis FuelLog
  giSymptoms      GISymptom[]
  giSeverity      Int?        // 0–10
  legsJ1          Int?        // état des jambes le lendemain, 1–10 (sert aux jalons)
  poles           Boolean     @default(false)
}

model StrengthDetails {
  activityId String   @id
  activity   Activity @relation(fields: [activityId], references: [id], onDelete: Cascade)
  exercises  Json     // [{exerciseId, sets:[{reps, kg, rpe}]}]
}

model FuelProduct {
  id          String         @id @default(cuid())
  athleteId   String
  athlete     AthleteProfile @relation(fields: [athleteId], references: [id], onDelete: Cascade)
  name        String
  category    FuelCategory
  carbsG      Float
  sodiumMg    Float          @default(0)
  fluidMl     Float          @default(0)
  caffeineMg  Float          @default(0)
  glucoseFructose Boolean    @default(false) // multi-transportable
  logs        FuelLog[]
}

model FuelLog {
  id          String       @id @default(cuid())
  activityId  String
  activity    Activity     @relation(fields: [activityId], references: [id], onDelete: Cascade)
  productId   String?
  product     FuelProduct? @relation(fields: [productId], references: [id])
  minuteMark  Int          // minute depuis le départ
  label       String
  category    FuelCategory
  carbsG      Float
  sodiumMg    Float        @default(0)
  fluidMl     Float        @default(0)
}

model Match {
  id            String         @id @default(cuid())
  athleteId     String
  athlete       AthleteProfile @relation(fields: [athleteId], references: [id], onDelete: Cascade)
  kickoffAt     DateTime
  opponent      String?
  isHome        Boolean?
  competition   String?        @default("National 2")
  minutesPlayed Int?
  started       Boolean?
  result        String?
  activityId    String?        @unique
  activity      Activity?      @relation(fields: [activityId], references: [id])

  @@index([athleteId, kickoffAt])
}

// ─────────────────────────── PLANNING ───────────────────────────

model TrainingPhase {
  id               String         @id @default(cuid())
  athleteId        String
  athlete          AthleteProfile @relation(fields: [athleteId], references: [id], onDelete: Cascade)
  type             PhaseType
  startDate        DateTime       @db.Date
  endDate          DateTime       @db.Date
  goalId           String?
  longRunMinRange  Json           // {min: 60, max: 90}
  weeklyTrailMin   Json           // {min, max}
  weeklyDplusM     Json           // {min, max}
  notes            String?
}

model WeekPlan {
  id               String         @id @default(cuid())
  athleteId        String
  athlete          AthleteProfile @relation(fields: [athleteId], references: [id], onDelete: Cascade)
  weekStart        DateTime       @db.Date     // lundi
  phase            PhaseType
  mesoWeek         Int                          // 1..4 dans le mésocycle
  isDeload         Boolean        @default(false)
  targetTrailMin   Int
  targetTrailKm    Float?
  targetDplusM     Int
  targetTotalLoad  Int
  rationale        String                        // explication générée
  version          Int            @default(1)
  generatedAt      DateTime       @default(now())
  sessions         PlannedSession[]

  @@unique([athleteId, weekStart, version])
}

/// = WorkoutPlan : une séance prévue
model PlannedSession {
  id                 String          @id @default(cuid())
  athleteId          String
  athlete            AthleteProfile  @relation(fields: [athleteId], references: [id], onDelete: Cascade)
  weekPlanId         String?
  weekPlan           WeekPlan?       @relation(fields: [weekPlanId], references: [id], onDelete: SetNull)
  date               DateTime        @db.Date
  startTime          String?
  type               ActivityType
  title              String
  description        String?
  targetDurationMin  Int?
  targetDistanceKm   Float?
  targetDplusM       Int?
  targetDminusMaxM   Int?            // plafond de descente (important en saison)
  targetRpe          Int?
  targetLoad         Int?
  intensityZone      String?         // "Z1-Z2", "RPE 3-4"
  structure          Json?           // blocs (échauffement, montée, etc.) ou exercices renfo
  fuelPlan           Json?           // plan de ravito pour séance ≥ 90 min
  isKeySession       Boolean         @default(false)
  validation         ValidationState @default(NOT_REQUIRED)
  validatedById      String?
  validatedAt        DateTime?
  status             PlanStatus      @default(PLANNED)
  origin             PlanOrigin      @default(ENGINE)
  originalId         String?
  original           PlannedSession? @relation("PlanVersions", fields: [originalId], references: [id])
  revisions          PlannedSession[] @relation("PlanVersions")
  modificationReason String?
  activity           Activity?
  createdAt          DateTime        @default(now())
  updatedAt          DateTime        @updatedAt

  @@index([athleteId, date])
}

// ─────────────────────────── WELLNESS ───────────────────────────

model DailyReadiness {
  id              String         @id @default(cuid())
  athleteId       String
  athlete         AthleteProfile @relation(fields: [athleteId], references: [id], onDelete: Cascade)
  date            DateTime       @db.Date
  sleepQuality    Int            // 1–10
  fatigue         Int            // 1–10 (10 = très fatigué)
  legFatigue      Int
  soreness        Int
  motivation      Int            // 10 = très motivé
  stress          Int
  hasPain         Boolean        @default(false)
  restingHr       Int?
  hrvRmssd        Float?
  // calculés
  sleepScore      Int?
  recoveryScore   Int?
  readinessScore  Int?
  zone            ReadinessZone?
  scoreBreakdown  Json?          // détail des composantes pour l'explicabilité
  createdAt       DateTime       @default(now())

  @@unique([athleteId, date])
}

model PainReport {
  id            String         @id @default(cuid())
  athleteId     String
  athlete       AthleteProfile @relation(fields: [athleteId], references: [id], onDelete: Cascade)
  date          DateTime       @db.Date
  bodyZone      String         // "mollet", "genou", "ischio", "tendon d'Achille"…
  side          Side
  intensity     Int            // 0–10
  type          PainType?
  worseningWith String?        // "descente", "sprint", "au repos"
  episodeId     String?        // regroupe les jours d'une même douleur
  resolvedAt    DateTime?
  referredToPro Boolean        @default(false)

  @@index([athleteId, bodyZone, date])
}

model SleepEntry {
  id          String         @id @default(cuid())
  athleteId   String
  athlete     AthleteProfile @relation(fields: [athleteId], references: [id], onDelete: Cascade)
  date        DateTime       @db.Date     // date du réveil
  bedtime     DateTime
  wakeTime    DateTime
  totalMin    Int
  quality     Int?                         // 1–10
  deepMin     Int?
  remMin      Int?
  awakenings  Int?
  napMin      Int?           @default(0)
  source      DataSource     @default(MANUAL)

  @@unique([athleteId, date])
}

model BodyMetric {
  id          String         @id @default(cuid())
  athleteId   String
  athlete     AthleteProfile @relation(fields: [athleteId], references: [id], onDelete: Cascade)
  date        DateTime       @db.Date
  weightKg    Float?
  bodyFatPct  Float?
  source      DataSource     @default(MANUAL)

  @@unique([athleteId, date])
}

// ─────────────────────────── LOAD ───────────────────────────

model TrainingLoad {
  id             String         @id @default(cuid())
  athleteId      String
  athlete        AthleteProfile @relation(fields: [athleteId], references: [id], onDelete: Cascade)
  date           DateTime       @db.Date
  footballLoad   Int            @default(0)
  trailLoad      Int            @default(0)
  strengthLoad   Int            @default(0)
  otherLoad      Int            @default(0)
  totalLoad      Int            @default(0)
  trailMin       Int            @default(0)
  trailKm        Float          @default(0)
  trailDplusM    Int            @default(0)
  trailDminusM   Int            @default(0)
  acuteEwma      Float?         // ~7 j
  chronicEwma    Float?         // ~28 j
  acwr           Float?
  weekLoad       Int?           // somme 7 j glissants
  weekChangePct  Float?         // vs 7 j précédents
  monotony       Float?
  strain         Float?

  @@unique([athleteId, date])
}

// ─────────────────────────── RECOVERY ───────────────────────────

model RecoveryEntry {
  id             String         @id @default(cuid())
  athleteId      String
  athlete        AthleteProfile @relation(fields: [athleteId], references: [id], onDelete: Cascade)
  date           DateTime       @db.Date
  type           RecoveryType
  durationMin    Int
  waterTempC     Float?
  feelingBefore  Int?           // 1–10
  feelingAfter   Int?
  activityId     String?
  activity       Activity?      @relation(fields: [activityId], references: [id])
  notes          String?
}

// ─────────────────────────── NUTRITION ───────────────────────────

model Food {
  id          String   @id @default(cuid())
  ciqualCode  String?  @unique
  name        String
  category    String   // féculent, fruit, protéine animale…
  kcal100     Float
  carbs100    Float
  protein100  Float
  fat100      Float
  fiber100    Float?
  sodium100   Float?   // mg
  tags        String[] // LOW_FIBER, PRE_MATCH_OK, POST_WORKOUT, PORTABLE…
  unitLabel   String?  // "1 banane", "1 tranche"
  unitGrams   Float?
}

model MealPlan {
  id          String         @id @default(cuid())
  athleteId   String
  athlete     AthleteProfile @relation(fields: [athleteId], references: [id], onDelete: Cascade)
  date        DateTime       @db.Date
  dayType     DayType
  kcal        Int
  carbsG      Int
  proteinG    Int
  fatG        Int
  waterMl     Int
  sodiumMg    Int
  items       MealPlanItem[]
  generatedAt DateTime       @default(now())

  @@unique([athleteId, date])
}

model MealPlanItem {
  id           String   @id @default(cuid())
  mealPlanId   String
  mealPlan     MealPlan @relation(fields: [mealPlanId], references: [id], onDelete: Cascade)
  slot         MealSlot
  time         String   // HH:mm
  title        String
  foods        Json     // [{foodId, grams, label}]
  kcal         Int
  carbsG       Int
  proteinG     Int
  fatG         Int
  waterMl      Int
  alternatives Json?    // [{replaces: foodId, options:[{foodId, grams}]}]
  entries      NutritionEntry[]
}

model NutritionEntry {
  id           String         @id @default(cuid())
  athleteId    String
  athlete      AthleteProfile @relation(fields: [athleteId], references: [id], onDelete: Cascade)
  date         DateTime       @db.Date
  slot         MealSlot
  planItemId   String?
  planItem     MealPlanItem?  @relation(fields: [planItemId], references: [id])
  adherence    String?        // FOLLOWED | PARTIAL | OTHER
  description  String?
  kcal         Int?
  carbsG       Int?
  proteinG     Int?
  fatG         Int?
  estimatedByAi Boolean       @default(false)
}

model ShoppingList {
  id         String         @id @default(cuid())
  athleteId  String
  athlete    AthleteProfile @relation(fields: [athleteId], references: [id], onDelete: Cascade)
  weekStart  DateTime       @db.Date
  items      Json           // [{foodId, label, totalGrams, aisle, checked}]

  @@unique([athleteId, weekStart])
}

// ─────────────────────────── HYDRATION ───────────────────────────

model HydrationEntry {
  id         String         @id @default(cuid())
  athleteId  String
  athlete    AthleteProfile @relation(fields: [athleteId], references: [id], onDelete: Cascade)
  at         DateTime
  volumeMl   Int
  sodiumMg   Int            @default(0)
  drinkType  String?        // eau, boisson effort, café…

  @@index([athleteId, at])
}

model SweatTest {
  id              String         @id @default(cuid())
  athleteId       String
  athlete         AthleteProfile @relation(fields: [athleteId], references: [id], onDelete: Cascade)
  activityId      String?        @unique
  activity        Activity?      @relation(fields: [activityId], references: [id])
  date            DateTime       @db.Date
  context         String         // FOOTBALL | TRAIL | MATCH | OTHER
  preWeightKg     Float
  postWeightKg    Float
  fluidIntakeMl   Int
  urineMl         Int            @default(0)
  durationMin     Int
  tempC           Float?
  humidityPct     Float?
  sweatRateLph    Float          // calculé
  bodyMassLossPct Float          // calculé
}

// ─────────────────────────── GOALS ───────────────────────────

model Goal {
  id               String         @id @default(cuid())
  athleteId        String
  athlete          AthleteProfile @relation(fields: [athleteId], references: [id], onDelete: Cascade)
  type             GoalType
  priority         GoalPriority
  title            String         // "Ultra 80 km", "Dodo Trail", "Performance N2"
  targetDate       DateTime?      @db.Date
  distanceKm       Float?
  elevationGainM   Int?
  outcome          String?        // "finir", "performer", "maintenir"
  isHardConstraint Boolean        @default(false) // true pour le football
  status           GoalStatus     @default(ACTIVE)
  milestones       Milestone[]
}

model Milestone {
  id          String    @id @default(cuid())
  goalId      String
  goal        Goal      @relation(fields: [goalId], references: [id], onDelete: Cascade)
  order       Int
  label       String    // "Sortie 25 km / 900 D+"
  criteria    Json      // {minKm, minDplus, minDurationMin, maxLegsJ2: 5, noPain: true}
  targetWeek  DateTime? @db.Date
  achievedAt  DateTime?
  activityId  String?
}

// ─────────────────────────── IA ───────────────────────────

model AIRecommendation {
  id                String         @id @default(cuid())
  athleteId         String
  athlete           AthleteProfile @relation(fields: [athleteId], references: [id], onDelete: Cascade)
  date              DateTime       @db.Date
  kind              RecoKind
  severity          Severity       @default(INFO)
  source            RecoSource
  ruleId            String?        // ex. "LOAD_SPIKE_WEEK", "NO_TRAIL_J-1"
  title             String
  body              String
  payload           Json?          // données utilisées + action structurée
  plannedSessionId  String?
  status            RecoStatus     @default(ACTIVE)
  modelUsed         String?
  createdAt         DateTime       @default(now())

  @@index([athleteId, date])
}

model Conversation {
  id         String         @id @default(cuid())
  athleteId  String
  athlete    AthleteProfile @relation(fields: [athleteId], references: [id], onDelete: Cascade)
  title      String?
  summary    String?        // résumé glissant pour le contexte long
  createdAt  DateTime       @default(now())
  messages   ChatMessage[]
}

model ChatMessage {
  id             String       @id @default(cuid())
  conversationId String
  conversation   Conversation @relation(fields: [conversationId], references: [id], onDelete: Cascade)
  role           ChatRole
  content        String
  toolCalls      Json?
  createdAt      DateTime     @default(now())
}

model AthleteMemory {
  id          String         @id @default(cuid())
  athleteId   String
  athlete     AthleteProfile @relation(fields: [athleteId], references: [id], onDelete: Cascade)
  category    MemoryCategory
  content     String         // "N'aime pas le riz", "Chaussures : Speedgoat 6"
  sourceMsgId String?
  active      Boolean        @default(true)
  createdAt   DateTime       @default(now())
}

model Integration {
  id              String         @id @default(cuid())
  athleteId       String
  athlete         AthleteProfile @relation(fields: [athleteId], references: [id], onDelete: Cascade)
  provider        DataSource
  accessTokenEnc  String
  refreshTokenEnc String?
  expiresAt       DateTime?
  scope           String?
  lastSyncAt      DateTime?

  @@unique([athleteId, provider])
}
```

## 3.3 Index et performances

- Toutes les requêtes temporelles passent par `(athleteId, date|startAt)` : les index sont en place.
- `TrainingLoad` évite de recalculer les fenêtres 7/28 jours à chaque affichage.
- Au volume attendu (un athlète, environ 15 activités par semaine), PostgreSQL sans TimescaleDB suffit largement.
- Les traces GPS complètes ne sont **pas** stockées en base au MVP. Seul un résumé est conservé (V2 : stockage objet S3/R2 si on veut des cartes).
