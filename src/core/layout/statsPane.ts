import type { HistoryPoint } from '../progression/pieceHistory';
import { PASS_STAR_THRESHOLDS } from '../scoring/stars';
import type { Rect } from './rect';

/** How many of the latest full plays the stats pane shows. AX-3 provisional: 8 (the rule is 5 to 10). */
export const STATS_PANE_PLAYS = 8;
/** The pane's bottom edge is this share right; a play below it is a stub. The pane is low, and the plays that matter lie above it. */
export const STATS_PANE_FLOOR = 0.5;
/** Rows the wrong key count over a bar takes (the pixel font's capital height); the plot leaves this much room above it. */
export const STATS_PANE_COUNT_HEIGHT = 7;
/** A bar is never shorter than this, so every play shows. */
const MIN_BAR = 2;

export interface StatsPaneBar extends Rect {
  accuracy: number;
  /** Wrong key presses in the play, drawn as a number over the bar: how many wrong keys each play had. */
  mistakes: number;
  /** Where the count goes: its centre column and top row, one row above the bar. */
  count: { x: number; y: number };
  /** The newest play, drawn with an outline. */
  latest: boolean;
}

export interface StatsPane {
  bars: StatsPaneBar[];
  /** The two-, three- and four-star lines across the plot (the five-star line is its top edge). */
  guides: { percent: number; y: number }[];
  /** A straight line fitted through the bars' tops (least squares), from the first bar's centre to the last's; null under two plays. */
  trend: { x1: number; y1: number; x2: number; y2: number } | null;
}

/**
 * The stats pane under the practice screen (ft_1_12.AC5): the latest full plays of the piece as bars, oldest left, each as
 * tall as its share of notes right the first time (from 50 percent up), with the five-star grade's lines and a fitted trend line. Pictures only, no words:
 * it never says "worse than before" (core_04). Over each bar stands its count of wrong keys, a bare number. Pure; the scene only draws it.
 */
export function statsPane(history: readonly HistoryPoint[], plot: Rect): StatsPane {
  const shown = history.slice(-STATS_PANE_PLAYS);
  const slot = Math.floor(plot.w / STATS_PANE_PLAYS);
  const barWidth = Math.max(1, slot - 2);
  const share = (accuracy: number) => (Math.min(1, Math.max(STATS_PANE_FLOOR, accuracy)) - STATS_PANE_FLOOR) / (1 - STATS_PANE_FLOOR);
  const yOf = (accuracy: number) => Math.min(plot.y + plot.h - MIN_BAR, plot.y + Math.round((1 - share(accuracy)) * plot.h));
  const xOf = (i: number) => plot.x + i * slot + 1;
  const bars = shown.map((point, i) => {
    const y = yOf(point.accuracy);
    const x = xOf(i);
    return {
      x, y, w: barWidth, h: plot.y + plot.h - y, accuracy: point.accuracy, mistakes: point.mistakes,
      count: { x: x + barWidth / 2, y: y - STATS_PANE_COUNT_HEIGHT - 1 }, latest: i === shown.length - 1,
    };
  });
  const guides = PASS_STAR_THRESHOLDS.filter((share) => share < 1).map((share) => ({ percent: Math.round(share * 100), y: yOf(share) }));
  return { bars, guides, trend: trendLine(shown.map((p) => p.accuracy), (i) => xOf(i) + barWidth / 2, yOf) };
}

function trendLine(values: readonly number[], xOf: (i: number) => number, yOf: (a: number) => number): StatsPane['trend'] {
  const n = values.length;
  if (n < 2) return null;
  const meanX = (n - 1) / 2;
  const meanY = values.reduce((sum, v) => sum + v, 0) / n;
  let top = 0;
  let bottom = 0;
  values.forEach((v, i) => {
    top += (i - meanX) * (v - meanY);
    bottom += (i - meanX) ** 2;
  });
  const slope = top / bottom;
  return { x1: Math.round(xOf(0)), y1: yOf(meanY - slope * meanX), x2: Math.round(xOf(n - 1)), y2: yOf(meanY + slope * meanX) };
}
