import type { Rect } from './rect';

/**
 * The teacher's register (WP-14, d145): her screens are written in an old school
 * register lying open across the screen, the names and dates on the left page and the marks on the right, as a class
 * register is kept. Pure: the scenes measure their words and draw what this places. Layout cells.
 */
export const REGISTER = {
  /** The book's cover from the screen's side and from the main area's top. */
  side: 3,
  top: 1,
  /** Bare page between the cover's edge and the writing, on the left page and at the right page's outer edge. */
  margin: 11,
  edge: 8,
  /** Bare page each side of the gutter. */
  gutter: 7,
  /** The heading's room at the top of a page (one big line), and the stack of leaves and the cover at the foot. */
  title: 7,
  foot: 9,
  /** A ruled line of the table, and the room a pager takes at the foot. */
  row: 13,
  pager: 14,
} as const;

export interface Page {
  readonly x: number;
  readonly w: number;
}

export interface RegisterLayout {
  /** The book, cover and all. */
  readonly book: Rect;
  /** The gutter's x, and where writing may go on each page. */
  readonly mid: number;
  readonly left: Page;
  readonly right: Page;
  /** The first row under the book's top edge that may be written on, and the last one above its foot. */
  readonly top: number;
  readonly bottom: number;
}

/** The register over a main area `width` by `height` (its top at 0). */
export function registerLayout(width: number, height: number): RegisterLayout {
  const { side, top, margin, edge, gutter, title, foot } = REGISTER;
  const mid = Math.floor(width / 2);
  const leftX = side + margin, rightEnd = width - side - edge;
  return {
    book: { x: side, y: top, w: width - 2 * side, h: height - top - 1 },
    mid,
    left: { x: leftX, w: mid - gutter - leftX },
    right: { x: mid + gutter, w: rightEnd - mid - gutter },
    top: top + title,
    bottom: height - 1 - foot,
  };
}

/** Words written one after another along a line `width` wide, `gap` apart, a new line when the next does not fit: each one's x from the line's start and its line. */
export function flowLine(widths: readonly number[], width: number, gap: number): { x: number; line: number }[] {
  const out: { x: number; line: number }[] = [];
  let x = 0, line = 0;
  for (const w of widths) {
    if (x > 0 && x + w > width) {
      x = 0;
      line++;
    }
    out.push({ x, line });
    x += w + gap;
  }
  return out;
}

/**
 * Columns `widths` wide side by side from 0, `gap` apart; when they do not fit `width` the gap narrows, never below one
 * cell (an adult's table may then run into the page's edge, which the scene clips). Each column's x, and where the last ends.
 */
export function placeColumns(widths: readonly number[], width: number, gap: number): { x: number[]; end: number } {
  if (widths.length === 0) return { x: [], end: 0 };
  const sum = widths.reduce((a, b) => a + b, 0);
  const gaps = widths.length - 1;
  const used = gaps === 0 ? gap : Math.max(1, Math.min(gap, Math.floor((width - sum) / gaps)));
  const x: number[] = [];
  let at = 0;
  for (const w of widths) {
    x.push(at);
    at += w + used;
  }
  return { x, end: at - used };
}

/** How many ruled lines `row` tall fit between `top` and `bottom`: on a page of their own, and when a pager takes the foot. At least one. */
export function registerRows(top: number, bottom: number, row: number): { single: number; paged: number } {
  const fit = (room: number) => Math.max(1, Math.floor(room / row));
  return { single: fit(bottom - top), paged: fit(bottom - top - REGISTER.pager) };
}
