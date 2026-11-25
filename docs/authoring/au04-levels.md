---
id: "au04"
summary: "Level definitions (the provisional starter table)"
---
# au04: Level definitions (starter; align to a beginner method book)

Part of [piece authoring](AUTHORING.md).

The order and note set must follow what a beginner is actually learning in lessons. **This table is provisional**: it is the starter table, not a method book's curriculum. Replace it once a method book is chosen. The linter reads the same data from `content/curriculum/levels.json` (marked PROVISIONAL in its `note` field), so changing the curriculum means editing that file, not code.

**Accidentals:** accidentals and key signatures are core notation, not a later level, so every level now sets `accidentals: true`. Pieces may use them from level 1; the level flag stays in the table so it can be gated again later.

**Nothing is off:** a level never switches notation off. Every level sets `rests`, `handsTogether`, `chords`, `ties`, `tuplets` and `ornaments` on and `voices: 2`, so a piece may use any of them from level 1, as it may accidentals; a piece's level is only a recommendation (it sorts the piece book and never locks a piece), the player may try anything, and the levels are the teacher's curriculum: they differ by hands, range, leaps, note values and meters. The switches stay in the table for a teacher's own curriculum. A test in `tools/piece/lint.test.ts` holds it.

Each level row in `levels.json` sets: `hands`, `clefs`, `range` (MIDI numbers, inside the EZ-220's 36 to 96), `noteValues` (`whole dottedHalf half dottedQuarter quarter dottedEighth eighth sixteenth`), `rests`, `meters`, `maxLeapSteps` (0 repeated note, 1 step, 2 third, 4 fifth), `accidentals`, `handsTogether` (may the hands sound at once; the two-hands bonus applies), `chords` and `ties`, `tuplets` (triplets, core_09.AC51), `voices` (how many voices one hand may play, 1 or 2, d164), `ornaments` (trill, mordent and turn signs, core_09.AC64, d305), `bars` (`min` and `max` for the whole piece, default 4 to 16) and `fingerings` (a finger for each note name per hand, i.e. the hand position; notes not listed are unchecked).

The table as the linter reads it (generated from `content/curriculum/levels.json`, so it cannot drift from the data):

<!-- docs:levels -->
| Level | Name | Hands | Clefs | Range | Note values | Rests | Meters | Largest leap (steps) | Hands together | Bars |
|---|---|---|---|---|---|---|---|---|---|---|
| 1 | Right hand, C position, steps | RH | treble | C4 to G4 | whole, dottedHalf, half, quarter | yes | 4/4 | 1 | yes | 4 to 32 |
| 2 | Left hand, C position, steps | LH | bass | C3 to G3 | whole, dottedHalf, half, quarter | yes | 4/4 | 1 | yes | 4 to 32 |
| 3 | Right hand, thirds and 3/4 | RH | treble | C4 to G4 | whole, dottedHalf, half, quarter | yes | 4/4, 3/4 | 2 | yes | 4 to 32 |
| 4 | Both hands | RH, LH | treble, bass | C3 to G4 | whole, dottedHalf, half, quarter | yes | 4/4, 3/4 | 2 | yes | 4 to 32 |
| 5 | Both hands together, eighth notes | RH, LH | treble, bass | C3 to C5 | whole, dottedHalf, half, dottedQuarter, quarter, dottedEighth, eighth, sixteenth | yes | 4/4, 3/4, 2/4 | 4 | yes | 4 to 32 |
| 6 | Classics arranged: wider range and leaps | RH, LH | treble, bass | C3 to C6 | whole, dottedHalf, half, dottedQuarter, quarter, dottedEighth, eighth, sixteenth | yes | 4/4, 3/4, 2/4 | 7 | yes | 4 to 32 |
<!-- /docs:levels -->

Every level that allows the half note also allows the dotted half (`dottedHalf` in `noteValues`, a full 3/4 bar), so a piece written in the editor with one fits a level. It stays at every level, the lowest included. The dotted quarter (`dottedQuarter`, core_09.AC38) comes with the eighth at level 5, since its partner is an eighth. AX-3 provisional: the level that brings eighths brings the dotted quarter. Level 5 also has the dotted eighth and the sixteenth (core_09.AC42), so it allows every value the staff draws. The generators never write dotted notes.

What the levels are for: level 2 mirrors level 1 for the left hand; level 3 adds small skips (thirds) and 3/4; level 4 brings both hands; level 5 adds eighths, sixteenths and wider leaps; level 6 holds real classics arranged for beginners (the tune in the right hand, the bass in the left, cut into 4-bar song parts), with the range widened to C3 to C6 and leaps up to an octave, since a real tune needs them. Accidentals and key signatures are not a level: every level allows them (`accidentals: true`, all fifteen `keys`), since pieces come from practice sheets that use them (core_09.AC9; the draft pieces `g-major-walk` in G and `f-major-song` in F show them).

## TODO

- AX-3 provisional: level 6 is level 5 with a wider range and larger leaps, made for the first arranged classics (Ständchen, the Impromptu in C minor); it gets its own place in the order once a method book is chosen. TODO(architect, Later): review level 6 with the rest of the table.
- IDEA: the faithful full scores of the arranged classics (chords, both hands as written, the whole Impromptu with its key changes) as advanced songs, once the levels have chords and a song part can draw its own key. The beginner arrangements come first.
