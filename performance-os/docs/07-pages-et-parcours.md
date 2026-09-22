# 7. Pages de l'application & parcours utilisateur

## 7.1 Navigation

- **Mobile** : barre du bas avec 5 onglets : `Aujourd'hui` · `Planning` · `+` (saisie rapide) · `Coach` · `Plus`.
- **Desktop / tablette** : sidebar gauche repliable avec les mêmes sections, plus un accès direct aux modules.

## 7.2 Arborescence

| Route | Page | Contenu principal |
|-------|------|-------------------|
| `/onboarding` | Onboarding (6 étapes) | Profil → foot → objectifs → niveau trail → alimentation → montres |
| `/` → `/dashboard` | **Aujourd'hui** | Voir 7.3 |
| `/checkin` | Check-in matinal | 6 sliders, sommeil, douleur (silhouette), FC repos / HRV |
| `/planning` | Semaine | 7 colonnes (desktop) / liste (mobile), séances prévues et réalisées, validation des séances clés, « Pourquoi cette semaine » |
| `/calendar` | Calendrier | Mois / semaine, codes couleur, glisser-déposer + aperçu d'impact |
| `/activities` | Historique | Liste filtrable, détail séance, import FIT/GPX |
| `/activities/new` | Saisie séance | Formulaire adapté au type |
| `/load` | Charge | Barres empilées foot / trail / renfo, courbe 7 j / 28 j, ACWR, monotonie, alertes |
| `/sleep` | Sommeil | Coucher / lever recommandés, sommeil réel, dette, moyenne 7 j, conseils |
| `/recovery` | Récupération | Recos du jour, bain froid (décision + journal), routines de mobilité |
| `/nutrition` | Nutrition du jour | Macros cibles vs réalisé, repas du jour avec alternatives, journal |
| `/nutrition/week` | Semaine & courses | Plan sur 7 jours, liste de courses cochable |
| `/match-day` | Jour de match | Timeline heure par heure, calculée depuis le coup d'envoi |
| `/hydration` | Hydratation | Jauge du jour, saisie rapide, tests de sudation, recommandations foot / match / trail |
| `/ultra` | Espace ultra | Indicateurs, courbe de progression, jalons, confiance, compte à rebours |
| `/ultra/fueling` | Entraînement digestif | Palier actuel, historique g/h et symptômes, bibliothèque de produits, plan de ravito |
| `/strength` | Renforcement | Séances prévues, bibliothèque d'exercices (vidéo / gif en V2), progression |
| `/coach` | Coach IA | Chat, suggestions de questions, cartes d'action (enregistrer, accepter une modif) |
| `/goals` | Objectifs | Ultra 80, Dodo, Foot N2 ; jalons ; confiance |
| `/settings` | Réglages | Profil, template foot, préférences, notifications, intégrations, staff, export / suppression des données |

## 7.3 Dashboard « Aujourd'hui » (ordre d'affichage mobile)

1. **En-tête** : date, J-x avant le prochain match, phase actuelle (« BASE 2 · semaine 2/4 »).
2. **Bandeau d'alerte** (si alerte WARNING+).
3. **Trois anneaux** : Forme /100 (grand, couleur de zone), Récupération, Sommeil. Tap → détail de la décomposition du score.
4. **« Ce que tu dois faire aujourd'hui »** : 5–8 actions cochables, par exemple :
   - 💧 2,8 L d'eau · 🍝 420 g de glucides · 🥩 135 g de protéines
   - 🛏️ Coucher avant 22 h 45
   - 🧘 15 min de mobilité
   - 🚫 Pas de trail aujourd'hui (grosse séance foot)
   - 🧊 Bain froid conseillé après la séance
   - 🍌 Collation dans les 30 min après l'entraînement
5. **Séance du jour** : carte avec l'objectif, la durée, le D+ et les consignes ; badge « ajustée » avec la raison si le moteur a modifié la séance.
6. **Charge** : mini-graphe 14 j, charge semaine vs précédente (%), risque de surcharge.
7. **Fatigue musculaire** : jauge.
8. **Semaine trail** : volume et D+ prévus vs réalisés.
9. **Prochain match / prochaine séance.**
10. **Besoins du jour** : kcal, G/P/L, eau, sodium, sommeil recommandé.
11. **Dernière séance** : durée, km, D+, FC moy, kcal, RPE, charge.

Desktop : grille 12 colonnes. Les points 3–4 en haut à gauche, 5–6 à droite, le reste en cartes dessous.

