/**
 * The curriculum model of d139 as pure functions (core_12, WP-04): the play score, the level and spread of a piece, the
 * consistency rule, statistics for the teacher, the Theil-Sen trend to a deadline, expected level, urgency, colour and
 * medal, and the statuses the teacher's screen reads (WP-14). Every number is a default from
 * content/curriculum/evaluation.json that the curriculum overrides per piece. AX-3 provisional until the students have
 * played a month (d139).
 */
import { z } from 'zod';
import type { DayString, Hand, PieceId } from '../contracts';
import { median } from '../median';
import type { Curriculum, CurriculumPiece } from './curriculum';
import type { HandMeasure, Medal, PieceStatus, PlayResult, StatusColour } from './play';

const weightsSchema = z
  .strictObject({ pitch: z.number().min(0), timing: z.number().min(0), tempo: z.number().min(0) })
  .refine((w) => w.pitch + w.timing + w.tempo === 100, 'the weights of a mode add up to 100');

const retainSchema = z.strictObject({
  atLeast: z.number().int().min(1),
  belowAtMost: z.number().int().min(0),
  byAtMost: z.number().min(0),
});

export const evaluationRulesSchema = z.strictObject({
  schemaVersion: z.literal(1),
  note: z.string().optional(),
  /** Shares of the play score per mode, in percent (d139). */
  weights: z.strictObject({ tempo: weightsSchema, wait: weightsSchema }),
  /** The expected level before priority. */
  base: z.number().min(0).max(100),
  /** X: the level and the consistency rule look at the last X plays. */
  lastPlays: z.number().int().min(1),
  /** Y, Z, B (d139). */
  retain: retainSchema,
  /** Under this many plays a piece has no level and is purple. */
  minPlays: z.number().int().min(1),
  /** The trend looks at the last N practice days. */
  trendDays: z.number().int().min(2),
  /** Under this many practice days there is no projection. */
  minPracticeDays: z.number().int().min(2),
  /** Pieces of this priority and up that owe anything come before lower ones (d139). */
  highPriorityFrom: z.number().int().min(1).max(10),
  /** Level over expected, in percent: bronze from, silver from, gold above (d139). */
  medals: z.strictObject({ bronzeFrom: z.number(), silverFrom: z.number(), goldAbove: z.number() }),
});

export type EvaluationRules = z.infer<typeof evaluationRulesSchema>;

export function parseEvaluationRules(raw: unknown): EvaluationRules {
  return evaluationRulesSchema.parse(raw);
}

/** The defaults of d139; content/curriculum/evaluation.json holds the same (a test keeps them equal). */
export const DEFAULT_EVALUATION_RULES: EvaluationRules = {
  schemaVersion: 1,
  note: 'AX-3 provisional (d139). Defaults of the curriculum model; the teacher overrides base, lastPlays and retain per player or piece in the curriculum document. weights: shares of the play score per mode (pitch = notes right first try, timing = notes on time, tempo = tempo reached). retain: of the last lastPlays plays at least atLeast reach the expected level, at most belowAtMost fall below it, none by more than byAtMost points. medals: achieved level over expected, in percent.',
  weights: { tempo: { pitch: 60, timing: 30, tempo: 10 }, wait: { pitch: 100, timing: 0, tempo: 0 } },
  base: 85,
  lastPlays: 10,
  retain: { atLeast: 3, belowAtMost: 2, byAtMost: 15 },
  minPlays: 3,
  trendDays: 14,
  minPracticeDays: 3,
  highPriorityFrom: 5,
  medals: { bronzeFrom: 85, silverFrom: 96, goldAbove: 105 },
};

const HISTOGRAM_BINS = 10;

const DAY_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

/** A `DayString` as a count of calendar days, so two days subtract to the days between them. */
export function dayNumber(day: DayString): number {
  const m = DAY_RE.exec(day);
  if (!m) throw new RangeError(`a day is YYYY-MM-DD, got ${day}`);
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const ms = Date.UTC(y, mo - 1, d);
  const back = new Date(ms);
  if (back.getUTCFullYear() !== y || back.getUTCMonth() !== mo - 1 || back.getUTCDate() !== d) {
    throw new RangeError(`no such day: ${day}`);
  }
  return ms / 86_400_000;
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v));
}

