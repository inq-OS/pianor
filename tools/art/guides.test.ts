import { describe, expect, it } from 'vitest';
import { GUIDES, runUse, withGuides } from './guides';

const picture = (w: number, h: number, palette: number[]) => ({ width: w, height: h, pixels: new Uint8Array(w * h).fill(1), palette });

describe('withGuides', () => {
  it('lays the subject band, the forbidden middle row and the horizon over a copy, in the darkest and lightest colours', () => {
    const p = picture(100, 50, [0x000000, 0x808080, 0x101010, 0xf0f0f0]);
    const out = withGuides(p, 30);
    expect(p.pixels.every((v) => v === 1)).toBe(true); // the picture itself is untouched
    const at = (x: number, y: number): number => out.pixels[y * 100 + x]!;
    const band = Math.round(GUIDES.band[0] * 100);
    const column = Array.from({ length: 50 }, (_, y) => at(band, y));
    expect(new Set(column)).toEqual(new Set([2, 3])); // dotted dark and light
    expect(Array.from({ length: 100 }, (_, x) => at(x, 30)).every((v) => v === 3)).toBe(true); // the horizon solid light
    expect(Array.from({ length: 100 }, (_, x) => at(x, 25)).some((v) => v === 2)).toBe(true); // the middle row
  });

  it('leaves the horizon out when the picture has none', () => {
    const out = withGuides(picture(20, 10, [0, 0x808080, 0x101010, 0xf0f0f0]));
    // only the two band columns cross row 3
    expect(Array.from({ length: 20 }, (_, x) => out.pixels[3 * 20 + x]).filter((v) => v !== 1)).toHaveLength(2);
  });
});

describe('runUse', () => {
  it('counts how many colours of each run the picture uses', () => {
    const p = { width: 4, height: 1, pixels: Uint8Array.from([5, 5, 7, 9]) };
    expect(runUse(p, { grass: [5, 6, 7], sea: [8, 9] })).toEqual([{ name: 'grass', used: 2, of: 3 }, { name: 'sea', used: 1, of: 2 }]);
  });
});
