// Covers ft_1_11.AC1.
import { describe, expect, it } from 'vitest';
import type { Bitmap } from './bitmap';
import { C } from './palette';
import { SYMBOL_HEIGHT, SYMBOL_WIDTH, durationSymbol, linesSymbol, scoreSymbol, staffGapSymbol } from './settingArt';

const same = (a: Bitmap, b: Bitmap) => a.pixels.every((p, i) => p === b.pixels[i]);
const count = (b: Bitmap, colour: number) => b.pixels.filter((p) => p === colour).length;

const SETTINGS: Record<string, Bitmap[]> = {
  score: (['off', 'colour', 'number'] as const).map(scoreSymbol),
  staffGap: (['short', 'wide'] as const).map(staffGapSymbol),
  lines: ([1, 2, 'all'] as const).map(linesSymbol),
  durationRH: (['off', 'ghost', 'band', 'both'] as const).map((m) => durationSymbol(m, 'RH')),
  durationLH: (['off', 'ghost', 'band', 'both'] as const).map((m) => durationSymbol(m, 'LH')),
};

describe('settings button pictures', () => {
  it.each(Object.entries(SETTINGS))('every choice of %s has a picture of the same size, and no two choices look alike', (_name, pictures) => {
    for (const p of pictures) expect([p.width, p.height]).toEqual([SYMBOL_WIDTH, SYMBOL_HEIGHT]);
    for (let i = 0; i < pictures.length; i++) for (let j = i + 1; j < pictures.length; j++) expect(same(pictures[i]!, pictures[j]!), `choices ${i} and ${j}`).toBe(false);
  });

  it('the timing view looks like play: off is all black notes, colours adds the gold and red of mistimed and missed notes', () => {
    expect(count(scoreSymbol('off'), C.gold) + count(scoreSymbol('off'), C.red)).toBe(0);
    expect(count(scoreSymbol('colour'), C.gold)).toBeGreaterThan(0);
    expect(count(scoreSymbol('colour'), C.red)).toBeGreaterThan(0);
    expect(count(scoreSymbol('number'), C.red)).toBe(0);
  });

  it('ft_1_11.AC1: a hand\'s note length button shows the ghost head (A), the band (B), both or neither on that hand\'s staff only', () => {
    const half = SYMBOL_HEIGHT / 2;
    const where = (b: Bitmap, colour: number) => new Set([...b.pixels.keys()].filter((i) => b.pixels[i] === colour).map((i) => (Math.floor(i / b.width) < half ? 'upper' : 'lower')));
    for (const [hand, staff] of [['RH', 'upper'], ['LH', 'lower']] as const) {
      expect([...where(durationSymbol('off', hand), C.blue), ...where(durationSymbol('off', hand), C.blueLight)]).toEqual([]);
      expect([...where(durationSymbol('ghost', hand), C.blue)]).toEqual([staff]);
      expect([...where(durationSymbol('ghost', hand), C.blueLight)]).toEqual([]);
      expect([...where(durationSymbol('band', hand), C.blueLight)]).toEqual([staff]);
      expect([...where(durationSymbol('band', hand), C.blue)]).toEqual([]);
      expect([...where(durationSymbol('both', hand), C.blue)]).toEqual([staff]);
      expect([...where(durationSymbol('both', hand), C.blueLight)]).toEqual([staff]);
    }
  });


});
