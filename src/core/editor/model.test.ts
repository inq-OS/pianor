// Covers core_09.AC16, ft_1_02a.AC1, ft_1_02a.AC4, ft_1_02a.AC5, ft_1_02a.AC6, ft_1_02d.AC2, ft_1_02d.AC3, ft_1_02d.AC7, core_09.AC55.
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import {
  BARS_DEFAULT, BPM_DEFAULT, BPM_MAX, BPM_MIN, BPM_STEP, bpmOf, setBpm, stepBpm, findNote, BARS_MIN, LENGTHS, LENGTH_TICKS, autoLength, pieceProblem, BARS_STEP, MAX_BARS, WHEEL_LENGTHS, barTicks, cycleLength, emptyPiece, lengthen, lengthsFor, noteAt, placeNote, playedPiece, removeNote, restsFor, onBothStaves, setBars, setBeats, setLength, setPitch, shorten, stepBars, stepChord, stepPitch,
  type EditorLength, type EditorNote, type EditorPiece, type Edit, type NoteRef, setAlter, nextAlter, longestFit, setDynamic, nextDynamic, setKey, placeRest, removeRest, lengthenRest, shortenRest, slotsFor, editorPieceSchema, type PlacedRest, type RestLength,
  setFinger, restLengthFor,
} from './model';
import { canRedo, canUndo, push, redo, startHistory, undo } from './history';
import { toAbc } from './abc';

const piece = (over: Partial<EditorPiece> = {}): EditorPiece => ({ ...emptyPiece({ title: 'Test', hands: 'RH', beats: 4, bars: 2 }), ...over });
const ok = (edit: Edit): EditorPiece => {
  if (!edit.ok) throw new Error(`refused: ${edit.reason}`);
  return edit.piece;
};
const note = (over: Partial<EditorNote> = {}): EditorNote => ({ hand: 'RH', bar: 0, start: 0, length: 'quarter', step: 'C', octave: 4, alter: 0, ...over });

describe('an empty piece', () => {
  it('has its hands, meter and bars, and no notes', () => {
    expect(emptyPiece({ title: 'A', hands: 'both', beats: 3, bars: 4 })).toEqual({ title: 'A', hands: 'both', beats: 3, bars: 4, fifths: 0, mode: 'major', notes: [] });
  });

  it('offers only the lengths a bar can hold (ft_1_02d.AC1, core_09.AC55)', () => {
    const short = ['sixteenth', 'eighth', 'dottedEighth', 'quarter', 'dottedQuarter', 'half'];
    expect(lengthsFor(piece({ beats: 4 }))).toEqual([...short, 'dottedHalf', 'whole']);
    expect(lengthsFor(piece({ beats: 3 }))).toEqual([...short, 'dottedHalf']);
    expect(lengthsFor(piece({ beats: 2 }))).toEqual(short);
    expect(barTicks(piece({ beats: 3 }))).toBe(1440);
  });

  it('is all rest: one whole-bar rest per bar and hand', () => {
    expect(restsFor(piece(), 'RH')).toEqual([{ bar: 0, start: 0, length: 'bar' }, { bar: 1, start: 0, length: 'bar' }]);
  });
});

describe('placing notes', () => {
  it('puts a note where there is room, and keeps notes in time order', () => {
    let p = ok(placeNote(piece(), note({ start: 480, step: 'E' })));
    p = ok(placeNote(p, note({ start: 0 })));
    expect(p.notes.map((n) => [n.start, n.step])).toEqual([[0, 'C'], [480, 'E']]);
    expect(noteAt(p, 'RH', 0, 600)).toMatchObject({ start: 480 });
    expect(noteAt(p, 'RH', 0, 960)).toBeNull();
  });

  it('keeps notes at the same time in one order: right hand first, then low to high', () => {
    let p = ok(placeNote(piece({ hands: 'both' }), note({ hand: 'LH', octave: 3 })));
    p = ok(placeNote(p, note({ step: 'G' })));
    p = ok(placeNote(p, note({ step: 'E' })));
    p = ok(placeNote(p, note({ bar: 1, step: 'D' })));
    expect(p.notes.map((n) => `${n.bar}${n.hand}${n.step}${n.octave}`)).toEqual(['0RHE4', '0RHG4', '0LHC3', '1RHD4']);
  });

  it('refuses a note that would cross the bar line or run into another note', () => {
    expect(placeNote(piece(), note({ start: 1440, length: 'half' }))).toEqual({ ok: false, reason: 'bar-line' });
    const p = ok(placeNote(piece(), note({ start: 480 })));
    expect(placeNote(p, note({ start: 0, length: 'half' }))).toEqual({ ok: false, reason: 'no-room' });
    expect(placeNote(p, note({ start: 480, step: 'G', length: 'half' }))).toEqual({ ok: false, reason: 'no-room' }); // a chord shares the start and the length
  });

  it('refuses black keys never (the model has none), and keys the EZ-220 does not have', () => {
    expect(placeNote(piece(), note({ step: 'B', octave: 1 }))).toEqual({ ok: false, reason: 'range' });
    expect(placeNote(piece(), note({ step: 'D', octave: 7 }))).toEqual({ ok: false, reason: 'range' });
    expect(placeNote(piece(), note({ step: 'C', octave: 2 })).ok).toBe(true);
    expect(placeNote(piece(), note({ step: 'C', octave: 7 })).ok).toBe(true);
  });

  it('refuses a hand the piece does not have, a bar it does not have, and a start off the eighth grid', () => {
    expect(placeNote(piece(), note({ hand: 'LH' }))).toEqual({ ok: false, reason: 'hand' });
    expect(placeNote(piece(), note({ bar: 2 }))).toEqual({ ok: false, reason: 'bar' });
    expect(placeNote(piece(), note({ start: 100 }))).toEqual({ ok: false, reason: 'grid' });
    expect(placeNote(piece({ beats: 3 }), note({ length: 'whole' }))).toEqual({ ok: false, reason: 'bar-line' });
  });

  it('lets the two hands play at the same time in a piece for both hands', () => {
    let p = piece({ hands: 'both' });
    p = ok(placeNote(p, note()));
    p = ok(placeNote(p, note({ hand: 'LH', step: 'C', octave: 3 })));
    expect(p.notes).toHaveLength(2);
  });

  it('never changes the piece it was given', () => {
    const p = piece();
    const frozen = structuredClone(p);
    placeNote(p, note());
    expect(p).toEqual(frozen);
  });
});

