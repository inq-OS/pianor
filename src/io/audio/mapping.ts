/** Pure helpers for the sampled piano and metronome. No Web Audio here, so they are easy to test. */

import { MIDI_MAX, MIDI_VELOCITY_MIN, msPerBeat } from '../../core/chart';

const SAMPLED_PITCH_CLASSES = [0, 3, 6, 9] as const; // C, D#, F#, A: one sample every minor third
const FILE_NAMES = ['C', 'Cs', 'D', 'Ds', 'E', 'F', 'Fs', 'G', 'Gs', 'A', 'As', 'B'] as const;

/** MIDI notes that have a sample file: C2 to C6 every minor third, plus C7 (21 files). */
export const SAMPLE_MIDIS: readonly number[] = [
  ...[2, 3, 4, 5, 6].flatMap((octave) => SAMPLED_PITCH_CLASSES.map((pc) => 12 * (octave + 1) + pc)),
  96,
];

/** File name without extension for a sampled MIDI note, e.g. 60 gives "C4" and 63 gives "Ds4". */
export function sampleName(midi: number): string {
  return `${FILE_NAMES[midi % 12]}${Math.floor(midi / 12) - 1}`;
}

/** The sample closest to `midi` (the lower one on a tie), so a note is shifted by at most 1.5 semitones. */
export function nearestSample(midi: number): number {
  return SAMPLE_MIDIS.reduce((best, m) => {
    const d = Math.abs(midi - m);
    const bestD = Math.abs(midi - best);
    return d < bestD || (d === bestD && m < best) ? m : best;
  });
}

/** `AudioBufferSourceNode.playbackRate` that turns a sample at `sampleMidi` into `midi`. */
export function playbackRate(midi: number, sampleMidi: number): number {
  return 2 ** ((midi - sampleMidi) / 12);
}

/** The velocity curve: the softest key still sounds at this gain, and the exponent bends the curve so loud keys are not harsh. */
const VELOCITY_GAIN_FLOOR = 0.05;
const VELOCITY_GAIN_EXPONENT = 1.6;

/**
 * Gain for a MIDI velocity: soft keys are quiet but never silent, loud keys are not harsh.
 * Strictly increasing from velocity 1 to 127, between about 0.05 and 1.
 */
export function velocityToGain(velocity: number): number {
  const v = Math.min(MIDI_MAX, Math.max(MIDI_VELOCITY_MIN, velocity)) / MIDI_MAX;
  return VELOCITY_GAIN_FLOOR + (1 - VELOCITY_GAIN_FLOOR) * v ** VELOCITY_GAIN_EXPONENT;
}

/** Milliseconds between beats at `bpm` (quarter-note beats). */
export function beatIntervalMs(bpm: number): number {
  return msPerBeat(bpm);
}
