// Covers ft_1_08.AC2, ft_1_08.AC3.
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { flipX, flipY, fromAscii } from './bitmap';
import { C } from './palette';
import { VINE_CORNERS, VINE_TOP_LEFT, vinePlacements } from './vineArt';

const ink = (b: { width: number; pixels: Uint8Array }, x: number, y: number) => b.pixels[y * b.width + x] !== 0;

describe('flipY', () => {
  it('mirrors a picture top to bottom', () => {
    const b = fromAscii(['ab', 'cd', 'ef'], { a: 1, b: 2, c: 3, d: 4, e: 5, f: 6 });
    expect([...flipY(b).pixels]).toEqual([5, 6, 3, 4, 1, 2]);
  });
});

describe('the corner vine (ft_1_08)', () => {
  it('ft_1_08.AC1 uses only the leaf and pink ramps and a gold flower middle', () => {
    const allowed = new Set<number>([0, C.leafDark, C.leaf, C.leafLight, C.pinkDark, C.pink, C.pinkLight, C.goldLight]);
    expect([...new Set(VINE_TOP_LEFT.pixels)].filter((p) => !allowed.has(p))).toEqual([]);
  });

  it('ft_1_08.AC1 its staff runs out over the screen edge at the end of both arms: the music never stops', () => {
    const { width, height } = VINE_TOP_LEFT;
    // the top arm leaves through the top edge near its far end, the side arm through the left edge near the bottom
    const topExit = [...Array(12).keys()].some((i) => ink(VINE_TOP_LEFT, width - 1 - i, 0));
    const sideExit = [...Array(12).keys()].some((i) => ink(VINE_TOP_LEFT, 0, height - 1 - i));
    expect(topExit).toBe(true);
    expect(sideExit).toBe(true);
    // and it does not just stop: nothing is drawn in the inner corner of the picture, away from both edges
    for (let y = 16; y < height; y++) for (let x = 16; x < width; x++) expect(ink(VINE_TOP_LEFT, x, y)).toBe(false);
  });

  it('ft_1_08.AC1 the other three corners are mirrors of the top left one', () => {
    expect(VINE_CORNERS.topRight.pixels).toEqual(flipX(VINE_TOP_LEFT).pixels);
    expect(VINE_CORNERS.bottomLeft.pixels).toEqual(flipY(VINE_TOP_LEFT).pixels);
    expect(VINE_CORNERS.bottomRight.pixels).toEqual(flipX(flipY(VINE_TOP_LEFT)).pixels);
  });

  it('ft_1_08.AC1 each picture sits flush in its corner of the screen', () => {
    const at = Object.fromEntries(vinePlacements(320, 180).map((p) => [p.corner, p]));
    const { width, height } = VINE_TOP_LEFT;
    expect([at.topLeft!.x, at.topLeft!.y]).toEqual([0, 0]);
    expect([at.topRight!.x, at.topRight!.y]).toEqual([320 - width, 0]);
    expect([at.bottomLeft!.x, at.bottomLeft!.y]).toEqual([0, 180 - height]);
    expect([at.bottomRight!.x, at.bottomRight!.y]).toEqual([320 - width, 180 - height]);
  });
});

describe('the vine on the screens (ft_1_08.AC2, ft_1_08.AC3; retired, d130)', () => {
  it('no screen lays the corner vine over itself any more: the screens lie on the desk, on paper', () => {
    const sources = (dir: string): string[] => readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
      e.isDirectory() ? sources(join(dir, e.name)) : e.name.endsWith('.ts') && !e.name.endsWith('.test.ts') ? [join(dir, e.name)] : []);
    const users = sources('src/game').filter((file) => !file.endsWith('vineArt.ts') && readFileSync(file, 'utf8').includes('vinePlacements'));
    expect(users).toEqual([]);
  });
});
