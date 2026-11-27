// Covers ft_1_21.AC3, AC5, AC6, AC7, AC8, AC9, AC14 and AC15 (the tug as a scene plays it: its bars in the chart, its result kept).
import { describe, expect, it } from 'vitest';
import { chartWith } from '../../../tests/helpers/charts';
import type { WorldState } from '../island/worldState';
import { DEFAULT_TUG_RULES, advanceTug, startTug, type TugState } from './tug';
import { onTimeShare, studentShare, trainerLevel, trainerRules, tugAfter, tugFact, tugFactLine, tugNeed, tugRecord, tugLevelFor, tugSetupOf, turnChartBars } from './tugPlay';

const rules = DEFAULT_TUG_RULES;
/** Four whole bars of quarter notes (C D E F in each). */
const fourBars = chartWith(Array.from({ length: 16 }, (_, i) => ({ tick: i * 480, dur: 480, midi: [60, 62, 64, 65][i % 4]! })), { id: 'puuvaim-1' });
/** A pick-up of one beat, then two whole bars. */
const pickupNotes = [{ tick: 0, dur: 480, midi: 67 }, ...Array.from({ length: 8 }, (_, i) => ({ tick: 480 + i * 480, dur: 480, midi: 60 }))];
const plain = chartWith(pickupNotes);
const withPickup = chartWith(pickupNotes, {
  id: 'pickup',
  notes: plain.notes.map((n) => ({ ...n, bar: n.tick < 480 ? 0 : n.tick < 2400 ? 1 : 2 })),
  bars: [{ index: 0, startTick: 0, endTick: 480 }, { index: 1, startTick: 480, endTick: 2400 }, { index: 2, startTick: 2400, endTick: 4320 }],
});

const empty: WorldState = { flags: [], items: [], met: {}, teacherVisits: [] };
const met: WorldState = { ...empty, met: { puuvaim: { firstDay: '1998-11-20', lastDay: '1998-11-20', taught: [], tugs: { won: 0, lost: 0, bestLevel: 0 } } } };

function play(state: TugState, share: number): TugState {
  let s = state;
  for (let guard = 0; guard < 100 && s.outcome === undefined; guard++) {
    s = s.plan.turns[s.turn]!.who === 'character' ? advanceTug(s, rules) : advanceTug(s, rules, { share, hands: {}, reasons: [] });
  }
  return s;
}

describe('the tug in a chart (ft_1_21.AC3)', () => {
  it('ft_1_21.AC3 a chart gives the tug its piece, its full bars and whether it starts with a pick-up', () => {
    expect(tugSetupOf(fourBars, 'tug', 1)).toEqual({ kind: 'tug', piece: 'puuvaim-1', level: 1, bars: 4, pickup: false });
    expect(tugSetupOf(withPickup, 'practiceTug', 2)).toEqual({ kind: 'practiceTug', piece: 'pickup', level: 2, bars: 2, pickup: true });
  });

  it('ft_1_21.AC3 a turn\'s printed bars are the chart\'s bars from 0: bar 1 is index 0, or index 1 after a pick-up (bar 0)', () => {
    expect(turnChartBars({ from: 1, to: 2 }, false)).toEqual({ first: 0, last: 1 });
    expect(turnChartBars({ from: 3, to: 4 }, false)).toEqual({ first: 2, last: 3 });
    expect(turnChartBars({ from: 0, to: 2 }, true)).toEqual({ first: 0, last: 2 });
    expect(turnChartBars({ from: 1, to: 1 }, true)).toEqual({ first: 1, last: 1 });
  });

  it('every turn of a tug falls inside its chart', () => {
    for (const [chart, level] of [[fourBars, 1], [fourBars, 3], [withPickup, 1], [withPickup, 2]] as const) {
      const setup = tugSetupOf(chart, 'tug', level);
      for (const turn of startTug(setup, rules).plan.turns) {
        const { first, last } = turnChartBars(turn.bars, setup.pickup);
        expect(first).toBeGreaterThanOrEqual(0);
        expect(last).toBeLessThan(chart.bars.length);
      }
    }
  });

  it('a printed bar 0 without a pick-up is refused', () => {
    expect(() => turnChartBars({ from: 0, to: 1 }, false)).toThrow(RangeError);
  });
});

