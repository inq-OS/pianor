/**
 * Fingering on a compiled chart (ft_1_30): each play track with a hand is searched on its own, so the linter can compare a
 * written finger with the best one and the difficulty estimator can read the hand's cost per note. Pure.
 */
import { noteName, type Chart, type LevelDefinition } from '../chart';
import type { Finger, FingerHand } from './costs';
import { bestFingering, type FingerSlice } from './search';
import { handSlices, type HandSlices } from './slices';

export interface ChartHand {
  track: string;
  hand: FingerHand;
  /** The chart's indexes of this track's notes, in the order `places` lists them. */
  notes: number[];
  sliced: HandSlices;
}

const asFinger = (n: number | undefined): Finger | undefined => (n !== undefined && n >= 1 && n <= 5 ? (n as Finger) : undefined);

/** Every play track with a hand, as slices; the level's hand position (if given) is the preferred finger. */
export function chartHands(chart: Chart, level?: Pick<LevelDefinition, 'fingerings'>): ChartHand[] {
  const out: ChartHand[] = [];
  for (const track of chart.tracks) {
    if (track.role !== 'play' || track.hand === null) continue;
    const hand = track.hand;
    const notes = chart.notes.map((n, i) => (n.track === track.id ? i : -1)).filter((i) => i >= 0);
    const table = level?.fingerings[hand];
    const sliced = handSlices(notes.map((i) => {
      const n = chart.notes[i]!;
      return { midi: n.midi, start: n.tick, end: n.tick + n.dur, finger: asFinger(n.finger), tieNext: n.tieNext, preferred: asFinger(table?.[noteName(n.spelling)]) };
    }));
    out.push({ track: track.id, hand, notes, sliced });
  }
  return out;
}

/** A written finger that costs the hand far more than another would, with the fingers the search would take there. */
export interface CostlyFinger {
  /** The chart's index of the note. */
  note: number;
  written: Finger;
  better: Finger;
  /** How many points the written finger costs over the better one, all other written fingers kept. */
  extra: number;
}

/** Points over the best before a written finger is reported. AX-3 provisional: about a thumb passing too many, or a finger on two keys. */
export const COSTLY_FINGER = 8;

const withoutFixed = (slices: readonly FingerSlice[], s: number): FingerSlice[] => slices.map((slice, i) => (i === s ? { ...slice, fixed: [] } : slice));

/**
 * Each written finger whose slice, searched freely with every other written finger kept, comes out `COSTLY_FINGER` or more
 * points cheaper with another finger on that note. A search per fingered slice: fine for a piece, not for a loop per frame.
 */
export function costlyFingers(chart: Chart, level?: Pick<LevelDefinition, 'fingerings'>): CostlyFinger[] {
  const out: CostlyFinger[] = [];
  for (const { hand, notes, sliced } of chartHands(chart, level)) {
    const { slices, places } = sliced;
    const asWritten = bestFingering(hand, slices);
    slices.forEach((slice, s) => {
      if (!slice.fixed?.some((f) => f !== undefined) || asWritten.fingers[s] === null) return;
      const free = bestFingering(hand, withoutFixed(slices, s));
      const extra = asWritten.cost - free.cost;
      if (extra < COSTLY_FINGER) return;
      slice.fixed.forEach((written, key) => {
        const better = free.fingers[s]?.[key];
        if (written === undefined || better === undefined || better === written) return;
        const k = places.findIndex((p) => p.slice === s && p.key === key);
        out.push({ note: notes[k]!, written, better, extra });
      });
    });
  }
  return out.sort((a, b) => a.note - b.note);
}

/**
 * The finger the search takes on one note of a chart with every other written finger kept and this note's left free, or
 * undefined when its slice has no fingering. The linter uses it to tell a thumb turn on a position note from a wrong finger.
 */
export function searchedFingerAt(chart: Chart, note: number, level?: Pick<LevelDefinition, 'fingerings'>): Finger | undefined {
  const hand = chartHands(chart, level).find((h) => h.notes.includes(note));
  if (!hand) return undefined;
  const place = hand.sliced.places[hand.notes.indexOf(note)]!;
  const slices = hand.sliced.slices.map((slice, i) => (i === place.slice ? { ...slice, fixed: (slice.fixed ?? []).map((f, k) => (k === place.key ? undefined : f)) } : slice));
  return bestFingering(hand.hand, slices).fingers[place.slice]?.[place.key];
}
