// Covers core_01.AC5: per-note timing kept in the attempt history (slice e, profile v12, d059).
import { describe, expect, it } from 'vitest';
import progressionJson from '../../../content/curriculum/progression.json';
import v11 from '../../../tests/fixtures/saves/profile.v11.json';
import { parseProgressionConfig } from './config';
import { migrateProfile, parseProfile } from './migrate';
import { PROFILE_SCHEMA_VERSION, attemptSchema, noteTimingSchema } from './profile';

const config = parseProgressionConfig(progressionJson);

describe('profile v12: per-note timing on every attempt', () => {
  it('is version 13 or later (v12 added the list; v13 adds helps, d060)', () => {
    expect(PROFILE_SCHEMA_VERSION).toBeGreaterThanOrEqual(12);
  });

  it('migrates a v11 save to v12: every attempt gets an empty noteTimings list, everything else is kept, the input is not changed', () => {
    const input = JSON.parse(JSON.stringify(v11)) as typeof v11;
    const migrated = migrateProfile(input, config) as { schemaVersion: number; attempts: Record<string, unknown>[]; settings: unknown; battles: unknown };
    expect(input).toEqual(v11);
    expect(migrated.schemaVersion).toBe(PROFILE_SCHEMA_VERSION);
    expect(migrated.attempts).toHaveLength(v11.attempts.length);
    migrated.attempts.forEach((a, i) => expect(a).toEqual({ ...v11.attempts[i], noteTimings: [], helps: [] }));
    expect(migrated.settings).toEqual({ ...v11.settings, earTrainer: { seconds: 1, repeat: true } });
    expect(migrated.battles).toEqual(v11.battles);
    const parsed = parseProfile(v11, config);
    expect(parsed.ok && parsed.profile.attempts.every((a) => a.noteTimings.length === 0)).toBe(true);
  });

  it('the attempt record keeps one entry per note: its index and its timing score, or null for a missed note', () => {
    const attempt = { ...v11.attempts[0], noteTimings: [{ note: 0, score: 100 }, { note: 1, score: 62 }, { note: 2, score: null }], helps: [] };
    const ok = attemptSchema.safeParse(attempt);
    expect(ok.success).toBe(true);
    if (ok.success) expect(ok.data.noteTimings).toEqual(attempt.noteTimings);
    for (const bad of [[{ note: -1, score: 5 }], [{ note: 0, score: 101 }], [{ note: 0.5, score: 5 }], [{ note: 0 }]]) {
      expect(attemptSchema.safeParse({ ...attempt, noteTimings: bad }).success).toBe(false);
    }
    expect(attemptSchema.safeParse({ ...v11.attempts[0], helps: [] }).success).toBe(false); // the list is required from v12 on
  });
});

describe('noteTiming hold (core_01 slice f, d093)', () => {
  it('parses a note timing with a hold', () => {
    const ok = noteTimingSchema.safeParse({ note: 2, score: 80, hold: 60 });
    expect(ok.success).toBe(true);
    if (ok.success) expect(ok.data.hold).toBe(60);
  });

  it('parses a note timing without a hold, from an older save, and adds no hold key', () => {
    const ok = noteTimingSchema.safeParse({ note: 2, score: 80 });
    expect(ok.success).toBe(true);
    if (ok.success) expect('hold' in ok.data).toBe(false);
  });

  it('rejects a hold above 100 or below 0', () => {
    expect(noteTimingSchema.safeParse({ note: 2, score: 80, hold: 101 }).success).toBe(false);
    expect(noteTimingSchema.safeParse({ note: 2, score: 80, hold: -1 }).success).toBe(false);
  });
});