describe('after each exchange (ft_1_21.AC7)', () => {
  it('ft_1_21.AC7 the fact is the notes right first try of the notes in the phrase, and the first wrong key\'s reason', () => {
    expect(tugFact({ notes: 4, firstTryCorrect: 3 }, [])).toEqual({ right: 3, total: 4 });
    expect(tugFact({ notes: 4, firstTryCorrect: 2 }, ['wrong-octave', 'neighbour-key'])).toEqual({ right: 2, total: 4, reason: 'wrong-octave' });
  });

  it('ft_1_21.AC7 a neighbour key and a wrong letter each say their reason, as a wrong octave does', () => {
    expect(tugFactLine(tugFact({ notes: 5, firstTryCorrect: 0 }, ['neighbour-key']), 'wait')).toBe('0 of 5 notes right. The key next door');
    expect(tugFactLine(tugFact({ notes: 6, firstTryCorrect: 0 }, ['wrong-letter']), 'wait')).toBe('0 of 6 notes right. Another letter');
    expect(tugFactLine(tugFact({ notes: 5, firstTryCorrect: 0 }, ['wrong-octave']), 'wait')).toBe('0 of 5 notes right. Right letter, wrong octave');
    expect(tugFactLine(tugFact({ notes: 5, firstTryCorrect: 5 }, []), 'wait')).toBe('5 of 5 notes right');
  });

  it('ft_1_21.AC7 in Tempo mode a phrase with no wrong key says whether its notes off time came in late or early; a wrong key\'s reason comes first', () => {
    const late = { played: 4, onTime: 1, early: 0, late: 3, missed: 0, meanAbsErrorMs: 200, score: 30 };
    const early = { ...late, early: 2, late: 1 };
    const even = { ...late, early: 1, late: 1, missed: 1 };
    expect(tugFact({ notes: 4, firstTryCorrect: 4, timing: late }, [], 'tempo')).toEqual({ right: 1, total: 4, reason: 'late' });
    expect(tugFactLine(tugFact({ notes: 4, firstTryCorrect: 4, timing: late }, [], 'tempo'), 'tempo')).toBe('1 of 4 notes on time. Came in late');
    expect(tugFact({ notes: 4, firstTryCorrect: 4, timing: early }, [], 'tempo').reason).toBe('early');
    // as many early as late: no word on which
    expect(tugFact({ notes: 4, firstTryCorrect: 4, timing: even }, [], 'tempo').reason).toBeUndefined();
    expect(tugFact({ notes: 4, firstTryCorrect: 3, timing: late }, ['wrong-letter'], 'tempo').reason).toBe('wrong-letter');
    // Wait mode never speaks of time
    expect(tugFact({ notes: 4, firstTryCorrect: 4, timing: late }, [], 'wait').reason).toBeUndefined();
  });

  it('ft_1_21.AC17 once the stall kill raises the share, the fact says how many notes the phrase needed', () => {
    let s = startTug(tugSetupOf(fourBars, 'tug', 1), rules);
    const shares = [1, 0, 1, 0, 1, 0, 1, 0, 1];
    const needs: (number | undefined)[] = [];
    for (const share of shares) {
      while (s.plan.turns[s.turn]!.who === 'character') s = advanceTug(s, rules);
      needs.push(tugNeed(s, rules, 5));
      s = advanceTug(s, rules, { share, hands: {}, reasons: [] });
    }
    // the first four phrases need the level's own share (60 per cent): nothing extra is said
    expect(needs.slice(0, 4)).toEqual([undefined, undefined, undefined, undefined]);
    // then 65, 70, 75, 80, 85 per cent of 5 notes: 4, 4, 4, 4, 5
    expect(needs.slice(4)).toEqual([4, 4, 4, 4, 5]);
    expect(tugFactLine({ ...tugFact({ notes: 5, firstTryCorrect: 4 }, ['wrong-letter']), need: 5 }, 'wait')).toBe('4 of 5 notes right. Needed 5 of 5. Another letter');
  });
});

