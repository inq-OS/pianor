import { z } from 'zod';
import { MIDI_MAX } from '../chart/midi';

/**
 * The practice log (core_10, d092; profile v16 on): one entry for every bar of every play, whole piece or section, so the
 * analysis (per-bar heat, the progress graph, the weakest sections, the proposed start tempo, part stars) is a pure function
 * of this one list. Plays of a section are marked by `section` and never count towards the piece stats (core_04), which stay
 * folded from `attempts`. A miss is keyed by its musical address (bar, tick in the bar, track, midi), not by a note index, so
 * editing a piece elsewhere does not throw the history away.
 */

const count = z.int().nonnegative();

/** A note that was not right the first time (a wrong key before it, or in Tempo mode no press in time), by musical address. */
export const barMissSchema = z.object({
  /** Ticks from the start of the bar (480 per quarter note). */
  tick: count,
  track: z.string().min(1),
  midi: z.int().min(0).max(MIDI_MAX),
});

export type BarMiss = z.infer<typeof barMissSchema>;

/**
 * One hand's share of a bar (core_12.AC2, WP-04): its notes, how many were right the first time, and in Tempo mode how many
 * were on time and the signed onset deviation of every note it pressed in time, as count, sum and sum of squares in ticks
 * (so the mean and spread over any run of bars are exact). Absent in older saves (no version step, d069.3).
 */
export const handBarSchema = z.object({
  notes: count,
  firstTry: count,
  /** Tempo mode: notes pressed on time. */
  onTime: count.exactOptional(),
  /** Tempo mode: onset deviations of the notes pressed in time, in ticks at the written tempo (positive = late). */
  onsets: z.object({ n: count, sum: z.int(), sumSq: count }).exactOptional(),
});

export type HandBar = z.infer<typeof handBarSchema>;

/** One bar of one play. `bar` counts from 0 in the whole piece, also when only a section was played. */
export const barPlaySchema = z.object({
  /** When the bar was finished (ISO 8601). */
  at: z.string().min(1),
  pieceId: z.string().min(1),
  bar: count,
  /** Notes the player had to play in the bar, and how many were right the first time. */
  notes: count,
  firstTry: count,
  /** Tempo mode: the timing score of the bar, 0 to 100 (missed notes as 0); null in Wait mode. */
  timing: z.int().min(0).max(100).nullable(),
  mode: z.union([z.literal('wait'), z.literal('tempo')]),
  /** The speed as a percent of the written tempo. */
  tempoPercent: z.int().positive(),
  /** null for a play of the whole piece; for a section play its first and last bar (0-based, inclusive). */
  section: z.object({ first: count, last: count }).nullable(),
  misses: z.array(barMissSchema),
  /** Tempo mode with hold grading: the bar's notes let go too early (core_01 slice f, d093); absent in Wait mode, without hold grading and in older saves. */
  short: count.exactOptional(),
  /** Per hand (core_12.AC2): from the chart track's hand; absent in older saves. */
  hands: z.object({ LH: handBarSchema.exactOptional(), RH: handBarSchema.exactOptional() }).exactOptional(),
});

export type BarPlay = z.infer<typeof barPlaySchema>;

export const practiceLogSchema = z.object({ bars: z.array(barPlaySchema) });

export type PracticeLog = z.infer<typeof practiceLogSchema>;

/** The log of a player who has not practised yet (and of a migrated older save). */
export const EMPTY_PRACTICE_LOG: PracticeLog = { bars: [] };

/** The bar plays of one piece, in the order they were kept (core_10). Pure: the log is not changed. */
export function piecePlays(log: PracticeLog, pieceId: string): BarPlay[] {
  return log.bars.filter((play) => play.pieceId === pieceId);
}

/** The most bar plays kept per piece; older ones go first (the save must not grow without end). Provisional (AX-3). */
export const MAX_BAR_PLAYS_PER_PIECE = 600;
