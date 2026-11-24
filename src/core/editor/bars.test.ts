// Covers ft_1_02d.AC28. Covers the bar editing of the piece editor: copy, cut, paste, drag-repeat, replace, clear and move by step or octave.
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { clearBars, copyBars, cutBars, insertBars, insertBlankBars, isValidRange, moveBars, pasteAt, pasteSpan, replaceBars, type BarRange } from './bars';
import { MAX_BARS, emptyPiece, pieceProblem, type Edit, type EditorNote, type EditorPiece } from './model';

const piece = (over: Partial<EditorPiece> = {}): EditorPiece => ({ ...emptyPiece({ title: 'Test', hands: 'RH', beats: 4, bars: 8 }), ...over });
const note = (over: Partial<EditorNote> = {}): EditorNote => ({ hand: 'RH', bar: 0, start: 0, length: 'quarter', step: 'C', octave: 4, alter: 0, ...over });
const ok = (edit: Edit): EditorPiece => {
  if (!edit.ok) throw new Error(`refused: ${edit.reason}`);
  return edit.piece;
};
const range = (from: number, to = from): BarRange => ({ from, to });
const sorted = (notes: EditorNote[]) => [...notes].sort((a, b) => a.bar - b.bar || a.start - b.start || a.octave - b.octave || a.step.localeCompare(b.step));

describe('copying bars', () => {
  it('copies the notes of the range, counted from its first bar, and leaves the piece as it was', () => {
    const p = piece({ notes: [note({ bar: 2 }), note({ bar: 3, step: 'E' }), note({ bar: 5 })] });
    const clip = copyBars(p, range(2, 3));
    expect(clip.bars).toBe(2);
    expect(clip.notes).toEqual([note({ bar: 0 }), note({ bar: 1, step: 'E' })]);
    expect(p.notes).toHaveLength(3);
  });

  it('validates a range against the piece', () => {
    expect(isValidRange(piece(), range(0, 7))).toBe(true);
    expect(isValidRange(piece(), range(3, 2))).toBe(false);
    expect(isValidRange(piece(), range(0, 8))).toBe(false);
  });
});

describe('cutting bars', () => {
  it('takes the cut bars out, so the later bars move back and the piece gets shorter', () => {
    const p = piece({ notes: [note({ bar: 0 }), note({ bar: 1 }), note({ bar: 3, step: 'G' })] });
    const { clip, piece: after } = cutBars(p, range(1, 2));
    expect(after.bars).toBe(6);
    expect(after.notes).toEqual([note({ bar: 0 }), note({ bar: 1, step: 'G' })]);
    expect(clip.bars).toBe(2);
    expect(clip.notes).toEqual([note({ bar: 0 })]);
  });

  it('never leaves fewer than 4 bars: empty bars are added at the end', () => {
    const p = piece({ bars: 4, notes: [note({ bar: 0 }), note({ bar: 3, step: 'G' })] });
    const { piece: after } = cutBars(p, range(1, 2));
    expect(after.bars).toBe(4);
    expect(after.notes).toEqual([note({ bar: 0 }), note({ bar: 1, step: 'G' })]);
  });

  it('a cut of bars with no notes still takes them out', () => {
    const p = piece({ notes: [note({ bar: 0 }), note({ bar: 5 })] });
    const { piece: after } = cutBars(p, range(3));
    expect(after.bars).toBe(7);
    expect(after.notes).toEqual([note({ bar: 0 }), note({ bar: 4 })]);
  });

  it('inserting the clip where it was cut brings the notes back', () => {
    const p = piece({ notes: [note({ bar: 1 }), note({ bar: 2, step: 'D' }), note({ bar: 4, step: 'A' })] });
    const { clip, piece: cut } = cutBars(p, range(1, 2));
    expect(sorted(ok(insertBars(cut, 1, clip)).notes)).toEqual(sorted(p.notes));
  });

  it('property: cut then insert at the same bar gives back the same notes', () => {
    fc.assert(fc.property(
      fc.array(fc.integer({ min: 0, max: 7 }), { maxLength: 8 }),
      fc.integer({ min: 0, max: 7 }),
      fc.integer({ min: 0, max: 7 }),
      (bars, a, b) => {
        const p = piece({ notes: [...new Set(bars)].map((bar) => note({ bar })) });
        const r = range(Math.min(a, b), Math.max(a, b));
        const { clip, piece: cut } = cutBars(p, r);
        expect(cut.bars).toBe(Math.max(4, p.bars - (r.to - r.from + 1)));
        const back = ok(insertBars(cut, r.from, clip));
        expect(sorted(back.notes)).toEqual(sorted(p.notes));
      },
    ));
  });

  it('moves repeat signs after the cut back, and drops a repeat whose start or end was cut', () => {
    const p = piece({ notes: [note({ bar: 0 })], repeats: [{ startBar: 0, endBar: 3 }, { startBar: 4, endBar: 5 }, { startBar: 6, endBar: 7 }] });
    const { piece: after } = cutBars(p, range(4));
    expect(after.repeats).toEqual([{ startBar: 0, endBar: 3 }, { startBar: 5, endBar: 6 }]);
  });
});