describe('the levels in the scene (ft_1_21.AC6)', () => {
  const all = () => true;
  it('ft_1_21.AC6 the next tug is one level above the best won, never above 3 nor below the level the talk asks for', () => {
    expect(tugLevelFor(1, 0, all)).toBe(1);
    expect(tugLevelFor(1, 1, all)).toBe(2);
    expect(tugLevelFor(1, 2, all)).toBe(3);
    expect(tugLevelFor(1, 3, all)).toBe(3);
    expect(tugLevelFor(2, 0, all)).toBe(2);
  });

  it('a level whose phrase is not in the game is skipped down to one that is, never below the level asked', () => {
    expect(tugLevelFor(1, 2, (l) => l !== 3)).toBe(2);
    expect(tugLevelFor(1, 1, (l) => l === 1)).toBe(1);
    expect(tugLevelFor(2, 2, (l) => l === 1)).toBe(2);
  });

  it('ft_1_21.AC5 ft_1_21.AC6 a phrase in Wait mode counts its notes right first try; in Tempo mode its notes on time, the number its fact says', () => {
    // three on time and one early: the timing score (85) is not what is held against the share
    const timing = { played: 4, onTime: 3, early: 1, late: 0, missed: 0, meanAbsErrorMs: 40, score: 85 };
    expect(studentShare({ notes: 4, accuracy: 0.75 }, 'wait')).toBe(0.75);
    expect(studentShare({ notes: 4, accuracy: 1, timing }, 'tempo')).toBe(0.75);
    expect(studentShare({ notes: 4, accuracy: 1 }, 'tempo')).toBe(0);
    const fact = tugFact({ notes: 4, firstTryCorrect: 4, timing }, [], 'tempo');
    expect(fact).toEqual({ right: 3, total: 4, reason: 'early' });
    expect(fact.right / fact.total).toBe(studentShare({ notes: 4, accuracy: 1, timing }, 'tempo'));
  });
});

describe('the finished tug in the world and the XP (ft_1_21.AC8, AC9, AC15)', () => {
  const won = play(startTug(tugSetupOf(fourBars, 'tug', 1), rules), 1);
  const lost = play(startTug(tugSetupOf(fourBars, 'tug', 1), rules), 0);

  it('ft_1_21.AC15 a won tug is counted with the character and gives its item, once', () => {
    const after = tugAfter(met, 'puuvaim', won, 'golden-leaf', '1998-11-20T10:00:00.000Z');
    expect(after.met['puuvaim']!.tugs).toEqual({ won: 1, lost: 0, bestLevel: 1 });
    expect(after.items).toEqual(['golden-leaf']);
    expect(tugAfter(after, 'puuvaim', won, 'golden-leaf', '1998-11-21T10:00:00.000Z').items).toEqual(['golden-leaf']);
  });

  it('ft_1_21.AC8 a lost tug gives nothing and starts the cool-down from its piece', () => {
    const after = tugAfter(met, 'puuvaim', lost, 'golden-leaf', '1998-11-20T10:00:00.000Z');
    expect(after.items).toEqual([]);
    expect(after.met['puuvaim']!.lastLostTug).toEqual({ piece: 'puuvaim-1', at: '1998-11-20T10:00:00.000Z' });
  });

  it('a practice tug with Kiur gives no item even when won (ft_1_21.AC14)', () => {
    const practice = play(startTug(tugSetupOf(fourBars, 'practiceTug', 1), rules), 1);
    expect(tugAfter(met, 'puuvaim', practice, 'golden-leaf', '1998-11-20T10:00:00.000Z').items).toEqual([]);
  });

  it('ft_1_21.AC14 a practice tug with Kiur changes nothing in the world, won or lost', () => {
    const practiceWon = play(startTug(tugSetupOf(fourBars, 'practiceTug', 1), rules), 1);
    const practiceLost = play(startTug(tugSetupOf(fourBars, 'practiceTug', 1), rules), 0);
    expect(tugAfter(met, 'puuvaim', practiceWon, 'golden-leaf', '1998-11-20T10:00:00.000Z')).toEqual(met);
    expect(tugAfter(met, 'puuvaim', practiceLost, 'golden-leaf', '1998-11-20T10:00:00.000Z')).toEqual(met);
  });

  it('ft_1_21.AC9 the XP is kept as a tug record: the full prize won, part of half of it lost, at least 1 XP', () => {
    expect(tugRecord(won, 'puuvaim', rules)).toEqual({ characterId: 'puuvaim', pieceId: 'puuvaim-1', won: true, potentialXp: 30, exchanges: 3, xp: 30 });
    expect(tugRecord(lost, 'puuvaim', rules)).toMatchObject({ won: false, xp: 1, exchanges: 3 });
  });

  it('ft_1_21.AC8 a lost tug that came close pays half the prize times the best standing over 3', () => {
    let s = startTug(tugSetupOf(fourBars, 'tug', 1), rules);
    const shares = [1, 1, 0, 0, 0, 0, 0];
    let i = 0;
    for (let guard = 0; guard < 100 && s.outcome === undefined; guard++) {
      s = s.plan.turns[s.turn]!.who === 'character' ? advanceTug(s, rules) : advanceTug(s, rules, { share: shares[i++]!, hands: {}, reasons: [] });
    }
    expect(s.outcome).toBe('lost');
    expect(tugRecord(s, 'puuvaim', rules)).toMatchObject({ won: false, xp: 10, exchanges: 7 });
  });

  it('an unfinished tug is refused', () => {
    expect(() => tugRecord(startTug(tugSetupOf(fourBars, 'tug', 1), rules), 'puuvaim', rules)).toThrow(RangeError);
    expect(() => tugAfter(met, 'puuvaim', startTug(tugSetupOf(fourBars, 'tug', 1), rules), 'golden-leaf', 'x')).toThrow(RangeError);
  });
});

