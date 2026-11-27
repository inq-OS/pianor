// Covers ft_1_32.AC9.
import { describe, expect, it } from 'vitest';
import type { SeriesPoint } from '../learn/stats';
import { GRAPH_MIN_SPACING } from './historyGraph';
import { barStrip, learnStatsLayout, statsGraph } from './learnStatsLayout';
import { rectBottom, rectRight } from './rect';

describe('learnStatsLayout', () => {
  it('fits the title, the measures, the filters, the graph and the strip on the main area under the band, none over another', () => {
    const layout = learnStatsLayout(320, 124, 6, { rightInset: 28 });
    const rows = [layout.title, layout.measures[0]!, layout.kind, layout.plot, layout.strip];
    for (let i = 1; i < rows.length; i++) expect(rows[i]!.y).toBeGreaterThanOrEqual(rectBottom(rows[i - 1]!));
    expect(rectBottom(layout.strip)).toBeLessThanOrEqual(124);
    expect(layout.plot.h).toBeGreaterThanOrEqual(30);
    expect(rectRight(layout.help)).toBeLessThanOrEqual(320 - 28);
    expect(rectRight(layout.title)).toBeLessThanOrEqual(layout.help.x);
  });

  it('puts the measures side by side inside the screen, and the summary right of the two filters', () => {
    const layout = learnStatsLayout(320, 124, 6);
    expect(layout.measures).toHaveLength(6);
    layout.measures.forEach((rect, i) => {
      if (i > 0) expect(rect.x).toBeGreaterThanOrEqual(rectRight(layout.measures[i - 1]!));
    });
    expect(rectRight(layout.measures.at(-1)!)).toBeLessThanOrEqual(320);
    expect(layout.days.x).toBeGreaterThanOrEqual(rectRight(layout.kind));
    expect(layout.summary.x).toBeGreaterThanOrEqual(rectRight(layout.days));
  });

  it('gives a taller screen\'s rows to the graph', () => {
    expect(learnStatsLayout(320, 180, 6).plot.h).toBe(learnStatsLayout(320, 124, 6).plot.h + 56);
  });
});

const plot = { x: 20, y: 50, w: 101, h: 41 };
const point = (value: number | null, over: Partial<SeriesPoint> = {}): SeriesPoint => ({ value, steady: true, day: '1998-11-22', ...over });

