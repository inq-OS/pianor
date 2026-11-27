/**
 * The chord namer (ft_1_29 slice D): the name of the chord the keys held make, from the chord dictionary of
 * `content/trainer/chords.json` (slice B's qualities), or nothing for a set it does not know. Pure: no DOM, no engine.
 */
import { STEP_SEMITONES, type Spelling, type Step } from '../chart/pitch';
import { noteLabel, type NoteNaming } from '../text/noteName';
import { parseChord, type Chord, type ChordContent } from './chordTrainer';

/** The root a name is written with, by pitch class, when nothing tells it: AX-3 provisional, the spelling most often taught for each. */
const MAJOR_ROOTS = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'] as const;
const MINOR_ROOTS = ['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'G#', 'A', 'Bb', 'B'] as const;
/** A quality whose third is minor (three semitones over the root) takes the minor spelling of its root. */
const isMinor = (intervals: readonly number[]) => intervals.includes(3);
/** The letters in the order of fifths: a key's sharps come on them from the left, its flats from the right. */
const FIFTHS_ORDER: readonly Step[] = ['F', 'C', 'G', 'D', 'A', 'E', 'B'];
const SHARP_SPELLING: readonly [Step, number][] = [['C', 0], ['C', 1], ['D', 0], ['D', 1], ['E', 0], ['F', 0], ['F', 1], ['G', 0], ['G', 1], ['A', 0], ['A', 1], ['B', 0]];
const FLAT_SPELLING: readonly [Step, number][] = [['C', 0], ['D', -1], ['D', 0], ['E', -1], ['E', 0], ['F', 0], ['G', -1], ['G', 0], ['A', -1], ['A', 0], ['B', -1], ['B', 0]];

/** What is known of how the chord is written: its notes' spellings (in the order of the keys) or the key it is in. */
export interface ChordHint {
  /** How each key is written, in the order of `keys` (a staff's or the piece maker's notes). */
  spellings?: readonly Spelling[];
  /** The key signature the chord is played in, as fifths (-7..7): the root is spelled from that key's scale. */
  fifths?: number;
}

const pcOf = (s: Pick<Spelling, 'step' | 'alter'>) => (STEP_SEMITONES[s.step] + s.alter + 12) % 12;

/** A pitch class as the major key with `fifths` writes it: from its scale, else with a sharp on the sharp side and a flat on the flat side. */
function spellInKey(pc: number, fifths: number): [Step, number] | null {
  for (const [i, step] of FIFTHS_ORDER.entries()) {
    const alter = fifths > 0 ? (i < fifths ? 1 : 0) : fifths < 0 ? (i >= 7 + fifths ? -1 : 0) : 0;
    if (pcOf({ step, alter }) === pc) return [step, alter];
  }
  if (fifths === 0) return null;
  return (fifths > 0 ? SHARP_SPELLING : FLAT_SPELLING)[pc]!;
}

/** The root's letter and sign as the chord's notes are written, else as its key writes it; null when neither tells. */
function writtenRoot(root: number, keys: readonly number[], hint: ChordHint | undefined): [Step, number] | null {
  const written = hint?.spellings?.find((s, i) => keys[i] !== undefined && keys[i] % 12 === root && pcOf(s) === root);
  if (written) return Math.abs(written.alter) <= 1 ? [written.step, written.alter] : null;
  return hint?.fifths === undefined ? null : spellInKey(root, hint.fifths);
}

/**
 * The chord `keys` (MIDI keys, any order, any octave, doubled notes allowed) make, or null. Every pitch class of the keys
 * must be the chord's and every one of the chord's must be there. Of the roots that fit, the lowest key's wins, so a
 * symmetric chord (augmented, diminished seventh) is named from its bass and a sixth chord over its root (C6, where Am7 has
 * the same notes over A); else the first that fits, from the bass up. The root is spelled as `hint` tells (the notes as
 * written, else the key), else as it is most often taught.
 */
export function nameChord(content: Pick<ChordContent, 'qualities'>, keys: readonly number[], hint?: ChordHint): Chord | null {
  if (keys.length === 0) return null;
  const pcs = new Set(keys.map((k) => k % 12));
  const bass = Math.min(...keys) % 12;
  const roots = [bass, ...[...pcs].filter((pc) => pc !== bass).sort((a, b) => ((a - bass + 12) % 12) - ((b - bass + 12) % 12))];
  for (const root of roots) {
    for (const quality of content.qualities) {
      const chord = new Set(quality.intervals.map((i) => (root + i) % 12));
      if (chord.size !== pcs.size || ![...pcs].every((pc) => chord.has(pc))) continue;
      const written = writtenRoot(root, keys, hint);
      const letter = written
        ? written[0] + (written[1] < 0 ? 'b' : written[1] > 0 ? '#' : '')
        : (isMinor(quality.intervals) ? MINOR_ROOTS : MAJOR_ROOTS)[root]!;
      return parseChord(content, letter + quality.suffix);
    }
  }
  return null;
}

/**
 * A chord's name as the staff's hint labels write a note (core_09.AC59): the root as a note label (b for a flat, the B or H
 * naming), then the suffix (`Dm`, `Cm7b5`). The trainers' `chordLabel` draws a flat sign in the pixel font instead.
 */
export function staffChordName(chord: Chord, naming: NoteNaming): string {
  return noteLabel(chord.root, naming) + chord.suffix;
}
