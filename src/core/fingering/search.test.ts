// Covers ft_1_30.AC1 to AC6 (the minimum-cost fingering search).
import { describe, expect, it } from 'vitest';
import { bestFingering, fingeringCost, type FingerSlice } from './search';
import { pairCost, sliceCost, transitionCost } from './costs';
import { handSlices } from './slices';

const QUARTER = 480;
/** One single-note slice a quarter long per pitch, played legato. */
const line = (pitches: number[], over: Partial<FingerSlice> = {}): FingerSlice[] =>
  pitches.map((p, i) => ({ pitches: [p], start: i * QUARTER, end: (i + 1) * QUARTER, ...over }));
const firsts = (result: ReturnType<typeof bestFingering>) => result.fingers.map((f) => f?.[0]);

describe('the cost of one move (ft_1_30.AC1)', () => {
  it('is free for neighbouring fingers on neighbouring keys, in the hand’s own order', () => {
    expect(pairCost('RH', 1, 60, 2, 62)).toBe(0);
    expect(pairCost('LH', 1, 60, 2, 58)).toBe(0);
  });

  it('grows with every semitone a stretch goes past the comfortable span', () => {
    const third = pairCost('RH', 2, 62, 3, 65);
    const fourth = pairCost('RH', 2, 62, 3, 67);
    expect(fourth).toBeGreaterThan(third);
    expect(pairCost('RH', 1, 60, 5, 79)).toBeGreaterThan(pairCost('RH', 1, 60, 5, 72));
  });

  it('mirrors the left hand: what is natural up for the right hand is natural down for the left', () => {
    expect(pairCost('LH', 1, 64, 3, 60)).toBe(pairCost('RH', 1, 60, 3, 64));
    expect(pairCost('LH', 3, 64, 4, 62)).toBe(pairCost('RH', 3, 60, 4, 62));
  });

  it('charges a crossing of two long fingers far more than a thumb going under', () => {
    const thumbUnder = transitionCost('RH', { pitches: [64], fingers: [3] }, { pitches: [65], fingers: [1] }, 0);
    const fourOverThree = transitionCost('RH', { pitches: [64], fingers: [4] }, { pitches: [65], fingers: [3] }, 0);
    expect(thumbUnder).toBeLessThan(fourOverThree);
  });

  it('charges the same finger on two different keys, and nothing for a repeated key', () => {
    expect(transitionCost('RH', { pitches: [60], fingers: [2] }, { pitches: [62], fingers: [2] }, 0)).toBeGreaterThanOrEqual(10);
    expect(transitionCost('RH', { pitches: [60], fingers: [2] }, { pitches: [60], fingers: [2] }, 0)).toBe(0);
  });

  it('charges the thumb and the little finger on a black key between white keys', () => {
    const thumbBlack = transitionCost('RH', { pitches: [62], fingers: [2] }, { pitches: [61], fingers: [1] }, 0) + sliceCost('RH', { pitches: [61], fingers: [1] });
    const twoBlack = transitionCost('RH', { pitches: [60], fingers: [1] }, { pitches: [61], fingers: [2] }, 0) + sliceCost('RH', { pitches: [61], fingers: [2] });
    expect(thumbBlack).toBeGreaterThan(twoBlack);
    expect(transitionCost('RH', { pitches: [67], fingers: [4] }, { pitches: [68], fingers: [5] }, 0)).toBeGreaterThan(transitionCost('RH', { pitches: [67], fingers: [4] }, { pitches: [69], fingers: [5] }, 0));
  });

  it('eases every move after a rest, when the hand has time to move', () => {
    const legato = transitionCost('RH', { pitches: [60], fingers: [1] }, { pitches: [72], fingers: [2] }, 0);
    const afterRest = transitionCost('RH', { pitches: [60], fingers: [1] }, { pitches: [72], fingers: [2] }, QUARTER);
    expect(afterRest).toBeLessThan(legato);
  });
});

