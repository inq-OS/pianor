---
id: "core_12"
title: "Evaluation of plays and the curriculum model"
scope: "Pure core: the play score and its parts per hand, the level of a piece (median of the last plays), the consistency rule, standard deviation and histogram data, Theil-Sen extrapolation to a deadline with a band, expected level from base and priority, urgency, colours and medals; the curriculum per player (pieces, deadlines, priorities, rules) as a versioned document"
effort: "large"
status: "in progress: the model as pure functions, statuses, the curriculum document and the practice log's share per hand with onset deviation are built; a wrong key's onset is not counted yet"
completeness: 75
depends_on: ["core_04", "core_10", "core_11"]
---
# core_12: Evaluation of plays and the curriculum model

Stage 1 or 2 of the [characters and teacher programme](../architect/program-characters-teacher.md). Index: [FEATURES.md](FEATURES.md).

Plan F11 and section 4. Later slices: requirement rules per bar and hand with AND/OR (F12), the test (4.7), spaced repetition and the memory trainer (F13).

## Rules

- The model of d139 is pure functions in `src/core/curriculum/evaluate.ts` with defaults in `content/curriculum/evaluation.json` (AC1, AC3 to AC8). `playResultsFromLog` (`src/core/curriculum/fromLog.ts`) reads the practice log as plays. The teacher's screen reads `curriculumStatuses` (ft_1_26, ft_1_26).
- Each bar in the practice log keeps its share per hand (`hands` on `BarPlay`, by the hand of each note's track): notes, first tries, and in Tempo mode the notes on time and the signed onset deviation of every note pressed in time, as count, sum and sum of squares in ticks at the written tempo (AC2). `playResultsFromLog` sums them into each play's `hands` (A.11 `HandMeasure`, exact mean and spread); a play with a bar kept before this has no hands. An optional field: older saves read as before, no version step (d069.3).

## Acceptance criteria

All AX-3 provisional until built and tried; numbers are content, not code.

- **core_12.AC1** A play gives a measured result with its parts shown separately: pitch accuracy per hand, timing per hand (Tempo mode: mean and spread of onset deviation), tempo reached, misses by reason, must-hit notes kept; the play score folds them by weights from content (default pitch 60, timing 30, tempo 10 in Tempo mode; pitch 100 in Wait mode).
- **core_12.AC2** The practice log gains the onset deviation of each note per hand (a document change under core_11) so rhythm steadiness per hand can be measured, wrong notes counted for rhythm.
- **core_12.AC3** The level of a piece is the median of its last X plays (default 10); one play of 100 after ten of 60 does not make it retained (a test with this example).
- **core_12.AC4** Retained: of the last X plays at least Y (default 3) reach the expected level A, at most Z fall below it, none by more than B points; X, Y, Z, B per piece with defaults from content.
- **core_12.AC5** Statistics for the teacher: mean, median, standard deviation and a histogram of play scores, filtered by the last N plays or days, mode and tempo.
- **core_12.AC6** Extrapolation: Theil-Sen trend over the last N practice days projected to the deadline, capped at 100, with a band from the spread; no projection under 3 plays.
- **core_12.AC7** Expected level = base (default 85) + priority (1 to 10); urgency ranks pieces as in [d139](../decisions/game.md#d139), with the example A: priority 2, B: priority 8, B first, as a test.
- **core_12.AC8** Colour (purple, scaled green, strong green) and medal (bronze 85 to 95, silver 96 to 105, gold above, of achieved over expected) are pure functions with tests.
- **core_12.AC9** The curriculum document per player (core_11): curriculum pieces with deadline, priority, overrides of the numbers, calendar entries and notes; only the teacher's screen writes it.

## Parts

- TODO(builder, R3): a wrong key's onset counted for rhythm (core_12.AC2's last words): `WrongNoteJudged` carries no timing, so today only the notes pressed right (first try or later) give onsets. Needs a judge event change (`docs/futureproofing.md` 1.3, the event version as in d093): ask the architect first.
- ft_1_26 (released early): the teacher's first screen reads this feature's statuses (ft_1_26); the query part is tagged there.
- Later (stage 3): requirement rules per bar and hand with AND/OR, the test, spaced repetition and the memory trainer.
