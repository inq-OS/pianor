/**
 * The chart the ear trainer draws after a question is found (ft_1_10.AC7): one whole note per note of the question, each in its
 * own bar, in the order they were played. Pure: no DOM, no engine. Built from the notes only; never saved.
 */
import type { Chart } from '../chart/schema.ts';
import { midiToSpelling, type Clef } from '../chart/pitch.ts';
import { PPQ } from '../chart/time.ts';

/** Middle C: the clef changes here (MIDI 60), as in the note-name trainer. */
const MIDDLE_C = 60;

/** A chart with one whole note in a bar per note, in 4/4 and C major. The clef follows the first note. */
export function earAnswerChart(notes: readonly number[]): Chart {
  if (notes.length === 0) throw new RangeError('an answer needs at least one note');
  const clef: Clef = notes[0]! < MIDDLE_C ? 'bass' : 'treble';
  const bar = 4 * PPQ;
  return {
    schemaVersion: 2,
    id: 'ear-trainer',
    contentVersion: 1,
    title: 'Ear trainer',
    level: 1,
    ppq: PPQ,
    tempoMap: [{ tick: 0, bpm: 60 }],
    meterMap: [{ tick: 0, num: 4, den: 4 }],
    keyMap: [{ tick: 0, fifths: 0, mode: 'major' }],
    tracks: [{ id: 'play', role: 'play', hand: null, clef }],
    notes: notes.map((midi, i) => ({ tick: i * bar, dur: bar, midi, spelling: midiToSpelling(midi), track: 'play', voice: 1, bar: i })),
    rests: [],
    bars: notes.map((_, i) => ({ index: i, startTick: i * bar, endTick: (i + 1) * bar })),
    phrases: [{ name: 'note', startBar: 0, endBar: notes.length - 1 }],
    range: { low: Math.min(...notes), high: Math.max(...notes) },
  };
}
