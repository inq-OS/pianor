import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { GRADE_STARS, STAR_THRESHOLDS, starsFor, passStarsFor } from './stars';

describe('starsFor', () => {
  it('gives three stars for 95% and up, two for 75% and up, otherwise one', () => {
    expect(STAR_THRESHOLDS).toEqual({ three: 0.95, two: 0.75 });
    expect(starsFor(1)).toBe(3);
    expect(starsFor(STAR_THRESHOLDS.three)).toBe(3);
    expect(starsFor(0.94)).toBe(2);
    expect(starsFor(STAR_THRESHOLDS.two)).toBe(2);
    expect(starsFor(0.74)).toBe(1);
  });

  it('always gives at least one star, even for zero accuracy', () => {
    expect(starsFor(0)).toBe(1);
    expect(starsFor(-1)).toBe(1);
  });

  it('never gives fewer stars for better accuracy (property)', () => {
    fc.assert(
      fc.property(fc.double({ min: 0, max: 1, noNaN: true }), fc.double({ min: 0, max: 1, noNaN: true }), (a, b) => {
        const [low, high] = a <= b ? [a, b] : [b, a];
        expect(starsFor(high)).toBeGreaterThanOrEqual(starsFor(low));
      }),
    );
  });
});

describe('passStarsFor (ft_1_12.AC3)', () => {
  it('grades out of five stars', () => {
    expect(GRADE_STARS).toBe(5);
  });

  it('gives one to five stars at 75, 85, 95 and 100 percent', () => {
    expect([0, 0.74, 0.75, 0.84, 0.85, 0.94, 0.95, 0.99, 1].map(passStarsFor)).toEqual([1, 1, 2, 2, 3, 3, 4, 4, 5]);
  });
});
