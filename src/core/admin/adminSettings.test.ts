// Covers core_01.AC9.
import { describe, expect, it } from 'vitest';
import {
  ADMIN_SETTINGS_KEY,
  ADMIN_SETTINGS_SCHEMA_VERSION,
  DEFAULT_ADMIN_SETTINGS,
  parseAdminSettings,
  serializeAdminSettings,
} from './adminSettings';

describe('the admin settings record', () => {
  it('stores the settings under their own key, with schema version 1', () => {
    expect(ADMIN_SETTINGS_KEY).toBe('pianor-admin/settings');
    expect(ADMIN_SETTINGS_SCHEMA_VERSION).toBe(1);
  });

  it('has grade note length on by default', () => {
    expect(DEFAULT_ADMIN_SETTINGS).toEqual({ gradeNoteLength: true, pianoSound: 'full' });
  });

  it('falls back to the defaults when nothing is stored', () => {
    expect(parseAdminSettings(null)).toEqual({ gradeNoteLength: true, pianoSound: 'full' });
  });

  it('falls back to the defaults on invalid JSON, without throwing', () => {
    expect(parseAdminSettings('{not json')).toEqual(DEFAULT_ADMIN_SETTINGS);
  });

  it('falls back to the defaults on a wrong shape', () => {
    expect(parseAdminSettings('null')).toEqual(DEFAULT_ADMIN_SETTINGS);
    expect(parseAdminSettings('"text"')).toEqual(DEFAULT_ADMIN_SETTINGS);
    expect(parseAdminSettings('[1,2]')).toEqual(DEFAULT_ADMIN_SETTINGS);
    expect(parseAdminSettings(JSON.stringify({ schemaVersion: 1, gradeNoteLength: 'yes' }))).toEqual(DEFAULT_ADMIN_SETTINGS);
  });

  it('falls back to the defaults on another schema version', () => {
    expect(parseAdminSettings(JSON.stringify({ schemaVersion: 2, gradeNoteLength: false }))).toEqual(DEFAULT_ADMIN_SETTINGS);
    expect(parseAdminSettings(JSON.stringify({ gradeNoteLength: false }))).toEqual(DEFAULT_ADMIN_SETTINGS);
  });

  it('gives the default for a missing gradeNoteLength field', () => {
    expect(parseAdminSettings(JSON.stringify({ schemaVersion: 1 }))).toEqual({ gradeNoteLength: true, pianoSound: 'full' });
  });

  it('reads a stored off switch as off', () => {
    expect(parseAdminSettings(JSON.stringify({ schemaVersion: 1, gradeNoteLength: false }))).toEqual({ gradeNoteLength: false, pianoSound: 'full' });
  });

  it('serializes with schemaVersion 1', () => {
    expect(JSON.parse(serializeAdminSettings({ gradeNoteLength: false, pianoSound: 'light' }))).toEqual({ schemaVersion: 1, gradeNoteLength: false, pianoSound: 'light' });
  });

  it('round-trips serialize then parse for both values', () => {
    for (const gradeNoteLength of [true, false]) {
      for (const pianoSound of ['full', 'light', 'keyboard'] as const) {
        expect(parseAdminSettings(serializeAdminSettings({ gradeNoteLength, pianoSound }))).toEqual({ gradeNoteLength, pianoSound });
      }
    }
  });

  it('returns a copy of the defaults, so a caller cannot change them', () => {
    const settings = parseAdminSettings(null);
    settings.gradeNoteLength = false;
    expect(DEFAULT_ADMIN_SETTINGS.gradeNoteLength).toBe(true);
  });

  it('ft_0_07.AC3 keeps the piano sound, and reads a record from before it existed, or with an unknown sound, as the full piano', () => {
    expect(parseAdminSettings(JSON.stringify({ schemaVersion: 1, gradeNoteLength: false, pianoSound: 'light' }))).toEqual({ gradeNoteLength: false, pianoSound: 'light' });
    expect(parseAdminSettings(JSON.stringify({ schemaVersion: 1, gradeNoteLength: false })).pianoSound).toBe('full');
    expect(parseAdminSettings(JSON.stringify({ schemaVersion: 1, pianoSound: 'loud' }))).toEqual(DEFAULT_ADMIN_SETTINGS);
  });
});