describe('statsGraph', () => {
  it('is empty without a value', () => {
    expect(statsGraph([], plot)).toEqual({ points: [], shown: 0, total: 0, lines: [], trend: null, referenceY: null });
    expect(statsGraph([point(null)], plot).shown).toBe(0);
  });

  it('puts each run at the height of its value on a scale of round numbers, oldest left', () => {
    const graph = statsGraph([point(62, { steady: false, day: '1998-11-21' }), point(78)], plot);
    expect(graph.lines).toEqual([{ value: 60, y: 90 }, { value: 80, y: 50 }]);
    expect(graph.points.map(({ x, y, steady, day }) => ({ x, y, steady, day }))).toEqual([
      { x: 20, y: 86, steady: false, day: '1998-11-21' },
      { x: 120, y: 54, steady: true, day: '1998-11-22' },
    ]);
  });

  it('starts at zero for a measure where zero is the aim, and shows zero between the ends of a scale that crosses it', () => {
    expect(statsGraph([point(12), point(18)], plot, { fromZero: true }).lines.map((line) => line.value)).toEqual([0, 20]);
    expect(statsGraph([point(-8), point(12)], plot, { fromZero: true }).lines.map((line) => line.value)).toEqual([-10, 0, 15]);
  });

  it('draws a whisker around a value with a reach, inside the plot, and keeps the scale near the values', () => {
    const [even, wobbly] = statsGraph([point(60, { reach: 0 }), point(60, { reach: 15 })], plot).points;
    expect(even).toMatchObject({ top: even!.y, bottom: even!.y });
    expect(wobbly).toMatchObject({ y: 70, top: 50, bottom: 90 }); // 45 to 75, cut at the scale's own ends
    const stopped = statsGraph([point(60, { reach: 108 })], plot);
    expect(stopped.lines.map((line) => line.value)).toEqual([54, 66]);
    expect(stopped.points[0]).toMatchObject({ top: 50, bottom: 90 });
  });

  it('fits the scale to close runs, so a wide whisker of one run does not flatten them into a line', () => {
    // runs at 85 to 88 with the piece's baseline at 85; the first, uneven with a stop, has a whisker of 40
    const graph = statsGraph([point(85, { steady: false, reach: 40 }), point(86, { reach: 2 }), point(87, { reach: 2 }), point(88, { reach: 2 })], plot, { reference: 85 });
    const [low, high] = [graph.lines[0]!.value, graph.lines.at(-1)!.value];
    expect(high - low).toBeLessThanOrEqual(20);
    expect(low).toBeLessThanOrEqual(85);
    expect(high).toBeGreaterThanOrEqual(88);
    // the runs stand apart: three beats a minute take at least a sixth of the plot's height
    expect(graph.points[0]!.y! - graph.points[3]!.y!).toBeGreaterThanOrEqual(plot.h / 6);
  });

  it('keeps a minimum span, so runs of one tempo are not stretched over the whole plot', () => {
    const graph = statsGraph([point(85), point(85)], plot);
    expect(graph.lines.at(-1)!.value - graph.lines[0]!.value).toBeGreaterThanOrEqual(10);
  });

  it('gives the second value its own height, and none where it is missing', () => {
    const graph = statsGraph([point(5, { other: 20 }), point(10, { other: null })], plot, { fromZero: true });
    expect(graph.points.map((p) => p.y2)).toEqual([50, null]);
  });

  it('shows the reference value and makes room for it; the trend runs from the first run to the last', () => {
    const graph = statsGraph([point(72), point(74), point(76), point(78)], plot, { reference: 60, trend: { first: 72, last: 78, perRun: 2 } });
    expect(graph.lines.map((line) => line.value)).toEqual([60, 80]);
    expect(graph.referenceY).toBe(90);
    expect(graph.trend).toEqual({ x1: 20, y1: 66, x2: 120, y2: 54 });
  });

  it('shows only the latest runs when there are more than fit, and then no trend line of the whole', () => {
    const fit = Math.floor((plot.w - 1) / GRAPH_MIN_SPACING) + 1;
    const graph = statsGraph(Array.from({ length: fit + 5 }, (_, i) => point(60 + (i % 3))), plot, { trend: { first: 60, last: 61, perRun: 0 } });
    expect(graph.shown).toBe(fit);
    expect(graph.total).toBe(fit + 5);
    expect(graph.trend).toBeNull();
  });
});

describe('barStrip', () => {
  const strip = { x: 28, y: 100, w: 280, h: 11 };

  it('gives every bar of the piece a cell of the same width, in order across the strip', () => {
    const cells = barStrip([], 8, strip);
    expect(cells.map((cell) => cell.x)).toEqual([28, 63, 98, 133, 168, 203, 238, 273]);
    expect(cells.every((cell) => cell.w === 34 && cell.pace === null && cell.heat === 0 && cell.shade === null)).toBe(true);
  });

  it('tints a bar by how much slower than the rest it is played', () => {
    const cells = barStrip([{ bar: 0, pace: 100, runs: 2 }, { bar: 1, pace: 130, runs: 2 }, { bar: 2, pace: 220, runs: 1 }, { bar: 3, pace: 90, runs: 1 }], 4, strip);
    expect(cells.map((cell) => cell.heat)).toEqual([0, 0.5, 1, 0]);
    expect(cells.map((cell) => cell.pace)).toEqual([100, 130, 220, 90]);
    expect(cells.map((cell) => cell.shade)).toEqual([0, 2, 3, 0]);
  });
});
