/**
 * What Kiur says and when (ft_1_27.AC3, AC4; ft_1_25.AC5; WP-15; plan F14 and 4.8): one pure function from the curriculum
 * statuses (A.11) to the forced piece, how often Kiur reminds of it and whether Kiur flies to the shoulder; one from that
 * advice, the occasion and today's heads-ups (A.9) to the lines Kiur says now. Every line names the piece and the measured
 * gap (AX-2.1). Numbers in content/world/kiur.json. AX-3 provisional until the students have played it.
 */
import { z } from 'zod';
import type { PieceId, StringKey } from '../contracts';
import type { PieceStatus } from '../curriculum/play';
import type { Presence } from './presence';

export const kiurRulesSchema = z.strictObject({
  schemaVersion: z.literal(1),
  note: z.string().optional(),
  /** A gap of at least this many points is reminded once a day (ft_1_27.AC3). */
  dailyFromGap: z.number().min(0),
  /** A gap above this many points is reminded on every visit (ft_1_27.AC3). */
  everyVisitAboveGap: z.number().min(0),
});

export type KiurRules = z.infer<typeof kiurRulesSchema>;

export function parseKiurRules(raw: unknown): KiurRules {
  return kiurRulesSchema.parse(raw);
}

/** The defaults; content/world/kiur.json holds the same (a test keeps them equal). */
export const DEFAULT_KIUR_RULES: KiurRules = {
  schemaVersion: 1,
  note: 'AX-3 provisional (ft_1_27.AC3, WP-15). The gap is the expected level minus the predicted one at the deadline (or minus the level today, before there is a trend), rounded to whole points. Under dailyFromGap Kiur does not remind; from it, once a day; above everyVisitAboveGap, on every visit. A piece with no level yet (under the minimum of plays) is reminded once a day.',
  dailyFromGap: 1,
  everyVisitAboveGap: 5,
};

/** How a piece is behind: by the trend to its deadline, by its level today (no trend yet), or not measured (too few plays). */
export type GapKind = 'trend' | 'now' | 'unmeasured';

export interface ForcedPiece {
  readonly piece: PieceId;
  readonly kind: GapKind;
  /** Whole points below the expected level; 0 when unmeasured. */
  readonly gap: number;
  readonly plays: number;
  /** How often Kiur reminds of it (ft_1_27.AC3). */
  readonly often: 'daily' | 'everyVisit';
}

export interface KiurAdvice {
  /** The most urgent curriculum piece that owes anything: the one Kiur reminds of and the shoulder opens (plan 4.5, 4.8). */
  readonly forced: ForcedPiece | null;
  /** ft_1_27.AC4: a piece whose band's top is below its expected level, with the gap to the predicted level. */
  readonly shoulder: { readonly piece: PieceId; readonly gap: number } | null;
}

/** The gap of a status, in whole points: expected − predicted, or expected − level before a trend; null without a level. */
export function gapOf(s: PieceStatus): { kind: GapKind; gap: number } {
  if (s.level === null) return { kind: 'unmeasured', gap: 0 };
  if (s.delta !== null) return { kind: 'trend', gap: Math.round(s.delta) };
  return { kind: 'now', gap: Math.round(s.expected - s.level) };
}

/**
 * Kiur's advice from the statuses, most urgent first (as `curriculumStatuses` orders them): the forced piece is the first
 * that owes anything (a gap of at least `dailyFromGap`, or no level yet); the shoulder opens on the forced piece when its
 * band's top is below its expected level, else on the first piece that is (AC4), never on a gap that rounds to 0.
 */
export function kiurAdvice(statuses: readonly PieceStatus[], rules: KiurRules, passed: ReadonlySet<PieceId> = new Set()): KiurAdvice {
  let forced: ForcedPiece | null = null;
  for (const s of statuses) {
    if (passed.has(s.piece)) continue;
    const { kind, gap } = gapOf(s);
    if (kind === 'unmeasured') {
      forced = { piece: s.piece, kind, gap, plays: s.plays, often: 'daily' };
      break;
    }
    if (gap >= rules.dailyFromGap && gap > 0) {
      forced = { piece: s.piece, kind, gap, plays: s.plays, often: gap > rules.everyVisitAboveGap ? 'everyVisit' : 'daily' };
      break;
    }
  }
  // The forced piece when it is itself out of reach (plan 4.8), else the first that is; a gap that rounds to 0 is none.
  const outOfReach = (s: PieceStatus) => !passed.has(s.piece) && s.band !== null && s.band.high < s.expected && Math.round(s.delta ?? 0) >= 1;
  const forcedStatus = statuses.find((s) => s.piece === forced?.piece);
  const out = forcedStatus !== undefined && outOfReach(forcedStatus) ? forcedStatus : statuses.find(outOfReach);
  const shoulder = out === undefined ? null : { piece: out.piece, gap: Math.round(out.delta ?? 0) };
  return { forced, shoulder };
}

/** Where Kiur speaks: on opening the game, in the room, in a scene (ft_1_27.AC3, AC4; ft_1_25.AC5). */
export type KiurOccasion = 'open' | 'room' | 'scene';

/**
 * One thing Kiur says. `piece` is the id for the screen to fill `{piece}` with the piece's title; `params` are the other
 * placeholders. `offerPiano` makes it the shoulder offer: one press opens the piano with that piece, Back is always there
 * (AC4).
 */
export interface KiurLine {
  readonly line: StringKey;
  readonly piece?: PieceId;
  readonly params: Readonly<Record<string, number>>;
  readonly offerPiano?: PieceId;
}

export interface KiurMoment {
  readonly occasion: KiurOccasion;
  readonly advice: KiurAdvice;
  /** Whether Kiur already reminded today (the caller keeps it per player and day). */
  readonly remindedToday: boolean;
  readonly headsUps: Presence['headsUps'];
  /** Visits to the room today before this one, so each visit gives the next heads-up (AC5). */
  readonly visit?: number;
  /** The minimum of plays for a level (EvaluationRules.minPlays), named in the unmeasured reminder. */
  readonly minPlays: number;
}

/** The reminder line of the forced piece (AC3: it names the piece and the gap). */
export function reminderLine(forced: ForcedPiece, minPlays: number): KiurLine {
  if (forced.kind === 'unmeasured') return { line: 'kiur.remind.unmeasured', piece: forced.piece, params: { plays: forced.plays, need: minPlays } };
  return { line: forced.kind === 'trend' ? 'kiur.remind.trend' : 'kiur.remind.now', piece: forced.piece, params: { gap: forced.gap } };
}

/**
 * What Kiur says now, in order: on opening the game and in the room, the reminder when it is due (daily: not yet today;
 * every visit: always); in the room, then one heads-up, the next one on each visit (AC5); in a scene, the shoulder offer
 * when a piece is clearly out of reach (AC4). Nothing else.
 */
export function kiurSays(m: KiurMoment): KiurLine[] {
  const lines: KiurLine[] = [];
  if (m.occasion === 'scene') {
    if (m.advice.shoulder !== null) {
      const { piece, gap } = m.advice.shoulder;
      lines.push({ line: 'kiur.shoulder', piece, params: { gap }, offerPiano: piece });
    }
    return lines;
  }
  const forced = m.advice.forced;
  if (forced !== null && (forced.often === 'everyVisit' || !m.remindedToday)) lines.push(reminderLine(forced, m.minPlays));
  if (m.occasion === 'room' && m.headsUps.length > 0) {
    const h = m.headsUps[(m.visit ?? 0) % m.headsUps.length]!;
    lines.push({ line: h.line, params: {} });
  }
  return lines;
}
