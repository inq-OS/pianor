// Covers ft_1_02d.AC13 and ft_1_30.AC7 (AUTO fingers: the cheapest fingering, the level's hand position preferred).
import { describe, expect, it } from 'vitest';
import { autoFingers } from './fingers';
import { emptyPiece, placeNote, setFinger, type EditorNote, type EditorPiece } from './model';

const table = { fingerings: { RH: { C4: 1, D4: 2, E4: 3 }, LH: { C3: 5 } } };
const note = (over: Partial<EditorNote>): EditorNote => ({ hand: 'RH', bar: 0, start: 0, length: 'quarter', step: 'C', octave: 4, alter: 0, ...over });
const withNotes = (notes: EditorNote[]): EditorPiece => ({ ...emptyPiece({ title: 'T', hands: 'both', beats: 4, bars: 2 }), notes });

describe('AUTO fingers (ft_1_02d.AC13)', () => {
  it('fills the finger of every note, the level’s hand position first, and notes outside it too (ft_1_30.AC7)', () => {
    const p = withNotes([note({ start: 0, step: 'C' }), note({ start: 480, step: 'D' }), note({ start: 960, step: 'E' }), note({ start: 1440, step: 'G' })]);
    const result = autoFingers(p, table);
    expect(result.piece.notes.map((n) => n.finger)).toEqual([1, 2, 3, 5]);
    expect(result.filled).toBe(4);
    expect(result.unfilled).toBe(0);
  });

  it('passes the thumb under in a scale that leaves the five-finger position (ft_1_30.AC7)', () => {
    const steps = ['C', 'D', 'E', 'F', 'G', 'A', 'B'] as const;
    const scale = [...steps.map((step, i) => note({ bar: Math.floor(i / 4), start: (i % 4) * 480, step })), note({ bar: 1, start: 1440, step: 'C', octave: 5 })];
    expect(autoFingers(withNotes(scale), { fingerings: {} }).piece.notes.map((n) => n.finger)).toEqual([1, 2, 3, 1, 2, 3, 4, 5]);
  });

  it('counts the notes of a chord of more than five keys, which no hand can finger', () => {
    const chord = (['C', 'D', 'E', 'F', 'G', 'A'] as const).map((step) => note({ step, length: 'whole' }));
    const result = autoFingers(withNotes(chord), table);
    expect(result.filled).toBe(0);
    expect(result.unfilled).toBe(6);
  });

  it('keeps a finger the author set, and never changes the notes', () => {
    const p = withNotes([note({ step: 'C', finger: 4 })]);
    const result = autoFingers(p, table);
    expect(result.piece.notes[0]!.finger).toBe(4);
    expect(result.filled).toBe(0);
  });

  it('fingers a note with an accidental too, keeping the thumb off the black key (ft_1_30.AC7)', () => {
    const p = withNotes([note({ start: 0, step: 'D' }), note({ start: 480, step: 'E' }), note({ start: 960, step: 'F', alter: 1 }), note({ start: 1440, step: 'G' })]);
    const result = autoFingers(p, { fingerings: {} });
    expect(result.piece.notes[2]!.finger).toBeDefined();
    expect(result.piece.notes[2]!.finger).not.toBe(1);
    expect(result.unfilled).toBe(0);
  });

  it('fits the rest of the line around a finger the author wrote (ft_1_30.AC7)', () => {
    const p = withNotes([note({ start: 0, step: 'C', finger: 2 }), note({ start: 480, step: 'D' }), note({ start: 960, step: 'E' })]);
    expect(autoFingers(p, { fingerings: {} }).piece.notes.map((n) => n.finger)).toEqual([2, 3, 4]);
  });

  it('uses each hand its own table, and fills every head of a chord', () => {
    const p = withNotes([note({ hand: 'LH', bar: 0, start: 0, step: 'C', octave: 3 }), note({ hand: 'RH', start: 0, step: 'C', octave: 4 }), note({ hand: 'RH', start: 0, step: 'E', octave: 4 })]);
    const result = autoFingers(p, table);
    expect(result.piece.notes.map((n) => n.finger)).toEqual([5, 1, 3]);
  });

  it('works on a piece made by the editor functions too', () => {
    const edit = placeNote(emptyPiece({ title: 'T', hands: 'RH', beats: 4, bars: 1 }), { hand: 'RH', bar: 0, start: 0, length: 'quarter', step: 'E', octave: 4 });
    expect(edit.ok).toBe(true);
    expect(autoFingers(edit.ok ? edit.piece : emptyPiece({ title: 'T', hands: 'RH', beats: 4, bars: 1 }), table).piece.notes[0]!.finger).toBe(3);
  });
});