describe('inserting blank bars', () => {
  it('puts empty bars before a bar; the later bars move forward into the empty bars at the end', () => {
    const p = piece({ notes: [note({ bar: 0 }), note({ bar: 1, step: 'E' })] });
    const after = ok(insertBlankBars(p, 1, 2));
    expect(after.bars).toBe(8);
    expect(after.notes).toEqual([note({ bar: 0 }), note({ bar: 3, step: 'E' })]);
  });

  it('makes the piece longer only when its content needs the room', () => {
    const p = piece({ notes: [note({ bar: 0 }), note({ bar: 7, step: 'E' })] });
    const after = ok(insertBlankBars(p, 1, 1));
    expect(after.bars).toBe(9);
    expect(after.notes).toEqual([note({ bar: 0 }), note({ bar: 8, step: 'E' })]);
  });

  it('refuses past the longest piece, with a reason', () => {
    const p = piece({ bars: MAX_BARS, notes: [note({ bar: MAX_BARS - 1 })] });
    const edit = insertBlankBars(p, 0, 1);
    expect(edit.ok).toBe(false);
    if (!edit.ok) expect(edit.reason).toBe('bars-full');
  });

  it('a repeat on the empty bars at the end keeps its bars: the piece gets longer for it', () => {
    const p = piece({ notes: [0, 1, 2, 3, 4, 5, 6].map((bar) => note({ bar })), repeats: [{ startBar: 0, endBar: 7 }] });
    const after = ok(insertBlankBars(p, 2, 1));
    expect(after.bars).toBe(9);
    expect(after.repeats).toEqual([{ startBar: 0, endBar: 8 }]);
  });

  it('pasting a longer clip over bars moves a later repeat on, and the piece grows to keep it', () => {
    const p = piece({ notes: [note({ bar: 0 })], repeats: [{ startBar: 6, endBar: 7 }] });
    const clip = copyBars(piece({ notes: [note({ bar: 0 }), note({ bar: 2 })] }), range(0, 2));
    const after = ok(replaceBars(p, range(1), clip));
    expect(after.repeats).toEqual([{ startBar: 8, endBar: 9 }]);
    expect(after.bars).toBe(10);
  });

  it('pasting over bars of the same length keeps the repeat signs where they were', () => {
    const p = piece({ notes: [note({ bar: 0 }), note({ bar: 3, step: 'G' })], repeats: [{ startBar: 0, endBar: 1 }] });
    const after = ok(replaceBars(p, range(1), copyBars(p, range(3))));
    expect(after.repeats).toEqual([{ startBar: 0, endBar: 1 }]);
  });

  it('moves repeat signs with their bars; a repeat around the insert gets longer', () => {
    const p = piece({ notes: [note({ bar: 0 })], repeats: [{ startBar: 0, endBar: 1 }, { startBar: 2, endBar: 3 }] });
    const after = ok(insertBlankBars(p, 1, 1));
    expect(after.repeats).toEqual([{ startBar: 0, endBar: 2 }, { startBar: 3, endBar: 4 }]);
  });
});

