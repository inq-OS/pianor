/**
 * What a fingering costs the hand (ft_1_30): the rules of Parncutt, Sloboda, Clarke, Raekallio and Desain (1997, "An
 * ergonomic model of keyboard fingering for melodic fragments", Music Perception 14(4)) with the chord and left-hand
 * readings of Jacobs (2001) and Al Kasimi, Nichols and Raphael (2007), plus a cost for one finger on two keys. A cost is
 * a count of points: 0 is a move the hand does without thinking, a few points a stretch or a thumb passing, tens a move
 * a hand cannot make legato. Pure.
 *
 * AX-3 provisional: the point values are the paper's; the extras (impractical spans, same finger, rest relief, the
 * level's position) are first guesses, to be fitted (TODO(builder, R3) in ft_1_30).
 */
import { isBlackKey } from '../chart/pitch';
import { PPQ } from '../chart/time';

export type Finger = 1 | 2 | 3 | 4 | 5;
export type FingerHand = 'RH' | 'LH';
export const FINGERS: readonly Finger[] = [1, 2, 3, 4, 5];

/** Keys sounded together by one hand, lowest first, and the finger on each. */
export interface Placed {
  pitches: readonly number[];
  fingers: readonly Finger[];
}

/**
 * Spans between two fingers of the right hand in semitones, lower-numbered finger first (Parncutt et al., table 1). A
 * negative span is a crossing (the second finger goes over or under the first). Practical: the hand can; comfortable:
 * without strain; relaxed: the hand at rest.
 */
interface Span { minPrac: number; minComf: number; minRel: number; maxRel: number; maxComf: number; maxPrac: number }
const span = (minPrac: number, minComf: number, minRel: number, maxRel: number, maxComf: number, maxPrac: number): Span => ({ minPrac, minComf, minRel, maxRel, maxComf, maxPrac });
const SPANS: Readonly<Record<string, Span>> = {
  '1-2': span(-5, -3, 1, 5, 8, 10),
  '1-3': span(-4, -2, 3, 7, 10, 12),
  '1-4': span(-3, -1, 5, 9, 12, 14),
  '1-5': span(-1, 1, 7, 10, 13, 15),
  '2-3': span(1, 1, 1, 2, 3, 5),
  '2-4': span(1, 1, 3, 4, 5, 7),
  '2-5': span(2, 2, 5, 6, 8, 10),
  '3-4': span(1, 1, 1, 2, 2, 4),
  '3-5': span(1, 1, 3, 4, 5, 7),
  '4-5': span(1, 1, 1, 2, 3, 5),
};

/** Points per semitone past a practical span: a move the hand cannot make in place (not in the paper, which forbids it). */
export const IMPRACTICAL = 10;
/** One finger on two different keys in a row: the hand has to let go and jump (not in the paper). */
export const SAME_FINGER = 10;
/** Another finger on the same key struck again: a pianist's trick to move the hand, confusing for a beginner (not in the paper). */
export const REPEAT_CHANGE = 4;
/** The same finger on two keys when a chord is on either side: the hand moves as a block, so it costs less (not in the paper). */
export const SAME_FINGER_CHORD = 2;
/** A step (one or two semitones) between two fingers that are not neighbours, neither the thumb (not in the paper). */
export const SKIPPED_STEP = 1;
/** A move after a rest or a lift at least this long costs `REST_RELIEF` of its points: the hand has time to move. */
export const REST_TICKS = PPQ;
export const REST_RELIEF = 0.5;

/**
 * The span rules for two fingers on two keys (rules 1 to 3: stretch, small span, large span), the same finger on two keys,
 * and the impractical extra. Order does not matter: the pair is read lower finger first.
 */
export function pairCost(hand: FingerHand, fingerA: Finger, pitchA: number, fingerB: Finger, pitchB: number): number {
  if (fingerA === fingerB) return pitchA === pitchB ? 0 : SAME_FINGER;
  if (pitchA === pitchB) return REPEAT_CHANGE;
  const [lowF, lowP, highF, highP] = fingerA < fingerB ? [fingerA, pitchA, fingerB, pitchB] : [fingerB, pitchB, fingerA, pitchA];
  const s = SPANS[`${lowF}-${highF}`]!;
  // the left hand is the right hand mirrored: its higher fingers lie lower on the keyboard
  const d = hand === 'RH' ? highP - lowP : lowP - highP;
  const thumb = lowF === 1;
  let points = 0;
  if (d > s.maxComf) points += 2 * (d - s.maxComf);
  if (d < s.minComf) points += 2 * (s.minComf - d);
  if (d < s.minRel) points += (thumb ? 2 : 1) * (s.minRel - d);
  if (d > s.maxRel) points += (thumb ? 1 : 2) * (d - s.maxRel);
  if (d > s.maxPrac) points += IMPRACTICAL * (d - s.maxPrac);
  if (d < s.minPrac) points += IMPRACTICAL * (s.minPrac - d);
  return points;
}

