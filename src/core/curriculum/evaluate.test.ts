import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import evaluationJson from '../../../content/curriculum/evaluation.json';
import type { Curriculum, CurriculumPiece } from './curriculum';
import {
  DEFAULT_EVALUATION_RULES,
  curriculumStatuses,
  dayNumber,
  expectedLevel,
  isRetained,
  medalFor,
  parseEvaluationRules,
  pieceStatus,
  playScore,
  predictAtDeadline,
  scoreStats,
  selectPlays,
  statusColour,
  theilSen,
  urgency,
} from './evaluate';
import type { PlayResult } from './play';

const rules = DEFAULT_EVALUATION_RULES;

/** A whole-piece Wait-mode play of `piece` on `day` with `score`, ordered by `at`. */
function play(piece: string, day: string, score: number, at: number, extra: Partial<PlayResult> = {}): PlayResult {
  return { piece, day, at, mode: 'wait', tempoPercent: 100, hands: { right: { notes: 10, firstTry: 10 } }, score, ...extra };
}

/** One play a day from the first of the fixture's month, one score each. */
function daily(piece: string, scores: readonly number[]): PlayResult[] {
  return scores.map((s, i) => play(piece, `1998-11-${String(i + 1).padStart(2, '0')}`, s, i));
}

describe('evaluation rules as content (core_12.AC1)', () => {
  it('content/curriculum/evaluation.json parses and holds the defaults of d139', () => {
    expect(parseEvaluationRules(evaluationJson)).toEqual(DEFAULT_EVALUATION_RULES);
    expect(rules.weights.tempo).toEqual({ pitch: 60, timing: 30, tempo: 10 });
    expect(rules.weights.wait).toEqual({ pitch: 100, timing: 0, tempo: 0 });
    expect(rules.base).toBe(85);
    expect(rules.lastPlays).toBe(10);
    expect(rules.retain).toEqual({ atLeast: 3, belowAtMost: 2, byAtMost: 15 });
  });

  it('refuses weights of a mode that do not add up to 100', () => {
    const bad = { ...evaluationJson, weights: { ...evaluationJson.weights, wait: { pitch: 90, timing: 0, tempo: 0 } } };
    expect(() => parseEvaluationRules(bad)).toThrow();
  });
});

describe('playScore (core_12.AC1)', () => {
  it('Wait mode is pitch only: notes right first try over notes, both hands together', () => {
    const hands = { left: { notes: 10, firstTry: 5 }, right: { notes: 30, firstTry: 27 } };
    expect(playScore('wait', 100, hands, rules)).toBe(80);
  });

  it('Tempo mode folds pitch 60, timing 30 and tempo 10', () => {
    const hands = { right: { notes: 20, firstTry: 20, onTime: 10 } };
    // 60 * 1 + 30 * 0.5 + 10 * 0.8
    expect(playScore('tempo', 80, hands, rules)).toBe(83);
  });

  it('a hand with no onTime counts no notes on time in Tempo mode, and tempo above 100 counts as 100', () => {
    const hands = { left: { notes: 10, firstTry: 10 }, right: { notes: 10, firstTry: 10, onTime: 10 } };
    expect(playScore('tempo', 120, hands, rules)).toBe(85);
  });

  it('a play with no notes scores 0', () => {
    expect(playScore('wait', 100, {}, rules)).toBe(0);
  });

  it('is always a whole number from 0 to 100', () => {
    const hand = fc
      .record({ notes: fc.integer({ min: 0, max: 200 }), a: fc.double({ min: 0, max: 1, noNaN: true }), b: fc.double({ min: 0, max: 1, noNaN: true }) })
      .map(({ notes, a, b }) => ({ notes, firstTry: Math.floor(notes * a), onTime: Math.floor(notes * b) }));
    fc.assert(
      fc.property(fc.constantFrom('wait' as const, 'tempo' as const), fc.integer({ min: 0, max: 300 }), hand, hand, (mode, tempo, l, r) => {
        const s = playScore(mode, tempo, { left: l, right: r }, rules);
        expect(Number.isInteger(s)).toBe(true);
        expect(s).toBeGreaterThanOrEqual(0);
        expect(s).toBeLessThanOrEqual(100);
      }),
    );
  });
});

describe('scoreStats (core_12.AC5)', () => {
  it('gives mean, median, standard deviation and a 10-point histogram with 100 in the top bin', () => {
    const s = scoreStats([60, 70, 80, 90, 100]);
    expect(s.count).toBe(5);
    expect(s.mean).toBe(80);
    expect(s.median).toBe(80);
    expect(s.spread).toBeCloseTo(Math.sqrt(200), 10);
    expect(s.histogram).toEqual([0, 0, 0, 0, 0, 0, 1, 1, 1, 2]);
  });

  it('gives nulls and an empty histogram for no plays', () => {
    expect(scoreStats([])).toEqual({ count: 0, mean: null, median: null, spread: null, histogram: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0] });
  });
});

