import { describe, expect, it } from 'vitest';
import { MemoryStore } from '../storage/MemoryStore';
import { ADMIN_RECORD_KEY, serializeAdminRecord } from '../../core/admin/adminRecord';
import { ADMIN_SETTINGS_KEY } from '../../core/admin/adminSettings';
import { createAdminAccess } from './adminAccess';

describe('the admin password on a store', () => {
  it('accepts the default password on a fresh device and refuses anything else', async () => {
    const access = createAdminAccess(new MemoryStore());
    expect(await access.check('pianor')).toBe(true);
    expect(await access.check('pianor2')).toBe(false);
    expect(await access.check('')).toBe(false);
  });

  it('accepts only the password of the stored record once it is changed', async () => {
    const store = new MemoryStore();
    // hash of "pianor-test:tuli" with salt "pianor-test" (computed with node's crypto)
    await store.set(ADMIN_RECORD_KEY, serializeAdminRecord({ schemaVersion: 1, salt: 'pianor-test', hash: await hashOf('pianor-test:tuli') }));
    const access = createAdminAccess(store);
    expect(await access.check('tuli')).toBe(true);
    expect(await access.check('pianor')).toBe(false);
  });
});

async function hashOf(text: string): Promise<string> {
  const { sha256Hex } = await import('./sha256');
  return sha256Hex(text);
}

describe('the admin settings on a store', () => {
  it('changes the password for the next check, and keeps the old one out', async () => {
    const access = createAdminAccess(new MemoryStore());
    expect(await access.changePassword('pianor', 'uus', 'uus')).toBe('ok');
    expect(await access.check('uus')).toBe(true);
    expect(await access.check('pianor')).toBe(false);
  });

  it('refuses a change with the old password wrong, and changes nothing', async () => {
    const access = createAdminAccess(new MemoryStore());
    expect(await access.changePassword('vale', 'uus', 'uus')).toBe('wrong');
    expect(await access.check('pianor')).toBe(true);
  });

  it('keeps the draft-pieces setting off until it is turned on', async () => {
    const access = createAdminAccess(new MemoryStore());
    expect(await access.drafts()).toBe(false);
    await access.setDrafts(true);
    expect(await access.drafts()).toBe(true);
    await access.setDrafts(false);
    expect(await access.drafts()).toBe(false);
  });
});

describe('the grade-note-length switch on a store (core_01.AC9)', () => {
  it('core_01.AC9: is on on a fresh device, and off once turned off', async () => {
    const access = createAdminAccess(new MemoryStore());
    expect(await access.settings()).toEqual({ gradeNoteLength: true, pianoSound: 'full' });
    await access.setGradeNoteLength(false);
    expect(await access.settings()).toEqual({ gradeNoteLength: false, pianoSound: 'full' });
    await access.setGradeNoteLength(true);
    expect(await access.settings()).toEqual({ gradeNoteLength: true, pianoSound: 'full' });
  });

  it('core_01.AC9: keeps its own record and leaves the password record alone', async () => {
    const store = new MemoryStore();
    await store.set(ADMIN_RECORD_KEY, 'the record');
    await createAdminAccess(store).setGradeNoteLength(false);
    expect(await store.get(ADMIN_RECORD_KEY)).toBe('the record');
    expect(JSON.parse((await store.get(ADMIN_SETTINGS_KEY))!)).toEqual({ schemaVersion: 1, gradeNoteLength: false, pianoSound: 'full' });
  });

  it('core_01.AC9: a store that cannot be read means on', async () => {
    const store = new MemoryStore();
    store.get = () => Promise.reject(new Error('blocked'));
    expect(await createAdminAccess(store).settings()).toEqual({ gradeNoteLength: true, pianoSound: 'full' });
  });
});

describe('the admin unlock window (ft_1_07.AC8)', () => {
  it('ft_1_07.AC8 starts locked; the right password opens it for 30 minutes, a wrong one does not', async () => {
    let clock = 0;
    const access = createAdminAccess(new MemoryStore(), () => clock);
    expect(access.unlockedFor()).toBe(0);
    expect(await access.check('vale')).toBe(false);
    expect(access.unlockedFor()).toBe(0);
    expect(await access.check('pianor')).toBe(true);
    expect(access.unlockedFor()).toBe(30 * 60 * 1000);
    clock = 30 * 60 * 1000 - 1;
    expect(access.unlockedFor()).toBe(1);
    clock = 30 * 60 * 1000;
    expect(access.unlockedFor()).toBe(0);
  });

  it('ft_1_07.AC8 locks at once by hand', async () => {
    const access = createAdminAccess(new MemoryStore(), () => 0);
    await access.check('pianor');
    access.lock();
    expect(access.unlockedFor()).toBe(0);
  });
});

describe('the piano sound switch on a store (ft_0_07.AC3)', () => {
  it('ft_0_07.AC3 is the full piano on a fresh device, light once chosen, and leaves the note-length switch alone', async () => {
    const access = createAdminAccess(new MemoryStore());
    await access.setGradeNoteLength(false);
    await access.setPianoSound('light');
    expect(await access.settings()).toEqual({ gradeNoteLength: false, pianoSound: 'light' });
    await access.setPianoSound('full');
    expect((await access.settings()).pianoSound).toBe('full');
  });
});
