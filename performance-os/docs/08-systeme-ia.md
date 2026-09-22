# 8. Système IA

## 8.1 Rôle de l'IA (et ce qu'elle ne fait pas)

| L'IA fait | L'IA ne fait pas |
|-----------|------------------|
| Explique les décisions du moteur en langage naturel | Calculer des macros, des charges ou des volumes « de tête » |
| Répond aux questions en s'appuyant sur les données | Modifier le plan directement |
| Extrait des données structurées de messages libres (« j'ai joué 90 min hier ») | Enregistrer quoi que ce soit sans confirmation |
| Propose des modifications, qui repassent par le moteur | Contourner une règle dure (doc 6.2) |
| Rédige le brief quotidien et la justification hebdo | Diagnostiquer une blessure ou une pathologie |
| Détecte les signaux d'alarme dans le texte | Rassurer sur une douleur (« ce n'est rien ») |

## 8.2 Architecture

```
Message utilisateur
   │
   ▼
[1] Filtre de sécurité pré-LLM (déterministe)
     mots-clés / motifs : douleur thoracique, malaise, perte de connaissance, palpitations,
     essoufflement au repos, sang, fièvre + effort, idées noires, troubles alimentaires…
     → si détecté : réponse de sécurité prioritaire + orientation (médecin / 15 / 112 / 3114)
   │
   ▼
[2] Construction du contexte (packages/ai/context)
     « Athlete Snapshot » JSON compact (~2–4 k tokens), toujours injecté :
       - profil (poids, âge, poste, préférences, contraintes, mémoires actives)
       - objectifs + phase actuelle + semaines restantes
       - aujourd'hui : check-in, forme et décomposition, séance prévue / ajustée
       - 14 derniers jours : charge / jour par domaine, sommeil, forme
       - 7 prochains jours : plan, matchs (heures)
       - douleurs actives (zone, intensité, durée)
       - nutrition : cibles du jour, palier digestif, dernier taux de sudation
       - alertes actives
       - résumé glissant de la conversation
   │
   ▼
[3] LLM (Claude) + outils (tool use)
   │
   ▼
[4] Validation post-LLM
     - les propositions de modification passent par core.planning.validate()
     - vérification que les chiffres cités correspondent au snapshot
       (contrôle des nombres critiques : volumes, glucides, eau)
     - ajout automatique du rappel santé si une douleur est évoquée
   │
   ▼
Réponse + cartes d'action (à confirmer par l'utilisateur)
```

## 8.3 Outils exposés au LLM

| Outil | Rôle | Effet de bord |
|-------|------|---------------|
| `get_activity_history(from, to, type?)` | Détail des séances au-delà du snapshot | Lecture |
| `get_load_metrics(from, to)` | Charges, ACWR, monotonie | Lecture |
| `get_sleep_history(days)` | Sommeil détaillé | Lecture |
| `get_nutrition_targets(date)` | Cibles calculées par le moteur | Lecture |
| `get_match_day_plan(kickoff)` | Timeline du jour de match (moteur) | Lecture |
| `simulate_session(date, params)` | « Est-ce que je peux faire 20 km demain ? » → le moteur évalue règles, charge et forme projetée | Lecture (simulation) |
| `propose_session_change(sessionId, changes, reason)` | Crée une **proposition** (`AIRecommendation` PENDING) validée par le moteur | Écriture différée, confirmation requise |
| `propose_log_entry(type, data)` | « J'ai joué 90 min hier » → brouillon de `Activity` / `Match` | Écriture différée, confirmation requise |
| `set_match(kickoffAt, opponent?)` | « Mon match est samedi à 18 h » → brouillon de fixture | Écriture différée, confirmation requise |
| `save_memory(category, content)` | « Je n'aime pas le riz » → `AthleteMemory` | Écriture, visible et supprimable dans les réglages |
| `report_pain(zone, intensity, since)` | Crée un `PainReport` → déclenche les règles de douleur | Écriture, confirmation requise |

## 8.4 Prompt système (squelette)

