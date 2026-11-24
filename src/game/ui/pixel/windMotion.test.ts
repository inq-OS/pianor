import { describe, expect, it } from 'vitest';
import { DRIFT, cloudCourses, cloudX, daySky, fadeWeights, lookMs } from './windMotion';

const DAY = 86_400_000;
const CLOUDS = [
  { x: 40, y: 3, width: 138, height: 60, near: 0.95 },
  { x: 452, y: 26, width: 106, height: 38, near: 0.7 },
  { x: 14, y: 73, width: 59, height: 5, near: 0.1 },
  { x: 236, y: 76, width: 42, height: 4, near: 0.05 },
  { x: 316, y: 52, width: 59, height: 17, near: 0.4 },
  { x: 596, y: 50, width: 33, height: 13, near: 0.4 },
];

describe('the pace of the scenery with the one wind, and the day\'s sky (ft_1_14.AC9, ft_1_19.AC9)', () => {
  it('ft_1_14.AC9 a gust runs through a picture\'s looks faster in more wind, and even a calm day breathes', () => {
    // a calm day had shown no movement on the knoll
    expect(lookMs(0, 8)).toBeGreaterThan(lookMs(1, 8));
    expect(lookMs(0, 8) * 8).toBeLessThanOrEqual(6000);
    expect(DRIFT[0]).toBeGreaterThanOrEqual(0.5);
    expect(lookMs(1, 8)).toBeGreaterThan(lookMs(2, 8));
    expect(lookMs(2, 8)).toBeGreaterThan(lookMs(3, 8));
    for (let w = 1; w < DRIFT.length; w++) expect(DRIFT[w]).toBeGreaterThan(DRIFT[w - 1]!);
  });

  it('ft_1_19.AC9 the day\'s sky is the same all day and differs from day to day; a storm brings every cloud', () => {
    const day = 20_400 * DAY;
    expect(daySky(day + 1000, 1)).toEqual(daySky(day + DAY - 1000, 1));
    const covers = new Set(Array.from({ length: 20 }, (_, d) => daySky((20_400 + d) * DAY, 1).cover.toFixed(2)));
    expect(covers.size).toBeGreaterThan(5);
    expect(daySky(day, 3).cover).toBe(1);
    for (let d = 0; d < 50; d++) for (const w of [0, 1, 2] as const) {
      const { cover } = daySky((20_400 + d) * DAY, w);
      expect(cover).toBeGreaterThanOrEqual(0.45);
      expect(cover).toBeLessThanOrEqual(1);
    }
  });

  it('ft_1_19.AC9 the cover keeps the big clouds and at least as many as asked, and each cloud has its own start, row and pace', () => {
    const courses = cloudCourses(CLOUDS, 640, 2, { seed: 7, cover: 0.5 }, 4);
    const shown = courses.map((c, i) => (c ? i : -1)).filter((i) => i >= 0);
    expect(shown.length).toBe(4);
    expect(shown).toContain(0);
    expect(shown).toContain(1);
    expect(cloudCourses(CLOUDS, 640, 2, { seed: 7, cover: 1 }).every((c) => c !== null)).toBe(true);
    const all = cloudCourses(CLOUDS, 640, 2, { seed: 7, cover: 1 }) as { x: number; y: number; speed: number }[];
    all.forEach((c, i) => {
      // never lower than painted, never above the picture
      expect(c.y).toBeLessThanOrEqual(CLOUDS[i]!.y);
      expect(c.y).toBeGreaterThanOrEqual(0);
      expect(c.x).toBeGreaterThanOrEqual(-CLOUDS[i]!.width);
      expect(c.x).toBeLessThan(640);
    });
    // the near ones go faster than the far ones, and the paces are all different
    expect(all[0]!.speed).toBeGreaterThan(all[3]!.speed);
    expect(new Set(all.map((c) => c.speed.toFixed(3))).size).toBe(CLOUDS.length);
    // another day, other places
    const other = cloudCourses(CLOUDS, 640, 2, { seed: 8, cover: 1 }) as { x: number }[];
    expect(other.map((c) => c.x)).not.toEqual(all.map((c) => c.x));
  });

  it('ft_1_19.AC9 a day\'s clouds start apart, not heaped into one lump, and off a place kept clear (the night\'s moon)', () => {
    // the art review of the knoll: two clouds overlapped into one lump that hid the moon
    const boxes = (courses: ({ x: number; y: number } | null)[]) => courses.flatMap((c, i) => (c ? [{ x: c.x, y: c.y, w: CLOUDS[i]!.width, h: CLOUDS[i]!.height }] : []));
    const meet = (a: { x: number; y: number; w: number; h: number }, b: typeof a) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
    const moon = { x: 380, y: 14, w: 26, h: 24 };
    for (let seed = 0; seed < 40; seed++) {
      const shown = boxes(cloudCourses(CLOUDS, 640, 1, { seed, cover: 0.6 }, 4, [moon]));
      shown.forEach((a, i) => shown.slice(i + 1).forEach((b) => expect(meet(a, b), `seed ${seed}`).toBe(false)));
      shown.forEach((a) => expect(meet(a, moon), `seed ${seed}`).toBe(false));
    }
  });

  it('ft_1_14.AC9 a cloud drifts the wind\'s way, leaves the picture on one side and comes in on the other', () => {
    const course = { x: 100, y: 10, speed: 10 };
    expect(cloudX(course, 50, 640, 0, -1)).toBe(100);
    expect(cloudX(course, 50, 640, 2000, -1)).toBe(80);
    expect(cloudX(course, 50, 640, 2000, 1)).toBe(120);
    // gone off the left edge: back in from the right
    expect(cloudX(course, 50, 640, 16_000, -1)).toBe(100 - 160 + 690);
  });
});

describe('looks that dissolve into each other (the stepped scenery was choppy)', () => {
  it('shows the look alone at the start of its step, half way through both fully where they meet, and the next alone at the end', () => {
    expect([...fadeWeights([0, 1, 2], 0)]).toEqual([[0, 1], [1, 0]]);
    expect([...fadeWeights([0, 1, 2], 0.25)]).toEqual([[0, 1], [1, 0.5]]);
    expect([...fadeWeights([0, 1, 2], 0.5)]).toEqual([[0, 1], [1, 1]]);
    expect([...fadeWeights([0, 1, 2], 0.75)]).toEqual([[0, 0.5], [1, 1]]);
    // the loop goes round: the last look dissolves into the first
    expect([...fadeWeights([0, 1, 2], 2.25)]).toEqual([[2, 1], [0, 0.5]]);
    expect([...fadeWeights([0, 1, 2], 3)]).toEqual([[0, 1], [1, 0]]);
  });

  it('keeps a look that follows itself in the order fully shown', () => {
    expect([...fadeWeights([0, 0, 1], 0.6)]).toEqual([[0, 1]]);
  });

  it('never leaves a moment where no look is fully shown', () => {
    for (let t = 0; t < 12; t += 0.05) expect(Math.max(...fadeWeights([0, 1, 2, 1, 0, 2], t).values())).toBe(1);
  });
});

describe('a cloud on its course', () => {
  it('glides between the art\'s pixels: its place is not rounded', () => {
    const course = { x: 100, y: 0, speed: 1 };
    expect(cloudX(course, 50, 640, 500, 1)).toBe(100.5);
  });
});
