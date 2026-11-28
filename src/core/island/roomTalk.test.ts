import { describe, expect, it } from 'vitest';
import type { Curriculum } from '../curriculum/curriculum';
import { DEFAULT_EVALUATION_RULES } from '../curriculum/evaluate';
import type { PieceStatus } from '../curriculum/play';
import type { BarPlay, PracticeLog } from '../progression/practiceLog';
import { DEFAULT_KIUR_RULES } from './kiur';
import { DEFAULT_PRESENCE_RULES } from './presenceRules';
import { checkupPlay, holdCheckup, remindsIn, roomTalk, type RoomTalkInput } from './roomTalk';
import type { WorldState } from './worldState';

const empty: WorldState = { flags: [], items: [], met: {}, teacherVisits: [] };
const curriculum: Curriculum = { base: 85, pieces: [{ piece: 'a', deadline: '1998-11-25', priority: 5 }], calendar: [], testWeekdays: [] };
const status = (over: Partial<PieceStatus> = {}): PieceStatus => ({
  piece: 'a', plays: 5, level: 80, spread: 2, histogram: [], retained: false, expected: 90, predicted: 87, band: null, delta: 3, urgency: 1, colour: 'green', ...over,
});
const input = (over: Partial<RoomTalkInput> = {}): RoomTalkInput => ({
  occasion: 'room', day: '1998-11-20', minutes: 12 * 60, curriculum, statuses: [status()], world: empty, remindedToday: false, visit: 0,
  kiurRules: DEFAULT_KIUR_RULES, presenceRules: DEFAULT_PRESENCE_RULES, minPlays: DEFAULT_EVALUATION_RULES.minPlays, ...over,
});

describe("what Kiur and the teacher say in the room (ft_1_27, WP-15)", () => {
  it('ft_1_27.AC3 after the deadline has passed Kiur says how many days ago it was, after the reminder', () => {
    const late = (day: string) => roomTalk(input({ occasion: 'open', day })).kiur;
    expect(late('1998-12-15')).toEqual([{ line: 'kiur.remind.trend', piece: 'a', params: { gap: 3 } }, { line: 'kiur.remind.overdue', params: { days: 20 } }]);
    expect(late('1998-11-26').map((l) => l.line)).toEqual(['kiur.remind.trend', 'kiur.remind.overdueOne']);
    // on the day and before it nothing is added
    expect(late('1998-11-25').map((l) => l.line)).toEqual(['kiur.remind.trend']);
    expect(late('1998-11-20').map((l) => l.line)).toEqual(['kiur.remind.trend']);
  });

  it('ft_1_27.AC3 on opening the game Kiur reminds of the forced piece with its gap, once a day at a small gap', () => {
    expect(roomTalk(input({ occasion: 'open' })).kiur).toEqual([{ line: 'kiur.remind.trend', piece: 'a', params: { gap: 3 } }]);
    expect(roomTalk(input({ occasion: 'open', remindedToday: true })).kiur).toEqual([]);
    expect(roomTalk(input({ occasion: 'room', remindedToday: true, day: '1998-11-01', statuses: [status({ delta: 8 })] })).kiur).toEqual([{ line: 'kiur.remind.trend', piece: 'a', params: { gap: 8 } }]);
    expect(roomTalk(input({ day: '1998-11-01', statuses: [status({ delta: 0 })] })).kiur).toEqual([]);
  });

  it('ft_1_27.AC3 a piece the teacher passed is no longer reminded of, and her boat no longer comes for its deadline', () => {
    const world: WorldState = { ...empty, teacherVisits: [{ day: '1998-11-19', piece: 'a', result: 'passed' }] };
    expect(roomTalk(input({ world })).kiur).toEqual([]);
    expect(roomTalk(input({ world, day: '1998-11-25' }))).toEqual({ kiur: [], checkup: null, next: null });
    // a test day with every piece passed: nothing to check, so no boat lands
    const asked: Curriculum = { ...curriculum, calendar: [{ day: '1998-11-22', kind: 'test' }] };
    expect(roomTalk(input({ world, curriculum: asked, day: '1998-11-22', remindedToday: true }))).toEqual({ kiur: [], checkup: null, next: null });
  });

  it("ft_1_25.AC5 in the room Kiur gives the teacher's boat as a heads-up; the characters' heads-ups wait for presence in the scenes", () => {
    // the fixture's default day is five days before the deadline: the boat is on the map (boatDays 7)
    expect(roomTalk(input({ remindedToday: true })).kiur).toEqual([{ line: 'kiur.headsUp.teacher.boat', params: {} }]);
    expect(roomTalk(input({ remindedToday: true, day: '1998-11-25' })).kiur).toEqual([{ line: 'kiur.headsUp.teacher.landed', params: {} }]);
    expect(roomTalk(input({ remindedToday: true, day: '1998-11-01' })).kiur).toEqual([]);
    expect(roomTalk(input({ occasion: 'open', remindedToday: true, day: '1998-11-25' })).kiur).toEqual([]);
  });

  it('ft_1_27.AC2 on the deadline day the teacher is in the room and asks for the piece; not before, and not once she checked it', () => {
    expect(roomTalk(input()).checkup).toBeNull();
    expect(roomTalk(input({ day: '1998-11-25' })).checkup).toEqual({ piece: 'a', arrival: { line: 'teacherSays.arrive.today', piece: 'a', params: {} } });
    const asked: Curriculum = { ...curriculum, calendar: [{ day: '1998-11-21', kind: 'test', piece: 'a' }] };
    expect(roomTalk(input({ day: '1998-11-21', curriculum: asked })).checkup?.arrival).toEqual({ line: 'teacherSays.arrive', piece: 'a', params: { days: 4 } });
    const checked: WorldState = { ...empty, teacherVisits: [{ day: '1998-11-25', piece: 'a', result: 'notYet' }] };
    expect(roomTalk(input({ day: '1998-11-25', world: checked })).checkup).toBeNull();
  });

  it('ft_1_26.AC9 before her test time she is not here yet and her boat is still coming; after her check-up it is gone', () => {
    const timed: Curriculum = { ...curriculum, testTime: '17:00' };
    const before = roomTalk(input({ day: '1998-11-25', minutes: 600, curriculum: timed, remindedToday: true }));
    expect(before).toEqual({ kiur: [{ line: 'kiur.headsUp.teacher.boat', params: {} }], checkup: null, next: 1020 });
    const at = roomTalk(input({ day: '1998-11-25', minutes: 1020, curriculum: timed, remindedToday: true }));
    expect(at.checkup?.piece).toBe('a');
    expect(at.kiur).toEqual([{ line: 'kiur.headsUp.teacher.landed', params: {} }]);
    const checked: WorldState = { ...empty, teacherVisits: [{ day: '1998-11-25', piece: 'a', result: 'notYet' }] };
    expect(roomTalk(input({ day: '1998-11-25', minutes: 1100, curriculum: timed, world: checked, remindedToday: true }))).toEqual({ kiur: [], checkup: null, next: null });
  });

  it('ft_1_27.AC3 a reminder said counts as reminded today; a heads-up does not', () => {
    expect(remindsIn([{ line: 'kiur.remind.now', piece: 'a', params: { gap: 2 } }])).toBe(true);
    expect(remindsIn([{ line: 'kiur.remind.unmeasured', piece: 'a', params: { plays: 1, need: 3 } }])).toBe(true);
    expect(remindsIn([{ line: 'kiur.headsUp.teacher.boat', params: {} }])).toBe(false);
    expect(remindsIn([])).toBe(false);
  });
});