describe('AUTO fingers fitted again by bar (ft_1_02d.AC23)', () => {
  const steps = ['C', 'D', 'E', 'F'] as const;
  const bar = (b: number, over: Partial<EditorNote> = {}): EditorNote[] => steps.map((step, i) => note({ bar: b, start: i * 480, step, ...over }));

  it('marks the fingers AUTO wrote as its own, and keeps the author’s unmarked', () => {
    const p = withNotes([note({ start: 0, step: 'C', finger: 2 }), note({ start: 480, step: 'D' })]);
    const notes = autoFingers(p, { fingerings: {} }).piece.notes;
    expect(notes[0]!.fingerAuto).toBeUndefined();
    expect(notes[1]).toMatchObject({ finger: 3, fingerAuto: true });
  });

  it('fits AUTO’s fingers of one bar again around a finger the author changed, and leaves the other bars', () => {
    const filled = autoFingers(withNotes([...bar(0), ...bar(1)]), { fingerings: {} }).piece;
    expect(filled.notes.map((n) => n.finger)).toEqual([1, 2, 3, 4, 1, 2, 3, 4]);
    const edit = setFinger(filled, filled.notes[0]!, 2);
    const refit = autoFingers(edit.ok ? edit.piece : filled, { fingerings: {} }, { hand: 'RH', bar: 0 });
    const fingers = refit.piece.notes.map((n) => n.finger);
    expect(fingers.slice(4)).toEqual([1, 2, 3, 4]);
    expect(refit.piece.notes[0]).toMatchObject({ finger: 2 });
    expect(refit.piece.notes[0]!.fingerAuto).toBeUndefined();
    expect(refit.changed).toBeGreaterThan(0);
    // the same fingers a fresh AUTO gives with the author's 2 and the next bar as they stand
    const fresh = withNotes([note({ step: 'C', finger: 2 }), ...bar(0).slice(1), ...bar(1).map((n, i) => ({ ...n, finger: i + 1 }))]);
    expect(fingers).toEqual(autoFingers(fresh, { fingerings: {} }).piece.notes.map((n) => n.finger));
  });

  it('never changes the author’s fingers in that bar, nor fills a note left without one', () => {
    const p = withNotes([note({ start: 0, step: 'C', finger: 1 }), note({ start: 480, step: 'D', finger: 4 }), note({ start: 960, step: 'E', finger: 3, fingerAuto: true }), note({ start: 1440, step: 'F' })]);
    const refit = autoFingers(p, { fingerings: {} }, { hand: 'RH', bar: 0 });
    expect(refit.piece.notes.map((n) => n.finger).filter((_, i) => i !== 2)).toEqual([1, 4, undefined]);
    expect(refit.piece.notes[2]!.fingerAuto).toBe(true);
    expect(refit.filled).toBe(0);
  });

  it('a cleared finger stays empty while AUTO’s others in the bar are fitted again', () => {
    const filled = autoFingers(withNotes(bar(0)), { fingerings: {} }).piece;
    const edit = setFinger(filled, filled.notes[1]!, null);
    const refit = autoFingers(edit.ok ? edit.piece : filled, { fingerings: {} }, { hand: 'RH', bar: 0 });
    expect(refit.piece.notes[1]!.finger).toBeUndefined();
    expect(refit.piece.notes[1]!.fingerAuto).toBeUndefined();
    expect(refit.piece.notes.filter((_, i) => i !== 1).every((n) => n.finger !== undefined && n.fingerAuto === true)).toBe(true);
  });

  it('leaves the other hand alone', () => {
    const p = withNotes([...bar(0, { finger: 3, fingerAuto: true }), note({ hand: 'LH', step: 'C', octave: 3, finger: 4, fingerAuto: true })]);
    const refit = autoFingers(p, { fingerings: {} }, { hand: 'RH', bar: 0 });
    expect(refit.piece.notes.at(-1)!.finger).toBe(4);
  });

  it('AUTO on the whole piece fits its own fingers again too, around the author’s', () => {
    const p = withNotes([note({ start: 0, step: 'C', finger: 2 }), note({ start: 480, step: 'D', finger: 1, fingerAuto: true })]);
    const result = autoFingers(p, { fingerings: {} });
    expect(result.piece.notes.map((n) => n.finger)).toEqual([2, 3]);
    expect(result.changed).toBe(1);
  });
});
