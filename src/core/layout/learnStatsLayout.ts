import type { BarPace, SeriesPoint, Trend } from '../learn/stats';
import { GRAPH_MIN_SPACING } from './historyGraph';
import { rectBottom, type Rect } from './rect';

/** Art pixels from the screen's edges, and between the rows. */
const EDGE = 6;
const ROW_GAP = 3;
const TITLE_HEIGHT = 10;
const BUTTON_HEIGHT = 12;
const BUTTON_GAP = 2;
/** The two filter buttons, tapped to step through their choices. */
const FILTER_WIDTH = 78;
/** Room left of the graph for the scale's numbers, under it for the dates. */
const SCALE_WIDTH = 22;
const DATES_HEIGHT = 9;
const STRIP_HEIGHT = 11;
/** The help button, a square in the top right corner beside `rightInset`. */
const HELP_SIZE = 12;

export interface LearnStatsLayout {
  title: Rect;
  help: Rect;
  /** One button per measure, in a row. */
  measures: Rect[];
  /** The two filters (which tests, which days), and right of them the line that says the latest value and the trend. */
  kind: Rect;
  days: Rect;
  summary: Rect;
  /** The graph's plot; the scale is written left of it and the dates under it. */
  plot: Rect;
  /** The strip of the piece's bars, each tinted by its pace, under the graph and as wide. */
  strip: Rect;
}

/**
 * The learning stats screen (ft_1_32.AC9), top down: the title, the measures, the filters with the summary, the graph of
 * the chosen measure and the strip of the bars. Art pixels; pure. `rightInset` keeps the top row clear of the band's gear.
 */
export function learnStatsLayout(width: number, height: number, measures: number, options: { rightInset?: number } = {}): LearnStatsLayout {
  const inner = width - 2 * EDGE;
  const help: Rect = { x: width - Math.max(EDGE, options.rightInset ?? 0) - HELP_SIZE, y: EDGE - 2, w: HELP_SIZE, h: HELP_SIZE };
  const title: Rect = { x: EDGE, y: EDGE, w: help.x - EDGE - ROW_GAP, h: TITLE_HEIGHT };
  const measureY = rectBottom(title) + ROW_GAP;
  const each = Math.floor((inner - (measures - 1) * BUTTON_GAP) / measures);
  const measureRects = Array.from({ length: measures }, (_, i): Rect => ({ x: EDGE + i * (each + BUTTON_GAP), y: measureY, w: each, h: BUTTON_HEIGHT }));
  const filterY = measureY + BUTTON_HEIGHT + ROW_GAP;
  const kind: Rect = { x: EDGE, y: filterY, w: FILTER_WIDTH, h: BUTTON_HEIGHT };
  const days: Rect = { ...kind, x: kind.x + FILTER_WIDTH + BUTTON_GAP };
  const summaryX = days.x + FILTER_WIDTH + 2 * ROW_GAP;
  const summary: Rect = { x: summaryX, y: filterY + 2, w: width - EDGE - summaryX, h: BUTTON_HEIGHT };
  const strip: Rect = { x: EDGE + SCALE_WIDTH, y: height - EDGE - STRIP_HEIGHT, w: inner - SCALE_WIDTH, h: STRIP_HEIGHT };
  const plotY = filterY + BUTTON_HEIGHT + ROW_GAP + 2;
  const plot: Rect = { x: strip.x, y: plotY, w: strip.w, h: strip.y - ROW_GAP - DATES_HEIGHT - plotY };
  return { title, help, measures: measureRects, kind, days, summary, plot, strip };
}

export interface StatsGraphPoint {
  x: number;
  /** The height of the run's value, or null when the run has none. */
  y: number | null;
  /** The second value's height (the left hand), when the measure has one. */
  y2: number | null;
  /** The whisker around the value, when the measure has one, kept inside the plot. */
  top: number | null;
  bottom: number | null;
  steady: boolean;
  day: string;
}

export interface StatsGraph {
  /** One point per run shown, oldest first. */
  points: StatsGraphPoint[];
  shown: number;
  total: number;
  /** The guide lines: the scale's two ends, and zero when it lies between them. */
  lines: { value: number; y: number }[];
  /** The trend line's two ends, over the runs shown. */
  trend: { x1: number; y1: number; x2: number; y2: number } | null;
  /** The height of the reference value (the piece's baseline tempo), or null. */
  referenceY: number | null;
}

/** The scale never reaches further than this share past the values themselves, however wide a whisker is. */
const SCALE_REACH = 0.3;
const STEPS = [1, 2, 5, 10, 20, 50, 100, 200, 500] as const;

/** A scale of round numbers around `low` to `high`: its ends are whole steps, a step that cuts the range in at most six. */
function roundScale(low: number, high: number): { min: number; max: number } {
  const step = STEPS.find((s) => (high - low) / s <= 6) ?? STEPS.at(-1)!;
  const min = Math.floor(low / step) * step;
  return { min, max: Math.max(min + step, Math.ceil(high / step) * step) };
}

