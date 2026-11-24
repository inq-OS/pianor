// Covers ft_0_17 (noteNaming), ft_Y_06 (keyLights), ft_0_16.AC7, ft_0_10.AC5, ft_1_02c.AC2, core_04.AC3.
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import progressionJson from '../../../content/curriculum/progression.json';
import v0 from '../../../tests/fixtures/saves/profile.v0.json';
import v1 from '../../../tests/fixtures/saves/profile.v1.json';
import v2 from '../../../tests/fixtures/saves/profile.v2.json';
import v3 from '../../../tests/fixtures/saves/profile.v3.json';
import v4 from '../../../tests/fixtures/saves/profile.v4.json';
import v5 from '../../../tests/fixtures/saves/profile.v5.json';
import v6 from '../../../tests/fixtures/saves/profile.v6.json';
import v7 from '../../../tests/fixtures/saves/profile.v7.json';
import v8 from '../../../tests/fixtures/saves/profile.v8.json';
import v9 from '../../../tests/fixtures/saves/profile.v9.json';
import v10 from '../../../tests/fixtures/saves/profile.v10.json';
import v11 from '../../../tests/fixtures/saves/profile.v11.json';
import v12 from '../../../tests/fixtures/saves/profile.v12.json';
import v13 from '../../../tests/fixtures/saves/profile.v13.json';
import v14 from '../../../tests/fixtures/saves/profile.v14.json';
import v15 from '../../../tests/fixtures/saves/profile.v15.json';
import v16 from '../../../tests/fixtures/saves/profile.v16.json';
import v17 from '../../../tests/fixtures/saves/profile.v17.json';
import { parseProgressionConfig } from './config';
import { BAR_NUMBER_SETTINGS_SINCE, HELPS_SINCE, KEYBOARD_SETTINGS_SINCE, NOTE_TIMINGS_SINCE, V11_SETTINGS_SINCE, PRACTICE_SINCE, EAR_TRAINER_SINCE, ProfileMigrationError, migrateProfile, parseProfile, profileAfterRecord17, profileMigrations, TRAINER_XP_SINCE, validateProfile } from './migrate';
import { EMPTY_PRACTICE_LOG } from './practiceLog';
import { PROFILE_SCHEMA_VERSION, deriveProgress, profileSchema } from './profile';

const config = parseProgressionConfig(progressionJson);
const SHOWN = { onScreen: true }; // and with the on-screen keyboard shown
const NO_NUMBERS = { mode: 'off' }; // and with no bar numbers
const V11 = { noteNaming: 'B', staffGap: 'wide', keyLights: { enabled: false, afterWrong: 0 } }; // and the three settings of version 11
const V17 = { earTrainer: { seconds: 1, repeat: true } }; // and the ear trainer's settings of version 17 (ft_1_10)

type Battle = { n: number; at: string; monsterId: string; pieceId: string; won: boolean; potentialXp: number; rounds: number; xp: number };

/** The battle records of a save before version 18 as they arrive in it: tug records with the same number, time, piece, outcome and XP. */
const toTugs = (battles: readonly Battle[]) =>
  battles.map((b) => ({ n: b.n, at: b.at, characterId: b.monsterId, pieceId: b.pieceId, won: b.won, potentialXp: b.potentialXp, exchanges: b.rounds, xp: b.xp }));

/** Settings of a save before version 18 as they arrive in it: the battle setting gone. */
const noBattle = <T extends object>(settings: T) => Object.fromEntries(Object.entries(settings).filter(([key]) => key !== 'battle'));

/** A record shaped as version 17 as the game holds it today (profile document version 2): tug records in place of battles, no campaign, no battle setting. */
function today(save: { battles: readonly Battle[]; settings: object; [key: string]: unknown }) {
  const rest = Object.fromEntries(Object.entries(save).filter(([key]) => key !== 'battles' && key !== 'campaign'));
  return { ...rest, schemaVersion: PROFILE_SCHEMA_VERSION, settings: noBattle(save.settings), tugs: toTugs(save.battles) };
}

/** Battles of a save before version 7 as they arrive after it: the 5 hearts left become a share of 100 HP. */
const inHealth = <T extends { heartsLeft: number }>(battles: readonly T[]) =>
  battles.map(({ heartsLeft, ...rest }) => ({ ...rest, playerHpLeft: heartsLeft * 20, playerMaxHp: 100 }));

