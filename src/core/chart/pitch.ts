/** Spelled pitch helpers. Pure: no DOM, no engine. MIDI 60 is middle C (C4). */
import { MIDI_MAX } from './midi.ts';

export const STEPS = ['C', 'D', 'E', 'F', 'G', 'A', 'B'] as const;

/**
 * The keys a piece or level may use: the ones every supported keyboard has (the 61 keys of the EZ-220, C2 to C7; the
 * 88-key YDP-166 has them all). No piece or level may ask for a note outside them.
 */
export const PIECE_LOW = 36;
export const PIECE_HIGH = 96;
export type Step = (typeof STEPS)[number];

/** A spelled pitch. `alter`: -2 double flat .. +2 double sharp. */
export interface Spelling {
  readonly step: Step;
  readonly alter: number;
  readonly octave: number;
}

export type Clef = 'treble' | 'bass';

/** ABC's name for a natural note: C is middle C (C4), c the octave above, commas go down and apostrophes up. */
export function abcPitch(step: Step, octave: number): string {
  if (octave >= 5) return step.toLowerCase() + "'".repeat(octave - 5);
  return step + ','.repeat(4 - octave);
}

/** Semitones above C of each natural note: the one pitch-class table of the project. */
export const STEP_SEMITONES: Readonly<Record<Step, number>> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

/** The pitch class of a MIDI note, 0 (C) to 11 (B); also right for negative numbers. */
export function pitchClass(midi: number): number {
  return ((midi % 12) + 12) % 12;
}

const WHITE_PITCH_CLASSES: ReadonlySet<number> = new Set(Object.values(STEP_SEMITONES));

/** A natural note: a white key on the piano. */
export function isWhiteKey(midi: number): boolean {
  return WHITE_PITCH_CLASSES.has(pitchClass(midi));
}

/** A sharp or flat: a black key on the piano. */
export function isBlackKey(midi: number): boolean {
  return !isWhiteKey(midi);
}

const SHARP_NAMES: readonly Spelling['step'][] = ['C', 'C', 'D', 'D', 'E', 'F', 'F', 'G', 'G', 'A', 'A', 'B'];
const SHARP_ALTER = [0, 1, 0, 1, 0, 0, 1, 0, 1, 0, 1, 0] as const;
const FLAT_NAMES: readonly Spelling['step'][] = ['C', 'D', 'D', 'E', 'E', 'F', 'G', 'G', 'A', 'A', 'B', 'B'];
const FLAT_ALTER = [0, -1, 0, -1, 0, 0, -1, 0, -1, 0, -1, 0] as const;

export function spellingToMidi(s: Spelling): number {
  return 12 * (s.octave + 1) + STEP_SEMITONES[s.step] + s.alter;
}

/** Default spelling for a bare MIDI number. Black keys are sharp unless `flats` is set. */
export function midiToSpelling(midi: number, flats = false): Spelling {
  if (!Number.isInteger(midi) || midi < 0 || midi > MIDI_MAX) {
    throw new RangeError(`MIDI note out of range: ${midi}`);
  }
  const pc = midi % 12;
  const names = flats ? FLAT_NAMES : SHARP_NAMES;
  const alters = flats ? FLAT_ALTER : SHARP_ALTER;
  return { step: names[pc]!, alter: alters[pc]!, octave: Math.floor(midi / 12) - 1 };
}

const ALTER_TEXT: Record<number, string> = { [-2]: 'bb', [-1]: 'b', 0: '', 1: '#', 2: '##' };

/** "C4", "C#4", "Db4". */
export function noteName(s: Spelling): string {
  const accidental = ALTER_TEXT[s.alter];
  if (accidental === undefined) throw new RangeError(`Unsupported alteration: ${s.alter}`);
  return `${s.step}${accidental}${s.octave}`;
}

/** Inverse of `noteName`. Throws on malformed input. */
export function parseNoteName(name: string): Spelling {
  const m = /^([A-G])(##|bb|#|b)?(-?\d)$/.exec(name);
  if (!m) throw new Error(`Invalid note name: ${name}`);
  const accidental = m[2] ?? '';
  const alter = Object.entries(ALTER_TEXT).find(([, text]) => text === accidental)![0];
  return { step: m[1] as Step, alter: Number(alter), octave: Number(m[3]) };
}

/** Diatonic index: C0 = 0, D0 = 1, ... Ignores accidentals. */
export function diatonicIndex(s: Pick<Spelling, 'step' | 'octave'>): number {
  return s.octave * 7 + STEPS.indexOf(s.step);
}

const CLEF_BOTTOM_LINE: Record<Clef, Pick<Spelling, 'step' | 'octave'>> = {
  treble: { step: 'E', octave: 4 },
  bass: { step: 'G', octave: 2 },
};

/**
 * Staff position in diatonic steps from the bottom line: 0 = bottom line, 1 = first space,
 * 2 = second line ... 8 = top line. Negative is below the staff, above 8 is above it.
 * Accidentals do not move a note, so C#4 and C4 share a position but Db4 does not.
 * Middle C is -2 in treble (first ledger line below) and 10 in bass (first ledger line above).
 */
export function staffPosition(s: Spelling, clef: Clef): number {
  return diatonicIndex(s) - diatonicIndex(CLEF_BOTTOM_LINE[clef]);
}

/** The white key at a staff position (the inverse of `staffPosition` for natural notes). */
export function naturalAtPosition(position: number, clef: Clef): { step: Step; octave: number } {
  const index = diatonicIndex(CLEF_BOTTOM_LINE[clef]) + position;
  return { step: STEPS[((index % 7) + 7) % 7]!, octave: Math.floor(index / 7) };
}

/** Staff positions (even numbers outside 0..8) of the ledger lines a note at `position` needs. */
export function ledgerLinePositions(position: number): number[] {
  const lines: number[] = [];
  if (position <= -2) {
    for (let p = -2; p >= position; p -= 2) lines.push(p);
  } else if (position >= 10) {
    for (let p = 10; p <= position; p += 2) lines.push(p);
  }
  return lines;
}
