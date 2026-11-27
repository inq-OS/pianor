import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import rulesJson from '../../../content/challenge/rules.json';
import {
  DEFAULT_TUG_RULES,
  advanceTug,
  exchangeResult,
  leaveTug,
  parseTugRules,
  startTug,
  tugPart,
  tugPhrases,
  tugPlan,
  tugPrize,
  tugShare,
  type TugState,
} from './tug';

const rules = DEFAULT_TUG_RULES;

/** Play the tug to its end: the student's turns get the shares in order (repeating the last). */
function play(state: TugState, shares: readonly number[]): TugState {
  let s = state;
  let i = 0;
  for (let guard = 0; guard < 200 && s.outcome === undefined; guard++) {
    const turn = s.plan.turns[s.turn]!;
    if (turn.who === 'character') s = advanceTug(s, rules);
    else s = advanceTug(s, rules, { share: shares[Math.min(i++, shares.length - 1)]!, hands: {}, reasons: [] });
  }
  return s;
}

describe('the tug rules as content (ft_1_21.AC5)', () => {
  it('content/challenge/rules.json parses and holds the defaults: 3 steps, shares 60, 80, 95 per cent', () => {
    expect(parseTugRules(rulesJson)).toEqual(DEFAULT_TUG_RULES);
    expect(rules.steps).toBe(3);
    expect(rules.levels.map((l) => l.share)).toEqual([0.6, 0.8, 0.95]);
    expect(rules.levels.map((l) => l.mode)).toEqual(['wait', 'tempo', 'tempo']);
    expect(rules.stall).toEqual({ after: 4, raise: 0.05 });
  });
});

describe('tugPart and tugPhrases (ft_1_21.AC3)', () => {
  it('level 1 plays the first half of the piece, levels 2 and 3 the whole piece', () => {
    expect(tugPart(8, 1)).toEqual({ from: 1, to: 4 });
    expect(tugPart(7, 1)).toEqual({ from: 1, to: 4 });
    expect(tugPart(8, 2)).toEqual({ from: 1, to: 8 });
    expect(tugPart(8, 3)).toEqual({ from: 1, to: 8 });
  });

  it('cuts the part into phrases of two bars, a last single bar on its own', () => {
    expect(tugPhrases({ from: 1, to: 8 }, false)).toEqual([
      { from: 1, to: 2 },
      { from: 3, to: 4 },
      { from: 5, to: 6 },
      { from: 7, to: 8 },
    ]);
    expect(tugPhrases({ from: 1, to: 5 }, false)).toEqual([
      { from: 1, to: 2 },
      { from: 3, to: 4 },
      { from: 5, to: 5 },
    ]);
  });

  it('joins a pick-up bar (bar 0, d120) to the first phrase', () => {
    expect(tugPhrases({ from: 1, to: 4 }, true)).toEqual([
      { from: 0, to: 2 },
      { from: 3, to: 4 },
    ]);
  });

  it('covers every bar of the part once, in order', () => {
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 40 }), fc.boolean(), (bars, pickup) => {
        const phrases = tugPhrases({ from: 1, to: bars }, pickup);
        const covered = phrases.flatMap((p) => Array.from({ length: p.to - p.from + 1 }, (_, i) => p.from + i));
        expect(covered).toEqual(Array.from({ length: bars + (pickup ? 1 : 0) }, (_, i) => i + (pickup ? 0 : 1)));
        for (const p of phrases) expect(p.to - p.from).toBeLessThanOrEqual(pickup && p.from === 0 ? 2 : 1);
      }),
    );
  });
});

describe('tugPlan (ft_1_21.AC4, ft_1_21.AC6)', () => {
  it('the character plays the first phrase and the student the next, alternating; only the student is judged', () => {
    const plan = tugPlan({ kind: 'tug', piece: 'p', level: 2, bars: 8, pickup: false }, rules);
    expect(plan).toMatchObject({ kind: 'tug', piece: 'p', level: 2 });
    expect(plan.turns.map((t) => t.who)).toEqual(['character', 'student', 'character', 'student']);
    expect(plan.turns.map((t) => t.judged)).toEqual([false, true, false, true]);
    expect(plan.turns[1]!.bars).toEqual({ from: 3, to: 4 });
  });

  it('no staff at any level; level 1 Wait mode, levels 2 and 3 Tempo mode; both hands', () => {
    for (const level of [1, 2, 3] as const) {
      const plan = tugPlan({ kind: 'tug', piece: 'p', level, bars: 8, pickup: false }, rules);
      expect(plan.turns.every((t) => !t.staff && t.hands === 'both')).toBe(true);
      expect(plan.turns.every((t) => t.mode === (level === 1 ? 'wait' : 'tempo'))).toBe(true);
    }
  });

  it('can start with the student, for the pass with the roles swapped', () => {
    const plan = tugPlan({ kind: 'tug', piece: 'p', level: 1, bars: 8, pickup: false, studentFirst: true }, rules);
    expect(plan.turns.map((t) => t.who)).toEqual(['student', 'character']);
  });
});

