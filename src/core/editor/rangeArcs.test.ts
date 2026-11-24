// Covers ft_1_02d.AC36.
import { describe, expect, it } from 'vitest';
import { emptyPiece, type EditorNote, type EditorPiece } from './model';
import { slurBars, tieBars } from './rangeArcs';
import { slursOf } from './slurRules';

const q = (hand: 'RH' | 'LH', bar: number, start: number, step: EditorNote['step'], octave: number): EditorNote => ({ hand, bar, start, length: 'quarter', step, octave, alter: 0 });

/** Bars 0 and 1 of 4/4: C D E F, then G G A A on the right hand; C3 whole notes on the left. */
function piece(): EditorPiece {
  const base = emptyPiece({ title: 'Range', hands: 'both', beats: 4, bars: 4 });
  return {
    ...base,
    notes: [
      q('RH', 0, 0, 'C', 4), q('RH', 0, 480, 'D', 4), q('RH', 0, 960, 'E', 4), q('RH', 0, 1440, 'F', 4),
      q('RH', 1, 0, 'G', 4), q('RH', 1, 480, 'G', 4), q('RH', 1, 960, 'A', 4), q('RH', 1, 1440, 'A', 4),
      { hand: 'LH', bar: 0, start: 0, length: 'whole', step: 'C', octave: 3, alter: 0 },
      { hand: 'LH', bar: 1, start: 0, length: 'whole', step: 'E', octave: 3, alter: 0 },
    ],
  };
}

describe('slurs and ties over selected bars (ft_1_02d.AC36)', () => {
  it('ft_1_02d.AC36 slurs each hand from its first note in the selected bars to its last, with no note picked first', () => {
    const made = slurBars(piece(), { from: 0, to: 1 });
    expect(made.ok).toBe(true);
    if (!made.ok) return;
    const slurs = slursOf(made.piece);
    expect(slurs).toContainEqual({ hand: 'RH', from: { bar: 0, start: 0 }, to: { bar: 1, start: 1440 } });
    expect(slurs).toContainEqual({ hand: 'LH', from: { bar: 0, start: 0 }, to: { bar: 1, start: 0 } });
  });

  it('ft_1_02d.AC36 a slur lying inside the selected bars gives way to the one over them', () => {
    const one = slurBars(piece(), { from: 0, to: 0 });
    if (!one.ok) throw new Error('refused');
    const both = slurBars(one.piece, { from: 0, to: 1 });
    if (!both.ok) throw new Error('refused');
    expect(slursOf(both.piece).filter((s) => s.hand === 'RH')).toEqual([{ hand: 'RH', from: { bar: 0, start: 0 }, to: { bar: 1, start: 1440 } }]);
  });

  it('ft_1_02d.AC36 a hand with one note in the bars gets no slur, and bars with none are refused', () => {
    const one = slurBars(piece(), { from: 0, to: 0 });
    if (!one.ok) throw new Error('refused');
    expect(slursOf(one.piece).some((s) => s.hand === 'LH')).toBe(false);
    expect(slurBars(piece(), { from: 2, to: 3 }).ok).toBe(false);
  });

  it('ft_1_02d.AC36 ties every repeated note inside the selected bars, and none outside them', () => {
    const p = { ...piece(), notes: [...piece().notes, q('RH', 2, 0, 'A', 4)] };
    const made = tieBars(p, { from: 1, to: 1 });
    expect(made.ok).toBe(true);
    if (!made.ok) return;
    const tied = made.piece.notes.filter((n) => n.tieNext).map((n) => `${n.step}${n.bar}:${n.start}`);
    // G to G and A to A in bar 1; the last A of bar 1 is not tied into bar 2, which is outside the selection
    expect(tied).toEqual(['G1:0', 'A1:960']);
  });

  it('ft_1_02d.AC36 bars with nothing to tie are refused', () => {
    expect(tieBars(piece(), { from: 0, to: 0 })).toEqual({ ok: false, reason: 'tie-none' });
  });
});
