# Performance OS — Football N2 × Ultra-trail

Assistant personnel de performance : football National 2 + préparation ultra-trail 80 km (juin 2027) + Dodo Trail 2027.
Il gère la charge, la récupération, le sommeil, la nutrition, l'hydratation et le coaching IA.

> Statut : **phase de conception**. Aucun code applicatif pour l'instant. On développe ensuite module par module en suivant la roadmap.

## Sommaire de la conception

| # | Document | Contenu |
|---|----------|---------|
| 1 | [Architecture](docs/01-architecture.md) | Stack, monorepo, modules, flux de données, intégrations montres |
| 2 | [Cahier des charges](docs/02-cahier-des-charges.md) | Exigences fonctionnelles par module (dashboard → objectifs) |
| 3 | [Schéma de base de données](docs/03-schema-base-de-donnees.md) | Modèle Prisma complet, choix de modélisation |
| 4 | [Charge & récupération](docs/04-charge-et-recuperation.md) | sRPE, ACWR, monotonie, scores sommeil / récup / forme, matrice de décision, bain froid |
| 5 | [Nutrition & hydratation](docs/05-nutrition-et-hydratation.md) | Périodisation des glucides, repas, jour de match, sudation, entraînement digestif |
| 6 | [Génération des programmes](docs/06-generation-programmes.md) | Macrocycle → juin 2027, règles de placement, adaptation quotidienne, déplacement de séance |
| 7 | [Pages & parcours](docs/07-pages-et-parcours.md) | Arborescence, contenu des écrans, parcours utilisateur, design system |
| 8 | [Système IA](docs/08-systeme-ia.md) | Coach LLM, contexte, outils, garde-fous santé, mémoire |
| 9 | [MVP, V2, roadmap](docs/09-mvp-v2-roadmap.md) | Périmètre MVP, V2+, planning de dev module par module |

## Principe fondateur

**Le moteur calcule, l'IA explique.**
Tous les chiffres (charge, macros, eau, sommeil, volume trail) sortent d'un moteur déterministe, testé et traçable.
Le LLM ne fait jamais les calculs. Il interprète, converse, reformule et propose des changements, et ces propositions repassent toujours par les garde-fous du moteur avant d'être appliquées.
C'est ce qui rend l'app fiable et prudente, et pas juste bavarde.

## Points de vigilance (à lire avant de coder)

1. **Jeudi = J-2 avant match.** La sortie trail principale tombe le lendemain de la grosse séance et à 48 h du match. Les descentes créent des dommages excentriques dont les courbatures culminent 24 à 72 h plus tard, donc pile le samedi. En saison, le jeudi reste donc en endurance fondamentale, avec la durée plafonnée et le D− limité. Le gros du volume ultra se construit pendant la trêve hivernale et après la fin de saison N2 (mi-mai), et c'est justement ce qui cale avec le bloc « mai » de ton plan.
2. **80 km en juin, avec une saison N2 qui finit en mai**, ça laisse environ 3 à 5 semaines de vrai bloc spécifique. C'est faisable pour *finir*, mais la progression de novembre à avril doit être régulière, sinon ça ne passera pas.
3. **Dodo Trail : date exacte à saisir.** L'ordre et l'écart entre l'ultra 80 km et le Dodo changent complètement l'affûtage et la récupération. Le moteur a besoin des deux dates.
4. **L'ACWR (ratio charge aiguë/chronique) est un indicateur, pas un prédicteur de blessure.** La littérature le critique fortement (Impellizzeri et al., 2020). Il sert à déclencher des alertes et des discussions, jamais à « prédire » une blessure.
5. **Les intégrations montres ne sont pas triviales.**
   - Apple Health n'a pas d'API web : il faut une app native iOS.
   - L'API Garmin Health est réservée aux partenaires validés.
   - Les conditions de l'API Strava restreignent l'usage des données avec l'IA depuis fin 2024.
   - Pour démarrer, l'import de fichiers `.FIT`/`.GPX` est la voie la plus sûre.
6. **Données de santé = données sensibles (RGPD art. 9).** Pour un usage perso, pas de souci. Dès que le staff y accède ou que l'app devient multi-utilisateurs, il faut du consentement explicite, du chiffrement et une vérification de l'obligation d'hébergement HDS.
7. **L'app ne diagnostique rien.** Une douleur ≥ 6/10, une douleur qui dure plus de 5 jours ou certains symptômes (douleur thoracique, malaise, palpitations, gonflement, impossibilité d'appui) déclenchent un message d'orientation vers un professionnel de santé, et les séances concernées sont bloquées.
