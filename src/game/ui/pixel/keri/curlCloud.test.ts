import { describe, expect, it } from 'vitest';
import type { Bitmap } from '../bitmap';
import { CLOUD_TONES, curlCloud, type CurlSpec } from './curlCloud';

/** A long thin cloud: a streamer that rolls up into a head. */
const LONG: CurlSpec = { length: 120, girth: 15, belly: 0.85, neck: 0.9, taper: 1.1, bend: 7, wave: 1.2, phase: 0.2, rise: 4, head: { size: 16, turns: 1.3 } };
/** A big fat one: a short thick stroke with two more curls on its back. */
const FAT: CurlSpec = { length: 86, girth: 34, belly: 0.8, neck: 0.9, taper: 1.3, bend: 10, wave: 0.7, phase: 0, rise: 10, head: { size: 24, turns: 1.25 }, curls: [{ at: 0.6, size: 21, turns: 1.15 }, { at: 0.25, size: 13, turns: 1.1 }] };
/** A streak: no head, a point at each end. */
const STREAK: CurlSpec = { length: 120, girth: 8, belly: 0.5, neck: 1, taper: 0.6, bend: 3, wave: 1, phase: 0.5 };

const { pale, light, shade, line } = CLOUD_TONES;
const at = (c: Bitmap, x: number, y: number): number => (x < 0 || y < 0 || x >= c.width || y >= c.height ? 0 : c.pixels[y * c.width + x]!);
const drawn = (c: Bitmap): number => c.pixels.filter((p) => p !== 0).length;
/** The drawn rows of each column. */
const columns = (c: Bitmap): number[][] => Array.from({ length: c.width }, (_, x) => Array.from({ length: c.height }, (_, y) => y).filter((y) => at(c, x, y) !== 0));
/** How many clear pixels the sky outside cannot reach: holes in the cloud. */
function holes(c: Bitmap): number {
  const seen = new Uint8Array(c.width * c.height);
  const todo: [number, number][] = [];
  const visit = (x: number, y: number): void => {
    if (x < 0 || y < 0 || x >= c.width || y >= c.height || seen[y * c.width + x] || at(c, x, y) !== 0) return;
    seen[y * c.width + x] = 1;
    todo.push([x, y]);
  };
  for (let x = 0; x < c.width; x++) { visit(x, 0); visit(x, c.height - 1); }
  for (let y = 0; y < c.height; y++) { visit(0, y); visit(c.width - 1, y); }
  for (let next = todo.pop(); next; next = todo.pop()) { const [x, y] = next; visit(x - 1, y); visit(x + 1, y); visit(x, y - 1); visit(x, y + 1); }
  return c.pixels.filter((p, i) => p === 0 && !seen[i]).length;
}
/** Pixels of a curl's line: darker than the lit cloud right above and below them. */
function linePixels(c: Bitmap): number {
  const lit = (t: number): boolean => t === pale || t === light;
  let n = 0;
  for (let y = 1; y < c.height - 1; y++) for (let x = 0; x < c.width; x++) {
    if (at(c, x, y) === shade && lit(at(c, x, y - 1)) && (lit(at(c, x, y + 1)) || lit(at(c, x, y + 2)))) n++;
  }
  return n;
}

