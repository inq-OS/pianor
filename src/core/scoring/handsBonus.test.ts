// Covers ft_0_15.AC4.
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { BOTH_HANDS_MAX_BONUS, bothHandsMultiplier } from './handsBonus';

const stats = (notes: number, together: number) => ({ notes, bothHands: { notes: together, together } });

describe('bothHandsMultiplier', () => {
  it('is 1 when nothing was played with two hands', () => {
    expect(bothHandsMultiplier(stats(11, 0))).toBe(1);
    expect(bothHandsMultiplier(stats(0, 0))).toBe(1);
  });

  it('adds up to 50% when every note was played together first try', () => {
    expect(BOTH_HANDS_MAX_BONUS).toBe(0.5);
    expect(bothHandsMultiplier(stats(10, 10))).toBe(1.5);
    expect(bothHandsMultiplier(stats(10, 5))).toBe(1.25);
  });

  it('is proportional to the share of notes played together', () => {
    expect(bothHandsMultiplier(stats(8, 2))).toBeCloseTo(1.125, 10);
  });

  it('can use another maximum, and never goes below 1 even for odd inputs', () => {
    expect(bothHandsMultiplier(stats(10, 10), 1)).toBe(2);
    expect(bothHandsMultiplier(stats(10, 10), -3)).toBe(1);
    expect(bothHandsMultiplier(stats(10, 99))).toBe(1.5); // more together than notes cannot exceed the maximum
  });

  it('only ever adds: at least 1, at most 1.5, and more together never lowers it (property)', () => {
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 200 }), fc.integer({ min: 0, max: 200 }), fc.integer({ min: 0, max: 200 }), (notes, a, b) => {
        const [low, high] = a <= b ? [a, b] : [b, a];
        const m1 = bothHandsMultiplier(stats(notes, Math.min(low, notes)));
        const m2 = bothHandsMultiplier(stats(notes, Math.min(high, notes)));
        expect(m1).toBeGreaterThanOrEqual(1);
        expect(m2).toBeLessThanOrEqual(1.5);
        expect(m2).toBeGreaterThanOrEqual(m1);
      }),
    );
  });
});
