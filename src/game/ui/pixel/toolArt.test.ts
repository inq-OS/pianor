import { describe, expect, it } from 'vitest';
import { inkCount, type Bitmap } from './bitmap';
import { iconWithNumber, TOOL_ICONS } from './toolArt';

const same = (a: Bitmap, b: Bitmap) => a.width === b.width && a.height === b.height && a.pixels.every((p, i) => p === b.pixels[i]);

describe('practice screen button pictures', () => {
  it.each(Object.entries(TOOL_ICONS))('the %s picture fits inside a 14 pixel bar button with its frame', (_id, icon) => {
    expect(icon.height).toBeLessThanOrEqual(10);
    expect(icon.width).toBeLessThanOrEqual(20);
    expect(inkCount(icon)).toBeGreaterThan(10);
  });

  it('no two pictures look alike, and note names on shows more than off', () => {
    const all = Object.values(TOOL_ICONS);
    for (let i = 0; i < all.length; i++) for (let j = i + 1; j < all.length; j++) expect(same(all[i]!, all[j]!)).toBe(false);
    expect(inkCount(TOOL_ICONS.noteNamesOn)).toBeGreaterThan(inkCount(TOOL_ICONS.noteNames));
  });
});

describe('a picture with its value', () => {
  it('ft_1_10.AC13 the step and the note length show their number in the picture, which still fits a bar button', () => {
    for (const n of [1, 3, 9]) {
      const icon = iconWithNumber(TOOL_ICONS.steps, n);
      expect(icon.height).toBeLessThanOrEqual(10);
      expect(icon.width).toBeLessThanOrEqual(20);
      expect(inkCount(icon)).toBeGreaterThan(inkCount(TOOL_ICONS.steps));
    }
    expect(same(iconWithNumber(TOOL_ICONS.orderDeadline, 1), iconWithNumber(TOOL_ICONS.orderDeadline, 2))).toBe(false);
  });
});