/**
 * The graph of one measure over the runs (ft_1_32.AC9): the runs oldest left and spaced evenly like `historyGraph`, each
 * at the height of its value on a scale of round numbers (from zero when `fromZero`, for the measures where zero is the
 * aim), a whisker where the series has a reach, the trend as a line over the runs shown, and a reference value. More runs
 * than fit show only the latest. Pure.
 */
export function statsGraph(series: readonly SeriesPoint[], plot: Rect, options: { fromZero?: boolean; trend?: Trend | null; reference?: number | null } = {}): StatsGraph {
  const fit = Math.floor((plot.w - 1) / GRAPH_MIN_SPACING) + 1;
  const shown = series.slice(-fit);
  const values = shown.flatMap((point) => [point.value, point.other ?? null]).filter((value): value is number => value !== null);
  if (values.length === 0) return { points: [], shown: 0, total: series.length, lines: [], trend: null, referenceY: null };
  const reference = options.reference ?? null;
  const lowest = Math.min(...values);
  const highest = Math.max(...values);
  const whiskers = shown.flatMap((point) => (point.value !== null && point.reach !== undefined ? [{ low: point.value - point.reach, high: point.value + point.reach }] : []));
  const extra = [...(reference === null ? [] : [reference]), ...(options.fromZero ? [0] : [])];
  // a whisker widens the scale, but only so far: a run with a stop must not flatten all the others
  const low = Math.min(...extra, Math.max(Math.min(lowest, ...whiskers.map((w) => w.low)), lowest - Math.abs(lowest) * SCALE_REACH));
  const high = Math.max(...extra, Math.min(Math.max(highest, ...whiskers.map((w) => w.high)), highest + Math.abs(highest) * SCALE_REACH));
  const { min, max } = roundScale(low, high);
  const yOf = (value: number) => plot.y + Math.round((1 - Math.min(1, Math.max(0, (value - min) / (max - min)))) * (plot.h - 1));
  const xOf = (i: number) => plot.x + (shown.length === 1 ? Math.floor((plot.w - 1) / 2) : Math.round((i * (plot.w - 1)) / (shown.length - 1)));
  const trend = options.trend && shown.length > 1 && shown.length === series.length
    ? { x1: xOf(0), y1: yOf(options.trend.first), x2: xOf(shown.length - 1), y2: yOf(options.trend.last) }
    : null;
  return {
    points: shown.map((point, i) => ({
      x: xOf(i),
      y: point.value === null ? null : yOf(point.value),
      y2: point.other === undefined || point.other === null ? null : yOf(point.other),
      top: point.value !== null && point.reach !== undefined ? yOf(point.value + point.reach) : null,
      bottom: point.value !== null && point.reach !== undefined ? yOf(point.value - point.reach) : null,
      steady: point.steady,
      day: point.day,
    })),
    shown: shown.length,
    total: series.length,
    lines: [min, ...(min < 0 && max > 0 ? [0] : []), max].map((value) => ({ value, y: yOf(value) })),
    trend,
    referenceY: reference === null ? null : yOf(reference),
  };
}

export interface StripCell {
  /** The piece's bar (from 0). */
  bar: number;
  x: number;
  w: number;
  /** How much slower than the run's own pace the bar is played, 0 (as the rest, or not measured) to 1 (`STRIP_FULL` percent or slower). */
  heat: number;
  /** The bar's pace in percent, or null when no run measured it. */
  pace: number | null;
  /** The step of the tint, 0 (as the rest) to `STRIP_SHADES - 1` (the slowest), or null for a bar not measured. */
  shade: number | null;
}

/** The strip has this many tints, from "as the rest" to the slowest. */
export const STRIP_SHADES = 4;

/** A bar this many percent of the run's pace, or slower, has the strip's full colour. AX-3 provisional. */
export const STRIP_FULL = 160;

/** The strip of the piece's `bars` bars across `strip`, each as wide as the others, tinted by how much slower it is played. Pure. */
export function barStrip(profile: readonly BarPace[], bars: number, strip: Rect): StripCell[] {
  const paces = new Map(profile.map((bar) => [bar.bar, bar.pace]));
  return Array.from({ length: bars }, (_, bar) => {
    const x = strip.x + Math.round((bar * strip.w) / bars);
    const pace = paces.get(bar) ?? null;
    const heat = pace === null ? 0 : Math.min(1, Math.max(0, (pace - 100) / (STRIP_FULL - 100)));
    return {
      bar, x, w: strip.x + Math.round(((bar + 1) * strip.w) / bars) - x - 1, heat, pace,
      // a bar within a tenth of the scale of the rest is "as the rest"; the others share the tints above it evenly
      shade: pace === null ? null : heat < 0.1 ? 0 : Math.min(STRIP_SHADES - 1, 1 + Math.floor(((heat - 0.1) / 0.9) * (STRIP_SHADES - 1))),
    };
  });
}
