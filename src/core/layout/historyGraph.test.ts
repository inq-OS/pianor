// Covers core_04.AC5.
import { describe, expect, it } from 'vitest';
import type { HistoryPoint } from '../progression/pieceHistory';
import { GRAPH_MIN_SPACING, historyGraph } from './historyGraph';
import { rectBottom, rectRight } from './rect';

const plot = { x: 20, y: 50, w: 101, h: 51 };
const play = (accuracy: number, day = 1, mode: 'wait' | 'tempo' = 'wait'): HistoryPoint => ({ at: `1998-10-${String(day).padStart(2, '0')}T10:00:00.000Z`, accuracy, mistakes: 0, mode });

describe('historyGraph', () => {
  it('has no points for a piece not played yet, and still its lines at 0, 50 and 100 percent', () => {
    const graph = historyGraph([], plot);
    expect(graph.points).toEqual([]);
    expect(graph.shown).toBe(0);
    expect(graph.total).toBe(0);
    expect(graph.lines).toEqual([
      { percent: 0, y: 100 },
      { percent: 50, y: 75 },
      { percent: 100, y: 50 },
    ]);
  });

  it('puts one play in the middle, at the height of its accuracy', () => {
    expect(historyGraph([play(0.5)], plot).points).toEqual([{ x: 70, y: 75, mode: 'wait', at: '1998-10-01T10:00:00.000Z' }]);
  });

  it('spreads the plays from the left edge to the right, oldest first, all right first time at the top', () => {
    const graph = historyGraph([play(0, 1), play(1, 2, 'tempo'), play(0.5, 3)], plot);
    expect(graph.points.map(({ x, y, mode }) => ({ x, y, mode }))).toEqual([
      { x: 20, y: 100, mode: 'wait' },
      { x: 70, y: 50, mode: 'tempo' },
      { x: 120, y: 75, mode: 'wait' },
    ]);
  });

  it('keeps every point inside the plot, even for an accuracy outside 0 to 1', () => {
    const graph = historyGraph([play(-0.2), play(1.3), play(0.33)], plot);
    for (const { x, y } of graph.points) {
      expect(x).toBeGreaterThanOrEqual(plot.x);
      expect(x).toBeLessThan(rectRight(plot));
      expect(y).toBeGreaterThanOrEqual(plot.y);
      expect(y).toBeLessThan(rectBottom(plot));
    }
  });

  it('shows only the latest plays when there are more than fit, and says how many', () => {
    const many = Array.from({ length: 80 }, (_, i) => play((i % 10) / 10, 1 + (i % 28)));
    const graph = historyGraph(many, plot);
    const fit = Math.floor((plot.w - 1) / GRAPH_MIN_SPACING) + 1;
    expect(graph.total).toBe(80);
    expect(graph.shown).toBe(fit);
    expect(graph.points).toHaveLength(fit);
    expect(graph.points.at(-1)!.y).toBe(historyGraph([many.at(-1)!], plot).points[0]!.y); // the newest play is the last point
    const xs = graph.points.map((p) => p.x);
    for (let i = 1; i < xs.length; i++) expect(xs[i]! - xs[i - 1]!).toBeGreaterThanOrEqual(GRAPH_MIN_SPACING);
  });
});
