import { describe, expect, it } from 'vitest';
import { isBlackKey } from '../../core/chart/pitch';
import { BLACK_KEY_WIDTH, keyboardLayout, midiName } from './keyboardLayout';

describe('keyboardLayout', () => {
  it('lays out the 61 keys of the EZ-220: 36 white and 25 black', () => {
    const layout = keyboardLayout(36, 96);
    expect(layout.keys).toHaveLength(61);
    expect(layout.whiteCount).toBe(36);
    expect(layout.keys.filter((k) => k.black)).toHaveLength(25);
  });

  it('puts white keys side by side and black keys centred on the gap between their neighbours', () => {
    const { keys } = keyboardLayout(60, 72); // C4..C5
    const white = keys.filter((k) => !k.black);
    expect(white.map((k) => k.x)).toEqual([0, 1, 2, 3, 4, 5, 6, 7]);
    const cSharp = keys.find((k) => k.midi === 61)!;
    expect(cSharp.x + cSharp.width / 2).toBeCloseTo(1); // the line between C and D
    expect(cSharp.width).toBe(BLACK_KEY_WIDTH);
  });

  it('has no black key between E and F or B and C', () => {
    const { keys } = keyboardLayout(60, 72);
    const blackMidis = keys.filter((k) => k.black).map((k) => k.midi);
    expect(blackMidis).toEqual([61, 63, 66, 68, 70]);
  });

  it('keeps every key inside the keyboard width', () => {
    const { keys, whiteCount } = keyboardLayout(36, 96);
    for (const k of keys) {
      expect(k.x).toBeGreaterThanOrEqual(-BLACK_KEY_WIDTH / 2);
      expect(k.x + k.width).toBeLessThanOrEqual(whiteCount + 1e-9);
    }
  });

  it('refuses ranges that start or end on a black key or are reversed', () => {
    expect(() => keyboardLayout(61, 72)).toThrow(RangeError);
    expect(() => keyboardLayout(60, 73)).toThrow(RangeError);
    expect(() => keyboardLayout(72, 60)).toThrow(RangeError);
  });

  it('tells black from white and names notes', () => {
    expect([60, 61, 62, 63, 64, 65, 66].map(isBlackKey)).toEqual([false, true, false, true, false, false, true]);
    expect(midiName(60)).toBe('C4');
    expect(midiName(61)).toBe('C#4');
    expect(midiName(36)).toBe('C2');
  });
});
