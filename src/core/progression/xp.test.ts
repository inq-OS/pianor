// Covers ft_0_10.AC1, ft_0_10.AC3, ft_0_15.AC5.
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import modifiersJson from '../../../content/curriculum/modifiers.json';
import progressionJson from '../../../content/curriculum/progression.json';
import type { PieceResult } from '../judge/types';
import { parseProgressionConfig, progressionConfigSchema } from './config';
import { loadModifierTable } from './modifiers';
import { applyHelpFactors, computeXp, levelForXp, type PieceHistory } from './xp';

const config = parseProgressionConfig(progressionJson);
const NEVER: PieceHistory = { completions: 0, bestStars: 0 };
const modifiers = loadModifierTable(modifiersJson);

function result(overrides: Partial<PieceResult> = {}): PieceResult {
  return {
    chartId: 'little-steps', contentVersion: 1, notes: 10, firstTryCorrect: 10, mistakes: 0, accuracy: 1, rhythmErrorMs: null,
    hints: { noteNames: 0, fingers: 0 }, bothHands: { notes: 0, together: 0 }, ...overrides,
  };
}

describe('progression config', () => {
  it('the provisional table loads and is marked provisional', () => {
    expect(config.levels[0]).toBe(0);
    expect(config.xp.bothHandsMaxBonus).toBe(0.5);
    expect(progressionJson.note).toMatch(/PROVISIONAL/);
  });

  it('ships the harder defaults: replay 30%, each hint kind up to 40% off, helps noteNames 0.6, fingerNumbers 0.8, litKey 0.6', () => {
    expect(config.xp.replayFactor).toBe(0.3);
    expect(config.xp.hintDiscount).toEqual({ noteNames: 0.4, fingers: 0.4 });
    expect([modifiers.helps.noteNames.factor, modifiers.helps.fingerNumbers.factor, modifiers.helps.litKey.factor]).toEqual([0.6, 0.8, 0.6]);
  });

  it('refuses a table that does not start at 0, does not increase, or discounts hints too much', () => {
    const base = structuredClone(progressionJson);
    expect(progressionConfigSchema.safeParse({ ...base, levels: [10, 100] }).success).toBe(false);
    expect(progressionConfigSchema.safeParse({ ...base, levels: [0, 100, 100] }).success).toBe(false);
    expect(progressionConfigSchema.safeParse({ ...base, levels: [0] }).success).toBe(false);
    expect(progressionConfigSchema.safeParse({ ...base, xp: { ...base.xp, hintDiscount: { noteNames: 0.9, fingers: 0 } } }).success).toBe(false);
    expect(progressionConfigSchema.safeParse({ ...base, xp: { ...base.xp, replayFactor: 2 } }).success).toBe(false);
    expect(() => parseProgressionConfig({})).toThrow();
  });
});

