import type { BarPlay } from '../progression/practiceLog';
import { DEFAULT_RAMP, type TempoRamp } from '../transport/tempoRamp';

/**
 * The practice analysis of core_10 (pure, no UI): the per-bar series for the progress graph, and for the weakest sections
 * a proposed starting tempo and a tempo ramp (AC7). Every function reads the practice log's bar plays and nothing else.
 */

/** The ideal point of the progress graph (AX-3 provisional): every note right first time at the piece's own tempo. */
export const IDEAL = { accuracy: 1, tempoPercent: 100 } as const;

/** A bar counts as played well with at least this share of notes right first time, and this timing (core_04 stats rule). */
export const PLAYED_WELL = { accuracy: 0.9, timingScore: 70 } as const;

/** The proposal looks at the last this many plays of the section. AX-3 provisional. */
const RECENT_PLAYS = 24;

/** How far below the best (or lowest) tempo a section starts: a practice session starts comfortably under it. */
const START_BELOW = 20;

const START_MIN = 30;
const START_MAX = 100;

/** The accuracy of one bar play: first-try notes over all notes; a bar with no notes counts as 1. */
function accuracyOf(play: BarPlay): number {
  return play.notes === 0 ? 1 : play.firstTry / play.notes;
}

/** One point of a bar's progress graph: the play's time, accuracy, tempo and mode. */
export interface BarSeriesPoint {
  at: string;
  accuracy: number;
  tempoPercent: number;
  mode: 'wait' | 'tempo';
}

/** The plays of one bar, oldest first (in the order of the log), as points of the progress graph. */
export function barSeries(plays: readonly BarPlay[], bar: number): BarSeriesPoint[] {
  return plays
    .filter((p) => p.bar === bar)
    .map((p) => ({ at: p.at, accuracy: accuracyOf(p), tempoPercent: p.tempoPercent, mode: p.mode }));
}

/** A bar play is played well when enough notes were right first time and, in Tempo mode, the timing was good enough. */
export function playedWell(play: BarPlay): boolean {
  return accuracyOf(play) >= PLAYED_WELL.accuracy && (play.timing === null || play.timing >= PLAYED_WELL.timingScore);
}

/** The plays whose bar lies within `first` to `last`, both inclusive, in log order. */
export function sectionPlays(plays: readonly BarPlay[], first: number, last: number): BarPlay[] {
  return plays.filter((p) => p.bar >= first && p.bar <= last);
}

const clamp = (value: number, lo: number, hi: number): number => Math.max(lo, Math.min(hi, value));

/**
 * The proposed starting tempo percent of a section (AC7), from its last 24 plays: 20 below the best well-played tempo,
 * or, when none was played well, 20 below the lowest tempo tried (100 when the section was never played). Rounded to
 * the nearest ten and kept between 30 and 100, so it is never above the piece's own tempo.
 */
export function proposeStartPercent(plays: readonly BarPlay[], first: number, last: number): number {
  const recent = sectionPlays(plays, first, last).slice(-RECENT_PLAYS);
  const well = recent.filter(playedWell);
  let basis: number;
  if (well.length > 0) {
    basis = Math.max(...well.map((p) => p.tempoPercent));
  } else if (recent.length > 0) {
    basis = Math.min(...recent.map((p) => p.tempoPercent));
  } else {
    basis = START_MAX;
  }
  const rounded = Math.round((basis - START_BELOW) / 10) * 10;
  return clamp(rounded, START_MIN, START_MAX);
}

/**
 * The tempo ramp proposed for a section (core_03.AC5): 5 percent every 2 clean laps, up to the piece's own tempo. A
 * section that already starts at 100 percent has its ramp off (step 0).
 */
export function proposeRamp(startPercent: number): TempoRamp {
  return {
    ...DEFAULT_RAMP,
    step: startPercent === START_MAX ? 0 : 5,
    stepUnit: 'percent',
    every: 2,
    onlyClean: true,
    target: 100,
    targetUnit: 'percent',
  };
}

export interface SectionPlan {
  first: number;
  last: number;
  startPercent: number;
  ramp: TempoRamp;
}

/** The proposed practice session of a section: its bars, starting tempo and ramp. */
export function sectionPlan(plays: readonly BarPlay[], first: number, last: number): SectionPlan {
  const startPercent = proposeStartPercent(plays, first, last);
  return { first, last, startPercent, ramp: proposeRamp(startPercent) };
}
