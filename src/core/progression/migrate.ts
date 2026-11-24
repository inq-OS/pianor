import { starsFor } from '../scoring/stars';
import { formatIssues } from '../issues';
import { upgradeToCurrent } from '../upgrade';
import type { ProgressionConfig } from './config';
import { PROFILE_SCHEMA_VERSION, profileSchema, type Attempt, type ProfileData } from './profile';
import { computeXp } from './xp';

type Raw = Record<string, unknown>;
export type ProfileMigration = (raw: Raw, config: ProgressionConfig) => Raw;

export class ProfileMigrationError extends Error {}

// Every step writes the values that were the default when its version was made, as literals here (d064). It never reads
// today's defaults (`DEFAULT_PROFILE_SETTINGS` and the settings it is made of) or a function that builds them, so changing a
// default later changes new players only and never what an old save loads as. The golden tests in migrate.golden.test.ts
// freeze each step's output.

/**
 * Version 0 (before saves kept the XP breakdown) logged only what was played:
 * `{ schemaVersion: 0, id, name, createdAt, attempts: [{ at, pieceId, contentVersion, notes, accuracy, mistakes }] }`.
 * Version 1 stores the awarded XP, so the migration replays the old attempts once through the rules it is given, in order. This
 * is the one step that depends on more than the save: version 0 kept no XP to copy (d064).
 */
const v0ToV1: ProfileMigration = (raw, config) => {
  const legacy = raw as {
    attempts?: { at: string; pieceId: string; contentVersion?: number; notes: number; accuracy: number; mistakes?: number }[];
  };
  const history = new Map<string, { completions: number; bestStars: 0 | 1 | 2 | 3 }>();
  const attempts: Omit<Attempt, 'noteTimings' | 'helps'>[] = (legacy.attempts ?? []).map((old, i) => {
    const result = {
      chartId: old.pieceId,
      contentVersion: old.contentVersion ?? 1,
      notes: old.notes,
      firstTryCorrect: Math.round(old.accuracy * old.notes),
      mistakes: old.mistakes ?? 0,
      accuracy: old.accuracy,
      rhythmErrorMs: null,
      hints: { noteNames: 0, fingers: 0 },
      bothHands: { notes: 0, together: 0 },
    };
    const previous = history.get(old.pieceId) ?? { completions: 0, bestStars: 0 as const };
    const stars = starsFor(old.accuracy);
    const xp = computeXp(result, previous, config);
    history.set(old.pieceId, { completions: previous.completions + 1, bestStars: Math.max(previous.bestStars, stars) as 1 | 2 | 3 });
    return { n: i + 1, at: old.at, pieceId: old.pieceId, contentVersion: result.contentVersion, stars, result, play: { mode: 'wait', tempoPercent: 100 }, xp };
  });
  return { ...raw, schemaVersion: 1, attempts };
};

/**
 * Version 2 adds the player's settings, which then held only the staff; a version 1 save gets the defaults of that time: one
 * line of staff, bars chosen automatically. The later blocks come with the versions that added them.
 */
const v1ToV2: ProfileMigration = (raw) => ({ ...raw, schemaVersion: 2, settings: { staff: { lines: 1, barsPerLine: 'auto' } } });

/** Version 3 adds the log of battles (battle prototype); a version 2 save has none. */
const v2ToV3: ProfileMigration = (raw) => ({ ...raw, schemaVersion: 3, battles: [] });

/** Version 4 adds how the player likes to play (tempo mode): Wait mode, and the Tempo-mode score view; a version 3 save gets the defaults. */
const v3ToV4: ProfileMigration = (raw) => {
  const settings = (raw.settings ?? {}) as Record<string, unknown>;
  return { ...raw, schemaVersion: 4, settings: { ...settings, play: { mode: 'wait', scoreView: 'colour' } } };
};

/** Version 5 records how each piece was played (core_04): every older attempt was Wait mode at the written tempo, and has no timing. */
const v4ToV5: ProfileMigration = (raw) => {
  const attempts = ((raw.attempts ?? []) as Record<string, unknown>[]).map((a) => ({ ...a, play: { mode: 'wait', tempoPercent: 100 } }));
  return { ...raw, schemaVersion: 5, attempts };
};

/** Version 6 adds the pieces a player has turned off (ft_1_02c); a version 5 save has none off, so every piece stays on. */
const v5ToV6: ProfileMigration = (raw) => {
  const settings = (raw.settings ?? {}) as Record<string, unknown>;
  return { ...raw, schemaVersion: 6, settings: { ...settings, pieces: { hidden: [] } } };
};

/**
 * Version 7 replaces a battle's `heartsLeft` with the player's health: `playerHpLeft` and `playerMaxHp`. The
 * old fight had five hearts, so `heartsLeft` of 5 becomes the full new maximum (100 in the battle rules of version 2) and 0
 * stays 0. The numbers are fixed here, not read from the battle rules: a migration must give the same answer forever
 * and `core/progression` does not import content.
 */
