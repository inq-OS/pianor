import type { KeyValueStore } from '../../core/progression';
import { makeAdminRecord, parseAdminRecord, passwordChange, passwordMatches, serializeAdminRecord, type AdminRecord, type PasswordChange } from '../../core/admin/adminRecord';
import { lockRemaining, unlockUntil } from '../../core/admin/adminLock';
import { sha256Hex } from './sha256';

/** A password-locked area: the admin page or the teacher's screen (d140). Scenes get only this, never the stored record. */
export interface PasswordLock {
  /** Checks the password; the right one opens the area for 30 minutes (ft_1_07.AC8). */
  check: (typed: string) => Promise<boolean>;
  /** Milliseconds the area stays open; 0 when locked. */
  unlockedFor: () => number;
  /** Locks the area now (the lock button). */
  lock: () => void;
  changePassword: (oldPassword: string, next: string, repeat: string) => Promise<PasswordChange>;
}

/** A new random salt, as hex. */
function newSalt(): string {
  return Array.from(crypto.getRandomValues(new Uint8Array(16)), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

/**
 * The password record stored under `key` (the default record `fallback` until it is changed). A read that fails means the
 * default. The unlock window lives in memory only, so a reload locks again; `now` is the clock (milliseconds), injectable for tests.
 */
export function createPasswordLock(store: KeyValueStore, key: string, fallback: AdminRecord, now: () => number = Date.now): PasswordLock {
  let until: number | null = null;
  const record = () => store.get(key).catch(() => null).then((text) => parseAdminRecord(text, fallback));
  return {
    check: async (typed) => {
      const ok = await passwordMatches(await record(), typed, sha256Hex);
      if (ok) until = unlockUntil(now());
      return ok;
    },
    unlockedFor: () => lockRemaining(until, now()),
    lock: () => {
      until = null;
    },
    changePassword: async (oldPassword, next, repeat) => {
      const change = await passwordChange(await record(), oldPassword, next, repeat, sha256Hex);
      if (change === 'ok') await store.set(key, serializeAdminRecord(await makeAdminRecord(next, newSalt(), sha256Hex)));
      return change;
    },
  };
}