/** The attempts of a migrated save without the `play` field that version 5 added, the `noteTimings` of version 12 and the `helps` of version 13, to compare with an older fixture. */
const withoutPlay = (attempts: { play?: unknown }[]) => attempts.map((attempt) => Object.fromEntries(Object.entries(attempt).filter(([key]) => key !== 'play' && key !== 'noteTimings' && key !== 'helps')));

/** The attempts of an older fixture as they arrive in version 13: each with an empty list of note timings and no helps (full difficulty). */
const withTimings = (attempts: readonly object[]) => attempts.map((attempt) => ({ ...attempt, noteTimings: [], helps: [] }));

describe('profile migration', () => {
  it('the last record version loads in today\'s shape, its tugs kept', () => {
    const result = parseProfile(v17, config);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.profile).toEqual(today(v17));
    expect(v17.schemaVersion).toBe(PROFILE_SCHEMA_VERSION);
    expect(EAR_TRAINER_SINCE).toBe(PROFILE_SCHEMA_VERSION);
    expect(PRACTICE_SINCE).toBe(16);
    expect(TRAINER_XP_SINCE).toBe(15);
    expect(HELPS_SINCE).toBe(13);
    expect(NOTE_TIMINGS_SINCE).toBe(12);
    expect(V11_SETTINGS_SINCE).toBe(11);
    expect(BAR_NUMBER_SETTINGS_SINCE).toBe(10);
  });

  it('every fixture, from v0 to v17, reaches the current version, is valid there, and migrating twice gives the same save', () => {
    const fixtures = [v0, v1, v2, v3, v4, v5, v6, v7, v8, v9, v10, v11, v12, v13, v14, v15, v16, v17];
    expect(fixtures.map((f) => f.schemaVersion)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17]);
    expect(Object.keys(profileMigrations).map(Number)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16]);
    for (const old of fixtures) {
      const once = parseProfile(old, config);
      expect(once.ok).toBe(true);
      if (!once.ok) continue;
      expect(once.profile.schemaVersion).toBe(PROFILE_SCHEMA_VERSION);
      expect(once.profile.settings).toMatchObject({ pieces: { hidden: expect.any(Array) }, keyboard: { onScreen: expect.any(Boolean) }, barNumbers: { mode: expect.stringMatching(/^(off|first|every2|every4)$/) }, noteNaming: expect.stringMatching(/^[BH]$/), staffGap: expect.stringMatching(/^(wide|short)$/), keyLights: { enabled: expect.any(Boolean), afterWrong: expect.any(Number) } });
      expect(once.profile.attempts.every((a) => a.play.tempoPercent > 0)).toBe(true);
      expect(once.profile.tugs.every((t) => t.exchanges > 0)).toBe(true);
      const again = validateProfile(JSON.parse(JSON.stringify(once.profile)));
      expect(again.ok && again.profile).toEqual(once.profile);
    }
  });

  it('migrates a v4 save to v5 (core_04): every attempt was Wait mode at the written tempo, and nothing else changes', () => {
    const result = profileMigrations[4]!(v4, config) as unknown as { schemaVersion: number; attempts: { play: { mode: string; tempoPercent: number } }[]; settings: unknown; battles: unknown };
    expect(result.schemaVersion).toBe(5);
    expect(result.attempts.every((a) => a.play.mode === 'wait' && a.play.tempoPercent === 100)).toBe(true);
    expect(withoutPlay(result.attempts)).toEqual(v4.attempts);
    expect(result.settings).toEqual(v4.settings);
    expect(result.battles).toEqual(v4.battles);
  });

  it('migrates a v7 save on: everything kept', () => {
    const result = parseProfile(v7, config);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.profile.schemaVersion).toBe(PROFILE_SCHEMA_VERSION);
    expect(result.profile.settings).toEqual(noBattle({ ...v7.settings, keyboard: SHOWN, barNumbers: NO_NUMBERS, ...V11, ...V17 }));
    expect(result.profile.tugs).toEqual(toTugs(v7.battles));
    expect(result.profile.attempts).toEqual(withTimings(v7.attempts));
    // the v8 fixture is the migrated v7 save apart from its id, its battle setting and its three later records
    expect(result.profile).toEqual(today({ ...v8, id: v7.id, attempts: withTimings(v8.attempts), trainerXp: 0, practice: { bars: [] }, earPoints: 0, settings: { ...v8.settings, ...V17, keyboard: SHOWN, barNumbers: NO_NUMBERS, ...V11, ...V17 }, battles: v8.battles.slice(0, 2) }));
    const again = validateProfile(JSON.parse(JSON.stringify(result.profile))); // reading it again gives the same profile
    expect(again.ok && again.profile).toEqual(result.profile);
  });

  it('ft_Y_12.AC3: migrates a v8 save to v9: everything kept, and the on-screen keyboard shown (the keys the player had)', () => {
    const result = parseProfile(v8, config);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.profile.schemaVersion).toBe(PROFILE_SCHEMA_VERSION);
    expect(KEYBOARD_SETTINGS_SINCE).toBe(9);
    expect(result.profile.settings).toEqual(noBattle({ ...v8.settings, keyboard: { onScreen: true }, barNumbers: NO_NUMBERS, ...V11, ...V17 }));
    expect(result.profile.tugs).toEqual(toTugs(v8.battles));
    expect(result.profile.attempts).toEqual(withTimings(v8.attempts));
    // the v9 fixture is the migrated v8 save apart from its id, its schema version and the keyboard turned off
    expect(result.profile).toEqual(today({ ...v9, id: v8.id, attempts: withTimings(v9.attempts), trainerXp: 0, practice: { bars: [] }, earPoints: 0, settings: { ...v9.settings, ...V17, keyboard: { onScreen: true }, barNumbers: NO_NUMBERS, ...V11, ...V17 } }));
    const again = validateProfile(JSON.parse(JSON.stringify(result.profile))); // reading it again gives the same profile
    expect(again.ok && again.profile).toEqual(result.profile);
  });

  it('ft_Y_12.AC3: every older save arrives with the on-screen keyboard shown, and a saved choice to hide it is kept', () => {
    for (const old of [v0, v1, v2, v3, v4, v5, v6, v7, v8]) {
      const once = parseProfile(old, config);
      expect(once.ok && once.profile.settings.keyboard).toEqual({ onScreen: true });
    }
    expect(parseProfile(v9, config)).toMatchObject({ ok: true, profile: { settings: { keyboard: { onScreen: false } } } });
  });

  it('ft_0_17 / ft_Y_06: migrates a v10 save to v11: everything kept, and the defaults B, wide and key lights off', () => {
    const result = parseProfile(v10, config);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.profile.schemaVersion).toBe(PROFILE_SCHEMA_VERSION);
    expect(result.profile.settings).toEqual(noBattle({ ...v10.settings, noteNaming: 'B', staffGap: 'wide', keyLights: { enabled: false, afterWrong: 0 }, ...V17 }));
    expect(result.profile.tugs).toEqual(toTugs(v10.battles));
    expect(result.profile.attempts).toEqual(withTimings(v10.attempts));
    // the v17 fixture is the migrated v10 save apart from its id and its campaign
    expect(result.profile).toEqual(today({ ...v17, id: v10.id, earPoints: 0, settings: { ...v17.settings, earTrainer: V17.earTrainer } }));
    const again = validateProfile(JSON.parse(JSON.stringify(result.profile))); // reading it again gives the same profile
    expect(again.ok && again.profile).toEqual(result.profile);
  });

  it('ft_0_17 / ft_Y_06: every older save arrives with the v11 defaults, and chosen values are kept or refused when out of range', () => {
    for (const old of [v0, v1, v2, v3, v4, v5, v6, v7, v8, v9, v10]) {
      const once = parseProfile(old, config);
      expect(once.ok && once.profile.settings).toMatchObject(V11);
    }
    const chosen = { ...v11, settings: { ...v11.settings, noteNaming: 'H', staffGap: 'short', keyLights: { enabled: true, afterWrong: 3 } } };
    expect(parseProfile(chosen, config)).toMatchObject({ ok: true, profile: { settings: { noteNaming: 'H', staffGap: 'short', keyLights: { enabled: true, afterWrong: 3 } } } });
    for (const bad of [{ noteNaming: 'C' }, { staffGap: 'tall' }, { keyLights: { enabled: true, afterWrong: 4 } }, { keyLights: { enabled: true, afterWrong: -1 } }, { keyLights: { enabled: true, afterWrong: 1.5 } }]) {
      expect(parseProfile({ ...v11, settings: { ...v11.settings, ...bad } }, config).ok).toBe(false);
    }
  });

  it('ft_0_16.AC7: migrates a v9 save to v10: everything kept, and no bar numbers (the staff the player had)', () => {
    const result = parseProfile(v9, config);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.profile.schemaVersion).toBe(PROFILE_SCHEMA_VERSION);
    expect(result.profile.settings).toEqual(noBattle({ ...v9.settings, barNumbers: NO_NUMBERS, ...V11, ...V17 }));
    expect(result.profile.tugs).toEqual(toTugs(v9.battles));
    expect(result.profile.attempts).toEqual(withTimings(v9.attempts));
    // the v17 fixture is the migrated v9 save apart from its id, its campaign and the chosen bar numbers
    expect(result.profile).toEqual(today({ ...v17, id: v9.id, earPoints: 0, settings: { ...v17.settings, barNumbers: NO_NUMBERS, earTrainer: V17.earTrainer } }));
    const again = validateProfile(JSON.parse(JSON.stringify(result.profile))); // reading it again gives the same profile
    expect(again.ok && again.profile).toEqual(result.profile);
  });

  it('ft_0_16.AC7: every older save arrives with no bar numbers, and a saved choice is kept', () => {
    for (const old of [v0, v1, v2, v3, v4, v5, v6, v7, v8, v9]) {
      const once = parseProfile(old, config);
      expect(once.ok && once.profile.settings.barNumbers).toEqual(NO_NUMBERS);
    }
    expect(parseProfile(v11, config)).toMatchObject({ ok: true, profile: { settings: { barNumbers: { mode: 'every2' } } } });
  });

  it('whatever the settings of a v7 save, only the later settings are added (property)', () => {
    fc.assert(
      fc.property(
        fc.record({
          staff: fc.record({ lines: fc.constantFrom(1, 2, 'all' as const), barsPerLine: fc.constantFrom('auto' as const, 2, 4) }),
          play: fc.record({ mode: fc.constantFrom('wait' as const, 'tempo' as const), scoreView: fc.constantFrom('off' as const, 'colour' as const, 'number' as const) }),
          pieces: fc.record({ hidden: fc.array(fc.string({ minLength: 1, maxLength: 8 }), { maxLength: 4 }) }),
        }),
        (settings) => {
          const result = parseProfile({ ...v7, settings }, config);
          expect(result.ok).toBe(true);
          if (result.ok) expect(result.profile.settings).toEqual(noBattle({ ...settings, keyboard: SHOWN, barNumbers: NO_NUMBERS, ...V11, ...V17 }));
        },
      ),
    );
  });

  it('migrates a v6 save on: its battles kept as tug records with their XP, everything else as it was', () => {
    const result = parseProfile(v6, config);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.profile.schemaVersion).toBe(PROFILE_SCHEMA_VERSION);
    expect(result.profile.tugs.map((b) => [b.n, b.won, b.xp])).toEqual([[1, true, 30], [2, false, 4]]);
    expect(result.profile.attempts).toEqual(withTimings(v6.attempts));
    expect(result.profile.settings).toEqual(noBattle({ ...v6.settings, keyboard: SHOWN, barNumbers: NO_NUMBERS, ...V11, ...V17 }));
    expect(result.profile).toEqual(today({ ...v7, id: v6.id, attempts: withTimings(v7.attempts), trainerXp: 0, practice: { bars: [] }, earPoints: 0, settings: { ...v7.settings, ...V17, keyboard: SHOWN, barNumbers: NO_NUMBERS, ...V11, ...V17 } })); // the v7 fixture is exactly the migrated v6 save, apart from its id
  });

  it('hearts scale to the new maximum: 5 of 5 is full, 3 is 60, 0 is 0, and odd values stay in range', () => {
    // the step of version 6 to 7 alone: version 18 drops the HP numbers again
    const hpLeft = (heartsLeft: unknown) => {
      const out = profileMigrations[6]!({ ...v6, battles: [{ ...v6.battles[0], heartsLeft }] }, config) as { battles: { playerHpLeft: number }[] };
      return out.battles[0]!.playerHpLeft;
    };
    expect([5, 4, 3, 2, 1, 0].map(hpLeft)).toEqual([100, 80, 60, 40, 20, 0]);
    expect([9, -2, undefined].map(hpLeft)).toEqual([100, 0, 0]);
  });

  it('ft_1_02c.AC2: migrates a v5 save on: everything kept, and every piece on (nothing turned off)', () => {
    const result = parseProfile(v5, config);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.profile.schemaVersion).toBe(PROFILE_SCHEMA_VERSION);
    expect(result.profile.settings).toEqual(noBattle({ ...v5.settings, pieces: { hidden: [] }, keyboard: SHOWN, barNumbers: NO_NUMBERS, ...V11, ...V17 }));
    expect(result.profile.tugs).toEqual(toTugs(inHealth(v5.battles)));
    expect(result.profile.attempts).toEqual(withTimings(v5.attempts));
    // the v6 fixture is the migrated v5 save plus the pieces its player turned off, apart from its id
    expect(result.profile).toEqual(today({ ...v6, id: v5.id, attempts: withTimings(v6.attempts), trainerXp: 0, practice: { bars: [] }, earPoints: 0, settings: { ...v6.settings, ...V17, pieces: { hidden: [] }, keyboard: SHOWN, barNumbers: NO_NUMBERS, ...V11, ...V17 }, battles: inHealth(v5.battles) }));
  });

  it('ft_1_02c.AC2: every older save also arrives with every piece on, and migrating twice gives the same save', () => {
    for (const old of [v0, v1, v2, v3, v4, v5]) {
      const once = parseProfile(old, config);
      expect(once.ok).toBe(true);
      if (!once.ok) continue;
      expect(once.profile.settings.pieces).toEqual({ hidden: [] });
      const again = validateProfile(JSON.parse(JSON.stringify(once.profile)));
      expect(again.ok && again.profile).toEqual(once.profile);
    }
  });

  it('migrates a v4 save on to the current version: everything kept, and every attempt Wait mode at the written tempo', () => {
    const result = parseProfile(v4, config);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.profile.schemaVersion).toBe(PROFILE_SCHEMA_VERSION);
    expect(result.profile.settings).toEqual(noBattle({ ...v4.settings, pieces: { hidden: [] }, keyboard: SHOWN, barNumbers: NO_NUMBERS, ...V11, ...V17 }));
    expect(result.profile.tugs).toEqual(toTugs(inHealth(v4.battles)));
    expect(result.profile.attempts.every((a) => a.play.mode === 'wait' && a.play.tempoPercent === 100)).toBe(true);
    expect(withoutPlay(result.profile.attempts)).toEqual(v4.attempts);
  });

  it('migrates a v3 save on to the current version: everything kept, and the default way to play (Wait mode)', () => {
    const result = parseProfile(v3, config);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.profile.schemaVersion).toBe(PROFILE_SCHEMA_VERSION);
    expect(result.profile.settings).toEqual(noBattle({ ...v3.settings, play: { mode: 'wait', scoreView: 'colour' }, pieces: { hidden: [] }, keyboard: SHOWN, barNumbers: NO_NUMBERS, ...V11, ...V17 }));
    expect(result.profile.tugs).toEqual(toTugs(inHealth(v3.battles)));
    expect(withoutPlay(result.profile.attempts)).toEqual(v3.attempts);
  });

  it('migrates a v2 save to the current version: everything kept, and no tug records', () => {
    const result = parseProfile(v2, config);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.profile.schemaVersion).toBe(PROFILE_SCHEMA_VERSION);
    expect(result.profile.tugs).toEqual([]);
    expect(result.profile.settings).toEqual(noBattle({ ...v2.settings, play: { mode: 'wait', scoreView: 'colour' }, pieces: { hidden: [] }, keyboard: SHOWN, barNumbers: NO_NUMBERS, ...V11, ...V17 }));
    expect(withoutPlay(result.profile.attempts)).toEqual(v2.attempts);
  });

  it('migrates a v1 save on to the current version: the same attempts, and the default staff settings (one line, bars chosen automatically)', () => {
    const result = parseProfile(v1, config);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.profile.schemaVersion).toBe(PROFILE_SCHEMA_VERSION);
    expect(result.profile.settings).toEqual(noBattle({ staff: { lines: 1, barsPerLine: 'auto' }, play: { mode: 'wait', scoreView: 'colour' }, pieces: { hidden: [] }, keyboard: SHOWN, barNumbers: NO_NUMBERS, ...V11, ...V17 }));
    expect(withoutPlay(result.profile.attempts)).toEqual(v1.attempts);
    expect(deriveProgress(result.profile, config).totalXp).toBe(224);
  });

  it('migrates the old v0 save by replaying it through the current rules (no longer the XP the v1 fixture stored)', () => {
    const result = parseProfile(v0, config);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.profile.schemaVersion).toBe(PROFILE_SCHEMA_VERSION);
    expect(result.profile.attempts.map((a) => [a.pieceId, a.stars, a.xp.kind, a.xp.total])).toEqual([
      ['little-steps', 3, 'first', 70], ['little-steps', 3, 'replay', 15], ['rest-waltz', 2, 'first', 64], ['rest-waltz', 3, 'improved', 65],
    ]);
    expect(deriveProgress(result.profile, config).totalXp).toBe(214); // replay 30% of the base
    expect(result.profile.attempts[2]!.result).toMatchObject({ notes: 5, firstTryCorrect: 4, mistakes: 1, hints: { noteNames: 0, fingers: 0 } });
  });

  it('applies a chain of migrations in order', () => {
    const calls: number[] = [];
    const out = migrateProfile(
      { schemaVersion: 1 },
      config,
      {
        1: (raw) => { calls.push(1); return { ...raw, a: true }; },
        2: (raw) => { calls.push(2); return { ...raw, b: true }; },
      },
      3,
    );
    expect(calls).toEqual([1, 2]);
    expect(out).toMatchObject({ schemaVersion: 3, a: true, b: true });
  });

  it('rejects a missing, malformed, newer or unmigratable version without crashing', () => {
    expect(() => migrateProfile({}, config)).toThrow(ProfileMigrationError);
    expect(() => migrateProfile({ schemaVersion: 'one' }, config)).toThrow(ProfileMigrationError);
    expect(() => migrateProfile({ schemaVersion: -1 }, config)).toThrow(ProfileMigrationError);
    expect(() => migrateProfile({ schemaVersion: 0.5 }, config)).toThrow(/invalid schemaVersion/);
    expect(() => migrateProfile({ schemaVersion: 99 }, config)).toThrow(/newer/);
    expect(() => migrateProfile({ schemaVersion: 0 }, config, {}, 1)).toThrow(/no migration/);
    for (const junk of [null, 42, 'x', [], {}, { schemaVersion: 99 }]) expect(parseProfile(junk, config).ok).toBe(false);
  });

  it('reports a malformed old save as an error instead of throwing', () => {
    const bad = parseProfile({ schemaVersion: 0, id: 'x', name: 'x', createdAt: 'now', attempts: [{ at: 'now', pieceId: 'a', notes: 4, accuracy: 7 }] }, config);
    expect(bad.ok).toBe(false);
    const broken = parseProfile({ schemaVersion: 0, attempts: 'nope' }, config);
    expect(broken.ok).toBe(false);
  });
});