describe('changing a note', () => {
  const start = () => ok(placeNote(ok(placeNote(piece(), note())), note({ start: 960, step: 'G' })));
  const first = { hand: 'RH' as const, bar: 0, start: 0, step: 'C' as const, octave: 4 };

  it('steps it one staff position (one letter) up or down, across B and C with the octave (ft_1_02d.AC7)', () => {
    const b = { hand: 'RH' as const, bar: 0, start: 0, step: 'B' as const, octave: 4 };
    const withB = ok(placeNote(piece(), note({ step: 'B', octave: 4 })));
    expect(ok(stepPitch(withB, b, 1)).notes[0]).toMatchObject({ step: 'C', octave: 5 });
    expect(ok(stepPitch(withB, b, -1)).notes[0]).toMatchObject({ step: 'A', octave: 4 });
    expect(ok(stepPitch(start(), first, 1)).notes[0]).toMatchObject({ step: 'D', octave: 4 });
  });

  it('steps a whole chord one staff position, all its notes or none (ft_1_02d.AC8)', () => {
    const chord = ok(placeNote(ok(placeNote(piece(), note())), note({ step: 'E' })));
    const moved = ok(stepChord(chord, { ...first, step: 'E' }, 1));
    expect(moved.notes.map((n) => `${n.step}${n.octave}`)).toEqual(['D4', 'F4']);
    expect(ok(stepChord(chord, first, -1)).notes.map((n) => `${n.step}${n.octave}`)).toEqual(['B3', 'D4']);
    // a single note steps as before
    expect(stepChord(start(), first, 1)).toEqual(stepPitch(start(), first, 1));
    // one note past the keyboard: nothing moves
    const top = ok(placeNote(ok(placeNote(piece(), note({ step: 'A', octave: 6 }))), note({ step: 'C', octave: 7 })));
    expect(stepChord(top, { ...first, step: 'A', octave: 6 }, 1)).toEqual({ ok: false, reason: 'range' });
    expect(stepChord(piece(), first, 1)).toEqual({ ok: false, reason: 'no-note' });
  });

  it('refuses a step past the keyboard range', () => {
    const top = ok(placeNote(piece(), note({ step: 'C', octave: 7 })));
    const topRef = { hand: 'RH' as const, bar: 0, start: 0, step: 'C' as const, octave: 7 };
    expect(stepPitch(top, topRef, 1)).toEqual({ ok: false, reason: 'range' });
  });

  it('moves it to another pitch', () => {
    expect(ok(setPitch(start(), first, 'E', 4)).notes[0]).toMatchObject({ step: 'E', octave: 4, start: 0 });
    expect(setPitch(start(), first, 'C', 8)).toEqual({ ok: false, reason: 'range' });
  });

  it('makes it longer step by step until the next note is in the way', () => {
    let p = ok(setLength(start(), first, 'eighth'));
    for (const longer of ['quarter', 'half']) {
      p = ok(lengthen(p, first));
      expect(p.notes[0]!.length).toBe(longer);
    }
    expect(lengthen(p, first)).toEqual({ ok: false, reason: 'no-room' });
  });

  it('makes it shorter down to a sixteenth (core_09.AC55)', () => {
    let p = start();
    for (const shorter of ['eighth', 'sixteenth']) {
      p = ok(shorten(p, first));
      expect(p.notes[0]!.length).toBe(shorter);
    }
    expect(shorten(p, first)).toEqual({ ok: false, reason: 'shortest' });
    p = ok(placeNote(piece(), note({ length: 'whole' })));
    expect(lengthen(p, first)).toEqual({ ok: false, reason: 'longest' });
  });

  it('refuses a length that crosses the bar line', () => {
    const p = ok(placeNote(piece(), note({ start: 1440 })));
    expect(setLength(p, { hand: 'RH', bar: 0, start: 1440, step: 'C', octave: 4 }, 'half')).toEqual({ ok: false, reason: 'bar-line' });
  });

  it('removes it, and says so when there is no note there', () => {
    expect(ok(removeNote(start(), first)).notes).toHaveLength(1);
    expect(removeNote(start(), { hand: 'RH', bar: 1, start: 0, step: 'C', octave: 4 })).toEqual({ ok: false, reason: 'no-note' });
    expect(lengthen(start(), { hand: 'RH', bar: 1, start: 0, step: 'C', octave: 4 })).toEqual({ ok: false, reason: 'no-note' });
  });
});

describe('the wheel over an empty place cycles the length (ft_1_02d.AC3)', () => {
  it('lengthens one step toward the whole note and shortens one step toward the sixteenth', () => {
    expect(cycleLength('sixteenth', 'longer')).toBe('eighth');
    expect(cycleLength('eighth', 'shorter')).toBe('sixteenth');
    expect(cycleLength('dottedQuarter', 'longer')).toBe('half');
    expect(cycleLength('dottedQuarter', 'shorter')).toBe('quarter');
    expect(cycleLength('dottedEighth', 'longer')).toBe('quarter');
    expect(cycleLength('dottedEighth', 'shorter')).toBe('eighth');
    expect(cycleLength('eighth', 'longer')).toBe('quarter');
    expect(cycleLength('quarter', 'longer')).toBe('half');
    expect(cycleLength('half', 'longer')).toBe('whole');
    expect(cycleLength('whole', 'shorter')).toBe('half');
    expect(cycleLength('half', 'shorter')).toBe('quarter');
    expect(cycleLength('quarter', 'shorter')).toBe('eighth');
  });

  it('stops at the ends: the whole note does not get longer, the sixteenth does not get shorter (no wrap)', () => {
    expect(cycleLength('whole', 'longer')).toBe('whole');
    expect(cycleLength('sixteenth', 'shorter')).toBe('sixteenth');
  });

  it('cycles over the plain lengths: whole, half, quarter, eighth, sixteenth, in that order', () => {
    expect(WHEEL_LENGTHS).toEqual(['whole', 'half', 'quarter', 'eighth', 'sixteenth']);
  });

  it('going the same way many steps ends at the end and stays there', () => {
    let length: EditorLength = 'quarter';
    for (let i = 0; i < 10; i++) length = cycleLength(length, 'longer');
    expect(length).toBe('whole');
    for (let i = 0; i < 10; i++) length = cycleLength(length, 'shorter');
    expect(length).toBe('sixteenth');
  });
});

