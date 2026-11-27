import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { emptyPiece, LENGTH_TICKS, pieceProblem, placedRests, type EditorHand, type EditorPiece } from './model';
import { startEntry, entryDown, entryTick, entryUp, entryBackspace, moveCursor, nextEntryPlace, type EntryOptions, type EntryState } from './entryMachine';

const NOTES: EntryOptions = { staff: 'auto', shortTapEighth: false, rests: false };
const TAP_EIGHTH: EntryOptions = { ...NOTES, shortTapEighth: true };
const RESTS: EntryOptions = { ...NOTES, rests: true };

const fresh = (bars = 8, hands: 'RH' | 'LH' | 'both' = 'both'): EditorPiece => emptyPiece({ title: 'T', hands, beats: 4, bars });

/** One key hold: down at `from`, up at `to`. */
function press(s: EntryState, key: number | 'space', from: number, to: number, o: EntryOptions = NOTES): EntryState {
  return entryUp(entryDown(s, key, from, o), key, to, o);
}

const starts = (s: EntryState, hand: EditorHand = 'RH') => s.piece.notes.filter((n) => n.hand === hand).map((n) => [n.start, n.step + n.octave, n.length]);

// ft_1_02d.AC10
describe('entry: single notes', () => {
  it('two quarter taps in the right hand are two quarters at 0 and 480', () => {
    let s = startEntry(fresh());
    s = press(s, 72, 0, 100);
    s = press(s, 72, 500, 600);
    expect(s.piece.notes.map((n) => [n.hand, n.bar, n.start, n.length, n.octave])).toEqual([
      ['RH', 0, 0, 'quarter', 5],
      ['RH', 0, 480, 'quarter', 5],
    ]);
  });

  it('a hold lengthens the note: half, dotted half, whole', () => {
    expect(starts(press(startEntry(fresh()), 72, 0, 1500))).toEqual([[0, 'C5', 'half']]);
    expect(starts(press(startEntry(fresh()), 72, 0, 2500))).toEqual([[0, 'C5', 'dottedHalf']]);
    expect(starts(press(startEntry(fresh()), 72, 0, 3500))).toEqual([[0, 'C5', 'whole']]);
  });

  it('a hold grows live on entryTick and never shrinks', () => {
    const down = entryDown(startEntry(fresh()), 72, 0, NOTES);
    expect(starts(entryTick(down, 500))).toEqual([[0, 'C5', 'quarter']]);
    expect(starts(entryTick(down, 1200))).toEqual([[0, 'C5', 'half']]);
    expect(starts(entryTick(entryTick(down, 1200), 500))).toEqual([[0, 'C5', 'half']]);
  });

  it('a short tap is an eighth only when the short-tap toggle is on', () => {
    expect(starts(press(startEntry(fresh()), 72, 0, 100, TAP_EIGHTH))).toEqual([[0, 'C5', 'eighth']]);
    expect(starts(press(startEntry(fresh()), 72, 0, 100, NOTES))).toEqual([[0, 'C5', 'quarter']]);
  });

  it('a note never grows past the bar line: a quarter room holds a quarter at most', () => {
    const s = moveCursor(startEntry(fresh()), 'RH', 0, 1440);
    const held = entryTick(entryDown(s, 72, 0, NOTES), 3500);
    expect(starts(entryUp(held, 72, 3500, NOTES))).toEqual([[1440, 'C5', 'quarter']]);
  });
});

// ft_1_02d.AC10
describe('entry: chords', () => {
  it('keys pressed within the chord window are one chord of one length', () => {
    let s = startEntry(fresh());
    s = entryDown(s, 72, 0, NOTES);
    s = entryDown(s, 76, 30, NOTES);
    s = entryDown(s, 79, 70, NOTES);
    s = entryUp(entryUp(entryUp(s, 72, 300, NOTES), 76, 300, NOTES), 79, 300, NOTES);
    expect(s.items).toHaveLength(1);
    expect(s.piece.notes.map((n) => [n.start, n.length, n.octave, n.step])).toEqual([
      [0, 'quarter', 5, 'C'],
      [0, 'quarter', 5, 'E'],
      [0, 'quarter', 5, 'G'],
    ]);
  });

  it('keys 200 ms apart are two notes', () => {
    let s = press(startEntry(fresh()), 72, 0, 100);
    s = press(s, 76, 200, 300);
    expect(starts(s)).toEqual([[0, 'C5', 'quarter'], [480, 'E5', 'quarter']]);
  });
});

