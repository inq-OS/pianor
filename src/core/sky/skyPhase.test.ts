import { describe, expect, it } from 'vitest';
import { KERI, skyPhaseAt } from './skyPhase';
import { sceneLook } from './sceneLook';

/** Keri on the fixture's day (the first of November), in UTC as the code computes it: night before 4 h 56 min, dawn to 6 h 17 min, day to 13 h 50 min, dusk to 15 h 11 min (ft_1_14.AC2). */
const at = (utcHour: number, utcMinute = 0): number => Date.UTC(1998, 10, 1, utcHour, utcMinute);

describe('skyPhaseAt (ft_1_14.AC2, AC3)', () => {
  it('is night, dawn, day, dusk, night through 1998-11-01 on Keri', () => {
    expect(skyPhaseAt(at(4, 30), KERI)).toBe('night');
    expect(skyPhaseAt(at(5, 0), KERI)).toBe('dawn');
    expect(skyPhaseAt(at(6, 30), KERI)).toBe('day');
    expect(skyPhaseAt(at(13, 0), KERI)).toBe('day');
    expect(skyPhaseAt(at(14, 0), KERI)).toBe('dusk');
    expect(skyPhaseAt(at(15, 30), KERI)).toBe('night');
  });

  it('gives day in a Keri winter afternoon, when the sun is low (21 December, 12:00 UTC)', () => {
    expect(skyPhaseAt(Date.UTC(1998, 11, 21, 12, 0), KERI)).toBe('day');
  });

  it('is dawn in June at 01:00 UTC on Keri, at sunrise (the sun is not far below the horizon)', () => {
    expect(skyPhaseAt(Date.UTC(1999, 5, 21, 1, 0), KERI)).toBe('dawn');
  });
});

describe('sceneLook (ft_1_14 scope item 3)', () => {
  it('returns the phase and no season, weather or holidays yet', () => {
    expect(sceneLook(at(13, 0), KERI, null, 1)).toEqual({ phase: 'day', season: null, weather: null, wind: 1, holidays: [] });
  });

  it('takes a forced phase instead of the computed one (dev switch ?sky=, AC6)', () => {
    expect(sceneLook(at(13, 0), KERI, 'night').phase).toBe('night');
    expect(sceneLook(at(13, 0), KERI, null).phase).toBe('day');
  });
});
