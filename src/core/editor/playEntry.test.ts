import { describe, expect, it } from 'vitest';
import { emptyPiece, MAX_BARS, placeNote, placeRest, type EditorPiece, type Edit } from './model';
import { cursorAfter, cursorOf, ENTRY_CONFIG, ensureBars, lengthForHold, restLengthFor, spellKey, staffFor } from './playEntry';

const ok = (edit: Edit): EditorPiece => {
  if (!edit.ok) throw new Error(`refused: ${edit.reason}`);
  return edit.piece;
};

describe('ENTRY_CONFIG', () => {
  it('has the hold bands in milliseconds', () => {
    expect(ENTRY_CONFIG).toEqual({ tapMs: 150, chordMs: 80, halfMs: 1000, dottedHalfMs: 2000, wholeMs: 3000 });
  });
});

// ft_1_02d.AC10
describe('lengthForHold', () => {
  it('a short tap is an eighth when the toggle is on', () => {
    expect(lengthForHold(0, true)).toBe('eighth');
    expect(lengthForHold(100, true)).toBe('eighth');
    expect(lengthForHold(149, true)).toBe('eighth');
  });

  it('a short tap is a quarter when the toggle is off', () => {
    expect(lengthForHold(100, false)).toBe('quarter');
    expect(lengthForHold(0, false)).toBe('quarter');
  });

  it('a hold from the tap band up to a second is a quarter, whatever the toggle', () => {
    expect(lengthForHold(150, true)).toBe('quarter');
    expect(lengthForHold(150, false)).toBe('quarter');
    expect(lengthForHold(999, true)).toBe('quarter');
  });

  it('a hold of one to two seconds is a half', () => {
    expect(lengthForHold(1000, true)).toBe('half');
    expect(lengthForHold(1999, false)).toBe('half');
  });

  it('a hold of two to three seconds is a dotted half', () => {
    expect(lengthForHold(2000, true)).toBe('dottedHalf');
    expect(lengthForHold(2999, false)).toBe('dottedHalf');
  });

  it('a hold of three seconds or more is a whole', () => {
    expect(lengthForHold(3000, true)).toBe('whole');
    expect(lengthForHold(10000, false)).toBe('whole');
  });
});

// ft_1_02d.AC12
describe('restLengthFor', () => {
  it('a dotted half rest is written as a half rest', () => {
    expect(restLengthFor('dottedHalf')).toBe('half');
  });

  it('other lengths stay as they are', () => {
    expect(restLengthFor('whole')).toBe('whole');
    expect(restLengthFor('half')).toBe('half');
    expect(restLengthFor('quarter')).toBe('quarter');
    expect(restLengthFor('eighth')).toBe('eighth');
  });
});

// ft_1_02d.AC9
describe('staffFor', () => {
  it('auto puts B3 on the left hand and middle C on the right', () => {
    expect(staffFor(59, 'auto')).toBe('LH');
    expect(staffFor(60, 'auto')).toBe('RH');
  });

  it('a fixed staff is returned as it is, whatever the pitch', () => {
    expect(staffFor(59, 'RH')).toBe('RH');
    expect(staffFor(59, 'LH')).toBe('LH');
    expect(staffFor(72, 'LH')).toBe('LH');
  });
});

describe('spellKey', () => {
  const cMajor = { fifths: 0 };
  const fMajor = { fifths: -1 };

  it('in C major, MIDI 61 is C sharp (sharps for black keys)', () => {
    expect(spellKey(cMajor, 61)).toEqual({ step: 'C', octave: 4, alter: 1 });
  });

  it('in F major (one flat), MIDI 70 is B flat', () => {
    expect(spellKey(fMajor, 70)).toEqual({ step: 'B', octave: 4, alter: -1 });
  });

  it('in F major, MIDI 61 is D flat', () => {
    expect(spellKey(fMajor, 61)).toEqual({ step: 'D', octave: 4, alter: -1 });
  });

  it('in C major, MIDI 70 is A sharp', () => {
    expect(spellKey(cMajor, 70)).toEqual({ step: 'A', octave: 4, alter: 1 });
  });

  it('a white key is a natural in any key', () => {
    expect(spellKey(fMajor, 60)).toEqual({ step: 'C', octave: 4, alter: 0 });
  });
});

