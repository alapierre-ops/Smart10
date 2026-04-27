# Smart 10

Projet de formation Agile développé avec l'IA.

Smart 10 est une application desktop de quiz et de jeu de parcours inspirée du format « 10 propositions ».
Elle permet de créer des parcours, lancer des parties multi-joueurs, suivre les scores en direct et afficher un classement final.

## Points clés

- Création, modification et suppression de cartes.
- Cartes de jeu avec 4 types de questions : Vrai/Faux, Classement, Choix multiple, Réponse libre.
- Règle métier : 10 propositions obligatoires par carte.
- Export et import des cartes au format JSON depuis l'éditeur.
- Choix des cartes pour composer le parcours de la partie (ordre modifiable avant lancement).
- Gestion multi-joueurs avec score cible ou mode illimité.
- Feedback visuel immédiat des réponses et verrouillage des propositions déjà traitées.
- Sauvegarde locale des données.

## Stack

- React
- TypeScript
- Zustand
- Vite
- Electron
- Vitest

## Démarrage rapide

Prérequis : Node.js 20+ et npm.

  npm install
  npm run dev

Build locale :

  npm run build

Packaging exécutable :

  npm run dist

## Documentation fonctionnelle

- [docs/GAME_RULES.md](docs/GAME_RULES.md)
- [docs/QUESTION_AUTHORING.md](docs/QUESTION_AUTHORING.md)

## Documents importants

- [docs/INSTALL.md](docs/INSTALL.md)
- [docs/TEST_PLAN.md](docs/TEST_PLAN.md)
- [docs/TECHNICAL_DESIGN.md](docs/TECHNICAL_DESIGN.md)

## Vue projet complète

La documentation détaillée (contexte Agile, rôles, fonctionnalités, architecture et approche de développement) est disponible ici :

- [docs/PROJECT_OVERVIEW.md](docs/PROJECT_OVERVIEW.md)
