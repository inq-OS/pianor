/**
 * The admin password record: a per-device record outside every player's profile. It holds a salt and a SHA-256
 * hash of `salt:password`, never the password itself. This is a child lock, not security:
 * the source is open, so the default password is public. Pure: the hashing itself is in `io/admin`.
 */

/** Version of the stored record; a change needs a migration step here (admin overrides would be v2). */
export const ADMIN_RECORD_VERSION = 1;

/** The key the record is stored under. Not under `pianor/`, so profile saves and their move never touch it. */
export const ADMIN_RECORD_KEY = 'pianor-admin/record';

export interface AdminRecord {
  readonly schemaVersion: typeof ADMIN_RECORD_VERSION;
  readonly salt: string;
  /** Lowercase hex SHA-256 of `salt:password`. */
  readonly hash: string;
}

/** The record a fresh device uses: the default password `pianor` until a parent changes it. */
export const DEFAULT_ADMIN_RECORD: AdminRecord = {
  schemaVersion: ADMIN_RECORD_VERSION,
  salt: 'pianor-admin-1',
  hash: '7a0b09af5b83f761e3ffca604e5dd43932a47e401eec6a631357627f7f10ccd5',
};

/** The text that is hashed for a typed password. */
export function saltedText(salt: string, password: string): string {
  return `${salt}:${password}`;
}

/** The record as stored (JSON). */
export function serializeAdminRecord(record: AdminRecord): string {
  return JSON.stringify({ schemaVersion: record.schemaVersion, salt: record.salt, hash: record.hash });
}

/**
 * Reads the stored record. A missing, broken or unknown-version record falls back to the default (`fallback`: the admin's,
 * or the teacher's for her own record, d140), so a student cannot lock the parent out by damaging it (the default password
 * still works).
 */
export function parseAdminRecord(text: string | null, fallback: AdminRecord = DEFAULT_ADMIN_RECORD): AdminRecord {
  if (text === null) return fallback;
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    return fallback;
  }
  if (typeof value !== 'object' || value === null) return fallback;
  const { schemaVersion, salt, hash } = value as Record<string, unknown>;
  if (schemaVersion !== ADMIN_RECORD_VERSION || typeof salt !== 'string' || salt === '' || typeof hash !== 'string' || hash === '') {
    return fallback;
  }
  return { schemaVersion: ADMIN_RECORD_VERSION, salt, hash };
}

/** True when `digest` of the typed password (salted) equals the stored hash. `digest` is SHA-256 hex from `io/admin`. */
export async function passwordMatches(record: AdminRecord, typed: string, digest: (text: string) => Promise<string>): Promise<boolean> {
  return (await digest(saltedText(record.salt, typed))) === record.hash;
}

/** The record for a new password, with the salt the caller picked (random in the game, fixed in tests). */
export async function makeAdminRecord(password: string, salt: string, digest: (text: string) => Promise<string>): Promise<AdminRecord> {
  return { schemaVersion: ADMIN_RECORD_VERSION, salt, hash: await digest(saltedText(salt, password)) };
}

/** Why a password change was refused, or 'ok'. Checked in this order: the old password, the blank, then the repeat. */
export type PasswordChange = 'ok' | 'wrong' | 'blank' | 'mismatch';

/** The rule for changing the password: the old one must match, the new one must not be blank, and the repeat must match it. */
export async function passwordChange(
  record: AdminRecord, oldPassword: string, next: string, repeat: string, digest: (text: string) => Promise<string>,
): Promise<PasswordChange> {
  if (!(await passwordMatches(record, oldPassword, digest))) return 'wrong';
  if (next === '') return 'blank';
  if (next !== repeat) return 'mismatch';
  return 'ok';
}
