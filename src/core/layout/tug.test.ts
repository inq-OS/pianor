// Covers ft_1_21.AC7 (the standing is shown at all times as one marker between the two; the look is the painter's).
import { describe, expect, it } from 'vitest';
import { BOARD_ROWS } from './board';
import { chalkOf, ragPlace, risingNotes, ropeTop, TUG, tugBoard, turnNoteBob } from './tug';

const BOARD = tugBoard(320, 3);

describe('the tug\'s board (ft_1_21.AC7, CT-P6 look)', () => {
  it('ft_1_21.AC7 the student\'s token stands on the left, the character\'s on the right, the rope between them', () => {
    expect(BOARD.student.x).toBeLessThan(BOARD.rope.x0 + TUG.ropeUnder + 1);
    expect(BOARD.character.x).toBeGreaterThan(BOARD.rope.x1 - TUG.ropeUnder - 1);
    expect(BOARD.student.y).toBe(BOARD.character.y);
    expect(BOARD.student.x + BOARD.character.x).toBe(320);
  });

  it('ft_1_21.AC7 there is a place for every standing, evenly apart, the start in the middle of the board', () => {
    expect(BOARD.places).toHaveLength(7);
    expect(BOARD.places[3]).toBe(160);
    const gaps = BOARD.places.slice(1).map((x, i) => x - BOARD.places[i]!);
    expect(Math.max(...gaps) - Math.min(...gaps)).toBeLessThanOrEqual(1);
    expect(BOARD.places[0]).toBeGreaterThan(BOARD.rope.x0);
    expect(BOARD.places[6]).toBeLessThan(BOARD.rope.x1);
  });

  it('ft_1_21.AC7 the rag starts in the middle and the student\'s wins pull it toward their own end, as in a tug of war', () => {
    expect(ragPlace(BOARD, 0).x).toBe(160);
    expect(ragPlace(BOARD, 1).x).toBeLessThan(160);
    expect(ragPlace(BOARD, 3).x).toBe(BOARD.places[0]);
    expect(ragPlace(BOARD, -3).x).toBe(BOARD.places[6]);
    expect(ragPlace(BOARD, 2).y).toBe(ropeTop(BOARD, ragPlace(BOARD, 2).x));
  });

  it('a standing beyond the steps, or a tug of no steps, is refused', () => {
    expect(() => ragPlace(BOARD, 4)).toThrow(RangeError);
    expect(() => ragPlace(BOARD, 0.5)).toThrow(RangeError);
    expect(() => tugBoard(320, 0)).toThrow(RangeError);
  });

  it('the rope sags in the middle and its ends sit at its top', () => {
    expect(ropeTop(BOARD, BOARD.rope.x0)).toBe(TUG.ropeY);
    expect(ropeTop(BOARD, BOARD.rope.x1)).toBe(TUG.ropeY);
    expect(ropeTop(BOARD, 160)).toBe(TUG.ropeY + TUG.sag);
  });

  it('the chalk marks the middle and both ends apart from the steps, and fits in the band', () => {
    expect(BOARD.places.map((_, i) => chalkOf(BOARD, i))).toEqual(['end', 'step', 'step', 'middle', 'step', 'step', 'end']);
    expect(TUG.chalkY + TUG.chalkLong).toBeLessThanOrEqual(BOARD_ROWS);
  });

  it('a wider board spreads its places, a narrower one keeps them on the rope', () => {
    for (const width of [240, 320, 480]) {
      const board = tugBoard(width, 3);
      expect(board.places[3]).toBe(width / 2);
      expect(board.places[0]).toBeGreaterThan(board.rope.x0);
    }
  });
});

describe('what moves on the tug', () => {
  it('the rising notes go up and sway, one after another, and are hidden only between two rises', () => {
    const at0 = risingNotes(0), later = risingNotes(300);
    expect(at0).toHaveLength(3);
    expect(new Set(at0.map((n) => n.dy)).size).toBe(3);
    expect(new Set(at0.map((n) => n.dx)).size).toBeGreaterThan(1);
    later.forEach((n, i) => { if (n.shown && at0[i]!.shown && n.dy !== at0[i]!.dy) expect(n.dy).toBeLessThan(at0[i]!.dy); });
    for (let ms = 0; ms < 3000; ms += 100) {
      const notes = risingNotes(ms);
      expect(notes.some((n) => n.shown)).toBe(true);
      for (const n of notes) { expect(n.dy).toBeLessThanOrEqual(0); expect(n.dy).toBeGreaterThanOrEqual(-18); }
    }
    expect(risingNotes(-500)).toEqual(risingNotes(1000));
    // a drift carries them sideways as they rise
    const drifting = risingNotes(1000, 14), still = risingNotes(1000, 0);
    drifting.forEach((n, i) => expect(n.dx).toBeGreaterThanOrEqual(still[i]!.dx));
  });

  it('the turn\'s note bobs one cell', () => {
    expect([0, 200, 400, 600].map((ms) => turnNoteBob(ms))).toEqual([0, 0, -1, -1]);
  });
});