## 7.4 Design system

**Direction** : sombre, sportif, premium, dense mais lisible. Inspiration fonctionnelle Whoop / TrainingPeaks / Garmin, **sans reprendre** leurs codes visuels (pas de vert Whoop, pas de bleu Garmin).

| Token | Valeur proposée |
|-------|-----------------|
| Fond | `#0B0D10` (presque noir, légèrement bleuté) |
| Surface | `#14171C` / surface haute `#1C2027` |
| Bordure | `#262B33` |
| Texte | `#F2F4F7` / secondaire `#9BA3AF` |
| Accent marque | `#FF5A1F` (orange « effort ») |
| Zones | vert `#22C55E` · jaune `#EAB308` · orange `#F97316` · rouge `#EF4444` |
| Domaines | Foot `#3B82F6` · Match `#6366F1` · Trail `#F59E0B` · Renfo `#A855F7` · Récup `#14B8A6` · Repos `#4B5563` · Objectif `#FF5A1F` |
| Typo | **Inter** (UI) + **JetBrains Mono** ou chiffres tabulaires pour les métriques |
| Rayons | 16 px (cartes), 10 px (contrôles) |
| Mouvement | Transitions de 150–200 ms, anneaux animés au chargement, respect de `prefers-reduced-motion` |

Règles :
- Un chiffre clé par carte, en gros.
- Le contexte en petit dessous (« vs 7 j : +12 % »).
- Les couleurs de zone ne servent **qu'aux** états (jamais en décoration).
- Contraste AA minimum ; les états ne reposent jamais uniquement sur la couleur (icône + texte).

## 7.5 Parcours utilisateur

### P1. Onboarding (≈ 5 min, une seule fois)
1. Création du compte (magic link ou passkey).
2. Profil physique.
3. Template foot pré-rempli, à confirmer (horaires).
4. Import du calendrier des matchs (.ics) ou saisie des prochains matchs.
5. Objectifs : dates ultra et Dodo, dates de trêve et de fin de saison.
6. Niveau trail actuel (volume 4 semaines, plus longue sortie).
7. Préférences alimentaires et allergies.
8. Montre (ou « plus tard ») et notifications.
9. Le moteur génère le macrocycle et la semaine 1. Écran « Voici ton plan jusqu'en juin 2027 » avec les phases.

### P2. Matin (≈ 1 min, tous les jours)
Notification « Check-in » → 6 sliders + douleur → écran résultat (forme, zone) → dashboard mis à jour, avec la séance ajustée et expliquée si nécessaire.

### P3. Après une séance
Notification « Comment était ta séance ? » 30 min après la fin prévue → RPE (et import auto si montre) → si trail ≥ 90 min : nutrition consommée et questionnaire digestif → recos post-effort (collation, bain froid oui/non, mobilité).

### P4. Veille et jour de match
- Vendredi : carte « Demain match à 17 h » → plan glucidique, coucher recommandé, rappel des affaires (gourde, collation).
- Samedi : timeline `/match-day` avec notifications aux heures clés → après le match : minutes jouées + RPE → protocole de récup.
- Dimanche : séance conditionnelle résolue automatiquement selon le temps de jeu.

### P5. Sortie longue
- Veille : plan glucidique + ravito généré (« Demain : 2 h 30, 900 D+, vise 50 g/h : gel à 30′, 50′, 70′… ») + liste de ce qu'il faut emporter.
- Après : saisie ou import → g/h réels → symptômes → nouveau palier.
- J+2 : question « jambes aujourd'hui ? », qui sert à la validation des jalons.

### P6. Bilan hebdomadaire (dimanche soir, ≈ 3 min)
Résumé : charge vs prévu, sommeil, compliance, douleurs, progrès ultra → le moteur propose S+1 → l'athlète valide (ou demande une modif au coach) → liste de courses générée.

### P7. Douleur
Check-in avec une douleur ≥ 3 → questions de contexte (zone, type, depuis quand, ce qui l'aggrave) → séances adaptées → si critère d'orientation atteint : carte « Consulte un kiné ou un médecin » (non masquable pendant 24 h) + séances d'impact bloquées → reprise déclarée par l'athlète après avis d'un professionnel.

### P8. Conversation avec le coach
Question libre → réponse contextualisée avec les chiffres cités → éventuelles cartes d'action (« Enregistrer ce match », « Appliquer : sortie de jeudi réduite à 75 min ») → confirmation en un tap → mise à jour du moteur.
