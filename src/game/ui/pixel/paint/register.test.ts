import { describe, expect, it } from 'vitest';
import { HAT, hatPicture } from '../menuArt';
import { C } from '../palette';
import { BOOK_PALETTE, REGISTER_PALETTE, paintBook } from './book';
import { RING_PAD, RULING_PALETTE, inkDot, inkField, inkRing, paintRuling } from './register';

/** The teacher's register and the academic hat (WP-14, d145). */
describe('the teacher\'s register', () => {
  it('is the song book bound in green: the same places, another cover', () => {
    expect(REGISTER_PALETTE).toHaveLength(BOOK_PALETTE.length);
    const book = paintBook(300, 160);
    const cover = book.pixels[2 * 300 + 150]!;
    // the cover's place is green in the register and blue in the song book; the pages are the same
    const green = REGISTER_PALETTE[cover]!, blue = BOOK_PALETTE[cover]!;
    expect((green >> 8) & 255).toBeGreaterThan(green >> 16);
    expect(blue & 255).toBeGreaterThan((blue >> 8) & 255);
    const page = book.pixels[80 * 300 + 70]!;
    expect(REGISTER_PALETTE[page]).toBe(BOOK_PALETTE[page]);
  });

  it('rules its rows across both pages but not the gutter, and its margin and columns down the page', () => {
    const ruling = paintRuling(200, 100, { rows: [40, 60], from: 10, to: 190, gutter: [95, 105], margin: 20, columns: [150], top: 30, bottom: 70 });
    const at = (x: number, y: number) => ruling.pixels[y * 200 + x]!;
    const row = (y: number, from: number, to: number) => Array.from({ length: to - from }, (_, i) => at(from + i, y));
    expect(row(40, 30, 90).filter((p) => p === 1).length).toBeGreaterThan(40);
    expect(row(40, 96, 105).every((p) => p === 0)).toBe(true);
    expect(row(50, 0, 200).filter((p) => p !== 0)).toEqual(expect.arrayContaining([2, 1]));
    expect(Array.from({ length: 41 }, (_, i) => at(20, 30 + i)).filter((p) => p === 2).length).toBeGreaterThan(25);
    expect(at(20, 20)).toBe(0);
    expect(ruling.pixels.every((p) => p < RULING_PALETTE.length)).toBe(true);
  });

  it('lets a row dip with the page where it bows down into the gutter, and runs straight elsewhere', () => {
    const ruling = paintRuling(200, 100, { rows: [40], from: 10, to: 190, gutter: [95, 105], margin: null, columns: [], top: 30, bottom: 70 });
    const inked = (x: number) => [38, 39, 40, 41, 42, 43, 44].filter((y) => ruling.pixels[y * 200 + x] !== 0);
    // a hand's width from the gutter the row is where it was ruled; at the gutter's edge it has sunk with the page
    expect(Array.from({ length: 40 }, (_, i) => inked(30 + i)).flat().every((y) => y === 40)).toBe(true);
    expect(Math.max(...[92, 93, 94, 106, 107, 108].flatMap(inked))).toBeGreaterThan(40);
  });

  it('draws a box to write in by hand: open corners, its ink red while it is the one being written in', () => {
    const quiet = inkField(60, 24, false), active = inkField(60, 24, true);
    expect({ w: quiet.width, h: quiet.height }).toEqual({ w: 60, h: 24 });
    expect(quiet.pixels[0]).toBe(0);
    expect(quiet.pixels[12 * 60]).toBe(C.ink);
    expect(quiet.pixels[12 * 60 + 30]).toBe(0);
    expect(active.pixels.filter((p) => p === C.redDark).length).toBeGreaterThan(100);
    expect(active.pixels.every((p) => p === 0 || p === C.redDark)).toBe(true);
  });

  it('rings a name in red ink, round and open in the middle', () => {
    const ring = inkRing(40, 16);
    expect(ring.width).toBe(40 + 2 * RING_PAD);
    expect(ring.height).toBe(16 + 2 * RING_PAD);
    expect(ring.pixels.filter((p) => p === C.redDark).length).toBeGreaterThan(60);
    expect(ring.pixels[Math.floor(ring.height / 2) * ring.width + Math.floor(ring.width / 2)]).toBe(0);
    expect(ring.pixels.every((p) => p === 0 || p === C.redDark)).toBe(true);
  });

  it('marks a status with a dot of its colour inside a rim of ink', () => {
    const dot = inkDot(C.purple, 11);
    expect(dot.pixels[5 * 11 + 5]).toBe(C.purple);
    expect(dot.pixels[5 * 11]).toBe(C.ink);
    expect(dot.pixels[0]).toBe(0);
  });
});

describe('the academic hat', () => {
  it('is a dark mortarboard with a gold tassel, its size fitting the scroll\'s head', () => {
    const hat = hatPicture();
    expect({ w: hat.width, h: hat.height }).toEqual(HAT);
    const count = (colour: number) => hat.pixels.filter((p) => p === colour).length;
    expect(count(C.ink)).toBeGreaterThan(20);
    expect(count(C.gold) + count(C.goldDark)).toBeGreaterThan(8);
    expect(count(C.duskLight)).toBeGreaterThan(4);
    // the tassel hangs below the board on the right
    expect(hat.pixels[11 * HAT.w + 14]).toBe(C.gold);
  });
});