// ft_1_02d.AC9
describe('entry: staves', () => {
  it('auto splits at middle C: 48 goes to the left hand at its cursor', () => {
    let s = press(startEntry(fresh()), 72, 0, 100);
    s = press(s, 72, 500, 600);
    s = press(s, 48, 1000, 1100);
    expect(starts(s, 'LH')).toEqual([[0, 'C3', 'quarter']]);
    expect(starts(s, 'RH')).toHaveLength(2);
  });

  it('a chord across middle C (60 and 59 within 80 ms) gives one right-hand and one left-hand entry', () => {
    let s = entryDown(startEntry(fresh()), 60, 0, NOTES);
    s = entryDown(s, 59, 40, NOTES);
    s = entryUp(entryUp(s, 60, 300, NOTES), 59, 300, NOTES);
    expect(s.items.map((i) => i.hand)).toEqual(['RH', 'LH']);
    expect(starts(s, 'RH')).toEqual([[0, 'C4', 'quarter']]);
    expect(starts(s, 'LH')).toEqual([[0, 'B3', 'quarter']]);
  });

  it('a fixed staff puts any pitch on it', () => {
    const s = press(startEntry(fresh()), 59, 0, 100, { ...NOTES, staff: 'RH' });
    expect(s.items[0]?.hand).toBe('RH');
    expect(s.piece.notes[0]?.hand).toBe('RH');
  });
});

// ft_1_02d.AC12
describe('entry: rests', () => {
  it('a held key in rest mode places a half rest in the right hand, and a low key a rest in the left', () => {
    let s = press(startEntry(fresh()), 72, 0, 1500, RESTS);
    expect(placedRests(s.piece)).toEqual([{ hand: 'RH', bar: 0, start: 0, length: 'half' }]);
    s = press(s, 48, 2000, 2100, RESTS);
    expect(placedRests(s.piece).find((r) => r.hand === 'LH')).toEqual({ hand: 'LH', bar: 0, start: 0, length: 'quarter' });
    expect(s.piece.notes).toEqual([]);
  });

  it('space writes a rest on the last hand', () => {
    let s = press(startEntry(fresh()), 48, 0, 100, RESTS);
    s = press(s, 'space', 1000, 1100, RESTS);
    expect(placedRests(s.piece).filter((r) => r.hand === 'LH').map((r) => r.start)).toEqual([0, 480]);
  });

  it('a dotted half held becomes a half rest', () => {
    const s = press(startEntry(fresh()), 72, 0, 2500, RESTS);
    expect(placedRests(s.piece)).toEqual([{ hand: 'RH', bar: 0, start: 0, length: 'half' }]);
  });
});

// ft_1_02d.AC11
describe('entry: backspace', () => {
  it('removes the last entry and the cursor moves back', () => {
    let s = press(startEntry(fresh()), 72, 0, 100);
    s = press(s, 74, 500, 600);
    s = entryBackspace(s);
    expect(s.piece.notes.map((n) => n.step)).toEqual(['C']);
    expect(s.lastHand).toBe('RH');
  });

  it('two entries then two backspaces return to the empty piece', () => {
    const start = startEntry(fresh());
    let s = press(press(start, 72, 0, 100), 74, 500, 600);
    s = entryBackspace(entryBackspace(s));
    expect(s.piece.notes).toEqual(start.piece.notes);
    expect(placedRests(s.piece)).toEqual([]);
    expect(s.lastHand).toBeNull();
    expect(entryBackspace(s)).toBe(s);
  });

  it('backspace on a chord removes all of its notes', () => {
    let s = entryDown(startEntry(fresh()), 72, 0, NOTES);
    s = entryDown(s, 76, 30, NOTES);
    s = entryUp(entryUp(s, 72, 300, NOTES), 76, 300, NOTES);
    expect(entryBackspace(s).piece.notes).toEqual([]);
  });

  it('does nothing to an entry that is still held', () => {
    const s = entryDown(startEntry(fresh()), 72, 0, NOTES);
    expect(entryBackspace(s)).toBe(s);
  });
});

