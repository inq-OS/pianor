---
id: "core_11"
title: "The saved player as documents, each with its own version"
scope: "Split the saved player into documents (the profile core, the practice log, the world, the curriculum), each with its own schemaVersion, migration chain and golden fixtures, read and written through the KeyValueStore seam; one document can change without migrating the others"
effort: "medium"
status: "built: the four documents, the one-time move and the golden tests; not yet tried in a real install"
completeness: 90
depends_on: ["ft_0_10"]
---
# core_11: The saved player as documents, each with its own version

One profile object used to carry everything, so every new block (world, curriculum, phrase book, finer practice log) would migrate all of it. Now a player is a set of documents, each with its own version. A futureproofing seam ([programme](../architect/program-characters-teacher.md), plan). Index: [FEATURES.md](FEATURES.md).

## Rules

- `src/core/save/documents.ts` holds four documents (`profileDocument(config)`, `practiceLogDocument`, `worldDocument`, `curriculumDocument`), each at version 1 with no steps yet; `readDocument` never throws.
- The repository (`src/core/progression/repository.ts`) stores `pianor/v1/player/<id>/<document>`. `save` writes the profile and the practice log; `saveDocument` and `loadDocument` the world and the curriculum alone.
- The first load of a player with only the old record (`pianor/v1/profile/<id>`) migrates it as before and writes all four documents; the record stays untouched; deleting a player removes both.
- Export is version 2 (`documents`, each with its version); version 1 exports still import.
- The profile document's version 1 holds the version 17 profile (`PROFILE_DOCUMENT_V1_HOLDS`, frozen). The v18 round (AC5) lands as the profile document's version 2; a test fails if `PROFILE_SCHEMA_VERSION` moves instead.
- A save that cannot be read is copied aside to `pianor/v1/corrupt/<id>-<document>-<time>` before anything replaces it ([d158](../decisions/saves.md#d158)). A missing or damaged practice log costs only the bar history: the player loads with an empty log. A damaged profile document keeps the player off the list of playable players, but the main menu still writes its name (or `?`), greyed, with a tooltip saying the save cannot be read and a copy is kept (`damagedProfiles`).
- One player is open in one window at a time ([d159](../decisions/saves.md#d159)): a window claims the player it starts on and the player it opens (Web Locks); a second window that picks the same player stays on the main menu with a line saying so, and a write from a window without the claim is refused.
- Golden fixtures: `tests/fixtures/saves/documents/`; tests: `tests/progression/saveDocuments.test.ts`.

## Acceptance criteria

All AX-3 provisional until built and tried; numbers are content, not code.

- **core_11.AC1** A player is stored as named documents under one player key prefix; each document has its own `schemaVersion` and its own frozen migration steps with golden fixtures (`save-format-bump` skill).
- **core_11.AC2** The current profile (one object) migrates once into the documents; a profile of any earlier version still loads, keeps every attempt, practice entry and finished challenge, and is checked by a golden test.
- **core_11.AC3** Export and import of a player (admin page) carry all its documents and refuse a newer version of any one of them with a plain message.
- **core_11.AC4** A new document (for example the world) is added without bumping the others; a test proves the others are byte-identical after the addition.
- **core_11.AC5** The v18 save round (rhythm practice, helper marks, wheel, text settings) lands either before the split or inside the profile-core document, never in both.

## TODO

- TODO(builder, R4): remove the old profile records (`pianor/v1/profile/<id>`) and their move one release after core_11 reached a real install (d136).
