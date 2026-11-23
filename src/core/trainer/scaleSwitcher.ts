/**
 * The scale switcher (ft_1_29 slice C): the student plays scales up and down without stopping, and every bar the key
 * changes: first round the circle of fifths (C, G, D, ...), then at random. Each bar is the eight notes of its key's major
 * scale in eighths, up in one bar and down in the next, so the cursor waits for the next note of the new scale. Judged as
 * slice A's shapes are (`ShapeRound`, Wait mode, three lives). Pure: no DOM, no engine. Never saved.
 */
import type { Chart, ChartNote } from '../chart/schema.ts';
import { spellingToMidi } from '../chart/pitch.ts';
import { PPQ } from '../chart/time.ts';
import { Random } from '../random.ts';
import { handScale, type ShapeHand } from './shapeTrainer.ts';

/** AX-3 provisional: twelve bars, the first six round the circle, the rest at random. Tune after playtests. */
export const SWITCHER_BARS = 12;
export const SWITCHER_CIRCLE = 6;
/** AX-3 provisional: the random keys stay within six sharps or flats; seven-sign keys are left to slice A. */
const MOST_SIGNS = 6;
const BEATS_PER_BAR = 4;
const EIGHTH = PPQ / 2;
const BAR = BEATS_PER_BAR * PPQ;

/** The key of every bar (as fifths): round the circle from C, then seeded at random, never the same key twice in a row. */
function switcherKeys(seed: string): number[] {
  const keys = Array.from({ length: SWITCHER_CIRCLE }, (_, i) => i);
  const random = Random.derive(seed, 'switcher');
  while (keys.length < SWITCHER_BARS) {
    const previous = keys.at(-1)!;
    const next = random.int(-MOST_SIGNS, MOST_SIGNS - 1);
    keys.push(next >= previous ? next + 1 : next);
  }
  return keys;
}

/**
 * The switcher's chart for `seed` and `hand`, and the key of each bar. The staff stays in C major: a key change inside a
 * piece is not drawn yet, so each note carries its own sharp or flat, and the screen names the bar's key.
 */
export function switcherChart(seed: string, hand: ShapeHand): { chart: Chart; keys: number[] } {
  const keys = switcherKeys(seed);
  const track = 'play';
  const notes: ChartNote[] = keys.flatMap((fifths, bar) => {
    const scale = handScale(fifths, 'major', hand);
    const ordered = bar % 2 === 0 ? scale : [...scale].reverse();
    return ordered.map((spelling, k) => ({ tick: bar * BAR + k * EIGHTH, dur: EIGHTH, midi: spellingToMidi(spelling), spelling, track, voice: 1, bar }));
  });
  const midis = notes.map((n) => n.midi);
  const chart: Chart = {
    schemaVersion: 2,
    id: 'scale-switcher',
    contentVersion: 1,
    title: 'Scale switcher',
    level: 1,
    ppq: PPQ,
    tempoMap: [{ tick: 0, bpm: 80 }],
    meterMap: [{ tick: 0, num: BEATS_PER_BAR, den: 4 }],
    keyMap: [{ tick: 0, fifths: 0, mode: 'major' }],
    tracks: [{ id: track, role: 'play', hand, clef: hand === 'RH' ? 'treble' : 'bass' }],
    notes,
    rests: [],
    bars: keys.map((_, index) => ({ index, startTick: index * BAR, endTick: (index + 1) * BAR })),
    phrases: [{ name: 'switcher', startBar: 0, endBar: keys.length - 1 }],
    range: { low: Math.min(...midis), high: Math.max(...midis) },
  };
  return { chart, keys };
}