describe('pasting and inserting bars', () => {
  it('uses up the empty bars at the end first, so an 8-bar piece stays 8 bars', () => {
    const clip = copyBars(piece({ notes: [note()] }), range(0));
    const once = ok(insertBars(piece(), 0, clip));
    expect(once.bars).toBe(8);
    expect(once.notes).toEqual([note({ bar: 0 })]);
  });

  it('seven pastes after a one-bar copy make eight bars (the screen moves the selection each time)', () => {
    const clip = copyBars(piece({ notes: [note()] }), range(0));
    let p = piece();
    let selectedTo = -1;
    for (let i = 0; i < 8; i++) {
      p = ok(insertBars(p, selectedTo + 1, clip));
      selectedTo = selectedTo + 1;
    }
    expect(p.bars).toBe(8);
    expect(p.notes.map((n) => n.bar)).toEqual([0, 1, 2, 3, 4, 5, 6, 7]);
  });

  it('a piece with content grows only by the bars its content needs', () => {
    const full = piece({ bars: 4, notes: [0, 1, 2, 3].map((bar) => note({ bar })) });
    const clip = copyBars(full, range(0));
    expect(ok(insertBars(full, 0, clip)).bars).toBe(5);
  });

  it('drag-repeat: three more copies after the selection', () => {
    const p = piece({ notes: [note({ bar: 0, step: 'C' }), note({ bar: 0, step: 'E' })] });
    const three = ok(insertBars(p, 1, copyBars(p, range(0)), 3));
    expect(three.notes.filter((n) => n.bar === 0).map((n) => n.step).sort()).toEqual(['C', 'E']);
    expect(three.notes.filter((n) => n.bar === 3)).toHaveLength(2);
    expect(three.bars).toBe(8);
  });

  it('refuses a paste into a piece of another meter, with a reason', () => {
    const clip = copyBars(piece({ notes: [note()] }), range(0));
    expect(insertBars(piece({ beats: 3 }), 0, clip)).toEqual({ ok: false, reason: 'meter' });
  });

  it('refuses a paste that would go past the longest piece, with a reason', () => {
    const full = piece({ bars: MAX_BARS, notes: [note({ bar: MAX_BARS - 1 })] });
    const clip = copyBars(piece({ notes: [note()] }), range(0));
    expect(insertBars(full, 0, clip)).toEqual({ ok: false, reason: 'bars-full' });
  });

  it('refuses a clip with a hand the piece does not have', () => {
    const clip = copyBars(piece({ hands: 'LH', notes: [note({ hand: 'LH' })] }), range(0));
    expect(insertBars(piece({ hands: 'RH' }), 0, clip)).toEqual({ ok: false, reason: 'hand' });
  });
});

describe('pasting over bars', () => {
  it('replaces the range and keeps the piece its length', () => {
    const p = piece({ notes: [note({ bar: 0 }), note({ bar: 5, step: 'G' })] });
    const clip = copyBars(piece({ notes: [note({ step: 'F' })] }), range(0));
    const over = ok(replaceBars(p, range(0), clip));
    expect(over.bars).toBe(8);
    expect(over.notes.filter((n) => n.bar === 0)).toEqual([note({ step: 'F' })]);
    expect(over.notes.filter((n) => n.bar === 5)).toEqual([note({ bar: 5, step: 'G' })]);
  });
});

describe('clearing bars', () => {
  it('empties the range and keeps the bars', () => {
    const cleared = clearBars(piece({ notes: [note({ bar: 0 }), note({ bar: 1 })] }), range(0));
    expect(cleared.bars).toBe(8);
    expect(cleared.notes).toEqual([note({ bar: 1 })]);
  });
});

