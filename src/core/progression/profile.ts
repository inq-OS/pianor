import { z } from 'zod';
import { DEFAULT_BAR_NUMBER_SETTINGS, barNumberSettingsSchema } from '../layout/barNumbers';
import { DEFAULT_EAR_TRAINER_SETTINGS, earTrainerSettingsSchema } from '../trainer/earSettings';
import { DEFAULT_KEYBOARD_SETTINGS, keyboardSettingsSchema } from '../layout/keyboardSettings';
import { DEFAULT_PLAY_SETTINGS, playSettingsSchema } from '../judge/playSettings';
import { HELP_IDS, type HelpId } from './modifiers';
import { EMPTY_PRACTICE_LOG, practiceLogSchema } from './practiceLog';
import type { PieceResult } from '../judge/types';
import { durationHelpSchema } from '../layout/durationHelp';
import { DEFAULT_STAFF_SETTINGS, staffSettingsSchema } from '../layout/staffSettings';
import type { NoteNaming } from '../text/noteName';
import { passStarsFor, starsFor, type PassStars, type Stars } from '../scoring/stars';
import type { ProgressionConfig } from './config';
import { DEFAULT_PIECES_SETTINGS, piecesSettingsSchema } from './pieceSwitch';
import { learnProgressSchema, learnSettingsSchema } from '../learn/progress';
import { computeXp, levelForXp, type LevelInfo, type XpBreakdown } from './xp';

/**
 * The save format version. 5 (core_04) records how each piece was played; 6 (ft_1_02c) added `settings.pieces`; 7
 * replaced a battle's hearts by the player's health; 8 added `settings.battle`: how many monsters a fight has;
 * 9 (ft_Y_12) added `settings.keyboard`: whether the on-screen piano is shown on the practice screen; 10 added
 * `settings.barNumbers`: which bars of the staff carry a number; 11 (ft_0_17, ft_Y_06, ft_0_16) added `settings.noteNaming`,
 * `settings.staffGap` and `settings.keyLights` (d058); 12 (core_01e) added `noteTimings` to every attempt (d059); 13 (core_07, WP-G3)
 * added `helps` to every attempt: the help ids in force, not their factor (d060); 14 added `campaign`: the monster
 * campaign's state, per profile; 15 (ft_0_17, AC3) added `trainerXp`: the XP of right names in the note-name trainer (d083);
 * 16 (core_10, d092) added `practice`: one entry per bar of every play;
 * 17 (ft_1_10, slice B) added `earPoints`, the pitch trainer by ear's points (never XP), and `settings.earTrainer`.
 * Version 17 is the last record version: since the split into save documents (core_11, d136) a change to the profile is a
 * step of the profile document (`src/core/save/documents.ts`), and `profileSchema` is the shape after those steps (its
 * version 2 keeps `tugs` in place of the old battle records and drops the old campaign and its battle setting, d290).
 */
export const PROFILE_SCHEMA_VERSION = 17;

const count = z.int().nonnegative();

/** How well the notes of a Tempo-mode play were timed (version 5 on; absent for a Wait-mode play). */
export const timingStatsSchema = z.object({
  played: count,
  onTime: count,
  early: count,
  late: count,
  missed: count,
  meanAbsErrorMs: z.number().nullable(),
  score: z.number().min(0).max(100),
});

export const pieceResultSchema = z.object({
  chartId: z.string().min(1),
  contentVersion: z.int().positive(),
  notes: count,
  firstTryCorrect: count,
  mistakes: count,
  accuracy: z.number().min(0).max(1),
  rhythmErrorMs: z.number().nullable(),
  hints: z.object({ noteNames: count, fingers: count }),
  bothHands: z.object({ notes: count, together: count }),
  timing: timingStatsSchema.exactOptional(),
});

/** How a piece was played (version 5 on): the mode, and the speed as a percent of the written tempo. Older attempts are Wait mode at 100. */
export const playInfoSchema = z.object({
  mode: z.union([z.literal('wait'), z.literal('tempo')]),
  tempoPercent: z.int().positive(),
});

export type PlayInfo = z.infer<typeof playInfoSchema>;
export const DEFAULT_PLAY_INFO: PlayInfo = { mode: 'wait', tempoPercent: 100 };

