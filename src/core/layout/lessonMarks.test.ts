// Covers ft_1_39.AC3.
import { describe, expect, it } from 'vitest';
import { markSides } from './lessonMarks';

describe('where the step marks of a lesson go (ft_1_39)', () => {
  it('a mark whose label would touch the previous one goes under the staff, so no two labels cross', () => {
    // C D E F: whole, whole, half; each label wider than its bracket
    const sides = markSides([{ from: 10, to: 30, width: 34 }, { from: 30, to: 50, width: 34 }, { from: 50, to: 70, width: 30 }]);
    expect(sides).toEqual(['above', 'below', 'above']);
  });

  it('marks with room between their labels all stay above the staff', () => {
    expect(markSides([{ from: 0, to: 20, width: 20 }, { from: 60, to: 80, width: 20 }])).toEqual(['above', 'above']);
  });

  it('compares a mark with the last label above, not with one put under the staff', () => {
    const sides = markSides([{ from: 0, to: 20, width: 30 }, { from: 20, to: 40, width: 30 }, { from: 40, to: 60, width: 30 }, { from: 60, to: 80, width: 30 }]);
    expect(sides).toEqual(['above', 'below', 'above', 'below']);
  });
});
