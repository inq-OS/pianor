import { describe, expect, it } from 'vitest';
import { MemoryStore } from '../storage/MemoryStore';
import type { KeyValueStore } from '../../core/progression';
import { DEFAULT_TEACHER_RECORD } from '../../core/admin/teacherRecord';
import { createPasswordLock } from './passwordLock';

describe('a password lock on a store (d140)', () => {
  it('falls back to its default record when the store cannot be read', async () => {
    const broken = { ...new MemoryStore(), get: () => Promise.reject(new Error('no store')) } as unknown as KeyValueStore;
    const lock = createPasswordLock(broken, 'k', DEFAULT_TEACHER_RECORD);
    expect(await lock.check('pianor')).toBe(true);
  });

  it('refuses a blank or unrepeated new password and keeps the old one', async () => {
    const lock = createPasswordLock(new MemoryStore(), 'k', DEFAULT_TEACHER_RECORD);
    expect(await lock.changePassword('pianor', '', '')).toBe('blank');
    expect(await lock.changePassword('pianor', 'a', 'b')).toBe('mismatch');
    expect(await lock.check('pianor')).toBe(true);
  });
});
