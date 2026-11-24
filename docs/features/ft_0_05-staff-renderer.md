---
id: "ft_0_05"
title: "Staff renderer"
scope: "Pure staff layout and its Phaser view: clefs, notes, rests, cursor, hints"
effort: "done"
status: "done"
completeness: 100
---
# ft_0_05: Staff renderer (Phaser)

Done. Index: [FEATURES.md](FEATURES.md).

## Rules

Own-built renderer in `src/game/ui/staff`: treble clef first, then bass; ledger lines; whole, half and quarter notes; rests; bar lines; time signature; current-note cursor; per-note states (pending, correct, wrong); optional note-name label and finger number. Big and high-contrast for a young student; pixel-font friendly. Render from the Chart type only.
## Acceptance criteria

- **ft_0_05.AC1** A demo scene renders the sample piece at several sizes without overlap.
- **ft_0_05.AC2** Geometry tests cover the pure layout function (positions are computed apart from drawing).
- **ft_0_05.AC3** Middle C and ledger lines are correct.
- **ft_0_05.AC4** Every staff lies on a sheet of parchment ([d119](../decisions/notation.md#d119)): a pale skin with a torn edge on a desk, painted for the staff's size. A torn edge never comes nearer the staff's standing ink than its plan allows (with no room the sheet runs off that side), and where notes are written the skin keeps the ink at more than 7 to 1. No staff is made smaller for the sheet.

## TODO

- TODO(painter, R2): the cursor's box and a chosen section's bars are opaque fills tuned for cream paper (`cursorFill`, `sectionFill` in `StaffView.ts`); on the parchment they hide the skin's grain. Lay them as a tint the grain shows through, without losing the contrast chosen for the staff.
- TODO(painter, R2): the piece maker's title is a white text box of the browser in the bar; write it on the sheet as a manuscript's heading (acceptable for now, on the painter's list for the piece maker). Its start screen (meter and key) and the grey note names are on the same list.
