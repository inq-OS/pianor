/**
 * The monster campaign's ladder as data (content/campaign/ladder.json): monsters in order, each with
 * exactly 3 levels (a bar range of its piece, the cracks that break the key in phase 1 and the share
 * phase 2 needs), and the numbers of the phase 1 mistake score.
 * Persisted-format rules: the file has a `schemaVersion`, and a new version needs a migration (docs/testing.md section 4).
 * The JSON import is done by the caller; this module only validates.
 */
import { z } from 'zod';
import type { Chart } from '../chart';
import { DEFAULT_CRACK_RULES, type CrackRules, type FindKeyOptions } from './findKey';
import { findKeyWindowMs, type LevelBars } from './window';

/** Inclusive bar range of a level: starts at 1, the end is at least the start. */
const barRangeSchema = z
  .tuple([z.literal(1), z.number().int().min(1)])
  .refine(([start, end]) => end >= start, { message: 'bar range end must be at least its start' });

export const ladderLevelSchema = z.object({
  bars: barRangeSchema,
  /** Phase 2 only (ft_1_06): the share of the part's notes the level needs on time in Tempo mode, 0 to 1. */
  accuracy: z.number().min(0).max(1),
  /**
   * Phase 1 window as a multiple of the part's playing time at its tempo; at least 1, so the
   * window is never shorter than the part. Optional: a level without one takes `DEFAULT_WINDOW_FACTORS`.
   */
  windowFactor: z.number().min(1).optional(),
  /** Phase 1: cracks that break the key (the level's difficulty). Optional, added without a new schema version. */
  cracks: z.number().int().min(1).optional(),
});

/** The phase 1 mistake score's numbers. Optional, added without a new schema version. */
const crackRulesSchema = z.object({
  crackNotes: z.number().positive(),
  lengthStep: z.number().min(0),
  repeatStep: z.number().min(0),
  weightCap: z.number().min(1),
});

export const ladderMonsterSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  /** Id of the piece fought over: the monster's song. */
  piece: z.string().min(1),
  levels: z.array(ladderLevelSchema).length(3),
});

export const ladderSchema = z.object({
  schemaVersion: z.literal(1),
  note: z.string().optional(),
  findKey: crackRulesSchema.optional(),
  monsters: z.array(ladderMonsterSchema).min(1),
});

export type Ladder = z.infer<typeof ladderSchema>;
/** @public Part of the ladder model. */
export type LadderMonster = z.infer<typeof ladderMonsterSchema>;
/** @public */
export type LadderLevel = z.infer<typeof ladderLevelSchema>;

/** Window factors of levels 1, 2 and 3 when the ladder gives none: easy 2.5, medium 1.75, hard 1.25 (moved from 3, 2, 1.5 by the difficulty review). */
export const DEFAULT_WINDOW_FACTORS = [2.5, 1.75, 1.25] as const;

/** The window factor of the level at `index` (0 for level 1): its own, or the default of its place. */
export function windowFactorOf(level: LadderLevel, index: number): number {
  return level.windowFactor ?? DEFAULT_WINDOW_FACTORS[Math.min(Math.max(index, 0), DEFAULT_WINDOW_FACTORS.length - 1)]!;
}

/** Validate raw ladder data; throws a ZodError when it is not valid. */
export function loadLadder(raw: unknown): Ladder {
  return ladderSchema.parse(raw);
}

/** The defaults (moved from 5, 4, 3 by the difficulty review) for a ladder level without its own `cracks`: levels 1, 2 and 3. */
const DEFAULT_CRACKS: Record<1 | 2 | 3, number> = { 1: 4, 2: 3, 3: 2 };

/**
 * Phase 1 options for one level of one monster (0-based monster, level 1 to 3) played on `chart`, with the
 * defaults for missing fields: the window is `bars` of the chart (the ladder level's own bars when left out) at the chart's
 * tempo times the level's factor.
 */
export function findKeyOptionsFor(ladder: Ladder, monster: number, level: 1 | 2 | 3, chart: Pick<Chart, 'tempoMap' | 'bars'>, bars?: LevelBars): Required<FindKeyOptions> {
  const m = ladder.monsters[monster];
  if (!m) throw new Error(`no monster ${monster} in the ladder`);
  const at = m.levels[level - 1]!;
  const rules: CrackRules = ladder.findKey ?? DEFAULT_CRACK_RULES;
  return { windowMs: findKeyWindowMs(chart, bars ?? at.bars, windowFactorOf(at, level - 1)), cracks: at.cracks ?? DEFAULT_CRACKS[level], rules };
}

/**
 * The bars a campaign level plays of the piece the player chose (d095): level 1 the first half (rounded up), levels 2 and
 * 3 the whole piece. The monster sets only the difficulty; this is the rule the ladder's own bars follow for its songs.
 */
export function levelBars(level: 1 | 2 | 3, barCount: number): LevelBars {
  const last = Math.max(1, barCount);
  return level === 1 ? [1, Math.ceil(last / 2)] : [1, last];
}

/** A ladder monster whose piece cannot hold its levels: the piece is not there, or has fewer bars than a level asks for. */
export type LadderPieceProblem =
  | { monster: string; piece: string; problem: 'missing' }
  | { monster: string; piece: string; problem: 'too-short'; bars: number; needs: number };

/**
 * Every monster whose piece is missing or shorter than the longest bar range of its levels. `barsOf` gives a piece's
 * number of bars, or undefined when there is no such piece. `sliceChart` would throw on such a level only when the student
 * starts it, so a content test runs this over the real pieces.
 */
export function ladderPieceProblems(ladder: Ladder, barsOf: (pieceId: string) => number | undefined): LadderPieceProblem[] {
  return ladder.monsters.flatMap((m): LadderPieceProblem[] => {
    const bars = barsOf(m.piece);
    if (bars === undefined) return [{ monster: m.id, piece: m.piece, problem: 'missing' }];
    const needs = Math.max(...m.levels.map((l) => l.bars[1]));
    return bars < needs ? [{ monster: m.id, piece: m.piece, problem: 'too-short', bars, needs }] : [];
  });
}
