import { describe, expect, it } from 'vitest';
import { spotlightLayout } from './spotlight';
import type { Rect } from './rect';

const screen = { w: 320, h: 180 };
const kiur = { w: 52, h: 40 };
const line = { w: 180, h: 20 };
const overlaps = (a: Rect, b: Rect) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
const inside = (a: Rect) => a.x >= 0 && a.y >= 0 && a.x + a.w <= screen.w && a.y + a.h <= screen.h;

describe('the intro spotlight (ft_1_31.AC2)', () => {
  it('darkens all of the screen but the thing shown', () => {
    const spot = { x: 200, y: 20, w: 40, h: 30 };
    const out = spotlightLayout({ screen, spot, kiur, line });
    const area = out.shades.reduce((n, r) => n + r.w * r.h, 0) + out.light!.w * out.light!.h;
    expect(area).toBe(screen.w * screen.h);
    for (const shade of out.shades) expect(overlaps(shade, out.light!)).toBe(false);
    expect(overlaps(out.light!, spot)).toBe(true);
  });

  it('puts Kiur and his line on the side away from the light, the arrow pointing at it, none covering it', () => {
    const spot = { x: 220, y: 20, w: 40, h: 30 };
    const out = spotlightLayout({ screen, spot, kiur, line });
    expect(out.kiur.facing).toBe('right');
    expect(out.kiur.x).toBeLessThan(spot.x);
    expect(out.arrow!.points).toBe('up');
    const kiurBox = { ...out.kiur, ...kiur };
    const lineBox = { ...out.line, ...line };
    for (const box of [kiurBox, lineBox]) {
      expect(inside(box)).toBe(true);
      expect(overlaps(box, out.light!)).toBe(false);
    }
    expect(overlaps(kiurBox, lineBox)).toBe(false);
  });

  it('points down at a thing low on the screen and turns Kiur the other way on its left', () => {
    const spot = { x: 10, y: 140, w: 30, h: 20 };
    const out = spotlightLayout({ screen, spot, kiur, line });
    expect(out.arrow!.points).toBe('down');
    expect(out.arrow!.y + 14).toBeLessThanOrEqual(out.light!.y);
    expect(out.kiur.facing).toBe('left');
    expect(out.kiur.x).toBeGreaterThan(spot.x + spot.w);
  });

  it('with nothing shown darkens the whole screen and has no arrow', () => {
    const out = spotlightLayout({ screen, spot: null, kiur, line });
    expect(out.shades).toEqual([{ x: 0, y: 0, w: 320, h: 180 }]);
    expect(out.arrow).toBeNull();
    expect(inside({ ...out.line, ...line })).toBe(true);
  });

  it('keeps a light at the screen\'s edge inside the screen', () => {
    const out = spotlightLayout({ screen, spot: { x: 0, y: 0, w: 20, h: 12 }, kiur, line });
    expect(inside(out.light!)).toBe(true);
    expect(out.light!.x).toBe(0);
  });

  describe('the skip button, on screen at every step', () => {
    const skip = { w: 50, h: 14 };
    const boxes = (out: ReturnType<typeof spotlightLayout>): Rect[] => [
      ...(out.light ? [out.light] : []),
      ...(out.arrow ? [{ x: out.arrow.x, y: out.arrow.y, w: 18, h: 14 }] : []),
      { ...out.kiur, ...kiur },
      { ...out.line, ...line },
    ];

    it('ft_1_31.AC5 stands in a corner of the screen, clear of the light, the arrow, Kiur and his line', () => {
      const spots: (Rect | null)[] = [null, { x: 200, y: 20, w: 40, h: 30 }, { x: 10, y: 140, w: 30, h: 20 }, { x: 290, y: 2, w: 28, h: 14 }, { x: 290, y: 160, w: 28, h: 16 }, { x: 4, y: 2, w: 20, h: 12 }];
      for (const spot of spots) {
        const out = spotlightLayout({ screen, spot, kiur, line, skip });
        const box = { ...out.skip!, ...skip };
        expect(inside(box)).toBe(true);
        for (const other of boxes(out)) expect(overlaps(box, other)).toBe(false);
      }
    });

    it('is top right when that corner is free, and absent when not asked for', () => {
      const out = spotlightLayout({ screen, spot: { x: 10, y: 140, w: 30, h: 20 }, kiur, line, skip });
      expect(out.skip).toEqual({ x: screen.w - 4 - skip.w, y: 4 });
      expect(spotlightLayout({ screen, spot: null, kiur, line }).skip).toBeNull();
    });
  });
});
