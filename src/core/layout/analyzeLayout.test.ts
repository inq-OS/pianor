import { describe, expect, it } from 'vitest';
import { analyzeLayout, heatColour, MIN_HEAT } from './analyzeLayout';
import { rectBottom } from './rect';

describe('analyzeLayout', () => {
  it('core_10.AC8: the staff, the graph and three cards fit the screen without overlap', () => {
    const l = analyzeLayout(320, 180);
    expect(l.cards).toHaveLength(3);
    expect(rectBottom(l.staff)).toBeLessThan(l.plot.y);
    expect(rectBottom(l.plot)).toBeLessThanOrEqual(180);
    expect(rectBottom(l.cards[2]!)).toBeLessThanOrEqual(180);
    expect(l.cards[0]!.x).toBeGreaterThan(l.plot.x + l.plot.w);
  });
});

describe('heatColour', () => {
  it('core_10.AC8: cool and unplayed bars have no tint, hotter bars are redder', () => {
    expect(heatColour(null)).toBeNull();
    expect(heatColour(MIN_HEAT - 0.01)).toBeNull();
    const mild = heatColour(0.2)!;
    const hot = heatColour(1)!;
    expect((hot >> 8) & 0xff).toBeLessThan((mild >> 8) & 0xff);
    expect(heatColour(5)).toBe(hot);
  });
});
