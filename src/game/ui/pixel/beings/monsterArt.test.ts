import { describe, expect, it } from 'vitest';
import { inkCount, type Bitmap } from '../bitmap';
import { C } from '../palette';
import { MONSTER_BLINK_FRAMES, MONSTER_FRAMES } from './monsterArt';

const at = (b: Bitmap, x: number, y: number) => (x < 0 || y < 0 || x >= b.width || y >= b.height ? 0 : b.pixels[y * b.width + x]!);
const same = (a: Bitmap, b: Bitmap) => a.width === b.width && a.height === b.height && a.pixels.every((p, i) => p === b.pixels[i]);
const countOf = (b: Bitmap, colour: number) => [...b.pixels].filter((p) => p === colour).length;
/** The picture moved down by `dy` rows (the rows above are clear). */
const shifted = (b: Bitmap, dy: number): Bitmap => {
  const out = { width: b.width, height: b.height, pixels: new Uint8Array(b.pixels.length) };
  for (let y = 0; y + dy < b.height; y++) for (let x = 0; x < b.width; x++) out.pixels[(y + dy) * b.width + x] = b.pixels[y * b.width + x]!;
  return out;
};

/** Outline style A (docs/sprites.md 3.7): every drawn pixel that touches the clear outside (or the edge) is `ink`. */
function outlineGaps(b: Bitmap): string[] {
  const gaps: string[] = [];
  for (let y = 0; y < b.height; y++) {
    for (let x = 0; x < b.width; x++) {
      const p = at(b, x, y);
      if (p === 0 || p === C.ink) continue;
      if ([[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => at(b, x + dx!, y + dy!) === 0)) gaps.push(`${x},${y}`);
    }
  }
  return gaps;
}

describe('the monster', () => {
  it('is 22 wide and 24 tall, open and blinking', () => {
    for (const frame of [...MONSTER_FRAMES, ...MONSTER_BLINK_FRAMES]) expect([frame.width, frame.height]).toEqual([22, 24]);
  });

  it('bobs: frame 1 is frame 0 one row lower, with the same pixels', () => {
    expect(MONSTER_FRAMES[0]!.pixels.some((p, i) => p !== MONSTER_FRAMES[1]!.pixels[i])).toBe(true);
    expect(same(shifted(MONSTER_FRAMES[0]!, 1), MONSTER_FRAMES[1]!)).toBe(true);
    expect(inkCount(MONSTER_FRAMES[0]!)).toBe(inkCount(MONSTER_FRAMES[1]!));
  });

  it('blinks: the closed-eye frames have fewer white eye pixels, and bob the same way', () => {
    for (let i = 0; i < 2; i++) {
      expect(countOf(MONSTER_BLINK_FRAMES[i]!, C.white), `blink ${i}`).toBeLessThan(countOf(MONSTER_FRAMES[i]!, C.white));
      expect(countOf(MONSTER_BLINK_FRAMES[i]!, C.white), `blink ${i}`).toBe(0);
    }
    expect(same(shifted(MONSTER_BLINK_FRAMES[0]!, 1), MONSTER_BLINK_FRAMES[1]!)).toBe(true);
  });

  it('is in the purple ramp with a cream horn and an ink outline', () => {
    const colours = new Set(MONSTER_FRAMES[0]!.pixels);
    expect(colours.has(C.purple) && colours.has(C.purpleDark) && colours.has(C.purpleLight)).toBe(true);
    expect(colours.has(C.cream) && colours.has(C.ink)).toBe(true);
    expect(outlineGaps(MONSTER_FRAMES[0]!)).toEqual([]);
  });
});
