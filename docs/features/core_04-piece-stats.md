---
id: "core_04"
title: "Piece stats and history"
scope: "Per player and piece: history, speed, accuracy, proficiency"
effort: "medium"
status: "built (history, proficiency, accuracy, timing, speed, start tempo, stats page with graph); numbers provisional, confirm what played well means"
completeness: 80
---
# core_04: Piece stats and history per player

Each piece keeps numbers and a history for each player. Built (d044). Index: [FEATURES.md](FEATURES.md).

## Rules

1. **History:** every finished full play is an attempt in the player's save, with `play` (Wait or Tempo, tempo percent) and, in Tempo mode, its timing statistics. Sections are not recorded (no XP). Save version 5; older attempts migrate as Wait at 100.
2. **Stats** (`core/progression/stats.ts`, pure, folded from the history, never stored):
   - *Proficiency:* the share of the last 60 plays played well (15 of 60 is 25 percent); it can go down.
   - *Accuracy:* mean first-try accuracy over that window.
   - *Timing:* mean timing score of the Tempo plays in it.
   - *Speed:* the highest tempo percent a Tempo play was played well at, ever; above 100 is possible.
3. **Played well** (AX-1; `stats` in `content/curriculum/progression.json`, tunable): at least 90 percent of notes right the first time, no hint, and in Tempo mode a timing score of at least 70.
4. **Results screen:** "Keeping it up: N%", and after a Tempo play "Timing N" and "Fastest: N%". Only true and kind numbers, never "worse than before". A piece starts at the tempo percent where this player last played it (100 when never; finishes core_03's initial tempo). The graph below also shows on the score screen after every session ([ft_1_12](ft_1_12-training-piano.md)).
5. **Stats page**: the `S` button beside `i` on a menu card shows plays, keeping it up, right the first time, fastest, and a graph drawn with the pixel kit (`core/layout/historyGraph.ts`). Full plays (`pieceHistory`) are spaced evenly left to right, oldest first, at the height of their accuracy, dashed lines at 0, 50 and 100, first and last date under it; Wait plays are dark brown dots, Tempo red, with a legend once a Tempo play shows. When more plays than fit (one per 3 art pixels) only the latest show and the page says how many. No save change. A piece learned bar by bar has a third button there that opens its learning stats ([ft_1_32](ft_1_32-learn-a-piece-bar-by-bar.md) rule 10).
6. **Not built:** stats on the piece's card (core_05); per-note timing in the history (only totals).

## Acceptance criteria

- **core_04.AC1** Plays are recorded and survive a reload.
- **core_04.AC2** The stats are pure functions of the history, with tests.
- **core_04.AC3** Old saves migrate.
- **core_04.AC4** A piece's stats page shows its full plays over time as graph points, oldest first, from the history only: section plays never appear, and other pieces' plays never appear (`pieceHistory`, tests).
- **core_04.AC5** Every unlocked piece in the menu has an `S` button beside `i` that opens the piece's stats page for the active player: how often it was played, keeping it up, right the first time, the fastest tempo, and a graph of each full play's accuracy, oldest left, the latest that fit when there are many (`historyGraph`, pure, tests). A piece not played yet says so kindly; a section played over and over adds nothing; Back and Escape go to the menu (`tests/e2e/piece-stats.spec.ts`).
