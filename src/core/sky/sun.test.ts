import { describe, expect, it } from 'vitest';
import { solarElevation } from './sun';
import { KERI } from './skyPhase';

const MINUTE = 60_000;
const ZENITH_REFRACTION = -0.833;

/** The first minute of the UTC day that starts at `dayStart` where the sun's top crosses the horizon, rising or setting. */
function crossing(dayStart: number, rising: boolean): number {
  let previous = solarElevation(dayStart, KERI.latitude, KERI.longitude);
  for (let m = 1; m <= 1440; m++) {
    const t = dayStart + m * MINUTE;
    const now = solarElevation(t, KERI.latitude, KERI.longitude);
    const crosses = rising ? previous < ZENITH_REFRACTION && now >= ZENITH_REFRACTION : previous >= ZENITH_REFRACTION && now < ZENITH_REFRACTION;
    if (crosses) return t;
    previous = now;
  }
  throw new Error('no crossing');
}

const minutesApart = (a: number, b: number): number => Math.abs(a - b) / MINUTE;

describe('solarElevation (ft_1_14.AC1)', () => {
  // Reference times for Keri's lighthouse (59.70 N, 25.02 E) in UTC, by the NOAA low-precision method the code follows.
  it('gives the sunrise and sunset on Keri within 3 minutes of the reference, in winter and in June', () => {
    const cases: [string, number, number][] = [
      ['1998-11-01', Date.UTC(1998, 10, 1, 5, 41), Date.UTC(1998, 10, 1, 14, 26)],
      ['1998-12-21', Date.UTC(1998, 11, 21, 7, 19), Date.UTC(1998, 11, 21, 13, 17)],
      ['1999-06-21', Date.UTC(1999, 5, 21, 1, 0), Date.UTC(1999, 5, 21, 19, 45)],
    ];
    for (const [label, rise, set] of cases) {
      const dayStart = Date.parse(`${label}T00:00:00Z`);
      expect(minutesApart(crossing(dayStart, true), rise), `${label} sunrise`).toBeLessThanOrEqual(3);
      expect(minutesApart(crossing(dayStart, false), set), `${label} sunset`).toBeLessThanOrEqual(3);
    }
  });

  it('is higher at noon than at midnight on the same day', () => {
    const noon = Date.UTC(1998, 10, 1, 10, 30);
    const midnight = Date.UTC(1998, 10, 1, 22, 30);
    expect(solarElevation(noon, KERI.latitude, KERI.longitude)).toBeGreaterThan(solarElevation(midnight, KERI.latitude, KERI.longitude));
  });

  // ft_1_14.AC3
  it('depends only on the instant: the same ms value always gives the same number', () => {
    const t = Date.UTC(1998, 11, 21, 12, 0);
    expect(solarElevation(t, KERI.latitude, KERI.longitude)).toBe(solarElevation(t, KERI.latitude, KERI.longitude));
  });
});
