import { STEPS, type Step } from './pitch.ts';

/** Sharps in the order a key signature adds them (MusicXML fifths 1..7). */
const SHARP_ORDER: readonly Step[] = ['F', 'C', 'G', 'D', 'A', 'E', 'B'];
/** Flats in the order a key signature adds them (fifths -1..-7). */
const FLAT_ORDER: readonly Step[] = ['B', 'E', 'A', 'D', 'G', 'C', 'F'];

export type Alter = -1 | 0 | 1;

/**
 * Which letters a key signature alters, by the MusicXML `fifths` count (-7 = seven flats, 7 = seven sharps).
 * The mode (major or minor) does not change the signature, so it is not an input.
 * Pure table lookup: docs/notation.md section 5.
 */
export function keyAlters(fifths: number): Record<Step, Alter> {
  if (!Number.isInteger(fifths) || fifths < -7 || fifths > 7) {
    throw new RangeError(`key fifths must be an integer from -7 to 7: ${fifths}`);
  }
  const out = Object.fromEntries(STEPS.map((step) => [step, 0])) as Record<Step, Alter>;
  const n = Math.abs(fifths);
  const order = fifths > 0 ? SHARP_ORDER : FLAT_ORDER;
  const alter: Alter = fifths > 0 ? 1 : -1;
  for (const step of order.slice(0, n)) out[step] = alter;
  return out;
}

/** An entry of a chart's key map: the key from `tick` on (core_09.AC56). */
export interface KeyEntry {
  tick: number;
  fifths: number;
}

/** The entry of `keyMap` in force at `tick`: the last one at or before it (the first when the tick comes before all). */
export function keyAt<T extends KeyEntry>(keyMap: readonly T[], tick: number): T {
  let found = keyMap[0]!;
  for (const entry of keyMap) if (entry.tick <= tick) found = entry;
  return found;
}

/** The letter of a key's tonic, by the MusicXML `fifths` count and the mode: F for one flat major, D for one flat minor. */
export function tonicStep(fifths: number, mode: 'major' | 'minor'): Step {
  const major = (((fifths * 4) % 7) + 7) % 7; // each fifth up is four letters up
  return STEPS[(major + (mode === 'minor' ? 5 : 0)) % 7]!;
}

export interface PrintableNote {
  step: Step;
  octave: number;
  alter: number;
  tick: number;
  /** Bar number; when it changes between consecutive notes the bar line forgets accidentals. Absent: one bar. */
  bar?: number;
  /** The note is tied to the next note of the same pitch: that note carries this accidental across a bar line (core_09.AC11). */
  tieNext?: boolean;
}

/**
 * Which accidental to print for each note of one staff, in time order (docs/notation.md section 4).
 * A number (-2..2, 0 = natural) is printed; null prints nothing because the signature or an earlier
 * accidental on the same pitch (step and octave) in the same bar already gives that alter. The key is one `fifths` for
 * the whole staff, or a key map whose entry at each note's tick gives its signature (core_09.AC56).
 */
export function printedAccidentals(notes: readonly PrintableNote[], keyOrMap: number | readonly KeyEntry[]): (number | null)[] {
  const keyMap = typeof keyOrMap === 'number' ? [{ tick: 0, fifths: keyOrMap }] : keyOrMap;
  const signatures = new Map(keyMap.map((entry) => [entry.fifths, keyAlters(entry.fifths)]));
  let seen = new Map<string, number>();
  /** Pitches whose latest note is tied on: their accidental holds across the bar line into the tied-to note. */
  const tiedOut = new Set<string>();
  let bar: number | undefined;
  return notes.map((note, i) => {
    const key = `${note.step}${note.octave}`;
    if (i > 0 && note.bar !== bar) {
      const carried = new Map<string, number>();
      for (const k of tiedOut) if (seen.has(k)) carried.set(k, seen.get(k)!);
      seen = carried;
    }
    bar = note.bar;
    const current = seen.get(key) ?? signatures.get(keyAt(keyMap, note.tick).fifths)![note.step];
    if (note.tieNext) tiedOut.add(key);
    else tiedOut.delete(key);
    if (note.alter === current) return null;
    seen.set(key, note.alter);
    return note.alter;
  });
}
