import { describe, expect, it } from 'vitest';
import { BREATH_MS, BREATH_OUT, STEAM, ZZZ_BOX, breathAt, steamAt, zzzAt } from './wisps';

const TONES = { light: 1, mid: 2 };
const BOX = { w: 18, h: 26 };

/** The steam's pixels at `t`, as "x,y" places. */
function steam(t: number, seed = 0): string[] {
  const out: string[] = [];
  steamAt(t, BOX, TONES, seed, (x, y, tone) => {
    expect(x).toBeGreaterThanOrEqual(0);
    expect(x).toBeLessThan(BOX.w);
    expect(y).toBeGreaterThanOrEqual(0);
    expect(y).toBeLessThan(BOX.h);
    expect([TONES.light, TONES.mid]).toContain(tone);
    out.push(`${x},${y}`);
  });
  return out;
}

function letters(t: number, seed = 0): { x: number; y: number; tone: number }[] {
  const out: { x: number; y: number; tone: number }[] = [];
  zzzAt(t, TONES, seed, (x, y, tone) => {
    expect(x).toBeGreaterThanOrEqual(0);
    expect(x).toBeLessThan(ZZZ_BOX.w);
    expect(y).toBeGreaterThanOrEqual(0);
    expect(y).toBeLessThan(ZZZ_BOX.h);
    out.push({ x, y, tone });
  });
  return out;
}

describe('ft_1_08.AC9 steam and the letters of sleep drawn live (wisps.ts: mugs steam and Kiur sleeps with a ZzZz)', () => {
  it('the steam stays low in its box over the mug, in whole blocks, is short, leaves from the mouth and follows no short loop', () => {
    const seen = new Set<string>();
    let most = 0, low = 0, top = BOX.h;
    for (let t = 0; t < 60_000; t += 66) {
      const now = steam(t);
      most = Math.max(most, now.length);
      if (now.some((p) => Number(p.split(',')[1]) >= BOX.h - 3)) low++;
      for (const p of now) {
        const [x, y] = p.split(',').map(Number) as [number, number];
        top = Math.min(top, y);
        // blocks of two by two, as the room's sprites: never a line one fine pixel thin
        expect(now).toContain(`${x ^ 1},${y}`);
        expect(now).toContain(`${x},${y ^ 1}`);
      }
      seen.add(now.join(' '));
    }
    // a few short wisps, never a cloud
    expect(most).toBeLessThan(STEAM.wisps * 5 * 4 + 1);
    expect(low).toBeGreaterThan(50);
    // gone half way up its box, so it does not wind over what stands behind the mug
    expect(top).toBeGreaterThanOrEqual(Math.floor(BOX.h * (1 - STEAM.reach)) - 2);
    // many moments of their own: no short loop
    expect(seen.size).toBeGreaterThan(150);
  });

  it('the same moment gives the same steam; another day another steam', () => {
    expect(steam(12_345, 3)).toEqual(steam(12_345, 3));
    const differ = [1000, 5000, 9000, 13_000].some((t) => steam(t, 1).join() !== steam(t, 2).join());
    expect(differ).toBe(true);
  });

  it('a sleeper\'s breaths go forward and are not all one length', () => {
    let was = breathAt(0).phase;
    const starts: number[] = [];
    let breath = breathAt(0).breath;
    for (let t = 20; t < 200_000; t += 20) {
      const now = breathAt(t);
      expect(now.phase).toBeGreaterThan(was);
      expect(now.part).toBeGreaterThanOrEqual(0);
      expect(now.part).toBeLessThan(1);
      if (now.breath !== breath) { starts.push(t); breath = now.breath; }
      was = now.phase;
    }
    const lengths = starts.slice(1).map((t, i) => t - starts[i]!);
    expect(Math.max(...lengths)).toBeGreaterThan(Math.min(...lengths) * 1.2);
    // about BREATH_MS each on the whole
    const mean = lengths.reduce((a, b) => a + b, 0) / lengths.length;
    expect(Math.abs(mean - BREATH_MS)).toBeLessThan(BREATH_MS * 0.1);
  });

  it('a letter leaves the head with each breath out, floats up, and pales; two at most are in the air', () => {
    // find a breath out, and follow the letter born there
    let t = 0;
    while (!(breathAt(t).part < BREATH_OUT && breathAt(t + 20).part >= BREATH_OUT)) t += 20;
    // the newest letter is the lowest one
    const low = (at: number) => Math.max(...letters(at).map((p) => p.y));
    const born = letters(t + 100);
    expect(born.length).toBeGreaterThan(0);
    expect(born.some((p) => p.tone === TONES.light)).toBe(true);
    expect(Math.max(...born.map((p) => p.y))).toBeGreaterThan(ZZZ_BOX.from.y - 12);
    expect(low(t + 3000)).toBeLessThan(low(t + 100) - 8);
    for (let at = 0; at < 60_000; at += 100) {
      // a small letter is 8 blocks of 4 pixels, a big one 11: two letters at most
      expect(letters(at).length).toBeLessThanOrEqual(2 * 11 * 4);
    }
    expect(letters(4321, 5)).toEqual(letters(4321, 5));
  });
});
