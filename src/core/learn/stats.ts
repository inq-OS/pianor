import type { DayString } from '../contracts';
import { dayNumber, theilSen } from '../curriculum/evaluate';
import type { LearnTest } from './progress';

/**
 * The statistics of learning one piece (ft_1_32.AC9), from the records its measured runs left (`LearnProgress.tests`). Pure.
 * Every number here has a picture on the stats screen: a measure is a series over the runs with its trend, the bars have
 * their pace profile, and the hints say in words what the pictures show.
 */

/** What can be drawn over the runs. */
export const MEASURES = ['bpm', 'sd', 'mad', 'drift', 'halts', 'hands'] as const;
export type Measure = (typeof MEASURES)[number];

/** Which runs: every measured run, or one kind of test. */
export const KIND_FILTERS = ['all', 'confirm', 'join', 'whole'] as const;
export type KindFilter = (typeof KIND_FILTERS)[number];

/** From when: every run kept, the last seven days, or today's. */
export const DAY_FILTERS = ['all', 'week', 'today'] as const;
export type DayFilter = (typeof DAY_FILTERS)[number];

export interface StatsFilter {
  measure: Measure;
  kind: KindFilter;
  days: DayFilter;
}

export const DEFAULT_STATS_FILTER: StatsFilter = { measure: 'bpm', kind: 'all', days: 'all' };

const DAYS_BACK: Record<DayFilter, number> = { all: Number.POSITIVE_INFINITY, week: 6, today: 0 };

/** The runs the filter lets through, in order. A record kept before the kind was written passes only "all". */
export function filterTests(tests: readonly LearnTest[], filter: Pick<StatsFilter, 'kind' | 'days'>, today: DayString): LearnTest[] {
  const from = dayNumber(today) - DAYS_BACK[filter.days];
  return tests.filter((test) => (filter.kind === 'all' || test.kind === filter.kind) && dayNumber(test.day) >= from);
}

export interface SeriesPoint {
  /** The run's value of the measure; null when the run has none (a one-hand run has no hands). */
  value: number | null;
  /** The left hand's value, for the measure `hands` only (then `value` is the right hand's). */
  other?: number | null;
  /** One standard deviation around the value in its own unit, for the pace only: the whisker. */
  reach?: number;
  steady: boolean;
  day: DayString;
}

/** The measure over the runs, one point a run, oldest first. */
export function measureSeries(tests: readonly LearnTest[], measure: Measure): SeriesPoint[] {
  return tests.map((test) => {
    const at = { steady: test.steady, day: test.day };
    if (measure === 'hands') return { ...at, value: test.hands?.RH ?? null, other: test.hands?.LH ?? null };
    if (measure === 'bpm') return { ...at, value: test.bpm, reach: (test.bpm * test.sd) / 100 };
    return { ...at, value: test[measure] };
  });
}

export interface Trend {
  /** The value of the trend line at the first and at the last run of the series. */
  first: number;
  last: number;
  /** The change per run. */
  perRun: number;
}

/** A trend needs this many runs with a value. AX-3 provisional. */
export const TREND_MIN_RUNS = 4;

/** The Theil-Sen trend of a series over its runs (a stop-ridden run does not bend it); null under `TREND_MIN_RUNS` values. */
export function seriesTrend(values: readonly (number | null)[]): Trend | null {
  const points = values.flatMap((y, x) => (y === null ? [] : [{ x, y }]));
  if (points.length < TREND_MIN_RUNS) return null;
  const line = theilSen(points);
  if (!line) return null;
  return { first: line.intercept, last: line.intercept + line.slope * (values.length - 1), perRun: line.slope };
}

const median = (values: readonly number[]): number => {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = sorted.length >> 1;
  return sorted.length % 2 === 1 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2;
};

export interface BarPace {
  /** The piece's bar (from 0). */
  bar: number;
  /** Its middle pace over the runs that played it, percent of each run's own pace: 100 as the rest, 130 a third slower. */
  pace: number;
  /** The runs it was measured in. */
  runs: number;
}