describe('the shape of the piece', () => {
  it('more bars keep the notes; fewer bars drop the notes in the bars that go', () => {
    let p = ok(placeNote(piece(), note({ bar: 1 })));
    expect(setBars(p, 4).bars).toBe(4);
    p = setBars(p, 1);
    expect(p).toMatchObject({ bars: 1, notes: [] });
    expect(setBars(p, 0).bars).toBe(1);
    expect(setBars(p, 99).bars).toBe(32);
  });

  it('the bar buttons move in steps of four, never below four bars, and a new piece starts at eight', () => {
    expect(BARS_STEP).toBe(4);
    expect(BARS_MIN).toBe(4);
    expect(BARS_DEFAULT).toBe(8);
    expect(emptyPiece({ title: 'New', hands: 'both', beats: 4, bars: BARS_DEFAULT }).bars).toBe(8);
    const eight = piece({ bars: 8 });
    expect(stepBars(eight, 1).bars).toBe(12);
    expect(stepBars(eight, -1).bars).toBe(4);
    const four = stepBars(eight, -1);
    expect(stepBars(four, -1)).toBe(four);
  });

  it('a press at the limit returns the same piece, and the top limit is the maximum', () => {
    const atMin = piece({ bars: BARS_MIN });
    expect(stepBars(atMin, -1)).toBe(atMin);
    expect(stepBars(piece({ bars: 3 }), -1).bars).toBe(3);
    const full = piece({ bars: MAX_BARS });
    expect(stepBars(full, 1)).toBe(full);
    expect(stepBars(piece({ bars: 30 }), 1).bars).toBe(MAX_BARS);
  });

  it('taking bars away drops the notes in the bars that go', () => {
    const p = ok(placeNote(piece({ bars: 8 }), note({ bar: 6 })));
    expect(stepBars(p, -1)).toMatchObject({ bars: 4, notes: [] });
  });

  it('an own piece saved for one hand opens on both staves with every note and rest kept', () => {
    for (const hand of ['RH', 'LH'] as const) {
      const old = ok(placeRest(ok(placeNote(piece({ hands: hand }), note({ hand, octave: hand === 'RH' ? 4 : 3 }))), { hand, bar: 1, start: 0, length: 'quarter' }));
      const opened = onBothStaves(old);
      expect(opened.hands).toBe('both');
      expect(opened.notes).toEqual(old.notes);
      expect(opened.rests).toEqual(old.rests);
      // the other staff is free to write on
      expect(placeNote(opened, note({ hand: hand === 'RH' ? 'LH' : 'RH', octave: hand === 'RH' ? 3 : 4 })).ok).toBe(true);
    }
    const both = piece({ hands: 'both' });
    expect(onBothStaves(both)).toBe(both);
  });

  it('a piece written only on the treble staff is still saved and played as a right-hand piece', () => {
    const p = ok(placeNote(piece({ hands: 'both' }), note()));
    expect(playedPiece(p).hands).toBe('RH');
    expect(playedPiece(ok(placeNote(piece({ hands: 'both' }), note({ hand: 'LH', octave: 3 })))).hands).toBe('LH');
  });

  it('the meter can change only while the piece is empty', () => {
    expect(ok(setBeats(piece(), 3)).beats).toBe(3);
    expect(setBeats(ok(placeNote(piece(), note())), 3)).toEqual({ ok: false, reason: 'not-empty' });
  });
});

describe('the hands a piece is played with', () => {
  const both = piece({ hands: 'both' });

  it('are the hands that have notes: an empty hand is left out of what is played', () => {
    expect(playedPiece({ ...both, notes: [note({ hand: 'RH' })] }).hands).toBe('RH');
    expect(playedPiece({ ...both, notes: [note({ hand: 'LH', octave: 3 })] }).hands).toBe('LH');
    expect(playedPiece({ ...both, notes: [note({ hand: 'RH' }), note({ hand: 'LH', octave: 3 })] }).hands).toBe('both');
  });

  it('keep everything else of the piece, notes included', () => {
    const one = { ...both, notes: [note({ hand: 'RH' })] };
    expect(playedPiece(one)).toEqual({ ...one, hands: 'RH' });
  });

  it('leave a piece with no notes as it is (saving refuses it anyway)', () => {
    expect(playedPiece(both)).toEqual(both);
    expect(playedPiece(piece({ hands: 'LH' }))).toEqual(piece({ hands: 'LH' }));
  });
});

describe('rests', () => {
  it('fill the time between notes: an eighth up to the next beat, then the largest rest that starts on its own beat', () => {
    let p = ok(placeNote(piece(), note({ start: 240, length: 'eighth' })));
    p = ok(placeNote(p, note({ start: 1440 })));
    expect(restsFor(p, 'RH')).toEqual([
      { bar: 0, start: 0, length: 'eighth' },
      { bar: 0, start: 480, length: 'quarter' },
      { bar: 0, start: 960, length: 'quarter' },
      { bar: 1, start: 0, length: 'bar' },
    ]);
  });

  it('do not depend on the order of the notes (an imported piece file can list them in any order)', () => {
    const p = piece({ notes: [note({ start: 960, length: 'half', step: 'E' }), note({ start: 0 })] });
    expect(restsFor(p, 'RH')).toEqual([{ bar: 0, start: 480, length: 'quarter' }, { bar: 1, start: 0, length: 'bar' }]);
  });

  it('a half rest sits on the half bar, a whole bar with no note of the hand is one bar rest', () => {
    const p = ok(placeNote(piece({ hands: 'both' }), note({ length: 'half' })));
    expect(restsFor(p, 'RH')).toEqual([{ bar: 0, start: 960, length: 'half' }, { bar: 1, start: 0, length: 'bar' }]);
    expect(restsFor(p, 'LH')).toEqual([{ bar: 0, start: 0, length: 'bar' }, { bar: 1, start: 0, length: 'bar' }]);
  });
});

