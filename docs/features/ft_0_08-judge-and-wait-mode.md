---
id: "ft_0_08"
title: "Judge and Wait mode"
scope: "Wait-mode judge, wrong-note reasons, bar, phrase and piece results"
effort: "done"
status: "done"
completeness: 100
---
# ft_0_08: Judge and wait mode (core)

Index: [FEATURES.md](FEATURES.md).

## Rules

`src/core/judge`: input is abstract `NoteEvent`s; output is domain events (`NoteJudged`, `BarCompleted`, `PhraseCompleted`, `PieceCompleted`). Play mode is a `PlayMode` strategy interface; Wait is the first implementation (see `docs/futureproofing.md` 1.2 and 1.3). Wait mode: cursor on the current note (or chord); right key advances; wrong key produces a verdict with a reason (wrong octave, neighbour key, wrong letter; "other hand's range" only for two-hand pieces, since MIDI cannot tell which hand played). Per-bar and per-piece results (accuracy, mistakes, hints used). Rhythm tracked but not punishing.

## Acceptance criteria

- **ft_0_08.AC1** Deterministic unit, property and replay tests with scripted and recorded event sequences, including chords in any press order, repeated notes, wrong-then-right, and note-off handling.
- **ft_0_08.AC2** A second dummy `PlayMode` in tests proves the interface is not Wait-specific.
- **ft_0_08.AC3** The judge has no import of any UI or io code (enforced by the lint boundary for `src/core`).
