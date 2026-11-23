/**
 * The scale of a key as a chart (ft_1_28 rule 7): one octave up from the tonic, spelled with the key's signature, so the
 * staff code draws it as it draws a piece and the circle of fifths can show and play the scale of the key chosen on it.
 * Pure: no DOM, no engine. Never saved.
 */
import type { Chart } from '../chart/schema.ts';
import { spellingToMidi, STEPS, type Spelling } from '../chart/pitch.ts';
import { PPQ } from '../chart/time.ts';
import { abcKey, type KeyMode } from '../editor/key.ts';

/** The letters that carry a sharp in a signature, in the order they come; flats come in the reverse order. */
const SHARP_ORDER = ['F', 'C', 'G', 'D', 'A', 'E', 'B'] as const;
/** One octave up from the tonic: eight notes. */
export const SCALE_NOTES = 8;
/** The tonic's octave: 4, from middle C up, so every scale sits on the treble staff (AX-3 provisional). */
const TONIC_OCTAVE = 4;
const BEATS_PER_BAR = 4;

/** The sign the key signature with `fifths` puts on a letter: 1, -1 or 0. */
export function signatureAlter(fifths: number, step: Spelling['step']): number {
  const place = SHARP_ORDER.indexOf(step);
  if (fifths > 0) return place < fifths ? 1 : 0;
  if (fifths < 0) return SHARP_ORDER.length - 1 - place < -fifths ? -1 : 0;
  return 0;
}

/**
 * The eight notes of the key's scale, tonic to tonic, each letter once with the sign of the signature: the major scale, and
 * the natural minor for a minor key, as it shares the signature of its relative major (AX-3 provisional: the natural minor,
 * because it shows what the signature means; the harmonic and melodic minor come with the scales trainer, ft_1_29).
 */
export function scaleSpellings(fifths: number, mode: KeyMode, tonicOctave = TONIC_OCTAVE): Spelling[] {
  const tonic = abcKey(fifths, mode).replace(/m$/, '');
  const first = STEPS.indexOf(tonic[0] as Spelling['step']);
  return Array.from({ length: SCALE_NOTES }, (_, k) => {
    const step = STEPS[(first + k) % STEPS.length]!;
    return { step, alter: signatureAlter(fifths, step), octave: tonicOctave + Math.floor((first + k) / STEPS.length) };
  });
}

/** The scale as a chart in 4/4: eight quarter notes in two bars, on the treble staff, in the key. */
export function scaleChart(fifths: number, mode: KeyMode): Chart {
  const spellings = scaleSpellings(fifths, mode);
  const midis = spellings.map(spellingToMidi);
  const bars = SCALE_NOTES / BEATS_PER_BAR;
  return {
    schemaVersion: 2,
    id: 'circle-scale',
    contentVersion: 1,
    title: 'Scale',
    level: 1,
    ppq: PPQ,
    tempoMap: [{ tick: 0, bpm: 90 }],
    meterMap: [{ tick: 0, num: BEATS_PER_BAR, den: 4 }],
    keyMap: [{ tick: 0, fifths, mode }],
    tracks: [{ id: 'play', role: 'play', hand: null, clef: 'treble' }],
    notes: spellings.map((spelling, k) => ({ tick: k * PPQ, dur: PPQ, midi: midis[k]!, spelling, track: 'play', voice: 1, bar: Math.floor(k / BEATS_PER_BAR) })),
    rests: [],
    bars: Array.from({ length: bars }, (_, index) => ({ index, startTick: index * BEATS_PER_BAR * PPQ, endTick: (index + 1) * BEATS_PER_BAR * PPQ })),
    phrases: [{ name: 'scale', startBar: 0, endBar: bars - 1 }],
    range: { low: Math.min(...midis), high: Math.max(...midis) },
  };
}
