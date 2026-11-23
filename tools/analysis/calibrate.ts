/**
 * Calibrating the Rules model's bar weights to how a player actually does (core_08 rule 11, core_08.AC14): every bar
 * measured in a player's practice log (`measuredDifficulty`, rule 10) is a sample of its features, centred on its piece,
 * and its gap; a ridge fit says which features made bars hard for this player, scaled so the mean bar score stays where
 * it is. It only reports: a person accepts the weights in `DIFFICULTY_WEIGHTS.bar`, and `npm test` then checks the
 * curriculum order and the confirmed numbers (`tests/content/pieceDifficulty.test.ts`). `calibrate-cli.ts` is the command.
 */
import type { Chart } from '../../src/core/chart';
import { DIFFICULTY_WEIGHTS, difficultyOf } from '../../src/core/piece/difficulty';
import { measuredDifficulty } from '../../src/core/progression/measuredDifficulty';
import { practiceLogSchema, type BarPlay, type PracticeLog } from '../../src/core/progression/practiceLog';
import { fitRidge, spearman } from './fitting';

export const WEIGHT_KEYS = Object.keys(DIFFICULTY_WEIGHTS.bar) as (keyof typeof DIFFICULTY_WEIGHTS.bar)[];

/** AX-3 provisional: the measured bars a fit needs before it says anything. */
export const MIN_BARS = 30;

export interface BarSample {
  pieceId: string;
  /** 0-based bar of the piece. */
  bar: number;
  /** The bar's features in `WEIGHT_KEYS` order. */
  raw: number[];
  /** The same minus their mean over the piece's measured bars: the gap is relative to the piece, so are the features. */
  x: number[];
  /** The measured gap: the piece's mean share right first time minus the bar's. */
  y: number;
}

/** The samples of a practice log; pieces whose chart cannot be found are listed, not guessed. */
export function barSamples(log: readonly BarPlay[], chartOf: (pieceId: string) => Chart | null): { samples: BarSample[]; skipped: string[] } {
  const samples: BarSample[] = [];
  const skipped: string[] = [];
  for (const pieceId of [...new Set(log.map((p) => p.pieceId))].sort()) {
    const chart = chartOf(pieceId);
    if (!chart) {
      skipped.push(pieceId);
      continue;
    }
    const prior = difficultyOf(chart);
    const measured = measuredDifficulty(log, pieceId, prior);
    const rows = measured.bars.flatMap((m) => {
      const bar = prior.bars.find((b) => b.index === m.bar);
      return m.gap === null || !bar || bar.features.presses === 0 ? [] : [{ bar: m.bar, raw: WEIGHT_KEYS.map((k) => bar.features[k]), y: m.gap }];
    });
    const mean = WEIGHT_KEYS.map((_, j) => rows.reduce((s, r) => s + r.raw[j]!, 0) / Math.max(1, rows.length));
    for (const r of rows) samples.push({ pieceId, bar: r.bar, raw: r.raw, x: r.raw.map((v, j) => v - mean[j]!), y: r.y });
  }
  return { samples, skipped };
}

export type WeightFit =
  | { ok: false; reason: string }
  | {
      ok: true;
      /** Suggested weights in `WEIGHT_KEYS` order, none below 0. */
      suggested: number[];
      /** Features the fit gave a weight below 0 (harder bars had less of them): set to 0. */
      clamped: string[];
      /** Rank correlation of the gaps with today's weights and with the suggested ones, -1 to 1. */
      rankToday: number;
      rankSuggested: number;
    };

const dot = (a: readonly number[], b: readonly number[]) => a.reduce((s, v, j) => s + v * b[j]!, 0);

export function fitBarWeights(samples: readonly BarSample[]): WeightFit {
  if (samples.length < MIN_BARS) return { ok: false, reason: `too few measured bars: ${samples.length} of the ${MIN_BARS} a fit needs` };
  const today = WEIGHT_KEYS.map((k) => DIFFICULTY_WEIGHTS.bar[k]);
  const fit = fitRidge(samples.map((s) => ({ id: `${s.pieceId}#${s.bar}`, group: s.pieceId, x: s.x, y: s.y })));
  const coef = fit.weights.map((w, j) => w / fit.scale[j]!);
  const clamped = WEIGHT_KEYS.filter((_, j) => coef[j]! < 0);
  const positive = coef.map((c) => Math.max(0, c));
  const before = samples.reduce((s, p) => s + dot(p.raw, today), 0);
  const after = samples.reduce((s, p) => s + dot(p.raw, positive), 0);
  if (after <= 0) return { ok: false, reason: 'no feature made the measured bars harder: keep today\'s weights' };
  const suggested = positive.map((c) => (c * before) / after);
  const gaps = samples.map((s) => s.y);
  return {
    ok: true,
    suggested,
    clamped,
    rankToday: spearman(samples.map((s) => dot(s.x, today)), gaps),
    rankSuggested: spearman(samples.map((s) => dot(s.x, suggested)), gaps),
  };
}

/** The lines the command prints: the weights side by side, how well each ranks the hard bars, how to accept them. */
export function calibrationReport(fit: WeightFit, bars: number, skipped: readonly string[]): string[] {
  const tail = skipped.length > 0 ? [`pieces not found, left out: ${skipped.join(', ')}`] : [];
  if (!fit.ok) return [`${bars} measured bar(s): ${fit.reason}`, ...tail];
  const today = WEIGHT_KEYS.map((k) => DIFFICULTY_WEIGHTS.bar[k]);
  return [
    `${bars} measured bar(s); how well the weights rank the bars this player found hard (1 is perfect): today ${fit.rankToday.toFixed(2)}, suggested ${fit.rankSuggested.toFixed(2)}`,
    ...WEIGHT_KEYS.map((k, j) => `  ${k.padEnd(16)} ${today[j]!.toFixed(2).padStart(6)} -> ${fit.suggested[j]!.toFixed(2).padStart(6)}${fit.clamped.includes(k) ? '  (fit below 0, set to 0)' : ''}`),
    '  to accept, write them into DIFFICULTY_WEIGHTS.bar in src/core/piece/difficulty.ts and run npm test (the curriculum order and the confirmed numbers)',
    ...tail,
  ];
}

/** The practice log of a player export (`ProfileService.exportActive`, export version 2). */
export function practiceLogOfExport(json: unknown): PracticeLog {
  const wrapper = json as { format?: unknown; exportVersion?: unknown; documents?: { practiceLog?: unknown } };
  if (wrapper?.format !== 'pianor-profile') throw new Error('not a player export of Pianor');
  if (typeof wrapper.exportVersion !== 'number' || wrapper.exportVersion < 2) throw new Error('an old export without the practice log as its own document: export it again from the game');
  return practiceLogSchema.parse(wrapper.documents?.practiceLog);
}
