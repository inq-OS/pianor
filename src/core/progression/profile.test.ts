// Covers ft_0_10.AC1, ft_0_16.AC4.
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import progressionJson from '../../../content/curriculum/progression.json';
import fixture from '../../../tests/fixtures/saves/profile.v17.json';
import type { PieceResult } from '../judge/types';
import { starsFor } from '../scoring/stars';
import { parseProgressionConfig } from './config';
import { DEFAULT_PLAY_SETTINGS } from '../judge/playSettings';
import { DEFAULT_STAFF_SETTINGS } from '../layout/staffSettings';
import { DEFAULT_PIECES_SETTINGS } from './pieceSwitch';
import { PROFILE_SCHEMA_VERSION, deriveProgress, emptyProfile, profileSchema, recordAttempt, recordBattle, type ProfileData } from './profile';
import { computeXp, type PieceHistory } from './xp';

const config = parseProgressionConfig(progressionJson);
const NOW = new Date('1998-10-05T12:00:00.000Z');
const profile = profileSchema.parse(fixture);

const result = (chartId: string, accuracy = 1, extra: Partial<PieceResult> = {}): PieceResult => ({
  chartId, contentVersion: 1, notes: 10, firstTryCorrect: Math.round(accuracy * 10), mistakes: 0, accuracy, rhythmErrorMs: null,
  hints: { noteNames: 0, fingers: 0 }, bothHands: { notes: 0, together: 0 }, ...extra,
});

describe('the save fixture of the current version (v17)', () => {
  it('is a valid profile, with the staff settings of the player', () => {
    expect(profile.attempts).toHaveLength(4);
    expect(profile.settings).toEqual({ staff: { lines: 2, barsPerLine: 4 }, play: { mode: 'tempo', scoreView: 'number' }, pieces: { hidden: ['rest-waltz', 'a-piece-that-no-longer-exists'] }, battle: { fights: 'many' }, keyboard: { onScreen: false }, barNumbers: { mode: 'every2' }, noteNaming: 'B', staffGap: 'wide', keyLights: { enabled: false, afterWrong: 0 }, earTrainer: { seconds: 2, repeat: false } });
    expect(profile.battles.map((b) => [b.monsterId, b.won, b.xp])).toEqual([['wobble', true, 30], ['wobble', false, 4], ['wobble', true, 30], ['wobble', true, 38], ['wobble', false, 5]]);
  });

  it('folds to 331 XP from the pieces and the battles, level 3, with a record per piece', () => {
    const progress = deriveProgress(profile, config);
    expect(progress.totalXp).toBe(70 + 25 + 64 + 65 + 30 + 4 + 30 + 38 + 5); // pieces and battles (the last three are one series)
    expect(progress.level).toMatchObject({ level: 3, xpIntoLevel: 81 });
    expect(progress.pieces['little-steps']).toEqual({
      // the piece XP is worked out again with today's rules (ft_1_13): 70 + 15, where the save gave the player 70 + 25 then
      completions: 2, xp: 85, level: { level: 2, xpIntoLevel: 35, xpForLevel: 100, progress: 0.35 }, bestStars: 3, bestAccuracy: 1, bestGrade: 5, firstCompletedAt: '1998-10-01T10:00:00.000Z', lastPlayedAt: '1998-10-01T10:05:00.000Z',
    });
    expect(progress.pieces['rest-waltz']).toMatchObject({ completions: 2, bestStars: 3, bestAccuracy: 1 });
  });

  it('stores exactly the XP the rules of its time awarded for those results, in order', () => {
    // recorded before the defaults were made harder; earned XP and stars are never recomputed
    const recordedWith = parseProgressionConfig({ ...progressionJson, xp: { ...progressionJson.xp, replayFactor: 0.5, hintDiscount: { noteNames: 0.25, fingers: 0.25 } } });
    const history = new Map<string, PieceHistory>();
    for (const a of profile.attempts) {
      const previous = history.get(a.pieceId) ?? { completions: 0, bestStars: 0 as const };
      expect(computeXp(a.result, previous, recordedWith), `attempt ${a.n}`).toEqual(a.xp);
      expect(starsFor(a.result.accuracy)).toBe(a.stars);
      history.set(a.pieceId, { completions: previous.completions + 1, bestStars: Math.max(previous.bestStars, a.stars) as 1 | 2 | 3 });
    }
  });
});

