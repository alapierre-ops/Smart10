# Smart 10 - Conception Technique

## 1. Objectif et périmètre

Ce document décrit la conception technique de Smart 10 dans son état actuel.

Périmètre couvert :
- architecture desktop Electron + renderer React ;
- modèle de données du jeu ;
- gestion d'état et logique métier ;
- persistance locale des cartes ;
- pipeline build/test ;
- points de vigilance techniques.

## 2. Architecture globale

Smart 10 suit une architecture à 3 couches côté client desktop :

1. Processus principal Electron (main process)
2. Couche bridge sécurisée (preload)
3. Application React (renderer)

### 2.1 Main process Electron

Fichier principal : `desktop/electron/main.ts`

Responsabilités :
- création de la fenêtre (`BrowserWindow`) ;
- chargement de l'URL de dev (`VITE_DEV_SERVER_URL`) en développement ;
- chargement du fichier statique `dist/index.html` en production ;
- cycle de vie applicatif standard (macOS activation, quit hors macOS).

Contraintes de sécurité appliquées :
- `contextIsolation: true`
- `nodeIntegration: false`
- preload dédié.

### 2.2 Preload

Fichier : `desktop/electron/preload.ts`

Responsabilité actuelle :
- exposition minimale d'un objet global `window.smart10` avec la version applicative.

Le preload reste volontairement faible pour limiter la surface d'attaque entre renderer et APIs Node/Electron.

### 2.3 Renderer React

Point d'entrée : `desktop/src/main.tsx`

Cœur applicatif :
- `desktop/src/app/App.tsx` pour l'UI et les flux utilisateur ;
- `desktop/src/app/store.ts` pour l'état global et les transitions métier.

## 3. Organisation des modules

### 3.1 UI et orchestration

- `desktop/src/app/App.tsx`

Rôles :
- parcours de configuration en 3 étapes : joueurs, cartes, parcours ;
- affichage des phases de partie : `in_round`, `round_summary`, `finished` ;
- interactions de jeu (sélection proposition, réponse, décisions de risque/capitalisation) ;
- feedback utilisateur (modales, états visuels, effets sonores).

### 3.2 Gestion d'état métier (Zustand)

- `desktop/src/app/store.ts`

Le store centralise :
- la configuration de partie (`setupPlayers`, `targetPointsToWin`, sélection des cartes) ;
- l'état dynamique d'une partie (`matchState`) ;
- les commandes de transition (start, réponse, arrêt, continuation, fin de manche).

Le modèle est orienté machine à états avec phases explicites :
- `in_round`
- `round_summary`
- `finished`

### 3.3 Logique de jeu

Deux niveaux coexistent :

1. Logique active de la partie dans `store.ts`
2. Moteur isolé dans `desktop/src/game-engine/engine.ts` (principalement utilisé par les tests unitaires actuels)

Important : le moteur `engine.ts` implémente un flux "Vrai/Faux" historique (`GameState`, `TfQuestion`) alors que la production gère plusieurs types (`true_false`, `ranking`, `binary_choice`, `free_text`) via le store.

### 3.4 Stockage local et import/export

- `desktop/src/storage/questionPacks.ts`

Fonctions clés :
- chargement des cartes depuis `localStorage` (clé `smart10.cards`) ;
- création/validation de cartes ;
- export JSON complet ;
- import JSON avec filtrage des entrées invalides ;
- fallback sur un pack par défaut (`sample-pack.json`) ;
- migration legacy depuis un ancien format de questions plates.

### 3.5 Choix des cartes et parcours de partie

Le parcours de partie est un ordre de cartes conservé dans l'état applicatif :

- `selectedCardIdsForMatch` stocke la sélection ordonnée ;
- ajout/retrait/réordonnancement via les actions du store ;
- construction du parcours effectif au `startMatch()`.

Important :

- l'export JSON porte sur les cartes (catalogue), pas sur le parcours de partie ;
- l'import de cartes réinitialise la sélection de parcours en cours.

## 4. Modèle de données

Source : `desktop/src/game-engine/types.ts`

Types principaux :
- `QuestionType` : `true_false | ranking | binary_choice | free_text`
- `QuestionCard` : carte de jeu avec 10 propositions
- `QuestionProposition` : item individuel (texte + réponse attendue)

Modèle de match (défini dans le store) :
- joueurs avec score total, score temporaire et statut (`active`, `stopped`, `eliminated`) ;
- carte courante, joueur courant, propositions révélées ;
- états transitoires : décision après bonne réponse, feedback erreur, validation manuelle de réponse libre.

