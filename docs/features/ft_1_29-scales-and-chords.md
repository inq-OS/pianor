---
id: "ft_1_29"
title: "Scales and chords trainer"
scope: "The rest of the theory trainer under Practice theory: play a scale or chord of a chosen key from the staff, play a chord from its name, a scale switcher, and a chord namer for the keys pressed"
effort: "large"
status: "planned (the note-name part is ft_0_17, built)"
completeness: 0
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

## Acceptance criteria

- **ft_1_29.AC1** Slice A: a chosen key and shape is shown on the staff and judged in Wait mode; a wrong press costs a life and says why; XP earned is kept on a loss.
- **ft_1_29.AC2** Slice B: every chord of a step is accepted in any inversion and octave inside the range, and only with all its notes held; a wrong note names itself.
- **ft_1_29.AC3** Slice C: after each bar the scale name changes and the next awaited note belongs to the new scale.
- **ft_1_29.AC4** Slice D: `nameChord` names every triad and seventh chord of the dictionary in every inversion (property test), and says nothing for a set it does not know.
- **ft_1_29.AC5** Steps and the dictionary are validated content; adding a step needs no code change; no save change beyond the trainer XP of ft_0_17.

## TODO

- TODO(builder, R2): slice A, then B, C and D, each its own pull request, test first in `src/core/trainer/`.
- TODO(painter, R2): the stand panel's icons for the new trainers (scale, chord, switcher), from the free packs first, after slice A is on `main`.
- TODO(builder, Later): light the scale's or chord's keys on the EZ-220 once ft_Y_06's real output works (needs the silent-light test there).
- IDEA(architect, Later): a two-player game with the keyboard split in half. Not now: it needs two profiles at once and a save answer for whose XP it is.
- Rejected: skill training that levels a character's attributes; the battles and their attributes are deleted (d151).
