// Covers ft_1_20 (the action and inventory band, d115).
import { describe, expect, it } from 'vitest';
import { BAND_CELLS, BAND_ROWS, QUIET_COLUMNS, QUIET_ROWS, bandCells, bandFlow, bandItemPage, bandLayout, cellSpan, quietBandLayout, quietBandRows, wheelChoice, wheelPage, type BandLayout } from './band';
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

describe('the quiet band (ft_1_20 rule 8)', () => {
  it('ft_1_20.AC17 is as tall as what it holds: none on a screen with nothing in it, one row or two', () => {
    expect(quietBandRows({ actionCells: 0, items: 0, slotsPerRow: 4 })).toBe(0);
    expect(quietBandRows({ actionCells: 3, items: 0, slotsPerRow: 4 })).toBe(QUIET_ROWS.one);
    expect(quietBandRows({ actionCells: 0, items: 4, slotsPerRow: 4 })).toBe(QUIET_ROWS.one);
    expect(quietBandRows({ actionCells: 6, items: 0, slotsPerRow: 4 })).toBe(QUIET_ROWS.two);
    expect(quietBandRows({ actionCells: 2, items: 5, slotsPerRow: 4 })).toBe(QUIET_ROWS.two);
    expect(QUIET_ROWS).toEqual({ one: 17, two: 32 });
  });

  it.each(WIDTHS)('ft_1_20.AC17 at %i cells wide the quiet cells and slots are 15 rows high, inside the band and apart', (width) => {
    for (const rows of [1, 2] as const) {
      const layout = quietBandLayout(width, rows);
      const all = boxes(layout);
      expect(layout.cells).toHaveLength(QUIET_COLUMNS * rows);
      for (const r of all) {
        expect(r.h).toBeGreaterThanOrEqual(15);
        expect(r.x).toBeGreaterThanOrEqual(0);
        expect(rectRight(r)).toBeLessThanOrEqual(width);
        expect(rectBottom(r)).toBeLessThanOrEqual(rows === 1 ? QUIET_ROWS.one : QUIET_ROWS.two);
      }
      for (let i = 0; i < all.length; i++) for (let j = i + 1; j < all.length; j++) expect(overlap(all[i]!, all[j]!)).toBe(false);
      expect(layout.slots.length % rows).toBe(0);
      expect(layout.slots.length / rows).toBeGreaterThanOrEqual(4);
    }
  });

  it('ft_1_20.AC18 never cuts a word: a word wider than a cell takes as many cells of its row as it needs', () => {
    expect(cellSpan(10, 30)).toBe(1);
    expect(cellSpan(30, 30)).toBe(1);
    expect(cellSpan(31, 30)).toBe(2);
    expect(cellSpan(70, 30)).toBe(3);
    // a word longer than a whole row still gets the whole row, never a cut
    expect(cellSpan(500, 30)).toBe(QUIET_COLUMNS);
  });

  it('ft_1_20.AC18 flows the actions row by row in their order, a wide one to the next row when it does not fit', () => {
    const flow = bandFlow({ spans: [1, 1, 1, 1, 2, 1], rows: 2, page: 0 });
    expect(flow.placed).toEqual([
      { action: 0, row: 0, column: 0, span: 1 },
      { action: 1, row: 0, column: 1, span: 1 },
      { action: 2, row: 0, column: 2, span: 1 },
      { action: 3, row: 0, column: 3, span: 1 },
      { action: 4, row: 1, column: 0, span: 2 },
      { action: 5, row: 1, column: 2, span: 1 },
    ]);
    expect(flow.more).toBeNull();
    expect(flow.pages).toBe(1);
  });

  it('ft_1_20.AC18 with more actions than room the last cell is More and turns to the rest', () => {
    const spans = Array.from({ length: 12 }, () => 1);
    const first = bandFlow({ spans, rows: 2, page: 0 });
    expect(first.placed.map((p) => p.action)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8]);
    expect(first.more).toEqual({ row: 1, column: QUIET_COLUMNS - 1 });
    expect(first.pages).toBe(2);
    const second = bandFlow({ spans, rows: 2, page: 1 });
    expect(second.placed.map((p) => p.action)).toEqual([9, 10, 11]);
    expect(second.more).toEqual({ row: 1, column: QUIET_COLUMNS - 1 });
    expect(bandFlow({ spans, rows: 2, page: 2 }).page).toBe(0);
  });

  it('ft_1_20.AC18 a page always shows an action, so every action can be reached through More', () => {
    const first = bandFlow({ spans: [5, 1, 1], rows: 1, page: 0 });
    expect(first.placed.map((p) => p.action)).toEqual([0]);
    expect(first.pages).toBe(2);
    expect(bandFlow({ spans: [5, 1, 1], rows: 1, page: 1 }).placed.map((p) => p.action)).toEqual([1, 2]);
    expect(bandFlow({ spans: [5, 5, 1], rows: 2, page: 0 }).placed.map((p) => p.action)).toEqual([0]);
  });
});