describe('profile schema', () => {
  const broken = (mutate: (p: ProfileData) => void) => {
    const copy = structuredClone(profile);
    mutate(copy);
    return profileSchema.safeParse(copy);
  };

  it('rejects attempt numbers out of order and a piece id that does not match the result', () => {
    const outOfOrder = broken((p) => { p.attempts[1]!.n = 5; });
    expect(outOfOrder.success).toBe(false);
    expect(outOfOrder.error?.issues.map((i) => i.message)).toContain('attempt numbers must be 1, 2, 3 ... (found 5 at position 2)');
    expect(broken((p) => { p.attempts[0]!.pieceId = 'other'; }).success).toBe(false);
  });

  it('rejects bad stars, accuracy, negative XP and an empty name', () => {
    expect(broken((p) => { (p.attempts[0] as { stars: number }).stars = 4; }).success).toBe(false);
    expect(broken((p) => { p.attempts[0]!.result.accuracy = 1.5; }).success).toBe(false);
    expect(broken((p) => { p.attempts[0]!.xp.total = -5; }).success).toBe(false);
    expect(broken((p) => { p.name = ''; }).success).toBe(false);
  });

  it('rejects staff settings that are not offered, or missing settings', () => {
    expect(broken((p) => { (p.settings.staff as { lines: unknown }).lines = 3; }).success).toBe(false);
    expect(broken((p) => { (p.settings.staff as { barsPerLine: unknown }).barsPerLine = 'many'; }).success).toBe(false);
    expect(broken((p) => { delete (p as Partial<ProfileData>).settings; }).success).toBe(false);
  });

  it('rejects pieces settings that are not a list of ids, or missing', () => {
    expect(broken((p) => { (p.settings.pieces as { hidden: unknown }).hidden = 'rest-waltz'; }).success).toBe(false);
    expect(broken((p) => { delete (p.settings as Partial<ProfileData['settings']>).pieces; }).success).toBe(false);
  });

  it('a battle keeps the player\'s HP left and maximum, in place of the hearts', () => {
    expect(fixture.schemaVersion).toBe(PROFILE_SCHEMA_VERSION);
    expect(profileSchema.parse(fixture).battles.map((b) => [b.playerHpLeft, b.playerMaxHp])).toEqual([[80, 100], [0, 100], [74, 100], [60, 100], [0, 100]]);
    expect(broken((p) => { delete (p.battles[0] as Partial<ProfileData['battles'][number]>).playerMaxHp; }).success).toBe(false);
    expect(broken((p) => { (p.battles[0] as Record<string, unknown>).heartsLeft = 3; delete (p.battles[0] as Partial<ProfileData['battles'][number]>).playerHpLeft; }).success).toBe(false);
  });

  it('ft_Y_12.AC3: the on-screen keyboard setting is on or off, and a player who has never chosen has it on', () => {
    expect(emptyProfile('p', 'P', NOW.toISOString()).settings.keyboard).toEqual({ onScreen: true });
    expect(profile.settings.keyboard).toEqual({ onScreen: false });
    expect(broken((p) => { (p.settings.keyboard as { onScreen: unknown }).onScreen = 'yes'; }).success).toBe(false);
    expect(broken((p) => { delete (p.settings as Partial<ProfileData['settings']>).keyboard; }).success).toBe(false);
  });

  it('ft_0_16.AC7: the bar numbers setting is one of four modes, and a player who has never chosen has them off', () => {
    expect(emptyProfile('p', 'P', NOW.toISOString()).settings.barNumbers).toEqual({ mode: 'off' });
    expect(profile.settings.barNumbers).toEqual({ mode: 'every2' });
    expect(broken((p) => { (p.settings.barNumbers as { mode: unknown }).mode = 'every3'; }).success).toBe(false);
    expect(broken((p) => { delete (p.settings as Partial<ProfileData['settings']>).barNumbers; }).success).toBe(false);
  });

  it('the settings say how many monsters a fight has: One or Many, nothing else', () => {
    expect(PROFILE_SCHEMA_VERSION).toBe(17);
    expect(fixture.schemaVersion).toBe(17);
    expect(emptyProfile('p', 'P', NOW.toISOString()).settings.battle).toEqual({ fights: 'one' });
    expect(broken((p) => { (p.settings.battle as { fights: unknown }).fights = 'two'; }).success).toBe(false);
    expect(broken((p) => { delete (p.settings as Partial<ProfileData['settings']>).battle; }).success).toBe(false);
  });

  it('rejects battles out of order, negative XP, more HP taken than the monster had, or a player ending above the maximum', () => {
    expect(broken((p) => { p.battles[0]!.playerHpLeft = 101; }).success).toBe(false);
    expect(broken((p) => { p.battles[0]!.playerMaxHp = 0; }).success).toBe(false);
    expect(broken((p) => { p.battles[1]!.n = 5; }).success).toBe(false);
    expect(broken((p) => { p.battles[0]!.xp = -1; }).success).toBe(false);
    expect(broken((p) => { p.battles[1]!.hpTaken = 25; }).success).toBe(false);
  });
});