/**
 * One play's score, 0 to 100 (core_12.AC1, d139): pitch is the notes right first try over the notes, timing the
 * notes on time over the notes (Tempo mode; a hand without `onTime` has none on time), tempo the tempo reached up to
 * 100 %, both hands together, folded by the mode's weights. A play with no notes scores 0.
 */
export function playScore(
  mode: PlayResult['mode'],
  tempoPercent: number,
  hands: Readonly<Partial<Record<Hand, HandMeasure>>>,
  rules: EvaluationRules,
): number {
  const all = Object.values(hands).filter((h): h is HandMeasure => h !== undefined);
  const totals = {
    notes: all.reduce((n, h) => n + h.notes, 0),
    firstTry: all.reduce((n, h) => n + h.firstTry, 0),
    onTime: all.reduce((n, h) => n + (h.onTime ?? 0), 0),
  };
  return foldScore(mode, tempoPercent, totals, rules);
}

/** The play score from totals over both hands (see `playScore`). */
export function foldScore(
  mode: PlayResult['mode'],
  tempoPercent: number,
  totals: { readonly notes: number; readonly firstTry: number; readonly onTime: number },
  rules: EvaluationRules,
): number {
  if (totals.notes <= 0) return 0;
  const pitch = totals.firstTry / totals.notes;
  const timing = totals.onTime / totals.notes;
  const tempo = clamp(tempoPercent / 100, 0, 1);
  const w = rules.weights[mode];
  return Math.round(clamp(w.pitch * pitch + w.timing * timing + w.tempo * tempo, 0, 100));
}

export interface ScoreStats {
  readonly count: number;
  readonly mean: number | null;
  readonly median: number | null;
  /** Standard deviation (of the scores as a whole, not a sample). */
  readonly spread: number | null;
  /** Counts in 10-point bins: 0-9, 10-19, ... 90-100. */
  readonly histogram: readonly number[];
}

/** Mean, median, standard deviation and histogram of some play scores (core_12.AC5). */
export function scoreStats(scores: readonly number[]): ScoreStats {
  const histogram = Array.from({ length: HISTOGRAM_BINS }, () => 0);
  for (const s of scores) histogram[clamp(Math.floor(s / 10), 0, HISTOGRAM_BINS - 1)]! += 1;
  if (scores.length === 0) return { count: 0, mean: null, median: null, spread: null, histogram };
  const mean = scores.reduce((a, b) => a + b, 0) / scores.length;
  const variance = scores.reduce((a, s) => a + (s - mean) ** 2, 0) / scores.length;
  return { count: scores.length, mean, median: median(scores), spread: Math.sqrt(variance), histogram };
}

/** The window of plays the teacher chose (core_12.AC5); absent fields do not filter. */
export interface PlayWindow {
  readonly lastPlays?: number;
  /** The last N calendar days up to and including `today`. */
  readonly lastDays?: number;
  readonly today?: DayString;
  readonly mode?: PlayResult['mode'];
  readonly minTempoPercent?: number;
  readonly maxTempoPercent?: number;
}

/**
 * The whole-piece plays of a piece in a window, oldest first by time. A section's play (`bars` set) is for the section
 * rules of a later slice and never counts toward the piece's level (AX-3 provisional).
 */
export function selectPlays(plays: readonly PlayResult[], piece: PieceId, window: PlayWindow = {}): PlayResult[] {
  if (window.lastDays !== undefined && window.today === undefined) throw new RangeError('a window of days needs today');
  const from = window.lastDays !== undefined ? dayNumber(window.today!) - (window.lastDays - 1) : -Infinity;
  const picked = plays
    .filter(
      (p) =>
        p.piece === piece &&
        p.bars === undefined &&
        (window.mode === undefined || p.mode === window.mode) &&
        (window.minTempoPercent === undefined || p.tempoPercent >= window.minTempoPercent) &&
        (window.maxTempoPercent === undefined || p.tempoPercent <= window.maxTempoPercent) &&
        dayNumber(p.day) >= from,
    )
    .sort((a, b) => a.at - b.at);
  return window.lastPlays !== undefined ? picked.slice(-window.lastPlays) : picked;
}

