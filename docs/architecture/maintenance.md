# Maintenance sweep

A whole-codebase review: the static analysis added in d063, three read-only audits (core and
tools; game, io and dev; docs and tests), and the fixes that were small enough to make at once. This file is the list
of what was found, what was done, and what is left as proposals. Larger items are numbered below.

## In one paragraph

The architecture holds. `src/core` imports no Phaser, DOM, Web MIDI or Web Audio; time runs in ticks on an injected
clock; the judge talks to battle, progression and the scenes only through versioned events; every persisted format has a
schema, a `schemaVersion` and a migration path; there are no import cycles (348 modules). The debt is of two kinds:
**copy-paste** of small things (music primitives in core, building blocks in scenes), and **async edges** in the scenes,
where a promise was started and nobody handled its failure or a second click. In C/C++ terms: the hardware layer is
clean, the application layer has grown by copying functions between files, and a few callbacks had no
re-entrancy guard.

## Fixed in the maintenance pull requests

Static analysis (merged): `npm run analyze` in CI, see [static-analysis.md](static-analysis.md). Its first run fixed
the `virtual:pieces` declaration (every piece's metadata was `any` in the game), dev-page click handlers that dropped
rejected promises, 27 casts that changed nothing, and dead exports.

Bugs, each with a regression test where the code is testable without a browser:
- **A damaged save was copied again on every start.** `ProfileRepository.load` wrote a new backup each time it read a
  corrupt profile, and the menu reads every profile on start, so one bad save filled the browser storage over time.
  Now one copy per distinct content (`tests/progression/repository.test.ts`).
- **Double tap on "New player" made two "Player 2".** `ProfileService.createPlayer` now joins a call in progress
  (`tests/progression/profile-service.test.ts`). The default name goes through the string table (`profile.defaultName`).
- **Double Save in the piece editor stored two copies** of a new piece (the id is known only after the first save).
  Saves now run one after the other. A save refused because the piece cannot be drawn said "Put some notes on the staff
  first"; it now has its own line (`editor.notDrawable`).
- **Rests of an imported piece** assumed the notes were sorted (only the editor's own edits keep them sorted); an
  imported file in another order gave overlapping rests and a broken ABC file (`src/core/editor/model.test.ts`).
- **Results screen never shown** if the end-of-piece save step threw: the practice and battle screens now go on to the
  results either way. The menu's player buttons redraw after a failed save instead of leaving the screen stuck.
- **Generators swallowed every error** around their retry loops (`catch {}`), including real bugs; they now retry only on
  the new `NoFit` error.
- Smaller: the audio resume on a closed context no longer leaves an unhandled rejection; the staff demo scene removed its
  resize listener on shutdown; the MIDI source name is one constant shared by the keyboard and the sound monitor.

Duplication removed (jscpd: 9 clones to 3): the text-label closure of six scenes is `PixelScene.label`; 26 casts of the
scene context are `contextOf(scene)`; `ProfileService`'s five settings updaters and three completion methods share
`updateSetting`, `persist` and `commit`; the level-up events of a piece and a battle share `levelEvents`; the EZ-220 key
range, the own-piece licence, the two-hands window and the schema-error formatter (`src/core/issues.ts`) each exist once.

Docs: feature statuses that said "idea, 0%" while code and saves existed (ft_1_06, core_07, ft_Y_06), and ft_Y_13
status lines, the MVP range (now ft_0_00 to ft_0_17, where the table already had it), the iteration 1 range, the
architecture tree and the per-version save lists (they now point at the comment on `PROFILE_SCHEMA_VERSION`, the one
source), "Phaser 3" and the open ABC-parser question in `docs/architecture.md`, d007 marked as superseding d001, the retry
rule in `docs/testing.md` (CI does retry once), the test layer table, the README's setup and layout, and the empty clock folder in
`src/core` (the clock lives in `src/core/transport/` and `src/io/audio/`).

## Open

| Item | What | Size |
|---|---|---|
| 1 | Profile migrations read today's defaults, so changing a default rewrites old saves | small, save format |
| 2 | A section with nothing to play never finishes; a campaign battle win is accepted outside the battle phase | small each |
| 3 | `loadPieces()` lays out every piece on every call; monsters re-parsed on every redraw | small |
| 4 | Scenes: speech bubble, results panel, option rows, top bar and typed scene keys as shared blocks | small each |
| 5 | Core: one home for music primitives; split `lintPiece`, `parseAbc`, `layoutStaff`, `generatePiece` | medium to large |
| 6 | Rules and text outside their layer: tempo and click ranges, the editor's file access, English in the editor | small each |
| 7 | Tests and docs tooling: untagged core features, local screenshot runs, brittle waits, path check scope | small each |

### Follow-up pull request

- **Item 3, done:** the offered piece list is built once per drafts setting and rebuilt only when the player's own pieces
  change (compared by chart, so it works with the own-pieces source); `findPiece` uses an id map; `drawable` lays a chart out once; the game's own monsters and battle rules are parsed
  once (now `src/game/pieceCatalogue.test.ts`).
- **Item 6, partly done:** the tempo percent (30 to 150, steps of ten), the click speed rules and the metronome's 30 to 240 BPM
  safety limit are in `src/core/transport/practiceSpeed.ts`, under the coverage gate, with the reason the two BPM ranges
  differ; the series-to-record mapping is `seriesRecords` in core/battle. The editor's file access went behind
  `GameContext.files`. Still open: English
  in the editor's status line and the tag ids on the info card.
- **Item 7, partly done:** screenshot tests skip on any non-Windows machine without a baseline (a local `--update-snapshots`
  still writes them); the three "nothing happened" e2e waits also wait on game frames (`letGameRun`); `press`, `totalXp`
  and `playerName` are shared helpers. Still open: items 1, 4, 5, 6 and 7.
- **Done:** the scope of the complexity and nesting limits in [static-analysis.md](static-analysis.md).
- From the proposals below: `BattleRules` is now checked against its schema (a type test) and `parseBattleRules` copies no
  field names; a version-0 chart with no notes is refused with a clear `MigrationError`.
- **Item 2, part 1 done**: firing `PieceCompleted` at once for a section with nothing to play would make the
  section loop restart itself without end, so such a section is refused when it is marked and Kiur
  asks for another last bar (`sectionHasNotes`). Part 2 done too: a beaten level can be replayed any
  time, but a repeat win or a win outside the battle phase gives no campaign progress (`battleResult`).

## Proposals and ideas not filed

These are judgement calls or questions for the maintainer rather than defects; listed so they are not lost.

- **XP bank bite.** `baseBite` in `src/core/scoring/xpBank.ts` returns at least 1 even when the configured `bitePercent`
  is 0, which the content schema allows, so the bite cannot be switched off from content. Either the schema says
  `min(1)` or the code returns 0. The maintainer's call.
- **Phase 1 of the campaign is stricter than Wait mode.** In `src/core/campaign/findKey.ts` pressing an already accepted
  chord key again counts as wrong (tested on purpose); Wait and Tempo treat it as a harmless repeat. Is that wanted for a
  young student?
- **Sections are recognised by their id** (`isSection` looks for `#bars-` in the chart id), and that decides whether XP is
  paid. A field on the chart, or `sliceChart` returning `{ chart, section }`, would be sturdier; it touches the chart
  schema, so it is an architect question.
- **Localised text in the data layer.** `core/chart/tempoLabel.ts` and `core/editor/pieceFile.ts` return English strings;
  returning keys and parameters would keep the chart model free of UI text.
- **Fixtures.** `docs/testing.md` aims for a canonical fixture per level and notation feature; there are two. A fixture
  each for rests, eighths, dotted half notes and chords would make the golden and replay tests broader.
- **Coverage outside the gate.** Only `src/core` and `tools/` are gated at 90%. `src/io` has no Phaser and could carry a
  report (not a gate) so its untested files show: `createInputs.ts`, `emitter.ts`, `ez220.ts`, `files/textFiles.ts`.
  Done for the files (now tested, `src/io` at 96 % of lines); the gate itself is proposal 1 in
  [test-coverage.md](test-coverage.md).
- **Move `CompositeKeyboard`** out of `src/io/mock/`: it is production code (it merges the real MIDI input).
- **One table of URL parameters** (`?device=`, `?demo=`, `?monitor=`, `?unlock=` and others are spread over README,
  CLAUDE.md, testing.md and three decisions; `?demo=art` is in none). A generated docs block from `src/config.ts` would
  keep it true.
- **Complexity limit.** Once the hotspots in [static-analysis.md](static-analysis.md) are split, lower the limit from 30
  to 20, the usual threshold in C metrics tools.
