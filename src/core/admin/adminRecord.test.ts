import { describe, expect, it } from 'vitest';
import { ADMIN_RECORD_VERSION, DEFAULT_ADMIN_RECORD, makeAdminRecord, parseAdminRecord, passwordChange, passwordMatches, saltedText, serializeAdminRecord } from './adminRecord';

// A stand-in digest: the real SHA-256 is in io/admin; the record logic only compares strings.
const fakeDigest = async (text: string) => `d:${text}`;

describe('the admin password record', () => {
  it('falls back to the default record when nothing is stored', () => {
    expect(parseAdminRecord(null)).toEqual(DEFAULT_ADMIN_RECORD);
  });

  it('falls back to the default when the stored text is broken, of another version or incomplete', () => {
    expect(parseAdminRecord('{not json')).toEqual(DEFAULT_ADMIN_RECORD);
    expect(parseAdminRecord('null')).toEqual(DEFAULT_ADMIN_RECORD);
    expect(parseAdminRecord(JSON.stringify({ schemaVersion: 2, salt: 's', hash: 'h' }))).toEqual(DEFAULT_ADMIN_RECORD);
    expect(parseAdminRecord(JSON.stringify({ schemaVersion: 1, salt: '', hash: 'h' }))).toEqual(DEFAULT_ADMIN_RECORD);
    expect(parseAdminRecord(JSON.stringify({ schemaVersion: 1, salt: 's' }))).toEqual(DEFAULT_ADMIN_RECORD);
  });

  it('reads back what it stored, and never keeps a plain-text password', () => {
    const record = { schemaVersion: ADMIN_RECORD_VERSION, salt: 'abc', hash: 'h1' } as const;
    const text = serializeAdminRecord(record);
    expect(parseAdminRecord(text)).toEqual(record);
    expect(text).not.toContain('pianor');
  });

  it('salts the typed password with the record salt', () => {
    expect(saltedText('pepper', 'secret')).toBe('pepper:secret');
  });

  it('accepts the default password only, and only through its hash', async () => {
    const record = { schemaVersion: ADMIN_RECORD_VERSION, salt: 'pepper', hash: 'd:pepper:secret' } as const;
    expect(await passwordMatches(record, 'secret', fakeDigest)).toBe(true);
    expect(await passwordMatches(record, 'wrong', fakeDigest)).toBe(false);
    expect(await passwordMatches(record, '', fakeDigest)).toBe(false);
  });
});

describe('changing the admin password', () => {
  const record = { schemaVersion: ADMIN_RECORD_VERSION, salt: 'pepper', hash: 'd:pepper:secret' } as const;

  it('makes a record whose hash is the salted password', async () => {
    expect(await makeAdminRecord('tuli', 'salt2', fakeDigest)).toEqual({ schemaVersion: 1, salt: 'salt2', hash: 'd:salt2:tuli' });
  });

  it('refuses a wrong old password first, then a blank new one, then a repeat that does not match', async () => {
    expect(await passwordChange(record, 'nope', 'a', 'a', fakeDigest)).toBe('wrong');
    expect(await passwordChange(record, 'secret', '', '', fakeDigest)).toBe('blank');
    expect(await passwordChange(record, 'secret', 'a', 'b', fakeDigest)).toBe('mismatch');
    expect(await passwordChange(record, 'secret', 'a', 'a', fakeDigest)).toBe('ok');
  });
});