describe('tug records in the profile (ft_1_21.AC9, d290)', () => {
  it('ft_1_21.AC9 a v17 record arrives with each battle record a tug record with its XP, the campaign and the battle setting gone, the input unchanged', () => {
    const before = JSON.stringify(v17);
    const once = parseProfile(v17, config);
    expect(once.ok).toBe(true);
    if (!once.ok) return;
    expect(JSON.stringify(v17)).toBe(before);
    expect(once.profile).not.toHaveProperty('battles');
    expect(once.profile).not.toHaveProperty('campaign');
    expect(once.profile.settings).not.toHaveProperty('battle');
    expect(once.profile.tugs.map((t) => [t.n, t.characterId, t.won, t.exchanges, t.xp])).toEqual(v17.battles.map((b) => [b.n, b.monsterId, b.won, b.rounds, b.xp]));
    const again = validateProfile(JSON.parse(JSON.stringify(once.profile)));
    expect(again).toEqual(once);
  });

  it('ft_1_21.AC9 the move keeps the player\'s XP: the tugs pay what the battles paid', () => {
    const once = parseProfile(v17, config);
    expect(once.ok).toBe(true);
    if (!once.ok) return;
    expect(once.profile.tugs.reduce((sum, t) => sum + t.xp, 0)).toBe(v17.battles.reduce((sum, b) => sum + b.xp, 0));
    expect(once.profile.tugs.reduce((sum, t) => sum + t.xp, 0)).toBe(30 + 4 + 30 + 38 + 5);
  });

  it('the step is frozen and leaves its input unchanged', () => {
    const input = structuredClone(v17) as Record<string, unknown>;
    expect(profileAfterRecord17(input)).toEqual(today(v17));
    expect(input).toEqual(v17);
  });

  it('a tug record out of order, with negative XP or no exchange is rejected', () => {
    const broken = (change: (tug: Record<string, unknown>) => void, index = 0) => {
      const save = structuredClone(today(v17)) as { tugs: Record<string, unknown>[] };
      change(save.tugs[index]!);
      return profileSchema.safeParse(save).success;
    };
    expect(profileSchema.safeParse(today(v17)).success).toBe(true);
    expect(broken((t) => { t.n = 5; }, 1)).toBe(false);
    expect(broken((t) => { t.xp = -1; })).toBe(false);
    expect(broken((t) => { t.exchanges = 0; })).toBe(false);
    expect(broken((t) => { delete t.characterId; })).toBe(false);
  });
});

