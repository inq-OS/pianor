// Covers ft_0_01.AC3.
import { describe, expect, it } from 'vitest';
import { analyseTaps, clickTimes } from './tapTest';

describe('clickTimes', () => {
  it('spaces the clicks by the beat', () => {
    expect(clickTimes(1000, 100, 4)).toEqual([1000, 1600, 1200 + 1000, 2800]);
    expect(clickTimes(0, 120, 3)).toEqual([0, 500, 1000]);
  });
});

describe('analyseTaps', () => {
  const clicks = clickTimes(1000, 100, 12);

  it('finds the steady offset of taps that come 40 ms after each click', () => {
    const a = analyseTaps(clicks, clicks.map((c) => c + 40));
    expect(a).toMatchObject({ clicks: 12, taps: 12, matched: 10, medianMs: 40, spreadMs: 0, minMs: 40, maxMs: 40 });
  });

  it('skips the first clicks (the player finds the beat) and taps far from any click', () => {
    const taps = [...clicks.map((c, i) => c + (i < 2 ? 250 : 20)), 1000 + 300 * 3]; // a stray tap between two clicks
    const a = analyseTaps(clicks, taps);
    expect(a.matched).toBe(10);
    expect(a.medianMs).toBe(20);
  });

  it('reports early taps as negative offsets and the spread as the median distance from the median', () => {
    const offsets = [-10, 30, 10, 20, 25, 15, 5, 35, 20, 20];
    const a = analyseTaps(clicks, clicks.map((c, i) => c + (i < 2 ? 0 : offsets[i - 2]!)));
    expect(a.offsetsMs).toEqual(offsets);
    expect(a.medianMs).toBe(20);
    expect(a.spreadMs).toBe(7.5);
    expect(a.minMs).toBe(-10);
    expect(a.maxMs).toBe(35);
  });

  it('uses each tap once, the nearest to its click', () => {
    const c = [0, 600, 1200, 1800];
    const a = analyseTaps(c, [1212, 1190, 1805], { warmup: 0 });
    expect(a.offsetsMs).toEqual([-10, 5]);
  });

  it('says nothing when there are no taps or no clicks', () => {
    expect(analyseTaps(clicks, [])).toMatchObject({ matched: 0, medianMs: null, spreadMs: null, minMs: null, maxMs: null });
    expect(analyseTaps([], [1, 2])).toMatchObject({ matched: 0, medianMs: null });
  });
});