```
Tu es le coach de performance personnel de {prénom}, footballeur en National 2 qui prépare
un ultra-trail de 80 km (juin 2027) et le Dodo Trail 2027.

Priorités, dans l'ordre :
1. Santé et sécurité. 2. Performance football le samedi. 3. Progression ultra.

Règles absolues :
- Tu t'appuies TOUJOURS sur le snapshot et les outils, jamais uniquement sur le dernier message.
  Cite les chiffres utilisés (« sommeil moyen 6 h 40 sur 3 nuits, charge +18 % »).
- Tu ne calcules jamais toi-même glucides, eau, charge ou volume : tu utilises les valeurs du
  moteur ou les outils. Si une valeur manque, dis-le.
- Tu ne modifies jamais le plan : tu proposes via propose_session_change.
- Tu ne poses aucun diagnostic et tu ne nommes pas de blessure. En cas de douleur ≥ 6/10,
  persistante > 5 jours, en aggravation, ou avec gonflement / impossibilité d'appui :
  recommande un médecin ou un kiné et n'encourage aucune séance d'impact.
- Tu n'encourages jamais une hausse brutale de charge (règles H5–H7).
- Les séances clés restent à valider par l'athlète (et son staff s'il y en a un).
- Ton : direct, chaleureux, tutoiement, phrases courtes, pas de jargon inutile.
  Réponse courte par défaut (≤ 120 mots) + actions concrètes. Honnête même si ça déplaît.
- Si les données sont insuffisantes (pas de check-in, pas de RPE), dis-le et pose UNE question.

<snapshot>{athlete_snapshot_json}</snapshot>
```

Le snapshot est placé en fin de prompt système, et le préfixe stable (règles + profil) est mis en cache (prompt caching) pour réduire le coût et la latence.

## 8.5 Exemples de comportement attendu

**« Est-ce que je peux faire 20 km demain ? »** (on est mercredi, match samedi)
→ appel `simulate_session(jeudi, 20 km)` → le moteur répond : H3 violée si D− > 500 m ; 20 km ≈ 2 h 20 > plus longue sortie récente (1 h 45) + 15 min → H6 violée.
→ Réponse : « Pas 20 km demain. Ta plus longue sortie récente, c'est 1 h 45, et tu joues samedi. Je te propose 1 h 55 max en Z1–Z2 avec moins de 500 m de descente. Les 20 km, on les vise pour le week-end sans match du 14. » + carte « Appliquer ».

**« J'ai mal au mollet. »**
→ pas de diagnostic ; questions : intensité 0–10, depuis quand, pendant ou après l'effort, gonflement ?
→ `report_pain` → règles appliquées → si ≥ 6 ou critères remplis : orientation vers un professionnel + trail bloqué. Sinon : séance sans impact proposée et surveillance.

**« Que dois-je manger ce soir ? »**
→ `get_nutrition_targets(aujourd'hui)` moins ce qui est déjà consommé (journal) → dîner proposé depuis les gabarits, en respectant les mémoires (« pas de riz ») et le lendemain (veille de match → pauvre en fibres).

## 8.6 Brief quotidien (génération automatique)

1. Le moteur produit une structure : `{forme, zone, séance(ajustée?, raison), actions[], alertes[]}`.
2. Le LLM (modèle léger) rédige 3–5 phrases + la liste « Ce que tu dois faire aujourd'hui ». Consigne : **ne modifier aucun nombre**.
3. Contrôle automatique : chaque nombre de la sortie doit exister dans la structure d'entrée, sinon on réessaie une fois, puis on retombe sur un gabarit texte sans LLM.

## 8.7 Mémoire

- **Court terme** : les derniers messages de la conversation + un résumé glissant mis à jour tous les ~20 messages.
- **Long terme** : `AthleteMemory` (préférences, contraintes, matériel, contexte santé déclaré). Visible, modifiable et supprimable par l'utilisateur.
- **Données** : jamais « mémorisées » par le LLM. Elles sont relues depuis la base à chaque requête, ce qui en fait la source de vérité.

## 8.8 Choix des modèles & coûts

| Usage | Modèle | Pourquoi |
|-------|--------|----------|
| Chat coach | Claude Sonnet (dernière version) | Bon raisonnement, tool use fiable, français naturel |
| Brief quotidien, extraction de données, estimation d'un repas décrit | Claude Haiku | Rapide et peu cher |
| Justification hebdo | Claude Sonnet | Une fois par semaine |

Ordre de grandeur pour un utilisateur : quelques dizaines de messages par semaine, avec un snapshot mis en cache. Ça reste **modeste** (typiquement quelques euros par mois), mais on pose un plafond mensuel configurable et un suivi de la consommation de tokens.

## 8.9 Évaluation

Un jeu de 50 à 100 scénarios de test (`packages/ai/evals`) :
- questions typiques (les exemples du cahier des charges) ;
- pièges (demande de hausse brutale, douleur minimisée, « je veux faire 30 km la veille du match ») ;
- vérifications automatiques : règles respectées, aucun diagnostic, chiffres cohérents avec le snapshot, orientation santé présente quand elle est requise.

Les évals sont relancées à chaque changement de prompt ou de modèle.
