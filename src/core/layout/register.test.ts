import { describe, expect, it } from 'vitest';
import { flowLine, placeColumns, REGISTER, registerLayout, registerRows } from './register';

/** The teacher's register (WP-14, d145): an open book across the screen, names on the left page and marks on the right. */
describe('registerLayout', () => {
  it('lays the book over the main area and splits it into two pages with a clear gutter', () => {
    const r = registerLayout(320, 157);
    expect(r.book).toEqual({ x: REGISTER.side, y: REGISTER.top, w: 320 - 2 * REGISTER.side, h: 157 - REGISTER.top - 1 });
    expect(r.mid).toBe(160);
    expect(r.left.x).toBe(REGISTER.side + REGISTER.margin);
    expect(r.left.x + r.left.w).toBe(160 - REGISTER.gutter);
    expect(r.right.x).toBe(160 + REGISTER.gutter);
    expect(r.right.x + r.right.w).toBe(320 - REGISTER.side - REGISTER.edge);
    // the writing stays above the stack of leaves at the book's foot
    expect(r.bottom).toBe(157 - 1 - REGISTER.foot);
    expect(r.top).toBe(REGISTER.top + REGISTER.title);
  });

  it('keeps whole cells on an odd width', () => {
    const r = registerLayout(321, 157);
    expect(Number.isInteger(r.mid)).toBe(true);
    expect(r.right.x - (r.left.x + r.left.w)).toBe(2 * REGISTER.gutter);
  });
});

describe('flowLine', () => {
  it('writes the names along a line and starts a new one when the next does not fit', () => {
    expect(flowLine([20, 20, 20], 100, 6)).toEqual([{ x: 0, line: 0 }, { x: 26, line: 0 }, { x: 52, line: 0 }]);
    expect(flowLine([40, 40, 40], 100, 6)).toEqual([{ x: 0, line: 0 }, { x: 46, line: 0 }, { x: 0, line: 1 }]);
  });

  it('puts a name wider than the line on a line of its own', () => {
    expect(flowLine([10, 150, 10], 100, 6)).toEqual([{ x: 0, line: 0 }, { x: 0, line: 1 }, { x: 0, line: 2 }]);
    expect(flowLine([], 100, 6)).toEqual([]);
  });
});

describe('placeColumns', () => {
  it('sets the columns side by side with the gap asked for when they fit', () => {
    expect(placeColumns([10, 20, 30], 100, 4)).toEqual({ x: [0, 14, 38], end: 68 });
  });

  it('narrows the gap, never below one cell, to fit a page', () => {
    // 10 + 20 + 30 = 60 in 64: two gaps of 2
    expect(placeColumns([10, 20, 30], 64, 4)).toEqual({ x: [0, 12, 34], end: 64 });
    expect(placeColumns([10, 20, 30], 40, 4)).toEqual({ x: [0, 11, 32], end: 62 });
    expect(placeColumns([], 40, 4)).toEqual({ x: [], end: 0 });
  });
});

describe('registerRows', () => {
  it('fits as many ruled lines as the page holds, fewer when a pager takes the foot', () => {
    expect(registerRows(40, 120, 13)).toEqual({ single: 6, paged: 5 });
    expect(registerRows(40, 45, 13)).toEqual({ single: 1, paged: 1 });
  });
});