describe('a new profile', () => {
  it('starts with the default staff settings and an empty log', () => {
    const p = emptyProfile('p1', 'Test', '1998-10-01T00:00:00.000Z');
    expect(p).toMatchObject({ schemaVersion: PROFILE_SCHEMA_VERSION, attempts: [], battles: [], settings: { staff: DEFAULT_STAFF_SETTINGS, play: DEFAULT_PLAY_SETTINGS, pieces: DEFAULT_PIECES_SETTINGS, battle: { fights: 'one' } } });
    expect(profileSchema.safeParse(p).success).toBe(true);
  });

  it('lights the awaited key only after two wrong presses by default', () => {
    expect(emptyProfile('p1', 'Test', '1998-10-01T00:00:00.000Z').settings.keyLights).toEqual({ enabled: false, afterWrong: 2 });
  });
});

describe('recordAttempt', () => {
  const fresh = () => emptyProfile('p1', 'Test', '1998-10-01T00:00:00.000Z');

  it('adds an attempt that gives the player no XP (ft_1_13.AC2) and reports the piece XP as an event', () => {
    const out = recordAttempt(fresh(), result('little-steps'), config, NOW);
    expect(out.attempt).toMatchObject({ n: 1, at: NOW.toISOString(), pieceId: 'little-steps', stars: 3, xp: { kind: 'first', total: 0 } });
    expect(out.profile.attempts).toHaveLength(1);
    expect(out.after.totalXp).toBe(0);
    expect(out.after.pieces['little-steps']).toMatchObject({ xp: 70, completions: 1 });
    expect(out.events).toEqual([expect.objectContaining({ type: 'XpAwarded', pieceId: 'little-steps', stars: 3, xp: expect.objectContaining({ total: 70 }), totalXp: 0, newBest: false, v: 1 })]);
  });

  it('does not change the profile it was given, or earlier attempts', () => {
    const start = fresh();
    const frozen = structuredClone(start);
    const once = recordAttempt(start, result('a'), config, NOW);
    expect(start).toEqual(frozen);
    const twice = recordAttempt(once.profile, result('a'), config, NOW);
    expect(twice.profile.attempts[0]).toEqual(once.attempt);
  });

  it('marks a new personal best only when stars rise on a repeat', () => {
    const first = recordAttempt(fresh(), result('a', 0.5), config, NOW);
    expect(first.events[0]).toMatchObject({ newBest: false });
    const better = recordAttempt(first.profile, result('a', 1), config, NOW);
    expect(better.events[0]).toMatchObject({ newBest: true, xp: { kind: 'improved' } });
    const same = recordAttempt(better.profile, result('a', 1), config, NOW);
    expect(same.events[0]).toMatchObject({ newBest: false });
  });

  it('keeps the best five-star grade a piece has earned and calls a higher grade a new best', () => {
    // 95 and 100 percent are both three saved stars, but four and five of the five the player sees
    const first = recordAttempt(fresh(), result('a', 0.95), config, NOW);
    expect(first.after.pieces['a']).toMatchObject({ bestStars: 3, bestGrade: 4 });
    const perfect = recordAttempt(first.profile, result('a', 1), config, NOW);
    expect(perfect.attempt.stars).toBe(3);
    expect(perfect.events[0]).toMatchObject({ newBest: true, xp: { kind: 'replay' } });
    expect(perfect.after.pieces['a']).toMatchObject({ bestStars: 3, bestGrade: 5 });
    const worse = recordAttempt(perfect.profile, result('a', 0.8), config, NOW);
    expect(worse.events[0]).toMatchObject({ newBest: false });
    expect(worse.after.pieces['a']).toMatchObject({ bestGrade: 5 });
  });

  it('a later change of the rules does not rewrite the player XP awarded before', () => {
    const richer = parseProgressionConfig({ ...progressionJson, xp: { ...progressionJson.xp, completion: 500 } });
    expect(deriveProgress(profile, richer).totalXp).toBe(deriveProgress(profile, config).totalXp);
  });

  it('the player XP and level never move, however attempts come (property, ft_1_13.AC2)', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.tuple(fc.constantFrom('a', 'b', 'c'), fc.double({ min: 0, max: 1, noNaN: true }), fc.integer({ min: 0, max: 10 }), fc.integer({ min: 0, max: 10 })),
          { maxLength: 25 },
        ),
        (plays) => {
          let current = fresh();
          let lastXp = 0;
          let lastLevel = 1;
          for (const [piece, accuracy, names, together] of plays) {
            const played = result(piece, accuracy, { hints: { noteNames: names, fingers: 0 }, bothHands: { notes: 10, together } });
            const out = recordAttempt(current, played, config, NOW);
            expect(out.after.totalXp).toBe(lastXp);
            expect(out.after.level.level).toBeGreaterThanOrEqual(lastLevel);
            expect(out.attempt.n).toBe(current.attempts.length + 1);
            lastXp = out.after.totalXp;
            lastLevel = out.after.level.level;
            current = out.profile;
          }
          expect(profileSchema.safeParse(current).success).toBe(true);
        },
      ),
    );
  });
});

