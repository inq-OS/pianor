# Persisted formats and their schema versions

Every format the game writes or reads has a `schemaVersion` ([futureproofing](../futureproofing.md) 1.1, [testing](../testing.md) section 4). The table below lists them all with the version this build reads and writes, where that number is held, and the migration that moves an older copy forward. It is like a register map of the save and content layouts: one place to look before a bump.

**The table is generated** from the code by `npm run docs:index` (`tools/docs/schemaVersions.ts`). A bump changes the number here, so `npm run docs:check` fails until the index is regenerated, and two pull requests that bump the same format clash in this file as well as in the code. That is the point of [d069](../decisions/saves.md#d069)'s one shared bump per round: when you bump a format, look here first for an open pull request that bumps it too. The check also fails when a named file is missing or when a committed content file's own `schemaVersion` is not the one the code reads.

A new format gets a row in `PERSISTED_FORMATS` in `tools/docs/schemaVersions.ts`; nothing else needs to change by hand.

<!-- docs:schema-versions -->
| Format | Where | Version | Held by | Migration | Migration test |
|---|---|---|---|---|---|
| Save data (profiles) | browser storage | 17 | `PROFILE_SCHEMA_VERSION` in `src/core/progression/profile.ts` | `src/core/progression/migrate.ts` | `src/core/progression/migrate.test.ts` |
| Chart | `build/charts/*.chart.json`, `content/dev/charts/` | 2 | `CHART_SCHEMA_VERSION` in `src/core/chart/schema.ts` | `src/core/chart/migrate.ts` | `src/core/chart/migrate.test.ts` |
| Piece meta | `content/pieces/*/piece.meta.json` | 1 | `pieceMetaSchema` in `src/core/chart/schema.ts` | none yet | none yet |
| Piece file (editor export) | `*.pianor-piece.json` files a person saves | 3 | `PIECE_FILE_VERSION` in `src/core/editor/pieceFile.ts` | `src/core/editor/migrate.ts` | `src/core/editor/pieceFile.test.ts` |
| Own piece record (editor) | browser storage | 2 | `OWN_PIECE_FORMAT` in `src/game/editor/OwnPieces.ts` | `src/core/editor/migrate.ts` | `tests/editor/ownPieceFormat.test.ts` |
| Level table | `content/curriculum/levels.json` | 1 | `levelsFileSchema` in `src/core/chart/schema.ts` | none yet | none yet |
| Progression | `content/curriculum/progression.json` | 1 | `progressionConfigSchema` in `src/core/progression/config.ts` | none yet | none yet |
| Level modifiers | `content/curriculum/modifiers.json` | 1 | `modifierTableSchema` in `src/core/progression/modifiers.ts` | none yet | none yet |
| XP bank | `content/curriculum/xpBank.json` | 1 | `xpBankConfigSchema` in `src/core/scoring/xpBankContent.ts` | none yet | none yet |
| Campaign ladder | `content/campaign/ladder.json` | 1 | `ladderSchema` in `src/core/campaign/content.ts` | none yet | none yet |
| Trainer steps | `content/trainer/steps.json` | 1 | `trainerStepsSchema` in `src/core/trainer/steps.ts` | none yet | none yet |
| Ear levels | `content/trainer/ear-levels.json` | 1 | `earLevelsSchema` in `src/core/trainer/earLevels.ts` | none yet | none yet |
| Piece styles | `content/pieces/styles.json` | 1 | `styleListSchema` in `src/core/properties/styles.ts` | none yet | none yet |
| World model of Keri | `content/world/keri.json` | 1 | `worldSchema` in `src/core/world/world.ts` | none yet | none yet |
| Scene (WP-01) | `content/scenes/*.json` | 1 | `sceneDataSchema` in `src/core/scene/scene.ts` | none yet | none yet |
| Actor (WP-01) | `content/actors/*.json` | 1 | `actorDefSchema` in `src/core/scene/actor.ts` | none yet | none yet |
| Script (WP-01) | `content/scripts/*.json` | 1 | `scriptSchema` in `src/core/scene/script.ts` | none yet | none yet |
| Character (WP-01) | `content/characters/*.json` | 1 | `characterDefSchema` in `src/core/character/character.ts` | none yet | none yet |
| Conversation (WP-01) | `content/conversations/*.json` | 1 | `conversationSchema` in `src/core/dialogue/conversation.ts` | none yet | none yet |
| Autoplay scenarios (dev) | `content/dev/scenarios.json` | 1 | `scenarioFileSchema` in `src/dev/autoplay/scenario.ts` | none yet | none yet |
<!-- /docs:schema-versions -->

"none yet" means the format is still at its first version. A committed content file past version 1 has no migration because nobody holds an old copy of it: the bump rewrites the file in the same pull request. Save data, own pieces and piece files live outside the repository (in the browser or in a person's files), so each of their versions needs a migration and a test that reads a fixture of the old version.
