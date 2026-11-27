import { describe, expect, it } from 'vitest';
import { inkCount, type Bitmap } from './bitmap';
import { TOOL_ICONS } from './toolArt';

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
