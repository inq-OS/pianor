// Covers core_05.AC1, core_08.AC5.
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { COMPLEXITY_STARS, GRADES, complexityOf } from './complexity';

describe('complexityOf (d157)', () => {
  it('core_08.AC5 gives five grades of 20 points, four points a star, a grade top its own', () => {
    expect([0, 1, 4, 10, 20, 21, 40, 41, 59, 80, 81, 100].map(complexityOf)).toEqual([
      { grade: 'beginner', stars: 0 },
      { grade: 'beginner', stars: 0.25 },
      { grade: 'beginner', stars: 1 },
      { grade: 'beginner', stars: 2.5 },
      { grade: 'beginner', stars: 5 },
      { grade: 'intermediate', stars: 0.25 },
      { grade: 'intermediate', stars: 5 },
      { grade: 'advanced', stars: 0.25 },
      { grade: 'advanced', stars: 4.75 },
      { grade: 'expert', stars: 5 },
      { grade: 'master', stars: 0.25 },
      { grade: 'master', stars: 5 },
    ]);
    expect(complexityOf(140)).toEqual({ grade: 'master', stars: 5 });
    expect(complexityOf(-3)).toEqual({ grade: 'beginner', stars: 0 });
  });

  it('core_08.AC5 never puts a harder piece lower: a higher grade, or more stars in the same one (property)', () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 100 }), fc.integer({ min: 0, max: 100 }), (a, b) => {
        const [low, high] = [complexityOf(Math.min(a, b)), complexityOf(Math.max(a, b))];
        const rank = (c: typeof low) => GRADES.indexOf(c.grade) * 100 + c.stars;
        expect(rank(low)).toBeLessThanOrEqual(rank(high));
        expect(low.stars).toBeGreaterThanOrEqual(0);
        expect(high.stars).toBeLessThanOrEqual(COMPLEXITY_STARS);
      }),
    );
  });
});