// ft_1_02d.AC9
describe('cursorOf', () => {
  const blank = () => emptyPiece({ title: 't', hands: 'both', beats: 4, bars: 4 });

  it('an empty hand starts at bar 0, tick 0', () => {
    expect(cursorOf(blank(), 'RH')).toEqual({ bar: 0, start: 0 });
  });

  it('after two quarter notes the cursor is at tick 960 of bar 0', () => {
    let p = blank();
    p = ok(placeNote(p, { hand: 'RH', bar: 0, start: 0, length: 'quarter', step: 'C', octave: 4 }));
    p = ok(placeNote(p, { hand: 'RH', bar: 0, start: 480, length: 'quarter', step: 'D', octave: 4 }));
    expect(cursorOf(p, 'RH')).toEqual({ bar: 0, start: 960 });
  });

  it('after a full bar the cursor is at the start of the next bar', () => {
    const p = ok(placeNote(blank(), { hand: 'RH', bar: 0, start: 0, length: 'whole', step: 'C', octave: 4 }));
    expect(cursorOf(p, 'RH')).toEqual({ bar: 1, start: 0 });
  });

  it('a placed rest counts as time taken', () => {
    const p = ok(placeRest(blank(), { hand: 'RH', bar: 0, start: 0, length: 'quarter' }));
    expect(cursorOf(p, 'RH')).toEqual({ bar: 0, start: 480 });
  });

  it('the cursor of one hand ignores the other hand', () => {
    const p = ok(placeNote(blank(), { hand: 'LH', bar: 0, start: 0, length: 'half', step: 'C', octave: 3 }));
    expect(cursorOf(p, 'RH')).toEqual({ bar: 0, start: 0 });
    expect(cursorOf(p, 'LH')).toEqual({ bar: 0, start: 960 });
  });

  it('a full last bar has no cursor (null)', () => {
    const p = ok(placeNote(emptyPiece({ title: 't', hands: 'both', beats: 4, bars: 2 }), { hand: 'RH', bar: 1, start: 0, length: 'whole', step: 'C', octave: 4 }));
    expect(cursorOf(p, 'RH')).toBeNull();
  });
});

describe('ensureBars', () => {
  it('returns the piece as it is when the bar exists', () => {
    const p = emptyPiece({ title: 't', hands: 'both', beats: 4, bars: 4 });
    expect(ensureBars(p, 3)).toBe(p);
  });

  it('adds four bars when the bar is past the end', () => {
    const p = emptyPiece({ title: 't', hands: 'both', beats: 4, bars: 4 });
    expect(ensureBars(p, 4).bars).toBe(8);
  });

  it('keeps the notes it has', () => {
    const p = ok(placeNote(emptyPiece({ title: 't', hands: 'both', beats: 4, bars: 4 }), { hand: 'RH', bar: 0, start: 0, length: 'quarter', step: 'C', octave: 4 }));
    expect(ensureBars(p, 4).notes).toEqual(p.notes);
  });

  it('stops at MAX_BARS', () => {
    const p = emptyPiece({ title: 't', hands: 'both', beats: 4, bars: 30 });
    expect(ensureBars(p, 30).bars).toBe(MAX_BARS);
    expect(ensureBars(emptyPiece({ title: 't', hands: 'both', beats: 4, bars: MAX_BARS }), MAX_BARS).bars).toBe(MAX_BARS);
  });
});

// ft_1_02d.AC9 (a click on a shadow note moves the cursor to the end of what it wrote)
describe('cursorAfter', () => {
  const base = emptyPiece({ title: 't', hands: 'both', beats: 4, bars: 4 });
  it('is the end of the note at that place', () => {
    const piece = ok(placeNote(base, { hand: 'RH', bar: 0, start: 0, length: 'quarter', step: 'C', octave: 5 }));
    expect(cursorAfter(piece, 'RH', 0, 0)).toEqual({ bar: 0, start: 480 });
  });
  it('counts a placed rest and moves to the next bar at the bar end', () => {
    const piece = ok(placeRest(base, { hand: 'LH', bar: 1, start: 0, length: 'whole' }));
    expect(cursorAfter(piece, 'LH', 1, 0)).toEqual({ bar: 2, start: 0 });
  });
  it('is null with nothing there or past the last bar', () => {
    expect(cursorAfter(base, 'RH', 0, 0)).toBeNull();
    const piece = ok(placeRest(base, { hand: 'RH', bar: 3, start: 0, length: 'whole' }));
    expect(cursorAfter(piece, 'RH', 3, 0)).toBeNull();
  });
});
