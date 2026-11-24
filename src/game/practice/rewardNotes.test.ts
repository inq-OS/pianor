// Covers ft_1_32.AC21.
import { describe, expect, it } from 'vitest';
import { C } from '../ui/pixel/palette';
import { CLEF_PRIZE_ROWS, clefPrize } from './rewardNotes';

const count = (pixels: ArrayLike<number>, colour: number) => Array.from(pixels).filter((p) => p === colour).length;

describe('the clef prize in the book', () => {
  it('ft_1_32.AC21 is an empty placeholder before the piece is learned, and in its medal once learned', () => {
    const empty = clefPrize(null);
    expect(empty.height).toBe(CLEF_PRIZE_ROWS);
    expect(count(empty.pixels, C.lock)).toBeGreaterThan(0);
    expect(count(empty.pixels, C.gold)).toBe(0);
    const gold = clefPrize('gold');
    expect(count(gold.pixels, C.gold)).toBeGreaterThan(0);
    expect(count(gold.pixels, C.lock)).toBe(0);
    expect(count(clefPrize('bronze').pixels, C.orangeDark)).toBeGreaterThan(0);
  });
});
