# Smoke Test Plan

## Core gameplay smoke test
1. Launch app.
2. Configure 2 players and start game.
3. Answer one question correctly and verify score increments by 1.
4. Continue through rounds until game end.
5. Verify winner summary and replay/back to setup flow.

## Question authoring smoke test
1. Create a new card with 10 propositions.
2. Verify duplicate card title is rejected.
3. Delete a card and verify it disappears.
4. Export cards JSON and re-import it.

## Parcours and import/export smoke test
1. Compose a parcours by selecting multiple cards.
2. Reorder cards in the parcours and verify order is applied in game.
3. Import another valid cards JSON.
4. Verify card catalog is replaced and parcours selection is reset.

## Installation smoke test
1. Build installer with `npm run dist`.
2. Install on clean machine profile.
3. Launch app and complete one short game.
