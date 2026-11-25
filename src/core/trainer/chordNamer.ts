/**
 * The chord namer (ft_1_29 slice D): the name of the chord the keys held make, from the chord dictionary of
 * `content/trainer/chords.json` (slice B's qualities), or nothing for a set it does not know. Pure: no DOM, no engine.
 */
import { noteLabel, type NoteNaming } from '../text/noteName';
import { parseChord, type Chord, type ChordContent } from './chordTrainer';

/** The root a name is written with, by pitch class: AX-3 provisional, the spelling most often taught for each. */
const MAJOR_ROOTS = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'] as const;
const MINOR_ROOTS = ['c', 'c#', 'd', 'eb', 'e', 'f', 'f#', 'g', 'g#', 'a', 'bb', 'b'] as const;

/**
 * The chord `keys` (MIDI keys, any order, any octave, doubled notes allowed) make, or null. Every pitch class of the keys
 * must be the chord's and every one of the chord's must be there. Of the roots that fit, the lowest key's wins, so a
 * symmetric chord (augmented, diminished seventh) is named from its bass; else the first that fits, from the bass up.
 */
export function nameChord(content: Pick<ChordContent, 'qualities'>, keys: readonly number[]): Chord | null {
  if (keys.length === 0) return null;
  const pcs = new Set(keys.map((k) => k % 12));
  const bass = Math.min(...keys) % 12;
  const roots = [bass, ...[...pcs].filter((pc) => pc !== bass).sort((a, b) => ((a - bass + 12) % 12) - ((b - bass + 12) % 12))];
  for (const root of roots) {
    for (const quality of content.qualities) {
      const chord = new Set(quality.intervals.map((i) => (root + i) % 12));
      if (chord.size !== pcs.size || ![...pcs].every((pc) => chord.has(pc))) continue;
      const letter = (quality.minor ? MINOR_ROOTS : MAJOR_ROOTS)[root]!;
      return parseChord(content, letter + quality.suffix);
    }
  }
  return null;
}

/**
 * A chord's name as the staff's hint labels write a note (core_09.AC57): the root as a note label (b for a flat, the B or H
 * naming), a small letter for a minor quality, then the suffix. The trainers' `chordLabel` draws a flat sign in the pixel
 * font instead.
 */
export function staffChordName(chord: Chord, naming: NoteNaming): string {
  const root = noteLabel(chord.root, naming);
  return (chord.minor ? root.slice(0, 1).toLowerCase() + root.slice(1) : root) + chord.suffix;
}
