/**
 * The teacher's check-up (ft_1_27.AC2, ft_1_25.AC4; WP-15; plan 5.2): which pieces the teacher checks today, the turn plan of the
 * check-up (the student plays the curriculum piece once), the verdict and lines from the measured result against the
 * expected level (AX-2.1), and the visit in the world document (A.8 `teacherVisits`). The teacher lands on a deadline day or on
 * the day the student asked for the test (a `test` entry in the curriculum's calendar). AX-3 provisional.
 */
import type { DayString, PieceId, StringKey } from '../contracts';
import type { Curriculum } from '../curriculum/curriculum';
import { dayNumber } from '../curriculum/evaluate';
import type { PieceStatus } from '../curriculum/play';
import type { TurnPlan } from '../exchange/exchange';
import type { WorldState } from './worldState';

/** A line the teacher says, as Kiur's (`KiurLine`): `piece` fills `{piece}` with the piece's title, `params` the rest. */
export interface TeacherLine {
  readonly line: StringKey;
  readonly piece: PieceId;
  readonly params: Readonly<Record<string, string | number>>;
}

/** The teacher's weekly test days when the curriculum sets none: Sunday and Wednesday. */
export const DEFAULT_TEST_WEEKDAYS: readonly number[] = [0, 3];

/** The curriculum's weekly test days, 0 Sunday to 6 Saturday, sorted, each once (ft_1_26.AC9). */
export function testWeekdaysOf(curriculum: Curriculum): number[] {
  return [...new Set(curriculum.testWeekdays ?? DEFAULT_TEST_WEEKDAYS)].sort((a, b) => a - b);
}

/** The weekday of a day, 0 Sunday to 6 Saturday (day 0 of the Unix epoch was a Thursday). */
export function weekdayOf(day: DayString): number {
  return (((dayNumber(day) + 4) % 7) + 7) % 7;
}

/** A weekly test day (ft_1_26.AC9): one of the curriculum's test weekdays, while it has pieces to test. */
export function isTestDay(curriculum: Curriculum, day: DayString): boolean {
  return curriculum.pieces.length > 0 && testWeekdaysOf(curriculum).includes(weekdayOf(day));
}

/**
 * The days the teacher's boat comes for (ft_1_25.AC4): every curriculum deadline, every `test` day in the calendar, and
 * the weekly test days from `from` for `ahead` days more (ft_1_26.AC9).
 */
export function teacherDays(curriculum: Curriculum, from: DayString, ahead = 14): DayString[] {
  const weekly: DayString[] = [];
  const start = dayNumber(from);
  for (let n = start; n <= start + ahead; n++) {
    const day = new Date(n * 86_400_000).toISOString().slice(0, 10);
    if (isTestDay(curriculum, day)) weekly.push(day);
  }
  return [...curriculum.pieces.map((p) => p.deadline), ...curriculum.calendar.filter((c) => c.kind === 'test').map((c) => c.day), ...weekly];
}

/**
 * The student asks for the test today (ft_1_25.AC4's second half): a `test` entry in the calendar for the piece, so the
 * boat lands today. Asking twice the same day, or for a piece not in the curriculum, changes nothing.
 */
export function askForTest(curriculum: Curriculum, day: DayString, piece: PieceId): Curriculum {
  if (!curriculum.pieces.some((p) => p.piece === piece)) return curriculum;
  if (curriculum.calendar.some((c) => c.kind === 'test' && c.day === day && c.piece === piece)) return curriculum;
  return { ...curriculum, calendar: [...curriculum.calendar, { day, kind: 'test', piece }] };
}

/** The minutes in a day: a time of day of `checkupsDue` that counts everything of the day. */
export const DAY_MINUTES = 24 * 60;

/** A time of day, `HH:MM`, in minutes after midnight; none is the start of the day (0). */
export function minutesOf(time: string | undefined): number {
  if (time === undefined) return 0;
  const [h, m] = time.split(':').map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
}

/** `HH:MM` of minutes after midnight. */
export function timeOf(minutes: number): string {
  const two = (n: number) => String(n).padStart(2, '0');
  return `${two(Math.floor(minutes / 60))}:${two(minutes % 60)}`;
}

/** The times of day today from which the teacher comes, each with the piece it names (none: the most urgent piece not yet passed). */
function comings(day: DayString, curriculum: Curriculum): { at: number; piece: PieceId | undefined }[] {
  const at = minutesOf(curriculum.testTime);
  const out: { at: number; piece: PieceId | undefined }[] = curriculum.pieces.filter((p) => p.deadline === day).map((p) => ({ at, piece: p.piece }));
  // a test asked for a piece no longer on the curriculum (or left out of what is owed, once passed) brings the teacher for nothing
  for (const c of curriculum.calendar) {
    if (c.kind !== 'test' || c.day !== day) continue;
    if (c.piece === undefined || curriculum.pieces.some((p) => p.piece === c.piece)) out.push({ at: minutesOf(c.time), piece: c.piece });
  }
  // a weekly test day is a test with no piece named (ft_1_26.AC9)
  if (isTestDay(curriculum, day)) out.push({ at, piece: undefined });
  return out;
}

/** The next time of day, after `minutes`, at which the teacher comes today (ft_1_26.AC9); null when none is left today. */
export function nextTestTime(day: DayString, curriculum: Curriculum, minutes: number): number | null {
  const later = comings(day, curriculum).map((c) => c.at).filter((at) => at > minutes);
  return later.length === 0 ? null : Math.min(...later);
}

