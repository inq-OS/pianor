---
title: "Decisions: Saves and formats"
---
# Decisions: Saves and formats

Save format, storage, profiles and migrations. One entry per decision, oldest first. Index: [DECISIONS.md](DECISIONS.md).

## d021

**Progression is an event-sourced attempt log with XP numbers in `content/curriculum/progression.json`.** Features: ft_0_10, ft_0_15.

A profile is `{ schemaVersion, id, name, createdAt, attempts[] }`; totals, level and per-piece records are folded from the log, so rule changes never rewrite history. XP: completion 20, accuracy up to 30, first-time bonus 20, +15 per extra star on a repeat; a plain repeat earns 30% of the base, each hint kind costs up to 40% with a 50% cap; two-hands bonus `1 + 0.5 x together / notes` with a 300 ms window; at least 1 XP, nothing lowers XP. Levels need 0, 100, 250, 450, 700, 1000, 1400, 1900, 2500, 3200 XP (ten levels). Storage is the async `KeyValueStore` (`LocalStorageStore`, `MemoryStore`), one key per profile plus an active pointer; an unreadable save is copied to `pianor/v1/corrupt/...` before replacing; a newer-version save is reported, never migrated. Several players per device; JSON export and import never overwrites when importing as new. Progression events are `XpAwarded`, `LevelUp`, `PieceUnlocked`. Changed by d098 (no piece is locked by level).

Check: `src/core/progression/xp.test.ts` "first time, perfect: completion 20 + accuracy 30 + first-time bonus 20"; `src/core/progression/xp.test.ts` "starts at level 1 and moves up exactly at each threshold"; `src/core/progression/xp.test.ts` "refuses a table that does not start at 0, does not increase, or discounts hints too much"; `tests/progression/repository.test.ts` "copies an unreadable save aside before anything can replace it, and says what was wrong"

## d045

**The list of pieces turned off lives in `settings.pieces.hidden`; save v6.** Features: ft_1_02c.

`settings.pieces = { hidden: string[] }`, default empty, so a new piece starts on; migration 5 to 6 adds it. Ids matching no piece stay and are ignored; the last piece that is on cannot be turned off (`core/progression/pieceSwitch.ts`, counting only pieces offered now); stars and XP are untouched by turning a piece off.

Check: `src/core/progression/pieceSwitch.test.ts` "off hides that piece only, and on brings it back"; `src/core/progression/migrate.test.ts` "ft_1_02c.AC2: migrates a v5 save on: everything kept, and every piece on (nothing turned off)"; `tests/progression/profile-service.test.ts` "ft_1_02c.AC3: the last piece that is on cannot be turned off"

## d054

**The on-screen keyboard setting is `settings.keyboard.onScreen`; save v9.** Features: ft_Y_12, ft_0_16.

`settings.keyboard = { onScreen: boolean }`, default on (migration 8 to 9). Off hides the piano on every screen by removing its element from the layout (`display: none`) while the keys stay connected for the EZ-220, computer keyboard and virtual player; scenes ask through `GameContext.setKeyboardHidden`. Changed later (first built as `visibility: hidden` on the practice screen only).

Check: `src/core/progression/migrate.test.ts` "ft_Y_12.AC3: migrates a v8 save to v9: everything kept, and the on-screen keyboard shown (the keys the player had)"; `tests/e2e/onscreen-keyboard.spec.ts` "ft_Y_12.AC4: with the piano hidden the virtual EZ-220 still plays a piece to the results screen"

## d055

**Bar numbers are `settings.barNumbers.mode` (off, first, every2, every4); save v10.** Features: ft_0_16, core_03.

`settings.barNumbers = { mode: "off" | "first" | "every2" | "every4" }`, default off (migration 9 to 10). Every 2nd is bars 1, 3, 5 and Every 4th is 1, 5, 9 of the whole piece, also inside a practised section (`barNumbersToShow` in `core/layout/barNumbers.ts`).

