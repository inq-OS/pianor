---
id: "au06"
summary: "`piece:generate`: five seeded generators and regeneration"
---
# au06: Generators (`npm run piece:generate`)

Part of [piece authoring](AUTHORING.md).

`piece:generate` makes a draft piece folder in `content/pieces/` (`--out` for another folder). Its usage, as the tool prints it:

<!-- docs:usage generate -->
```text
Usage:
  piece:generate <kind> --level N [--seed S] [--hand RH|LH|both] [--bars N] [--meter 3/4]
                 [--pattern runs|skips|pairs] [--motif "0 1 2 1"]
                 [--out content/pieces] [--levels content/curriculum/levels.json] [--print] [--force] [--no-avoid]
  piece:generate --regenerate <id> [--force]
  piece:generate --list

kinds: five-finger, scale, reading-drill, echo, phrase
```
<!-- /docs:usage -->


| Kind | Makes |
|---|---|
| `five-finger` | An exercise over the five notes of the hand position: runs up and down, skips of a third (from the level that allows them) or each note twice. About 16 beats, a whole note on the tonic at the end. |
| `scale` | A scale up and down the hand's side of middle C within the level range: five notes at levels 1 to 4 of the starter table, an octave at level 5. Long notes on the top and the end. |
| `reading-drill` | A random walk over the hand position for reading practice: it must visit most of the notes, and has quarter rests where the level has rests. 8 bars. |
| `echo` | A bar to play and its echo (the same rhythm, a step or two away). With `--hand both` (levels with two hands) the right hand calls and the left hand answers the same notes an octave lower, the waiting hand resting a whole bar. |
| `phrase` | A tune of 4 or 8 bars built from one motif: the motif, the motif varied, a contrasting bar, a cadence. Eight bars are a question that stops away from home and an answer that comes home. `--motif` gives the first bar as degrees of the hand position (`0 1 2 1` is C D E D). |

How it stays correct. A generator builds a candidate from seeded random numbers (`src/core/random.ts`) using only the level's data: the hand position, range, note values, largest leap, meters and fingerings. The candidate is written as ABC and run through the same `checkPiece` as `piece:lint`. It is accepted only with **no error and no warning**; otherwise the next candidate is built from the same seed (a stream named by the seed and the attempt number), so the result never depends on luck. Fingers: a note gets the level's hand-position finger only where the fingering search (ft_1_30) takes that finger too, so a scale leaving the position is not fingered into a dead end (which the `fingering-cost` warning would refuse). A test makes every kind at every level, hand and meter of the table for twelve seeds each and checks this.

What it never does. It holds no melody: no tune is stored in the generators, and a candidate is also rejected when any run of eight notes (the steps between the notes and their lengths, so any key or octave) is also in a piece that people wrote in `content/pieces/`. `--no-avoid` switches that off. Pieces a generator made are not in that list, so making a piece again does not collide with itself.

Records and regeneration. The meta file keeps `generator: { kind, seed, params }`, enough to make the piece again. `npm run piece:generate -- --regenerate <id>` says whether the files are identical to what the generator makes now (exit code 1 if not) and `--force` replaces them, which makes the piece a draft again. The result depends on the other hand-written pieces through the avoid list, so adding a tune can change what regeneration makes; `tests/content/pieces.test.ts` fails when a committed generated piece no longer matches, and that is the moment to decide whether to regenerate or to undo the change.

Limits today. Titles are numbered `Name level.seed` so the menu can tell them apart. Eighth notes appear only at level 5, where the level table allows them (in pairs on a beat, which the staff beams; `allowedBeats` has the switch). One hand at a time (or the echo game's alternating hands), one meter per piece, key of C, no hands together. Like the level table, the pieces are provisional until the curriculum in use is known.