describe('the best fingering of a line (ft_1_30.AC2)', () => {
  it('plays the five-finger position with one finger per key', () => {
    expect(firsts(bestFingering('RH', line([60, 62, 64, 65, 67, 65, 64, 62, 60])))).toEqual([1, 2, 3, 4, 5, 4, 3, 2, 1]);
    expect(firsts(bestFingering('LH', line([48, 50, 52, 53, 55])))).toEqual([5, 4, 3, 2, 1]);
    expect(firsts(bestFingering('RH', line([60, 62, 64, 65, 67, 65, 64, 62])))).toEqual([1, 2, 3, 4, 5, 4, 3, 2]);
  });

  it('passes the thumb under in the C major scale, the way it is taught', () => {
    expect(firsts(bestFingering('RH', line([60, 62, 64, 65, 67, 69, 71, 72])))).toEqual([1, 2, 3, 1, 2, 3, 4, 5]);
    expect(firsts(bestFingering('LH', line([60, 59, 57, 55, 53, 52, 50, 48])))).toEqual([1, 2, 3, 1, 2, 3, 4, 5]);
  });

  it('passes the thumb only where a teacher does, in scales over two octaves and in other keys', () => {
    const c2 = [60, 62, 64, 65, 67, 69, 71, 72, 74, 76, 77, 79, 81, 83, 84];
    expect(firsts(bestFingering('RH', line(c2)))).toEqual([1, 2, 3, 1, 2, 3, 4, 1, 2, 3, 1, 2, 3, 4, 5]);
    // the left hand going up: the teacher's 5 4 3 2 1 3 2 1 4 3 2 1 3 2 1 and 5 4 3 2 1 4 3 2 1 3 2 1 3 2 1 cost the same;
    // either way the hand starts on 5, ends on the thumb and crosses over it three times, the fewest two octaves take
    const left = firsts(bestFingering('LH', line(c2.map((p) => p - 24))));
    expect([left[0], left.at(-1)]).toEqual([5, 1]);
    expect(left.filter((f, i) => i > 0 && left[i - 1] === 1 && f !== 1)).toHaveLength(3);
    expect(firsts(bestFingering('RH', line([65, 67, 69, 70, 72, 74, 76, 77])))).toEqual([1, 2, 3, 4, 1, 2, 3, 4]);
    expect(firsts(bestFingering('RH', line([69, 71, 72, 74, 76, 77, 80, 81])))).toEqual([1, 2, 3, 1, 2, 3, 4, 5]);
  });

  it('starts B flat major off the thumb: 2 1 2 3 1 2 3 4', () => {
    expect(firsts(bestFingering('RH', line([70, 72, 74, 75, 77, 79, 81, 82])))).toEqual([2, 1, 2, 3, 1, 2, 3, 4]);
  });

  it('plays a broken chord from its chord position: the C arpeggio, a broken chord and an Alberti bass', () => {
    const eighths = (pitches: number[]) => pitches.map((p, i) => ({ pitches: [p], start: i * 240, end: (i + 1) * 240 }));
    expect(firsts(bestFingering('RH', eighths([60, 64, 67, 72, 76, 79, 84])))).toEqual([1, 2, 3, 1, 2, 3, 5]);
    expect(firsts(bestFingering('LH', eighths([48, 52, 55, 52])))).toEqual([5, 3, 1, 3]);
    expect(firsts(bestFingering('LH', eighths([48, 55, 52, 55, 48, 55, 52, 55])))).toEqual([5, 1, 3, 1, 5, 1, 3, 1]);
  });

  it('gives each search its own fingers: changing one result leaves the next search as it was', () => {
    const first = bestFingering('RH', line([60, 62, 64]));
    first.fingers[0]![0] = 5;
    first.fingers[1]!.length = 0;
    expect(firsts(bestFingering('RH', line([60, 62, 64])))).toEqual([1, 2, 3]);
  });

  it('never puts one finger on two keys in a row of a stepwise line', () => {
    const fingers = firsts(bestFingering('RH', line([60, 62, 64, 62, 64, 65, 67, 69, 67, 65, 64, 62, 60])));
    for (let i = 1; i < fingers.length; i++) expect(fingers[i]).not.toBe(fingers[i - 1]);
  });

  it('keeps one finger on a key struck again, so a beginner does not change fingers on a repeated note', () => {
    const fingers = firsts(bestFingering('RH', line([65, 65, 64, 64, 62, 62, 60])));
    for (let i = 1; i < fingers.length; i += 2) expect(fingers[i]).toBe(fingers[i - 1]);
  });

  it('keeps the thumb off a black key where another finger can take it', () => {
    const fingers = firsts(bestFingering('RH', line([62, 64, 66, 67, 69])));
    expect(fingers[2]).not.toBe(1);
  });

  it('gives an empty piece an empty answer at no cost', () => {
    expect(bestFingering('RH', [])).toEqual({ fingers: [], cost: 0, steps: [] });
  });
});

describe('fingers the author wrote (ft_1_30.AC3)', () => {
  it('are kept, and the rest of the line is fitted around them', () => {
    const slices = line([60, 62, 64, 65, 67]);
    slices[0] = { ...slices[0]!, fixed: [2] };
    const fingers = firsts(bestFingering('RH', slices));
    expect(fingers[0]).toBe(2);
    for (let i = 1; i < fingers.length; i++) expect(fingers[i]).not.toBe(fingers[i - 1]);
  });

  it('cost at least as much as the free best, never less', () => {
    const free = bestFingering('RH', line([60, 62, 64, 65, 67]));
    const slices = line([60, 62, 64, 65, 67]);
    slices[2] = { ...slices[2]!, fixed: [1] };
    expect(bestFingering('RH', slices).cost).toBeGreaterThan(free.cost);
  });

  it('a slice whose written fingers cannot be played together is left as written and the line goes on', () => {
    const slices: FingerSlice[] = [
      { pitches: [60, 64], start: 0, end: QUARTER, fixed: [3, 3] },
      { pitches: [62], start: QUARTER, end: 2 * QUARTER },
    ];
    const result = bestFingering('RH', slices);
    expect(result.fingers[0]).toBeNull();
    expect(result.fingers[1]).toHaveLength(1);
  });
});

