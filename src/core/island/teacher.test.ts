import { describe, expect, it } from 'vitest';
import type { Curriculum } from '../curriculum/curriculum';
import type { PieceStatus } from '../curriculum/play';
import { strings } from '../text/strings';
import { DEFAULT_KIUR_RULES, kiurAdvice } from './kiur';
import type { PresenceInput } from './presence';
import { DEFAULT_PRESENCE_RULES, presence } from './presenceRules';
import {
  DEFAULT_TEST_WEEKDAYS, MAX_NAMED_BARS, arrivalLine, askForTest, checkupPlan, checkupVerdict, checkupsDue, isTestDay, passedPieces, recordCheckup, teacherDays,
  minutesOf, nextTestTime, orderTest, testWeekdaysOf, weekdayOf,
} from './teacher';
import type { WorldState } from './worldState';

const empty: WorldState = { flags: [], items: [], met: {}, teacherVisits: [] };
const curriculum: Curriculum = {
  base: 85,
  pieces: [
    { piece: 'a', deadline: '1998-11-25', priority: 2 },
    { piece: 'b', deadline: '1998-11-25', priority: 8 },
    { piece: 'c', deadline: '1998-12-10', priority: 5 },
  ],
  calendar: [{ day: '1998-11-20', kind: 'lesson' }],
  testWeekdays: [],
};
const status = (piece: string): PieceStatus => ({
  piece, plays: 5, level: 80, spread: 2, histogram: [], retained: false, expected: 90, predicted: 85, band: null, delta: 5, urgency: 1, colour: 'green',
});
/** Most urgent first, as curriculumStatuses gives them: b, c, a. */
const statuses = [status('b'), status('c'), status('a')];
const input = (over: Partial<PresenceInput>): PresenceInput => ({
  day: '1998-11-18', practiceMinutes: 0, practiceMinutesToday: 0, characters: [], world: empty, curriculum, statuses: [], cleanPlaysSinceLostTug: {}, ...over,
});

describe('when the teacher lands (ft_1_25.AC4)', () => {
  it('ft_1_25.AC4 the boat comes for every deadline and every test day; the student asking for the test lands it today', () => {
    expect(teacherDays(curriculum, '1998-11-18')).toEqual(['1998-11-25', '1998-11-25', '1998-12-10']);
    const asked = askForTest(curriculum, '1998-12-01', 'c');
    expect(teacherDays(asked, '1998-11-18')).toContain('1998-12-01');
    expect(askForTest(asked, '1998-12-01', 'c')).toBe(asked);
    expect(curriculum.calendar).toHaveLength(1);
    expect(presence(input({ day: '1998-12-01', curriculum }), DEFAULT_PRESENCE_RULES).teacherBoat).toBeNull(); // the deadline of c is 9 days out
    expect(presence(input({ day: '1998-12-01', curriculum: asked }), DEFAULT_PRESENCE_RULES).teacherBoat).toEqual({ progress: 1 });
  });

  it('ft_1_27.AC2 she checks each piece due today, most urgent first, once a day', () => {
    expect(checkupsDue('1998-11-24', curriculum, statuses, empty)).toEqual([]);
    expect(checkupsDue('1998-11-25', curriculum, statuses, empty)).toEqual(['b', 'a']);
    const checked = recordCheckup(empty, { day: '1998-11-25', piece: 'b', result: 'notYet' });
    expect(checkupsDue('1998-11-25', curriculum, statuses, checked)).toEqual(['a']);
    expect(checkupsDue('1998-11-26', curriculum, statuses, checked)).toEqual([]);
  });

  it('ft_1_25.AC4 on an asked-for test day she checks that piece; a test entry without a piece means the most urgent one', () => {
    expect(checkupsDue('1998-12-01', askForTest(curriculum, '1998-12-01', 'c'), statuses, empty)).toEqual(['c']);
    const bare: Curriculum = { ...curriculum, calendar: [{ day: '1998-12-01', kind: 'test' }] };
    expect(checkupsDue('1998-12-01', bare, statuses, empty)).toEqual(['b']);
    expect(askForTest(curriculum, '1998-12-01', 'not-in-curriculum')).toBe(curriculum);
    // a passed piece is not checked again; a bare test entry takes the most urgent piece not yet passed
    const passedB = recordCheckup(empty, { day: '1998-11-20', piece: 'b', result: 'passed' });
    expect(checkupsDue('1998-12-01', bare, statuses, passedB)).toEqual(['c']);
    expect(checkupsDue('1998-11-25', curriculum, statuses, passedB)).toEqual(['a']);
    expect(checkupsDue('1998-12-01', bare, [], empty)).toEqual([]);
  });
});

