// Covers ft_0_16.AC7 (bar numbers setting).
import { describe, expect, it } from 'vitest';
import { BAR_NUMBER_MODES, DEFAULT_BAR_NUMBER_SETTINGS, barNumberSettingsSchema, barNumbersToShow } from './barNumbers';

const numbers = (mode: Parameters<typeof barNumbersToShow>[0], barCount: number, firstBar = 0, firstPrinted: 0 | 1 = 1) => barNumbersToShow(mode, barCount, firstBar, firstPrinted).map((b) => b.number);

describe('bar numbers', () => {
  it('default is off and the modes are the set ones, every bar added after first', () => {
    expect(DEFAULT_BAR_NUMBER_SETTINGS).toEqual({ mode: 'off' });
    expect(BAR_NUMBER_MODES).toEqual(['off', 'first', 'every', 'every2', 'every4']);
    expect(barNumberSettingsSchema.safeParse({ mode: 'every3' }).success).toBe(false);
  });

  it('every bar numbers each bar, in a section too, and a save from before it still reads', () => {
    expect(numbers('every', 5)).toEqual([1, 2, 3, 4, 5]);
    expect(numbers('every', 3, 5)).toEqual([6, 7, 8]);
    for (const mode of ['off', 'first', 'every2', 'every4']) expect(barNumberSettingsSchema.parse({ mode })).toEqual({ mode });
  });

  it('off shows nothing', () => {
    expect(barNumbersToShow('off', 8)).toEqual([]);
  });

  it('first shows only bar 1', () => {
    expect(barNumbersToShow('first', 8)).toEqual([{ index: 0, number: 1 }]);
  });

  it('every 2nd shows bars 1, 3, 5 ... and every 4th bars 1, 5, 9 ...', () => {
    expect(numbers('every2', 8)).toEqual([1, 3, 5, 7]);
    expect(numbers('every4', 10)).toEqual([1, 5, 9]);
  });

  it('a one-bar piece and an empty chart are fine', () => {
    expect(numbers('every4', 1)).toEqual([1]);
    expect(numbers('every2', 0)).toEqual([]);
  });

  it('a practised section keeps the numbers of the whole piece, and always labels its first bar', () => {
    // bars 6 to 12 of the piece (0-based 5 to 11) as a chart of 7 bars
    expect(barNumbersToShow('first', 7, 5)).toEqual([{ index: 0, number: 6 }]);
    expect(numbers('every2', 7, 5)).toEqual([6, 7, 9, 11]);
    expect(numbers('every4', 7, 5)).toEqual([6, 9]);
  });

  it('core_09.AC25 with a pick-up the first bar drawn is 0 and the first full bar 1, as printed; every 2nd is then 1, 3, 5', () => {
    expect(barNumbersToShow('first', 5, 0, 0)).toEqual([{ index: 0, number: 0 }]);
    expect(numbers('every', 5, 0, 0)).toEqual([0, 1, 2, 3, 4]);
    expect(numbers('every2', 6, 0, 0)).toEqual([0, 1, 3, 5]);
    // a section from the piece's bar index 3 is printed bar 3
    expect(barNumbersToShow('first', 2, 3, 0)).toEqual([{ index: 0, number: 3 }]);
  });
});