describe('advanceTug: exchanges and the standing (ft_1_21.AC4, ft_1_21.AC5)', () => {
  const start = () => startTug({ kind: 'tug', piece: 'p', level: 2, bars: 16, pickup: false }, rules);

  it('a student phrase at or above the level share wins the exchange and moves the standing toward the character', () => {
    let s = advanceTug(start(), rules);
    expect(s.standing).toBe(0);
    s = advanceTug(s, rules, { share: 0.8, hands: {}, reasons: [] });
    expect(s.standing).toBe(1);
    expect(s.results[0]).toMatchObject({ turn: 1, share: 0.8, passed: true });
    s = advanceTug(advanceTug(s, rules), rules, { share: 0.79, hands: {}, reasons: ['late'] });
    expect(s.standing).toBe(0);
    expect(s.results[1]).toMatchObject({ turn: 3, passed: false, reasons: ['late'] });
  });

  it('the student wins at +3 and the character at -3', () => {
    expect(play(start(), [1])).toMatchObject({ outcome: 'won', standing: 3 });
    expect(play(start(), [0])).toMatchObject({ outcome: 'lost', standing: -3 });
  });

  it('undecided at the end of the part, it starts over with the roles swapped', () => {
    const short = startTug({ kind: 'tug', piece: 'p', level: 1, bars: 8, pickup: false }, rules); // two phrases
    let s = advanceTug(short, rules);
    s = advanceTug(s, rules, { share: 1, hands: {}, reasons: [] });
    expect(s.pass).toBe(1);
    expect(s.plan.turns.map((t) => t.who)).toEqual(['character', 'student', 'student', 'character']);
    expect(s.turn).toBe(2);
    expect(s.plan.turns[2]!.bars).toEqual({ from: 1, to: 2 });
  });

  it('a part of one phrase plays as call and echo: the character alone, then the student alone, until decided', () => {
    const one = startTug({ kind: 'tug', piece: 'p', level: 1, bars: 4, pickup: false }, rules); // bars 1-2: one phrase
    expect(one.plan.turns.map((t) => t.who)).toEqual(['character']);
    let s = advanceTug(one, rules);
    expect(s.pass).toBe(1);
    expect(s.plan.turns.map((t) => t.who)).toEqual(['character', 'student']);
    s = play(s, [1]);
    expect(s).toMatchObject({ outcome: 'won', standing: 3 });
    expect(s.plan.turns.map((t) => t.who)).toEqual(['character', 'student', 'character', 'student', 'character', 'student']);
  });

  it('refuses a result on the character turn and a missing result on the student turn, and any step after the end', () => {
    const s = start();
    expect(() => advanceTug(s, rules, { share: 1, hands: {}, reasons: [] })).toThrow(RangeError);
    const studentTurn = advanceTug(s, rules);
    expect(() => advanceTug(studentTurn, rules)).toThrow(RangeError);
    expect(() => advanceTug(play(start(), [1]), rules)).toThrow(RangeError);
  });

  it('remembers the furthest standing toward the character', () => {
    const s = play(start(), [1, 1, 0, 0, 0, 0, 0]);
    expect(s.outcome).toBe('lost');
    expect(s.best).toBe(2);
  });

  it('leaving ends it as left', () => {
    const s = leaveTug(advanceTug(start(), rules));
    expect(s.outcome).toBe('left');
    expect(() => advanceTug(s, rules)).toThrow(RangeError);
  });
});