describe('the check-up (ft_1_27.AC2)', () => {
  it('ft_1_27.AC2 the student plays the curriculum piece once: one judged turn, the whole piece, with the staff, in Wait mode', () => {
    expect(checkupPlan('b', { from: 1, to: 8 })).toEqual({
      kind: 'checkup', piece: 'b', level: 1,
      turns: [{ who: 'student', bars: { from: 1, to: 8 }, judged: true, mode: 'wait', hands: 'both', staff: true }],
    });
  });

  it('on landing she names the days to the deadline and the piece', () => {
    expect(arrivalLine('c', '1998-12-10', '1998-12-01')).toEqual({ line: 'teacherSays.arrive', piece: 'c', params: { days: 9 } });
    expect(arrivalLine('c', '1998-12-10', '1998-12-09')).toEqual({ line: 'teacherSays.arrive.oneDay', piece: 'c', params: {} });
    expect(arrivalLine('b', '1998-11-25', '1998-11-25')).toEqual({ line: 'teacherSays.arrive.today', piece: 'b', params: {} });
    expect(arrivalLine('b', '1998-11-25', '1998-11-27').line).toBe('teacherSays.arrive.today');
  });

  it('ft_1_27.AC2 she says the measured result against the expected level in two short lines', () => {
    expect(checkupVerdict({ piece: 'b', score: 93, barsWithMistakes: [] }, 93)).toEqual({
      result: 'passed',
      lines: [{ line: 'teacherSays.result', piece: 'b', params: { score: 93, expected: 93 } }, { line: 'teacherSays.passed', piece: 'b', params: {} }],
    });
    // AX-1: no rounding up; shown rounded down, so the line never reads 93 of 93 on a play that did not pass
    expect(checkupVerdict({ piece: 'b', score: 92.6, barsWithMistakes: [] }, 93)).toMatchObject({ result: 'notYet', lines: [{ params: { score: 92, expected: 93 } }, { line: 'teacherSays.notYet' }] });
    expect(checkupVerdict({ piece: 'b', score: 80, barsWithMistakes: [] }, 93).lines[1]).toEqual({ line: 'teacherSays.notYet', piece: 'b', params: {} });
  });

  it('ft_1_27.AC2 not yet names the bars with a mistake, or their count when there are many', () => {
    const next = (bars: number[]) => checkupVerdict({ piece: 'b', score: 70, barsWithMistakes: bars }, 90).lines[1];
    expect(next([4, 4])).toEqual({ line: 'teacherSays.notYet.bar', piece: 'b', params: { bar: 4 } });
    expect(next([7, 3])).toEqual({ line: 'teacherSays.notYet.bars', piece: 'b', params: { bars: '3, 7' } });
    expect(next([1, 2, 3, 4])!.line).toBe('teacherSays.notYet.bars');
    expect(next([1, 2, 3, 4, 5])).toEqual({ line: 'teacherSays.notYet.many', piece: 'b', params: { count: MAX_NAMED_BARS + 1 } });
  });

  it('ft_1_25.AC1 the visit is kept in the world document, one per piece and day', () => {
    let world = recordCheckup(empty, { day: '1998-11-25', piece: 'b', result: 'notYet' });
    world = recordCheckup(world, { day: '1998-11-25', piece: 'a', result: 'passed' });
    world = recordCheckup(world, { day: '1998-11-25', piece: 'b', result: 'passed' });
    expect(world.teacherVisits).toEqual([
      { day: '1998-11-25', piece: 'a', result: 'passed' },
      { day: '1998-11-25', piece: 'b', result: 'passed' },
    ]);
    expect(empty.teacherVisits).toEqual([]);
  });

  it('ft_1_27.AC3 Kiur no longer reminds of a piece she passed; a piece not yet passed stays forced', () => {
    let world = recordCheckup(empty, { day: '1998-11-25', piece: 'b', result: 'passed' });
    world = recordCheckup(world, { day: '1998-11-25', piece: 'a', result: 'notYet' });
    expect([...passedPieces(world)]).toEqual(['b']);
    const out = { ...status('b'), band: { low: 70, high: 80 } };
    expect(kiurAdvice([out, status('a')], DEFAULT_KIUR_RULES, passedPieces(world))).toMatchObject({ forced: { piece: 'a' }, shoulder: null });
    expect(kiurAdvice([out, status('a')], DEFAULT_KIUR_RULES)).toMatchObject({ forced: { piece: 'b' }, shoulder: { piece: 'b' } });
  });

  it('every line she can say has text (write-ui-text)', () => {
    for (const key of ['teacherSays.arrive', 'teacherSays.arrive.oneDay', 'teacherSays.arrive.today', 'teacherSays.result', 'teacherSays.passed', 'teacherSays.notYet', 'teacherSays.notYet.bar', 'teacherSays.notYet.bars', 'teacherSays.notYet.many']) {
      expect(key in strings, key).toBe(true);
    }
  });
});

