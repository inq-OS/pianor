import type { Chart } from '../chart';
import { tickToMs } from '../chart';
import { theilSen } from '../curriculum/evaluate';
import { buildSteps } from '../judge/steps';
import type { JudgeEvent } from '../judge/types';

/**
 * The player's own tempo, measured and never asked for (ft_1_32.AC7: the confirmation play of a chunk
 * sets the baseline). Pure. A learning run is played in Wait mode, where every right key carries its clock time:
 * the gaps between the steps, against their written lengths, are the pace the student chose, how evenly it was kept, and
 * where it stopped. The student is never asked to keep a given speed.
 *
 * AX-3 provisional: a gap is even when it is within `tolerance` of the run's own pace, a halt when it is `haltFactor`
 * times as long as written or longer, and a run is steady with no halt and at least `steadyShare` of its gaps even. An
 * uneven measured run is asked again at most `asks` times; the next run with every note right then counts with no tempo
 * kept, so a student who cannot yet play evenly is never held at a step (no punishing fail state).
 */
export const TEMPO_RULES = { tolerance: 0.5, haltFactor: 3, steadyShare: 0.6, roundTo: 5, asks: 1 } as const;

export interface RunTempo {
  /**
   * The run's pace as quarter notes a minute at the piece's first tempo mark, from its usual gap (the median, so one stop
   * does not slow it). Gaps are compared with their written lengths by the chart's tempo map, so a written tempo change is
   * not read as unevenness.
   */
  bpm: number;
  /** The share of gaps kept within the tolerance of that pace, 0 to 1. */
  steadiness: number;
  /** Gaps at least `haltFactor` times as long as written at that pace: the student stopped there. */
  halts: number;
  steady: boolean;
  /**
   * The standard deviation of the gaps around that pace, as a share of it (0.12: the gaps wandered 12% from the student's own
   * beat): each gap's deviation from the usual gap, squared, averaged, rooted. A stop counts in full, so it shows.
   */
  spread: number;
  /**
   * The same spread measured so that a stop or two does not move it (the median absolute deviation, scaled to read as a
   * standard deviation): how evenly the student plays when playing, apart from the stops counted in `halts`.
   */
  robust: number;
  /**
   * How the tempo changed from the run's first gap to its last, as a share (0.1: ended 10% faster, the student rushed;
   * -0.1: slowed down), from the Theil-Sen trend of the gaps, which a stop does not bend.
   */
  drift: number;
  /**
   * The pace of each bar of the chart played against the run's own pace (1: as the rest, 1.5: half as slow again), from
   * the gaps that begin in the bar: where in the bars the student slows. null for a bar with no gap of its own.
   */
  bars: (number | null)[];
  /**
   * The robust spread of each hand on its own, from the gaps between that hand's notes, when both hands play in the run
   * and the hand has gaps enough: which hand is the uneven one. Absent for a one-hand run.
   */
  hands?: { RH?: number; LH?: number };
}

/** A median absolute deviation times this is the standard deviation of a normal spread. */
const MAD_TO_SD = 1.4826;

const median = (values: readonly number[]): number => {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = sorted.length >> 1;
  return sorted.length % 2 === 1 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2;
};

/**
 * The tempo of one run from the judge's events (`chart` is the chart played): the first right key of each step is the
 * step's time. null with fewer than three steps played, which has too few gaps to say anything.
 */
export function runTempo(chart: Chart, events: readonly JudgeEvent[]): RunTempo | null {
  const points = onsetsOf(chart, events);
  const gaps = gapsOf(points);
  const paces = gaps.map((gap) => gap.pace);
  if (paces.length < 2) return null;
  const usual = median(paces);
  if (!(usual > 0)) return null;
  const halts = paces.filter((p) => p >= usual * TEMPO_RULES.haltFactor).length;
  const even = paces.filter((p) => Math.abs(p - usual) <= usual * TEMPO_RULES.tolerance).length;
  const steadiness = even / paces.length;
  const deviations = paces.map((p) => p / usual - 1);
  // the trend of the gaps' logarithms: a slope per gap, so its sum over the run is the change of the gap length
  const trend = theilSen(paces.map((p, x) => ({ x, y: Math.log(p) })));
  const drift = trend ? Math.exp(-trend.slope * (paces.length - 1)) - 1 : 0;
  const hands = handSpreads(points);
  return {
    bpm: Math.max(1, Math.round(chart.tempoMap[0]!.bpm / usual)), steadiness, halts,
    steady: halts === 0 && steadiness >= TEMPO_RULES.steadyShare,
    spread: Math.sqrt(deviations.reduce((sum, d) => sum + d * d, 0) / deviations.length),
    robust: robustSpread(paces, usual),
    drift: Number.isFinite(drift) ? drift : 0,
    bars: chart.bars.map((_, bar) => {
      const own = gaps.filter((gap) => gap.bar === bar).map((gap) => gap.pace);
      return own.length === 0 ? null : median(own) / usual;
    }),
    ...(hands ? { hands } : {}),
  };
}

