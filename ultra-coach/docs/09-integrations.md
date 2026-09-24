# 9. Intégrations (Strava en priorité)

## 9.1 Strava

**Flux OAuth 2.0** : `GET https://www.strava.com/oauth/authorize?client_id…&scope=read,activity:read_all,profile:read_all&approval_prompt=auto` → callback → échange du code → `access_token` (6 h) + `refresh_token` → stockés chiffrés dans `Integration`. Rafraîchissement automatique avant chaque appel si expiration < 5 min.

**Webhooks** : un abonnement unique pour l'application (`POST /push_subscriptions`), validation `hub.challenge` en GET. Les événements (`create`/`update`/`delete` d'activité, révocation de l'athlète) arrivent en POST sur `/api/webhooks/strava` : **répondre en < 2 s**, puis traiter dans un job.

**Import d'une activité** :
- `GET /activities/{id}` : distance, moving/elapsed time, dénivelé, FC moy/max, cadence, puissance moyenne, calories, `sport_type`, `gear_id`, laps, splits, polyline, segment efforts.
- `GET /activities/{id}/streams?keys=time,distance,altitude,heartrate,cadence,watts,velocity_smooth,grade_smooth,moving,latlng&key_by_type=true` → transformé en `StreamPoint[]` pour le moteur (durabilité, GAP, découplage), stocké en R2.
- Mapping `sport_type` : `Run` → running, `TrailRun` → trail, `Hike` → hiking, `Walk` → walking, `Ride`/`VirtualRide`/`GravelRide` → cycling, `Soccer` → football, `WeightTraining` → strength.
- RPE absent de Strava → notification « RPE de ta séance ? » (1 tap) ; à défaut, RPE estimé depuis la FC (marqué comme estimé).

**Historique** : import initial des 12 dernières semaines pour amorcer la charge chronique et les baselines.

**Contraintes à connaître (réelles)** :
- Limites de requêtes par défaut basses (de l'ordre de 100 req/15 min et 1 000/jour, à vérifier dans la console) → import historique étalé, streams récupérés à la demande.
- Une nouvelle application Strava est limitée à **1 athlète connecté** (toi) tant qu'elle n'a pas été validée par Strava : suffisant pour la V1, bloquant pour un produit multi-utilisateurs.
- **Conditions d'utilisation de l'API Strava** (mises à jour fin 2024) : interdiction d'utiliser les données Strava pour **entraîner** des modèles d'IA et d'afficher les données d'un athlète à d'autres utilisateurs. Analyser tes propres données pour toi avec un LLM, sans entraînement, est l'usage visé ici — mais **relis les conditions en vigueur avant d'aller au-delà d'un usage personnel**, c'est un vrai risque juridique pour un produit commercial.
- Rester conforme aux règles de marque (« Powered by Strava », lien vers l'activité d'origine).

## 9.2 Autres sources — faisabilité réelle

| Source | Accès | Faisabilité | Version |
|---|---|---|---|
| **Saisie manuelle + captures** | — | Immédiate | MVP |
| **Strava** | OAuth public | Immédiate pour 1 athlète | MVP |
| **Open-Meteo** | Sans clé | Immédiate | MVP |
| **Apple Health / Apple Watch** | HealthKit **uniquement depuis une app iOS native** : aucune API web, une PWA ne peut pas y accéder | Contournement MVP : **Raccourci iOS** (automatisation quotidienne qui lit sommeil / FC repos / HRV dans Santé et les envoie en POST à l'API avec un jeton personnel). Solution propre : app Expo en V3 | V2 (raccourci) / V3 (natif) |
| **Garmin Connect** | Garmin Connect Developer Program (Health API + Activity API) : **candidature et validation par Garmin** requises | Demander l'accès tôt ; en attendant, les activités Garmin arrivent via Strava | V2-V3 |
| **Whoop** | API développeur OAuth (sommeil, récupération, strain, HRV) | Bonne | V2 |
| **Coros** | API partenaire sur demande | Incertaine ; via Strava en attendant | V3 |
| **Polar** | AccessLink API ouverte | Bonne | V3 |

**Stratégie** : Strava sert de « hub » d'activités pour toutes les montres dès le MVP. Les intégrations directes servent surtout au **bien-être** (sommeil, HRV, FC repos) que Strava ne fournit pas.

## 9.3 Architecture d'intégration

Interfaces `ActivityProvider` / `WellnessProvider` (voir 03-architecture), données normalisées, dédoublonnage par heure de début/durée, priorité de source configurable (ex. FC Garmin > FC Strava pour la même activité), journal de synchro par provider (`Integration.lastSyncAt`, erreurs).