describe('computeXp', () => {
  it('first time, perfect: completion 20 + accuracy 30 + first-time bonus 20', () => {
    expect(computeXp(result(), NEVER, config)).toEqual({
      kind: 'first', completion: 20, accuracy: 30, bonus: 20, replayFactor: 1, hintFactor: 1, bothHandsMultiplier: 1, total: 70,
    });
  });

  it('accuracy scales the accuracy part: 80% gives 24 of 30', () => {
    expect(computeXp(result({ accuracy: 0.8, firstTryCorrect: 8 }), NEVER, config)).toMatchObject({ accuracy: 24, total: 64 });
  });

  it('a repeat that does not improve earns 30% of the base', () => {
    expect(computeXp(result(), { completions: 1, bestStars: 3 }, config)).toMatchObject({ kind: 'replay', bonus: 0, replayFactor: 0.3, total: 15 });
  });

  it('a repeat with more stars than ever earns a bonus per extra star instead', () => {
    expect(computeXp(result(), { completions: 1, bestStars: 2 }, config)).toMatchObject({ kind: 'improved', bonus: 15, total: 65 });
    expect(computeXp(result(), { completions: 3, bestStars: 1 }, config)).toMatchObject({ kind: 'improved', bonus: 30, total: 80 });
  });

  it('hints cost reward in proportion to the notes played with them, never more than half', () => {
    const names = computeXp(result({ hints: { noteNames: 10, fingers: 0 } }), NEVER, config);
    expect(names.hintFactor).toBeCloseTo(0.6, 10);
    expect(names.total).toBe(42); // (50 + 20) x 0.6
    const half = computeXp(result({ hints: { noteNames: 5, fingers: 0 } }), NEVER, config);
    expect(half.hintFactor).toBeCloseTo(0.8, 10);
    const both = computeXp(result({ hints: { noteNames: 10, fingers: 10 } }), NEVER, config);
    expect(both.hintFactor).toBe(0.5);
    expect(both.total).toBe(35);
    const tooMany = computeXp(result({ hints: { noteNames: 99, fingers: 99 } }), NEVER, config);
    expect(tooMany.hintFactor).toBe(0.5);
  });

  it('playing both hands together multiplies the reward by up to 1.5', () => {
    const together = computeXp(result({ bothHands: { notes: 10, together: 10 } }), NEVER, config);
    expect(together.bothHandsMultiplier).toBe(1.5);
    expect(together.total).toBe(105);
    const half = computeXp(result({ bothHands: { notes: 10, together: 5 } }), NEVER, config);
    expect(half.bothHandsMultiplier).toBe(1.25);
    expect(half.total).toBe(88); // 70 x 1.25 = 87.5
  });

  it('hints and the two-hands bonus combine', () => {
    const both = computeXp(result({ hints: { noteNames: 10, fingers: 0 }, bothHands: { notes: 10, together: 10 } }), NEVER, config);
    const noBonus = computeXp(result({ hints: { noteNames: 10, fingers: 0 } }), NEVER, config);
    expect(both.total).toBeGreaterThan(noBonus.total);
  });

  it('finishing always earns at least 1 XP, even when the rules would give less', () => {
    const stingy = parseProgressionConfig({ ...progressionJson, xp: { ...progressionJson.xp, replayFactor: 0, completion: 0, accuracy: 0, improvementPerStar: 0 } });
    expect(computeXp(result({ accuracy: 0 }), { completions: 2, bestStars: 3 }, stingy).total).toBe(1);
  });

  it('there is no way to lose XP, and more accuracy or fewer hints never pay less (property)', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 40 }), fc.double({ min: 0, max: 1, noNaN: true }), fc.double({ min: 0, max: 1, noNaN: true }),
        fc.integer({ min: 0, max: 40 }), fc.integer({ min: 0, max: 40 }), fc.integer({ min: 0, max: 3 }), fc.integer({ min: 0, max: 3 }),
        (notes, a, b, names, fingers, completions, best) => {
          const history: PieceHistory = { completions, bestStars: (completions === 0 ? 0 : Math.max(1, best)) as 0 | 1 | 2 | 3 };
          const [low, high] = a <= b ? [a, b] : [b, a];
          const withHints = result({ notes, accuracy: high, hints: { noteNames: names, fingers } });
          const clean = result({ notes, accuracy: high });
          const lowAcc = result({ notes, accuracy: low });
          const xpHints = computeXp(withHints, history, config).total;
          const xpClean = computeXp(clean, history, config).total;
          expect(xpHints).toBeGreaterThanOrEqual(1);
          expect(xpHints).toBeLessThanOrEqual(xpClean);
          // within the same kind of attempt, a better run pays at least as much
          const worse = computeXp(lowAcc, history, config);
          const better = computeXp(clean, history, config);
          if (worse.kind === better.kind) expect(better.total).toBeGreaterThanOrEqual(worse.total);
        },
      ),
    );
  });
});

