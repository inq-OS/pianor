import type { HistoryPoint } from '../progression/pieceHistory';
import type { Rect } from './rect';

/** Neighbouring points are at least this many art pixels apart; more plays than fit show only the latest. */
export const GRAPH_MIN_SPACING = 3;

export interface GraphPoint {
  x: number;
  y: number;
  mode: HistoryPoint['mode'];
  /** The play's date (ISO 8601), for the labels under the graph. */
  at: string;
}

export interface HistoryGraph {
  /** One point per play shown, oldest first, inside the plot. */
  points: GraphPoint[];
  /** Plays shown (the latest that fit) and plays in all. */
  shown: number;
  total: number;
  /** The guide lines at 0, 50 and 100 percent right first time. */
  lines: { percent: number; y: number }[];
}

/**
 * The accuracy-over-time graph of one piece (core_04): its full plays (`pieceHistory`), oldest left, newest right, each
 * at the height of its accuracy. The plays are spaced evenly, not by date, so a day of many plays stays readable; the
 * view labels the first and last date. Pure, so the view only draws it.
 */
export function historyGraph(history: readonly Omit<HistoryPoint, 'mistakes'>[], plot: Rect): HistoryGraph {
  const fit = Math.floor((plot.w - 1) / GRAPH_MIN_SPACING) + 1;
  const shown = history.slice(-fit);
  const yOf = (accuracy: number) => plot.y + Math.round((1 - Math.min(1, Math.max(0, accuracy))) * (plot.h - 1));
  const xOf = (i: number) => plot.x + (shown.length === 1 ? Math.floor((plot.w - 1) / 2) : Math.round((i * (plot.w - 1)) / (shown.length - 1)));
  return {
    points: shown.map((point, i) => ({ x: xOf(i), y: yOf(point.accuracy), mode: point.mode, at: point.at })),
    shown: shown.length,
    total: history.length,
    lines: [0, 50, 100].map((percent) => ({ percent, y: yOf(percent / 100) })),
  };
}