Check: `src/core/layout/barNumbers.test.ts` "every 2nd shows bars 1, 3, 5 ... and every 4th bars 1, 5, 9 ..."; `src/core/progression/migrate.test.ts` "ft_0_16.AC7: migrates a v9 save to v10: everything kept, and no bar numbers (the staff the player had)"

## d058

**Three settings added in one save bump: `noteNaming`, `staffGap`, `keyLights` (v11).** Features: ft_0_17, ft_Y_06, ft_0_16.

`settings.noteNaming` `"B"` or `"H"` (type `NoteNaming` in `core/text/noteName.ts`), `settings.staffGap` `"wide"` or `"short"`, `settings.keyLights` `{ enabled: boolean, afterWrong: 0 to 3 }`; defaults `"B"`, `"wide"`, `{ enabled: false, afterWrong: 0 }` (migration 10 to 11, fixture `tests/fixtures/saves/profile.v11.json`).

Check: `src/core/progression/migrate.test.ts` "ft_0_17 / ft_Y_06: migrates a v10 save to v11: everything kept, and the defaults B, wide and key lights off"; `src/core/progression/migrate.test.ts` "ft_0_17 / ft_Y_06: every older save arrives with the v11 defaults, and chosen values are kept or refused when out of range"

## d059

**Every attempt stores per-note timing scores in `noteTimings`; save v12.** Features: core_01.

Each attempt gets `noteTimings: { note, score }[]` (note index in the piece, score 0 to 100 or `null` for missed or untimed), kept beside `result.timing` because timing cannot be rebuilt later; old and Wait attempts get an empty list (migration 11 to 12, fixture `profile.v12.json`).

Check: `src/core/progression/noteTiming.test.ts` "migrates a v11 save to v12: every attempt gets an empty noteTimings list, everything else is kept, the input is not changed"

## d060

**Every attempt stores the ids of the helps in force in `helps`; save v13.** Features: core_07.

`attempts[].helps` lists help ids from `content/curriculum/modifiers.json` (`HELP_IDS` in `src/core/progression/modifiers.ts`), each at most once; ids not factors, so tuning the table never rewrites past plays, and awarded XP stays in the attempt's `xp`. Old attempts get an empty list (full difficulty; migration 12 to 13, fixture `profile.v13.json`).

Check: `src/core/progression/helpsRecord.test.ts` "migrates a v12 save to v13: every attempt gets helps: [] (full difficulty), everything else is kept, the input is not changed"; `src/core/progression/helpsRecord.test.ts` "migrating twice gives the same save"

## d064

**Save migration steps write frozen literals, never today's defaults.** Features: none.

Each step in `src/core/progression/migrate.ts` writes the literal values that were the default for its version and imports no default object or builder, so a changed default affects new players only and a different value for old saves needs a new version. `migrate.golden.test.ts` runs every step on its fixture (`tests/fixtures/saves/`) against a frozen file in `tests/fixtures/saves/steps/` (never regenerated once released) and checks that changing every default changes nothing; exception: step 0 to 1 replays old attempts through the XP rules.

Check: `src/core/progression/migrate.golden.test.ts` "each step turns the fixture of its version into the same save as when it was written"; `src/core/progression/migrate.golden.test.ts` "changing a default today does not change what an old save migrates to"

## d069

**One shared save-format bump per round: the first pull request to land owns the version.** Features: core_04.

All save changes in flight together share one `PROFILE_SCHEMA_VERSION` and one migration step (fixed values, d064); later pull requests in the round add fields to it while the version has not reached a release the player uses, and an additive optional field with a default needs no bump. A bumping PR says `[save]` in its title and carries `architect:review`; a round ends when the player's machine has loaded the new version once.

Check: untestable: process rule for agents and the maintainer on how a save-format round is shared (the `[save]` label and `architect:review`)

## d080

**Saves live in IndexedDB behind KeyValueStore, copied once from localStorage.** Features: none.