describe('selectPlays (core_12.AC5)', () => {
  const plays = [
    play('a', '1998-11-01', 50, 3),
    play('a', '1998-11-03', 60, 1, { mode: 'tempo', tempoPercent: 70 }),
    play('b', '1998-11-03', 70, 2),
    play('a', '1998-11-05', 80, 4, { bars: { from: 1, to: 2 } }),
    play('a', '1998-11-10', 90, 5, { mode: 'tempo', tempoPercent: 100 }),
  ];

  it('keeps whole-piece plays of the piece, oldest first by time', () => {
    expect(selectPlays(plays, 'a').map((p) => p.score)).toEqual([60, 50, 90]);
  });

  it('filters by the last N plays, the last N days, mode and tempo', () => {
    expect(selectPlays(plays, 'a', { lastPlays: 2 }).map((p) => p.score)).toEqual([50, 90]);
    expect(selectPlays(plays, 'a', { lastDays: 8, today: '1998-11-10' }).map((p) => p.score)).toEqual([60, 90]);
    expect(selectPlays(plays, 'a', { mode: 'tempo' }).map((p) => p.score)).toEqual([60, 90]);
    expect(selectPlays(plays, 'a', { minTempoPercent: 80 }).map((p) => p.score)).toEqual([50, 90]);
  });

  it('needs today for a window of days', () => {
    expect(() => selectPlays(plays, 'a', { lastDays: 3 })).toThrow(RangeError);
  });
});

describe('isRetained (core_12.AC3, core_12.AC4)', () => {
  it("the worked example: ten plays of 60 and then one of 100 do not retain the piece", () => {
    const scores = [...Array.from({ length: 10 }, () => 60), 100];
    expect(isRetained(scores, 87, rules)).toBe(false);
    const status = pieceStatus({ piece: 'a', deadline: '1998-11-30', priority: 2 }, daily('a', scores), '1998-11-11', { base: 85 }, rules);
    expect(status.level).toBe(60);
    expect(status.retained).toBe(false);
    expect(status.colour).not.toBe('strongGreen');
  });

  it('retains with at least 3 plays at the expected level and at most 2 below it, none by more than 15', () => {
    expect(isRetained([90, 90, 90], 87, rules)).toBe(true);
    expect(isRetained([90, 90, 90, 80, 80], 87, rules)).toBe(true);
    expect(isRetained([90, 90, 90, 80, 80, 80], 87, rules)).toBe(false);
    expect(isRetained([90, 90, 80, 80], 87, rules)).toBe(false);
    expect(isRetained([90, 90, 90, 71], 87, rules)).toBe(false);
    expect(isRetained([90, 90, 90, 72], 87, rules)).toBe(true);
    expect(isRetained([90, 90], 87, rules)).toBe(false);
  });

  it('looks only at the last X plays', () => {
    expect(isRetained([10, 10, 10, 90, 90, 90], 87, { ...rules, lastPlays: 3 })).toBe(true);
  });
});

describe('theilSen and predictAtDeadline (core_12.AC6)', () => {
  it('the median of the pair slopes ignores one odd day', () => {
    const fit = theilSen([
      { x: 0, y: 50 },
      { x: 1, y: 52 },
      { x: 2, y: 0 },
      { x: 3, y: 56 },
      { x: 4, y: 58 },
    ]);
    expect(fit?.slope).toBe(2);
    expect(fit?.intercept).toBe(50);
  });

  it('needs two different x', () => {
    expect(theilSen([{ x: 1, y: 3 }])).toBeNull();
    expect(theilSen([{ x: 1, y: 3 }, { x: 1, y: 5 }])).toBeNull();
  });

  it('projects the daily medians to the deadline, capped at 100, with no projection under 3 practice days', () => {
    expect(predictAtDeadline(daily('a', [50, 60]), '1998-11-10', rules)).toBeNull();
    expect(predictAtDeadline(daily('a', [50, 60, 70]), '1998-11-05', rules)).toBe(90);
    expect(predictAtDeadline(daily('a', [50, 60, 70]), '1998-11-30', rules)).toBe(100);
    const twoADay = [...daily('a', [40, 50, 60]), ...daily('a', [60, 70, 80]).map((p) => ({ ...p, at: p.at + 100 }))];
    expect(predictAtDeadline(twoADay, '1998-11-04', rules)).toBe(80);
  });

  it('a deadline already past is projected to today, never backwards from the plays', () => {
    const plays = daily('a', [50, 60, 70, 80, 90]);
    expect(predictAtDeadline(plays, '1998-10-20', rules, '1998-11-05')).toBe(90);
    const s = pieceStatus({ piece: 'a', deadline: '1998-10-20', priority: 5 }, plays, '1998-11-05', { base: 85 }, rules);
    expect(s.predicted).toBe(90);
    expect(s.delta).toBe(0);
    expect(s.urgency).toBe(0);
  });

  it('uses only the last trendDays practice days', () => {
    const plays = daily('a', [90, 90, 90, 10, 20, 30]);
    expect(predictAtDeadline(plays, '1998-11-07', { ...rules, trendDays: 3 })).toBe(40);
  });
});

