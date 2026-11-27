import type { Rect } from './rect';

/**
 * Where an open book (`paint/book.ts`, the song book and the teacher's register) may be written on: its two pages, clear
 * of the cover, the stack of leaves, the torn and curled paper edge and the gutter. Layout cells, from the book's own edges.
 * Measured on the painted book (its test holds the picture to it): the paper is light from here in.
 */
export const BOOK_PAGE = {
  /** From the book's side edges to the writing on each page (the cover, the stack of leaves and the torn paper edge). */
  side: 20,
  /** Clear of the gutter on each side of the book's middle. */
  gutter: 7,
  /** From the book's top edge, and from its foot (the leaves' stack under the pages). */
  top: 12,
  foot: 23,
} as const;

/** The two pages of an open book laid over `book` (layout cells): what is written in it stays inside one of them. */
export function bookPages(book: Rect): { left: Rect; right: Rect } {
  const mid = book.x + Math.floor(book.w / 2);
  const y = book.y + BOOK_PAGE.top;
  const h = book.y + book.h - BOOK_PAGE.foot - y;
  const leftX = book.x + BOOK_PAGE.side;
  const rightX = mid + BOOK_PAGE.gutter;
  return {
    left: { x: leftX, y, w: mid - BOOK_PAGE.gutter - leftX, h },
    right: { x: rightX, y, w: book.x + book.w - BOOK_PAGE.side - rightX, h },
  };
}