describe('recordBattle', () => {
  const fresh = () => emptyProfile('p1', 'Test', '1998-10-01T00:00:00.000Z');
  const won = { monsterId: 'wobble', pieceId: 'little-steps', won: true, hpTaken: 20, maxHp: 20, potentialXp: 30, rounds: 2, playerHpLeft: 80, playerMaxHp: 100, xp: 30 };

  it('adds the battle to the log, counts its XP and reports it', () => {
    const out = recordBattle(fresh(), won, config, NOW);
    expect(out.battle).toMatchObject({ n: 1, at: NOW.toISOString(), monsterId: 'wobble', won: true, xp: 30 });
    expect(out.profile.battles).toHaveLength(1);
    expect(out.after.totalXp).toBe(30);
    expect(out.events).toEqual([expect.objectContaining({ type: 'BattleFinished', monsterId: 'wobble', pieceId: 'little-steps', won: true, xp: 30, totalXp: 30, v: 1 })]);
  });

  it('a lost battle pays what it paid, and nothing is ever taken away', () => {
    const start = recordBattle(fresh(), won, config, NOW).profile;
    const out = recordBattle(start, { ...won, won: false, hpTaken: 5, playerHpLeft: 0, rounds: 1, xp: 4 }, config, NOW);
    expect(out.after.totalXp).toBe(34);
    expect(out.after.totalXp).toBeGreaterThanOrEqual(out.before.totalXp);
  });

  it('a battle that crosses a level reports the level-up, and keeps piece records apart', () => {
    let p = fresh();
    for (let i = 0; i < 3; i++) p = recordBattle(p, won, config, NOW).profile; // 90 XP
    const out = recordBattle(p, won, config, NOW);
    expect(out.events.map((e) => e.type)).toEqual(['BattleFinished', 'LevelUp']);
    expect(out.after.pieces).toEqual({}); // battles do not change stars or completions
  });

  it('does not change the profile it was given', () => {
    const start = fresh();
    const frozen = structuredClone(start);
    recordBattle(start, won, config, NOW);
    expect(start).toEqual(frozen);
  });
});


