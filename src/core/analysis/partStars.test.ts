// Covers core_06.AC7, core_06.AC8 (slice B).
import { describe, expect, it } from 'vitest';
import type { BarPlay } from '../progression/practiceLog';
import { partPlays, partStars } from './partStars.ts';

/**
 * One bar of a play. A play's bars are consecutive in the log with the same mode, tempo and section; `at` is NOT shared: the
 * recorder stamps each push, and a push may finish one bar. So the fixtures give every bar its own `at`, as the game does.
 */
const bar = (at: string, bar: number, notes: number, firstTry: number, section: BarPlay['section'] = null): BarPlay => ({
  at: `${at}-${bar}`, pieceId: 'p', bar, notes, firstTry, timing: null, mode: 'wait', tempoPercent: 100, section, misses: [],
});

describe('partPlays', () => {
  it('keeps only the plays that cover every bar of the part, and sums their bars', () => {
    // bars of one play arrive one at a time with different `at` values
    const plays = [
      bar('t1', 2, 4, 4), bar('t1', 3, 4, 2), // a whole-piece play covering bars 2 and 3
      bar('t2', 2, 4, 4), // a play that stopped after bar 2
      bar('t3', 2, 4, 3, { first: 2, last: 3 }), bar('t3', 3, 4, 3, { first: 2, last: 3 }), // a section play of the part
    ];
    expect(partPlays(plays, 2, 3)).toEqual([{ notes: 8, firstTry: 6 }, { notes: 8, firstTry: 6 }]);
  });
});

describe('partStars', () => {
  it('counts two laps of one section as two plays', () => {
    const laps = [bar('a', 2, 4, 4, { first: 2, last: 3 }), bar('a', 3, 4, 4, { first: 2, last: 3 }), bar('b', 2, 4, 0, { first: 2, last: 3 }), bar('b', 3, 4, 0, { first: 2, last: 3 })];
    expect(partPlays(laps, 2, 3)).toEqual([{ notes: 8, firstTry: 8 }, { notes: 8, firstTry: 0 }]);
    expect(partStars(laps, 2, 3)).toBe(5);
  });


  it('is 0 when the part was never played through, and the best stars of its complete plays otherwise', () => {
    expect(partStars([bar('t1', 2, 4, 4)], 2, 3)).toBe(0);
    const plays = [bar('t1', 2, 4, 2), bar('t1', 3, 4, 2), bar('t2', 2, 4, 4), bar('t2', 3, 4, 4)];
    expect(partStars(plays, 2, 3)).toBe(5);
  });

  it('grades a part out of five stars, as a piece', () => {
    // 15 of 16 right the first time is 94 percent: three of five stars, where the old three-star scale gave two
    expect(partStars([bar('t1', 2, 8, 8), bar('t1', 3, 8, 7)], 2, 3)).toBe(3);
    expect(partStars([bar('t1', 2, 10, 10), bar('t1', 3, 10, 9)], 2, 3)).toBe(4);
  });

  it('earns at least one star for a complete play, as a piece does (core_04)', () => {
    expect(partStars([bar('t1', 2, 4, 0), bar('t1', 3, 4, 0)], 2, 3)).toBe(1);
  });

  it('gives a bar with no notes full accuracy', () => {
    expect(partStars([bar('t1', 2, 0, 0), bar('t1', 3, 0, 0)], 2, 3)).toBe(5);
  });
});
