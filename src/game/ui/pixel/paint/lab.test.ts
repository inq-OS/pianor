import { describe, expect, it } from 'vitest';
import { between, fineRun, hexOf, hueTurn, lchOf } from './lab';

describe('colours as the eye measures them (d111)', () => {
  it('ft_1_19.AC5 black is lightness 0, white 100, a grey has no chroma; a colour goes there and back unchanged', () => {
    expect(lchOf(0x000000).l).toBeCloseTo(0, 5);
    expect(lchOf(0xffffff).l).toBeCloseTo(100, 3);
    expect(lchOf(0x808080).chroma).toBeLessThan(0.01);
    for (const hex of [0x000000, 0xffffff, 0x123a22, 0x3a78c8, 0xfb9a24, 0x808080, 0xff0000, 0x00ff00, 0x0000ff]) expect(hexOf(lchOf(hex))).toBe(hex);
  });

  it('ft_1_19.AC5 hues are angles: red near 40, yellow near 100, green near 135, blue near 300', () => {
    expect(lchOf(0xff0000).hue).toBeCloseTo(40, 0);
    expect(lchOf(0xffff00).hue).toBeGreaterThan(95);
    expect(lchOf(0xffff00).hue).toBeLessThan(110);
    expect(lchOf(0x00ff00).hue).toBeCloseTo(136, 0);
    expect(lchOf(0x0000ff).hue).toBeCloseTo(306, 0);
    // a turn goes the short way round
    expect(hueTurn(350, 10)).toBe(20);
    expect(hueTurn(10, 350)).toBe(-20);
    expect(hueTurn(90, 270)).toBe(-180);
    expect(hueTurn(120, 120)).toBe(0);
  });

  it('ft_1_19.AC5 a colour between two is evenly between them in lightness, keeps their strength and turns the hue the short way', () => {
    const dark = 0x123a22, light = 0xc0e070;
    expect(between(dark, light, 0)).toBe(dark);
    expect(between(dark, light, 1)).toBe(light);
    const a = lchOf(dark), b = lchOf(light), mid = lchOf(between(dark, light, 0.5));
    expect(mid.l).toBeCloseTo((a.l + b.l) / 2, 0);
    expect(mid.chroma).toBeCloseTo((a.chroma + b.chroma) / 2, 0);
    expect(hueTurn(a.hue, mid.hue)).toBeCloseTo(hueTurn(a.hue, b.hue) / 2, 0);
    // between a violet and an orange, a mix of the two hex values is greyer than this
    expect(lchOf(between(0x2c2658, 0xfbb858, 0.5)).chroma).toBeGreaterThan(lchOf(0x936f58).chroma + 10);
    // a grey end takes the other end's hue: no stray colour on the way from black to a blue
    expect(Math.abs(hueTurn(lchOf(between(0x000000, 0x3a78c8, 0.5)).hue, lchOf(0x3a78c8).hue))).toBeLessThan(3);
    // what a screen cannot show is cut to what it can
    expect(hexOf({ l: 50, chroma: 500, hue: 40 })).toBeGreaterThanOrEqual(0);
    expect(hexOf({ l: 120, chroma: 0, hue: 0 })).toBe(0xffffff);
  });

  it('ft_1_19.AC5 a run made long keeps its own colours in their order and has no step of lightness over the one asked', () => {
    const run = [0x1d1218, 0x5c3324, 0xb4733c, 0xf4cd8e];
    const long = fineRun(run, 8);
    expect(long.filter((hex) => run.includes(hex))).toEqual(run);
    expect(long.length).toBeGreaterThan(run.length);
    const light = long.map((hex) => lchOf(hex).l);
    light.slice(1).forEach((l, i) => {
      expect(l - light[i]!).toBeGreaterThan(0);
      expect(l - light[i]!).toBeLessThanOrEqual(8.5);
    });
    // a run that is long already stays as it is
    expect(fineRun([0x404040, 0x4c4c4c, 0x585858], 8)).toEqual([0x404040, 0x4c4c4c, 0x585858]);
    expect(fineRun([], 8)).toEqual([]);
  });
});
