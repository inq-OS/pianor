/**
 * Where the hand moves along the keyboard (ft_1_30.AC9): from the fingering of each hand (written fingers kept, the rest
 * from `bestFingering`), the white key the thumb lies over at each onset. When it changes, the hand has moved: up the
 * keyboard (to the right) or down (to the left), by that many white keys. The staff shows it as a small arrow. Pure.
 */
import { diatonicIndex, type Chart, type LevelDefinition } from '../chart';
import { chartHands } from './chart';
import { bestFingering } from './search';

export interface HandShift {
  /** The chart's index of the note where the hand is in its new place (a chord's lowest key). */
  note: number;
  direction: 'up' | 'down';
  /** How far the thumb moves, in white keys. */
  keys: number;
}

export function handShifts(chart: Chart, level?: Pick<LevelDefinition, 'fingerings'>): HandShift[] {
  const out: HandShift[] = [];
  for (const { hand, notes, sliced } of chartHands(chart, level)) {
    const best = bestFingering(hand, sliced.slices);
    // the chart note at the lowest key of each slice
    const lowest = new Map<number, number>();
    sliced.places.forEach((p, k) => {
      if (p.key === 0) lowest.set(p.slice, notes[k]!);
    });
    let thumb: number | null = null;
    best.fingers.forEach((fingers, s) => {
      if (fingers === null) {
        thumb = null;
        return;
      }
      const note = lowest.get(s)!;
      const key = diatonicIndex(chart.notes[note]!.spelling);
      // the right hand's thumb lies below its other fingers, the left hand's above
      const here = hand === 'RH' ? key - (fingers[0]! - 1) : key + (fingers[0]! - 1);
      if (thumb !== null && here !== thumb) out.push({ note, direction: here > thumb ? 'up' : 'down', keys: Math.abs(here - thumb) });
      thumb = here;
    });
  }
  return out.sort((a, b) => a.note - b.note);
}

/** The shifts by chart note index, as the staff draws them. */
export function handShiftMap(chart: Chart, level?: Pick<LevelDefinition, 'fingerings'>): Map<number, HandShift['direction']> {
  return new Map(handShifts(chart, level).map((s) => [s.note, s.direction]));
}