describe('the clouds of Keri\'s pictures: one stroke that rolls up into a head (ft_1_18.AC2, ft_1_19.AC9, d111)', () => {
  const long = curlCloud(LONG), fat = curlCloud(FAT), streak = curlCloud(STREAK);

  it('ft_1_19.AC9 a cloud is one stroke: a fine point at its tail, a streamer that fattens, and a round head at its end', () => {
    const tall = columns(long).map((ys) => ys.length);
    expect(Math.max(...tall.slice(0, 6))).toBeLessThanOrEqual(3);
    // it fattens all the way to its neck
    const at4 = [0.25, 0.5, 0.75].map((u) => tall[Math.round(u * LONG.length)]!);
    expect(at4[1]!).toBeGreaterThan(at4[0]!);
    expect(at4[2]!).toBeGreaterThan(at4[1]!);
    expect(at4[2]!).toBeGreaterThanOrEqual(LONG.girth * 0.8);
    // and the head is its tallest part, about as tall as it is wide across the wind
    const head = Math.max(...tall.slice(LONG.length));
    expect(head).toBeGreaterThan(Math.max(...tall.slice(0, LONG.length - 20)));
    expect(head).toBeGreaterThan(LONG.head!.size * 1.3);
    expect(long.width).toBeGreaterThan(long.height * 3);
  });

  it('ft_1_19.AC9 no dark outline and no coil with sky in it: the cloud is solid, in four tones, and its rim is its own light', () => {
    for (const cloud of [long, fat, streak]) {
      expect(holes(cloud)).toBe(0);
      expect([...new Set(cloud.pixels)].every((t) => t === 0 || Object.values(CLOUD_TONES).includes(t as 1))).toBe(true);
    }
    expect([...new Set(fat.pixels)].sort()).toEqual([0, pale, light, shade, line]);
    // lit from above: every column of some height is pale on top and shaded underneath
    for (const cloud of [long, fat, streak]) columns(cloud).forEach((ys, x) => {
      if (ys.length < 4) return;
      expect(at(cloud, x, ys[0]!), `top of column ${x}`).toBe(pale);
      expect([shade, line], `foot of column ${x}`).toContain(at(cloud, x, ys[ys.length - 1]!));
    });
  });

  it('ft_1_19.AC9 the curl is a soft line drawn inside the head; a streak without a head has none', () => {
    expect(linePixels(long)).toBeGreaterThan(8);
    expect(linePixels(streak)).toBe(0);
    // a head that winds further has a longer line
    expect(linePixels(curlCloud({ ...LONG, head: { size: 16, turns: 1.9 } }))).toBeGreaterThan(linePixels(long));
    // the streak is a point at each end and thick between
    const tall = columns(streak).map((ys) => ys.length);
    expect(Math.max(...tall.slice(0, 3), ...tall.slice(-3))).toBeLessThanOrEqual(3);
    expect(Math.max(...tall)).toBeGreaterThanOrEqual(STREAK.girth - 1);
  });

  it('ft_1_19.AC9 a fat cloud is a heap of curls: each curl on its back adds to it and is lit on its own', () => {
    const bare = curlCloud({ ...FAT, curls: [] });
    const one = curlCloud({ ...FAT, curls: FAT.curls!.slice(0, 1) });
    expect(drawn(one)).toBeGreaterThan(drawn(bare) + 100);
    expect(drawn(fat)).toBeGreaterThan(drawn(one) + 40);
    expect(linePixels(fat)).toBeGreaterThan(linePixels(bare));
    // a curl in front has its own pale top inside the heap: pale with cloud above it
    let crests = 0;
    for (let y = 1; y < fat.height; y++) for (let x = 0; x < fat.width; x++) if (at(fat, x, y) === pale && (at(fat, x, y - 1) === shade || at(fat, x, y - 1) === line)) crests++;
    expect(crests).toBeGreaterThan(10);
    // a curl may break forward instead of rolling back, and a head may roll under: other shapes
    const forward = curlCloud({ ...FAT, curls: [{ ...FAT.curls![0]!, forward: true }] });
    expect(forward.pixels.length !== one.pixels.length || forward.pixels.some((p, i) => p !== one.pixels[i])).toBe(true);
    const under = curlCloud({ ...LONG, head: { ...LONG.head!, down: true } });
    const headTop = (c: Bitmap): number => Math.min(...columns(c).slice(LONG.length).flat());
    const tailTop = (c: Bitmap): number => Math.min(...columns(c).slice(LONG.length - 30, LONG.length - 10).flat());
    expect(headTop(long)).toBeLessThan(tailTop(long) - 8);
    expect(headTop(under)).toBeGreaterThanOrEqual(tailTop(under) - 3);
  });

  it('ft_1_19.AC9 clouds are never identical: another spec is another shape; the same spec is the same cloud', () => {
    expect(curlCloud(LONG).pixels).toEqual(long.pixels);
    const sizes = [LONG, FAT, STREAK, { ...LONG, bend: 3 }, { ...LONG, girth: 11 }, { ...LONG, head: { size: 12, turns: 1.5 } }].map((s) => { const c = curlCloud(s); return `${c.width}x${c.height}`; });
    expect(new Set(sizes).size).toBe(sizes.length);
  });

  it('ft_1_14.AC9 the head leads where the wind blows: the same cloud turned round for a wind to the left', () => {
    const turned = curlCloud(LONG, true);
    expect([turned.width, turned.height]).toEqual([long.width, long.height]);
    for (let y = 0; y < long.height; y++) for (let x = 0; x < long.width; x++) expect(at(turned, long.width - 1 - x, y)).toBe(at(long, x, y));
    const tall = (c: Bitmap, from: number, to: number): number => Math.max(...columns(c).slice(from, to).map((ys) => ys.length));
    const third = Math.floor(long.width / 3);
    expect(tall(long, long.width - third, long.width)).toBeGreaterThan(tall(long, 0, third));
    expect(tall(turned, 0, third)).toBeGreaterThan(tall(turned, turned.width - third, turned.width));
  });
});
