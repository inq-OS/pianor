/**
 * The best fingering of one hand's part (ft_1_30): a minimum-cost path through the fingerings of every onset, found by
 * dynamic programming (Viterbi): for each onset and each way to put fingers on its keys, the cheapest way to get there
 * from the start. Like a trellis decoder: the states are the finger placings of one onset (5 for a single note, at most 10
 * for a chord), the branch metric is `transitionCost` plus `sliceCost`, and the survivor path is the fingering. Linear in
 * the number of onsets. Pure.
 */
import { FINGERS, sliceCost, transitionCost, type Finger, type FingerHand } from './costs';

/** One onset of one hand: the keys struck together, lowest first. Times in ticks. */
export interface FingerSlice {
  pitches: readonly number[];
  start: number;
  /** When the last of its keys is let go. */
  end: number;
  /** The finger the author wrote on each key, if any; kept as written. */
  fixed?: readonly (Finger | undefined)[];
  /** A finger the level's hand position names for each key, if any (`fingerings` in the levels table): preferred. */
  preferred?: readonly (Finger | undefined)[];
  /** The key is tied from the same key in the onset before (not struck again): it keeps that finger. */
  tied?: readonly boolean[];
}

export interface FingeringResult {
  /** The fingers of each slice, one per key; null for a slice no fingering fits (over five keys, or written fingers that clash). */
  fingers: (Finger[] | null)[];
  /** The total cost: the sum of `steps`. */
  cost: number;
  /** What each slice adds: its own cost and the move into it. A measure of where the hand works hardest. */
  steps: number[];
}

/** Points for each key not on the finger the level's hand position names. AX-3 provisional. */
export const POSITION_BIAS = 3;
/** Points for a tied key that changes finger (a silent substitution; the search avoids it). */
export const TIE_CHANGE = 50;

/** Every way to put `k` different fingers on `k` keys in the hand's order (right: low key low finger; left: mirrored). */
function makePlacings(hand: FingerHand, k: number): readonly (readonly Finger[])[] {
  const out: Finger[][] = [];
  const pick = (from: number, chosen: Finger[]) => {
    if (chosen.length === k) {
      out.push(hand === 'RH' ? [...chosen] : [...chosen].reverse());
      return;
    }
    for (let i = from; i < FINGERS.length; i++) pick(i + 1, [...chosen, FINGERS[i]!]);
  };
  pick(0, []);
  return out;
}

/** The placings depend only on the hand and the number of keys, so each is made once (the search asks for them at every onset). */
const placingsMade = new Map<string, readonly (readonly Finger[])[]>();
function placings(hand: FingerHand, k: number): readonly (readonly Finger[])[] {
  const key = `${hand}${k}`;
  let made = placingsMade.get(key);
  if (!made) placingsMade.set(key, (made = makePlacings(hand, k)));
  return made;
}

function statesOf(hand: FingerHand, slice: FingerSlice): readonly (readonly Finger[])[] {
  const k = slice.pitches.length;
  if (k === 0 || k > FINGERS.length) return [];
  const all = placings(hand, k);
  const fixed = slice.fixed;
  if (!fixed || fixed.every((f) => f === undefined)) return all;
  return all.filter((p) => p.every((f, i) => fixed[i] === undefined || fixed[i] === f));
}

/** What a slice with these fingers costs on its own: its fingers, and keys off the hand position's fingers. */
function ownCost(hand: FingerHand, slice: FingerSlice, fingers: readonly Finger[]): number {
  let points = sliceCost(hand, { pitches: slice.pitches, fingers });
  slice.preferred?.forEach((f, i) => {
    if (f !== undefined && f !== fingers[i]) points += POSITION_BIAS;
  });
  return points;
}

/**
 * `points` plus what the move from the slice before into a slice with these fingers costs, a tied key that changes finger
 * included. Added on in this order so the sums are the same floating-point numbers as before the own cost was hoisted.
 */