describe('moving the notes of bars up and down', () => {
  it('moves every note of the range one staff step, with the key\'s spelling', () => {
    // G major has an F sharp: F4 goes up to G4 (natural), E4 up to F4 (sharp, from the key)
    const p = piece({ fifths: 1, notes: [note({ bar: 0, step: 'F', alter: 1 }), note({ bar: 0, step: 'E', start: 480 }), note({ bar: 1, step: 'C' })] });
    const up = ok(moveBars(p, range(0), 1, 'step'));
    expect(up.notes.find((n) => n.bar === 0 && n.start === 0)).toMatchObject({ step: 'G', alter: 0 });
    expect(up.notes.find((n) => n.bar === 0 && n.start === 480)).toMatchObject({ step: 'F', alter: 1 });
    expect(up.notes.find((n) => n.bar === 1)).toMatchObject({ step: 'C', octave: 4 });
  });

  it('moves the notes an octave when asked for one', () => {
    const up = ok(moveBars(piece({ notes: [note({ step: 'C', octave: 4 })] }), range(0), 1, 'octave'));
    expect(up.notes[0]).toMatchObject({ step: 'C', octave: 5 });
  });

  it('refuses the whole move when one note would leave the keyboard, and keeps the notes', () => {
    const p = piece({ notes: [note({ step: 'C', octave: 7 }), note({ bar: 1 })] });
    expect(moveBars(p, range(0, 1), 1, 'octave')).toEqual({ ok: false, reason: 'range' });
  });

  it('a note of another bar is not moved', () => {
    const p = piece({ notes: [note({ bar: 0 }), note({ bar: 3, step: 'D' })] });
    const up = ok(moveBars(p, range(0), 1, 'step'));
    expect(up.notes.find((n) => n.bar === 3)).toMatchObject({ step: 'D' });
  });
});

describe('the piece stays valid through bar edits', () => {
  it('property: no sequence of cut, paste, repeat and clear leaves a piece the model refuses', () => {
    const op = fc.oneof(
      fc.record({ kind: fc.constant('cut' as const), from: fc.integer({ min: 0, max: 7 }), len: fc.integer({ min: 1, max: 3 }) }),
      fc.record({ kind: fc.constant('paste' as const), at: fc.integer({ min: 0, max: 7 }), times: fc.integer({ min: 1, max: 3 }) }),
      fc.record({ kind: fc.constant('clear' as const), from: fc.integer({ min: 0, max: 7 }) }),
    );
    fc.assert(fc.property(fc.array(op, { maxLength: 12 }), (ops) => {
      let p = piece({ notes: [note({ bar: 0 }), note({ bar: 2, step: 'E' })] });
      const clip = copyBars(p, range(0, 1));
      for (const o of ops) {
        if (o.kind === 'cut') {
          const r = range(o.from, Math.min(p.bars - 1, o.from + o.len - 1));
          if (isValidRange(p, r)) p = cutBars(p, r).piece;
        } else if (o.kind === 'paste') {
          const edit = insertBars(p, Math.min(o.at, p.bars), clip, o.times);
          if (edit.ok) p = edit.piece;
        } else {
          p = clearBars(p, range(o.from));
        }
        expect(pieceProblem(p)).toBeNull();
        expect(p.notes.every((n) => n.bar < p.bars)).toBe(true);
      }
    }));
  });
});