describe('edits keep the piece sound (property)', () => {
  type Op =
    | { kind: 'place'; hand: 'RH' | 'LH'; bar: number; slot: number; length: EditorLength; pitch: number }
    | { kind: 'lengthen' | 'shorten' | 'remove'; hand: 'RH' | 'LH'; bar: number; slot: number; pitch: number }
    | { kind: 'rest' | 'unrest'; hand: 'RH' | 'LH'; bar: number; slot: number; length: RestLength }
    | { kind: 'bars'; bars: number };
  const lengths: EditorLength[] = ['eighth', 'quarter', 'half', 'whole'];
  const op: fc.Arbitrary<Op> = fc.oneof(
    fc.record({ kind: fc.constant('place' as const), hand: fc.constantFrom('RH' as const, 'LH' as const), bar: fc.integer({ min: 0, max: 3 }), slot: fc.integer({ min: 0, max: 7 }), length: fc.constantFrom(...lengths), pitch: fc.integer({ min: 0, max: 20 }) }),
    fc.record({ kind: fc.constantFrom('lengthen' as const, 'shorten' as const, 'remove' as const), hand: fc.constantFrom('RH' as const, 'LH' as const), bar: fc.integer({ min: 0, max: 3 }), slot: fc.integer({ min: 0, max: 7 }), pitch: fc.integer({ min: 0, max: 20 }) }),
    fc.record({ kind: fc.constantFrom('rest' as const, 'unrest' as const), hand: fc.constantFrom('RH' as const, 'LH' as const), bar: fc.integer({ min: 0, max: 3 }), slot: fc.integer({ min: 0, max: 7 }), length: fc.constantFrom<RestLength>('eighth', 'quarter', 'half', 'whole') }),
    fc.record({ kind: fc.constant('bars' as const), bars: fc.integer({ min: 1, max: 4 }) }),
  );
  const steps = ['C', 'D', 'E', 'F', 'G', 'A', 'B'] as const;

  const apply = (p: EditorPiece, o: Op): EditorPiece => {
    if (o.kind === 'bars') return setBars(p, o.bars);
    if (o.kind === 'rest' || o.kind === 'unrest') {
      const at = { hand: o.hand, bar: o.bar, start: o.slot * 240 };
      const edit = o.kind === 'rest' ? placeRest(p, { ...at, length: o.length }) : removeRest(p, at);
      return edit.ok ? edit.piece : p;
    }
    if (!('pitch' in o)) return p;
    const ref = { hand: o.hand, bar: o.bar, start: o.slot * 240, step: steps[o.pitch % 7]!, octave: 3 + Math.floor(o.pitch / 7) };
    let edit: Edit;
    if (o.kind === 'place') edit = placeNote(p, { ...ref, length: o.length });
    else if (o.kind === 'lengthen') edit = lengthen(p, ref);
    else if (o.kind === 'shorten') edit = shorten(p, ref);
    else edit = removeNote(p, ref);
    return edit.ok ? edit.piece : p;
  };

  it('every note stays inside its bar, notes of a hand overlap only as chords, and rests fill the rest exactly', () => {
    fc.assert(fc.property(fc.constantFrom<2 | 3 | 4>(2, 3, 4), fc.array(op, { maxLength: 40 }), (beats, ops) => {
      let p = emptyPiece({ title: 'P', hands: 'both', beats, bars: 4 });
      for (const o of ops) p = apply(p, o);
      const bar = barTicks(p);
      const ticks = LENGTH_TICKS;
      for (const hand of ['RH', 'LH'] as const) {
        if (p.hands !== 'both' && p.hands !== hand) {
          expect(p.notes.filter((n) => n.hand === hand)).toEqual([]);
          expect((p.rests ?? []).filter((r) => r.hand === hand)).toEqual([]);
          continue;
        }
        for (let b = 0; b < p.bars; b++) {
          const spans = [
            ...[...new Set(p.notes.filter((n) => n.hand === hand && n.bar === b).map((n) => `${n.start},${n.start + ticks[n.length]}`))].map((k) => k.split(',').map(Number) as unknown as readonly [number, number]),
            ...restsFor(p, hand).filter((r) => r.bar === b).map((r) => [r.start, r.start + (r.length === 'bar' ? bar : ticks[r.length])] as const),
          ].sort((x, y) => x[0] - y[0]);
          let at = 0;
          for (const [from, to] of spans) {
            expect(from).toBe(at); // no gap, no overlap
            at = to;
          }
          expect(at).toBe(bar);
        }
        expect(p.notes.every((n) => n.bar < p.bars)).toBe(true);
        expect((p.rests ?? []).every((r) => r.bar < p.bars)).toBe(true);
        expect(pieceProblem(p)).toBeNull();
      }
    }));
  });

  it('undo returns exactly the piece before an edit, and redo the one after', () => {
    fc.assert(fc.property(fc.array(op, { minLength: 1, maxLength: 25 }), (ops) => {
      let history = startHistory(emptyPiece({ title: 'P', hands: 'both', beats: 4, bars: 4 }));
      const seen: EditorPiece[] = [history.present];
      for (const o of ops) {
        history = push(history, apply(history.present, o));
        seen.push(history.present);
      }
      for (let i = seen.length - 2; i >= 0; i--) {
        expect(canUndo(history)).toBe(true);
        history = undo(history);
        expect(history.present).toEqual(seen[i]);
      }
      expect(canUndo(history)).toBe(false);
      for (let i = 1; i < seen.length; i++) {
        history = redo(history);
        expect(history.present).toEqual(seen[i]);
      }
      expect(canRedo(history)).toBe(false);
    }));
  });
});

describe('the dotted half (ft_1_02d.AC1)', () => {
  it('is three beats and fills a bar of 3/4', () => {
    expect(LENGTH_TICKS.dottedHalf).toBe(1440);
    const p = ok(placeNote(piece({ beats: 3 }), note({ length: 'dottedHalf' })));
    expect(restsFor(p, 'RH').filter((r) => r.bar === 0)).toEqual([]);
    expect(pieceProblem(p)).toBeNull();
  });

  it('is refused where it crosses the bar line, and rests around it stay plain', () => {
    expect(placeNote(piece({ beats: 4 }), note({ length: 'dottedHalf', start: 960 }))).toMatchObject({ ok: false, reason: 'bar-line' });
    const p = ok(placeNote(piece({ beats: 4 }), note({ length: 'dottedHalf', start: 480 })));
    expect(restsFor(p, 'RH').filter((r) => r.bar === 0).map((r) => r.length)).toEqual(['quarter']);
  });

  it('lengthen and shorten step through it', () => {
    const p = ok(placeNote(piece({ beats: 4 }), note({ length: 'half' })));
    const longer = ok(lengthen(p, { hand: 'RH', bar: 0, start: 0, step: 'C', octave: 4 }));
    expect(longer.notes[0]!.length).toBe('dottedHalf');
    expect(ok(shorten(longer, { hand: 'RH', bar: 0, start: 0, step: 'C', octave: 4 })).notes[0]!.length).toBe('half');
  });
});