describe("the teacher's weekly test days (ft_1_26.AC9, ft_1_27.AC2)", () => {
  const weekly: Curriculum = { base: curriculum.base, pieces: curriculum.pieces, calendar: curriculum.calendar };
  it('ft_1_26.AC9 a curriculum without its own test days has them on Sunday and Wednesday; an empty list means none', () => {
    expect(DEFAULT_TEST_WEEKDAYS).toEqual([0, 3]);
    expect(testWeekdaysOf(weekly)).toEqual([0, 3]);
    expect(testWeekdaysOf({ ...curriculum, testWeekdays: [] })).toEqual([]);
    expect(testWeekdaysOf({ ...curriculum, testWeekdays: [5, 1, 1] })).toEqual([1, 5]);
    // in the fixture's month, the day used is a Sunday, three days on a Wednesday, the day before a Saturday
    expect([weekdayOf('1998-11-22'), weekdayOf('1998-11-25'), weekdayOf('1998-11-21'), weekdayOf('1970-01-01')]).toEqual([0, 3, 6, 4]);
    expect(isTestDay(weekly, '1998-11-22')).toBe(true);
    expect(isTestDay(weekly, '1998-11-23')).toBe(false);
    expect(isTestDay({ ...weekly, testWeekdays: [1] }, '1998-11-23')).toBe(true);
    // no pieces on the curriculum: nothing to test
    expect(isTestDay({ ...weekly, pieces: [] }, '1998-11-22')).toBe(false);
  });

  it('ft_1_27.AC2 on a weekly test day she checks the most urgent piece she has not passed; once she passed it, the next', () => {
    expect(checkupsDue('1998-11-22', weekly, statuses, empty)).toEqual(['b']);
    expect(checkupsDue('1998-11-23', weekly, statuses, empty)).toEqual([]);
    const notYetB: WorldState = { ...empty, teacherVisits: [{ day: '1998-11-22', piece: 'b', result: 'notYet' }] };
    expect(checkupsDue('1998-11-22', weekly, statuses, notYetB)).toEqual([]);
    const passedB: WorldState = { ...empty, teacherVisits: [{ day: '1998-11-22', piece: 'b', result: 'passed' }] };
    expect(checkupsDue('1998-11-22', weekly, statuses, passedB)).toEqual(['c']);
    expect(checkupsDue('1998-11-29', weekly, statuses, passedB)).toEqual(['c']);
  });

  it('ft_1_25.AC4 her boat comes for the weekly test days ahead too', () => {
    expect(teacherDays(weekly, '1998-11-21', 7)).toEqual(['1998-11-25', '1998-11-25', '1998-12-10', '1998-11-22', '1998-11-25']);
    expect(presence(input({ day: '1998-11-21', curriculum: weekly }), DEFAULT_PRESENCE_RULES).teacherBoat).toEqual({ progress: 6 / 7 });
  });
});

describe("the teacher's test time (ft_1_26.AC9)", () => {
  const timed: Curriculum = { ...curriculum, testWeekdays: [0], testTime: '17:30' };
  it('ft_1_26.AC9 a time is HH:MM in minutes of the day; none is the start of the day', () => {
    expect(minutesOf('17:30')).toBe(1050);
    expect(minutesOf('00:00')).toBe(0);
    expect(minutesOf(undefined)).toBe(0);
  });

  it('ft_1_26.AC9 on a weekly test day and on a deadline she comes from the test time on', () => {
    expect(checkupsDue('1998-11-22', timed, statuses, empty, 1049)).toEqual([]);
    expect(checkupsDue('1998-11-22', timed, statuses, empty, 1050)).toEqual(['b']);
    expect(checkupsDue('1998-11-25', timed, statuses, empty, 600)).toEqual([]);
    expect(checkupsDue('1998-11-25', timed, statuses, empty, 1100)).toEqual(['b', 'a']);
    expect(nextTestTime('1998-11-22', timed, 600)).toBe(1050);
    expect(nextTestTime('1998-11-22', timed, 1050)).toBeNull();
    expect(nextTestTime('1998-11-23', timed, 600)).toBeNull();
  });

  it('ft_1_26.AC9 a test she orders for a time comes from that time, for the most urgent piece she has not passed', () => {
    const ordered = orderTest(curriculum, '1998-11-23', '14:05');
    expect(ordered.calendar.at(-1)).toEqual({ day: '1998-11-23', kind: 'test', time: '14:05' });
    expect(orderTest(ordered, '1998-11-23', '14:05')).toBe(ordered);
    expect(checkupsDue('1998-11-23', ordered, statuses, empty, 844)).toEqual([]);
    expect(checkupsDue('1998-11-23', ordered, statuses, empty, 845)).toEqual(['b']);
    expect(nextTestTime('1998-11-23', ordered, 600)).toBe(845);
    // without a time of day given, everything of the day counts (the simulator, older callers)
    expect(checkupsDue('1998-11-23', ordered, statuses, empty)).toEqual(['b']);
  });

  it('ft_1_26.AC9 a test asked for a piece no longer on the list (passed, left out of what she owes) is no time to wait for', () => {
    const owed: Curriculum = { ...curriculum, pieces: curriculum.pieces.filter((p) => p.piece !== 'b'), calendar: [{ day: '1998-11-23', kind: 'test', piece: 'b', time: '14:05' }] };
    expect(nextTestTime('1998-11-23', owed, 600)).toBeNull();
    expect(checkupsDue('1998-11-23', owed, statuses, empty)).toEqual([]);
  });
});