## 5. Règles métier implémentées

### 5.1 Contraintes de création/édition de carte

- titre obligatoire ;
- exactement 10 propositions ;
- texte et réponse attendue obligatoires pour chaque proposition ;
- unicité du titre (insensible à la casse) à la création/mise à jour.

### 5.2 Déroulement d'un tour

1. Le joueur actif sélectionne une proposition non révélée.
2. Il fournit une réponse selon le type de question.
3. Si la réponse est correcte :
   - +1 point temporaire ;
   - choix entre capitaliser (`secureAndStopTurn`) ou continuer (`riskAndContinueTurn`).
4. Si la réponse est incorrecte :
   - perte des points temporaires ;
   - joueur éliminé pour la carte ;
   - passage au joueur actif suivant.

### 5.3 Cas spécifique : réponse libre

Pour `free_text`, la comparaison automatique normalise les chaînes :
- suppression des accents ;
- passage en minuscules ;
- trim.

En cas de non-correspondance, une validation manuelle est proposée :
- accepter quand même ;
- compter faux.

### 5.4 Fin de carte / fin de partie

- fin de carte si toutes les propositions sont révélées ou s'il n'y a plus de joueur actif ;
- fin de partie si un joueur atteint l'objectif de points ou si le parcours est terminé ;
- gestion des égalités via `winnerIds` multiples.

## 6. Flux applicatif

### 6.1 Initialisation

- chargement des cartes via `loadCards()` ;
- initialisation des options de setup ;
- en dev, démarrage Vite + Electron via scripts concurrents.

### 6.2 Lancement d'une partie

- constitution du parcours ordonné selon la sélection utilisateur ;
- instanciation des joueurs ;
- création d'un `matchState` en phase `in_round`.

### 6.3 Avancement de manche

- mise à jour atomique du store à chaque action ;
- résolution de fin de manche via `resolveRoundIfEnded()` ;
- transition de phase (`in_round` -> `round_summary` -> `in_round` ou `finished`).

## 7. Build, tests et qualité

### 7.1 Outils

- bundling renderer : Vite (`vite.config.ts`, root `desktop`) ;
- compilation TS Electron : `tsconfig.electron.json` ;
- packaging : `electron-builder`.

### 7.2 Scripts principaux

- `npm run dev` : Vite + Electron
- `npm run build` : build web + build Electron
- `npm run dist` : packaging multi-plateforme
- `npm run test` : Vitest
- `npm run lint` : `tsc --noEmit`

### 7.3 Couverture de tests actuelle

- tests unitaires du moteur historique dans `desktop/tests/engine.test.ts` ;
- pas encore de tests automatisés ciblant le store Zustand multi-types ;
- setup jsdom prêt pour tests UI (`desktop/tests/setup.ts`).

## 8. Sécurité et robustesse

Mesures en place :
- isolation du contexte renderer ;
- absence d'API Node directe en UI ;
- validation des payloads importés ;
- fallback en cas de JSON invalide ou corrompu.

Points de vigilance :
- les données persistent en `localStorage` (non chiffré) ;
- absence actuelle de versionnement explicite des schémas de données ;
- dépendance forte à la logique du store (peu de séparation service/métier).

## 9. Dette technique identifiée

1. Duplication de logique entre moteur historique (`engine.ts`) et logique de partie du store.
2. Couverture de tests insuffisante sur le flux réel multi-types.
3. Nommage UI visible "GeniusBox" dans `App.tsx` alors que le produit est "Smart 10".
4. Gestion d'erreur incohérente : création de carte dupliquée lève une exception (`throw`) alors que le contrat de méthode prévoit un message de retour.

## 10. Recommandations d'évolution

1. Isoler un moteur unique (pur) utilisé à la fois par le store et les tests.
2. Ajouter des tests unitaires de transitions du store (phases, scoring, élimination, fins de manche).
3. Harmoniser les labels produit (Smart 10) sur tout le renderer.
4. Introduire un schéma versionné pour l'import/export des cartes.
5. Ajouter une couche de persistance abstraite pour préparer une option de stockage fichier/DB.

## 11. Références

- Documentation fonctionnelle : `docs/GAME_RULES.md`, `docs/QUESTION_AUTHORING.md`
- Installation et exploitation : `docs/INSTALL.md`, `docs/TEST_PLAN.md`
- Vue projet complète : `docs/PROJECT_OVERVIEW.md`