describe('the stall kill (ft_1_21.AC17)', () => {
  const start = () => startTug({ kind: 'tug', piece: 'p', level: 1, bars: 16, pickup: false }, rules);
  /** Plays the student's phrases with the shares given; the character's turns in between. */
  const playShares = (shares: readonly number[]): TugState => {
    let s = start();
    for (const share of shares) {
      while (s.plan.turns[s.turn]!.who === 'character') s = advanceTug(s, rules);
      s = advanceTug(s, rules, { share, hands: {}, reasons: [] });
    }
    return s;
  };

  it('ft_1_21.AC17 the first four student phrases need the level share; each phrase after them 5 points more', () => {
    expect(tugShare(start(), rules)).toBeCloseTo(0.6);
    // win, lose, win, lose: undecided after four phrases
    const four = playShares([1, 0, 1, 0]);
    expect(four.outcome).toBeUndefined();
    expect(tugShare(four, rules)).toBeCloseTo(0.65);
    expect(tugShare(playShares([1, 0, 1, 0, 1]), rules)).toBeCloseTo(0.7);
    // 0.64 would have won the fifth phrase at level 1's 60 per cent; now it loses it
    expect(playShares([1, 0, 1, 0, 0.64]).results[4]).toMatchObject({ passed: false });
    expect(playShares([1, 0, 1, 0, 0.65]).results[4]).toMatchObject({ passed: true });
  });

  it('ft_1_21.AC17 the bar stops at 100 per cent: a phrase all right still wins', () => {
    const s = playShares(Array.from({ length: 24 }, (_, i) => (i % 2 === 0 ? 1 : 0)));
    expect(s.outcome).toBeUndefined();
    expect(tugShare(s, rules)).toBe(1);
    expect(s.results.filter((r) => r.share === 1).every((r) => r.passed)).toBe(true);
  });

  it('ft_1_21.AC17 a student who keeps winning and losing is overpowered: a tug of 90 per cent phrases ends lost', () => {
    // 0.9 wins at 60 per cent; after the bar passes 90 per cent every phrase is lost, so the character wins
    let s = start();
    for (let i = 0; i < 100 && s.outcome === undefined; i++) {
      if (s.plan.turns[s.turn]!.who === 'character') s = advanceTug(s, rules);
      else s = advanceTug(s, rules, { share: s.results.length % 2 === 0 ? 0.9 : 0, hands: {}, reasons: [] });
    }
    expect(s.outcome).toBe('lost');
    expect(s.results.length).toBeLessThan(20);
  });
});

describe('exchangeResult (contract A.10)', () => {
  it('gives the plan played, every judged turn, the outcome and the standing', () => {
    const s = play(startTug({ kind: 'practiceTug', piece: 'p', level: 3, bars: 4, pickup: true }, rules), [1]);
    const r = exchangeResult(s);
    expect(r.outcome).toBe('won');
    expect(r.standing).toBe(3);
    expect(r.plan.kind).toBe('practiceTug');
    expect(r.turns).toHaveLength(3);
    for (const t of r.turns) expect(r.plan.turns[t.turn]!.who).toBe('student');
  });

  it('refuses a tug still going', () => {
    expect(() => exchangeResult(startTug({ kind: 'tug', piece: 'p', level: 1, bars: 4, pickup: false }, rules))).toThrow(RangeError);
  });
});

describe('tugPrize (ft_1_21.AC8, ft_1_21.AC14)', () => {
  it('a won tug pays the prize; a lost one half the prize times the furthest standing toward the character over 3; leaving pays nothing', () => {
    expect(tugPrize({ kind: 'tug', outcome: 'won', best: 3 }, 60, rules)).toBe(60);
    expect(tugPrize({ kind: 'tug', outcome: 'lost', best: 2 }, 60, rules)).toBe(20);
    // a lost challenge still earns XP (CLAUDE.md, AX-1.1): one XP even when the rag never went toward the character
    expect(tugPrize({ kind: 'tug', outcome: 'lost', best: 0 }, 60, rules)).toBe(1);
    expect(tugPrize({ kind: 'tug', outcome: 'left', best: 2 }, 60, rules)).toBe(0);
  });

  it('a practice tug with Kiur wins nothing and loses nothing', () => {
    expect(tugPrize({ kind: 'practiceTug', outcome: 'won', best: 3 }, 60, rules)).toBe(0);
    expect(tugPrize({ kind: 'practiceTug', outcome: 'lost', best: 1 }, 60, rules)).toBe(0);
  });
});
