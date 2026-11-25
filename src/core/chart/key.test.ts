// Covers core_09.AC2.
import { describe, expect, it } from 'vitest';
import { keyAlters, keyAt, printedAccidentals, tonicStep } from './key';

const NATURAL = { C: 0, D: 0, E: 0, F: 0, G: 0, A: 0, B: 0 };

describe('key signature alterations', () => {
  it('C major and A minor have no alterations', () => {
    expect(keyAlters(0)).toEqual(NATURAL);
  });

  it('sharp keys add sharps in the order F C G D A E B', () => {
    expect(keyAlters(1)).toEqual({ ...NATURAL, F: 1 });
    expect(keyAlters(2)).toEqual({ ...NATURAL, F: 1, C: 1 });
    expect(keyAlters(3)).toEqual({ ...NATURAL, F: 1, C: 1, G: 1 });
    expect(keyAlters(7)).toEqual({ C: 1, D: 1, E: 1, F: 1, G: 1, A: 1, B: 1 });
  });

  it('flat keys add flats in the order B E A D G C F', () => {
    expect(keyAlters(-1)).toEqual({ ...NATURAL, B: -1 });
    expect(keyAlters(-2)).toEqual({ ...NATURAL, B: -1, E: -1 });
    expect(keyAlters(-7)).toEqual({ C: -1, D: -1, E: -1, F: -1, G: -1, A: -1, B: -1 });
  });

  it('every fifths value from -7 to 7 alters exactly |fifths| letters, all one way', () => {
    for (let fifths = -7; fifths <= 7; fifths++) {
      const alters = Object.values(keyAlters(fifths));
      const altered = alters.filter((a) => a !== 0);
      expect(altered).toHaveLength(Math.abs(fifths));
      expect(altered.every((a) => a === Math.sign(fifths))).toBe(true);
    }
  });

  it('refuses a value outside -7..7', () => {
    expect(() => keyAlters(8)).toThrow(RangeError);
    expect(() => keyAlters(-8)).toThrow(RangeError);
    expect(() => keyAlters(0.5)).toThrow(RangeError);
  });
});

// Covers core_09.AC3.
describe('core_09.AC3 printed accidentals', () => {
  const n = (step: 'C' | 'D' | 'E' | 'F' | 'G' | 'A' | 'B', alter: number, tick: number, octave = 4, bar?: number) =>
    bar === undefined ? { step, octave, alter, tick } : { step, octave, alter, tick, bar };

  it('core_09.AC3 prints a sharp in C major', () => {
    expect(printedAccidentals([n('F', 1, 0)], 0)).toEqual([1]);
  });

  it('core_09.AC3 prints a repeated sharp in the same bar once only', () => {
    expect(printedAccidentals([n('F', 1, 0), n('F', 1, 480)], 0)).toEqual([1, null]);
  });

  it('core_09.AC3 prints a natural that cancels a sharp of the signature', () => {
    expect(printedAccidentals([n('F', 0, 0)], 1)).toEqual([0]);
    expect(printedAccidentals([n('F', 1, 0)], 1)).toEqual([null]);
  });

  it('core_09.AC3 prints a natural after an accidental in the bar, and a flat after a sharp', () => {
    expect(printedAccidentals([n('C', 1, 0), n('C', 0, 480), n('C', 0, 960), n('C', -1, 1440)], 0)).toEqual([1, 0, null, -1]);
  });

  it('core_09.AC3 forgets the accidental at the bar line', () => {
    const notes = [n('F', 1, 0, 4, 1), n('F', 1, 480, 4, 1), n('F', 1, 960, 4, 2)];
    expect(printedAccidentals(notes, 0)).toEqual([1, null, 1]);
  });

  it('core_09.AC3 treats a different octave as a different pitch', () => {
    expect(printedAccidentals([n('F', 1, 0, 4), n('F', 1, 480, 5), n('F', 0, 960, 4)], 0)).toEqual([1, 1, 0]);
  });

  it('core_09.AC3 prints nothing for the letters the signature alters, for every fifths', () => {
    for (let fifths = -7; fifths <= 7; fifths++) {
      const alters = keyAlters(fifths);
      const notes = (['C', 'D', 'E', 'F', 'G', 'A', 'B'] as const).map((step, i) => n(step, alters[step], i * 480));
      expect(printedAccidentals(notes, fifths)).toEqual(notes.map(() => null));
    }
  });

  it('core_09.AC11 a tied accidental holds into the next bar, which prints none', () => {
    const tied = { ...n('F', 1, 0, 4, 1), tieNext: true };
    expect(printedAccidentals([tied, n('F', 1, 1920, 4, 2)], 0)).toEqual([1, null]);
  });

  it('core_09.AC11 a tie does not hold a different pitch or an untied note across the bar line', () => {
    expect(printedAccidentals([{ ...n('F', 1, 0, 4, 1), tieNext: true }, n('G', 1, 1920, 4, 2)], 0)).toEqual([1, 1]);
    expect(printedAccidentals([n('F', 1, 0, 4, 1), n('F', 1, 1920, 4, 2)], 0)).toEqual([1, 1]);
  });

  it('core_09.AC3 returns an empty list for no notes', () => {
    expect(printedAccidentals([], 0)).toEqual([]);
  });
});

// Covers core_09.AC56.
describe('core_09.AC56 the key of each bar', () => {
  const keyMap = [{ tick: 0, fifths: -3 }, { tick: 3840, fifths: -4 }];
  const n = (step: 'D' | 'F', alter: number, tick: number, bar: number) => ({ step, octave: 4, alter, tick, bar });

  it('core_09.AC56 keyAt gives the entry in force at a tick', () => {
    expect(keyAt(keyMap, 0).fifths).toBe(-3);
    expect(keyAt(keyMap, 3839).fifths).toBe(-3);
    expect(keyAt(keyMap, 3840).fifths).toBe(-4);
    expect(keyAt(keyMap, 99999).fifths).toBe(-4);
  });

  it('core_09.AC56 a note follows the signature of its own bar', () => {
    // C minor has D natural; from the change A-flat major flats D, so a D flat prints nothing and a D natural prints its sign
    const notes = [n('D', 0, 0, 0), n('D', -1, 3840, 2), n('D', 0, 5760, 3)];
    expect(printedAccidentals(notes, keyMap)).toEqual([null, null, 0]);
  });

  it('core_09.AC56 one fifths number is a key for the whole staff, as before', () => {
    expect(printedAccidentals([n('D', -1, 0, 0)], -4)).toEqual(printedAccidentals([n('D', -1, 0, 0)], [{ tick: 0, fifths: -4 }]));
  });
});

describe('the tonic of a key', () => {
  it('is the letter of the major or minor key the signature names', () => {
    expect([tonicStep(0, 'major'), tonicStep(0, 'minor')]).toEqual(['C', 'A']);
    expect([tonicStep(-1, 'major'), tonicStep(-1, 'minor')]).toEqual(['F', 'D']);
    expect([tonicStep(-3, 'major'), tonicStep(-3, 'minor')]).toEqual(['E', 'C']);
    expect([tonicStep(2, 'major'), tonicStep(2, 'minor')]).toEqual(['D', 'B']);
    expect([tonicStep(7, 'major'), tonicStep(-7, 'minor')]).toEqual(['C', 'A']);
  });
});
