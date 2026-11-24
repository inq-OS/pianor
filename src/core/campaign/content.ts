/**
 * The monster campaign's ladder as data (content/campaign/ladder.json): monsters in order, each with
 * exactly 3 levels, each a bar range of its piece.
 * Persisted-format rules: the file has a `schemaVersion`, and a new version needs a migration (docs/testing.md section 4).
 * The JSON import is done by the caller; this module only validates.
 */
import { z } from 'zod';

/** Inclusive, 1-based bar range of a level, as in the ladder. */
export type LevelBars = readonly [number, number];

/** Inclusive bar range of a level: starts at 1, the end is at least the start. */
const barRangeSchema = z
  .tuple([z.literal(1), z.number().int().min(1)])
  .refine(([start, end]) => end >= start, { message: 'bar range end must be at least its start' });

export const ladderLevelSchema = z.object({
  bars: barRangeSchema,
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
  monsters: z.array(ladderMonsterSchema).min(1),
});

export type Ladder = z.infer<typeof ladderSchema>;
/** @public Part of the ladder model. */
export type LadderMonster = z.infer<typeof ladderMonsterSchema>;
/** @public */
export type LadderLevel = z.infer<typeof ladderLevelSchema>;

/** Validate raw ladder data; throws a ZodError when it is not valid. */
export function loadLadder(raw: unknown): Ladder {
  return ladderSchema.parse(raw);
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
