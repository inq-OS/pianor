import type { Chart } from '../chart/schema.ts';
import { noteLengthOf, type NoteLength } from '../chart/time.ts';
import { isBlackKey } from '../chart/pitch.ts';

/** The note lengths a feature can name. `other` is a length with no plain name (a triplet, say). */
export type NoteValueName = NoteLength | 'other';

/**
 * One derived fact about a piece, as an id the UI maps to a string key (`feature.<id>`). `fastest.<value>` names the
 * shortest note the student plays; the rest are present or absent.
 */
export type FeatureId =
  | 'twoHands'
  | 'handsApart'
  | 'blackKeys'
  | 'rests'
  | `fastest.${NoteValueName}`
  | 'keyChange'
  | 'meterChange'
  | 'oddMeter'
  | 'tempoChange';


/** Meters a beginner meets everywhere. Any other (5/4, 7/8) counts as unconventional. */
const COMMON_METERS = new Set(['2/4', '3/4', '4/4', '2/2', '3/8', '6/8', '9/8', '12/8']);

/** How many entries of a map differ from the one before: 0 means the value never changes. */
function changes<T>(map: readonly T[], same: (a: T, b: T) => boolean): number {
  return map.filter((entry, i) => i > 0 && !same(map[i - 1]!, entry)).length;
}

/**
 * What a piece is, worked out from the chart and nothing else (never typed by hand). Only what the student plays counts
 * (play tracks); accompaniment is ignored. Absent features are left out, so a plain piece has just its fastest note.
 *
 * - `twoHands`: both a right-hand and a left-hand play track have notes.
 * - `handsApart`: two hands, and the lowest right-hand note is above the highest left-hand note, so the hands never
 *   share keys.
 * - `blackKeys`: some note is a black key.
 * - `rests`: a play track has a rest.
 * - `fastest.<value>`: the shortest note value; absent when there are no notes.
 * - `keyChange`, `meterChange`, `tempoChange`: the key, meter or tempo changes inside the piece.
 * - `oddMeter`: a meter outside the common ones (5/4, 7/8). 3/4 is not odd.
 */
export function pieceFeatures(chart: Chart): FeatureId[] {
  const play = new Map(chart.tracks.filter((track) => track.role === 'play').map((track) => [track.id, track]));
  const notes = chart.notes.filter((note) => play.has(note.track));
  const features: FeatureId[] = [];

  const midisOf = (hand: 'RH' | 'LH') => notes.filter((note) => play.get(note.track)!.hand === hand).map((note) => note.midi);
  const right = midisOf('RH');
  const left = midisOf('LH');
  if (right.length > 0 && left.length > 0) {
    features.push('twoHands');
    if (Math.min(...right) > Math.max(...left)) features.push('handsApart');
  }
  if (notes.some((note) => isBlackKey(note.midi))) features.push('blackKeys');
  if (chart.rests.some((rest) => play.has(rest.track))) features.push('rests');
  if (notes.length > 0) {
    const shortest = notes.reduce((least, note) => Math.min(least, note.dur), Infinity);
    features.push(`fastest.${noteLengthOf(shortest) ?? 'other'}`);
  }

  if (changes(chart.keyMap, (a, b) => a.fifths === b.fifths && a.mode === b.mode) > 0) features.push('keyChange');
  if (changes(chart.meterMap, (a, b) => a.num === b.num && a.den === b.den) > 0) features.push('meterChange');
  if (chart.meterMap.some((meter) => !COMMON_METERS.has(`${meter.num}/${meter.den}`))) features.push('oddMeter');
  if (changes(chart.tempoMap, (a, b) => a.bpm === b.bpm) > 0) features.push('tempoChange');
  return features;
}