/** The teacher orders a test for a day and a time of day (ft_1_26.AC9): a `test` entry with no piece; the same twice changes nothing. */
export function orderTest(curriculum: Curriculum, day: DayString, time: string): Curriculum {
  if (curriculum.calendar.some((c) => c.kind === 'test' && c.day === day && c.time === time && c.piece === undefined)) return curriculum;
  return { ...curriculum, calendar: [...curriculum.calendar, { day, kind: 'test', time }] };
}

/**
 * The pieces the teacher checks today, most urgent first (the order of `statuses`): each curriculum piece due today or
 * asked for in a `test` entry today (a test entry without a piece, and a weekly test day, mean the most urgent piece not
 * yet passed), from its time of day on (`minutes`, the time now; by default the whole day counts), less pieces already passed
 * and those already checked today. Empty when the teacher does not land.
 */
export function checkupsDue(day: DayString, curriculum: Curriculum, statuses: readonly PieceStatus[], world: WorldState, minutes = DAY_MINUTES): PieceId[] {
  const passed = passedPieces(world);
  const due = new Set<PieceId>();
  for (const c of comings(day, curriculum)) {
    if (c.at > minutes) continue;
    const piece = c.piece ?? statuses.find((s) => !passed.has(s.piece))?.piece;
    if (piece !== undefined && curriculum.pieces.some((p) => p.piece === piece)) due.add(piece);
  }
  for (const v of world.teacherVisits) if (v.day === day) due.delete(v.piece);
  for (const piece of passed) due.delete(piece);
  const order = new Map(statuses.map((s, i) => [s.piece, i]));
  return [...due].sort((a, b) => (order.get(a) ?? Infinity) - (order.get(b) ?? Infinity) || (a < b ? -1 : a > b ? 1 : 0));
}

/**
 * The check-up as a turn plan (A.10): one judged student turn over the whole piece, both hands, with the staff, in Wait
 * mode (the MVP play mode). `bars` as the chart counts them (a pick-up is bar 0, d120). AX-3 provisional: the test's own
 * rules (tempo, from memory, a mistake limit; plan 4.7, F12) come later.
 */
export function checkupPlan(piece: PieceId, bars: { readonly from: number; readonly to: number }): TurnPlan {
  return { kind: 'checkup', piece, level: 1, turns: [{ who: 'student', bars, judged: true, mode: 'wait', hands: 'both', staff: true }] };
}

/** What the teacher says on landing: the days to the piece's deadline and the piece to play (ft_1_27.AC2). */
export function arrivalLine(piece: PieceId, deadline: DayString, day: DayString): TeacherLine {
  const days = Math.max(0, dayNumber(deadline) - dayNumber(day));
  if (days === 0) return { line: 'teacherSays.arrive.today', piece, params: {} };
  if (days === 1) return { line: 'teacherSays.arrive.oneDay', piece, params: {} };
  return { line: 'teacherSays.arrive', piece, params: { days } };
}

/** More bars than this are named by their count, not their numbers. */
export const MAX_NAMED_BARS = 4;

export interface CheckupVerdict {
  readonly result: 'passed' | 'notYet';
  /** One or two short lines: the measured score against the expected level, then what follows (ft_1_27.AC2, AX-2.1). */
  readonly lines: readonly TeacherLine[];
}

/**
 * The verdict of one check-up play: passed when its play score (core_12, 0 to 100) reaches the piece's expected level,
 * else not yet, naming the bars that had a mistake (by number, or by count above `MAX_NAMED_BARS`). AX-1: one play at the
 * expected level, no rounding up.
 */
export function checkupVerdict(play: { readonly piece: PieceId; readonly score: number; readonly barsWithMistakes: readonly number[] }, expected: number): CheckupVerdict {
  // Shown rounded down, so the line never shows the expected level on a play below it (AX-2.1).
  const score = Math.floor(play.score);
  const result = play.score >= expected ? 'passed' : 'notYet';
  const measured: TeacherLine = { line: 'teacherSays.result', piece: play.piece, params: { score, expected } };
  if (result === 'passed') return { result, lines: [measured, { line: 'teacherSays.passed', piece: play.piece, params: {} }] };
  const bars = [...new Set(play.barsWithMistakes)].sort((a, b) => a - b);
  let next: TeacherLine;
  if (bars.length === 0) next = { line: 'teacherSays.notYet', piece: play.piece, params: {} };
  else if (bars.length === 1) next = { line: 'teacherSays.notYet.bar', piece: play.piece, params: { bar: bars[0]! } };
  else if (bars.length <= MAX_NAMED_BARS) next = { line: 'teacherSays.notYet.bars', piece: play.piece, params: { bars: bars.join(', ') } };
  else next = { line: 'teacherSays.notYet.many', piece: play.piece, params: { count: bars.length } };
  return { result, lines: [measured, next] };
}

/** The check-up in the world document (A.8 `teacherVisits`): one entry per piece and day, a later one replacing it. */
export function recordCheckup(world: WorldState, visit: { readonly day: DayString; readonly piece: PieceId; readonly result: 'passed' | 'notYet' }): WorldState {
  const others = world.teacherVisits.filter((v) => !(v.day === visit.day && v.piece === visit.piece));
  return { ...world, teacherVisits: [...others, { day: visit.day, piece: visit.piece, result: visit.result }] };
}

/**
 * The pieces the teacher passed at a check-up (A.8 `teacherVisits`): Kiur no longer reminds of them (`kiurAdvice`) and the teacher
 * does not check them again. Over all time: a passed piece given a new deadline stays passed (TODO in ft_1_27).
 */
export function passedPieces(world: WorldState): ReadonlySet<PieceId> {
  return new Set(world.teacherVisits.filter((v) => v.result === 'passed').map((v) => v.piece));
}
