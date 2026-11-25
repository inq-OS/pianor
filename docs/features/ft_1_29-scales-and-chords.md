---
id: "ft_1_29"
title: "Scales and chords trainer"
scope: "The rest of the theory trainer under Practice theory: play a scale or chord of a chosen key from the staff, play a chord from its name, a scale switcher, and a chord namer for the keys pressed"
effort: "large"
status: "slices A to D built: a scale or triad of a chosen key and hand, a chord from its name in three steps, the scale switcher, and the chord namer; slice B's staff-note step open; verified on the virtual device only"
completeness: 85
depends_on: ["ft_0_17", "ft_1_28"]
---
# ft_1_29: Scales and chords trainer

Release R2 (build them now). Index: [FEATURES.md](FEATURES.md). The first part of the theory trainer, the note-name trainer, is ft_0_17; these slices sit beside it under "Practice theory" (the stand's panel in the room, ft_1_08.AC11), on the same rules: three lives where there are lives, a wrong press says why (`classifyWrongNote`), XP is kept on a loss (AX-1.1), no time limits.

AX-0: each slice makes the student play the notes, not only see them. Key data (spelling, relative minors) comes from ft_1_28's pure layout and `src/core/editor/key.ts`.

## Slices

| Slice | What | Effort |
|---|---|---|
| A | **Play a scale or chord.** Pick a key (major or minor) and a shape: the scale one octave up and down, or the triad. It is shown on the grand staff and played in Wait mode like a piece (a generated chart, the `scale` generator's rules); names on the notes only after a wrong press (ft_0_17.AC1) | simple |
| B | **Chord from its name.** A chord name stands large (C, a, G, then sevenths); the student plays it, any inversion, any octave in the level's range, the notes held together. A wrong press says which note is not in the chord. Steps as content: triads on white keys first, then all twelve, then sevenths; a later step shows one note on the staff that must be in the chord (the key must be part of the chord, read from the staff instead of a light, AX-0.1) | medium |
| C | **Scale switcher.** The student plays a scale up and down without stopping; every bar the name changes (first around the circle, C to G to D, then at random) and the cursor waits for the next note of the new scale | medium |
| D | **Chord namer.** A pure `nameChord(pitches)` with the chord dictionary as content (`schemaVersion`), shown live for the keys held on slice A's screen and for the chord under the cursor in the piece maker (names like e7♭5; letters follow the B or H setting) | medium |

Chord and key names in Estonian follow the way Estonian music teaching writes them (C-duur, a-moll; capitals on screen by the house rule): the builder settles the exact words with `write-ui-text`.

## Slice A as built

- The stand's panel has a third picture, three steps with a note on each (`scaleSteps` in `standArt.ts`), which opens `ShapeTrainerScene`; the rules are `src/core/trainer/shapeTrainer.ts` (`shapeChart`, `ShapeRound` around `WaitMode`).
- The toolbar holds the key (the circle of fifths opened to choose), the shape (scale or triad) and the hand (right or left); each change starts a new round. A wrong key flashes the awaited note and puts the names on the notes; a right note's XP (10) goes at once to the trainer XP of ft_0_17, which the player's card now calls XP from theory.
- `AX-3 provisional:` the scale is one octave up and down in quarters with a long last tonic, the natural minor for a minor key; the triad is its three notes one by one, then together. The right hand plays from octave 4 on the treble staff, the left hand on the bass staff from octave 3 (tonics C to E) or 2 (F to B), one staff at a time rather than the grand staff. TODO(architect, R2): ask the maintainer after a week of use whether the harmonic and melodic minor, both hands together or the grand staff are wanted.

## Slice B as built

- A fourth picture on the stand's panel, three notes on one stem (`chordBoard`, a first sketch), opens `ChordTrainerScene`; the rules are `src/core/trainer/chordTrainer.ts` (`loadChordContent`, `parseChord`, `chordLabel`, `ChordRound`), the chords `content/trainer/chords.json` (`schemaVersion` 1).
- A chord name is a root letter, capital for major and small for minor, an optional `b` or `#` and a suffix the dictionary knows (`7`, `maj7`); a step with a name the dictionary does not know fails to load. Steps: triads on white keys, all twelve major and minor triads, seventh chords.
- The chord counts once every one of its pitch classes is among the keys pressed for it and still down, in any octave or inversion; keys still down from the last chord do not count. A key outside the chord costs a life and is named (spelled with flats for a flat chord). XP is 10 per note of a right chord, kept on a loss.
- `AX-3 provisional:` any key of the keyboard counts, not only the level's range; the pixel font has no sharp sign, so a sharp is written #. TODO(architect, R2): decide whether a chord must be played inside the player's level range, as AC2 says.

## Slice C as built

- The scale switcher is the third choice of slice A's shape button (`switcherChart` in `src/core/trainer/scaleSwitcher.ts`, judged by `ShapeRound`): twelve bars of eighths, each the major scale of its key, up in one bar and down in the next. The first six keys go round the circle from C (C, G, D, A, E, B), the rest are seeded at random within six signs, never the same key twice in a row. The name of the cursor's bar's key stands above the staff.
- `AX-3 provisional:` the staff stays in C major and each note carries its own sign, (a key change at a bar line is drawn since core_09.AC57, so the switcher could draw each bar's signature); major keys only; twelve bars. TODO(architect, R2): ask the maintainer after a week of use whether the switcher should draw the new signature each bar once key changes are drawn, and whether minor keys belong in it.

## Slice D as built

- `nameChord(content, keys)` in `src/core/trainer/chordNamer.ts` names the chord the keys make from slice B's dictionary, now with the diminished and augmented triads and the half-diminished and diminished sevenths (`dim`, `+`, `7b5` shown as 7♭5, `dim7`); nothing for a set it does not know or for fewer than three pitch classes. Of the roots that fit, the lowest key's wins, so a symmetric chord is named from its bass.
- Shown live at the left above the staff on slice A's screen for the keys held, and in the piece maker as a message when a selected note's column (both hands) is a chord, once per column and set of notes.
- `AX-3 provisional:` each root is spelled as it is most often taught (Db, Eb, F#, Ab, Bb; c#, eb, f#, g#, bb), not from the piece's key. TODO(architect, R2): confirm the root spellings, or spell a column's chord from the piece's key.

## Acceptance criteria

- **ft_1_29.AC1** Slice A: a chosen key and shape is shown on the staff and judged in Wait mode; a wrong press costs a life and says why; XP earned is kept on a loss.
- **ft_1_29.AC2** Slice B: every chord of a step is accepted in any inversion and octave inside the range, and only with all its notes held; a wrong note names itself.
- **ft_1_29.AC3** Slice C: after each bar the scale name changes and the next awaited note belongs to the new scale.
- **ft_1_29.AC4** Slice D: `nameChord` names every triad and seventh chord of the dictionary in every inversion (property test), and says nothing for a set it does not know.
- **ft_1_29.AC5** Steps and the dictionary are validated content; adding a step needs no code change; no save change beyond the trainer XP of ft_0_17.

## TODO

- TODO(builder, R2): slice B's last step, one note on the staff that must be in the chord, test first in `src/core/trainer/`.
- TODO(painter, R2): the stand panel's pictures for the new trainers (scale, chord, switcher), from the free packs first; slice A's three steps (`scaleSteps`) are a first sketch to repaint.
- NEEDS-HUMAN: play a scale and a triad on the EZ-220 in the trainer, both hands, a few chords from their names, the scale switcher, and the chord names for held keys.
- TODO(builder, Later): light the scale's or chord's keys on the EZ-220 once ft_Y_06's real output works (needs the silent-light test there).
- IDEA(architect, Later): a two-player game with the keyboard split in half. Not now: it needs two profiles at once and a save answer for whose XP it is.