const bar = (n: number, at: string, over: Partial<BarPlay> = {}): BarPlay => ({
  at, pieceId: 'a', bar: n, notes: 4, firstTry: 4, timing: null, mode: 'wait', tempoPercent: 100, section: null, misses: [], ...over,
});

describe("the check-up's play (ft_1_27.AC2)", () => {
  const before: BarPlay[] = [0, 1, 2].map((n) => bar(n, `1998-11-25T09:0${n}:00.000Z`, { firstTry: 1 }));
  const heard: BarPlay[] = [
    bar(0, '1998-11-25T10:00:00.000Z'),
    bar(1, '1998-11-25T10:00:10.000Z', { firstTry: 3 }),
    bar(2, '1998-11-25T10:00:20.000Z', { misses: [{ tick: 0, track: 'RH', midi: 61 }] }),
  ];
  const log: PracticeLog = { bars: [...before, ...heard] };

  it('ft_1_27.AC2 she hears the first whole play after the check-up began, with its score and the bars (1-based) that had a mistake', () => {
    const play = checkupPlay(log, 'a', 3, '1998-11-25T09:30:00.000Z', DEFAULT_EVALUATION_RULES);
    expect(play?.piece).toBe('a');
    expect(play?.barsWithMistakes).toEqual([2, 3]);
    expect(play?.score).toBeGreaterThan(0);
    // core_09.AC25 a piece with a pick-up names its bars as printed: the pick-up is 0, so the same bars are 1 and 2
    expect(checkupPlay(log, 'a', 3, '1998-11-25T09:30:00.000Z', DEFAULT_EVALUATION_RULES, 0)?.barsWithMistakes).toEqual([1, 2]);
    expect(checkupPlay(log, 'a', 3, '1998-11-25T11:00:00.000Z', DEFAULT_EVALUATION_RULES)).toBeNull();
    // a play stopped before the last bar is not heard
    expect(checkupPlay({ bars: heard.slice(0, 2) }, 'a', 3, '1998-11-25T09:30:00.000Z', DEFAULT_EVALUATION_RULES)).toBeNull();
    // a section played is not the piece
    expect(checkupPlay({ bars: heard.map((b) => ({ ...b, section: { first: 0, last: 2 } })) }, 'a', 3, '1998-11-25T09:30:00.000Z', DEFAULT_EVALUATION_RULES)).toBeNull();
  });

  it('ft_1_27.AC2 the check-up is kept in the world with her verdict: two short lines on the measured score against the expected level', () => {
    const { world, verdict } = holdCheckup(empty, '1998-11-25', { piece: 'a', score: 91.5, barsWithMistakes: [] }, 90);
    expect(verdict.result).toBe('passed');
    expect(verdict.lines.map((l) => l.line)).toEqual(['teacherSays.result', 'teacherSays.passed']);
    expect(world.teacherVisits).toEqual([{ day: '1998-11-25', piece: 'a', result: 'passed' }]);
    const notYet = holdCheckup(empty, '1998-11-25', { piece: 'a', score: 70, barsWithMistakes: [3] }, 90);
    expect(notYet.verdict.lines.map((l) => l.line)).toEqual(['teacherSays.result', 'teacherSays.notYet.bar']);
    expect(notYet.world.teacherVisits[0]!.result).toBe('notYet');
  });
});
