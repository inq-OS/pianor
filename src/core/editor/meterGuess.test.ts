// Covers ft_1_02d.AC21 (the A time on the start screen: the first bar sets the time).
import { describe, expect, it } from 'vitest';
import { beatsFit, confirmBeats, firstBarFull, guessBeats } from './meterGuess';
import { emptyPiece, type EditorNote, type EditorPiece } from './model';

const n = (bar: number, start: number, length: EditorNote['length'] = 'quarter', hand: EditorNote['hand'] = 'RH'): EditorNote => ({ hand, bar, start, length, step: 'C', octave: hand === 'RH' ? 4 : 3, alter: 0 });
const piece = (notes: EditorNote[], extra: Partial<EditorPiece> = {}): EditorPiece => ({ ...emptyPiece({ title: 'A', hands: 'both', beats: 4, bars: 4 }), notes, ...extra });

describe('the A time (ft_1_02d.AC21)', () => {
  it('ft_1_02d.AC21 the first bar\'s length is the time: three quarters 3/4, a half 2/4, a part beat counts as one', () => {
    expect(guessBeats(piece([]))).toBeNull();
    expect(guessBeats(piece([n(0, 0), n(0, 480), n(0, 960)]))).toBe(3);
    expect(guessBeats(piece([n(0, 0, 'half')]))).toBe(2);
    expect(guessBeats(piece([n(0, 0, 'quarter')]))).toBe(2);
    expect(guessBeats(piece([n(0, 0, 'dottedHalf'), n(0, 1440, 'eighth')]))).toBe(4);
    // the longer hand and a placed rest count too
    expect(guessBeats(piece([n(0, 0)], { rests: [{ hand: 'LH', bar: 0, start: 0, length: 'half' }, { hand: 'LH', bar: 0, start: 960, length: 'quarter' }] }))).toBe(3);
    expect(firstBarFull(piece([n(0, 0, 'whole')]))).toBe(true);
    expect(firstBarFull(piece([n(0, 0, 'dottedHalf')]))).toBe(false);
  });

  it('ft_1_02d.AC21 the confirmed time keeps the first bar; one the notes do not fit in, or notes past the first bar, are refused', () => {
    const three = piece([n(0, 0), n(0, 480), n(0, 960)]);
    const made = confirmBeats(three, 3);
    expect(made.ok && made.piece.beats).toBe(3);
    expect(made.ok && made.piece.notes).toEqual(three.notes);
    expect(beatsFit(three, 2)).toBe(false);
    expect(confirmBeats(three, 2)).toEqual({ ok: false, reason: 'not-empty' });
    expect(beatsFit(piece([n(0, 0), n(1, 0)]), 4)).toBe(false);
  });
});
