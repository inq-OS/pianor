import { describe, expect, it } from 'vitest';
import { DEFAULT_ADMIN_RECORD, parseAdminRecord, passwordMatches } from './adminRecord';
import { DEFAULT_TEACHER_RECORD, TEACHER_RECORD_KEY } from './teacherRecord';

// the platform's SHA-256 (Web Crypto, in Node too); the game's own goes through io/admin
const sha256 = async (text: string) => Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))), (b) => b.toString(16).padStart(2, '0')).join('');

describe("the teacher's password record (d140)", () => {
  it('ft_1_26.AC1 opens with pianor by default, from a record of its own', async () => {
    expect(await passwordMatches(DEFAULT_TEACHER_RECORD, 'pianor', sha256)).toBe(true);
    expect(await passwordMatches(DEFAULT_TEACHER_RECORD, 'teacher', sha256)).toBe(false);
    expect(DEFAULT_TEACHER_RECORD.salt).not.toBe(DEFAULT_ADMIN_RECORD.salt);
  });

  it('is stored under its own key, outside the admin record and every profile', () => {
    expect(TEACHER_RECORD_KEY).not.toBe('pianor-admin/record');
    expect(TEACHER_RECORD_KEY.startsWith('pianor/')).toBe(false);
  });

  it('falls back to the default it is given when nothing usable is stored', () => {
    expect(parseAdminRecord(null, DEFAULT_TEACHER_RECORD)).toBe(DEFAULT_TEACHER_RECORD);
    expect(parseAdminRecord('{broken', DEFAULT_TEACHER_RECORD)).toBe(DEFAULT_TEACHER_RECORD);
    expect(parseAdminRecord(null)).toBe(DEFAULT_ADMIN_RECORD);
  });
});
