import { describe, expect, it } from 'vitest';
import { moonlitFoot } from './moonlit';

describe('moonlitFoot: the near ground at night as a moonlit plane (art-direction rule 9)', () => {
  const run = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
  const w = 40, h = 60;
  const dark = (): Uint8Array => new Uint8Array(w * h).fill(1);

  it('lifts the near rows up their run, more the nearer, and leaves the rows above the plane alone', () => {
    const px = dark();
    moonlitFoot(px, w, [run], { from: 20, full: 40, lift: 0.4 });
    for (let x = 0; x < w; x++) expect(px[10 * w + x]).toBe(1);
    const mid = px[30 * w + 5]!, foot = px[(h - 1) * w + 5]!;
    expect(mid).toBeGreaterThan(1);
    expect(foot).toBeGreaterThanOrEqual(mid);
    expect(foot).toBe(5);
  });

  it('keeps the order of the strokes and lifts no pixel past its cap or out of its run', () => {
    const px = dark();
    for (let x = 0; x < w; x += 2) px[(h - 2) * w + x] = 0;
    for (let x = 0; x < w; x += 3) px[(h - 3) * w + x] = 8;
    moonlitFoot(px, w, [run], { from: 0, full: 10, lift: 0.9, cap: 0.6 });
    expect(Math.max(...px)).toBe(8);
    expect(px[(h - 1) * w]).toBe(6);
    expect(px[(h - 3) * w]).toBe(8);
  });

  it('leaves colours of no run and the pixels it is told to keep', () => {
    const px = dark();
    px[(h - 1) * w] = 200;
    moonlitFoot(px, w, [run], { from: 0, full: 10, lift: 0.5, keep: (i) => i === (h - 1) * w + 1 });
    expect(px[(h - 1) * w]).toBe(200);
    expect(px[(h - 1) * w + 1]).toBe(1);
    expect(px[(h - 1) * w + 2]).toBe(6);
  });
});