describe('expected level, urgency and ranking (core_12.AC7)', () => {
  it('expected = base + priority', () => {
    expect(expectedLevel(85, 8)).toBe(93);
    expect(expectedLevel(80, 1)).toBe(81);
  });

  it('urgency = max(0, delta) * (1 + priority / 10) / sqrt(days left + 1)', () => {
    expect(urgency(5, 8, 7)).toBeCloseTo((5 * 1.8) / Math.sqrt(8), 10);
    expect(urgency(-3, 8, 7)).toBe(0);
    expect(urgency(null, 8, 7)).toBe(0);
  });

  it("the worked example: A (priority 2, 3 days, 85 of 87) and B (priority 8, 7 days, 88 of 93): B comes first", () => {
    const a = urgency(87 - 85, 2, 3);
    const b = urgency(93 - 88, 8, 7);
    expect(b).toBeGreaterThan(a);

    // The same through the curriculum: predictions by a flat history at 85 and 88.
    const today = '1998-11-10';
    const curriculum: Curriculum = {
      base: 85,
      pieces: [
        { piece: 'a', deadline: '1998-11-13', priority: 2 },
        { piece: 'b', deadline: '1998-11-17', priority: 8 },
      ],
      calendar: [],
    };
    const plays = [...daily('a', [85, 85, 85]), ...daily('b', [88, 88, 88])];
    const ranked = curriculumStatuses(curriculum, plays, today, rules);
    expect(ranked.map((s) => s.piece)).toEqual(['b', 'a']);
    expect(ranked[0]!.delta).toBe(5);
    expect(ranked[1]!.delta).toBe(2);
  });

  it('a priority 5 to 10 piece owing anything comes before a priority 1 to 4 piece owing more', () => {
    const curriculum: Curriculum = {
      base: 85,
      pieces: [
        { piece: 'low', deadline: '1998-11-11', priority: 4 },
        { piece: 'high', deadline: '1998-11-30', priority: 5 },
      ],
      calendar: [],
    };
    const plays = [...daily('low', [40, 40, 40]), ...daily('high', [89, 89, 89])];
    const ranked = curriculumStatuses(curriculum, plays, '1998-11-10', rules);
    expect(ranked[1]!.urgency).toBeGreaterThan(ranked[0]!.urgency);
    expect(ranked.map((s) => s.piece)).toEqual(['high', 'low']);
  });

  it('pieces owing nothing keep the order of their deadlines', () => {
    const curriculum: Curriculum = {
      base: 85,
      pieces: [
        { piece: 'later', deadline: '1998-12-20', priority: 9 },
        { piece: 'sooner', deadline: '1998-12-01', priority: 1 },
      ],
      calendar: [],
    };
    const ranked = curriculumStatuses(curriculum, [], '1998-11-10', rules);
    expect(ranked.map((s) => s.piece)).toEqual(['sooner', 'later']);
  });
});

describe('colour and medal (core_12.AC8)', () => {
  it('purple under 3 plays, strong green when retained and the target reached, else green scaled by predicted over expected', () => {
    expect(statusColour({ plays: 2, retained: false, level: null, expected: 90, predicted: null })).toEqual({ colour: 'purple' });
    expect(statusColour({ plays: 5, retained: true, level: 92, expected: 90, predicted: 95 })).toEqual({ colour: 'strongGreen' });
    expect(statusColour({ plays: 5, retained: true, level: 88, expected: 90, predicted: 95 })).toEqual({ colour: 'green', greenStrength: 1 });
    expect(statusColour({ plays: 5, retained: false, level: 60, expected: 90, predicted: 45 })).toEqual({ colour: 'green', greenStrength: 0.5 });
    // Without a projection (under 3 practice days) the level stands in.
    expect(statusColour({ plays: 3, retained: false, level: 45, expected: 90, predicted: null })).toEqual({ colour: 'green', greenStrength: 0.5 });
  });

  it('medal by level over expected: bronze 85 to 95, silver 96 to 105, gold above', () => {
    expect(medalFor(null, 90, rules)).toBeUndefined();
    expect(medalFor(76, 90, rules)).toBeUndefined();
    expect(medalFor(76.5, 90, rules)).toBe('bronze');
    expect(medalFor(86, 90, rules)).toBe('bronze');
    expect(medalFor(86.5, 90, rules)).toBe('silver');
    expect(medalFor(94.5, 90, rules)).toBe('silver');
    expect(medalFor(95, 90, rules)).toBe('gold');
  });
});

