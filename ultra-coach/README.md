# Ultra Coach — AI Endurance Performance Coach

Coach IA adaptatif pour préparer un ultra-trail (100 km, juin/juillet 2027) tout en conservant un niveau de football National 2.

**Principe central : le moteur décide, l'IA explique.** Les chiffres (charge, readiness, nutrition, placement des séances, garde-fous) viennent d'un moteur TypeScript déterministe et testé ; le LLM (Claude, avec vision) comprend le langage libre et les images, explique, converse et mémorise.

## Ce que fait l'appli aujourd'hui (MVP v0.1)

| Écran | Fonction |
|---|---|
| Inscription / connexion | Comptes sécurisés (mot de passe haché, session en cookie httpOnly) |
| Onboarding | Profil, football (semaine type, fin de saison, trêve), objectif course, niveau actuel, nutrition → **génération du plan complet jusqu'à la course** |
| Aujourd'hui | Forme /100, séance du jour, demain, prochain match, sommeil + heure de coucher, eau, glucides, alertes de charge, J-X |
| Check-in | 8 curseurs + sommeil + FC repos/HRV + ressenti → readiness → **séance du jour adaptée automatiquement** |
| Plan | Semaine par semaine, **modification des jours de foot → recalcul du trail autour** (jours passés et séances faites protégés) |
| Timeline | Toutes les semaines jusqu'au jour J, phases, semaines allégées, alertes de faisabilité |
| Détail séance | Objectif, déroulé (allures si VMA, FC si FC max), échauffement, retour au calme, nutrition pendant, checklist matériel |
| Ajouter | Séance / match (minutes jouées) / muscu, RPE → charge ; ravitaillement + symptômes digestifs |
| Activité | Stats, charge, comparaison avec une séance similaire antérieure |
| Progrès | Charge hebdo par sport + moyenne 4 sem., forme 30 j, volume course, ACWR, monotonie |
| Nutrition | kcal / glucides / protéines / lipides selon le type de journée, répartition par repas, suivi eau, test de sudation, plan de boisson |
| Coach IA | Chat avec photos, contexte complet de l'athlète, garde-fous médicaux avant l'IA (nécessite `ANTHROPIC_API_KEY`) |

Pas encore fait : import Strava, plans de repas détaillés, photo de repas, mémoire du coach, Recovery Center, matériel, notifications (voir la roadmap).

## Lancer l'appli en local

Prérequis : Node 20+, PostgreSQL.

```bash
cp .env.example .env         # renseigne DATABASE_URL et ANTHROPIC_API_KEY
npm install
npm run db:push              # crée les tables
npm run dev                  # http://localhost:3000
```

Sur téléphone : ouvre l'URL dans Safari/Chrome → « Ajouter à l'écran d'accueil » (PWA).

## Mettre en ligne (≈ 10 min, gratuit pour démarrer)

1. Base : crée une base PostgreSQL sur **Neon** (neon.tech) → copie l'URL de connexion.
2. Appli : importe le dépôt sur **Vercel**, dossier racine `ultra-coach`, variables `DATABASE_URL` et `ANTHROPIC_API_KEY`.
3. Une fois : `DATABASE_URL=… npx prisma db push` depuis ton ordi pour créer les tables.

## Tests

```bash
npm test          # 35 tests du moteur
npm run typecheck
npm run build
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
