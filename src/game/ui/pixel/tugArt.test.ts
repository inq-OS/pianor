// Covers ft_1_21.AC7 (the standing is shown at all times as one marker between the two; the look is the painter's).
import { describe, expect, it } from 'vitest';
import { BAND_ROWS } from '../../../core/layout/band';
import { ropeTop, TUG, tugBoard } from '../../../core/layout/tug';
import { inkCount } from './bitmap';
import { C } from './palette';
import { talkColour } from './talkArt';
import { CHARACTER_FACES, outlinedNote, RAG_INK, ROPE_INK, TOKEN_SIZE, tugBoardPicture, tugRag, tugToken } from './tugArt';

const ENDS = { student: C.white, character: C.leafLight };
const at = (b: { width: number; pixels: Uint8Array }, x: number, y: number) => b.pixels[y * b.width + x]!;

describe('the tug\'s look (ft_1_21.AC7, CT-P6)', () => {
  it('ft_1_21.AC7 the board fills the band and carries the rope from token to token', () => {
    const picture = tugBoardPicture(320, 3, ENDS);
    expect([picture.width, picture.height]).toEqual([320, BAND_ROWS]);
    const board = tugBoard(320, 3);
    for (const x of [board.rope.x0 + 5, 160, board.rope.x1 - 5]) {
      const top = ropeTop(board, x);
      expect(at(picture, x, top - 1)).toBe(ROPE_INK.line);
      expect(ROPE_INK.hemp).toContain(at(picture, x, top + 1));
      expect(at(picture, x, top + TUG.ropeThick)).toBe(ROPE_INK.line);
    }
  });

  it('ft_1_21.AC7 each end of the board is starred in the colour of the player who wins there', () => {
    const picture = tugBoardPicture(320, 3, ENDS);
    const board = tugBoard(320, 3);
    const starTop = (x: number) => at(picture, x, TUG.chalkY - 1);
    expect(starTop(board.places[0]!)).toBe(C.white);
    expect(starTop(board.places[6]!)).toBe(C.leafLight);
  });

  it('the rag is red cloth in two looks of one size', () => {
    const [a, b] = [tugRag(0), tugRag(1)];
    expect([a.width, a.height]).toEqual([b.width, b.height]);
    expect([...a.pixels].some((p) => p === RAG_INK.cloth[1])).toBe(true);
    expect(a.pixels).not.toEqual(b.pixels);
  });

  it('ft_1_21.AC7 the token whose turn it is is ringed in its player\'s colour', () => {
    const student = tugToken('student', true), waiting = tugToken('student', false);
    expect([student.width, student.height]).toEqual([TOKEN_SIZE, TOKEN_SIZE]);
    const ring = (b: typeof student) => at(b, Math.floor(TOKEN_SIZE / 2), 2);
    expect(ring(student)).toBe(talkColour('student'));
    expect(ring(waiting)).not.toBe(talkColour('student'));
    const puuvaim = tugToken({ character: 'puuvaim' }, true);
    expect(ring(puuvaim)).toBe(talkColour('character', 'puuvaim'));
  });

  it('a character with a face of its own shows it; one without shows a note in its colour', () => {
    expect(CHARACTER_FACES.puuvaim).toBeDefined();
    const stranger = tugToken({ character: 'nobody' }, false);
    expect([...stranger.pixels]).toContain(talkColour('character', 'nobody'));
    const puuvaim = tugToken({ character: 'puuvaim' }, false);
    expect([...puuvaim.pixels]).toContain(C.cream); // his eyes
  });

  it('the note over a turn has an ink line round it', () => {
    const note = outlinedNote(C.white);
    expect(inkCount(note)).toBeGreaterThan(20);
    expect([...note.pixels]).toContain(C.ink);
    expect(at(note, 0, 0)).toBe(0);
  });
});
