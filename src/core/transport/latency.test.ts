import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { estimateLatencyOffset, MIN_TAPS_FOR_ESTIMATE } from './latency';

/** Taps that land `offset` ms after each expected beat (synthetic). */
function tapsAt(expected: number[], offset: number): number[] {
  return expected.map((t) => t + offset);
}

const beats = [0, 500, 1000, 1500, 2000, 2500];

describe('estimateLatencyOffset', () => {
  it('returns the offset when every tap is late by the same amount', () => {
    expect(estimateLatencyOffset(tapsAt(beats, 120), beats)).toBe(120);
  });

  it('is the median, so one wild tap does not move it', () => {
    const taps = tapsAt(beats, 80);
    taps[2] = taps[2]! + 900; // a sneeze, or a tap on the wrong beat
    expect(estimateLatencyOffset(taps, beats)).toBe(80);
  });

  it('drops outliers beyond 100 ms from the median before taking the median again', () => {
    const taps = tapsAt(beats, 40);
    taps[0] = taps[0]! - 400;
    taps[5] = taps[5]! + 350;
    expect(estimateLatencyOffset(taps, beats)).toBe(40);
  });

  it('keeps a tap exactly 100 ms from the median', () => {
    const taps = [5, 5, 100, 110, 110, 110].map((d, i) => beats[i]! + d); // median 105: the two early taps are on the edge
    expect(estimateLatencyOffset(taps, beats)).toBe(105); // without them it would be 110
  });

  it('returns null when no tap is within 100 ms of the median (two groups of taps)', () => {
    const fourBeats = [0, 0, 0, 0];
    expect(estimateLatencyOffset([0, 10, 300, 310], fourBeats)).toBeNull();
  });

  it('returns null for non-finite times', () => {
    expect(estimateLatencyOffset([NaN, 10, 20], [0, 0, 0])).toBeNull();
    expect(estimateLatencyOffset([0, 10, 20], [0, Infinity, 0])).toBeNull();
  });

  it('returns null with fewer taps than the minimum', () => {
    expect(MIN_TAPS_FOR_ESTIMATE).toBe(3);
    expect(estimateLatencyOffset(tapsAt(beats.slice(0, 2), 50), beats.slice(0, 2))).toBeNull();
  });

  it('returns null when the two lists differ in length', () => {
    expect(estimateLatencyOffset(tapsAt(beats, 50).slice(1), beats)).toBeNull();
  });

  it('shifts by exactly k when all taps move by k (property)', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: -150, max: 300 }),
        fc.integer({ min: -100, max: 100 }),
        (offset, shift) => {
          const a = estimateLatencyOffset(tapsAt(beats, offset), beats);
          const b = estimateLatencyOffset(tapsAt(beats, offset + shift), beats);
          expect(a).toBe(offset);
          expect(b).toBe(offset + shift);
        },
      ),
    );
  });

  it('does not depend on the order of the taps (property)', () => {
    fc.assert(
      fc.property(fc.array(fc.integer({ min: -200, max: 200 }), { minLength: 3, maxLength: 12 }), (diffs) => {
        const expected = diffs.map((_, i) => i * 500);
        const taps = diffs.map((d, i) => expected[i]! + d);
        const reversedTaps = [...taps].reverse();
        const reversedExpected = [...expected].reverse();
        const result = estimateLatencyOffset(taps, expected);
        expect(estimateLatencyOffset(reversedTaps, reversedExpected)).toBe(result);
        expect(result === null || Number.isFinite(result)).toBe(true);
      }),
    );
  });
});
