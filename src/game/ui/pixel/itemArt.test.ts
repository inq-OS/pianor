import { describe, expect, it } from 'vitest';
import { STAFF_INK } from '../../../core/layout/scoreColour';
import { BACKPACK_SLOT } from '../../../core/layout/backpack';
import { ART_DETAIL } from '../../../core/layout/frame';
import type { Bitmap } from './bitmap';
import { ITEM_INK, ITEM_SIGNS, ITEM_SIZE, ITEM_SKIN, itemPicture } from './itemArt';
import { contrast } from './paint/lab';
import { C, PALETTE } from './palette';

const at = (b: Bitmap, x: number, y: number): number => (x < 0 || y < 0 || x >= b.width || y >= b.height ? 0 : b.pixels[y * b.width + x]!);
const skin = new Set<number>(ITEM_SKIN);

describe('the piece maker\'s items: parchment scraps written in the staff\'s ink (ft_1_20, pick B)', () => {
  it('fits every picture inside a slot of the backpack, on the fine grid', () => {
    const slot = BACKPACK_SLOT;
    // the slot's groove and ridge take two cells on each side
    expect(ITEM_SIZE.width).toBeLessThanOrEqual((slot.w - 4) * ART_DETAIL);
    expect(ITEM_SIZE.height).toBeLessThanOrEqual((slot.h - 4) * ART_DETAIL);
  });

  it.each(ITEM_SIGNS)('%s: a scrap of skin with its sign in ink, the whole sign on the scrap', (name) => {
    const b = itemPicture(name);
    expect([b.width, b.height]).toEqual([ITEM_SIZE.width, ITEM_SIZE.height]);
    let ink = 0;
    for (let y = 0; y < b.height; y++) {
      for (let x = 0; x < b.width; x++) {
        const p = at(b, x, y);
        expect([0, C.groove, ITEM_INK, ...ITEM_SKIN]).toContain(p);
        if (p !== ITEM_INK) continue;
        ink++;
        // never cut by the torn edge: two pixels of skin or ink all round the sign
        for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) expect([ITEM_INK, ...ITEM_SKIN]).toContain(at(b, x + dx, y + dy));
      }
    }
    if (name === 'blank') expect(ink).toBe(0);
    else expect(ink).toBeGreaterThan(40);
  });

  it('writes in the staff\'s own ink, more than 7 to 1 against every tone of skin the sign touches', () => {
    expect(PALETTE[ITEM_INK]).toBe(STAFF_INK);
    const touched = new Set<number>();
    for (const name of ITEM_SIGNS) {
      const b = itemPicture(name);
      for (let y = 0; y < b.height; y++) for (let x = 0; x < b.width; x++) if (at(b, x, y) === ITEM_INK) for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) if (skin.has(at(b, x + dx, y + dy))) touched.add(at(b, x + dx, y + dy));
    }
    for (const tone of touched) expect(contrast(PALETTE[tone]!, STAFF_INK)).toBeGreaterThan(7);
  });

  it('no two items look alike, and each is painted the same every time', () => {
    const keys = ITEM_SIGNS.map((n) => itemPicture(n).pixels.join(','));
    expect(new Set(keys).size).toBe(ITEM_SIGNS.length);
    expect(itemPicture('tie')).toBe(itemPicture('tie'));
  });

  it('runs its skin from dark to light, as a run of the warm buff', () => {
    const lightness = ITEM_SKIN.map((i) => contrast(PALETTE[i]!, 0x000000));
    for (let i = 1; i < lightness.length; i++) expect(lightness[i]!).toBeGreaterThan(lightness[i - 1]!);
  });
});