export const xpBreakdownSchema = z.object({
  kind: z.enum(['first', 'improved', 'replay']),
  completion: z.number().nonnegative(),
  accuracy: z.number().nonnegative(),
  bonus: z.number().nonnegative(),
  replayFactor: z.number().min(0).max(1),
  hintFactor: z.number().min(0).max(1),
  bothHandsMultiplier: z.number().min(1),
  total: z.int().nonnegative(),
});

/** One note of an attempt (core_01e): its index in the piece and its timing score 0 to 100, or null when it was missed or not timed. */
export const noteTimingSchema = z.object({
  note: count,
  score: z.int().min(0).max(100).nullable(),
  /** How much of the full hold the key was held (core_01 slice f, d093); null for a missed note; absent in older saves. */
  hold: z.int().min(0).max(100).nullable().exactOptional(),
});
export type SavedNoteTiming = z.infer<typeof noteTimingSchema>;

/** The helps in force in one play (version 13 on): ids from the modifier table, each at most once; none means full difficulty. */
export const helpsSchema = z.array(z.enum(HELP_IDS)).refine((ids) => new Set(ids).size === ids.length, { message: 'a help can be in force only once' });

/** One finished piece. The log of attempts is the record; totals and records are derived from it. */
export const attemptSchema = z.object({
  /** 1, 2, 3 ... in order. */
  n: z.int().positive(),
  /** When it was finished (ISO 8601). */
  at: z.string().min(1),
  pieceId: z.string().min(1),
  contentVersion: z.int().positive(),
  stars: z.union([z.literal(1), z.literal(2), z.literal(3)]),
  result: pieceResultSchema,
  play: playInfoSchema,
  /** The timing of each note of the play (version 12 on; empty for older attempts and for plays without timing). */
  noteTimings: z.array(noteTimingSchema),
  /** The helps that were in force then (version 13 on; empty for older attempts and for full difficulty). The factor is not stored: it is looked up in the table. */
  helps: helpsSchema,
  /** The XP that was awarded then, so changing the rules later never rewrites history. */
  xp: xpBreakdownSchema,
});

/**
 * One finished tug with a character (ft_1_21; profile document version 2 on): the character, the piece, whether the student won, the XP the
 * level offered, the student's phrases played (the exchanges) and the XP it paid then. Records moved from an older save may
 * name characters that are gone; their XP still counts.
 */
export const tugRecordSchema = z.object({
  /** 1, 2, 3 ... in order. */
  n: z.int().positive(),
  at: z.string().min(1),
  characterId: z.string().min(1),
  pieceId: z.string().min(1),
  won: z.boolean(),
  potentialXp: count,
  exchanges: z.int().positive(),
  xp: count,
});

/**
 * The player's preferences: the staff (version 2 on), how to play (version 4 on), which pieces are turned off (version 6 on),
 * whether the on-screen keyboard is shown (version 9 on),
 * which bars carry a number (version 10 on), the letter names, the staff spacing and the key lights (version 11 on).
 */
export const profileSettingsSchema = z.object({
  staff: staffSettingsSchema,
  play: playSettingsSchema,
  pieces: piecesSettingsSchema,
  keyboard: keyboardSettingsSchema,
  barNumbers: barNumberSettingsSchema,
  /** Letter names: B (English, B) or H (German, B is B flat) (ft_0_17). */
  noteNaming: z.enum(['B', 'H']),
  /** The space between the lines of the staff (ft_0_16). */
  staffGap: z.enum(['wide', 'short']),
  /** Key-light hints (ft_Y_06): whether they are on, and after how many wrong presses (0 to 3). */
  keyLights: z.object({ enabled: z.boolean(), afterWrong: z.int().min(0).max(3) }),
  /** The pitch trainer by ear's length and repeat (version 17 on, ft_1_10 AC6). */
  earTrainer: earTrainerSettingsSchema,
  /**
   * The note duration helper (ft_1_11): which hands get it. Optional, with no version bump (d069.3): a save without it, and
   * every save before it, reads as off (`DEFAULT_DURATION_HELP`).
   */
  durationHelp: durationHelpSchema.optional(),
  /** Show the finger of every note of a chord, each beside its head. Optional, no version bump (d069.3): absent reads as off. */
  chordFingers: z.boolean().optional(),
  /**
   * What the hint label under a chord says (core_09.AC59): its notes, its name, or both. Optional, no version bump (d069.3):
   * absent reads as the notes.
   */
  chordLabels: z.enum(['notes', 'name', 'both']).optional(),
  /** Show the finger numbers on the practice screen from the start. Off, or absent in older saves. Counts as a hint (XP). */
  showFingers: z.boolean().optional(),
  /** Learning a piece bar by bar (ft_1_32): the step size and the mistake markers. Optional, no version bump (d069.3): absent reads as the defaults. */
  learn: learnSettingsSchema.optional(),
});