describe('a position the level teaches (ft_1_30.AC4)', () => {
  it('is preferred where it costs little, so a beginner piece keeps the level’s hand position', () => {
    // D E F: free, the search takes 1 2 3; in the level's C position (C4 1 to G4 5) it is 2 3 4
    expect(firsts(bestFingering('RH', line([62, 64, 65])))).toEqual([1, 2, 3]);
    const slices = line([62, 64, 65]).map((s, i) => ({ ...s, preferred: [([2, 3, 4] as const)[i]!] }));
    expect(firsts(bestFingering('RH', slices))).toEqual([2, 3, 4]);
  });
});

describe('chords (ft_1_30.AC5)', () => {
  it('gives every head of a chord its own finger, in the order the hand lies', () => {
    const result = bestFingering('RH', [{ pitches: [60, 64, 67], start: 0, end: QUARTER }]);
    expect(result.fingers[0]).toEqual([1, 3, 5]);
    const left = bestFingering('LH', [{ pitches: [48, 52, 55], start: 0, end: QUARTER }]);
    expect(left.fingers[0]).toEqual([5, 3, 1]);
  });

  it('fingers a chord progression with the hand kept in shape', () => {
    const slices: FingerSlice[] = [[60, 64, 67], [60, 65, 69], [59, 62, 67], [60, 64, 67]].map((pitches, i) => ({ pitches, start: i * QUARTER, end: (i + 1) * QUARTER }));
    const result = bestFingering('RH', slices);
    for (const f of result.fingers) {
      expect(f).not.toBeNull();
      expect([...f!].sort()).toEqual(f);
      expect(new Set(f).size).toBe(3);
    }
    expect(result.fingers[0]).toEqual([1, 3, 5]);
  });

  it('takes a chord in its own shape after a leap, not reaching toward the note before', () => {
    const slices: FingerSlice[] = [
      { pitches: [79], start: 0, end: QUARTER },
      { pitches: [60, 64, 67], start: QUARTER, end: 2 * QUARTER },
      { pitches: [60, 65, 69], start: 2 * QUARTER, end: 3 * QUARTER },
    ];
    expect(bestFingering('RH', slices).fingers.slice(1)).toEqual([[1, 3, 5], [1, 3, 5]]);
    expect(bestFingering('RH', [{ ...slices[0]!, pitches: [84], end: QUARTER / 2 }, ...slices.slice(1)]).fingers[1]).toEqual([1, 3, 5]);
  });

  it('leaves a chord of more than five keys unfingered', () => {
    const result = bestFingering('RH', [{ pitches: [60, 62, 64, 65, 67, 69], start: 0, end: QUARTER }]);
    expect(result.fingers[0]).toBeNull();
  });
});

describe('the cost as a measure (ft_1_30.AC6)', () => {
  it('fingeringCost of the best fingering is the best cost, step by step', () => {
    const slices = line([60, 62, 64, 65, 67, 69, 71, 72]);
    const best = bestFingering('RH', slices);
    const again = fingeringCost('RH', slices, best.fingers.map((f) => f!));
    expect(again.cost).toBeCloseTo(best.cost);
    expect(again.steps).toEqual(best.steps);
    expect(best.steps.reduce((a, b) => a + b, 0)).toBeCloseTo(best.cost);
  });

  it('a wide-leaping line costs more than a stepwise one', () => {
    const steps = bestFingering('RH', line([60, 62, 64, 62, 60, 62, 64, 62]));
    const leaps = bestFingering('RH', line([60, 72, 62, 74, 60, 76, 64, 79]));
    expect(leaps.cost).toBeGreaterThan(steps.cost);
  });
});

describe('notes to slices (ft_1_30.AC5)', () => {
  it('groups notes struck together into one slice, lowest first, and remembers where each went', () => {
    const { slices, places } = handSlices([
      { midi: 67, start: 0, end: 480 }, { midi: 60, start: 0, end: 960 }, { midi: 62, start: 960, end: 1440, finger: 2 },
    ]);
    expect(slices.map((s) => s.pitches)).toEqual([[60, 67], [62]]);
    expect(slices[0]!.end).toBe(960);
    expect(places).toEqual([{ slice: 0, key: 1 }, { slice: 0, key: 0 }, { slice: 1, key: 0 }]);
    expect(slices[1]!.fixed).toEqual([2]);
  });

  it('a tied key keeps the finger it was struck with', () => {
    const { slices } = handSlices([
      { midi: 60, start: 0, end: 480, finger: 1 }, { midi: 64, start: 480, end: 960, tieNext: true, finger: 3 }, { midi: 64, start: 960, end: 1440 }, { midi: 62, start: 1440, end: 1920 },
    ]);
    expect(slices[2]!.tied).toEqual([true]);
    expect(bestFingering('RH', slices).fingers[2]).toEqual([3]);
    const kept = fingeringCost('RH', slices, [[1], [3], [3], [2]]).steps[2]!;
    const changed = fingeringCost('RH', slices, [[1], [3], [4], [2]]).steps[2]!;
    expect(changed - kept).toBeGreaterThanOrEqual(50);
  });
});
