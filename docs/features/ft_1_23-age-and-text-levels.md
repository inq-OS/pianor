---
id: "ft_1_23"
title: "The player's age from a birth month, and text levels by age"
scope: "When a player is made, the game asks for the birth year and month; only these are kept, in that player's local save, never exported, reported or logged; characters may say the player's age; the age sets a default text level (very simple capitals for the youngest, normal text for adults), changed by the parent under admin. MVP: one plain text level"
effort: "medium"
status: "designed (d132); nothing built"
completeness: 0
depends_on: ["ft_1_07", "ft_0_18"]
---
# ft_1_23: The player's age from a birth month, and text levels by age

Release R4 (with its save round). Decision: [d132](../decisions/game.md#d132) point 9. Index: [FEATURES.md](FEATURES.md).

Character creation asks for the birth month: it is never exposed, characters can show the player's age, and text may later suit the age (the youngest: very simple capitals; adults: normal text). MVP: simple text, not too simple.

## Rules

1. Only year and month are kept, in the player's local profile, never leaving the machine (AC1 to AC3).
2. The age gives a default text level, changeable by the parent under admin (AC4); the MVP has one plain level (AC5).

## Acceptance criteria

- **ft_1_23.AC1** Making a player asks for the birth year and month in the game's own picker (no browser box); it can be skipped. Only year and month are kept (data minimisation: enough for an age, nothing more to leak).
- **ft_1_23.AC2** The birth month lives only in that player's profile in the local save (IndexedDB, d080), with a `schemaVersion` bump in a shared save round (d069) and a tested migration (existing players: none).
- **ft_1_23.AC3** The birth month never leaves the machine: it is left out of the bug report (ft_1_16), the profile export of the admin page, any log, issue or test fixture; a test proves the export and the report carry no birth field. Only the age in whole years is shown, and only by characters and the admin page.
- **ft_1_23.AC4** The age gives a default text level (AX-3 provisional: under 8 simple capitals, 8 to 12 capitals, 13 and over normal case); the parent can set the level per player under admin. Text levels are variants of the same string keys (`write-ui-text`), so a missing variant falls back to the plain one.
- **ft_1_23.AC5** MVP: one plain text level for everyone ("simple text, not too simple"); AC4 comes later.

## TODO

- IDEA(builder, R4): held: AC1 to AC3 in R4's shared save round (`save-format-bump` skill), the privacy test first.
- IDEA(builder, Later): AC4, text levels by age, once the conversations (ft_1_22) have enough text to need them.
