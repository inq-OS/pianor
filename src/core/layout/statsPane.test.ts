import { describe, expect, it } from 'vitest';
import { STATS_PANE_COUNT_HEIGHT, STATS_PANE_PLAYS, statsPane } from './statsPane';

const plays = (...accuracies: number[]) => accuracies.map((accuracy, i) => ({ at: `1998-11-01T10:0${i}:00Z`, accuracy, mistakes: 0, mode: 'wait' as const }));
const plot = { x: 10, y: 4, w: 100, h: 20 };

describe('statsPane (ft_1_12.AC5)', () => {
  it('shows nothing and no trend before the first full play', () => {
    expect(statsPane([], plot)).toEqual({ bars: [], guides: expect.any(Array), trend: null });
  });

  it('draws the latest plays only, oldest left, each as tall as its accuracy, the newest marked', () => {
    const pane = statsPane(plays(...Array.from({ length: STATS_PANE_PLAYS + 3 }, (_, i) => i / 20)), plot);
    expect(pane.bars).toHaveLength(STATS_PANE_PLAYS);
    expect(pane.bars.map((b) => b.accuracy)).toEqual(Array.from({ length: STATS_PANE_PLAYS }, (_, i) => (i + 3) / 20));
    for (let i = 1; i < pane.bars.length; i++) expect(pane.bars[i]!.x).toBeGreaterThan(pane.bars[i - 1]!.x);
    expect(pane.bars.filter((b) => b.latest)).toEqual([pane.bars.at(-1)]);
    const full = statsPane(plays(1), plot).bars[0]!;
    expect(full.y).toBe(plot.y);
    expect(full.y + full.h).toBe(plot.y + plot.h);
    // from half right up: a play at or below half is a stub, still seen
    expect(statsPane(plays(0.3), plot).bars[0]!.h).toBe(2);
    expect(statsPane(plays(0.75), plot).bars[0]!.h).toBe(10);
  });

  it('marks the lines of the five-star grade under its top edge', () => {
    expect(statsPane([], plot).guides.map((g) => g.percent)).toEqual([75, 85, 95]);
  });

  it('draws the trend as a straight fitted line: rising plays rise, level plays stay level', () => {
    const rising = statsPane(plays(0.5, 0.6, 0.7, 0.8), plot).trend!;
    expect(rising.y2).toBeLessThan(rising.y1);
    const level = statsPane(plays(0.8, 0.8, 0.8), plot).trend!;
    expect(level.y2).toBe(level.y1);
    expect(statsPane(plays(0.8), plot).trend).toBeNull();
  });

  it('puts each play\'s wrong key count over its bar, inside the pane, never on the bar', () => {
    const history = plays(1, 0.75, 0.3).map((point, i) => ({ ...point, mistakes: [0, 3, 12][i]! }));
    const bars = statsPane(history, plot).bars;
    expect(bars.map((b) => b.mistakes)).toEqual([0, 3, 12]);
    for (const bar of bars) {
      expect(bar.count.x).toBe(bar.x + bar.w / 2);
      expect(bar.count.y + STATS_PANE_COUNT_HEIGHT).toBeLessThanOrEqual(bar.y);
      expect(bar.count.y).toBeGreaterThanOrEqual(plot.y - STATS_PANE_COUNT_HEIGHT - 1);
    }
  });
});