interface Onset { writtenMs: number; timeMs: number; bar: number; hands: readonly ('RH' | 'LH')[] }

/** The first right key of each step played, with the step's written time, in written order. */
function onsetsOf(chart: Chart, events: readonly JudgeEvent[]): Onset[] {
  const steps = buildSteps(chart);
  const onsets = new Map<number, number>();
  for (const e of events) {
    if (e.type === 'NoteJudged' && e.verdict === 'correct' && !onsets.has(e.stepIndex)) onsets.set(e.stepIndex, e.timeMs);
  }
  return [...onsets]
    .map(([index, timeMs]) => ({ writtenMs: tickToMs(chart.tempoMap, steps[index]!.tick, chart.ppq), timeMs, bar: steps[index]!.bar, hands: steps[index]!.hands }))
    .sort((a, b) => a.writtenMs - b.writtenMs);
}

/** Each gap between neighbouring onsets as played against its written length (2 is half the written tempo), with the bar it begins in. */
function gapsOf(points: readonly Onset[]): { pace: number; bar: number }[] {
  const gaps: { pace: number; bar: number }[] = [];
  for (let i = 1; i < points.length; i++) {
    const written = points[i]!.writtenMs - points[i - 1]!.writtenMs;
    const playedMs = points[i]!.timeMs - points[i - 1]!.timeMs;
    // two steps with the same key time (a replay, a burst of keys) are no gap to measure
    if (written > 0 && playedMs > 0) gaps.push({ pace: playedMs / written, bar: points[i - 1]!.bar });
  }
  return gaps;
}

const robustSpread = (paces: readonly number[], usual: number): number => MAD_TO_SD * median(paces.map((p) => Math.abs(p / usual - 1)));

/** A hand needs this many gaps of its own for its spread to say anything. */
const HAND_MIN_GAPS = 3;

/** The robust spread of each hand's own gaps around that hand's own pace; undefined unless both hands play. */
function handSpreads(points: readonly Onset[]): { RH?: number; LH?: number } | undefined {
  if (!(['RH', 'LH'] as const).every((hand) => points.some((point) => point.hands.includes(hand)))) return undefined;
  const out: { RH?: number; LH?: number } = {};
  for (const hand of ['RH', 'LH'] as const) {
    const paces = gapsOf(points.filter((point) => point.hands.includes(hand))).map((gap) => gap.pace);
    if (paces.length >= HAND_MIN_GAPS) out[hand] = robustSpread(paces, median(paces));
  }
  return out;
}

/**
 * The rushing stop (ft_1_32 rule 12, slice 3, AC11). `AX-3 provisional`: a run is rushing once the median pace of its latest
 * `gaps` gaps is more than `over` above the piece's baseline tempo; the median, so one quick gap does not stop a run.
 */
export const RUSH_RULES = { over: 0.2, gaps: 3 } as const;

/**
 * Whether the run so far (the judge's events, `chart` the chart played) has sped up beyond `baselineBpm`, the piece's
 * baseline tempo (`baselineBpm`); never without a baseline or before `RUSH_RULES.gaps` gaps.
 */
export function rushing(chart: Chart, events: readonly JudgeEvent[], baselineBpm: number | null): boolean {
  if (baselineBpm === null || !(baselineBpm > 0)) return false;
  const points = onsetsOf(chart, events);
  const latest = gapsOf(points).slice(-RUSH_RULES.gaps).map((gap) => gap.pace);
  if (latest.length < RUSH_RULES.gaps) return false;
  const pace = median(latest);
  return pace > 0 && chart.tempoMap[0]!.bpm / pace > baselineBpm * (1 + RUSH_RULES.over);
}

/** The baseline tempo of a piece from the paces of its counted runs: their median, rounded down to 5 BPM; null with none. */
export function baselineBpm(paces: readonly number[]): number | null {
  if (paces.length === 0) return null;
  return Math.max(TEMPO_RULES.roundTo, Math.floor(median(paces) / TEMPO_RULES.roundTo) * TEMPO_RULES.roundTo);
}

/** The baseline tempo as a percent of the piece's written tempo, for the clock that follows the player (core_01.AC13); null before the first counted pace. */
export function baselinePercent(paces: readonly number[], pieceBpm: number): number | null {
  const baseline = baselineBpm(paces);
  return baseline === null || !(pieceBpm > 0) ? null : Math.round((100 * baseline) / pieceBpm);
}