export const V6_BATTLE_HEARTS = 5;
export const V7_BATTLE_PLAYER_MAX_HP = 100;

const v6ToV7: ProfileMigration = (raw) => {
  const battles = Array.isArray(raw.battles) ? (raw.battles as Raw[]) : [];
  return {
    ...raw,
    schemaVersion: 7,
    battles: battles.map((old) => {
      const { heartsLeft, ...kept } = old;
      const hearts = typeof heartsLeft === 'number' ? Math.min(V6_BATTLE_HEARTS, Math.max(0, heartsLeft)) : 0;
      return { ...kept, playerHpLeft: Math.round((hearts / V6_BATTLE_HEARTS) * V7_BATTLE_PLAYER_MAX_HP), playerMaxHp: V7_BATTLE_PLAYER_MAX_HP };
    }),
  };
};

/**
 * Version 8 adds how many monsters a player fights: a save of the version before has no choice yet, so every player
 * stays on One monster, the fight they know. Everything else is kept. The version number is this one constant: renumber it
 * here if another version lands first.
 */
export const BATTLE_SETTINGS_SINCE = 8;

const v7ToV8: ProfileMigration = (raw) => {
  const settings = (raw.settings ?? {}) as Record<string, unknown>;
  return { ...raw, schemaVersion: BATTLE_SETTINGS_SINCE, settings: { ...settings, battle: { fights: 'one' } } };
};

/**
 * Version 9 (ft_Y_12) adds whether the on-screen piano is shown on the practice screen; a save of the version before has never
 * hidden it, so every player keeps the keys on screen. Everything else is kept.
 */
export const KEYBOARD_SETTINGS_SINCE = 9;

const v8ToV9: ProfileMigration = (raw) => {
  const settings = (raw.settings ?? {}) as Record<string, unknown>;
  return { ...raw, schemaVersion: KEYBOARD_SETTINGS_SINCE, settings: { ...settings, keyboard: { onScreen: true } } };
};

/**
 * Version 10 adds which bars of the staff carry a number; a save of the version before never showed any, so every player
 * keeps the staff as it was (off). Everything else is kept.
 */
export const BAR_NUMBER_SETTINGS_SINCE = 10;

const v9ToV10: ProfileMigration = (raw) => {
  const settings = (raw.settings ?? {}) as Record<string, unknown>;
  return { ...raw, schemaVersion: BAR_NUMBER_SETTINGS_SINCE, settings: { ...settings, barNumbers: { mode: 'off' } } };
};

/**
 * Version 11 (ft_0_17, ft_Y_06, ft_0_16; d058) adds the letter names (B), the staff spacing (wide) and the key lights (off);
 * a save of the version before had none of them, so every player keeps the game as it was. The values are fixed here, not
 * read from the defaults: a migration must give the same answer forever. Everything else is kept.
 */
export const V11_SETTINGS_SINCE = 11;

const v10ToV11: ProfileMigration = (raw) => {
  const settings = (raw.settings ?? {}) as Record<string, unknown>;
  return { ...raw, schemaVersion: V11_SETTINGS_SINCE, settings: { ...settings, noteNaming: 'B', staffGap: 'wide', keyLights: { enabled: false, afterWrong: 0 } } };
};

/**
 * Version 12 (core_01e; d059) keeps the timing of each note in every attempt. An older attempt had none, so it gets an empty
 * list. Everything else is kept and the input is not changed.
 */
export const NOTE_TIMINGS_SINCE = 12;

const v11ToV12: ProfileMigration = (raw) => {
  const attempts = Array.isArray(raw.attempts) ? (raw.attempts as Record<string, unknown>[]) : [];
  return { ...raw, schemaVersion: NOTE_TIMINGS_SINCE, attempts: attempts.map((a) => ({ ...a, noteTimings: [] })) };
};

/**
 * Version 13 (core_07, WP-G3; d060) records the helps in force with every attempt. An older attempt was played at full
 * difficulty (no helps existed), so it gets an empty list. Everything else is kept and the input is not changed.
 */
export const HELPS_SINCE = 13;

const v12ToV13: ProfileMigration = (raw) => {
  const attempts = Array.isArray(raw.attempts) ? (raw.attempts as Record<string, unknown>[]) : [];
  return { ...raw, schemaVersion: HELPS_SINCE, attempts: attempts.map((a) => ({ ...a, helps: [] })) };
};

/**
 * Version 14 adds the monster campaign, started as a new player started it then: only the first monster
 * unlocked, nothing beaten, no door open, every monster in phase 1 (find the key). Written out here, not built by `startCampaign`. The number of monsters is fixed here (the ladder had four), not read from the content: a
 * migration must give the same answer forever. A longer ladder needs its own migration.
 */
export const CAMPAIGN_SINCE = 14;
export const V14_CAMPAIGN_MONSTERS = 4;

