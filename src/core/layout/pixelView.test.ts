// Covers ft_0_13.AC1.
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { pixelView } from './pixelView';

describe('pixelView', () => {
  it('picks the whole-number zoom the screen allows: 4x at 1366x768 and 1280x720, 3x at 1024x600, 2x on a small tablet', () => {
    expect(pixelView(1366, 768)).toMatchObject({ scale: 4 });
    expect(pixelView(1280, 720)).toMatchObject({ scale: 4 });
    expect(pixelView(1024, 600)).toMatchObject({ scale: 3 });
    expect(pixelView(800, 480)).toMatchObject({ scale: 2 });
    expect(pixelView(1920, 1080)).toMatchObject({ scale: 6 });
  });

  it('never goes below 1x or above the largest zoom, even on a tiny or huge screen', () => {
    expect(pixelView(200, 100).scale).toBe(1);
    expect(pixelView(0, 0).scale).toBe(1);
    expect(pixelView(7680, 4320).scale).toBe(8);
  });

  it('measures the screen in art pixels, rounded up so the art covers every screen pixel', () => {
    const v = pixelView(1366, 768);
    expect(v.width).toBe(342);
    expect(v.height).toBe(192);
    expect(v.width * v.scale).toBeGreaterThanOrEqual(1366);
    expect(v.height * v.scale).toBeGreaterThanOrEqual(768);
  });

  it('always leaves at least 320x180 art pixels to lay out when the screen is that big (property)', () => {
    fc.assert(
      fc.property(fc.integer({ min: 320, max: 4000 }), fc.integer({ min: 180, max: 2500 }), (w, h) => {
        const v = pixelView(w, h);
        expect(Number.isInteger(v.scale)).toBe(true);
        expect(v.scale).toBeGreaterThanOrEqual(1);
        expect(v.width).toBeGreaterThanOrEqual(320);
        expect(v.height).toBeGreaterThanOrEqual(180);
        expect(v.width * v.scale).toBeGreaterThanOrEqual(w);
        expect((v.width - 1) * v.scale).toBeLessThan(w);
        expect((v.height - 1) * v.scale).toBeLessThan(h);
      }),
    );
  });

  it('takes another minimum size and maximum zoom', () => {
    expect(pixelView(1366, 768, { minWidth: 400, minHeight: 225 }).scale).toBe(3);
    expect(pixelView(1366, 768, { maxScale: 2 }).scale).toBe(2);
  });
});