describe('Kiur the trainer (ft_1_21.AC14)', () => {
  it('ft_1_21.AC14 the highest level the piece is practised for, level 1 when none is', () => {
    expect(trainerLevel(() => false)).toBe(1);
    expect(trainerLevel((l) => l === 1)).toBe(1);
    expect(trainerLevel((l) => l <= 2)).toBe(2);
    expect(trainerLevel(() => true)).toBe(3);
    // level 3 practised in Tempo but level 2 not yet: the higher one counts
    expect(trainerLevel((l) => l === 3)).toBe(3);
  });

  it('ft_1_21.AC14 his tug is won and lost at practiceSteps (2), the rest of the rules the same', () => {
    expect(trainerRules(rules)).toEqual({ ...rules, steps: 2 });
    const kiur = trainerRules(rules);
    let s = startTug(tugSetupOf(fourBars, 'practiceTug', 1), kiur);
    for (let guard = 0; guard < 100 && s.outcome === undefined; guard++) {
      s = s.plan.turns[s.turn]!.who === 'character' ? advanceTug(s, kiur) : advanceTug(s, kiur, { share: 1, hands: {}, reasons: [] });
    }
    expect(s).toMatchObject({ outcome: 'won', standing: 2 });
  });
});

describe('onTimeShare: the Tempo measure of a phrase (ft_1_21.AC5)', () => {
  const timing = (onTime: number, early = 0, late = 0, missed = 0) => ({ played: onTime + early + late, onTime, early, late, missed, meanAbsErrorMs: null, score: 0 });
  it('ft_1_21.AC5 is the share of the phrase\'s notes played on time in Tempo mode', () => {
    expect(onTimeShare({ notes: 10, timing: timing(8, 1, 0, 1) })).toBeCloseTo(0.8);
    expect(onTimeShare({ notes: 4, timing: timing(4) })).toBe(1);
  });
  it('ft_1_21.AC5 does not count early, late or missed notes, so keeping up only roughly is not enough', () => {
    expect(onTimeShare({ notes: 10, timing: timing(5, 3, 2, 0) })).toBeCloseTo(0.5);
    expect(onTimeShare({ notes: 10, timing: timing(0, 0, 0, 10) })).toBe(0);
  });
  it('ft_1_21.AC5 counts a phrase with no notes as on time, and a result with no timing (not Tempo mode) as none on time', () => {
    expect(onTimeShare({ notes: 0, timing: timing(0) })).toBe(1);
    expect(onTimeShare({ notes: 6 })).toBe(0);
  });
});
