---
id: "au04"
summary: "Level definitions (the provisional starter table)"
---
# au04: Level definitions (starter; align to a beginner method book)

Part of [piece authoring](AUTHORING.md).

The order and note set must follow what a beginner is actually learning in lessons. **This table is provisional**: it is the starter table, not a method book's curriculum. Replace it once a method book is chosen. The linter reads the same data from `content/curriculum/levels.json` (marked PROVISIONAL in its `note` field), so changing the curriculum means editing that file, not code.

**Accidentals:** accidentals and key signatures are core notation, not a later level, so every level now sets `accidentals: true`. Pieces may use them from level 1; the level flag stays in the table so it can be gated again later.

Each level row in `levels.json` sets: `hands`, `clefs`, `range` (MIDI numbers, inside the EZ-220's 36 to 96), `noteValues` (`whole dottedHalf half dottedQuarter quarter dottedEighth eighth sixteenth`), `rests`, `meters`, `maxLeapSteps` (0 repeated note, 1 step, 2 third, 4 fifth), `accidentals`, `handsTogether` (may the hands sound at once; the two-hands bonus applies), `chords` and `ties` (on at every level now that the staff draws them), `tuplets` (triplets; absent means off, on at level 5, core_09.AC51), `voices` (how many voices one hand may play, 1 or 2, absent means 1; 2 from level 5, d164), `ornaments` (trill, mordent and turn signs; absent means off, off at every level for now, core_09.AC64, d303), `bars` (`min` and `max` for the whole piece, default 4 to 16) and `fingerings` (a finger for each note name per hand, i.e. the hand position; notes not listed are unchecked).

The table as the linter reads it (generated from `content/curriculum/levels.json`, so it cannot drift from the data):

<!-- docs:levels -->
| Level | Name | Hands | Clefs | Range | Note values | Rests | Meters | Largest leap (steps) | Hands together | Bars |
|---|---|---|---|---|---|---|---|---|---|---|
| 1 | Right hand, C position, steps | RH | treble | C4 to G4 | whole, dottedHalf, half, quarter | no | 4/4 | 1 | no | 4 to 32 |
| 2 | Left hand, C position, steps | LH | bass | C3 to G3 | whole, dottedHalf, half, quarter | no | 4/4 | 1 | no | 4 to 32 |
| 3 | Right hand, rests and thirds | RH | treble | C4 to G4 | whole, dottedHalf, half, quarter | yes | 4/4, 3/4 | 2 | no | 4 to 32 |
| 4 | Both hands, one at a time | RH, LH | treble, bass | C3 to G4 | whole, dottedHalf, half, quarter | yes | 4/4, 3/4 | 2 | no | 4 to 32 |
| 5 | Both hands together, eighth notes | RH, LH | treble, bass | C3 to C5 | whole, dottedHalf, half, dottedQuarter, quarter, dottedEighth, eighth, sixteenth | yes | 4/4, 3/4, 2/4 | 4 | yes | 4 to 32 |
<!-- /docs:levels -->

Every level that allows the half note also allows the dotted half (`dottedHalf` in `noteValues`, a full 3/4 bar), so a piece written in the editor with one fits a level. It stays at every level, the lowest included. The dotted quarter (`dottedQuarter`, core_09.AC38) comes with the eighth at level 5, since its partner is an eighth. AX-3 provisional: the level that brings eighths brings the dotted quarter. Level 5 also has the dotted eighth and the sixteenth (core_09.AC42), so it allows every value the staff draws. The generators never write dotted notes.

What the levels are for: level 2 mirrors level 1 for the left hand; level 3 introduces rests and small skips (thirds); level 4 alternates hands in separate phrases; level 5 lets the hands play together (the two-hand bonus of ft_0_15) and adds eighths. Accidentals and key signatures are not a level: every level allows them (`accidentals: true`, all fifteen `keys`), since pieces come from practice sheets that use them (core_09.AC9; the draft pieces `g-major-walk` in G and `f-major-song` in F show them).
