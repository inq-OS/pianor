// Covers core_07 (WP-G3): the helps in force are kept with every attempt (profile v13, d060).
import { describe, expect, it } from 'vitest';
import progressionJson from '../../../content/curriculum/progression.json';
import v12 from '../../../tests/fixtures/saves/profile.v12.json';
import v13 from '../../../tests/fixtures/saves/profile.v13.json';
import type { PieceResult } from '../judge/types';
import type { HelpId } from './modifiers';
import { parseProgressionConfig } from './config';
import { migrateProfile, parseProfile } from './migrate';
import { PROFILE_SCHEMA_VERSION, attemptSchema, emptyProfile, profileSchema, recordAttempt } from './profile';

const config = parseProgressionConfig(progressionJson);
const NOW = new Date('1998-10-13T12:00:00.000Z');

const result: PieceResult = {
  chartId: 'little-steps', contentVersion: 1, notes: 10, firstTryCorrect: 10, mistakes: 0, accuracy: 1, rhythmErrorMs: null,
  hints: { noteNames: 0, fingers: 0 }, bothHands: { notes: 0, together: 0 },
};

describe('profile v13: the helps in force on every attempt', () => {
  it('the fixture of version 13 keeps an empty list of helps on every attempt (the current version is later)', () => {
    expect(PROFILE_SCHEMA_VERSION).toBeGreaterThanOrEqual(13);
    expect(v13.schemaVersion).toBe(13);
    expect(v13.attempts.every((a) => Array.isArray(a.helps) && a.helps.length === 0)).toBe(true);
  });

  it('migrates a v12 save to v13: every attempt gets helps: [] (full difficulty), everything else is kept, the input is not changed', () => {
    const input = JSON.parse(JSON.stringify(v12)) as typeof v12;
    const migrated = migrateProfile(input, config) as { schemaVersion: number; attempts: Record<string, unknown>[]; settings: unknown; battles: unknown };
    expect(input).toEqual(v12);
    expect(migrated.schemaVersion).toBe(PROFILE_SCHEMA_VERSION);
    expect(migrated.attempts).toHaveLength(v12.attempts.length);
    migrated.attempts.forEach((a, i) => expect(a).toEqual({ ...v12.attempts[i], helps: [] }));
    expect(migrated.settings).toEqual({ ...v12.settings, earTrainer: { seconds: 1, repeat: true } });
    expect(migrated.battles).toEqual(v12.battles);
  });

  it('migrating twice gives the same save', () => {
    const once = parseProfile(v12, config);
    expect(once.ok).toBe(true);
    if (!once.ok) return;
    const again = parseProfile(JSON.parse(JSON.stringify(once.profile)), config);
    expect(again.ok && again.profile).toEqual(once.profile);
  });

  it('an attempt requires helps, and accepts only the help ids of the modifier table', () => {
    const attempt = { ...v13.attempts[0]! };
    expect(attemptSchema.safeParse({ ...attempt, helps: ['noteNames', 'litKey'] }).success).toBe(true);
    expect(attemptSchema.safeParse({ ...attempt, helps: [] }).success).toBe(true);
    expect(attemptSchema.safeParse({ ...attempt, helps: ['sparkles'] }).success).toBe(false);
    expect(attemptSchema.safeParse({ ...attempt, helps: ['noteNames', 'noteNames'] }).success).toBe(false);
    expect(attemptSchema.safeParse({ ...attempt, helps: 'noteNames' }).success).toBe(false);
    const withoutHelps: Partial<typeof attempt> = { ...attempt };
    delete withoutHelps.helps;
    expect(attemptSchema.safeParse(withoutHelps).success).toBe(false);
  });

  it('stores the help ids, not the factor: a parsed attempt has no factor field', () => {
    const parsed = attemptSchema.safeParse({ ...v13.attempts[0], helps: ['metronome'], factor: 0.95 });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.helps).toEqual(['metronome']);
      expect('factor' in parsed.data).toBe(false);
    }
  });

  it('recordAttempt stores the helps given, and an attempt without them has none (full difficulty)', () => {
    const base = emptyProfile('p1', 'Test', '1998-10-01T00:00:00.000Z');
    const plain = recordAttempt(base, result, config, NOW);
    expect(plain.attempt.helps).toEqual([]);
    const helped = recordAttempt(base, result, config, NOW, undefined, [], ['noteNames', 'fingerNumbers']);
    expect(helped.attempt.helps).toEqual(['noteNames', 'fingerNumbers']);
    expect(profileSchema.safeParse(helped.profile).success).toBe(true);
    expect(helped.profile.attempts[0]!.helps).toEqual(['noteNames', 'fingerNumbers']);
  });

  it('the helps of an attempt are a copy: changing the argument later does not change the saved attempt', () => {
    const base = emptyProfile('p1', 'Test', '1998-10-01T00:00:00.000Z');
    const helps: HelpId[] = ['litKey'];
    const outcome = recordAttempt(base, result, config, NOW, undefined, [], helps);
    helps.push('metronome');
    expect(outcome.attempt.helps).toEqual(['litKey']);
  });
});