describe('pieceStatus (core_12.AC3 to AC8)', () => {
  const cp: CurriculumPiece = { piece: 'a', deadline: '1998-11-20', priority: 5 };

  it('a piece never played is purple with no level, no prediction and no urgency', () => {
    const s = pieceStatus(cp, [], '1998-11-10', { base: 85 }, rules);
    expect(s).toEqual({
      piece: 'a',
      plays: 0,
      level: null,
      spread: null,
      histogram: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      retained: false,
      expected: 90,
      predicted: null,
      band: null,
      delta: null,
      urgency: 0,
      colour: 'purple',
    });
  });

  it('level is the median of the last X plays, band is the prediction plus or minus the spread, kept in 0 to 100', () => {
    const plays = daily('a', [60, 62, 64, 66, 68]);
    const s = pieceStatus(cp, plays, '1998-11-05', { base: 85 }, rules);
    expect(s.level).toBe(64);
    expect(s.spread).toBeCloseTo(Math.sqrt(8), 10);
    expect(s.predicted).toBe(98);
    expect(s.band!.low).toBeCloseTo(98 - Math.sqrt(8), 10);
    expect(s.band!.high).toBe(100);
    expect(s.delta).toBe(-8);
    expect(s.urgency).toBe(0);
    expect(s.medal).toBeUndefined();
  });

  it("the piece's overrides win over the curriculum's base and the rules' numbers", () => {
    const plays = daily('a', [70, 70, 70, 70]);
    const withOverrides: CurriculumPiece = { ...cp, overrides: { base: 60, lastPlays: 3, retain: { atLeast: 3, belowAtMost: 0, byAtMost: 0 } } };
    const s = pieceStatus(withOverrides, plays, '1998-11-04', { base: 85 }, rules);
    expect(s.expected).toBe(65);
    expect(s.retained).toBe(true);
    expect(s.colour).toBe('strongGreen');
    expect(s.medal).toBe('gold');
  });

  it('counts only the window the teacher chose', () => {
    const plays = daily('a', [10, 10, 10, 90, 90, 90]);
    const s = pieceStatus(cp, plays, '1998-11-06', { base: 85 }, rules, { lastDays: 3 });
    expect(s.plays).toBe(3);
    expect(s.level).toBe(90);
  });

  it('every status keeps its numbers in range over random histories', () => {
    const history = fc.array(fc.record({ day: fc.integer({ min: 1, max: 28 }), score: fc.integer({ min: 0, max: 100 }) }), { maxLength: 40 });
    fc.assert(
      fc.property(history, fc.integer({ min: 1, max: 10 }), fc.integer({ min: 1, max: 30 }), (h, priority, deadlineDay) => {
        const plays = h.map((p, i) => play('a', `1998-11-${String(p.day).padStart(2, '0')}`, p.score, i));
        const s = pieceStatus({ piece: 'a', deadline: `1998-12-${String(deadlineDay).padStart(2, '0')}`, priority }, plays, '1998-11-28', { base: 85 }, rules);
        expect(s.plays).toBe(plays.length);
        expect(s.histogram.reduce((a, b) => a + b, 0)).toBe(Math.min(plays.length, rules.lastPlays));
        if (s.predicted !== null) {
          expect(s.predicted).toBeGreaterThanOrEqual(0);
          expect(s.predicted).toBeLessThanOrEqual(100);
          expect(s.band!.low).toBeLessThanOrEqual(s.predicted);
          expect(s.band!.high).toBeGreaterThanOrEqual(s.predicted);
        }
        expect(s.urgency).toBeGreaterThanOrEqual(0);
        if (s.colour === 'green') {
          expect(s.greenStrength).toBeGreaterThanOrEqual(0);
          expect(s.greenStrength).toBeLessThanOrEqual(1);
        }
        if (s.colour === 'purple') expect(s.plays).toBeLessThan(3);
      }),
    );
  });
});

describe('dayNumber', () => {
  it('counts calendar days and refuses a malformed day', () => {
    expect(dayNumber('1998-12-01') - dayNumber('1998-11-30')).toBe(1);
    expect(dayNumber('1999-01-01') - dayNumber('1998-01-01')).toBe(365);
    expect(() => dayNumber('1998-11-1')).toThrow(RangeError);
    expect(() => dayNumber('1998-02-30')).toThrow(RangeError);
  });
});