const v13ToV14: ProfileMigration = (raw) => ({
  ...raw,
  schemaVersion: CAMPAIGN_SINCE,
  campaign: {
    unlocked: Array.from({ length: V14_CAMPAIGN_MONSTERS }, (_, i) => i === 0),
    beaten: Array.from({ length: V14_CAMPAIGN_MONSTERS }, () => [false, false, false]),
    doorOpen: new Array<boolean>(V14_CAMPAIGN_MONSTERS).fill(false),
    phase: new Array<string>(V14_CAMPAIGN_MONSTERS).fill('find-key'),
  },
});

/** Version 15 (ft_0_17, AC3; d083) adds `trainerXp`, the note-name trainer's XP. A save before it had none. */
export const TRAINER_XP_SINCE = 15;

const v14ToV15: ProfileMigration = (raw) => ({ ...raw, schemaVersion: TRAINER_XP_SINCE, trainerXp: 0 });

/** Version 16 (core_10, d092) adds `practice`, the log of every bar played. A save before it had no plays logged. */
export const PRACTICE_SINCE = 16;

const v15ToV16: ProfileMigration = (raw) => ({ ...raw, schemaVersion: PRACTICE_SINCE, practice: { bars: [] } });

/** Version 17 (ft_1_10, slice B; d069) adds `earPoints` (the pitch trainer by ear's points) and `settings.earTrainer`. A save before it had neither: 0 points, one second, repeat on (frozen literals, d064). */
export const EAR_TRAINER_SINCE = 17;

const v16ToV17: ProfileMigration = (raw) => {
  const settings = raw.settings as Record<string, unknown>;
  return { ...raw, schemaVersion: EAR_TRAINER_SINCE, earPoints: 0, settings: { ...settings, earTrainer: { seconds: 1, repeat: true } } };
};

/**
 * The profile after the last record version (17), in the shape the game holds now (d290, core_11.AC5: a change after the
 * split is a step of the profile document, `profileDocument` version 2, and this is that step): each battle record becomes a
 * tug record with its number, time, piece, outcome, potential XP and XP kept, the monster or character as `characterId` and
 * its rounds as `exchanges`; the HP numbers go. The old campaign and `settings.battle` are dropped: they held no XP. Written
 * out here, frozen (d064). The input is not changed.
 */
export function profileAfterRecord17(raw: Raw): Raw {
  const rest: Raw = { ...raw };
  delete rest.battles;
  delete rest.campaign;
  const settings: Raw = { ...(raw.settings as Raw) };
  delete settings.battle;
  // a profile already in today's shape keeps its tugs, so the step can run twice
  const tugs = Array.isArray(raw.battles)
    ? (raw.battles as Raw[]).map((b) => ({ n: b.n, at: b.at, characterId: b.monsterId, pieceId: b.pieceId, won: b.won, potentialXp: b.potentialXp, exchanges: b.rounds, xp: b.xp }))
    : Array.isArray(raw.tugs) ? raw.tugs : [];
  return { ...rest, settings, tugs };
}

export const profileMigrations: Record<number, ProfileMigration> = { 0: v0ToV1, 1: v1ToV2, 2: v2ToV3, 3: v3ToV4, 4: v4ToV5, 5: v5ToV6, 6: v6ToV7, 7: v7ToV8, 8: v8ToV9, 9: v9ToV10, 10: v10ToV11, 11: v11ToV12, 12: v12ToV13, 13: v13ToV14, 14: v14ToV15, 15: v15ToV16, 16: v16ToV17 };

/** Bring a saved profile of any known version up to the current one. Throws `ProfileMigrationError` for unknown versions. */
export function migrateProfile(
  raw: unknown,
  config: ProgressionConfig,
  migrations: Record<number, ProfileMigration> = profileMigrations,
  current: number = PROFILE_SCHEMA_VERSION,
): Raw {
  return upgradeToCurrent(raw, (version) => {
    const step = migrations[version];
    return step && ((doc) => step(doc, config));
  }, current, {
    noVersion: 'save has no schemaVersion',
    newer: (version, understood) => `save version ${version} is newer than this game understands (${understood})`,
    noStep: (version) => `no migration from save version ${version}`,
  }, (message) => new ProfileMigrationError(message));
}

export type ParsedProfile = { ok: true; profile: ProfileData } | { ok: false; errors: string[] };

/**
 * Migrate an old profile record (the single save of before the split, an old export) to version 17, bring it to today's
 * shape (`profileAfterRecord17`) and validate. Never throws on bad data: returns readable errors.
 */
export function parseProfile(raw: unknown, config: ProgressionConfig): ParsedProfile {
  let migrated: Raw;
  try {
    migrated = profileAfterRecord17(migrateProfile(raw, config));
  } catch (e) {
    return { ok: false, errors: [e instanceof ProfileMigrationError ? e.message : `could not migrate: ${String(e)}`] };
  }
  return validateProfile(migrated);
}

/** Validate a profile already in today's shape (the profile document's value). Never throws: returns readable errors. */
export function validateProfile(value: unknown): ParsedProfile {
  const result = profileSchema.safeParse(value);
  if (result.success) return { ok: true, profile: result.data };
  return { ok: false, errors: formatIssues(result.error) };
}
