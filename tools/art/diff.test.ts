import { describe, expect, it } from 'vitest';
import { changeOf, contactSheet, diffSheet, imageTokens, readPng, rgbPngBytes, type RgbPicture } from './diff';
import { pngBytes } from './png';

/** A `w` x `h` picture of one colour. */
function plain(w: number, h: number, colour: number): RgbPicture {
  const rgb = new Uint8Array(w * h * 3);
  for (let i = 0; i < w * h; i++) rgb.set([(colour >> 16) & 255, (colour >> 8) & 255, colour & 255], i * 3);
  return { width: w, height: h, rgb };
}

/** `p` with the pixel at x, y set to `colour`. */
function dotted(p: RgbPicture, x: number, y: number, colour: number): RgbPicture {
  const rgb = p.rgb.slice();
  rgb.set([(colour >> 16) & 255, (colour >> 8) & 255, colour & 255], (y * p.width + x) * 3);
  return { ...p, rgb };
}

const at = (p: RgbPicture, x: number, y: number): number => {
  const i = (y * p.width + x) * 3;
  return (p.rgb[i]! << 16) | (p.rgb[i + 1]! << 8) | p.rgb[i + 2]!;
};

describe('art:diff shows the painter only what a change did, small enough to look at cheaply', () => {
  it('reads back the PNG files the art tools write, pixel for pixel', () => {
    const bytes = pngBytes({ width: 2, height: 1, pixels: new Uint8Array([1, 2]), palette: [0, 0x112233, 0xaabbcc] });
    const p = readPng(bytes);
    expect([p.width, p.height]).toEqual([2, 1]);
    expect([at(p, 0, 0), at(p, 1, 0)]).toEqual([0x112233, 0xaabbcc]);
    expect(readPng(rgbPngBytes(p))).toEqual(p);
  });

  it('counts the changed pixels and boxes them; nothing changed is no box', () => {
    const before = plain(40, 20, 0x336699);
    expect(changeOf(before, before)).toEqual({ changed: 0, share: 0, box: undefined });
    const after = dotted(dotted(before, 3, 4, 0xff0000), 10, 7, 0x00ff00);
    expect(changeOf(before, after)).toEqual({ changed: 2, share: 2 / 800, box: { x: 3, y: 4, w: 8, h: 4 } });
  });

  it('a picture whose size changed counts as changed everywhere', () => {
    const c = changeOf(plain(4, 4, 0), plain(5, 4, 0));
    expect(c.share).toBe(1);
    expect(c.box).toEqual({ x: 0, y: 0, w: 5, h: 4 });
  });

  it('lays before, after and the changed pixels side by side, cropped round the change and zoomed so single pixels show', () => {
    const before = plain(200, 100, 0x336699);
    const after = dotted(before, 50, 50, 0xff0000);
    const sheet = diffSheet([{ before, after, box: changeOf(before, after).box! }]);
    // a 1-pixel change gets 8 pixels of margin each way (17 x 17) at the largest zoom, 4
    expect(sheet.height).toBe(4 + 17 * 4 + 4);
    expect(sheet.width).toBe(4 + 3 * (17 * 4 + 4));
    // the middle of the after tile is the new red; the mask tile marks it in magenta
    const mid = 4 + 8 * 4 + 1;
    expect(at(sheet, 4 + 17 * 4 + 4 + mid - 4, mid)).toBe(0xff0000);
    expect(at(sheet, 4 + 2 * (17 * 4 + 4) + mid - 4, mid)).toBe(0xff00ff);
    expect(at(sheet, mid, mid)).toBe(0x336699);
  });

  it('a change too big for side by side tiles stacks them, never wider than a screen', () => {
    const before = plain(640, 360, 0x336699);
    const after = { ...before, rgb: before.rgb.map(() => 9) };
    const sheet = diffSheet([{ before, after, box: changeOf(before, after).box! }]);
    expect(sheet.width).toBeLessThanOrEqual(1280);
  });

  it('puts the four hours of a picture on one sheet at 1x, two by two', () => {
    const hours = [0x111111, 0x222222, 0x333333, 0x444444].map((c) => plain(64, 36, c));
    const sheet = contactSheet(hours);
    expect([sheet.width, sheet.height]).toEqual([4 + 2 * (64 + 4), 4 + 2 * (36 + 4)]);
    expect(at(sheet, 4 + 64 + 4, 4 + 36 + 4)).toBe(0x444444);
  });

  it('says what a picture costs to look at, by the size the model is shown', () => {
    expect(imageTokens(640, 360)).toBe(308);
    expect(imageTokens(1920, 1080)).toBeGreaterThan(1500);
  });
});