function withMoveCost(points: number, hand: FingerHand, prev: { slice: FingerSlice; fingers: readonly Finger[] }, slice: FingerSlice, fingers: readonly Finger[]): number {
  points += transitionCost(hand, { pitches: prev.slice.pitches, fingers: prev.fingers }, { pitches: slice.pitches, fingers }, Math.max(0, slice.start - prev.slice.end));
  slice.tied?.forEach((tied, i) => {
    if (!tied) return;
    const from = prev.slice.pitches.indexOf(slice.pitches[i]!);
    if (from >= 0 && prev.fingers[from] !== fingers[i]) points += TIE_CHANGE;
  });
  return points;
}

/** What a slice with these fingers adds after the slice before (null at the start, or after a slice with no fingering). */
function stepCost(hand: FingerHand, prev: { slice: FingerSlice; fingers: readonly Finger[] } | null, slice: FingerSlice, fingers: readonly Finger[]): number {
  const own = ownCost(hand, slice, fingers);
  return prev ? withMoveCost(own, hand, prev, slice, fingers) : own;
}

/**
 * The cheapest fingering of a hand's slices, in time order. Written fingers are kept; a slice nothing fits is left as
 * null and the search starts again after it.
 */
export function bestFingering(hand: FingerHand, slices: readonly FingerSlice[]): FingeringResult {
  const fingers: (Finger[] | null)[] = new Array<Finger[] | null>(slices.length).fill(null);
  const steps: number[] = new Array<number>(slices.length).fill(0);
  let segment: { index: number; states: readonly (readonly Finger[])[]; total: number[]; back: number[]; own: number[] }[] = [];

  const closeSegment = () => {
    if (segment.length === 0) return;
    const last = segment.at(-1)!;
    let s = last.total.indexOf(Math.min(...last.total));
    for (let k = segment.length - 1; k >= 0; k--) {
      const column = segment[k]!;
      fingers[column.index] = [...column.states[s]!]; // a copy: the states are shared between searches
      steps[column.index] = column.own[s]!;
      s = column.back[s]!;
    }
    segment = [];
  };

  slices.forEach((slice, index) => {
    const states = statesOf(hand, slice);
    if (states.length === 0) {
      closeSegment();
      return;
    }
    const before = segment.at(-1);
    const total: number[] = [];
    const back: number[] = [];
    const own: number[] = [];
    for (const state of states) {
      const alone = ownCost(hand, slice, state);
      if (!before) {
        total.push(alone);
        back.push(-1);
        own.push(alone);
        continue;
      }
      let best = Infinity;
      let from = 0;
      let bestOwn = 0;
      before.states.forEach((prevState, p) => {
        const c = withMoveCost(alone, hand, { slice: slices[before.index]!, fingers: prevState }, slice, state);
        if (before.total[p]! + c < best) {
          best = before.total[p]! + c;
          from = p;
          bestOwn = c;
        }
      });
      total.push(best);
      back.push(from);
      own.push(bestOwn);
    }
    segment.push({ index, states, total, back, own });
  });
  closeSegment();
  return { fingers, cost: steps.reduce((a, b) => a + b, 0), steps };
}

/** The cost of a given fingering of the same slices, step by step: null (or a wrong count) breaks the chain like a slice nothing fits. */
export function fingeringCost(hand: FingerHand, slices: readonly FingerSlice[], fingers: readonly (readonly Finger[] | null)[]): Omit<FingeringResult, 'fingers'> {
  const steps: number[] = [];
  let prev: { slice: FingerSlice; fingers: readonly Finger[] } | null = null;
  slices.forEach((slice, i) => {
    const f = fingers[i];
    if (!f || f.length !== slice.pitches.length) {
      steps.push(0);
      prev = null;
      return;
    }
    steps.push(stepCost(hand, prev, slice, f));
    prev = { slice, fingers: f };
  });
  return { cost: steps.reduce((a, b) => a + b, 0), steps };
}