`IndexedDbStore` (`src/io/storage/IndexedDbStore.ts`, one transaction per call, no dependency) implements `KeyValueStore`; fallbacks are localStorage, then memory. On start `moveSaves` copies every `pianor/` key, reads each back and compares, writes a marker key last, then clears the old keys; a failure before the marker leaves localStorage in use and retries next start. `navigator.storage.persist()` is requested once when IndexedDB opens. Key names and save formats are unchanged; localStorage's 5 MB limit made `setItem` fail silently.

Check: `tests/storage/moveSaves.test.ts` "copies every pianor/ key, checks it reads back, then clears the old keys"; `tests/storage/moveSaves.test.ts` "on a failed copy leaves localStorage untouched and marks nothing as moved, so the next start tries again"; `tests/storage/moveSaves.test.ts` "does nothing again once it has moved, so a second start does not copy old data over new saves"; `tests/storage/IndexedDbStore.test.ts` "rejects when the browser refuses to open the database, so the game can fall back"

## d083

**Profile v15 adds trainerXp, the note-name trainer's XP.** Features: ft_0_17.

`trainerXp` is a non-negative whole number next to `campaign`, the sum of the XP of every right name pressed in the trainer; `deriveProgress` adds it to total XP, and it is never taken away. Migration 14 to 15 sets it to 0; fixtures `tests/fixtures/saves/steps/profile.v14-to-v15.json` and `profile.v15.json`. No level-up events for trainer XP.

Check: `src/core/progression/trainerXp.test.ts` "adds up over several right names and never lowers the total"; `src/core/progression/trainerXp.test.ts` "ignores negative and fractional amounts: the XP is whole and never taken away"; `src/core/progression/migrate.test.ts` "every fixture, from v0 to v16, reaches the current version, is valid there, and migrating twice gives the same save"

## d092

**Profile v16 adds the practice log, one list of per-bar plays.** Features: core_10.

`practice: { bars: BarPlay[] }` sits next to `attempts`; a `BarPlay` holds time, piece, 0-based bar in the piece, notes and first-try count, the Tempo timing score (null in Wait mode), mode, tempo percent, the section range (null for a whole piece) and misses by `(tick in bar, track, midi)`. Heat, progress graph, weakest sections, proposed start tempo and part stars are folds over it and no derived number is stored; piece stats still fold `attempts` only. At most 600 bar plays per piece are kept, oldest dropped first. Migration 15 to 16 sets an empty log; fixtures `tests/fixtures/saves/steps/profile.v15-to-v16.json` and `profile.v16.json`. Changed by d136 (the log is the `practiceLog` document).

Check: `src/core/progression/migrate.test.ts` "a v15 save migrates to v17 with an empty practice log, everything else kept, and migrating twice gives the same save"; `src/core/progression/practiceLog.test.ts` "returns only the bar plays of the piece, in the order they were kept"

## d136

**A player's save is four documents (profile, practiceLog, world, curriculum), each with its own version and migrations.** Features: core_11.

Each document has its own `schemaVersion` (starting at 1), frozen migration steps and golden tests, and is read and written alone through `KeyValueStore` (d080). A change migrates only its document; d069's shared bump applies per document and per stage, and the dev team owns every bump. The move from the old single record runs once, writes all four and leaves the old record untouched until the next release (core_11); the open v18 round lands in the old record or in `profile` v1, never both. Contract: `SaveDocument` in `docs/architect/program-characters-teacher.md`.

Check: `tests/progression/saveDocuments.test.ts` "names the four documents and each starts at version 1 with no steps yet"; `tests/progression/saveDocuments.test.ts` "golden: each version-1 fixture reads and writes back byte for byte"; `tests/progression/saveDocuments.test.ts` "refuses a document from a newer game, broken JSON and a wrong shape with a reason, never by throwing from readDocument"

## d158

**A damaged save never hides a player without a word.** Features: core_11.

