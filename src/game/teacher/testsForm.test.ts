import { describe, expect, it } from 'vitest';
import type { Curriculum } from '../../core/curriculum/curriculum';
import { DEFAULT_DELAY, WEEK_ORDER, orderedTests, orderIn, stepDelay, stepTestTime, toggleWeekday } from './testsForm';

const curriculum: Curriculum = { base: 85, pieces: [{ piece: 'a', deadline: '1998-12-01', priority: 5 }], calendar: [] };

describe("the teacher's test days and times (ft_1_26.AC9)", () => {
  it('ft_1_26.AC9 the week runs Monday to Sunday; a press turns a test day on or off, from the default Sunday and Wednesday', () => {
    expect(WEEK_ORDER).toEqual([1, 2, 3, 4, 5, 6, 0]);
    expect(toggleWeekday(curriculum, 1).testWeekdays).toEqual([0, 1, 3]);
    expect(toggleWeekday(curriculum, 3).testWeekdays).toEqual([0]);
    expect(toggleWeekday(toggleWeekday(curriculum, 3), 0).testWeekdays).toEqual([]);
  });

  it('ft_1_26.AC9 the time of day steps round the clock, from the start of the day', () => {
    expect(stepTestTime(curriculum, 60).testTime).toBe('01:00');
    expect(stepTestTime(curriculum, -10).testTime).toBe('23:50');
    expect(stepTestTime({ ...curriculum, testTime: '17:30' }, 10).testTime).toBe('17:40');
  });

  it('ft_1_26.AC9 a test ordered for hours and minutes from now lands on that day and time, past midnight too', () => {
    expect(DEFAULT_DELAY).toBe(60);
    expect(stepDelay(60, -60)).toBe(0);
    expect(stepDelay(0, -5)).toBe(0);
    expect(stepDelay(23 * 60 + 55, 60)).toBe(23 * 60 + 55);
    const now = new Date(1998, 10, 21, 13, 40, 30);
    expect(orderIn(curriculum, now, 95).calendar).toEqual([{ day: '1998-11-21', kind: 'test', time: '15:15' }]);
    expect(orderIn(curriculum, new Date(1998, 10, 21, 23, 30), 45).calendar).toEqual([{ day: '1998-11-22', kind: 'test', time: '00:15' }]);
  });

  it('ft_1_26.AC9 the ordered tests still to come, soonest first', () => {
    const c: Curriculum = { ...curriculum, calendar: [
      { day: '1998-11-22', kind: 'test', time: '09:00' }, { day: '1998-11-21', kind: 'test', time: '15:00' }, { day: '1998-11-21', kind: 'test', time: '10:00' },
      { day: '1998-11-21', kind: 'lesson' }, { day: '1998-11-25', kind: 'test', piece: 'a' },
    ] };
    expect(orderedTests(c, new Date(1998, 10, 21, 13, 0))).toEqual([{ day: '1998-11-21', time: '15:00' }, { day: '1998-11-22', time: '09:00' }]);
  });
});
