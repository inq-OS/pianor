import { describe, expect, it } from 'vitest';
import { cardGrid, pagerBoxes } from './cardGrid';
import { rectCentre } from './rect';

describe('cardGrid', () => {
  const menu = { width: 320, height: 180, top: 54, margin: 6, rowHeight: 32, rowGap: 2 };

  it('puts two columns on a wide screen and one on a narrow one', () => {
    expect(cardGrid(menu)).toMatchObject({ columns: 2, cardWidth: 152 });
    expect(cardGrid({ ...menu, width: 299 })).toMatchObject({ columns: 1, cardWidth: 287 });
  });

  it('fits fewer cards per page once a pager row takes its room', () => {
    // 180 - 54 - 6 = 120 art pixels: three rows of 34, or two once the pager takes 22
    expect(cardGrid(menu)).toMatchObject({ singlePageMax: 6, perPage: 4 });
  });

  it('always keeps at least one row', () => {
    expect(cardGrid({ ...menu, height: 60 })).toMatchObject({ singlePageMax: 2, perPage: 2 });
  });

  it('places cards left to right, then down, centred where the menu always drew them', () => {
    const grid = cardGrid(menu);
    expect(rectCentre(grid.cell(0))).toEqual({ x: 82, y: 70, width: 152, height: 32 });
    expect(rectCentre(grid.cell(3))).toEqual({ x: 238, y: 104, width: 152, height: 32 });
  });
});

describe('cardGrid in a book', () => {
  it('fills the left page down, then the right page, as a book is read (the song list and the parts, d130)', () => {
    const grid = cardGrid({ width: 320, height: 157, top: 30, margin: 14, rowHeight: 28, rowGap: 2, columnGap: 18 });
    const rows = grid.perPage / grid.columns;
    // the first `rows` cards go down the left page, the next start the right page at the top
    for (let i = 0; i < rows; i++) expect(grid.pageCell(i, grid.perPage)).toEqual({ ...grid.cell(2 * i), h: 28 });
    expect(grid.pageCell(rows, grid.perPage)).toEqual(grid.cell(1));
    // on an unpaged list the page holds `singlePageMax`
    const full = grid.singlePageMax / grid.columns;
    expect(grid.pageCell(full, grid.singlePageMax)).toEqual(grid.cell(1));
  });

  it('keeps one column down on a narrow screen', () => {
    const grid = cardGrid({ width: 200, height: 157, top: 30, margin: 14, rowHeight: 28, rowGap: 2 });
    expect(grid.pageCell(2, grid.perPage)).toEqual(grid.cell(2));
  });
});

describe('pagerBoxes', () => {
  it('centres Previous and Next 62 art pixels either side of the middle, on the bottom row', () => {
    const pager = pagerBoxes(320, 180);
    expect(rectCentre(pager.previous)).toEqual({ x: 98, y: 165, width: 60, height: 18 });
    expect(rectCentre(pager.next)).toEqual({ x: 222, y: 165, width: 60, height: 18 });
    expect(pager).toMatchObject({ labelY: 162, centreX: 160 });
  });
});