A missing or unreadable practice log is copied aside and the player loads with an empty log (the bar history is the least of the save); a damaged profile document is copied aside and its player is still written on the main menu, greyed and not playable, with the reason in its tooltip. Chosen because break-the-game testers found players vanishing on a damaged save; repairing a copy from `pianor/v1/corrupt/` stays a hand job.

Check: `tests/progression/saveDocuments.test.ts` "a damaged practice log is copied aside and the player loads with an empty log, the other documents untouched"; `tests/progression/saveDocuments.test.ts` "a damaged profile document is reported and copied aside"

## d159

**One player in one window at a time.** Features: core_11.

Each window claims the player it opens with the browser's Web Locks (`pianor-player-<id>`, `src/io/storage/playerLock.ts`); a second window that picks the same player stays on the main menu and says the player is open in another window, and any write from a window without the claim is refused (`ProfileService.persist` returns false). The player a window starts on is claimed as it starts, and so is a player it makes or imports; deleting the open player moves to the first other player the window can have, and is refused when every other player is open elsewhere. Picking another player frees the claim; closing the window frees it too. Not guarded: an admin import that replaces a player open in another window (that window's next write wins). Without Web Locks (old browsers, tests) every claim is granted. Chosen because break-the-game testers found two tabs of one player overwriting each other's progress; merging two windows' progress was not chosen (AX-3: the simplest version that loses nothing).

Check: `tests/progression/profile-service.test.ts` "a player open in one window cannot be opened in another, and nothing is written there"; `tests/progression/profile-service.test.ts` "a window that never claimed its player writes nothing over the window that has it"; `tests/progression/profile-service.test.ts` "deleting the open player is refused, changing nothing, when every other player is open in another window (review of d159)"; `tests/progression/profile-service.test.ts` "a window that leaves a player frees it for the other"

## d241

**Every persisted or loaded format (chart, piece meta, save documents, content) has a `schemaVersion` and a tested migration from every older version, and a schema field added without a migration test fails review.** Features: none.

The list of formats, their versions and migration tests is generated in `docs/architecture/schemas.md`; a content file whose version is not the code's fails (`docs/testing.md` section 4, CLAUDE.md, d064, d136).

Check: `tools/docs/schemaVersions.test.ts` "fails on a missing file and on a content file whose version is not the code"; `src/core/progression/migrate.test.ts` "every fixture, from v0 to v16, reaches the current version"

## d242

**Player data stays on the device with no accounts, exports and imports as JSON, and any sync is treated first as a children's-data privacy question.** Features: none.

Saves are profile-scoped documents with an attempt log behind the `KeyValueStore` seam (d080, d136); consent and minimal data come before any technical design of sync (`docs/futureproofing.md` section 1.5, d068).

Check: untestable: a policy for future work; nothing syncs today

## d243

**The hand-zone setting is a list of zones, so another instrument later needs no save change.** Features: none.

A design rule from `docs/architect/roadmap.md` for when the setting is built.

Check: untestable: a review condition: the pull request that adds the hand-zone setting to the save fails review unless the setting is a list of zones

## d244

**Saves belong to the browser and the address the game is served from, so each address keeps its own players; a player moves between them only by the admin page's export and import.** Features: ft_1_07, core_11.

The dev server and `npm run start:local` (`http://127.0.0.1:4173`) are different addresses with different stores; an export carries every save document of the player and an import refuses a newer version of any of them (ft_1_07.AC6, core_11.AC3).

Check: `tests/progression/saveDocuments.test.ts` "export then import on another device gives the same documents, byte for byte"; `tests/progression/saveDocuments.test.ts` "refuses an export with any document newer than this game, with a plain message, and stores nothing"

## d265

**When players seem missing, first ask which address the game was opened on; never delete or overwrite saves to fix it.** Features: none.

Each browser address keeps its own saves (d244); the players are usually on the other address and move over with the admin Export and Import.

Check: untestable: how a thread answers a report of missing players
