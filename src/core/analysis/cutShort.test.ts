// Covers core_01 slice f3.
import { describe, expect, it } from 'vitest';
import type { BarPlay } from '../progression/practiceLog';
import { notesCutShort } from './cutShort';

const play = (extra: Partial<BarPlay> = {}): BarPlay => ({
  at: '1998-10-30T10:00:00Z', pieceId: 'echo', bar: 0, notes: 4, firstTry: 4, timing: null, mode: 'wait', tempoPercent: 100, section: null, misses: [], ...extra,
});

describe('notesCutShort', () => {
  it('is null for an empty list', () => {
    expect(notesCutShort([])).toBeNull();
  });

  it('is null when only Wait-mode plays are in the list', () => {
    expect(notesCutShort([play(), play({ bar: 1 })])).toBeNull();
  });

  it('sums short over the plays that have it', () => {
    expect(notesCutShort([play({ mode: 'tempo', short: 2 }), play(), play({ mode: 'tempo', short: 3 })])).toBe(5);
  });

  it('counts a play with short 0 as 0, not as null', () => {
    expect(notesCutShort([play({ mode: 'tempo', short: 0 })])).toBe(0);
  });
});
