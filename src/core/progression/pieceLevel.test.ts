// Covers ft_1_13.AC1, ft_1_13.AC2, ft_1_13.AC3.
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import progressionJson from '../../../content/curriculum/progression.json';
import fixture from '../../../tests/fixtures/saves/profile.v17.json';
import type { PieceResult } from '../judge/types';
import { parseProgressionConfig } from './config';
import { deriveProgress, emptyProfile, profileSchema, recordAttempt, recordBattle } from './profile';
import { computeXp, levelForXp } from './xp';

const config = parseProgressionConfig(progressionJson);
const NOW = new Date('1998-11-01T12:00:00.000Z');
const fresh = () => emptyProfile('p1', 'Test', '1998-10-01T00:00:00.000Z');
const result = (chartId: string, accuracy = 1): PieceResult => ({
  chartId, contentVersion: 1, notes: 10, firstTryCorrect: Math.round(accuracy * 10), mistakes: 0, accuracy, rhythmErrorMs: null,
  hints: { noteNames: 0, fingers: 0 }, bothHands: { notes: 0, together: 0 },
});

const battle = (pieceId: string, xp: number) => ({ monsterId: 'wobble', pieceId, won: true, hpTaken: 20, maxHp: 20, potentialXp: xp, rounds: 2, playerHpLeft: 80, playerMaxHp: 100, xp });

describe('piece XP and piece level (ft_1_13)', () => {
  it('ft_1_13.AC1: a piece earns the ft_0_10 XP of each of its passes, and its level comes from the piece curve', () => {
    let profile = fresh();
    for (const accuracy of [0.5, 1, 1]) profile = recordAttempt(profile, result('a', accuracy), config, NOW).profile;
    profile = recordAttempt(profile, result('b'), config, NOW).profile;
    const expected =
      computeXp(result('a', 0.5), { completions: 0, bestStars: 0 }, config).total +
      computeXp(result('a', 1), { completions: 1, bestStars: 1 }, config).total +
      computeXp(result('a', 1), { completions: 2, bestStars: 3 }, config).total;
    const record = deriveProgress(profile, config).pieces['a']!;
    expect(record.xp).toBe(expected);
    expect(record.level).toEqual(levelForXp(expected, config.pieceLevels));
    expect(deriveProgress(profile, config).pieces['b']!.xp).toBe(70);
  });

  it('ft_1_13.AC1: is a pure function of the history: the same attempts give the same piece XP, saved XP or not', () => {
    const saved = profileSchema.parse(fixture);
    const once = deriveProgress(saved, config).pieces;
    expect(deriveProgress(structuredClone(saved), config).pieces).toEqual(once);
    for (const record of Object.values(once)) expect(record.xp).toBeGreaterThan(0);
  });

  it('ft_1_13.AC2: a practice pass leaves the player XP and level as they were, and reports the piece XP it earned', () => {
    const out = recordAttempt(fresh(), result('a'), config, NOW);
    expect(out.after.totalXp).toBe(0);
    expect(out.attempt.xp.total).toBe(0);
    expect(out.events).toEqual([expect.objectContaining({ type: 'XpAwarded', pieceId: 'a', xp: expect.objectContaining({ total: 70 }), totalXp: 0 })]);
    expect(out.events[0]).toMatchObject({ piece: { xp: 70, before: { level: 1 }, after: levelForXp(70, config.pieceLevels) } });
  });

  it('ft_1_13.AC2: XP saved before the change is kept, and battles still add player XP', () => {
    const saved = profileSchema.parse(fixture);
    const before = deriveProgress(saved, config).totalXp;
    const played = recordAttempt(saved, result('little-steps'), config, NOW);
    expect(played.after.totalXp).toBe(before);
    const fought = recordBattle(played.profile, battle('little-steps', 30), config, NOW);
    expect(fought.after.totalXp).toBe(before + 30);
  });

  it('ft_1_13.AC3: a level-up announces no unlocked pieces: player levels lock no piece', () => {
    const out = recordBattle(fresh(), battle('a', 300), config, NOW);
    expect(out.events.map((e) => e.type)).toEqual(['BattleFinished', 'LevelUp']);
  });

  it('ft_1_13.AC1: piece XP and level never go down, and the player XP never moves, however passes come (property)', () => {
    fc.assert(
      fc.property(fc.array(fc.tuple(fc.constantFrom('a', 'b'), fc.double({ min: 0, max: 1, noNaN: true })), { maxLength: 20 }), (plays) => {
        let profile = fresh();
        for (const [piece, accuracy] of plays) {
          const out = recordAttempt(profile, result(piece, accuracy), config, NOW);
          const was = out.before.pieces[piece];
          const now = out.after.pieces[piece]!;
          expect(now.xp).toBeGreaterThan(was?.xp ?? 0);
          expect(now.level.level).toBeGreaterThanOrEqual(was?.level.level ?? 1);
          expect(out.after.totalXp).toBe(0);
          profile = out.profile;
        }
        expect(profileSchema.safeParse(profile).success).toBe(true);
      }),
    );
  });
});
