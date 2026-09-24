# 2. Pages, navigation et dashboard

Mobile-first (PWA installée sur l'écran d'accueil). Navigation basse à 5 onglets + bouton central.

```
[ Aujourd'hui ]  [ Plan ]  ( + )  [ Coach ]  [ Progrès ]
                            │
        check-in · séance · repas · photo · boisson · bain froid · douleur
```

## 2.1 Arborescence complète

| Route | Page | Contenu clé | Version |
|---|---|---|---|
| `/onboarding` | Onboarding (6 écrans) | Profil physique, football (niveau, poste, semaine type, fin de saison, trêve), objectif/course, niveau course actuel (volume, plus longue sortie, récentes perfs), nutrition (goûts, allergies, budget), connexions | MVP |
| `/` | **Aujourd'hui** | Voir 2.2 | MVP |
| `/checkin` | Check-in matin | 10 curseurs + FC repos/HRV + texte libre, < 60 s | MVP |
| `/plan` | Plan — semaine | 7 jours, foot + trail + muscu, glisser-déposer, statut (prévu/adapté/fait) | MVP |
| `/plan/week/edit` | Semaine football | Modifier les jours foot de la semaine (intensité, match déplacé, pas de match) → recalcul | MVP |
| `/plan/timeline` | Timeline macro | Aujourd'hui → course, phases colorées, semaines allégées, trêve, fin de saison, courses B/C | MVP |
| `/workout/[id]` | Détail séance | Objectif, blocs (allure/FC/RPE), échauffement, retour au calme, nutrition pendant, checklist matériel, météo | MVP |
| `/activity/[id]` | Activité réalisée | Stats, carte, splits, **Analyse IA**, comparaison séance similaire, durabilité, ravitaillement + symptômes | MVP |
| `/log` | Saisie rapide | Séance manuelle (foot, match, muscu), RPE, minutes jouées | MVP |
| `/coach` | Chat coach IA | Conversation, pièces jointes photo, suggestions rapides, cartes d'action (« Appliquer cette séance ») | MVP |
| `/coach/memory` | Ce que le coach sait de moi | Liste des mémoires, sources, éditer/supprimer | V2 |
| `/nutrition` | Nutrition du jour | Cibles kcal/G/P/L/eau/sodium selon le type de journée, plan de repas A/B/C, journal | MVP (cibles) / V2 (plans) |
| `/nutrition/meal/new` | Photo repas | Analyse, estimation avec marge, confirmation | V2 |
| `/nutrition/fueling` | Ravitaillement effort | Progression g/h, produits testés, produits à éviter | V2 |
| `/hydration` | Hydratation | Suivi jour, test de sudation, recommandations ml/h + sodium/h | V2 |
| `/recovery` | Recovery Center | Actions conseillées du jour, tracker bain froid, historique d'efficacité ressentie | V2 |
| `/sleep` | Sommeil | Nuit, moyenne 7 j, dette, heure de coucher conseillée | MVP (manuel) |
| `/strength` | Renforcement | Séances courtes, exercices avec vidéo/description, progression | V2 |
| `/gear` | Matériel | Chaussures (km, usure), autres équipements, checklists | V2 |
| `/tests` | Tests | 5 km, 10 km, 20/30 min, VMA, montée, historique | V2 |
| `/progress` | Progrès | Voir 2.3 | MVP (charge) / V2 (complet) |
| `/race/[id]` | Plan de course | Profil, tronçons, allure, marche/course, ravitos, nutrition/h, matériel, mental, météo | V3 |
| `/settings/*` | Réglages | Profil, connexions, notifications, unités, export/suppression des données | MVP |

## 2.2 Écran d'accueil « Aujourd'hui »

Ordre = ordre de priorité de l'information. Tout ce qui est au-dessus de la ligne de flottaison répond à « qu'est-ce que je fais aujourd'hui ».

```
┌─────────────────────────────────────┐
│ Bonjour Lylian            jeu. 24/09│
│                                     │
│   ◯ 87   FORME                      │  ← anneau readiness, couleur selon tier
│   Récup 82 · Jambes 71 · Cardio 90  │
│   Sommeil 76                        │
│   "Entraîne-toi normalement, évite  │
│    une grosse séance excentrique."  │
├─────────────────────────────────────┤
│ AUJOURD'HUI                         │
│ Trail 12 km progressif · 60 min     │  ← tap → détail séance
│ MD-2 · descente max 150 m           │
├─────────────────────────────────────┤
│ Demain   Football léger             │
│ Match    samedi 18h (J-2)           │
├─────────────────────────────────────┤
│ Sommeil 8h12 │ Eau 2,7 L │ Nutrition│
│              │ /3,4 L    │ charge   │
│              │           │ modérée  │
├─────────────────────────────────────┤
│ ⚠ Charge +28 % vs ta moyenne        │  ← alertes (max 2)
├─────────────────────────────────────┤
│ Base aérobie · semaine 2/10         │
│ ▓▓░░░░░░░░░░░░░░░░░ J-275           │  ← timeline compacte
├─────────────────────────────────────┤
│ 💬 Demande à ton coach IA…          │
└─────────────────────────────────────┘
```

États : pas de check-in → bouton check-in à la place de l'anneau ; jour de match → carte « Match » + nutrition match ; repos → carte récupération.

## 2.3 Dashboard Progrès

Graphiques (Recharts), filtres 4 sem / 12 sem / depuis le début :

| Graphique | Type | Source |
|---|---|---|
| Charge quotidienne empilée foot/course/trail/muscu + aigu 7 j / chronique 28 j | barres empilées + 2 courbes | `TrainingLoad` |
| ACWR avec bande 0,8-1,3 | courbe + zone | `TrainingLoad` |
| Readiness 30 j | courbe + points de match | `ReadinessScore` |
| Volume course/sem + D+/sem | barres | `Activity` |
| Sortie la plus longue (distance et durée) | escalier | `Activity` |
| Allure en endurance fondamentale à FC fixe (ex. 140 bpm) | nuage + tendance | activités faciles |
| VO2max estimée | courbe | montre / estimation depuis tests |
| Durability score | points par sortie > 90 min | `Activity.durability` |
| Glucides/h tolérés | escalier | `FuelingLog` |
| Poids, sommeil moyen 7 j | courbes | `BodyMetric`, `Sleep` |
| Tests | tableau + delta | `TestResult` |

## 2.4 Design system

- **Palette** : fond `#0A0A0A` (dark par défaut) / `#FAFAFA` (light), gris neutres `#171717 → #A3A3A3`, **un seul accent** sportif (vert électrique `#C6FF3D` ou orange `#FF5A1F` — à trancher sur maquette). Couleurs sémantiques uniquement pour les états (readiness : vert/jaune/orange/rouge).
- **Typo** : Inter (UI) + chiffres tabulaires ; grands chiffres (score, distance) en poids 600-700.
- **Composants** : shadcn/ui (Card, Sheet, Tabs, Slider, Dialog, Toast) retouchés, pas de look « template ».
- **Principes** : un chiffre héros par carte ; toujours le *pourquoi* à un tap ; aucune donnée sans unité ; zones de tap ≥ 44 px ; tout utilisable d'une main.
- **Accessibilité** : contraste AA, états non portés uniquement par la couleur (icône + texte).
