import type { KeyValueStore } from '../../core/progression';
import { ADMIN_RECORD_KEY, DEFAULT_ADMIN_RECORD } from '../../core/admin/adminRecord';
import { ADMIN_SETTINGS_KEY, parseAdminSettings, serializeAdminSettings, type AdminSettings } from '../../core/admin/adminSettings';
import { createPasswordLock, type PasswordLock } from './passwordLock';
import type { PianoSoundKind } from '../../core/sound/pianoSound';

/** Key of the device's draft-pieces setting (`npm run start` only): present with '1' when on. Own key, outside the record. */
export const ADMIN_DRAFTS_KEY = 'pianor-admin/drafts';

/** What the game asks of the admin settings: the password lock and the device's settings. */
export interface AdminAccess extends PasswordLock {
  drafts: () => Promise<boolean>;
  setDrafts: (on: boolean) => Promise<void>;
  settings: () => Promise<AdminSettings>;
  setGradeNoteLength: (on: boolean) => Promise<void>;
  setPianoSound: (sound: PianoSoundKind) => Promise<void>;
}

/**
 * The admin settings on a store (the device's own store, outside every profile). A read that fails means the default. The
 * unlock window lives in memory only, so a reload locks again; `now` is the clock (milliseconds), injectable for tests.
 */
export function createAdminAccess(store: KeyValueStore, now: () => number = Date.now): AdminAccess {
  const readSettings = () => store.get(ADMIN_SETTINGS_KEY).catch(() => null).then(parseAdminSettings);
  return {
    ...createPasswordLock(store, ADMIN_RECORD_KEY, DEFAULT_ADMIN_RECORD, now),
    drafts: async () => (await store.get(ADMIN_DRAFTS_KEY).catch(() => null)) === '1',
    setDrafts: async (on) => {
      if (on) await store.set(ADMIN_DRAFTS_KEY, '1');
      else await store.remove(ADMIN_DRAFTS_KEY);
    },
    settings: readSettings,
    setGradeNoteLength: async (on) => {
      await store.set(ADMIN_SETTINGS_KEY, serializeAdminSettings({ ...(await readSettings()), gradeNoteLength: on }));
    },
    setPianoSound: async (sound) => {
      await store.set(ADMIN_SETTINGS_KEY, serializeAdminSettings({ ...(await readSettings()), pianoSound: sound }));
    },
  };
}
