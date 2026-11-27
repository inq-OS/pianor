/**
 * Where the hand moves along the keyboard (ft_1_30.AC9): from the fingering of each hand (written fingers kept, the rest
 * from `bestFingering`), the white key the thumb lies over. The hand covers five white keys from there (up for the right
 * hand, down for the left), so a broken chord or a stretch inside them is not a move. It moves when the thumb plays
 * another key, or a note falls outside those five keys (the hand goes to where that note's finger lies on its own white
 * key): up the keyboard (to the right) or down (to the left), by that many white keys. The staff shows it as a small
 * arrow. Pure.
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

/** The white keys a hand covers from its thumb, the thumb's own included less one. */
const SPAN = 4;

/**
 * Where the thumb lies after a slice with these fingers on these white keys (`keys`, in the slice's order), the hand
 * before having its thumb at `thumb` (null: not placed yet): kept while the thumb plays there or not at all and every key
 * is within the hand's five; else where the thumb plays, or where the first key outside puts it.
 */
function handPlace(hand: 'RH' | 'LH', thumb: number | null, keys: readonly number[], fingers: readonly number[]): number {
  const dir = hand === 'RH' ? 1 : -1;
  const own = (k: number) => keys[k]! - dir * (fingers[k]! - 1);
  const t = fingers.indexOf(1);
  if (t >= 0) return keys[t]!;
  if (thumb === null) return own(0);
  const outside = keys.findIndex((key) => (key - thumb) * dir < 0 || (key - thumb) * dir > SPAN);
  return outside < 0 ? thumb : own(outside);
}

export function handShifts(chart: Chart, level?: Pick<LevelDefinition, 'fingerings'>): HandShift[] {
  const out: HandShift[] = [];
  for (const { hand, notes, sliced } of chartHands(chart, level)) {
    const best = bestFingering(hand, sliced.slices);
    // the chart notes of each slice, lowest key first
    const slotted: number[][] = sliced.slices.map(() => []);
    sliced.places.forEach((p, k) => (slotted[p.slice]![p.key] = notes[k]!));
    let thumb: number | null = null;
    best.fingers.forEach((fingers, s) => {
      if (fingers === null) {
        thumb = null;
        return;
      }
      const note = slotted[s]![0]!;
      const keys = slotted[s]!.map((n) => diatonicIndex(chart.notes[n]!.spelling));
      const here = handPlace(hand, thumb, keys, fingers);
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