describe('automatic length', () => {
  const at = (p: EditorPiece, start: number, selected: EditorLength, bar = 0) => autoLength(p, 'RH', bar, start, selected);

  it('a note in an empty bar has the selected length, never a longer one', () => {
    for (const length of LENGTHS) expect(at(piece({ beats: 4 }), 0, length)).toBe(length);
    expect(at(piece({ beats: 3 }), 0, 'quarter')).toBe('quarter');
    expect(at(piece({ beats: 3 }), 0, 'dottedHalf')).toBe('dottedHalf');
    expect(at(piece({ beats: 2 }), 0, 'eighth')).toBe('eighth');
  });

  it('automatic length fits the space left (ft_1_02d.AC2)', () => {
    // in an empty bar too, a length that does not fit before the bar line becomes the longest that does
    expect(at(piece({ beats: 4 }), 480, 'whole')).toBe('dottedHalf');
    expect(at(piece({ beats: 4 }), 960, 'whole')).toBe('half');
    expect(at(piece({ beats: 4 }), 1440, 'half')).toBe('quarter');
    expect(at(piece({ beats: 3 }), 0, 'dottedHalf')).toBe('dottedHalf');
    expect(at(piece({ beats: 3 }), 1200, 'quarter')).toBe('eighth');
    // a note after other notes fits the space left, capped at the selected length
    const p = ok(placeNote(piece({ beats: 4 }), note({ length: 'quarter' })));
    expect(at(p, 480, 'whole')).toBe('dottedHalf');
    expect(at(p, 480, 'half')).toBe('half');
    expect(at(p, 480, 'eighth')).toBe('eighth');
    expect(at(p, 960, 'whole')).toBe('half');
    // a gap before the next note is the space left
    const q = ok(placeNote(piece({ beats: 4 }), note({ start: 960 })));
    expect(at(q, 0, 'whole')).toBe('half');
    expect(at(q, 720, 'quarter')).toBe('eighth');
    // another hand or bar does not count as notes in the bar
    expect(at(q, 0, 'whole', 1)).toBe('whole');
    // a place inside a note keeps the selected length so placing refuses it as before
    expect(at(q, 1200, 'quarter')).toBe('quarter');
  });

  it('any sequence of adds keeps bars full (ft_1_02d.AC2)', () => {
    fc.assert(fc.property(
      fc.constantFrom(2, 3, 4), fc.constantFrom(...LENGTHS),
      fc.array(fc.record({ bar: fc.integer({ min: 0, max: 1 }), slot: fc.integer({ min: 0, max: 7 }), selected: fc.constantFrom(...LENGTHS) }), { maxLength: 30 }),
      (beats, _l, adds) => {
        let p = piece({ beats, bars: 2 });
        for (const a of adds) {
          const start = a.slot * 240;
          if (start >= barTicks(p) || noteAt(p, 'RH', a.bar, start)) continue;
          const length = autoLength(p, 'RH', a.bar, start, a.selected);
          const edit = placeNote(p, note({ bar: a.bar, start, length }));
          expect(edit.ok).toBe(true);
          if (edit.ok) p = edit.piece;
        }
        expect(pieceProblem(p)).toBeNull();
        for (let b = 0; b < p.bars; b++) {
          const used = p.notes.filter((n) => n.bar === b).reduce((sum, n) => sum + LENGTH_TICKS[n.length], 0);
          const rest = restsFor(p, 'RH').filter((r) => r.bar === b).reduce((sum, r) => sum + (r.length === 'bar' ? barTicks(p) : LENGTH_TICKS[r.length]), 0);
          expect(used + rest).toBe(barTicks(p));
        }
      },
    ), { numRuns: 200 });
  });
});

describe('the wheel from the dotted half (ft_1_02d.AC3)', () => {
  it('steps to its neighbours: longer is the whole, shorter is the half', () => {
    expect(cycleLength('dottedHalf', 'longer')).toBe('whole');
    expect(cycleLength('dottedHalf', 'shorter')).toBe('half');
  });

  it('in 4/4 both neighbours are offered; in 3/4 the whole is not, so the length stays', () => {
    expect(lengthsFor(piece({ beats: 4 }))).toEqual(expect.arrayContaining([cycleLength('dottedHalf', 'longer'), cycleLength('dottedHalf', 'shorter')]));
    expect(lengthsFor(piece({ beats: 3 }))).not.toContain(cycleLength('dottedHalf', 'longer'));
    expect(lengthsFor(piece({ beats: 3 }))).toContain(cycleLength('dottedHalf', 'shorter'));
  });
});