/** Where in the piece the student slows: per bar the middle of its pace over the runs, for the bars measured at all. */
export function barProfile(tests: readonly LearnTest[]): BarPace[] {
  const byBar = new Map<number, number[]>();
  for (const test of tests) {
    (test.bars ?? []).forEach((pace, i) => {
      if (pace <= 0) return;
      const bar = (test.firstBar ?? 0) + i;
      byBar.set(bar, [...(byBar.get(bar) ?? []), pace]);
    });
  }
  return [...byBar].sort(([a], [b]) => a - b).map(([bar, paces]) => ({ bar, pace: Math.round(median(paces)), runs: paces.length }));
}

/**
 * AX-3 provisional: what counts as worth a word. The latest `runs` runs are looked at; a bar is slow from `slowBar` percent
 * of the run's pace, the tempo drifts from `drift` percent, the playing is uneven from a robust spread of `uneven` percent,
 * a hand is the weaker one from `handGap` points more spread than the other, and the tempo is not settled while the even
 * runs' paces differ by more than `tempoVaries` percent of their middle.
 */
export const FOCUS_RULES = { runs: 3, slowBar: 130, drift: 10, uneven: 15, handGap: 8, tempoVaries: 15, most: 3 } as const;

/** One thing to work on, by what the latest runs showed; `bar` is the piece's bar (from 0). */
export type Focus =
  | { kind: 'stops'; halts: number; bar: number | null }
  | { kind: 'slowBar'; bar: number; pace: number }
  | { kind: 'rushing' | 'slowing'; drift: number }
  | { kind: 'uneven'; spread: number }
  | { kind: 'hand'; hand: 'RH' | 'LH'; spread: number; other: number }
  | { kind: 'tempoVaries'; from: number; to: number }
  | { kind: 'steady'; bpm: number };

/**
 * What to focus on, the most telling first, at most `FOCUS_RULES.most`: stops, then a slow bar, a drifting tempo, an uneven
 * hand, uneven playing, an unsettled tempo; when none of them shows, that the playing is even (with its tempo). Empty with no run.
 */
export function focusHints(tests: readonly LearnTest[]): Focus[] {
  const rules = FOCUS_RULES;
  const latest = tests.slice(-rules.runs);
  if (latest.length === 0) return [];
  const out: Focus[] = [];
  const slowest = barProfile(latest).reduce<BarPace | null>((worst, bar) => (worst === null || bar.pace > worst.pace ? bar : worst), null);
  const halts = latest.reduce((sum, test) => sum + test.halts, 0);
  if (halts > 0) out.push({ kind: 'stops', halts, bar: slowest && slowest.pace >= rules.slowBar ? slowest.bar : null });
  else if (slowest && slowest.pace >= rules.slowBar) out.push({ kind: 'slowBar', bar: slowest.bar, pace: slowest.pace });
  const drift = median(latest.map((test) => test.drift));
  if (Math.abs(drift) >= rules.drift) out.push({ kind: drift > 0 ? 'rushing' : 'slowing', drift: Math.round(Math.abs(drift)) });
  const hand = weakerHand(latest);
  if (hand) out.push(hand);
  const spread = median(latest.map((test) => test.mad));
  if (spread >= rules.uneven) out.push({ kind: 'uneven', spread: Math.round(spread) });
  const paces = latest.filter((test) => test.steady).map((test) => test.bpm);
  if (paces.length >= 2 && (Math.max(...paces) - Math.min(...paces)) / median(paces) > rules.tempoVaries / 100) {
    out.push({ kind: 'tempoVaries', from: Math.min(...paces), to: Math.max(...paces) });
  }
  if (out.length === 0) return [{ kind: 'steady', bpm: Math.round(median(latest.map((test) => test.bpm))) }];
  return out.slice(0, rules.most);
}

/** The hand whose own spread is clearly the larger over the runs with both hands, or null. */
function weakerHand(tests: readonly LearnTest[]): Extract<Focus, { kind: 'hand' }> | null {
  const both = tests.flatMap((test) => (test.hands?.RH !== undefined && test.hands.LH !== undefined ? [{ RH: test.hands.RH, LH: test.hands.LH }] : []));
  if (both.length === 0) return null;
  const right = median(both.map((hands) => hands.RH));
  const left = median(both.map((hands) => hands.LH));
  if (Math.abs(right - left) < FOCUS_RULES.handGap) return null;
  return right > left ? { kind: 'hand', hand: 'RH', spread: Math.round(right), other: Math.round(left) } : { kind: 'hand', hand: 'LH', spread: Math.round(left), other: Math.round(right) };
}