export const profileSchema = z
  .object({
    schemaVersion: z.literal(PROFILE_SCHEMA_VERSION),
    id: z.string().min(1),
    name: z.string().min(1).max(40),
    createdAt: z.string().min(1),
    settings: profileSettingsSchema,
    attempts: z.array(attemptSchema),
    /** The finished tugs (profile document version 2 on). */
    tugs: z.array(tugRecordSchema),
    /** The note-name trainer's XP (version 15 on): whole XP that only grows; it counts towards the level like a tug's (d083). */
    trainerXp: count,
    /** The practice log (version 16 on): one entry per bar of every play (core_10, d092). */
    practice: practiceLogSchema,
    /** The pitch trainer by ear's points (version 17 on): whole points that only grow. Not XP; the level does not read them (ft_1_10 AC9). */
    earPoints: count,
    /**
     * Learning each piece bar by bar (ft_1_32): where the player is in it, by piece id. Optional, no version bump (d069.3):
     * absent reads as no piece started.
     */
    learning: z.record(z.string().min(1), learnProgressSchema).optional(),
  })
  .superRefine((profile, ctx) => {
    profile.tugs.forEach((b, i) => {
      if (b.n !== i + 1) ctx.addIssue({ code: 'custom', message: `tug numbers must be 1, 2, 3 ... (found ${b.n} at position ${i + 1})`, path: ['tugs', i, 'n'] });
    });
    profile.attempts.forEach((a, i) => {
      if (a.n !== i + 1) {
        ctx.addIssue({ code: 'custom', message: `attempt numbers must be 1, 2, 3 ... (found ${a.n} at position ${i + 1})`, path: ['attempts', i, 'n'] });
      }
      if (a.pieceId !== a.result.chartId) {
        ctx.addIssue({ code: 'custom', message: 'pieceId must equal the result chartId', path: ['attempts', i, 'pieceId'] });
      }
    });
  });

export type ProfileData = z.infer<typeof profileSchema>;
export type ProfileSettings = z.infer<typeof profileSettingsSchema>;
export type Attempt = z.infer<typeof attemptSchema>;
export type TugRecord = z.infer<typeof tugRecordSchema>;

export const DEFAULT_PROFILE_SETTINGS: ProfileSettings = {
  staff: DEFAULT_STAFF_SETTINGS, play: DEFAULT_PLAY_SETTINGS, pieces: DEFAULT_PIECES_SETTINGS, keyboard: DEFAULT_KEYBOARD_SETTINGS,
  barNumbers: DEFAULT_BAR_NUMBER_SETTINGS,
  noteNaming: 'B' satisfies NoteNaming, staffGap: 'short', keyLights: { enabled: false, afterWrong: 2 },
  earTrainer: { ...DEFAULT_EAR_TRAINER_SETTINGS },
};

export interface PieceRecord {
  completions: number;
  /** The piece's own XP (ft_1_13): the ft_0_10 XP of each of its passes, worked out again from the history with today's rules. */
  xp: number;
  /** The piece's level on the piece curve (`pieceLevels`). */
  level: LevelInfo;
  /** The saved three-star best, which the XP rules read. */
  bestStars: Stars;
  bestAccuracy: number;
  /** The five-star grade of the best accuracy: what the player sees (`passStarsFor`). */
  bestGrade: PassStars;
  firstCompletedAt: string;
  lastPlayedAt: string;
}

