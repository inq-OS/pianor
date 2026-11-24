import { describe, expect, it } from 'vitest';
import type { Bitmap } from '../bitmap';
import { BOOK_PALETTE, paintBook, paintBookmark, paintCover, paintFolio, paintPageTurn, pageCorners } from './book';
import { CABINET_PALETTE, drawerLabelBox, paintCabinet, paintDrawerFront, paintDrawerInside, paintIndexCard } from './cabinet';
import { CARD_PALETTE, paintCard, paintRibbon } from './card';
import { DESK_PALETTE, paintBeam, paintDesk } from './desk';
import { DOOR_PALETTE, paintDoor, paintPageCorner } from './door';

/** Every pixel of `bitmap` is a place of `palette` (0 is left unpainted). */
const inPalette = (bitmap: Bitmap, palette: readonly number[]) => bitmap.pixels.every((p) => p < palette.length);
const painted = (bitmap: Bitmap) => bitmap.pixels.filter((p) => p !== 0).length / bitmap.pixels.length;
const same = (a: Bitmap, b: Bitmap) => a.pixels.every((p, i) => p === b.pixels[i]);

describe('the desk, the paper and the book (the screens overhaul)', () => {
  it('paints the desk and the beam edge to edge, in their own colours, the same each time', () => {
    for (const [w, h] of [[640, 314], [600, 280]] as const) {
      const desk = paintDesk(w, h, 46);
      expect(painted(desk)).toBe(1);
      expect(inPalette(desk, DESK_PALETTE)).toBe(true);
      expect(same(desk, paintDesk(w, h, 46))).toBe(true);
    }
    const beam = paintBeam(640, 46, 6);
    expect(painted(beam)).toBe(1);
    expect(inPalette(beam, DESK_PALETTE)).toBe(true);
  });

  it('paints the card, its ribbon and the open book in their own colours', () => {
    expect(inPalette(paintCard(600, 300, 2), CARD_PALETTE)).toBe(true);
    expect(painted(paintCard(600, 300, 2))).toBeGreaterThan(0.9);
    expect(painted(paintRibbon(200, 30))).toBeGreaterThan(0.5);
    const book = paintBook(628, 260);
    expect(inPalette(book, BOOK_PALETTE)).toBe(true);
    expect(painted(book)).toBe(1);
  });

  it('paints the catalogue: a labelled front differs from a blank one and lightens when pulled', () => {
    const w = 80, h = 50;
    const labelled = paintDrawerFront(w, h, true), blank = paintDrawerFront(w, h, false), pulled = paintDrawerFront(w, h, true, true);
    for (const b of [labelled, blank, pulled, paintCabinet(600, 200), paintDrawerInside(600, 200), paintIndexCard(560, 30, true), paintIndexCard(560, 30, false)]) {
      expect(inPalette(b, CABINET_PALETTE)).toBe(true);
    }
    expect(same(labelled, blank)).toBe(false);
    expect(same(labelled, pulled)).toBe(false);
    const box = drawerLabelBox(w);
    expect(box.x).toBeGreaterThanOrEqual(2);
    expect(box.x + box.w).toBeLessThanOrEqual(w - 2);
  });

  it('paints the door and the page corner, each changing under the pointer', () => {
    for (const open of [false, true]) {
      expect(inPalette(paintDoor(60, 96, open), DOOR_PALETTE)).toBe(true);
      expect(inPalette(paintPageCorner(56, 50, open), DOOR_PALETTE)).toBe(true);
    }
    expect(same(paintDoor(60, 96), paintDoor(60, 96, true))).toBe(false);
    expect(same(paintPageCorner(56, 50), paintPageCorner(56, 50, true))).toBe(false);
  });

  it('paints the song book\'s page numbers, bookmarks, turning corner and closed cover in the book\'s colours (ft_1_12.AC12, ft_1_07)', () => {
    // a number is wider for each numeral, and two numbers differ
    expect(paintFolio(12).width).toBeGreaterThan(paintFolio(1).width);
    expect(same(paintFolio(3), paintFolio(4))).toBe(false);
    for (let n = 0; n < 10; n++) expect(inPalette(paintFolio(n), BOOK_PALETTE)).toBe(true);
    // the corner rolls up further under the pointer: more of it painted
    const rest = paintPageTurn(34, false), lifted = paintPageTurn(34, true);
    expect(painted(lifted)).toBeGreaterThan(painted(rest));
    expect(inPalette(lifted, BOOK_PALETTE)).toBe(true);
    // the corner lies on the page's foot, inside the cover
    const corners = pageCorners(628, 300);
    expect(corners.right.x).toBeLessThan(628);
    expect(corners.left.y).toBe(corners.right.y);
    // each bookmark is its own silk, the open one brighter
    const marks = [0, 1, 2, 3].map((m) => paintBookmark(m, 60, 38, true));
    marks.forEach((b) => expect(inPalette(b, BOOK_PALETTE)).toBe(true));
    expect(same(marks[0]!, marks[1]!)).toBe(false);
    expect(same(paintBookmark(1, 32, 38, true), paintBookmark(1, 32, 38, false))).toBe(false);
    // the cover leaves its name plate the book's palest paper
    const plate = { x: 120, y: 80, w: 300, h: 60 };
    const cover = paintCover(500, 300, plate);
    expect(inPalette(cover, BOOK_PALETTE)).toBe(true);
    const page = cover.pixels[(plate.y + 30) * 500 + plate.x + 150]!;
    expect(BOOK_PALETTE[page]! >> 16).toBeGreaterThan(0xd0);
  });
});
