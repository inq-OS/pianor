/**
 * The chart the note-name trainer draws (ft_0_17.AC1): one whole note in one bar, so the staff code draws one note the
 * same way it draws a piece. Pure: no DOM, no engine. Built from the target and the step's range; never saved.
 */
import type { Chart } from '../chart/schema.ts';
import { midiToSpelling, type Clef } from '../chart/pitch.ts';
import { PPQ } from '../chart/time.ts';
import type { TrainerRange } from './noteTrainer.ts';

/** Middle C: the staff clef changes here (MIDI 60). */
const MIDDLE_C = 60;

/**
 * The clef of a step (AX-3 provisional: the step decides the clef, and a step that straddles middle C follows the target).
 * Below middle C the bass clef, from it up the treble clef.
 */
export function clefOfRange(range: TrainerRange, target: number): Clef {
  if (range.high < MIDDLE_C) return 'bass';
  if (range.low >= MIDDLE_C) return 'treble';
  return target < MIDDLE_C ? 'bass' : 'treble';
}

/** A chart with one whole note at `target`, in 4/4, C major, with the range of the step. */
export function trainerChart(target: number, range: TrainerRange): Chart {
  const clef = clefOfRange(range, target);
  return {
    schemaVersion: 2,
    id: 'note-trainer',
    contentVersion: 1,
    title: 'Note trainer',
    level: 1,
    ppq: PPQ,
    tempoMap: [{ tick: 0, bpm: 60 }],
    meterMap: [{ tick: 0, num: 4, den: 4 }],
    keyMap: [{ tick: 0, fifths: 0, mode: 'major' }],
    tracks: [{ id: 'play', role: 'play', hand: null, clef }],
    notes: [{ tick: 0, dur: 4 * PPQ, midi: target, spelling: midiToSpelling(target), track: 'play', voice: 1, bar: 0 }],
    rests: [],
    bars: [{ index: 0, startTick: 0, endTick: 4 * PPQ }],
    phrases: [{ name: 'note', startBar: 0, endBar: 0 }],
    range: { low: range.low, high: range.high },
  };
}
