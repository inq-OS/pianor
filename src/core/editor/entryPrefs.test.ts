import { describe, expect, it } from 'vitest';
import { DEFAULT_ENTRY_PREFS, ENTRY_PREFS_KEY, ENTRY_PREFS_VERSION, parseEntryPrefs, serializeEntryPrefs } from './entryPrefs';

describe('the piece maker entry preferences', () => {
  it('keeps its own key, outside the pianor/ player save namespace', () => {
    expect(ENTRY_PREFS_KEY).toBe('pianor-editor/entry-prefs');
    expect(ENTRY_PREFS_KEY.startsWith('pianor/')).toBe(false);
    expect(ENTRY_PREFS_VERSION).toBe(1);
  });

  it('defaults the short tap of an eighth note to off', () => {
    expect(DEFAULT_ENTRY_PREFS).toEqual({ schemaVersion: 1, shortTapEighth: false });
  });

  it('reads the default when nothing is stored', () => {
    expect(parseEntryPrefs(null)).toEqual(DEFAULT_ENTRY_PREFS);
  });

  it('reads the default when the stored text is garbage or not an object', () => {
    expect(parseEntryPrefs('{not json')).toEqual(DEFAULT_ENTRY_PREFS);
    expect(parseEntryPrefs('null')).toEqual(DEFAULT_ENTRY_PREFS);
    expect(parseEntryPrefs('42')).toEqual(DEFAULT_ENTRY_PREFS);
    expect(parseEntryPrefs('"text"')).toEqual(DEFAULT_ENTRY_PREFS);
  });

  it('reads the default for an unknown schema version', () => {
    expect(parseEntryPrefs(JSON.stringify({ schemaVersion: 2, shortTapEighth: true }))).toEqual(DEFAULT_ENTRY_PREFS);
    expect(parseEntryPrefs(JSON.stringify({ shortTapEighth: true }))).toEqual(DEFAULT_ENTRY_PREFS);
  });

  it('reads the default when a field has the wrong type', () => {
    expect(parseEntryPrefs(JSON.stringify({ schemaVersion: 1, shortTapEighth: 'yes' }))).toEqual(DEFAULT_ENTRY_PREFS);
    expect(parseEntryPrefs(JSON.stringify({ schemaVersion: 1, shortTapEighth: 1 }))).toEqual(DEFAULT_ENTRY_PREFS);
    expect(parseEntryPrefs(JSON.stringify({ schemaVersion: 1 }))).toEqual(DEFAULT_ENTRY_PREFS);
  });

  it('reads back a true setting after a roundtrip', () => {
    const prefs = { schemaVersion: 1, shortTapEighth: true } as const;
    expect(parseEntryPrefs(serializeEntryPrefs(prefs))).toEqual(prefs);
  });

  it('reads back the default after a roundtrip', () => {
    expect(parseEntryPrefs(serializeEntryPrefs(DEFAULT_ENTRY_PREFS))).toEqual(DEFAULT_ENTRY_PREFS);
  });
});