export interface ProgressSummary {
  totalXp: number;
  level: LevelInfo;
  pieces: Record<string, PieceRecord>;
}

export function emptyProfile(id: string, name: string, createdAt: string): ProfileData {
  return { schemaVersion: PROFILE_SCHEMA_VERSION, id, name, createdAt, settings: structuredClone(DEFAULT_PROFILE_SETTINGS), attempts: [], tugs: [], trainerXp: 0, practice: structuredClone(EMPTY_PRACTICE_LOG), earPoints: 0 };
}

/** Totals, level and per-piece records, folded from the attempt log. */
export function deriveProgress(profile: ProfileData, config: ProgressionConfig): ProgressSummary {
  let totalXp = 0;
  const pieces: Record<string, PieceRecord> = {};
  for (const a of profile.attempts) {
    totalXp += a.xp.total; // what the player was given then: the ft_0_10 XP before ft_1_13, 0 since (practice gives no player XP)
    const previous = pieces[a.pieceId];
    const xp = (previous?.xp ?? 0) + computeXp(a.result, { completions: previous?.completions ?? 0, bestStars: previous?.bestStars ?? 0 }, config).total;
    const level = levelForXp(xp, config.pieceLevels);
    pieces[a.pieceId] = previous
      ? {
          completions: previous.completions + 1,
          xp,
          level,
          bestStars: Math.max(previous.bestStars, a.stars) as Stars,
          bestAccuracy: Math.max(previous.bestAccuracy, a.result.accuracy),
          bestGrade: passStarsFor(Math.max(previous.bestAccuracy, a.result.accuracy)),
          firstCompletedAt: previous.firstCompletedAt,
          lastPlayedAt: a.at,
        }
      : { completions: 1, xp, level, bestStars: a.stars, bestAccuracy: a.result.accuracy, bestGrade: passStarsFor(a.result.accuracy), firstCompletedAt: a.at, lastPlayedAt: a.at };
  }
  for (const b of profile.tugs) totalXp += b.xp; // tugs add XP; they do not change a piece's stars or completions
  totalXp += profile.trainerXp; // the note-name trainer's right names (ft_0_17.AC3)
  return { totalXp, level: levelForXp(totalXp, config.levels), pieces };
}

/**
 * Add the XP of right names in the note-name trainer (ft_0_17.AC3). Whole XP, never negative, so the total only grows; the
 * trainer's rules decided the amount (`core/trainer`). Level-ups are reported like a tug's.
 */
export function addTrainerXp(profile: ProfileData, xp: number, config: ProgressionConfig): { profile: ProfileData; before: ProgressSummary; after: ProgressSummary } {
  const before = deriveProgress(profile, config);
  const next: ProfileData = { ...profile, trainerXp: profile.trainerXp + Math.max(0, Math.round(xp)) };
  return { profile: next, before, after: deriveProgress(next, config) };
}

/**
 * Add the pitch trainer by ear's points (ft_1_10 AC5). Whole points, never negative, so the total only grows. They are kept apart
 * from XP: the level and the main XP do not read them (AC9).
 */
export function addEarPoints(profile: ProfileData, points: number): ProfileData {
  if (!Number.isInteger(points) || points < 0) throw new RangeError('ear points must be a whole number, 0 or more');
  return { ...profile, earPoints: profile.earPoints + points };
}

const EVENT_VERSION = 1;

export interface XpAwarded {
  type: 'XpAwarded';
  v: typeof EVENT_VERSION;
  pieceId: string;
  stars: Stars;
  /** The XP this pass earned the piece (ft_1_13; the player gets none from practice). */
  xp: XpBreakdown;
  /** The player's XP after the pass: unchanged by practice since ft_1_13. */
  totalXp: number;
  /** More stars than ever before on this piece (not the first time). */
  newBest: boolean;
  /** The piece's XP after the pass, and its level before and after (ft_1_13). */
  piece: { xp: number; before: LevelInfo; after: LevelInfo };
}
export interface LevelUp {
  type: 'LevelUp';
  v: typeof EVENT_VERSION;
  from: number;
  to: number;
}
export interface TugFinished {
  type: 'TugFinished';
  v: typeof EVENT_VERSION;
  characterId: string;
  pieceId: string;
  won: boolean;
  xp: number;
  totalXp: number;
}
/** Progression's own domain events: the results screen, a dashboard or the tug can listen to them. */
export type ProgressEvent = XpAwarded | LevelUp | TugFinished;

