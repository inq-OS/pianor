// Covers ft_1_32.AC4.
import { describe, expect, it } from 'vitest';
import type { LearnRewards } from '../../core/learn/progress';
import { C } from '../ui/pixel/palette';
import { REWARD_ROWS, rewardNotes } from './rewardNotes';

const count = (pixels: ArrayLike<number>, colour: number) => Array.from(pixels).filter((p) => p === colour).length;

describe('reward notes', () => {
  const fresh: LearnRewards = { chunks: [{ quarters: [], units: 4, merged: null }, { quarters: [], units: 4, merged: null }], piece: null };

  it('draws a grey quarter per bar still to learn and a grey clef before the piece is learned', () => {
    const row = rewardNotes(fresh);
    expect(row.height).toBe(REWARD_ROWS);
    expect(row.width).toBe(8 * 5 + 6 * 1 + 4 + 4 + 6);
    expect(count(row.pixels, C.gold)).toBe(0);
    expect(count(row.pixels, C.lock)).toBeGreaterThan(0);
  });

  it('colours a secured bar by its medal, and a finished chunk is one note', () => {
    const some: LearnRewards = { chunks: [{ quarters: ['gold', 'gold', 'gold', 'silver'], units: 4, merged: { note: 'whole', medal: 'silver' } }, { quarters: ['bronze'], units: 4, merged: null }], piece: null };
    const row = rewardNotes(some);
    expect(row.width).toBe(7 + 4 + 4 * 5 + 3 + 4 + 6);
    expect(count(row.pixels, C.silver)).toBeGreaterThan(0);
    expect(count(row.pixels, C.orangeDark)).toBeGreaterThan(0);
    expect(count(row.pixels, C.gold)).toBe(0);
  });

  it('shows the learned piece\'s clef in its medal, and keeps the end of a row too long', () => {
    const learned: LearnRewards = { chunks: [{ quarters: ['gold', 'gold', 'gold', 'gold'], units: 4, merged: { note: 'whole', medal: 'gold' } }], piece: 'gold' };
    expect(count(rewardNotes(learned).pixels, C.lock)).toBe(0);
    expect(rewardNotes(fresh, 20).width).toBeLessThanOrEqual(20);
    expect(count(rewardNotes(fresh, 20).pixels, C.lock)).toBeGreaterThan(0);
  });
});
