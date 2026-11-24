// Covers ft_1_32.AC19.
import { describe, expect, it } from 'vitest';
import type { LearnRewards } from '../learn/progress';
import type { PrizeFocus } from '../learn/view';
import { PRIZE, prizeColumn } from './learnPrizes';

const S = 10;
const RIGHT = 1000;
const focus = (over: Partial<PrizeFocus> = {}): PrizeFocus => ({ chunk: 0, bars: [0], chunks: [], clef: false, ...over });
const fresh: LearnRewards = { chunks: [0, 1, 2].map(() => ({ quarters: [], units: 4, merged: null })), piece: null };
const column = (rewards: LearnRewards, f: PrizeFocus) => prizeColumn(S, RIGHT, rewards, f);

describe('prizeColumn', () => {
  it('ft_1_32.AC19 one narrow column at the top right: the clef on top, the quarters of the chunk on one stem, a whole note per chunk under them', () => {
    const { glyphs, stem } = column(fresh, focus());
    expect(glyphs.map((g) => g.kind)).toEqual(['clef', 'quarter', 'quarter', 'quarter', 'quarter', 'whole', 'whole', 'whole']);
    // inside the room the staff leaves at the right
    for (const g of glyphs) {
      expect(g.box.x).toBeGreaterThanOrEqual(RIGHT - PRIZE.room * S - 1);
      expect(g.box.x + g.box.w).toBeLessThanOrEqual(RIGHT + 1);
    }
    const [clef, ...notes] = glyphs;
    expect(clef!.y).toBeLessThan(Math.min(...notes.map((n) => n.y)));
    // the quarters a step apart from the lowest up, staggered either side of their one stem like a chord of seconds
    const quarters = notes.filter((n) => n.role === 'bar');
    expect(quarters.map((q) => q.y)).toEqual([...quarters.map((q) => q.y)].sort((a, b) => b - a));
    expect(quarters[0]!.y - quarters[1]!.y).toBe(PRIZE.step * S);
    expect(quarters[0]!.x).toBeLessThan(stem!.x);
    expect(quarters[1]!.x).toBeGreaterThan(stem!.x);
    expect(stem!.y2).toBeLessThan(quarters.at(-1)!.y);
    // the chunks' notes under the quarters
    const chunks = notes.filter((n) => n.role === 'chunk');
    expect(Math.min(...chunks.map((c) => c.y))).toBeGreaterThan(quarters[0]!.y);
  });

  it('ft_1_32.AC19 a chunk whose bars are all secured shows no quarters: they became its whole note, which its confirmation play aims at', () => {
    const secured: LearnRewards = { ...fresh, chunks: [{ quarters: ['gold', 'gold', 'gold', 'silver'], units: 4, merged: null }, ...fresh.chunks.slice(1)] };
    const { glyphs, stem } = column(secured, focus({ bars: [], chunks: [0] }));
    expect(glyphs.filter((g) => g.role === 'bar')).toEqual([]);
    expect(stem).toBeNull();
    expect(glyphs.find((g) => g.role === 'chunk')).toMatchObject({ kind: 'whole', medal: null, lit: true });
  });

  it('a finished chunk shows no quarters: they became its whole note', () => {
    const done: LearnRewards = { ...fresh, chunks: [{ quarters: ['gold', 'gold', 'gold', 'silver'], units: 4, merged: { note: 'whole', medal: 'silver' } }, ...fresh.chunks.slice(1)] };
    const { glyphs, stem } = column(done, focus({ bars: [], chunks: [0] }));
    expect(glyphs.filter((g) => g.role === 'bar')).toEqual([]);
    expect(stem).toBeNull();
    expect(glyphs.find((g) => g.role === 'chunk')).toMatchObject({ medal: 'silver', lit: true });
  });

  it('is faint until earned, takes its medal when earned, and lights the prize the run is for', () => {
    const some: LearnRewards = {
      chunks: [{ quarters: ['gold', 'gold', 'gold', 'silver'], units: 4, merged: { note: 'whole', medal: 'silver' } }, { quarters: ['bronze'], units: 4, merged: null }, { quarters: [], units: 4, merged: null }],
      piece: null,
    };
    const { glyphs, stem } = column(some, focus({ chunk: 1, bars: [1] }));
    expect(glyphs.map((g) => g.medal)).toEqual([null, 'bronze', null, null, null, 'silver', null, null]);
    expect(glyphs.map((g) => g.lit)).toEqual([false, false, true, false, false, false, false, false]);
    expect(stem!.earned).toBe(true);
    expect(column({ ...some, piece: 'gold' }, focus({ clef: true })).glyphs[0]).toMatchObject({ kind: 'clef', medal: 'gold', lit: true });
  });

  it('draws a short chunk with its own count of quarters and its own note value', () => {
    const six: LearnRewards = { chunks: [{ quarters: [], units: 4, merged: null }, { quarters: [], units: 2, merged: null }], piece: null };
    expect(column(six, focus({ chunk: 1 })).glyphs.map((g) => g.kind)).toEqual(['clef', 'quarter', 'quarter', 'whole', 'half']);
  });

  it('draws nothing for a piece with nothing to learn', () => {
    expect(column({ chunks: [], piece: null }, focus())).toEqual({ glyphs: [], stem: null });
  });
});
