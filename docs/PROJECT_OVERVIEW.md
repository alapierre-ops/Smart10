# Smart 10 - Documentation Projet Complète

## Vision du projet

Smart 10 est une application desktop de quiz et de jeu de parcours, inspirée du format « 10 propositions ».
Le projet a été conçu dans un cadre pédagogique pour apprendre à travailler en Agile, avec des itérations courtes, un backlog priorisé et des livraisons fréquentes.

L'objectif est double :
- proposer une expérience de jeu multi-joueurs claire et engageante ;
- structurer le développement autour des besoins métier exprimés par le Product Owner.

## Équipe et rôles Agile

### Composition de l'équipe

| Rôle | Nom | Responsabilités |
|------|------|------------------|
| Product Owner | Mathéo | Définition des besoins, priorisation du backlog, validation des itérations |
| Scrum Master | Jérémy | Animation des cérémonies, suppression des obstacles, respect du processus Agile |
| Développeur & Gestion des Sprints | Nathan | Architecture, implémentation, coordination des sprints |
| Développeur | Axel | Implémentation des fonctionnalités, tests |
| Développeur & UX/UI | Matthieu | Implémentation, design d'interface, ergonomie |

### Cadence des sprints

- Durée : 30 minutes à 1 heure
- Démo : présentation des fonctionnalités au Product Owner et aux parties prenantes
- Fréquence : itérations rapides pour ajuster en continu
- Résultat attendu : livraison de user stories avec valeur visible

### Exemple de sprint

1. Planning (5 min) : sélection des user stories prioritaires
2. Développement (20-50 min) : implémentation et pair programming avec IA
3. Démo & rétrospective (5-10 min) : feedback PO et amélioration continue
4. Ajustements : intégration des retours dans le sprint suivant

## Contexte pédagogique

Le projet sert de support d'apprentissage pour les pratiques Agile :

- Product Owner : formalisation des besoins fonctionnels.
- Backlog : priorisation continue des fonctionnalités.
- Sprints : cycles courts de réalisation.
- Itérations : adaptation rapide selon les retours.
- IA : assistance au prototypage et à l'implémentation, avec validation humaine.

## Fonctionnalités de l'application

### Gestion des parcours

- Composer un parcours de partie en sélectionnant les cartes.
- Réordonner les cartes du parcours avant lancement.
- Retirer des cartes du parcours.
- Sauvegarder localement le catalogue de cartes.

### Conception des cartes

- Quatre types de questions :
  - Vrai / Faux
  - Classement
  - Choix multiple
  - Réponse libre
- Contrainte métier : 10 propositions obligatoires par carte.
- Paramétrage par carte :
  - titre ;
  - type de question ;
  - réponse attendue pour chaque proposition.

### Import / export et parcours

- Export de toutes les cartes en JSON depuis l'étape Cartes.
- Import d'un JSON valide pour remplacer le catalogue de cartes.
- Construction du parcours depuis l'étape Parcours : ajout, retrait et réordonnancement des cartes.
- Le parcours est une sélection de session (il n'est pas importé/exporté comme objet séparé).

### Déroulement d'une partie

- Démarrer une partie avec un ou plusieurs joueurs.
- Choisir le parcours avant le lancement.
- Définir un score cible ou jouer sans limite.
- Répondre proposition par proposition.
- Verrouiller les propositions déjà traitées.
- Afficher un retour visuel immédiat (bonne/mauvaise réponse).
- Capitaliser les points ou continuer la carte.
- Suivre les scores en direct.
- Afficher le classement final et le podium.

## Flux utilisateur

1. Accueil : création ou sélection d'un parcours.
2. Édition : ajout des cartes et des 10 propositions.
3. Configuration : sélection du parcours, des joueurs et des règles.
4. Jeu : réponses successives et mise à jour des scores.
5. Résultats : classement final et fin de partie.

## Choix technique : Electron

Le choix d'Electron répond à l'objectif de simplicité de déploiement :

- application desktop native sur Windows, macOS et Linux ;
- aucune infrastructure serveur obligatoire ;
- persistance locale des données ;
- base technologique web moderne (React + TypeScript).

## Stack technique

- React
- TypeScript
- Zustand
- Vite
- Electron
- Vitest

## Organisation du code

- desktop/src/main.tsx : point d'entrée React.
- desktop/src/app/App.tsx : orchestration des écrans.
- desktop/src/app/store.ts : état global de la partie.
- desktop/src/game-engine/engine.ts : règles et logique de jeu.
- desktop/src/storage/questionPacks.ts : stockage des packs de questions.
- desktop/electron/main.ts : processus principal Electron.
- desktop/electron/preload.ts : couche de communication sécurisée.
- tests/engine.test.ts : tests de logique métier.

## Exécution du projet

Prérequis :
- Node.js 20+
- npm

Commandes utiles depuis la racine :

    npm install
    npm run dev
    npm run build
    npm run dist
    npm run test

## Références documentaires

Documentation fonctionnelle :
- docs/GAME_RULES.md
- docs/QUESTION_AUTHORING.md

Documents importants :
- docs/INSTALL.md
- docs/TEST_PLAN.md
- docs/TECHNICAL_DESIGN.md

## Approche de développement

Le développement est piloté par la valeur métier :

- édition rapide et guidée des parcours ;
- validation stricte de la règle des 10 propositions ;
- feedback visuel immédiat pour fluidifier le jeu ;
- support multi-joueurs avec suivi des scores ;
- persistance locale pour un usage pédagogique simple.

L'assistance IA a servi d'accélérateur de livraison, avec relecture et validation humaine à chaque itération.
