---
title: "Notation reference: clefs, accidentals, keys and the grand staff"
---
# Notation reference: clefs, accidentals, keys and the grand staff

Status: reference and the standard for future notation features. Every feature that draws or reads notation (accidentals, key signatures, ties, meter changes, and so on; see `docs/features/core_09-notation-growth.md`) follows this file. If a convention is missing, decide it, add it here, and cite why. The code is the source of truth for what is drawn today: `src/core/chart/pitch.ts` (spelling, clef bottom lines, staff positions) and `src/core/layout/staff.ts` (clefs, brace, grand staff; accidental boxes, key signature places and chord accidental columns in `src/core/layout/accidentals.ts`, the layout's types in `staffTypes.ts`).

## 0. Where the conventions come from

Use these in this order when a question is not answered below:

1. **Elaine Gould, *Behind Bars* (Faber, 2011):** the de facto reference for engraving conventions: clefs, accidentals, key signatures, staff spacing, the grand staff. Our default.
2. **SMuFL (Standard Music Font Layout):** an open standard for music symbol glyphs and their names, so a drawn clef or accidental is the same symbol everywhere. It says what a glyph looks like, not where it goes.
3. **MusicXML:** an open exchange format. It stores each clef as a sign and a staff line, each key as a count of sharps or flats, and each pitch with its alteration, which matches the model here.
4. **ABC notation:** the text format pieces are written in (`docs/authoring/au02-abc-subset.md`). Its accidental marks are `^` (sharp), `_` (flat), `=` (natural), and `^^` and `__` for doubles.

There is no ISO standard for clef placement or accidental placement that we rely on, so none is cited.

## 1. Staff positions

A staff has five lines and four spaces. Positions count up in diatonic steps: 0 is the bottom line, 1 the first space, 2 the second line, and so on, up to 8 for the top line. Positions outside 0 to 8 are ledger lines at even positions.

## 2. Treble clef (G clef)

- Curls around the second line from the bottom, which is G4.
- The bottom line is **E4**, so the lowest space is F4.
- Middle C (C4) sits on the first ledger line below the staff (position -2).
- Used for the right hand in the grand staff, and for higher notes.

## 3. Bass clef (F clef)

- Its two dots surround the fourth line from the bottom, which is F3.
- The bottom line is **G2**, so the top line is A3.
- Middle C (C4) sits on the first ledger line above the staff (position 10).
- Used for the left hand in the grand staff, and for lower notes.

## 4. Accidentals

- Spelling is stored as a step (`C` to `B`) plus an alteration: `-2` double flat, `-1` flat, `0` natural, `+1` sharp, `+2` double sharp (`pitch.ts`). The same pitch can be spelled two ways (C# or Db); the spelling is part of the data.
- An accidental applies to its note until the end of the bar, and to every later note at that staff position in the same bar. A key signature applies to every bar until it changes.
- An accidental is drawn to the left of its notehead, and the bar gives its note the room the accidental needs, so the spacing grows by the accidental's width and nothing collides (`staff.ts`, `accidentalRoomAt`).
- Chords (a simplified stacking, after Gould, section 0): the highest accidental of a chord sits in the column nearest the heads, then the lowest in the next, then the others alternately inwards, one column each, each taking the nearest column in which it overlaps none of the accidentals already there (`accidentalColumns` in `staff.ts`). A column is 1.2 staff spaces wide. Accidentals of a chord keep to the left of its leftmost head.
- Single sharps, flats and naturals are drawn; double sharps and flats are still refused. Source of the rule: `core_09.AC5` (`docs/features/core_09-notation-growth.md`).

## 5. Key signatures

- The order of sharps is F C G D A E B. The order of flats is B E A D G C F. Keys with more accidentals take the first ones in that order.
- Sharps on the treble staff sit on F5, C5, G5, D5, A4, E5, B4. Flats sit on B4, E5, A4, D5, G4, C5, F4.
- Sharps on the bass staff sit on F3, C3, G3, D3, A2, E3, B2. Flats sit on B2, E3, A2, D3, G2, C3, F2.
- A key signature is drawn after the clef on every staff. It changes only at a bar line. A natural sign cancels it for that staff position until the end of the bar, like any other accidental (section 4).
- Drawn since `core_09.AC5`: the key signature sits after the clef, at the positions above, and the time signature and the first note move right by its width.
- A key change (`core_09.AC57`): a double bar line closes the bar before it; inside a line, the bar starts with a natural for each sign of the old key that the new key drops (every one when sharps turn to flats or back), then the new signature, and its notes move right past them. A line that starts in the new key shows it after the clef, and every line keeps the room of the widest signature of the piece. A change of mode alone draws nothing. `AX-3 provisional:` the cancelling naturals are always drawn, and no courtesy signature closes the line before a change at a line start.

## 6. Grand staff

- A treble staff sits above a bass staff, joined by a brace on the left.
- Both staves share the same bar lines and one time axis, so notes that sound together line up vertically.
- Each staff draws its own clef, key signature and accidentals.

## 7. Adding a convention

1. Check this file first, then the references in section 0.
2. If the convention is missing, decide it, add it here with a one-line source, and link the feature file that needs it.
3. Keep the code and this file in step; the tests in `src/core/layout/staff.test.ts` and `src/core/layout/grandStaff.test.ts` are the place for the rule.
4. If a choice is open (a student-facing wording or a layout trade-off), decide it from the axioms (`docs/axioms.md`), and by AX-3 when they do not decide it.
