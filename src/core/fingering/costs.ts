/**
 * What a fingering costs the hand (ft_1_30): the rules of Parncutt, Sloboda, Clarke, Raekallio and Desain (1997, "An
 * ergonomic model of keyboard fingering for melodic fragments", Music Perception 14(4)) with the chord and left-hand
 * readings of Jacobs (2001) and Al Kasimi, Nichols and Raphael (2007), plus a cost for one finger on two keys. A cost is
 * a count of points: 0 is a move the hand does without thinking, a few points a stretch or a thumb passing, tens a move
 * a hand cannot make legato. Pure.
 *
 * Changed from the paper so that the standard fingerings of scales, arpeggios and broken chords win (ft_1_30.AC2): no
 * point for the 4th and 5th fingers (rule 6 made the hand avoid its outer fingers), a crossing measured only by how far
 * the thumb reaches, a cost for every thumb passing (the paper counts moves over three notes), a span cost capped at a leap,
 * one finger to a white key, and wider relaxed spans for 2-3 and 3-4 (a minor third, an augmented second).
 *
 * AX-3 provisional: the point values are the paper's where kept; the extras are first guesses, to be fitted
 * (TODO(builder, R3) in ft_1_30).
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
 * without strain; relaxed: the hand at rest. The relaxed and comfortable maxima of 2-3 and 3-4 are one semitone over the
 * paper's. A crossing with the thumb reads `CROSSINGS` instead of the negative side here.
 */
interface Span { minPrac: number; minComf: number; minRel: number; maxRel: number; maxComf: number; maxPrac: number }
const span = (minPrac: number, minComf: number, minRel: number, maxRel: number, maxComf: number, maxPrac: number): Span => ({ minPrac, minComf, minRel, maxRel, maxComf, maxPrac });
const SPANS: Readonly<Record<string, Span>> = {
  '1-2': span(-5, -3, 1, 5, 8, 10),
  '1-3': span(-4, -2, 3, 7, 10, 12),
  '1-4': span(-3, -1, 5, 9, 12, 14),
  '1-5': span(-1, 1, 7, 10, 13, 15),
  '2-3': span(1, 1, 1, 3, 4, 5),
  '2-4': span(1, 1, 3, 4, 5, 7),
  '2-5': span(2, 2, 5, 6, 8, 10),
  '3-4': span(1, 1, 1, 3, 3, 4),
  '3-5': span(1, 1, 3, 4, 5, 7),
  '4-5': span(1, 1, 1, 2, 3, 5),
};

/** Points per semitone past a practical crossing: a contortion the hand cannot make (not in the paper, which forbids it). */
export const IMPRACTICAL = 10;
/**
 * The most a span between two keys costs: past it the hand lets go and jumps, however far and with whichever fingers, so
 * a far leap does not pull the next notes toward it (not in the paper, which forbids a span past the practical one).
 */
export const LEAP = 10;
/**
 * Every thumb passing under a finger, or a finger over the thumb: the hand moves to a new place. Over the paper's rule 12
 * so that the hand moves as seldom as a teacher's fingering does (not in the paper, which counts moves over three notes).
 */
export const THUMB_PASS = 4;
/** The thumb on a black key, over rule 10's own point: beginners are taught to keep it off them (not in the paper). */
export const THUMB_BLACK = 2;
/**
 * How far the thumb reaches under a finger (or a finger over it), in semitones, practical and comfortable, as a negative
 * span. Wider than the paper's for the 3rd and 4th, so a thumb going under the 3rd for a fourth (the C arpeggio) or under
 * the 4th for a tone (F major) is not worse than a pass under the 2nd. A crossing has no relaxed span.
 */
const CROSSINGS: Readonly<Record<string, { minPrac: number; minComf: number }>> = {
  '1-2': { minPrac: -5, minComf: -3 },
  '1-3': { minPrac: -7, minComf: -5 },
  '1-4': { minPrac: -5, minComf: -1 },
  '1-5': { minPrac: -1, minComf: 1 },
};

/** One finger on two different keys in a row: the hand has to let go and jump (not in the paper). */
export const SAME_FINGER = 10;
/** Another finger on the same key struck again: a pianist's trick to move the hand, confusing for a beginner (not in the paper). */
export const REPEAT_CHANGE = 4;
/** The same finger on two keys when a chord is on either side: the hand moves as a block, so it costs less (not in the paper). */
export const SAME_FINGER_CHORD = 2;
/**
 * Points per white key that two fingers lie apart from their natural place, one finger to a white key (a black key counts
 * as half a white key): 3 then 1 on C and G in the left hand, or 2 then 4 on a step, leave the hand off its five keys.
 * Between two notes in a row that do not cross, and between neighbouring keys of a chord (not in the paper, which reads
 * this over three notes in its position-change rules).
 */
