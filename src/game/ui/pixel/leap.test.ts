import { describe, expect, it } from 'vitest';
import { LEAP, leapAt, leapOf } from './leap';

const BOX = { w: 340, h: 36 };
const TONES = { back: 1, belly: 2, ring: 3, foam: 4 };

function drawn(t: number, seed = 0): { x: number; y: number; tone: number }[] {
  const out: { x: number; y: number; tone: number }[] = [];
  leapAt(t, BOX, TONES, seed, (x, y, tone) => {
    expect(x).toBeGreaterThanOrEqual(0);
    expect(x).toBeLessThan(BOX.w);
    expect(y).toBeGreaterThanOrEqual(0);
    expect(y).toBeLessThan(BOX.h);
    out.push({ x, y, tone });
  });
  return out;
}

describe('ft_1_19.AC13 a fish jumps now and then and leaves a ring (leap.ts: small touches of life)', () => {
  it('some turns a fish jumps and some none; the jumps are at uneven moments and places', () => {
    const jumps = Array.from({ length: 60 }, (_, c) => leapOf(c, BOX, 0));
    const real = jumps.filter((j) => j !== null);
    expect(real.length).toBeGreaterThan(25);
    expect(real.length).toBeLessThan(60);
    expect(new Set(real.map((j) => j.x)).size).toBeGreaterThan(20);
    expect(new Set(real.map((j) => Math.round((j.start % LEAP.everyMs) / 500))).size).toBeGreaterThan(5);
    expect(real.some((j) => j.way === 1) && real.some((j) => j.way === -1)).toBe(true);
  });

  it('the fish goes up and over and comes down, then only the ring is left, spreading and thinning, then nothing', () => {
    let c = 0;
    while (!leapOf(c, BOX, 0)) c++;
    const leap = leapOf(c, BOX, 0)!;
    const fish = (t: number) => drawn(leap.start + t).filter((p) => p.tone === TONES.back);
    const top = (t: number) => Math.min(...fish(t).map((p) => p.y));
    expect(fish(10).length).toBeGreaterThan(0);
    // a silver side longer than its grey back and tail, and foam only where it breaks the water
    const tones = (t: number, tone: number) => drawn(leap.start + t).filter((p) => p.tone === tone).length;
    expect(tones(LEAP.arcMs / 2, TONES.belly)).toBeGreaterThan(tones(LEAP.arcMs / 2, TONES.back));
    expect(tones(10, TONES.foam)).toBeGreaterThan(0);
    // highest in the middle of its arc
    expect(top(LEAP.arcMs / 2)).toBeLessThan(top(30));
    expect(top(LEAP.arcMs / 2)).toBeLessThan(top(LEAP.arcMs - 30));
    // afterwards no fish, a ring that grows
    const after = (t: number) => drawn(leap.start + LEAP.arcMs + t);
    expect(after(300).every((p) => p.tone === TONES.ring)).toBe(true);
    const wide = (t: number) => { const xs = after(t).map((p) => p.x); return Math.max(...xs) - Math.min(...xs); };
    expect(after(300).length).toBeGreaterThan(0);
    // the ring is rows of dashes from early on, never one unbroken stroke as wide as itself
    const row = after(700).filter((p) => p.y === Math.max(...after(700).map((q) => q.y))).map((p) => p.x).sort((a, b) => a - b);
    expect(row.length).toBeLessThan(row[row.length - 1]! - row[0]! + 1);
    expect(wide(1600)).toBeGreaterThan(wide(300));
    expect(drawn(leap.start + LEAP.arcMs + LEAP.ringMs + 50)).toEqual([]);
    expect(drawn(leap.start - 50)).toEqual([]);
    expect(drawn(leap.start + 200, 0)).toEqual(drawn(leap.start + 200, 0));
  });
});
