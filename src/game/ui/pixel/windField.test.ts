import { describe, expect, it } from 'vitest';
import { GUST_SPEED, gustAt, windTime } from './windField';

describe('ft_1_19.AC12 one wind for a whole place (windField.ts)', () => {
  it('its clock never runs backwards, and keeps to the plain time on the whole', () => {
    let was = windTime(0, 100, 1, 1);
    for (let t = 50; t < 600_000; t += 50) {
      const now = windTime(t, 100, 1, 1);
      expect(now).toBeGreaterThan(was);
      was = now;
    }
    // over ten minutes it is never more than a gust's loop or two ahead or behind
    expect(Math.abs(windTime(600_000, 100, 1, 1) - 600_000)).toBeLessThan(5000);
  });

  it('gusts and lulls: the strength wanders over the whole of 0 to 1, and the clock runs fastest in a gust', () => {
    const seen = new Set<number>();
    for (let t = 0; t < 300_000; t += 100) seen.add(Math.round(gustAt(t, 50, 2, 1) * 4));
    expect(seen.size).toBeGreaterThanOrEqual(4);
    let fast = { t: 0, g: -1 }, slow = { t: 0, g: 2 };
    for (let t = 0; t < 60_000; t += 100) {
      const g = gustAt(t, 50, 2, 1);
      if (g > fast.g) fast = { t, g };
      if (g < slow.g) slow = { t, g };
    }
    const pace = (t: number) => windTime(t + 10, 50, 2, 1) - windTime(t - 10, 50, 2, 1);
    expect(pace(fast.t)).toBeGreaterThan(pace(slow.t));
  });

  it('a gust travels the wind\'s way: what one column feels now, a column downwind feels a little later', () => {
    const dx = 120, lag = (dx / GUST_SPEED[1]!) * 1000;
    for (const t of [1000, 7000, 20_000]) {
      expect(gustAt(t + lag, 200 + dx, 1, 1)).toBeCloseTo(gustAt(t, 200, 1, 1), 6);
      expect(gustAt(t + lag, 200 - dx, 1, -1)).toBeCloseTo(gustAt(t, 200, 1, -1), 6);
    }
  });

  it('another day has its own gusts', () => {
    expect(gustAt(5000, 0, 1, 1, 3)).not.toBe(gustAt(5000, 0, 1, 1, 4));
  });
});
