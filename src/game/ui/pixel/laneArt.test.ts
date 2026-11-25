// Covers core_13.AC8.
import { describe, expect, it } from 'vitest';
import { inkCount, type Bitmap } from './bitmap';
import { LANE_ICONS } from './laneArt';

const same = (a: Bitmap, b: Bitmap) => a.width === b.width && a.height === b.height && a.pixels.every((p, i) => p === b.pixels[i]);

describe('the beat lane bubble pictures', () => {
  it.each(Object.entries(LANE_ICONS))('core_13.AC8 the %s picture fits a bubble option', (_id, icon) => {
    expect(icon.height).toBeLessThanOrEqual(10);
    expect(icon.width).toBeLessThanOrEqual(16);
    expect(inkCount(icon)).toBeGreaterThanOrEqual(6);
  });

  it('core_13.AC8 no two pictures look alike', () => {
    const all = Object.values(LANE_ICONS);
    for (let i = 0; i < all.length; i++) for (let j = i + 1; j < all.length; j++) expect(same(all[i]!, all[j]!)).toBe(false);
  });
});