describe('a damaged save', () => {
  const fixtures = [v0, v1, v2, v3, v4, v5, v6, v7, v8, v9, v10, v11, v12, v13, v14, v15, v16, v17] as Record<string, unknown>[];

  it('is reported, never thrown, whatever field of whatever version is broken (property)', () => {
    fc.assert(fc.property(fc.nat(fixtures.length - 1), fc.jsonValue(), fc.nat(), (index, junk, pick) => {
      const save = structuredClone(fixtures[index]!);
      const keys = Object.keys(save).filter((k) => k !== 'schemaVersion');
      save[keys[pick % keys.length]!] = junk;
      const parsed = parseProfile(save, config);
      if (!parsed.ok) expect(parsed.errors.length).toBeGreaterThan(0);
    }), { numRuns: 300 });
  });
});

describe('practice log in the save (core_10, d092, version 16)', () => {
  const barPlay = { at: '1998-10-30T10:00:00.000Z', pieceId: 'little-steps', bar: 0, notes: 4, firstTry: 3, timing: null, mode: 'wait', tempoPercent: 100, section: null, misses: [{ tick: 240, track: 'right', midi: 62 }] };

  // core_10.AC3
  it('a v15 save migrates to the current version with an empty practice log, everything else kept, and migrating twice gives the same save', () => {
    const before = JSON.stringify(v15);
    const once = parseProfile(v15, config);
    expect(once.ok).toBe(true);
    if (!once.ok) return;
    expect(JSON.stringify(v15)).toBe(before);
    expect(once.profile.schemaVersion).toBe(PROFILE_SCHEMA_VERSION);
    expect(once.profile.practice).toEqual(EMPTY_PRACTICE_LOG);
    const rest: Record<string, unknown> = { ...once.profile };
    delete rest.practice;
    delete rest.earPoints;
    delete rest.schemaVersion;
    delete rest.settings;
    delete rest.tugs;
    const oldRest: Record<string, unknown> = { ...v15 };
    delete oldRest.schemaVersion;
    delete oldRest.settings;
    delete oldRest.campaign;
    delete oldRest.battles;
    expect(rest).toEqual(oldRest);
    expect(once.profile.tugs).toEqual(toTugs(v15.battles));
    expect(once.profile.settings).toEqual(noBattle({ ...v15.settings, ...V17 }));
    const again = validateProfile(JSON.parse(JSON.stringify(once.profile)));
    expect(again).toEqual(once);
  });

  it('a profile with a valid bar play round-trips through JSON unchanged', () => {
    const save = { ...today(v17), practice: { bars: [barPlay] } };
    const result = validateProfile(JSON.parse(JSON.stringify(save)));
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.profile.practice).toEqual({ bars: [barPlay] });
  });

  it('a profile with an invalid bar play (midi 200) is rejected', () => {
    const bad = { ...today(v17), practice: { bars: [{ ...barPlay, misses: [{ tick: 240, track: 'right', midi: 200 }] }] } };
    expect(profileSchema.safeParse(bad).success).toBe(false);
    expect(parseProfile(bad, config).ok).toBe(false);
  });

  it('a profile without the practice field is rejected', () => {
    const noPractice: Record<string, unknown> = { ...today(v17) };
    delete noPractice.practice;
    expect(profileSchema.safeParse(noPractice).success).toBe(false);
  });
});
