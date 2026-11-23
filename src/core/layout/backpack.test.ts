// Covers ft_1_20 (the backpack, d282).
import { describe, expect, it } from 'vitest';
import { BACKPACK_SLOT, backpackPage } from './backpack';
import { frameCorners } from './frame';
import { rectBottom, rectRight, type Rect } from './rect';

const overlap = (a: Rect, b: Rect) => a.x < rectRight(b) && b.x < rectRight(a) && a.y < rectBottom(b) && b.y < rectBottom(a);

describe('the backpack (ft_1_20, d282)', () => {
  it.each([320, 342, 427])('ft_1_20.AC23 at %i wide stands in the top right corner left of the gear', (width) => {
    const { settings } = frameCorners(width);
    const { button } = backpackPage({ width, height: 180, items: 0 });
    expect(rectRight(button)).toBe(settings.x - 3);
    expect(button.y).toBe(settings.y);
    expect(overlap(button, settings)).toBe(false);
  });

  it.each([0, 1, 4, 9, 30])('ft_1_20.AC23 with %i items lays out only filled slots, under the backpack, inside the screen and none overlapping', (items) => {
    const page = backpackPage({ width: 320, height: 180, items });
    expect(page.slots).toHaveLength(Math.min(items, page.perPage));
    for (const s of page.slots) {
      expect([s.w, s.h]).toEqual([BACKPACK_SLOT.w, BACKPACK_SLOT.h]);
      expect(s.x).toBeGreaterThanOrEqual(0);
      expect(rectRight(s)).toBeLessThanOrEqual(320);
      expect(s.y).toBeGreaterThan(rectBottom(page.button));
      expect(rectBottom(s)).toBeLessThanOrEqual(180);
      // every slot is on the page's board
      expect(s.x).toBeGreaterThanOrEqual(page.board.x);
      expect(rectBottom(s)).toBeLessThanOrEqual(rectBottom(page.board));
    }
    for (let i = 0; i < page.slots.length; i++) for (let j = i + 1; j < page.slots.length; j++) expect(overlap(page.slots[i]!, page.slots[j]!)).toBe(false);
    // the board's right edge stays under the backpack, so the page opens from it
    expect(rectRight(page.board)).toBe(rectRight(page.button));
  });

  it('ft_1_20.AC23 a page holds four columns of three rows at the least screen', () => {
    expect(backpackPage({ width: 320, height: 180, items: 30 }).perPage).toBe(12);
  });
});
