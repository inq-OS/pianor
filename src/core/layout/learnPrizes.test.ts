// Covers ft_1_32.AC19.
import { describe, expect, it } from 'vitest';
import type { LearnRewards } from '../learn/progress';
import type { PrizeFocus } from '../learn/view';
import { PRIZE, prizeColumn, prizeRoom } from './learnPrizes';

const S = 10;
/** One system whose top line is at y 100, the piece's final bar line at x 400. */
const layout = {
  staffSpace: S,
  systems: [{ topLineY: 100 }],
  barlines: [{ system: 0, x: 20, y1: 100, y2: 140, kind: 'start' as const }, { system: 0, x: 400, y1: 100, y2: 140, kind: 'final' as const }],
};
const focus = (over: Partial<PrizeFocus> = {}): PrizeFocus => ({ chunk: 0, bars: [0], chunks: [], clef: false, ...over });
const fresh: LearnRewards = { chunks: [0, 1, 2].map(() => ({ quarters: [], units: 4, merged: null })), piece: null };

describe('prizeColumn', () => {
  it('ft_1_32.AC19 a quarter per bar of the chunk, a note per chunk after them and the clef above, past the last bar line', () => {
    const column = prizeColumn(layout, fresh, focus());
    expect(column.glyphs.map((g) => g.kind)).toEqual(['quarter', 'quarter', 'quarter', 'quarter', 'whole', 'whole', 'whole', 'clef']);
    const notes = column.glyphs.filter((g) => g.kind !== 'clef');
    expect(Math.min(...notes.map((g) => g.box.x))).toBeGreaterThan(400);
    // left to right, every head on the middle line
    expect(notes.map((g) => g.x)).toEqual([...notes.map((g) => g.x)].sort((a, b) => a - b));
    expect(new Set(notes.map((g) => g.y))).toEqual(new Set([100 + 2 * S]));
    // the clef stands above the top line, over the column
    const clef = column.glyphs.at(-1)!;
    expect(clef.box.y + clef.box.h).toBeLessThan(100);
    expect(clef.x).toBeGreaterThan(notes[0]!.x);
    expect(clef.x).toBeLessThan(notes.at(-1)!.x);
  });

  it('is faint until earned, takes its medal when earned, and lights the prize the run is for', () => {
    const some: LearnRewards = {
      chunks: [{ quarters: ['gold', 'gold', 'gold', 'silver'], units: 4, merged: { note: 'whole', medal: 'silver' } }, { quarters: ['bronze'], units: 4, merged: null }, { quarters: [], units: 4, merged: null }],
      piece: null,
    };
    const column = prizeColumn(layout, some, focus({ chunk: 1, bars: [1] }));
    expect(column.glyphs.map((g) => g.medal)).toEqual(['bronze', null, null, null, 'silver', null, null, null]);
    expect(column.glyphs.map((g) => g.lit)).toEqual([false, true, false, false, false, false, false, false]);
    expect(prizeColumn(layout, some, focus({ chunk: 1, bars: [], chunks: [1] })).glyphs[5]!.lit).toBe(true);
    expect(prizeColumn(layout, { ...some, piece: 'gold' }, focus({ clef: true })).glyphs.at(-1)).toMatchObject({ medal: 'gold', lit: true });
  });

  it('draws a short chunk as its own note value, and keeps four quarter places', () => {
    const six: LearnRewards = { chunks: [{ quarters: [], units: 4, merged: null }, { quarters: [], units: 2, merged: null }], piece: null };
    const kinds = (f: PrizeFocus) => prizeColumn(layout, six, f).glyphs.map((g) => g.kind);
    expect(kinds(focus({ chunk: 1 }))).toEqual(['quarter', 'quarter', 'whole', 'half', 'clef']);
    const second = prizeColumn(layout, six, focus({ chunk: 1 })).glyphs;
    const first = prizeColumn(layout, six, focus()).glyphs;
    // the chunk notes stay where they are whichever chunk's quarters are shown
    expect(second.find((g) => g.role === 'chunk')!.x).toBe(first.find((g) => g.role === 'chunk')!.x);
  });

  it('wraps more than four chunk notes to a row under the first', () => {
    const long: LearnRewards = { chunks: Array.from({ length: 6 }, () => ({ quarters: [], units: 4, merged: null })), piece: null };
    const chunkNotes = prizeColumn(layout, long, focus()).glyphs.filter((g) => g.role === 'chunk');
    expect(chunkNotes).toHaveLength(6);
    expect(chunkNotes[4]!.y).toBeGreaterThan(chunkNotes[0]!.y);
    expect(chunkNotes[4]!.x).toBe(chunkNotes[0]!.x);
  });

  it('reserves room for the whole column, which stays inside it', () => {
    const column = prizeColumn(layout, fresh, focus());
    const right = Math.max(...column.glyphs.map((g) => g.box.x + g.box.w));
    expect(right - 400).toBeLessThanOrEqual(prizeRoom(3) * S);
    expect(prizeRoom(1)).toBeLessThan(prizeRoom(4));
    expect(prizeRoom(9)).toBe(prizeRoom(4));
    expect(PRIZE.clefScale).toBeGreaterThan(0);
  });

  it('draws nothing for a piece with nothing to learn or a layout with no bar line', () => {
    expect(prizeColumn(layout, { chunks: [], piece: null }, focus()).glyphs).toEqual([]);
    expect(prizeColumn({ ...layout, barlines: [] }, fresh, focus()).glyphs).toEqual([]);
  });
});
