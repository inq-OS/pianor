---
id: "ft_0_15"
title: "Grand staff and two hands"
scope: "Grand staff layout, two-hand steps, the together bonus"
effort: "done"
status: "done; real two-hand play open (Human)"
completeness: 100
---
# ft_0_15: Grand staff and two-hand play

Treble and bass are drawn together on a grand staff, and playing both hands at once is rewarded. Done; the real-keyboard items are open. Bonus up to +50 percent, together window 300 ms, part of the MVP because a beginner's curriculum requires two hands. Index: [FEATURES.md](FEATURES.md).

## Rules

1. **Layout** (`core/layout`, pure): a treble and a bass staff per system joined by a brace and shared bar lines, notes by their track's clef, x aligned across both staves on one time axis, ledger lines and stems per staff, auto-sized (target 1366x768). `layoutStaff` refuses more than two played tracks; the piece picker hides undrawable charts. The view highlights every awaited note (one per hand). Look at 13 px between lines: d022.
2. **Judge:** each step knows its hands (`track.hand`). A two-hand step needs both RH and LH notes. Wait mode never fails a note; for the bonus the judge records whether the step was played together: all notes within 300 ms (tunable) and no wrong key first. MIDI cannot tell the hand, so together means nearly the same time. Results (bar, phrase, piece) carry `bothHands: { notes, together }`; the judge event version stays 1.
3. **Multiplier** (`core/scoring`): `bothHandsMultiplier(stats) = 1 + MAX_BONUS * together / notes`, `MAX_BONUS` 0.5. It only adds: no penalty, no effect on stars. XP (ft_0_10) uses it, shown on the results screen.
4. **Content:** level 4 hands alternate, level 5 and up may play together (linter rule `hands-together`, ft_0_04). Samples: `content/pieces/both-hands`, `tests/fixtures/anchors/take-turns`, `tests/golden/hands-together.chart.json`. The ABC compiler emits one track per voice with `hand` and `clef`.
5. **Input:** the on-screen keyboard tracks every pointer separately (tested with synthetic pointer events only); the computer keyboard is awkward for two hands, a dev fallback. The virtual player has `hands`, `handOrder`, `handGapMs` in `composePerformance` (`tests/e2e/twohands.spec.ts`).
6. Not verified (needs human): two hands on the EZ-220, multi-touch on the tablet, whether a beginner reads the grand staff at 13 px.

## Acceptance criteria

- **ft_0_15.AC1** A two-hand sample piece is drawn on a grand staff without overlap at 1366x768, 1280x720 and 1024x600.
- **ft_0_15.AC2** Wait mode asks for both hands and the cursor shows every awaited note.
- **ft_0_15.AC3** Replay and property tests cover pressing the hands together, apart, in either order, with wrong keys between.
- **ft_0_15.AC4** The multiplier is 1 for single-hand pieces, rises only with together-first-try notes, never drops below 1, and is covered by unit and property tests.
- **ft_0_15.AC5** The results screen can show the bonus and the XP rule uses it.
- **ft_0_15.AC6** The maintainer reviews the level at which two hands together is introduced (AX-0.4: decided on AX-0, not by a school). [human]
