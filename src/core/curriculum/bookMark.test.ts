import { describe, expect, it } from 'vitest';
import type { PieceStatus } from './play';
import { curriculumMark } from './bookMark';

const status = (over: Partial<PieceStatus>): PieceStatus => ({
  piece: 'p', plays: 5, level: 60, spread: 0, histogram: [], retained: false, expected: 90, predicted: null, band: null, delta: null, urgency: 0, colour: 'green', ...over,
});

describe('curriculumMark (ft_1_26.AC8)', () => {
  it('ft_1_26.AC8 counts the days to the deadline and how near the level is to the expected one', () => {
    expect(curriculumMark(status({ level: 45 }), '1998-12-01', '1998-11-21')).toEqual({ finished: false, daysLeft: 10, closeness: 0.5 });
  });

  it('a deadline that has passed counts 0 days; no level yet is nothing near', () => {
    expect(curriculumMark(status({ level: null, plays: 1, colour: 'purple' }), '1998-11-01', '1998-11-21')).toEqual({ finished: false, daysLeft: 0, closeness: 0 });
  });

  it('a level over the expected one is as near as can be, never more', () => {
    expect(curriculumMark(status({ level: 99 }), '1998-12-01', '1998-11-21').closeness).toBe(1);
  });

  it('ft_1_26.AC8 a piece retained at its expected level (strong green) is finished, with its medal when it has one', () => {
    expect(curriculumMark(status({ level: 95, retained: true, colour: 'strongGreen', medal: 'gold' }), '1998-12-01', '1998-11-21')).toEqual({ finished: true, medal: 'gold', daysLeft: 10, closeness: 1 });
    expect(curriculumMark(status({ level: 90, retained: true, colour: 'strongGreen' }), '1998-12-01', '1998-11-21')).toEqual({ finished: true, daysLeft: 10, closeness: 1 });
  });
});
