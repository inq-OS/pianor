import { describe, expect, it } from 'vitest';
import { createBitmap } from './bitmap';
import { C } from './palette';
import { nameRibbon } from './rankArt';

describe('the name ribbon under the rank shield', () => {
  it('ft_1_20.AC13 is wider than the letters it carries, holds them inside its outline, and ends in forked tails', () => {
    const letters = createBitmap(71, 9);
    const { ribbon, at } = nameRibbon(letters);
    expect(ribbon.width).toBeGreaterThan(letters.width + 8);
    expect(at.x + letters.width).toBeLessThan(ribbon.width);
    expect(at.y + letters.height).toBeLessThan(ribbon.height);
    const px = (x: number, y: number) => ribbon.pixels[y * ribbon.width + x];
    const mid = Math.floor(ribbon.height / 2);
    expect(px(0, mid)).toBe(0); // the fork's notch at each end
    expect(px(ribbon.width - 1, mid)).toBe(0);
    expect(px(Math.floor(ribbon.width / 2), 0)).toBe(C.ink);
    expect(px(at.x, at.y)).toBe(C.blue);
  });
});
