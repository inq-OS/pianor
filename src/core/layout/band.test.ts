// Covers ft_1_20 (the action and inventory band, d115).
import { describe, expect, it } from 'vitest';
import { BAND_CELLS, BAND_ROWS, bandCells, bandItemPage, bandLayout, wheelChoice, wheelPage, type BandLayout } from './band';
import { moveFocus } from './focus';
import { rectBottom, rectRight, type Rect } from './rect';

const WIDTHS = [320, 342, 384, 427, 480, 640];

function boxes(l: BandLayout): Rect[] {
  return [...l.cells, l.arrows.up, l.arrows.down, ...l.slots];
}

const overlap = (a: Rect, b: Rect) => a.x < rectRight(b) && b.x < rectRight(a) && a.y < rectBottom(b) && b.y < rectBottom(a);

describe('the action and inventory band (ft_1_20, d115)', () => {
  it.each(WIDTHS)('ft_1_20.AC1 at %i cells wide nothing overlaps and nothing leaves the band', (width) => {
    const layout = bandLayout(width);
    const all = boxes(layout);
    for (const r of all) {
      expect(r.x, JSON.stringify(r)).toBeGreaterThanOrEqual(0);
      expect(r.y, JSON.stringify(r)).toBeGreaterThanOrEqual(0);
      expect(rectRight(r), JSON.stringify(r)).toBeLessThanOrEqual(width);
      expect(rectBottom(r), JSON.stringify(r)).toBeLessThanOrEqual(BAND_ROWS);
    }
    for (let i = 0; i < all.length; i++) for (let j = i + 1; j < all.length; j++) expect(overlap(all[i]!, all[j]!), `${JSON.stringify(all[i])} ${JSON.stringify(all[j])}`).toBe(false);
  });

  it('ft_1_20.AC1 has a grid of nine cells at least 15 rows high, an arrow column and two rows of item slots, and no line of text', () => {
    const layout = bandLayout(320);
    expect(Object.keys(layout).sort()).toEqual(['arrows', 'cells', 'slots']);
    expect(layout.cells).toHaveLength(BAND_CELLS);
    for (const cell of layout.cells) expect(cell.h).toBeGreaterThanOrEqual(15);
    expect(layout.arrows.up.x).toBeGreaterThan(rectRight(layout.cells[2]!));
    expect(layout.slots).toHaveLength(8);
    expect(new Set(layout.slots.map((s) => s.y)).size).toBe(2);
    expect(layout.slots.every((s) => s.x > rectRight(layout.arrows.up))).toBe(true);
  });

  it('ft_1_20.AC1 numbers the cells row by row', () => {
    const { cells } = bandLayout(320);
    for (let i = 0; i < BAND_CELLS; i++) {
      expect(cells[i]!.y).toBe(cells[Math.floor(i / 3) * 3]!.y);
      if (i % 3 > 0) expect(cells[i]!.x).toBeGreaterThan(cells[i - 1]!.x);
    }
    expect(cells[8]).toMatchObject({ x: Math.max(...cells.map((c) => c.x)), y: Math.max(...cells.map((c) => c.y)) });
  });

  it('ft_1_20.AC1 gives a wider screen more item slots, never wider cells', () => {
    const narrow = bandLayout(320);
    const wide = bandLayout(480);
    expect(wide.slots.length).toBeGreaterThan(narrow.slots.length);
    expect(wide.cells).toEqual(narrow.cells);
    expect(wide.slots[0]).toEqual(narrow.slots[0]);
    expect(wide.slots.length % 2).toBe(0);
  });

  it('ft_1_20.AC7 moving the keyboard focus right and down walks the cells by their index', () => {
    const { cells } = bandLayout(320);
    const rects = cells.map((c) => ({ x: c.x, y: c.y, width: c.w, height: c.h }));
    expect(moveFocus(rects, 0, 'right')).toBe(1);
    expect(moveFocus(rects, 1, 'right')).toBe(2);
    expect(moveFocus(rects, 0, 'down')).toBe(3);
    expect(moveFocus(rects, 4, 'down')).toBe(7);
  });
});

describe('which action goes in which cell (ft_1_20 rules 3 and 4)', () => {
  it('ft_1_20.AC2 puts the screen\'s actions in the cells by index; Back and Settings are not in the grid', () => {
    const { cells, pages } = bandCells({ actions: 3, page: 0 });
    expect(pages).toBe(1);
    expect(cells).toEqual([{ action: 0 }, { action: 1 }, { action: 2 }, null, null, null, null, null, null]);
    expect(bandCells({ actions: 9, page: 0 }).cells).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8].map((action) => ({ action })));
  });

  it('ft_1_20.AC6 with a tenth action the last cell becomes More, which turns the grid', () => {
    const first = bandCells({ actions: 10, page: 0 });
    expect(first.pages).toBe(2);
    expect(first.cells).toEqual([...[0, 1, 2, 3, 4, 5, 6, 7].map((action) => ({ action })), 'more']);
    const second = bandCells({ actions: 10, page: 1 });
    expect(second.cells).toEqual([{ action: 8 }, { action: 9 }, null, null, null, null, null, null, 'more']);
    // More on the last set turns back to the first
    expect(bandCells({ actions: 10, page: 2 }).page).toBe(0);
    expect(bandCells({ actions: 17, page: 0 }).pages).toBe(3);
  });

  it('ft_1_20.AC6 pages the inventory with the arrows, a page of slots at a time', () => {
    expect(bandItemPage({ items: 5, slots: 8, page: 0 })).toEqual({ page: 0, pages: 1, first: 0, count: 5, up: false, down: false });
    expect(bandItemPage({ items: 0, slots: 8, page: 0 })).toEqual({ page: 0, pages: 1, first: 0, count: 0, up: false, down: false });
    expect(bandItemPage({ items: 11, slots: 8, page: 0 })).toEqual({ page: 0, pages: 2, first: 0, count: 8, up: false, down: true });
    expect(bandItemPage({ items: 11, slots: 8, page: 1 })).toEqual({ page: 1, pages: 2, first: 8, count: 3, up: true, down: false });
    // a page past the end (after the items changed) is kept inside the list
    expect(bandItemPage({ items: 11, slots: 8, page: 5 }).page).toBe(1);
    expect(bandItemPage({ items: 11, slots: 8, page: -1 }).page).toBe(0);
  });
});

describe('the wheel over the inventory (ft_1_20.AC16)', () => {
  it('ft_1_20.AC16 the wheel over an item with choices steps to the next choice that can be picked, and stops at the ends', () => {
    const choices = [{}, { active: true }, { disabled: true }, {}];
    expect(wheelChoice(choices, 1)).toBe(3);
    expect(wheelChoice(choices, -1)).toBe(0);
    expect(wheelChoice([{}, {}, { active: true }], 1)).toBeNull();
    expect(wheelChoice([{ active: true }, {}], -1)).toBeNull();
    // no choice lit: the first one that can be picked, either way
    expect(wheelChoice([null, { disabled: true }, {}, {}], 1)).toBe(2);
    expect(wheelChoice([], 1)).toBeNull();
  });

  it('ft_1_20.AC16 the wheel over the inventory pages it, a page at a time, inside its pages', () => {
    expect(wheelPage({ items: 11, slots: 8, page: 0 }, 1)).toBe(1);
    expect(wheelPage({ items: 11, slots: 8, page: 1 }, 1)).toBeNull();
    expect(wheelPage({ items: 11, slots: 8, page: 1 }, -1)).toBe(0);
    expect(wheelPage({ items: 5, slots: 8, page: 0 }, 1)).toBeNull();
  });
});