describe('chords: several pitches of one hand on one start (ft_1_02a.AC4)', () => {
  const ref = (over: Partial<NoteRef> = {}): NoteRef => ({ hand: 'RH', bar: 0, start: 0, step: 'C', octave: 4, ...over });

  it('places C and E on one tick and length as two separate notes, lowest first (ft_1_02a.AC4)', () => {
    let p = ok(placeNote(piece(), note({ step: 'E' })));
    p = ok(placeNote(p, note({ step: 'C' })));
    expect(p.notes.map((n) => [n.start, n.step, n.length])).toEqual([[0, 'C', 'quarter'], [0, 'E', 'quarter']]);
    expect(pieceProblem(p)).toBeNull();
    expect(restsFor(p, 'RH').filter((r) => r.bar === 0).map((r) => [r.start, r.length])).toEqual([[480, 'quarter'], [960, 'half']]);
  });

  it('refuses the same pitch on the same tick, with its own reason (ft_1_02a.AC5)', () => {
    const p = ok(placeNote(piece(), note()));
    expect(placeNote(p, note())).toEqual({ ok: false, reason: 'duplicate' });
    expect(placeNote(p, note({ length: 'half' }))).toEqual({ ok: false, reason: 'duplicate' });
    const q = ok(placeNote(p, note({ step: 'E' })));
    expect(setPitch(q, ref({ step: 'E' }), 'C', 4)).toEqual({ ok: false, reason: 'duplicate' });
    expect(pieceProblem({ ...piece(), notes: [note(), note()] })).toBe('duplicate');
  });

  it('still refuses a partial overlap: another start or another length is no-room (ft_1_02a.AC6)', () => {
    const p = ok(placeNote(piece(), note({ length: 'half' })));
    expect(placeNote(p, note({ step: 'E', length: 'quarter' }))).toEqual({ ok: false, reason: 'no-room' });
    expect(placeNote(p, note({ step: 'E', start: 480, length: 'quarter' }))).toEqual({ ok: false, reason: 'no-room' });
    expect(pieceProblem({ ...piece(), notes: [note({ length: 'half' }), note({ step: 'E', start: 480 })] })).toBe('no-room');
  });

  it('a chord shares one length: lengthening, shortening or setting one note changes all (ft_1_02a.AC4)', () => {
    let p = ok(placeNote(ok(placeNote(piece(), note())), note({ step: 'G' })));
    p = ok(lengthen(p, ref({ step: 'G' })));
    expect(p.notes.map((n) => n.length)).toEqual(['half', 'half']);
    p = ok(shorten(p, ref()));
    expect(p.notes.map((n) => n.length)).toEqual(['quarter', 'quarter']);
    expect(setLength(ok(placeNote(p, note({ start: 480, step: 'D' }))), ref(), 'half')).toEqual({ ok: false, reason: 'no-room' });
  });

  it('removes and moves one note of a chord by its pitch (ft_1_02a.AC4)', () => {
    const p = ok(placeNote(ok(placeNote(piece(), note())), note({ step: 'E' })));
    expect(findNote(p, ref({ step: 'E' }))).toMatchObject({ step: 'E' });
    expect(ok(removeNote(p, ref({ step: 'E' }))).notes.map((n) => n.step)).toEqual(['C']);
    expect(removeNote(p, ref({ step: 'G' }))).toEqual({ ok: false, reason: 'no-note' });
    expect(ok(setPitch(p, ref({ step: 'E' }), 'G', 4)).notes.map((n) => n.step)).toEqual(['C', 'G']);
    expect(noteAt(p, 'RH', 0, 0, { step: 'E', octave: 4 })).toMatchObject({ step: 'E' });
  });

  it('a note added at an occupied start takes the chord\'s length, not the selected one (ft_1_02a.AC4)', () => {
    const p = ok(placeNote(piece(), note({ length: 'half' })));
    expect(autoLength(p, 'RH', 0, 0, 'eighth')).toBe('half');
  });
});

describe('the BPM of a piece (ft_1_02d.AC5)', () => {
  it('is 80 when the piece has none, and setBpm sets it', () => {
    expect(bpmOf(piece())).toBe(BPM_DEFAULT);
    expect(BPM_DEFAULT).toBe(80);
    expect(bpmOf(setBpm(piece(), 120))).toBe(120);
  });
  it('clamps and rounds out-of-range values', () => {
    expect(setBpm(piece(), 5).bpm).toBe(BPM_MIN);
    expect(setBpm(piece(), 999).bpm).toBe(BPM_MAX);
    expect(BPM_MAX).toBe(500);
    expect(setBpm(piece(), 480).bpm).toBe(480);
    expect(setBpm(piece(), 90.4).bpm).toBe(90);
  });
  it('steps by BPM_STEP and stops at the ends, returning the same piece', () => {
    expect(bpmOf(stepBpm(piece(), 1))).toBe(80 + BPM_STEP);
    expect(bpmOf(stepBpm(piece(), -1))).toBe(80 - BPM_STEP);
    const top = setBpm(piece(), BPM_MAX);
    expect(stepBpm(top, 1)).toBe(top);
    const bottom = setBpm(piece(), BPM_MIN);
    expect(stepBpm(bottom, -1)).toBe(bottom);
  });
  it('does not touch the notes', () => {
    const p = ok(placeNote(piece(), note()));
    expect(setBpm(p, 100).notes).toEqual(p.notes);
  });
});

describe('keys and accidentals (core_09.AC8)', () => {
  const ref = (over: Partial<NoteRef> = {}): NoteRef => ({ hand: 'RH', bar: 0, start: 0, step: 'C', octave: 4, ...over });

  it('a note placed in a key takes the key\'s spelling, and an explicit alter is kept', () => {
    const g = piece({ fifths: 1 });
    expect(ok(placeNote(g, { ...note(), step: 'F', start: 0, alter: undefined })).notes[0]).toMatchObject({ step: 'F', alter: 1 });
    expect(ok(placeNote(g, note({ step: 'F', start: 0, alter: 0 }))).notes[0]).toMatchObject({ alter: 0 });
    expect(ok(placeNote(piece({ fifths: -2 }), { ...note(), step: 'B', octave: 4, alter: undefined })).notes[0]).toMatchObject({ alter: -1 });
  });

  it('sets and clears a dynamic mark on the selected note only, and the cycle goes pp to ff then none (core_09.AC16)', () => {
    let p = ok(placeNote(piece(), note({ start: 0 })));
    p = ok(placeNote(p, note({ start: 480, step: 'D' })));
    p = ok(setDynamic(p, ref(), 'p'));
    expect(p.notes.map((n) => [n.step, n.dynamic])).toEqual([['C', 'p'], ['D', undefined]]);
    p = ok(setDynamic(p, ref(), undefined));
    expect('dynamic' in p.notes[0]!).toBe(false);
    expect(nextDynamic(undefined)).toBe('pp');
    expect(nextDynamic('ff')).toBeUndefined();
    expect(nextDynamic('mf')).toBe('f');
  });

  it('writes a dynamic mark before its note in the ABC text (core_09.AC16)', () => {
    const p = ok(setDynamic(ok(placeNote(piece(), note({ start: 0 }))), ref(), 'f'));
    expect(toAbc(p)).toContain('!f!C');
  });

  it('a sharp, flat or natural changes one note and no other', () => {
    let p = ok(placeNote(piece(), note({ start: 0 })));
    p = ok(placeNote(p, note({ start: 480, step: 'D' })));
    p = ok(setAlter(p, ref(), 1));
    expect(p.notes.map((n) => [n.step, n.alter])).toEqual([['C', 1], ['D', 0]]);
    p = ok(setAlter(p, ref(), -1));
    expect(p.notes[0]!.alter).toBe(-1);
    p = ok(setAlter(p, ref(), 0));
    expect(p.notes[0]!.alter).toBe(0);
  });

  it('refuses an alter for no note and a pitch the EZ-220 does not have, and changes one note of a chord', () => {
    expect(setAlter(piece(), ref(), 1)).toEqual({ ok: false, reason: 'no-note' });
    const top = ok(placeNote(piece(), note({ octave: 7, step: 'C' })));
    expect(setAlter(top, ref({ octave: 7 }), 1)).toEqual({ ok: false, reason: 'range' });
    const chord = ok(placeNote(piece(), note({ start: 0 })));
    const two = ok(placeNote(chord, note({ start: 0, step: 'E' })));
    const changed = ok(setAlter(two, ref({ step: 'E' }), -1));
    expect(changed.notes.map((n) => [n.step, n.alter])).toEqual([['C', 0], ['E', -1]]);
  });

  it('a key change sets the key and its mode and leaves every note as it is', () => {
    const p = ok(placeNote(piece(), note({ start: 0, alter: 1 })));
    const changed = setKey(p, -3, 'minor');
    expect(changed).toMatchObject({ fifths: -3, mode: 'minor' });
    expect(changed.notes).toEqual(p.notes);
  });
});