export const POSITION = 0.5;
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
  if (thumb && d < 0) {
    // a crossing: only how far the thumb reaches
    const c = CROSSINGS[`${lowF}-${highF}`]!;
    return (d < c.minComf ? 2 * (c.minComf - d) : 0) + (d < c.minPrac ? IMPRACTICAL * (c.minPrac - d) : 0);
  }
  let points = 0;
  if (d < s.minComf) points += 2 * (s.minComf - d);
  if (d < s.minRel) points += (thumb ? 2 : 1) * (s.minRel - d);
  if (d < s.minPrac) points += IMPRACTICAL * (s.minPrac - d);
  let wide = 0;
  if (d > s.maxComf) wide += 2 * (d - s.maxComf);
  if (d > s.maxRel) wide += (thumb ? 1 : 2) * (d - s.maxRel);
  if (d > s.maxPrac) wide = LEAP;
  points += Math.min(wide, LEAP);
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

/** Rule 12 and `THUMB_PASS`: the thumb passing under a finger, or a finger over the thumb; 1 more on one level, 3 more for the thumb on black. */
function thumbPassRule(hand: FingerHand, fA: Finger, pA: number, fB: Finger, pB: number): number {
  if ((fA === 1) === (fB === 1) || pA === pB) return 0;
  const [thumbP, otherP] = fA === 1 ? [pA, pB] : [pB, pA];
  if (!thumbPass(hand, thumbP, otherP)) return 0;
  const thumbBlack = isBlackKey(thumbP);
  const otherBlack = isBlackKey(otherP);
  return THUMB_PASS + (thumbBlack === otherBlack ? 1 : thumbBlack ? 3 : 0);
}

/** Where a key lies counted in white keys; a black key halfway between its neighbours. */
const WHITE_STEPS = [0, 0.5, 1, 1.5, 2, 3, 3.5, 4, 4.5, 5, 5.5, 6];
const whiteIndex = (p: number): number => Math.floor(p / 12) * 7 + WHITE_STEPS[p % 12]!;

/** `POSITION` for two fingers on two keys, unless they cross (the lower-numbered finger beyond the other). */
function positionCost(hand: FingerHand, fA: Finger, pA: number, fB: Finger, pB: number): number {
  if (fA === fB || pA === pB) return 0;
  const [lowP, highP] = fA < fB ? [pA, pB] : [pB, pA];
  if ((hand === 'RH' ? highP - lowP : lowP - highP) < 0) return 0;
  return POSITION * Math.abs(Math.abs(whiteIndex(pB) - whiteIndex(pA)) - Math.abs(fA - fB));
}

/** Rules 8 to 12 for one finger moving to the next: three to four, four on black, thumb and five on black, thumb passing. */
function moveRules(hand: FingerHand, fA: Finger, pA: number, fB: Finger, pB: number): number {
  const blackA = isBlackKey(pA);
  const blackB = isBlackKey(pB);
  let points = 0;
  if (fA === 3 && fB === 4) points += 1;
  points += positionCost(hand, fA, pA, fB, pB);
  if ((fA === 3 && fB === 4 && !blackA && blackB) || (fA === 4 && fB === 3 && blackA && !blackB)) points += 1;
  return points + blackKeyRules(fA, blackA, fB, blackB) + thumbPassRule(hand, fA, pA, fB, pB);
}

/** Extra points for the 4th finger in a chord that the 5th does not play too: the least free finger holding a key alone (not in the paper). */
export const CHORD_FOUR = 1;

/**
 * What one placing costs on its own: the spans between every two fingers of a chord, `POSITION` between neighbouring
 * keys, the thumb on a black key (rule 10's own point and `THUMB_BLACK`) and `CHORD_FOUR`.
 */
export function sliceCost(hand: FingerHand, placed: Placed): number {
  let points = placed.fingers.length > 1 && placed.fingers.includes(4) && !placed.fingers.includes(5) ? CHORD_FOUR : 0;
  for (let i = 0; i < placed.fingers.length; i++) {
    const f = placed.fingers[i]!;
    const p = placed.pitches[i]!;
    if (f === 1 && isBlackKey(p)) points += 1 + THUMB_BLACK;
    for (let j = i + 1; j < placed.fingers.length; j++) points += pairCost(hand, f, p, placed.fingers[j]!, placed.pitches[j]!);
    if (i + 1 < placed.fingers.length) points += positionCost(hand, f, p, placed.fingers[i + 1]!, placed.pitches[i + 1]!);
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