describe('entry: auto-repeat and bars', () => {
  it('a second key down of a held key changes nothing', () => {
    const s = entryDown(startEntry(fresh()), 72, 0, NOTES);
    expect(entryDown(s, 72, 50, NOTES)).toBe(s);
  });

  it('a key past the last bar of a full piece adds four bars', () => {
    let s = startEntry(fresh(4, 'RH'));
    for (const at of [0, 4000, 8000, 12000]) s = press(s, 72, at, at + 3500);
    expect(s.piece.bars).toBe(4);
    s = press(s, 72, 16000, 16100);
    expect(s.piece.bars).toBe(8);
    expect(s.piece.notes.at(-1)).toMatchObject({ bar: 4, start: 0 });
  });
});

describe('entry: moveCursor', () => {
  it('a key at a moved cursor writes there once, then continues from the staff cursor', () => {
    let s = moveCursor(startEntry(fresh(4, 'RH')), 'RH', 1, 0);
    s = press(s, 72, 0, 100);
    s = press(s, 72, 500, 600);
    expect(s.piece.notes.map((n) => [n.bar, n.start])).toEqual([[1, 0], [1, 480]]);
    expect(s.cursors.RH).toBeUndefined();
  });
});

describe('entry: properties', () => {
  const opArb = fc.oneof(
    fc.record({ k: fc.constant('down' as const), key: fc.oneof(fc.integer({ min: 36, max: 96 }), fc.constant('space' as const)), dt: fc.integer({ min: 0, max: 2500 }) }),
    fc.record({ k: fc.constant('up' as const), key: fc.oneof(fc.integer({ min: 36, max: 96 }), fc.constant('space' as const)), dt: fc.integer({ min: 0, max: 2500 }) }),
    fc.record({ k: fc.constant('tick' as const), dt: fc.integer({ min: 0, max: 2500 }) }),
    fc.record({ k: fc.constant('back' as const), dt: fc.integer({ min: 0, max: 2500 }) }),
    fc.record({ k: fc.constant('move' as const), dt: fc.integer({ min: 0, max: 2500 }), hand: fc.constantFrom('RH' as const, 'LH' as const), bar: fc.integer({ min: 0, max: 9 }), start: fc.integer({ min: 0, max: 7 }).map((n) => n * 240) }),
  );
  const optsArb = fc.record({
    staff: fc.constantFrom('auto' as const, 'RH' as const, 'LH' as const),
    shortTapEighth: fc.boolean(),
    rests: fc.boolean(),
  });

  it('after any event stream the piece is valid and no note crosses its bar', () => {
    fc.assert(fc.property(fc.array(opArb, { maxLength: 80 }), optsArb, fc.constantFrom(2 as const, 3 as const, 4 as const), (ops, o, beats) => {
      let s = startEntry(emptyPiece({ title: 'P', hands: 'both', beats, bars: 4 }));
      let now = 0;
      const held: (number | 'space')[] = [];
      for (const op of ops) {
        now += op.dt;
        if (op.k === 'down') { s = entryDown(s, op.key, now, o); if (!held.includes(op.key)) held.push(op.key); }
        else if (op.k === 'up') { s = entryUp(s, op.key, now, o); }
        else if (op.k === 'tick') s = entryTick(s, now);
        else if (op.k === 'back') s = entryBackspace(s);
        else s = moveCursor(s, op.hand, op.bar, op.start);
        expect(pieceProblem(s.piece)).toBeNull();
        for (const n of s.piece.notes) expect(n.start + LENGTH_TICKS[n.length]).toBeLessThanOrEqual(beats * 480);
      }
    }), { seed: 20260, numRuns: 200 });
  });
});

describe('where the next played key goes (ft_1_02d.AC15)', () => {
  it('ft_1_02d.AC15 after played keys the next place is after them, once a cursor set before is used up', () => {
    let s = moveCursor(startEntry(fresh()), 'RH', 2, 480);
    expect(nextEntryPlace(s, 'RH')).toEqual({ bar: 2, start: 480 });
    s = press(s, 60, 0, 100);
    expect(nextEntryPlace(s, 'RH')).toEqual({ bar: 2, start: 960 });
    s = press(s, 62, 1000, 1100);
    expect(nextEntryPlace(s, 'RH')).toEqual({ bar: 2, start: 1440 });
    // an empty staff starts at the top
    expect(nextEntryPlace(s, 'LH')).toEqual({ bar: 0, start: 0 });
  });
});