describe('rests placed by the author, and the places a note can go', () => {
  const rest = (over: Partial<PlacedRest> = {}): PlacedRest => ({ hand: 'RH', bar: 0, start: 0, length: 'quarter', ...over });
  const slots = (p: EditorPiece, bar = 0) => slotsFor(p, 'RH', bar);

  it('a placed rest takes its time: rests fill the rest of the bar around it, and the save keeps it', () => {
    const p = ok(placeRest(piece(), rest()));
    expect(p.rests).toEqual([rest()]);
    expect(restsFor(p, 'RH').filter((r) => r.bar === 0).map((r) => [r.start, r.length])).toEqual([[0, 'quarter'], [480, 'quarter'], [960, 'half']]);
    expect(editorPieceSchema.parse(JSON.parse(JSON.stringify(p)))).toEqual(p);
  });

  it('an older piece with no rests reads as before', () => {
    const old = { title: 'Old', hands: 'RH', beats: 4, bars: 1, fifths: 0, mode: 'major', notes: [note()] };
    const parsed = editorPieceSchema.parse(old);
    expect(parsed.rests).toBeUndefined();
    expect(restsFor(parsed, 'RH').map((r) => [r.start, r.length])).toEqual([[480, 'quarter'], [960, 'half']]);
  });

  it('a rest and a note never share time; a rest obeys the bar line and the grid', () => {
    const p = ok(placeRest(piece(), rest({ length: 'half' })));
    expect(placeNote(p, note({ start: 480 }))).toEqual({ ok: false, reason: 'no-room' });
    expect(placeNote(p, note())).toEqual({ ok: false, reason: 'no-room' });
    expect(placeRest(p, rest({ start: 480 }))).toEqual({ ok: false, reason: 'no-room' });
    const q = ok(placeNote(piece(), note()));
    expect(placeRest(q, rest())).toEqual({ ok: false, reason: 'no-room' });
    expect(placeRest(piece(), rest({ start: 1440, length: 'half' }))).toEqual({ ok: false, reason: 'bar-line' });
    expect(placeRest(piece(), rest({ start: 100 }))).toEqual({ ok: false, reason: 'grid' });
    expect(placeRest(piece({ hands: 'RH' }), rest({ hand: 'LH' }))).toEqual({ ok: false, reason: 'hand' });
    expect(placeRest(piece(), rest({ bar: 5 }))).toEqual({ ok: false, reason: 'bar' });
    expect(lengthen(ok(placeNote(p, note({ start: 960 }))), { hand: 'RH', bar: 0, start: 960, step: 'C', octave: 4 })).toMatchObject({ ok: true });
    expect(pieceProblem({ ...piece(), notes: [note()], rests: [rest()] })).toBe('no-room');
  });

  it('Ctrl + wheel on a placed rest makes it longer or shorter, as on a note, through the plain rest lengths (ft_1_02d.AC8)', () => {
    const at = { hand: 'RH' as const, bar: 0, start: 0 };
    let p = ok(placeRest(piece(), rest({ length: 'sixteenth' })));
    for (const longer of ['eighth', 'quarter', 'half', 'whole']) {
      p = ok(lengthenRest(p, at));
      expect(p.rests).toEqual([rest({ length: longer as RestLength })]);
    }
    expect(lengthenRest(p, at)).toEqual({ ok: false, reason: 'longest' });
    for (const shorter of ['half', 'quarter', 'eighth', 'sixteenth']) {
      p = ok(shortenRest(p, at));
      expect(p.rests![0]!.length).toBe(shorter);
    }
    expect(shortenRest(p, at)).toEqual({ ok: false, reason: 'shortest' });
    // a note after it, the bar line and the meter stop it; a missing rest is refused
    const q = ok(placeNote(ok(placeRest(piece(), rest())), note({ start: 960 })));
    expect(ok(lengthenRest(q, at)).rests![0]!.length).toBe('half');
    expect(lengthenRest(ok(lengthenRest(q, at)), at)).toEqual({ ok: false, reason: 'no-room' });
    expect(lengthenRest(ok(placeRest(piece(), rest({ start: 1440 }))), { ...at, start: 1440 })).toEqual({ ok: false, reason: 'bar-line' });
    expect(lengthenRest(ok(placeRest(piece({ beats: 3 }), rest({ length: 'half' }))), at)).toEqual({ ok: false, reason: 'longest' });
    expect(shortenRest(piece(), at)).toEqual({ ok: false, reason: 'no-note' });
  });

  it('removes a placed rest; undo of the piece brings it back', () => {
    const p = ok(placeRest(piece(), rest()));
    expect(ok(removeRest(p, { hand: 'RH', bar: 0, start: 0 })).rests).toEqual([]);
    expect(removeRest(p, { hand: 'RH', bar: 0, start: 480 })).toEqual({ ok: false, reason: 'no-note' });
  });

  it('fewer bars or the meter: rests go with the notes', () => {
    const p = ok(placeRest(ok(placeRest(piece({ hands: 'both', bars: 2 }), rest({ bar: 1 }))), rest({ hand: 'LH' })));
    expect(setBars(p, 1).rests).toEqual([rest({ hand: 'LH' })]);
    expect(setBeats(p, 3)).toEqual({ ok: false, reason: 'not-empty' });
  });

  it('the places a note can go: the start of an empty bar, after the last note or rest, and the start of each gap', () => {
    expect(slots(piece())).toEqual([0]);
    const q = ok(placeNote(piece(), note()));
    expect(slots(q)).toEqual([480]);
    const gap = ok(placeNote(q, note({ start: 960 })));
    expect(slots(gap)).toEqual([480, 1440]);
    // a chord takes one place; a rest takes its time like a note
    expect(slots(ok(placeNote(q, note({ step: 'E' }))))).toEqual([480]);
    expect(slots(ok(placeRest(piece(), rest())))).toEqual([480]);
    // a note that does not start the bar leaves a place at the start
    expect(slots(ok(placeNote(piece(), note({ start: 960 }))))).toEqual([0, 1440]);
    // a full bar has none; another hand or bar does not count
    const full = ok(placeNote(piece(), note({ length: 'whole' })));
    expect(slots(full)).toEqual([]);
    expect(slots(full, 1)).toEqual([0]);
    expect(slotsFor(full, 'LH', 0)).toEqual([0]);
  });

  it('automatic length stops at a placed rest', () => {
    const p = ok(placeRest(piece(), rest({ start: 960 })));
    expect(autoLength(p, 'RH', 0, 0, 'whole')).toBe('half');
    expect(autoLength(p, 'RH', 0, 0, 'quarter')).toBe('quarter');
  });
});

