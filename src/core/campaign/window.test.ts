// Covers ft_1_06.AC2 (the find-the-key window).
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { buildBars, type MeterChange, type TempoChange } from '../chart/time';
import { findKeyWindowMs, partPlayingMs } from './window';

/** A part of `bars` bars in one meter and one tempo. */
const part = (bars: number, bpm: number, meter: Omit<MeterChange, 'tick'> = { num: 4, den: 4 }) => ({
  tempoMap: [{ tick: 0, bpm }] as TempoChange[],
  bars: buildBars([{ tick: 0, ...meter }], bars),
});

describe('find-the-key window', () => {
  it('ft_1_06.AC2 the base is the part at its own tempo: bars × beats per bar × 60000 / BPM', () => {
    expect(partPlayingMs(part(4, 120), [1, 4])).toBe(8000);
    expect(partPlayingMs(part(32, 60), [1, 32])).toBe(128000);
    expect(partPlayingMs(part(8, 90, { num: 3, den: 4 }), [1, 8])).toBe(16000);
  });

  it('ft_1_06.AC2 BPM counts quarter notes, as in the rest of the core: a 6/8 bar at 60 is 3 seconds', () => {
    expect(partPlayingMs(part(2, 60, { num: 6, den: 8 }), [1, 2])).toBe(6000);
  });

  it('ft_1_06.AC2 only the level\'s bars count, and a tempo change inside them is followed', () => {
    const chart = { tempoMap: [{ tick: 0, bpm: 120 }, { tick: 1920 * 2, bpm: 60 }], bars: buildBars([{ tick: 0, num: 4, den: 4 }], 8) };
    expect(partPlayingMs(chart, [1, 2])).toBe(4000);
    expect(partPlayingMs(chart, [1, 4])).toBe(4000 + 8000);
  });

  it('ft_1_06.AC2 the window is the base times the level\'s factor', () => {
    expect(findKeyWindowMs(part(4, 120), [1, 4], 3)).toBe(24000);
    expect(findKeyWindowMs(part(4, 120), [1, 4], 1.5)).toBe(12000);
    expect(findKeyWindowMs(part(4, 120), [1, 4], 1)).toBe(8000);
  });

  it('ft_1_06.AC2 the worked example: 8 bars of 4/4 at 90 BPM give 64000 ms on level 1 and 32000 ms on level 3', () => {
    expect(findKeyWindowMs(part(8, 90), [1, 8], 3)).toBe(64000);
    expect(findKeyWindowMs(part(8, 90), [1, 8], 1.5)).toBe(32000);
  });

  it('ft_1_06.AC2 the window is whole milliseconds, rounded up so it is never shorter than asked', () => {
    expect(findKeyWindowMs(part(1, 70), [1, 1], 1)).toBe(Math.ceil(240000 / 70));
  });

  it('rejects a factor below 1 (the window would be shorter than the part) and a bar range outside the chart', () => {
    expect(() => findKeyWindowMs(part(4, 120), [1, 4], 0.9)).toThrow(/factor/);
    expect(() => findKeyWindowMs(part(4, 120), [1, 4], Number.NaN)).toThrow(/factor/);
    expect(() => partPlayingMs(part(4, 120), [1, 5])).toThrow(/bars/);
    expect(() => partPlayingMs(part(4, 120), [0, 2])).toThrow(/bars/);
    expect(() => partPlayingMs(part(4, 120), [3, 2])).toThrow(/bars/);
  });

  const bpm = fc.integer({ min: 30, max: 240 });
  const factor = fc.double({ min: 1, max: 5, noNaN: true });
  const meter = fc.constantFrom({ num: 2, den: 4 }, { num: 3, den: 4 }, { num: 4, den: 4 }, { num: 6, den: 8 });

  it('ft_1_06.AC2 property: the window grows with the number of bars', () => {
    fc.assert(fc.property(fc.integer({ min: 1, max: 31 }), bpm, factor, meter, (bars, b, f, m) => {
      const chart = part(32, b, m);
      expect(findKeyWindowMs(chart, [1, bars + 1], f)).toBeGreaterThan(findKeyWindowMs(chart, [1, bars], f));
    }));
  });

  it('ft_1_06.AC2 property: the window shrinks as the BPM goes up', () => {
    fc.assert(fc.property(fc.integer({ min: 1, max: 32 }), bpm, fc.integer({ min: 1, max: 60 }), factor, meter, (bars, b, faster, f, m) => {
      expect(findKeyWindowMs(part(bars, b + faster, m), [1, bars], f)).toBeLessThan(findKeyWindowMs(part(bars, b, m), [1, bars], f));
    }));
  });

  it('ft_1_06.AC2 property: the window is never below the part\'s own playing time', () => {
    fc.assert(fc.property(fc.integer({ min: 1, max: 32 }), bpm, factor, meter, (bars, b, f, m) => {
      const chart = part(bars, b, m);
      expect(findKeyWindowMs(chart, [1, bars], f)).toBeGreaterThanOrEqual(partPlayingMs(chart, [1, bars]));
    }));
  });
});