describe('levelForXp', () => {
  const table = config.levels;

  it('starts at level 1 and moves up exactly at each threshold', () => {
    expect(levelForXp(0, table)).toMatchObject({ level: 1, xpIntoLevel: 0, xpForLevel: 100, progress: 0 });
    expect(levelForXp(99, table).level).toBe(1);
    expect(levelForXp(100, table)).toMatchObject({ level: 2, xpIntoLevel: 0, xpForLevel: 150 });
    expect(levelForXp(249, table).level).toBe(2);
    expect(levelForXp(250, table).level).toBe(3);
    expect(levelForXp(175, table).progress).toBeCloseTo(0.5, 10);
  });

  it('stops at the top level of the table', () => {
    expect(levelForXp(15_700, table)).toMatchObject({ level: 20, xpForLevel: null, progress: 1 });
    expect(levelForXp(1_000_000, table).level).toBe(20);
  });

  it('ft_1_09.AC1 has 20 levels, one per rank shield, the step growing by 100 XP after level 10', () => {
    expect(table).toHaveLength(20);
    expect(levelForXp(3200, table)).toMatchObject({ level: 10, xpForLevel: 800 });
    for (let i = 10; i < table.length - 1; i++) expect(table[i + 1]! - table[i]!).toBe(table[i]! - table[i - 1]! + 100);
  });

  it('treats negative XP as zero', () => {
    expect(levelForXp(-50, table).level).toBe(1);
  });

  it('never goes down as XP goes up (property)', () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 5000 }), fc.integer({ min: 0, max: 500 }), (xp, more) => {
        expect(levelForXp(xp + more, table).level).toBeGreaterThanOrEqual(levelForXp(xp, table).level);
        const info = levelForXp(xp, table);
        expect(info.progress).toBeGreaterThanOrEqual(0);
        expect(info.progress).toBeLessThanOrEqual(1);
      }),
    );
  });
});

describe('applyHelpFactors (core_07, WP-G2)', () => {
  it('with no helps the XP is unchanged', () => {
    expect(applyHelpFactors(70, [], modifiers, false)).toBe(70);
    expect(applyHelpFactors(1, [], modifiers, false)).toBe(1);
  });

  it('with helps the XP is multiplied by factorFor and floored', () => {
    // noteNames 0.6: 70 x 0.6 = 42
    expect(applyHelpFactors(70, ['noteNames'], modifiers, false)).toBe(42);
    // noteNames 0.6 x fingerNumbers 0.8 = 0.48: 70 x 0.48 = 33.6, floored to 33
    expect(applyHelpFactors(70, ['noteNames', 'fingerNumbers'], modifiers, false)).toBe(33);
    // a repeated help counts once
    expect(applyHelpFactors(70, ['noteNames', 'noteNames'], modifiers, false)).toBe(42);
  });

  it('a play that earned XP keeps at least 1 XP, however many helps are on', () => {
    const everyHelp = ['noteNames', 'fingerNumbers', 'litKey', 'onScreenKeyboard', 'metronome'] as const;
    expect(applyHelpFactors(1, everyHelp, modifiers, false)).toBe(1);
    expect(applyHelpFactors(2, everyHelp, modifiers, false)).toBe(1);
  });

  it('a base of 0 stays 0', () => {
    expect(applyHelpFactors(0, ['noteNames'], modifiers, false)).toBe(0);
    expect(applyHelpFactors(0, [], modifiers, false)).toBe(0);
  });

  it('a play where a key light appeared after the wrong presses earns 0 new XP and never a negative number', () => {
    expect(applyHelpFactors(70, [], modifiers, true)).toBe(0);
    expect(applyHelpFactors(70, ['litKey'], modifiers, true)).toBe(0);
    expect(applyHelpFactors(1, [], modifiers, true)).toBe(0);
    expect(applyHelpFactors(0, [], modifiers, true)).toBe(0);
    expect(applyHelpFactors(-5, [], modifiers, true)).toBe(0);
  });

  it('never returns a negative number and never more than the base (property)', () => {
    const helpIds = ['noteNames', 'fingerNumbers', 'litKey', 'onScreenKeyboard', 'metronome'] as const;
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 5000 }),
        fc.subarray([...helpIds]),
        fc.boolean(),
        (base, helps, lit) => {
          const out = applyHelpFactors(base, helps, modifiers, lit);
          expect(out).toBeGreaterThanOrEqual(0);
          expect(Number.isInteger(out)).toBe(true);
          if (lit) expect(out).toBe(0);
          else if (base > 0) expect(out).toBeGreaterThanOrEqual(1);
          expect(out).toBeLessThanOrEqual(base);
        },
      ),
    );
  });
});
