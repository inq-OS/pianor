// Covers ft_0_16.AC1.
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { pageOf, stepItem } from './paging';

describe('pageOf', () => {
  it('keeps a short list on one page with no pager', () => {
    for (const total of [0, 1, 5, 7]) {
      expect(pageOf(total, 0)).toEqual({ page: 0, pages: 1, first: 0, count: total, paged: false });
    }
  });

  it('ignores the requested page when there is only one', () => {
    expect(pageOf(5, 3)).toMatchObject({ page: 0, first: 0, count: 5, paged: false });
  });

  it('splits a longer list into pages of six, the last one holding the rest', () => {
    expect(pageOf(8, 0)).toEqual({ page: 0, pages: 2, first: 0, count: 6, paged: true });
    expect(pageOf(8, 1)).toEqual({ page: 1, pages: 2, first: 6, count: 2, paged: true });
    expect(pageOf(12, 1)).toEqual({ page: 1, pages: 2, first: 6, count: 6, paged: true });
    expect(pageOf(13, 2)).toEqual({ page: 2, pages: 3, first: 12, count: 1, paged: true });
  });

  it('keeps the page inside the list when pieces are removed or the page is out of range', () => {
    expect(pageOf(8, 9)).toMatchObject({ page: 1 });
    expect(pageOf(8, -3)).toMatchObject({ page: 0 });
    expect(pageOf(8, 1.7)).toMatchObject({ page: 1 });
  });

  it('can be given other sizes', () => {
    expect(pageOf(10, 1, { singlePageMax: 9, perPage: 4 })).toEqual({ page: 1, pages: 3, first: 4, count: 4, paged: true });
  });

  it('shows every piece exactly once across the pages (property)', () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 200 }), (total) => {
        const first = pageOf(total, 0);
        const shown: number[] = [];
        for (let page = 0; page < first.pages; page++) {
          const p = pageOf(total, page);
          expect(p.count).toBeGreaterThanOrEqual(total === 0 ? 0 : 1);
          for (let i = 0; i < p.count; i++) shown.push(p.first + i);
        }
        expect(shown).toEqual(Array.from({ length: total }, (_, i) => i));
      }),
    );
  });
});

describe('stepItem (ft_Y_13.AC5)', () => {
  const book = { singlePageMax: 6, perPage: 6 };

  it('chooses the first item of the page shown when nothing is chosen, and nothing in an empty list', () => {
    expect(stepItem(14, null, 1, { ...book, page: 1 })).toBe(6);
    expect(stepItem(0, null, 1, book)).toBeNull();
    expect(stepItem(0, 3, 1, book)).toBeNull();
  });

  it('moves one item a notch, across a page edge, and stops at both ends of the list', () => {
    expect(stepItem(14, 2, 1, book)).toBe(3);
    expect(stepItem(14, 5, 1, book)).toBe(6);
    expect(stepItem(14, 6, -1, book)).toBe(5);
    expect(stepItem(14, 13, 1, book)).toBe(13);
    expect(stepItem(14, 0, -1, book)).toBe(0);
  });

  it('turns a page keeping the place on it, the last page holding fewer, and stops at the first and last page', () => {
    expect(stepItem(14, 1, 1, { ...book, pages: true })).toBe(7);
    expect(stepItem(14, 10, 1, { ...book, pages: true })).toBe(13);
    expect(stepItem(14, 13, 1, { ...book, pages: true })).toBe(13);
    expect(stepItem(14, 7, -1, { ...book, pages: true })).toBe(1);
    expect(stepItem(14, 2, -1, { ...book, pages: true })).toBe(2);
  });

  it('keeps the item on a list with one page', () => {
    expect(stepItem(4, 2, 1, { ...book, pages: true })).toBe(2);
  });

  it('never leaves the list', () => {
    fc.assert(fc.property(fc.integer({ min: 1, max: 60 }), fc.integer({ min: 0, max: 59 }), fc.integer({ min: -3, max: 3 }), fc.boolean(), (total, at, step, pages) => {
      const index = stepItem(total, Math.min(at, total - 1), step, { ...book, pages })!;
      expect(index).toBeGreaterThanOrEqual(0);
      expect(index).toBeLessThan(total);
    }));
  });
});
