import { describe, expect, it } from 'vitest';
import type { BarPlay } from './practiceLog';
import { practiceMinutes } from './practiceTime';

const bar = (at: string): BarPlay => ({ at, pieceId: 'p', bar: 0, notes: 4, firstTry: 4, timing: null, mode: 'wait', tempoPercent: 100, section: null, misses: [] });
const dayOf = (iso: string) => iso.slice(0, 10);

describe('practice minutes from the practice log (ft_1_25.AC2)', () => {
  it('counts the time between bars of a session, never a long pause, and today apart', () => {
    const log = { bars: [
      bar('1998-11-17T16:00:00.000Z'), bar('1998-11-17T16:01:00.000Z'), bar('1998-11-17T16:02:30.000Z'),
      bar('1998-11-17T18:00:00.000Z'), // a new session: counts nothing
      bar('1998-11-18T09:00:00.000Z'), bar('1998-11-18T09:02:00.000Z'), bar('1998-11-18T09:04:01.000Z'),
    ] };
    expect(practiceMinutes(log, '1998-11-18', dayOf)).toEqual({ total: 4.5, today: 2 });
  });

  it('is 0 for an empty log or one bar, and sorts the bars by time', () => {
    expect(practiceMinutes({ bars: [] }, '1998-11-18', dayOf)).toEqual({ total: 0, today: 0 });
    expect(practiceMinutes({ bars: [bar('1998-11-18T09:00:00.000Z')] }, '1998-11-18', dayOf)).toEqual({ total: 0, today: 0 });
    expect(practiceMinutes({ bars: [bar('1998-11-18T09:01:00.000Z'), bar('1998-11-18T09:00:00.000Z')] }, '1998-11-18', dayOf).total).toBe(1);
  });
});
