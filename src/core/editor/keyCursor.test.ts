// Covers ft_1_02d.AC15 (the keyboard cursor of the piece maker).
import { describe, expect, it } from 'vitest';
import { moveBar, moveInTime, movePitch, otherStaff, startKeyCursor, timeStops } from './keyCursor';
import { emptyPiece, type EditorHand, type EditorNote, type EditorPiece } from './model';

const n = (hand: EditorHand, bar: number, start: number, step: EditorNote['step'], octave = 4, length: EditorNote['length'] = 'quarter'): EditorNote => ({
  hand, bar, start, length, step, octave, alter: 0,
});
const piece = (notes: EditorNote[], extra: Partial<EditorPiece> = {}): EditorPiece => ({ ...emptyPiece({ title: 'Keys', hands: 'both', beats: 4, bars: 4 }), notes, ...extra });

describe('the keyboard cursor (ft_1_02d.AC15)', () => {
  it('ft_1_02d.AC15 starts on the middle line of the first staff, at the start of the piece', () => {
    expect(startKeyCursor(piece([]))).toEqual({ hand: 'RH', bar: 0, start: 0, step: 'B', octave: 4 });
    expect(startKeyCursor({ ...piece([]), hands: 'LH' })).toEqual({ hand: 'LH', bar: 0, start: 0, step: 'D', octave: 3 });
  });

  it('ft_1_02d.AC15 stops at every note, chord and rest start, and every selected length in free time', () => {
    // a half at 0, then free time: quarters stop at 960 and 1440
    const p = piece([n('RH', 0, 0, 'C', 4, 'half'), n('RH', 0, 0, 'E', 4, 'half')], { rests: [{ hand: 'RH', bar: 1, start: 480, length: 'quarter' }] });
    expect(timeStops(p, 'RH', 0, 'quarter')).toEqual([0, 960, 1440]);
    expect(timeStops(p, 'RH', 0, 'eighth')).toEqual([0, 960, 1200, 1440, 1680]);
    expect(timeStops(p, 'RH', 1, 'half')).toEqual([0, 480, 960]);
    // an empty bar of wholes is one stop
    expect(timeStops(p, 'LH', 0, 'whole')).toEqual([0]);
  });

  it('ft_1_02d.AC15 left and right go stop by stop, across bar lines, and stay at the ends of the piece', () => {
    const p = piece([n('RH', 0, 0, 'C', 4, 'half')]);
    let c = startKeyCursor(p);
    c = moveInTime(p, c, 1, 'quarter');
    expect(c).toMatchObject({ bar: 0, start: 960 });
    c = moveInTime(p, moveInTime(p, c, 1, 'quarter'), 1, 'quarter');
    expect(c).toMatchObject({ bar: 1, start: 0 });
    expect(moveInTime(p, c, -1, 'quarter')).toMatchObject({ bar: 0, start: 1440 });
    expect(moveInTime(p, startKeyCursor(p), -1, 'quarter')).toEqual(startKeyCursor(p));
    const last = { ...startKeyCursor(p), bar: 3, start: 1440 };
    expect(moveInTime(p, last, 1, 'quarter')).toEqual(last);
  });

  it('ft_1_02d.AC15 Ctrl + left and right jump to bar starts', () => {
    const p = piece([]);
    const c = { ...startKeyCursor(p), bar: 1, start: 960 };
    expect(moveBar(p, c, -1)).toMatchObject({ bar: 1, start: 0 });
    expect(moveBar(p, { ...c, start: 0 }, -1)).toMatchObject({ bar: 0, start: 0 });
    expect(moveBar(p, c, 1)).toMatchObject({ bar: 2, start: 0 });
    expect(moveBar(p, { ...c, bar: 3 }, 1)).toMatchObject({ bar: 3, start: 960 });
  });

  it('ft_1_02d.AC15 up and down go one staff step, with the octave at B and C, and stop at the keyboard ends', () => {
    const c = startKeyCursor(piece([]));
    expect(movePitch(c, 1)).toMatchObject({ step: 'C', octave: 5 });
    expect(movePitch(c, -1)).toMatchObject({ step: 'A', octave: 4 });
    const top = { ...c, step: 'C' as const, octave: 7 };
    expect(movePitch(top, 1)).toEqual(top);
    const bottom = { ...c, step: 'C' as const, octave: 2 };
    expect(movePitch(bottom, -1)).toEqual(bottom);
  });

  it('ft_1_02d.AC15 Ctrl + up or down jumps A2, G3, F4, E5 and round, never onto a ledger line, keeping the time', () => {
    const p = piece([]);
    const at = (hand: EditorHand, step: EditorNote['step'], octave: number) => ({ hand, bar: 2, start: 480, step, octave });
    const c = { ...startKeyCursor(p), bar: 2, start: 480 };
    // up from the treble's middle line: E5, then round to A2, G3, F4
    const up1 = otherStaff(p, c, 'quarter', 1);
    expect(up1).toEqual(at('RH', 'E', 5));
    const up2 = otherStaff(p, up1, 'quarter', 1);
    expect(up2).toEqual(at('LH', 'A', 2));
    const up3 = otherStaff(p, up2, 'quarter', 1);
    expect(up3).toEqual(at('LH', 'G', 3));
    expect(otherStaff(p, up3, 'quarter', 1)).toEqual(at('RH', 'F', 4));
    // down goes the same way back: F4, G3, A2, E5
    expect(otherStaff(p, at('RH', 'F', 4), 'quarter', -1)).toEqual(at('LH', 'G', 3));
    expect(otherStaff(p, at('LH', 'A', 2), 'quarter', -1)).toEqual(at('RH', 'E', 5));
    // middle C on its ledger line under the treble goes to the bass's top space, not a ledger line there
    expect(otherStaff(p, at('RH', 'C', 4), 'quarter', -1)).toEqual(at('LH', 'G', 3));
    expect(otherStaff(p, at('LH', 'C', 4), 'quarter', 1)).toEqual(at('RH', 'F', 4));
    // a piece for one hand jumps between that staff's two spaces only
    expect(otherStaff({ ...p, hands: 'RH' }, at('RH', 'E', 5), 'quarter', 1)).toEqual(at('RH', 'F', 4));
    // inside a whole note of the bass the cursor goes to that note's start, a place it can stop at
    const held = piece([n('LH', 2, 0, 'C', 3, 'whole')]);
    expect(otherStaff(held, at('RH', 'F', 4), 'quarter', -1)).toMatchObject({ hand: 'LH', bar: 2, start: 0 });
  });
});
