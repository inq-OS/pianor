import { describe, expect, it } from 'vitest';
import { PALETTE, C } from './palette';
import { RANK_COUNT, RANK_SIZE, rankBadge } from './rankArt';

const levels = Array.from({ length: RANK_COUNT }, (_, i) => i + 1);
const key = (level: number) => Array.from(rankBadge(level).pixels).join(',');

describe('rankBadge (ft_1_09)', () => {
  it('ft_1_09.AC1 gives each of the 20 levels its own shield', () => {
    expect(new Set(levels.map(key)).size).toBe(RANK_COUNT);
  });

  it('ft_1_09.AC4 draws every shield at 24 x 24 in palette colours with an ink outline', () => {
    for (const level of levels) {
      const b = rankBadge(level);
      expect([b.width, b.height]).toEqual([RANK_SIZE, RANK_SIZE]);
      for (const p of b.pixels) expect(p).toBeLessThan(PALETTE.length);
      expect(b.pixels.includes(C.ink), `level ${level}`).toBe(true);
    }
  });

  it('ft_1_09.AC1 shows the last rank above level 20 and the first below level 1', () => {
    expect(key(25)).toBe(key(RANK_COUNT));
    expect(key(0)).toBe(key(1));
  });
});
