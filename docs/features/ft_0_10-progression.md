---
id: "ft_0_10"
title: "Progression"
scope: "XP, levels, unlocks, several players, versioned saves"
effort: "done"
status: "done; numbers provisional"
completeness: 100
---
# ft_0_10: Progression

XP, levels and unlocks from results, several players, versioned saves. Decision: [d021](../decisions/saves.md#d021).

## Rules

- `src/core/progression`: XP from results (accuracy, completion, hint cost, the two-hands multiplier of ft_0_15), levels and unlock rules, driven by domain events. Save and load through an `io/storage` interface (IndexedDB or localStorage): versioned, `profileId`-scoped, attempt event log, JSON export and import.
- Numbers are provisional, in `content/curriculum/progression.json`, with the harder defaults of the difficulty review: two stars from 75%, three from 95% (`src/core/scoring/stars.ts`), a plain repeat earns 30% of the base, each hint kind costs up to 40% (never more than half in total), the XP bank bites 2% at every level (`content/curriculum/xpBank.json`).
- Since ft_1_13 ([d098](../decisions/game.md#d098)) a piece has its own XP and level, a new practice pass gives the player 0 XP, and player levels lock no piece. Saved XP and stars are never recomputed; only a v0 save, replayed on migration, gets new numbers.

## Acceptance criteria

- **ft_0_10.AC1** XP and unlock rules are unit-tested.
- **ft_0_10.AC2** Saves survive a reload.
- **ft_0_10.AC3** No punishing loss of XP.
- **ft_0_10.AC4** A second profile has separate progress.
- **ft_0_10.AC5** A migration test runs from a v1 fixture.
- **ft_0_10.AC6** Export then import reproduces the state.
