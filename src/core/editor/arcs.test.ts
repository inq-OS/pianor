// Covers core_09.AC13 and core_09.AC30 as one tool (ties and slurs merged into one item).
import { describe, expect, it } from 'vitest';
import { arcInto, toggleArc } from './arcs';
import { emptyPiece, type Edit, type EditorHand, type EditorNote, type EditorPiece, type NoteRef } from './model';
import { slursOf } from './slurRules';

const n = (hand: EditorHand, bar: number, start: number, step: EditorNote['step'], octave = 4): EditorNote => ({ hand, bar, start, length: 'quarter', step, octave, alter: 0 });
/** Right hand: C C E G in bar 0. */
const piece: EditorPiece = { ...emptyPiece({ title: 'Arcs', hands: 'both', beats: 4, bars: 2 }), notes: [n('RH', 0, 0, 'C'), n('RH', 0, 480, 'C'), n('RH', 0, 960, 'E'), n('RH', 0, 1440, 'G')] };
const at = (start: number, step: NoteRef['step']): NoteRef => ({ hand: 'RH', bar: 0, start, step, octave: 4 });

function made(edit: Edit): EditorPiece {
  if (!edit.ok) throw new Error(`refused: ${edit.reason}`);
  return edit.piece;
}
const tied = (p: EditorPiece) => p.notes.filter((x) => x.tieNext).map((x) => `${x.start}:${x.step}`);

describe('one tool for ties and slurs (core_09.AC13, core_09.AC30)', () => {
  it('core_09.AC13 a press ties to the same key right after, and a second press takes the tie away', () => {
    const once = made(toggleArc(piece, at(0, 'C')));
    expect(tied(once)).toEqual(['0:C']);
    expect(slursOf(once)).toEqual([]);
    expect(tied(made(toggleArc(once, at(0, 'C'))))).toEqual([]);
  });

  it('core_09.AC30 with another key after it, a press slurs to that note, and a second press takes the slur away', () => {
    const once = made(toggleArc(piece, at(480, 'C')));
    expect(tied(once)).toEqual([]);
    expect(slursOf(once)).toHaveLength(1);
    expect(slursOf(made(toggleArc(once, at(480, 'C'))))).toEqual([]);
  });

  it('core_09.AC13 core_09.AC30 a picked end note makes a tie when it is the same key right after, else a slur', () => {
    expect(tied(made(arcInto(piece, at(0, 'C'), at(480, 'C'))))).toEqual(['0:C']);
    const slurred = made(arcInto(piece, at(0, 'C'), at(1440, 'G')));
    expect(tied(slurred)).toEqual([]);
    expect(slursOf(slurred)[0]).toMatchObject({ from: { bar: 0, start: 0 }, to: { bar: 0, start: 1440 } });
    // a note of the other hand is no end for either
    expect(arcInto({ ...piece, notes: [...piece.notes, n('LH', 0, 960, 'C', 3)] }, at(0, 'C'), { hand: 'LH', bar: 0, start: 960, step: 'C', octave: 3 }).ok).toBe(false);
  });
});
