import { diatonicIndex, midiToSpelling, type Chart } from '../../src/core/chart/index.ts';

/** A note of a melody: pitch and length in quarter notes. */
export interface MelodyNote {
  midi: number;
  beats: number;
}

/** Notes in a run that make a melody recognisable: eight notes with the same steps and lengths is not an accident. */
export const WINDOW = 8;

const degree = (midi: number) => diatonicIndex(midiToSpelling(midi));

/**
 * Keys for every run of `size` consecutive notes. A key holds the steps of the scale between the notes and their lengths, not
 * the pitches, so the same tune in another key or octave has the same keys.
 */
export function windowKeys(notes: readonly MelodyNote[], size = WINDOW): Set<string> {
  const keys = new Set<string>();
  for (let i = 0; i + size <= notes.length; i++) {
    const run = notes.slice(i, i + size);
    const steps = run.slice(1).map((n, k) => degree(n.midi) - degree(run[k]!.midi));
    keys.add(`${steps.join(',')}|${run.map((n) => n.beats).join(',')}`);
  }
  return keys;
}

/** The melody of each hand the player plays (single notes, in time order). */
export function melodiesOf(chart: Chart): MelodyNote[][] {
  const play = new Set(chart.tracks.filter((t) => t.role === 'play').map((t) => t.id));
  return [...play].map((track) =>
    chart.notes
      .filter((n) => n.track === track)
      .sort((a, b) => a.tick - b.tick || a.midi - b.midi)
      .map((n) => ({ midi: n.midi, beats: n.dur / chart.ppq })),
  );
}

/** Every key of every melody of the charts: what a generated piece must not repeat. */
export function referenceWindows(charts: readonly Chart[], size = WINDOW): Set<string> {
  const all = new Set<string>();
  for (const chart of charts) for (const melody of melodiesOf(chart)) for (const key of windowKeys(melody, size)) all.add(key);
  return all;
}

/** True when some run of `size` notes of `notes` is a run of a known melody. */
export function sharesWindow(notes: readonly MelodyNote[], avoid: ReadonlySet<string>, size = WINDOW): boolean {
  if (avoid.size === 0) return false;
  for (const key of windowKeys(notes, size)) if (avoid.has(key)) return true;
  return false;
}