/**
 * The consistency rule (core_12.AC4, d139): of the last X scores (oldest first) at least Y reach the expected
 * level, at most Z fall below it, and none falls below it by more than B points.
 */
export function isRetained(
  scores: readonly number[],
  expected: number,
  rules: Pick<EvaluationRules, 'lastPlays' | 'retain'>,
): boolean {
  const last = scores.slice(-rules.lastPlays);
  const reached = last.filter((s) => s >= expected).length;
  const below = last.filter((s) => s < expected);
  return (
    reached >= rules.retain.atLeast &&
    below.length <= rules.retain.belowAtMost &&
    below.every((s) => expected - s <= rules.retain.byAtMost)
  );
}

/** Theil-Sen line: the median of the slopes between every pair of points with different x, and the median intercept. */
export function theilSen(points: readonly { readonly x: number; readonly y: number }[]): { slope: number; intercept: number } | null {
  const slopes: number[] = [];
  for (let i = 0; i < points.length; i++) {
    for (let j = i + 1; j < points.length; j++) {
      const a = points[i]!;
      const b = points[j]!;
      if (a.x !== b.x) slopes.push((b.y - a.y) / (b.x - a.x));
    }
  }
  const slope = median(slopes);
  if (slope === null) return null;
  const intercept = median(points.map((p) => p.y - slope * p.x))!;
  return { slope, intercept };
}

/**
 * The predicted level at the deadline (core_12.AC6, d139): the Theil-Sen trend of the daily median scores over
 * the last N practice days, projected to the deadline and kept in 0 to 100; null under the minimum of practice days. A
 * deadline already past (before `today`) is projected to today instead, so an overdue piece shows where the trend stands
 * now, never a value read backwards from the plays.
 */
export function predictAtDeadline(
  plays: readonly PlayResult[],
  deadline: DayString,
  rules: Pick<EvaluationRules, 'trendDays' | 'minPracticeDays'>,
  today?: DayString,
): number | null {
  const byDay = new Map<number, number[]>();
  for (const p of plays) {
    const d = dayNumber(p.day);
    const list = byDay.get(d);
    if (list) list.push(p.score);
    else byDay.set(d, [p.score]);
  }
  const days = [...byDay.keys()].sort((a, b) => a - b).slice(-rules.trendDays);
  if (days.length < rules.minPracticeDays) return null;
  const fit = theilSen(days.map((d) => ({ x: d, y: median(byDay.get(d)!)! })));
  if (fit === null) return null;
  const at = today === undefined ? dayNumber(deadline) : Math.max(dayNumber(deadline), dayNumber(today));
  return clamp(fit.intercept + fit.slope * at, 0, 100);
}

/** Expected level = base + priority (core_12.AC7). */
export function expectedLevel(base: number, priority: number): number {
  return base + priority;
}

/** Urgency = max(0, delta) × (1 + priority / 10) / √(days left + 1); 0 without a delta (core_12.AC7, d139). */
export function urgency(delta: number | null, priority: number, daysLeft: number): number {
  if (delta === null || delta <= 0) return 0;
  return (delta * (1 + priority / 10)) / Math.sqrt(Math.max(0, daysLeft) + 1);
}

/**
 * The colour of a piece (core_12.AC8, d139): purple under the minimum of plays; strong green when retained and
 * the level reaches the expected one; else green, as strong as the predicted level (or, without a projection, the
 * level) over the expected one, at most 1.
 */
export function statusColour(s: {
  readonly plays: number;
  readonly retained: boolean;
  readonly level: number | null;
  readonly expected: number;
  readonly predicted: number | null;
}, minPlays = DEFAULT_EVALUATION_RULES.minPlays): { colour: StatusColour; greenStrength?: number } {
  if (s.plays < minPlays || s.level === null) return { colour: 'purple' };
  if (s.retained && s.level >= s.expected) return { colour: 'strongGreen' };
  const measure = s.predicted ?? s.level;
  return { colour: 'green', greenStrength: clamp(s.expected > 0 ? measure / s.expected : 1, 0, 1) };
}

