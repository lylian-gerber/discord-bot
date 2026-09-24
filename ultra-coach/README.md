# Ultra Coach — AI Endurance Performance Coach

Coach IA adaptatif pour préparer un ultra-trail (100 km, juin/juillet 2027) tout en conservant un niveau de football National 2.

**Principe central : le moteur décide, l'IA explique.** Les chiffres (charge, readiness, nutrition, placement des séances, garde-fous) viennent d'un moteur TypeScript déterministe et testé ; le LLM (Claude, avec vision) comprend le langage libre et les images, explique, converse et mémorise.

## État actuel

| Élément | Statut |
|---|---|
| Conception produit (17 livrables demandés) | ✅ `docs/` |
| Moteur de calcul (`src/engine/`) | ✅ 11 modules, 31 tests |
| Schéma de base de données (`prisma/schema.prisma`) | ✅ validé par Prisma |
| Application web (Next.js) | ⏳ semaine 1 de la roadmap |

```bash
npm install
npm test          # tests du moteur
npm run typecheck
```

## Documentation

| # | Document | Livrables couverts |
|---|---|---|
| 1 | [Produit](docs/01-produit.md) | définition, boucle quotidienne, garde-fous, réalité terrain |
| 2 | [Pages & UX](docs/02-pages-et-ux.md) | toutes les pages, écran d'accueil, dashboard, design |
| 3 | [Architecture](docs/03-architecture.md) | stack, monorepo, flux, sécurité |
| 4 | [Base de données](docs/04-base-de-donnees.md) | modèles, règles, index |
| 5 | [Algorithmes, charge, progression](docs/05-algorithmes-charge-progression.md) | sRPE/ACWR, readiness, durabilité, périodisation, placement autour des matchs |
| 6 | [Moteur IA & images](docs/06-moteur-ia-et-images.md) | pipeline, snapshot, outils, mémoire, analyse d'images, évals, coût |
| 7 | [Nutrition & hydratation](docs/07-nutrition-hydratation.md) | besoins périodisés, repas, sudation, entraînement du ventre |
| 8 | [Récupération, sommeil, matériel](docs/08-recuperation-sommeil-materiel.md) | Recovery Center, bain froid, sommeil, muscu, gear, plan de course, météo |
| 9 | [Intégrations](docs/09-integrations.md) | Strava détaillé, faisabilité Garmin/Apple/Whoop/Coros |
| 10 | [MVP, V2, V3, roadmap](docs/10-mvp-v2-v3-roadmap.md) | périmètres + planning semaine par semaine |

## Avertissement

Cette application ne remplace pas un avis médical. Elle ne diagnostique aucune blessure et oriente vers un professionnel de santé en cas de douleur importante ou de symptôme inhabituel.
