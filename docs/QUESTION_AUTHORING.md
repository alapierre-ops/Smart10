# Authoring des cartes et parcours

## 1. Création et édition des cartes

Dans l'étape Cartes de l'application :

1. Cliquer sur Créer une carte.
2. Saisir un titre.
3. Choisir le type de question :
   - true_false
   - ranking
   - binary_choice
   - free_text
4. Renseigner exactement 10 propositions.
5. Renseigner la réponse attendue pour chaque proposition.
6. Valider la carte.

Règles de validation :
- titre obligatoire ;
- 10 propositions obligatoires ;
- texte et réponse attendue obligatoires pour chaque proposition ;
- unicité du titre de carte.

## 2. Export / import des cartes

Le flux d'import/export est disponible dans l'étape Cartes.

Export :
- action Exporter toutes les cartes ;
- génération d'un JSON contenant l'ensemble du catalogue de cartes courant.

Import :
- coller un JSON valide dans la zone d'import ;
- cliquer sur Importer le JSON ;
- si valide, le catalogue de cartes est remplacé par le contenu importé.

Remarques importantes :
- l'import ne fusionne pas les cartes ; il remplace l'état courant ;
- si le JSON est invalide, l'import est refusé ;
- les cartes importées sont persistées localement.

## 3. Choix des cartes pour le parcours de partie

Le parcours se compose dans l'étape Parcours :

1. Ajouter des cartes depuis Cartes disponibles vers Parcours de la partie.
2. Réordonner les cartes avec les contrôles de déplacement.
3. Retirer les cartes non souhaitées.
4. Lancer la partie avec ce parcours ordonné.

Remarques importantes :
- le parcours est une sélection ordonnée de cartes ;
- il n'est pas exporté/importé comme objet distinct ;
- après import de cartes, la sélection de parcours en cours est réinitialisée.

## 4. Structure JSON attendue

Le JSON importé/exporté est un tableau de cartes.

Exemple minimal :

```json
[
  {
    "id": "card_123",
    "title": "Inventions celebres",
    "type": "true_false",
    "propositions": [
      { "id": "prop_1", "text": "Telephone", "correctAnswer": "true" },
      { "id": "prop_2", "text": "Ampoule", "correctAnswer": "true" },
      { "id": "prop_3", "text": "Radio", "correctAnswer": "true" },
      { "id": "prop_4", "text": "Television", "correctAnswer": "true" },
      { "id": "prop_5", "text": "Machine a ecrire", "correctAnswer": "false" },
      { "id": "prop_6", "text": "Boussole", "correctAnswer": "true" },
      { "id": "prop_7", "text": "Imprimerie", "correctAnswer": "true" },
      { "id": "prop_8", "text": "Parachute", "correctAnswer": "true" },
      { "id": "prop_9", "text": "Dynamite", "correctAnswer": "true" },
      { "id": "prop_10", "text": "Minitel", "correctAnswer": "false" }
    ]
  }
]
```