export interface AttemptOutcome {
  profile: ProfileData;
  attempt: Attempt;
  before: ProgressSummary;
  after: ProgressSummary;
  events: ProgressEvent[];
}

/**
 * Add a finished piece to the profile and report what changed. The pass earns the piece its XP by the rules and the history
 * (ft_0_10's rule, now the piece's: ft_1_13); the player gets none, so the attempt saves 0 XP. Never changes earlier attempts.
 */
export function recordAttempt(
  profile: ProfileData,
  result: PieceResult,
  config: ProgressionConfig,
  now: Date,
  play: PlayInfo = DEFAULT_PLAY_INFO,
  noteTimings: readonly SavedNoteTiming[] = [],
  helps: readonly HelpId[] = [],
): AttemptOutcome {
  const before = deriveProgress(profile, config);
  const previous = before.pieces[result.chartId];
  const stars = starsFor(result.accuracy);
  const xp = computeXp(result, { completions: previous?.completions ?? 0, bestStars: previous?.bestStars ?? 0 }, config);
  const playerXp: XpBreakdown = { ...xp, completion: 0, accuracy: 0, bonus: 0, total: 0 }; // practice gives the player nothing (ft_1_13.AC2)
  const attempt: Attempt = {
    n: profile.attempts.length + 1,
    at: now.toISOString(),
    pieceId: result.chartId,
    contentVersion: result.contentVersion,
    stars,
    result: { ...result },
    play: { ...play },
    noteTimings: noteTimings.map((t) => ({ ...t })),
    helps: [...helps],
    xp: playerXp,
  };
  const next: ProfileData = { ...profile, attempts: [...profile.attempts, attempt] };
  const after = deriveProgress(next, config);

  const events: ProgressEvent[] = [
    {
      type: 'XpAwarded', v: EVENT_VERSION, pieceId: result.chartId, stars, xp, totalXp: after.totalXp,
      newBest: previous !== undefined && passStarsFor(result.accuracy) > previous.bestGrade,
      piece: { xp: after.pieces[result.chartId]!.xp, before: previous?.level ?? levelForXp(0, config.pieceLevels), after: after.pieces[result.chartId]!.level },
    },
  ];
  return { profile: next, attempt, before, after, events };
}

/** A level reached between two progress summaries (nothing when the level did not change). Player levels lock no piece (ft_1_13.AC3). */
function levelEvents(before: ProgressSummary, after: ProgressSummary): ProgressEvent[] {
  if (after.level.level <= before.level.level) return [];
  return [{ type: 'LevelUp', v: EVENT_VERSION, from: before.level.level, to: after.level.level }];
}

export type TugInput = Omit<TugRecord, 'n' | 'at'>;

export interface TugOutcome {
  profile: ProfileData;
  tug: TugRecord;
  before: ProgressSummary;
  after: ProgressSummary;
  events: ProgressEvent[];
}

/**
 * Add a finished tug to the profile (ft_1_21.AC9): its XP counts towards levels like a piece's (the tug's rules decided the
 * XP). Never changes earlier records and never lowers XP. Level-ups are reported.
 */
export function addTugRecord(profile: ProfileData, input: TugInput, config: ProgressionConfig, now: Date): TugOutcome {
  const before = deriveProgress(profile, config);
  const tug: TugRecord = { n: profile.tugs.length + 1, at: now.toISOString(), ...input, xp: Math.max(0, Math.round(input.xp)) };
  const next: ProfileData = { ...profile, tugs: [...profile.tugs, tug] };
  const after = deriveProgress(next, config);
  const events: ProgressEvent[] = [
    { type: 'TugFinished', v: EVENT_VERSION, characterId: tug.characterId, pieceId: tug.pieceId, won: tug.won, xp: tug.xp, totalXp: after.totalXp },
  ];
  events.push(...levelEvents(before, after));
  return { profile: next, tug, before, after, events };
}
