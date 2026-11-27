/**
 * What is said in the player's room (ft_1_27.AC2, AC3; ft_1_25.AC5; WP-15): Kiur's lines on opening the game and on each
 * visit, and the teacher's check-up when she has landed. Pure: the room scene reads the player's world, curriculum and
 * practice log, keeps whether Kiur reminded today, and draws what this gives. AX-3 provisional.
 */
import type { DayString, PieceId } from '../contracts';
import type { Curriculum } from '../curriculum/curriculum';
import { dayNumber, type EvaluationRules } from '../curriculum/evaluate';
import { runScore, wholePiecePlays } from '../curriculum/fromLog';
import type { PieceStatus } from '../curriculum/play';
import type { PracticeLog } from '../progression/practiceLog';
import { kiurAdvice, kiurSays, type KiurLine, type KiurRules } from './kiur';
import { headsUps, teacherBoat, type PresenceRules } from './presenceRules';
import { arrivalLine, checkupsDue, checkupVerdict, nextTestTime, passedPieces, recordCheckup, teacherDays, type CheckupVerdict, type TeacherLine } from './teacher';
import type { WorldState } from './worldState';

/** The boat on the day she comes, before her time: not landed yet. */
const TODAY_COMING = 0.99;

export interface RoomTalkInput {
  /** `open`: the first visit to the room after the player was chosen, as the game opens; `room`: every later visit. */
  readonly occasion: 'open' | 'room';
  readonly day: DayString;
  /** The time of day now, in minutes after midnight (local): she comes from her test time on (ft_1_26.AC9). */
  readonly minutes: number;
  readonly curriculum: Curriculum;
  /** The curriculum's statuses, most urgent first (`curriculumStatuses`). */
  readonly statuses: readonly PieceStatus[];
  readonly world: WorldState;
  readonly remindedToday: boolean;
  /** Visits to the room today before this one. */
  readonly visit: number;
  readonly kiurRules: KiurRules;
  readonly presenceRules: Pick<PresenceRules, 'boatDays'>;
  readonly minPlays: number;
}

export interface RoomTalk {
  /** What Kiur says, in order (`kiurSays`). */
  readonly kiur: readonly KiurLine[];
  /** The teacher is in the room: the piece she checks first and her first line; null when she does not land today. */
  readonly checkup: { readonly piece: PieceId; readonly arrival: TeacherLine } | null;
  /** The next time of day she comes today, in minutes after midnight, when she is not here yet; null when none. */
  readonly next: number | null;
}

/**
 * What is said in the room now. Kiur's heads-ups are the teacher's boat only (coming, or landed today): a character's
 * heads-up waits until presence decides who stands in the scenes (WP-11), so Kiur never sends the student to an empty
 * place (AX-2.1); the boat no longer comes for the deadline of a piece she passed. AX-3 provisional.
 */
export function roomTalk(input: RoomTalkInput): RoomTalk {
  const { day, curriculum, statuses, world } = input;
  const passed = passedPieces(world);
  const advice = kiurAdvice(statuses, input.kiurRules, passed);
  // her boat comes for the deadlines of the pieces she has not passed, and for every test day
  const owed: Curriculum = { ...curriculum, pieces: curriculum.pieces.filter((p) => !passed.has(p.piece)) };
  const piece = checkupsDue(day, curriculum, statuses, world, input.minutes)[0];
  const deadline = curriculum.pieces.find((p) => p.piece === piece)?.deadline;
  const checkup = piece === undefined || deadline === undefined ? null : { piece, arrival: arrivalLine(piece, deadline, day) };
  const next = checkup === null ? nextTestTime(day, owed, input.minutes) : null;
  // on her day the boat has landed only while she waits at the piano; before her time it is still coming, after her check-up gone
  const boat = teacherBoat(day, teacherDays(owed, day), input.presenceRules);
  const today = boat?.progress === 1 ? (checkup !== null ? boat : next !== null ? { progress: TODAY_COMING } : null) : boat;
  const heads = headsUps({}, today);
  const said = kiurSays({ occasion: input.occasion, advice, remindedToday: input.remindedToday, headsUps: heads, visit: input.visit, minPlays: input.minPlays });
  return { kiur: overdue(said, curriculum, day), checkup, next };
}

/**
 * A reminder of a piece whose deadline has passed is followed by how long ago it was, so it does not read the same weeks
 * later (AX-2.1: the measured fact, no blame). AX-3 provisional: the wording.
 */
function overdue(lines: readonly KiurLine[], curriculum: Curriculum, day: DayString): KiurLine[] {
  return lines.flatMap((l) => {
    const deadline = l.line.startsWith('kiur.remind.') ? curriculum.pieces.find((p) => p.piece === l.piece)?.deadline : undefined;
    const days = deadline === undefined ? 0 : dayNumber(day) - dayNumber(deadline);
    if (days <= 0) return [l];
    return [l, days === 1 ? { line: 'kiur.remind.overdueOne', params: {} } : { line: 'kiur.remind.overdue', params: { days } }];
  });
}

/** Whether these lines hold a reminder, so the caller counts Kiur as having reminded today (a heads-up does not count). */
export function remindsIn(lines: readonly KiurLine[]): boolean {
  return lines.some((l) => l.line.startsWith('kiur.remind.'));
}

/** The play the teacher hears: its score (core_12) and the bars with a mistake, numbered as on the staff (a pick-up is 0). */
export interface CheckupPlay {
  readonly piece: PieceId;
  readonly score: number;
  readonly barsWithMistakes: readonly number[];
}

/**
 * The first whole play of `piece` (every bar, from the first, no section) that ended after `since`, the moment the
 * check-up began; null when there is none (the student left before the end). `firstPrinted` is the piece's
 * `firstPrintedBar`: with a pick-up (0) the bars are named as printed, the pick-up 0 (core_09.AC25).
 */
export function checkupPlay(log: PracticeLog, piece: PieceId, barCount: number, since: string, rules: EvaluationRules, firstPrinted: 0 | 1 = 1): CheckupPlay | null {
  const from = Date.parse(since);
  const run = wholePiecePlays(log, piece, barCount).find((r) => Date.parse(r[r.length - 1]!.at) > from && Date.parse(r[0]!.at) >= from);
  if (run === undefined) return null;
  const barsWithMistakes = run.filter((b) => b.firstTry < b.notes || b.misses.length > 0).map((b) => b.bar + firstPrinted);
  return { piece, score: runScore(run, rules), barsWithMistakes };
}

/** The check-up held: her verdict on the play against the expected level, kept in the world (A.8 `teacherVisits`). */
export function holdCheckup(world: WorldState, day: DayString, play: CheckupPlay, expected: number): { world: WorldState; verdict: CheckupVerdict } {
  const verdict = checkupVerdict(play, expected);
  return { world: recordCheckup(world, { day, piece: play.piece, result: verdict.result }), verdict };
}
