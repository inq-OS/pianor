---
id: "au03"
summary: "The compiled chart the game reads (the canonical definition)"
---
# au03: Compiled chart (what the game reads)

Part of [piece authoring](AUTHORING.md).

The shape below is generated from the zod schema in `src/core/chart/schema.ts`, so it cannot drift from what the game accepts (`?` marks an optional field, `>=0` and `>0` are limits):

<!-- docs:schema chart -->
```text
{
  schemaVersion: 2
  id: string
  contentVersion: int>0
  title: string
  titles?: { et?: string }
  level: int>0
  ppq: 480
  tempoMap: [{ tick: int>=0, bpm: number>0 }]
  meterMap: [{ tick: int>=0, num: int>0, den: int>0 }]
  keyMap: [{ tick: int>=0, fifths: int>=-7, mode: "major" | "minor" }]
  tracks: [{ id: string, role: "play" | "accompaniment" | "click", hand: "RH" | "LH" | null, clef: "treble" | "bass" }]
  notes: [{ tick: int>=0, dur: int>0, midi: int>=0, spelling: { step: "C" | "D" | "E" | "F" | "G" | "A" | "B", alter: int>=-2, octave: int>=-1 }, track: string, voice: int>=1, bar: int>=0, finger?: int>=1, tieNext?: boolean, dynamic?: "pp" | "p" | "mp" | "mf" | "f" | "ff", articulation?: string, text?: string }]
  rests?: [{ tick: int>=0, dur: int>0, track: string, voice: int>=1, bar: int>=0 }]
  bars: [{ index: int>=0, startTick: int>=0, endTick: int>=0 }]
  phrases: [{ name: string, startBar: int>=0, endBar: int>=0 }]
  repeats?: [{ startBar: int>=0, endBar: int>=0, endings?: { first: { startBar: int>=0, endBar: int>=0 }, second: { startBar: int>=0, endBar: int>=0 } } }]
  slurs?: [{ track: string, voice: int>=1, startTick: int>=0, endTick: int>=0 }]
  graces?: [{ track: string, voice: int>=1, tick: int>=0, pitch: { midi: int>=0, spelling: { step: "C" | "D" | "E" | "F" | "G" | "A" | "B", alter: int>=-2, octave: int>=-1 } }, slash: boolean }]
  tuplets?: [{ track: string, voice: int>=1, startTick: int>=0, endTick: int>=0, actual: int>=2, normal: int>=1 }]
  range: { low: int>=0, high: int>=0 }
}
```
<!-- /docs:schema -->

Bars, notes and phrases are **0-based** in the chart (`bar`, `startBar`, `endBar`); the meta file's `phrases[].bars` is 1-based and inclusive for humans, and the compiler converts. `rests` are explicit so the renderer does not have to infer them. `octave` is -1 to 9 so every MIDI number has a spelling. Implemented and validated in `src/core/chart/schema.ts`.

`slurs` (optional, core_09.AC26, d120) lists written slurs as `{ track, voice, startTick, endTick }`: legato from the note starting at `startTick` to the note starting at `endTick`, in one track and voice. Both ends must be notes of that voice, the slur spans two or more different onsets, and slurs of one voice do not overlap. `unrollRepeats` copies a slur into each pass of a repeat, and computer playback holds each slurred note to the next note's onset. The file has no `schemaVersion` bump: older charts without `slurs` read unchanged.

`tuplets` (optional, core_09.AC49, [d163](../decisions/notation.md#d163)) lists written tuplets as `{ track, voice, startTick, endTick, actual, normal }`: the notes and rests of one track and voice from the one starting at `startTick` to the one starting at `endTick` (both members) are `actual` in the time of `normal`, so each note's `dur` is its played length, `normal / actual` of its written one (an eighth triplet: 160 ticks, written as an eighth). Both ends must start a note or rest of that voice and tuplets of one voice do not overlap. Only triplets (3:2) are compiled and drawn. `unrollRepeats` copies a tuplet into each pass, and a section keeps the tuplets of its bars. No `schemaVersion` bump: older charts without `tuplets` read unchanged.

The schema deliberately allows more than the MVP renders or judges (accidentals, ties, several tracks, tempo changes). The linter rejects features a level does not allow. Reasons are in `docs/futureproofing.md`.

The core `Chart` type and its zod schema live in `src/core/chart/`; the compiler is `src/core/piece/compile.ts`.