/** The medal by the level over the expected level (core_12.AC8): bronze 85 to 95 %, silver 96 to 105 %, gold above. */
export function medalFor(level: number | null, expected: number, rules: Pick<EvaluationRules, 'medals'>): Medal | undefined {
  if (level === null || expected <= 0) return undefined;
  // Compared without dividing, so a level exactly on a band's edge lands in it.
  const pct = level * 100;
  if (pct > rules.medals.goldAbove * expected) return 'gold';
  if (pct >= rules.medals.silverFrom * expected) return 'silver';
  if (pct >= rules.medals.bronzeFrom * expected) return 'bronze';
  return undefined;
}

/**
 * The status of one curriculum piece on `today` (core_12.AC3 to AC8; the query of the teacher's screen, WP-14). `plays`
 * may hold every play of the player; the window filters them. The piece's overrides win over the curriculum's base and
 * the rules' numbers.
 */
export function pieceStatus(
  cp: CurriculumPiece,
  plays: readonly PlayResult[],
  today: DayString,
  curriculum: Pick<Curriculum, 'base'>,
  rules: EvaluationRules,
  window: Omit<PlayWindow, 'today'> = {},
): PieceStatus {
  const r: EvaluationRules = {
    ...rules,
    lastPlays: cp.overrides?.lastPlays ?? rules.lastPlays,
    retain: cp.overrides?.retain ?? rules.retain,
  };
  const inWindow = selectPlays(plays, cp.piece, { ...window, today });
  const scores = inWindow.map((p) => p.score);
  const last = scores.slice(-r.lastPlays);
  const stats = scoreStats(last);
  const enough = inWindow.length >= r.minPlays;
  const level = enough ? stats.median : null;
  const spread = enough ? stats.spread : null;
  const expected = expectedLevel(cp.overrides?.base ?? curriculum.base, cp.priority);
  const retained = enough && isRetained(scores, expected, r);
  const predicted = enough ? predictAtDeadline(inWindow, cp.deadline, r, today) : null;
  const band = predicted !== null ? { low: clamp(predicted - (spread ?? 0), 0, 100), high: clamp(predicted + (spread ?? 0), 0, 100) } : null;
  const delta = predicted !== null ? expected - predicted : null;
  const daysLeft = Math.max(0, dayNumber(cp.deadline) - dayNumber(today));
  const { colour, greenStrength } = statusColour({ plays: inWindow.length, retained, level, expected, predicted }, r.minPlays);
  const medal = medalFor(level, expected, r);
  return {
    piece: cp.piece,
    plays: inWindow.length,
    level,
    spread,
    histogram: stats.histogram,
    retained,
    expected,
    predicted,
    band,
    delta,
    urgency: urgency(delta, cp.priority, daysLeft),
    colour,
    ...(greenStrength !== undefined ? { greenStrength } : {}),
    ...(medal !== undefined ? { medal } : {}),
  };
}

/**
 * Every curriculum piece's status, most urgent first (core_12.AC7; the list the teacher's screen and Kiur's reminders
 * read): pieces of priority `highPriorityFrom` and up that owe anything come first, then by urgency, then by the nearer
 * deadline, then by id.
 */
export function curriculumStatuses(
  curriculum: Curriculum,
  plays: readonly PlayResult[],
  today: DayString,
  rules: EvaluationRules,
  window: Omit<PlayWindow, 'today'> = {},
): PieceStatus[] {
  const rows = curriculum.pieces.map((cp) => ({ cp, status: pieceStatus(cp, plays, today, curriculum, rules, window) }));
  const high = (row: (typeof rows)[number]) => row.cp.priority >= rules.highPriorityFrom && row.status.urgency > 0;
  rows.sort(
    (a, b) =>
      Number(high(b)) - Number(high(a)) ||
      b.status.urgency - a.status.urgency ||
      dayNumber(a.cp.deadline) - dayNumber(b.cp.deadline) ||
      (a.cp.piece < b.cp.piece ? -1 : a.cp.piece > b.cp.piece ? 1 : 0),
  );
  return rows.map((row) => row.status);
}
