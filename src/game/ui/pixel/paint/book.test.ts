import { describe, expect, it } from 'vitest';
import { ART_DETAIL } from '../../../../core/layout/frame';
import { bookPages } from '../../../../core/layout/bookPages';
import { BOOK_PALETTE, paintBook } from './book';

/** The open book's pages as laid out (`bookPages`) lie on its light paper, clear of the cover, the torn edge and the gutter. */
describe('the open book\'s pages', () => {
  const light = (colour: number) => ((colour >> 16) & 255) * 0.3 + ((colour >> 8) & 255) * 0.59 + (colour & 255) * 0.11 >= 125;
  for (const [w, h] of [[314, 160], [314, 175], [300, 150], [400, 160]] as const) {
    it(`are written on light paper all along their edges, in a book ${w} by ${h} cells`, () => {
      const book = paintBook(w * ART_DETAIL, h * ART_DETAIL);
      const lightAt = (x: number, y: number) => light(BOOK_PALETTE[book.pixels[y * ART_DETAIL * book.width + x * ART_DETAIL]!]!);
      const pages = bookPages({ x: 0, y: 0, w, h });
      for (const page of [pages.left, pages.right]) {
        const edges = [
          Array.from({ length: page.h }, (_, i) => lightAt(page.x, page.y + i)),
          Array.from({ length: page.h }, (_, i) => lightAt(page.x + page.w - 1, page.y + i)),
          Array.from({ length: page.w }, (_, i) => lightAt(page.x + i, page.y)),
          // the foot: the red ribbon lies across the right page's foot, so most of it, not all; the left edge runs along the torn paper
          Array.from({ length: page.w }, (_, i) => lightAt(page.x + i, page.y + page.h - 1)),
        ];
        edges.forEach((edge, i) => expect([i, edge.filter(Boolean).length / edge.length]).toEqual([i, expect.toSatisfy((f: number) => f > 0.8)]));
      }
    });
  }
});