describe('copy a bar and paste it at the end, x1, x2 or x4 (core_09.AC13 follow-up)', () => {
  it('pastes the copied bar at the end as many times as asked', () => {
    const piece = { ...emptyPiece({ title: 'Copy', hands: 'RH', beats: 4, bars: 4 }), notes: [{ hand: 'RH' as const, bar: 1, start: 0, length: 'whole' as const, step: 'C' as const, octave: 4, alter: 0 as const }] };
    const clip = copyBars(piece, { from: 1, to: 1 });
    const twice = insertBars(piece, piece.bars, clip, 2);
    expect(twice.ok).toBe(true);
    if (!twice.ok) return;
    expect(twice.piece.bars).toBe(6);
    expect(twice.piece.notes.filter((n) => n.bar === 4 || n.bar === 5)).toHaveLength(2);
  });

  it('refuses a paste that would pass the bar limit when the last bar holds notes', () => {
    const base = emptyPiece({ title: 'Full', hands: 'RH', beats: 4, bars: MAX_BARS });
    const piece = { ...base, notes: [{ hand: 'RH' as const, bar: MAX_BARS - 1, start: 0, length: 'whole' as const, step: 'C' as const, octave: 4, alter: 0 as const }] };
    const clip = copyBars({ ...piece, notes: [{ ...piece.notes[0]!, bar: 0 }] }, { from: 0, to: 0 });
    expect(insertBars(piece, piece.bars, clip, 1)).toEqual({ ok: false, reason: 'bars-full' });
  });

  it('an insert in a full-length piece with an empty tail still fits (the empty bars are used up first)', () => {
    const base = emptyPiece({ title: 'Tail', hands: 'RH', beats: 4, bars: MAX_BARS });
    const piece = { ...base, notes: [{ hand: 'RH' as const, bar: 0, start: 0, length: 'whole' as const, step: 'C' as const, octave: 4, alter: 0 as const }] };
    const clip = copyBars(piece, { from: 0, to: 0 });
    expect(insertBars(piece, 0, clip, 1).ok).toBe(true);
  });
});

describe('pasting bars', () => {
  const single = (bar: number, step: EditorNote['step'] = 'C') => note({ bar, step });

  it('after a fresh copy or paste, inserts right after the selection and selects the pasted bars', () => {
    const p = piece({ notes: [single(0)] });
    const clip = copyBars(p, range(0));
    const result = pasteAt(p, range(0), true, null, clip);
    expect(result.range).toEqual(range(1));
    expect(sorted(ok(result.edit).notes)).toEqual([single(0), single(1)]);
  });

  it('seven fresh pastes turn one bar into eight equal bars (the piece keeps its eight bars)', () => {
    let p = piece({ notes: [single(0)] });
    const clip = copyBars(p, range(0));
    let sel: BarRange = range(0);
    for (let i = 0; i < 7; i += 1) {
      const result = pasteAt(p, sel, true, null, clip);
      p = ok(result.edit);
      sel = result.range!;
    }
    expect(p.bars).toBe(8);
    expect(sorted(p.notes).map((n) => n.bar)).toEqual([0, 1, 2, 3, 4, 5, 6, 7]);
    expect(sel).toEqual(range(7));
  });

  it('ft_1_02d.AC28 the paste menu shows the bars x1, x2 or x4 would take, one paste after the other', () => {
    const p = piece({ notes: [single(0)] });
    const clip = copyBars(p, range(0));
    expect(pasteSpan(p, range(0), true, null, clip, 1)).toEqual(range(1));
    expect(pasteSpan(p, range(0), true, null, clip, 4)).toEqual({ from: 1, to: 4 });
    // with no selection, before the last clicked bar
    expect(pasteSpan(p, null, false, 2, clip, 2)).toEqual({ from: 2, to: 3 });
    expect(pasteSpan(p, null, false, 2, clip, 0)).toBeNull();
  });

  it('with another selection, replaces the selected bars by the clip', () => {
    const p = piece({ notes: [single(0), single(2, 'G')] });
    const clip = copyBars(p, range(0));
    const result = pasteAt(p, range(2), false, null, clip);
    expect(result.range).toEqual(range(2));
    expect(sorted(ok(result.edit).notes)).toEqual([single(0), single(2)]);
  });

  it('with no selection, inserts before the last clicked bar, or at the end when nothing was clicked', () => {
    const p = piece({ notes: [single(0), single(1, 'D')] });
    const clip = copyBars(p, range(0));
    expect(pasteAt(p, null, false, 1, clip).range).toEqual(range(1));
    expect(pasteAt(p, null, false, null, clip).range).toEqual(range(p.bars));
  });

  it('refuses a clip in another meter, with a reason', () => {
    const p = piece({ beats: 3, notes: [single(0)] });
    const other = copyBars(piece({ notes: [single(0)] }), range(0));
    const result = pasteAt(p, range(0), true, null, other);
    expect(result.edit.ok).toBe(false);
  });
});
