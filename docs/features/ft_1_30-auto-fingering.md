---
id: "ft_1_30"
title: "Automatic fingering"
scope: "A minimum-cost fingering search for each hand (single notes and chords, written fingers kept, the level's hand position preferred) behind AUTO in the piece maker, a linter warning for a costly written finger, arrows on the staff where the hand moves, and a hand cost per note for the difficulty estimator"
effort: "medium"
status: "built: search, AUTO in the piece maker, linter warning, hand-shift arrows; the estimator's hands dimension and the weight fit open"
completeness: 80
depends_on: ["ft_1_02d"]
---
# ft_1_30: Automatic fingering

Release R2 (use the evaluator to improve the auto fingering feature). Index: [FEATURES.md](FEATURES.md). Replaces the level-table lookup behind AUTO (ft_1_02d.AC13), which left every note outside the five-finger position and every sharp or flat without a finger.

AX-0: a finger number on the staff tells the student how to play a passage before the hand finds out the hard way; a good one makes the passage playable, a wrong one teaches a habit the teacher has to undo. AUTO must therefore write what a teacher would write, and the level's hand position (what piano lessons teach first) wins wherever it costs little.

## How it works

1. **Costs** (`src/core/fingering/costs.ts`). The ergonomic rules of Parncutt, Sloboda, Clarke, Raekallio and Desain (1997): a table of comfortable, relaxed and practical spans between every two fingers; points for a stretch, a cramped or a wide span, the 4th and 5th fingers, 3 then 4, the 4th on a black key after the 3rd on white, the thumb or the 5th on a black key between white keys, and a thumb passing. The left hand is the right hand mirrored. Added to the paper: a span past the practical one costs 10 points a semitone (the paper forbids it), one finger on two keys in a row costs 10 (2 when a chord is on either side: the hand moves as a block), every move after a rest of a quarter or more costs half (the hand has time), a 4th finger in a chord without the 5th costs 1, and a step taken by two fingers that are not neighbours (5 then 3 on G F) costs 1.
2. **Chords.** Each onset of a hand is a slice; the keys of a chord take different fingers in the order the hand lies. A chord's own cost is the span rules between each two of its fingers; the move between two slices is the mean over every finger pair, so a chord weighs like a note.
3. **Search** (`src/core/fingering/search.ts`). Dynamic programming over the slices (Viterbi): 5 states for a note, at most 10 for a chord; linear in the length of the piece. A finger the author wrote is kept by allowing only the states that have it. A finger the level's hand position names (`fingerings` in `content/curriculum/levels.json`) is preferred with 3 points for each key that does not take it. A tied key keeps its finger. A slice no fingering fits (over five keys, written fingers that clash) is left as written and the search starts again after it.
4. **Hand shifts** (`src/core/fingering/shifts.ts`: an optional helper that shows how a hand should shift up or down the keyboard). From the fingering, the white key under the thumb at each onset; where it changes, the hand moves. The staff draws a small grey arrow above the staff over that note, right for up the keyboard and left for down, in practice and in the piece maker, only while the finger numbers are on (F; the finger hint, which already counts as a hint). The level's hand position is preferred, so a beginner piece shows no arrows and Twinkle shows one up (for G A) and one back down. A key struck again keeps its finger (4 points for changing), so a repeated note does not hide a shift. AX-3 provisional: arrows with the finger hint rather than a setting of their own.
5. **Uses.** AUTO in the piece maker (`autoFingers`, ft_1_02d.AC13); the linter's `fingering-cost` warning (`costlyFingers`, `src/core/fingering/chart.ts`); `steps` per slice for the difficulty estimator's hands dimension (core_08), not wired yet.

AX-3 provisional: every point value above. The paper's values are a published model of adult pianists; the extras are first guesses.

## Acceptance criteria

- **ft_1_30.AC1** The cost of a move: neighbouring fingers on neighbouring keys in the hand's order cost nothing; a stretch costs more for each semitone; the left hand mirrors the right; a crossing of two long fingers costs far more than a thumb going under; one finger on two different keys costs 10 or more, on the same key nothing; the thumb and the 5th finger on a black key between white keys cost more; every move after a rest costs less.
- **ft_1_30.AC2** The best fingering of a line: the five-finger position gets one finger per key in both hands; the C major scale gets 1 2 3 1 2 3 4 5 up in the right hand and down in the left; a stepwise line never uses one finger on two keys in a row; the thumb stays off a black key another finger can take.
- **ft_1_30.AC3** Written fingers are kept and the rest fitted around them; a fingering with a forced finger never costs less than the free best; a slice whose written fingers clash is left and the line goes on after it.
- **ft_1_30.AC4** The level's hand position is preferred where it costs little (D E F in the C position is 2 3 4, not 1 2 3).
- **ft_1_30.AC5** Chords: every head gets its own finger in the order of the hand (C E G is 1 3 5 in the right hand, 5 3 1 in the left); a chord progression keeps that order; a chord of more than five keys is left unfingered. Notes struck together make one slice; a tied key keeps its finger.
- **ft_1_30.AC6** The cost is a measure: `fingeringCost` of the best fingering equals the best cost slice by slice, and a leaping line costs more than a stepwise one.
- **ft_1_30.AC7** AUTO in the piece maker fills every note it can, accidentals and notes outside the hand position too, around the fingers the author set; it counts the notes it could not finger.
- **ft_1_30.AC8** `piece:lint` warns (`fingering-cost`) when a written finger costs the hand 8 points or more over the best finger there, all other written fingers kept, and names the better finger; a teacher's fingering and the level's hand position draw no warning. In a part that leaves the hand position, a finger other than the position's on a position note is a warning, not an error, only where the search takes that finger there too (AUTO's thumb turn must not fail the piece; a plainly wrong finger stays an error), and the generator writes a position finger only where the search takes it too.

- **ft_1_30.AC9** Hand shifts: none in a part that stays in one position; the C major scale moves up at F and back down; the left hand mirrors (down the keyboard is down); written fingers are followed; with the level's position a tune that leaves it moves once and comes back; a repeated key keeps its finger.
- **ft_1_30.AC10** The practice staff shows an arrow where the hand moves, right for up and left for down, only while the finger numbers are on (Twinkle: one up, one down); the piece maker shows them too.

## TODO

- TODO(builder, R3): the hands dimension of the difficulty estimator (core_08) from `bestFingering(...).steps` per bar, with author fingers kept.
- TODO(builder, R3): fit the point values against the fingerings written in the curriculum pieces (and a public fingering set with a FOSS-compatible licence, if one fits) with a `tools/` script; the paper's values stay until then.
- TODO(builder, R3): in a practised section the arrows come from the section alone (`PlaySession` uses the section chart), so its first notes may get other fingers than in the whole piece; compute on the whole piece and map the indexes. Practice prefers the piece's level hand position, the piece maker the player's level; make them one.
- TODO(builder, R3): look at a grand staff with the arrows on: the bass arrows sit between the staves and may meet the treble's low ledger lines.
- IDEA(builder, Later): the number of keys the hand moves beside the arrow, if the arrow alone proves too vague.
- IDEA(builder, Later): rules over three notes in a row (the paper's position-change rules 4, 5 and 7) need a search over finger pairs (25 states); add them if AUTO's lines look wrong to the maintainer.
- TODO(builder, R3): fit the cost extras of `src/core/fingering/costs.ts` (impractical spans, same finger, rest relief, the level's position) against the fingerings written in the pieces.