describe('a finger on a note (ft_1_02d.AC4)', () => {
  const at = { hand: 'RH' as const, bar: 0, start: 0, step: 'C' as const, octave: 4 };
  const one = () => ok(placeNote(piece(), note()));

  it('is set on the note and cleared again, and the note keeps its other fields', () => {
    const set = ok(setFinger(one(), at, 3));
    expect(set.notes[0]).toEqual({ ...note(), finger: 3 });
    const cleared = ok(setFinger(set, at, null));
    expect(cleared.notes[0]).toEqual(note());
    expect(cleared.notes[0]).not.toHaveProperty('finger');
  });

  it('refuses a finger outside 1 to 5 by the schema, and a note that is not there', () => {
    expect(() => editorPieceSchema.parse({ ...one(), notes: [{ ...note(), finger: 6 }] })).toThrow();
    expect(setFinger(piece(), at, 2)).toEqual({ ok: false, reason: 'no-note' });
  });

  it('is kept when the note changes its length or its pitch', () => {
    const fingered = ok(setFinger(one(), at, 2));
    expect(ok(setLength(fingered, at, 'half')).notes[0]!.finger).toBe(2);
    expect(ok(setPitch(fingered, at, 'D', 4)).notes[0]!.finger).toBe(2);
  });
});

describe('sixteenths and dotted quarters and eighths in the piece maker (core_09.AC55)', () => {
  it('core_09.AC55 places a sixteenth on any sixteenth of the bar, and nothing between', () => {
    const p = ok(placeNote(piece(), note({ start: 120, length: 'sixteenth' })));
    expect(p.notes[0]).toMatchObject({ start: 120, length: 'sixteenth' });
    expect(placeNote(piece(), note({ start: 60, length: 'sixteenth' }))).toEqual({ ok: false, reason: 'grid' });
  });

  it('core_09.AC55 a dotted quarter and an eighth, a dotted eighth and a sixteenth fill their beats; the piece reads back', () => {
    let p = piece();
    for (const [start, length] of [[0, 'dottedQuarter'], [720, 'eighth'], [960, 'dottedEighth'], [1320, 'sixteenth']] as const) p = ok(placeNote(p, note({ start, length })));
    expect(restsFor(p, 'RH').filter((r) => r.bar === 0)).toEqual([{ bar: 0, start: 1440, length: 'quarter' }]);
    expect(editorPieceSchema.parse(JSON.parse(JSON.stringify(p)))).toEqual(p);
  });

  it('core_09.AC55 free time is filled with plain rests, a sixteenth where a sixteenth is left', () => {
    const p = ok(placeNote(piece(), note({ start: 0, length: 'dottedEighth' })));
    expect(restsFor(p, 'RH').filter((r) => r.bar === 0).map((r) => [r.start, r.length])).toEqual([[360, 'sixteenth'], [480, 'quarter'], [960, 'half']]);
  });

  it('core_09.AC55 lengthening and shortening step over the dotted quarter and eighth; a note that has one steps to its neighbours', () => {
    const first = { hand: 'RH' as const, bar: 0, start: 0, step: 'C' as const, octave: 4 };
    const p = ok(placeNote(piece(), note({ length: 'dottedQuarter' })));
    expect(ok(lengthen(p, first)).notes[0]!.length).toBe('half');
    expect(ok(shorten(p, first)).notes[0]!.length).toBe('quarter');
    const q = ok(placeNote(piece(), note({ length: 'dottedEighth' })));
    expect(ok(lengthen(q, first)).notes[0]!.length).toBe('quarter');
    expect(ok(shorten(q, first)).notes[0]!.length).toBe('eighth');
  });

  it('core_09.AC55 a dotted length places its plain rest', () => {
    expect((['dottedHalf', 'dottedQuarter', 'dottedEighth', 'sixteenth'] as const).map(restLengthFor)).toEqual(['half', 'quarter', 'eighth', 'sixteenth']);
  });
});

describe('the accidental item', () => {
  it('core_09.AC8 cycles sharp, flat, natural and round', () => {
    expect([1, -1, 0].map((a) => nextAlter(a as 1 | -1 | 0))).toEqual([-1, 0, 1]);
  });
});

describe('Alt + Enter on a note', () => {
  it('ft_1_02d.AC22 gives the note the longest length that fits before the next note or the bar line', () => {
    const base = emptyPiece({ title: 'Fill', hands: 'RH', beats: 4, bars: 2 });
    const at = (start: number, length: EditorLength): EditorNote => ({ hand: 'RH', bar: 0, start, length, step: 'C', octave: 4, alter: 0 });
    const lone = { ...base, notes: [at(480, 'quarter')] };
    const made = longestFit(lone, { hand: 'RH', bar: 0, start: 480, step: 'C', octave: 4 });
    expect(made.ok && made.piece.notes[0]!.length).toBe('dottedHalf');
    const boxed = { ...base, notes: [at(0, 'quarter'), at(960, 'quarter')] };
    const half = longestFit(boxed, { hand: 'RH', bar: 0, start: 0, step: 'C', octave: 4 });
    expect(half.ok && half.piece.notes.find((n) => n.start === 0)!.length).toBe('half');
    const full = { ...base, notes: [at(0, 'whole')] };
    expect(longestFit(full, { hand: 'RH', bar: 0, start: 0, step: 'C', octave: 4 }).ok).toBe(false);
  });
});