/** The thumb goes under a finger, or a finger over the thumb: the thumb's key is on the other side of the finger's. */
function thumbPass(hand: FingerHand, thumbPitch: number, otherPitch: number): boolean {
  return hand === 'RH' ? thumbPitch > otherPitch : thumbPitch < otherPitch;
}

/** Rules 10 and 11 for a move: the thumb or the 5th finger going onto a black key from a white one, or off it onto a white one. */
function blackKeyRules(fA: Finger, blackA: boolean, fB: Finger, blackB: boolean): number {
  let points = 0;
  for (const f of [1, 5] as const) {
    if (fB === f && blackB && !blackA) points += 2;
    if (fA === f && blackA && !blackB) points += 2;
  }
  return points;
}

/** Rule 12: the thumb passing under a finger, or a finger over the thumb; 1 point on one level, 3 for the thumb on black. */
function thumbPassRule(hand: FingerHand, fA: Finger, pA: number, fB: Finger, pB: number): number {
  if ((fA === 1) === (fB === 1) || pA === pB) return 0;
  const [thumbP, otherP] = fA === 1 ? [pA, pB] : [pB, pA];
  if (!thumbPass(hand, thumbP, otherP)) return 0;
  const thumbBlack = isBlackKey(thumbP);
  const otherBlack = isBlackKey(otherP);
  return thumbBlack === otherBlack ? 1 : thumbBlack ? 3 : 0;
}

/** Rules 8 to 12 for one finger moving to the next: three to four, four on black, thumb and five on black, thumb passing. */
function moveRules(hand: FingerHand, fA: Finger, pA: number, fB: Finger, pB: number): number {
  const blackA = isBlackKey(pA);
  const blackB = isBlackKey(pB);
  let points = 0;
  if (fA === 3 && fB === 4) points += 1;
  // a step taken by two fingers with one between them, neither the thumb: the hand is off its five keys (not in the paper)
  if (fA !== 1 && fB !== 1 && Math.abs(fA - fB) >= 2 && pA !== pB && Math.abs(pA - pB) <= 2) points += SKIPPED_STEP;
  if ((fA === 3 && fB === 4 && !blackA && blackB) || (fA === 4 && fB === 3 && blackA && !blackB)) points += 1;
  return points + blackKeyRules(fA, blackA, fB, blackB) + thumbPassRule(hand, fA, pA, fB, pB);
}

/** Extra points for the 4th finger in a chord that the 5th does not play too: the least free finger holding a key alone (not in the paper). */
export const CHORD_FOUR = 1;

/**
 * What one placing costs on its own: the spans between every two fingers of a chord, a weak finger (4 or 5, rule 6), the
 * thumb on a black key (rule 10's own point) and `CHORD_FOUR`.
 */
export function sliceCost(hand: FingerHand, placed: Placed): number {
  let points = placed.fingers.length > 1 && placed.fingers.includes(4) && !placed.fingers.includes(5) ? CHORD_FOUR : 0;
  for (let i = 0; i < placed.fingers.length; i++) {
    const f = placed.fingers[i]!;
    const p = placed.pitches[i]!;
    if (f >= 4) points += 1;
    if (f === 1 && isBlackKey(p)) points += 1;
    for (let j = i + 1; j < placed.fingers.length; j++) points += pairCost(hand, f, p, placed.fingers[j]!, placed.pitches[j]!);
  }
  return points;
}

/**
 * What moving from one placing to the next costs: the span and move rules for every finger of the first to every finger of
 * the second, as their mean (so a chord weighs like a note), eased after a rest of `REST_TICKS` or more (`gap` in ticks).
 */
export function transitionCost(hand: FingerHand, from: Placed, to: Placed, gap: number): number {
  let total = 0;
  let pairs = 0;
  const block = from.fingers.length > 1 || to.fingers.length > 1;
  for (let i = 0; i < from.fingers.length; i++) {
    for (let j = 0; j < to.fingers.length; j++) {
      const fA = from.fingers[i]!;
      const pA = from.pitches[i]!;
      const fB = to.fingers[j]!;
      const pB = to.pitches[j]!;
      total += (block && fA === fB && pA !== pB ? SAME_FINGER_CHORD : pairCost(hand, fA, pA, fB, pB)) + moveRules(hand, fA, pA, fB, pB);
      pairs++;
    }
  }
  const mean = pairs === 0 ? 0 : total / pairs;
  return gap >= REST_TICKS ? mean * REST_RELIEF : mean;
}
