import { ADMIN_RECORD_VERSION, type AdminRecord } from './adminRecord';

/**
 * The teacher's own password record (ft_1_26.AC1, d140): the same salted SHA-256 record as the admin's (d082), stored under a
 * key of its own, so the teacher's password and the admin page's are separate. A child lock, not security: the default is
 * public. Pure: the hashing is in `io/admin`.
 */

/** The key the teacher's record is stored under: outside `pianor/`, so profile saves and their move never touch it. */
export const TEACHER_RECORD_KEY = 'pianor-teacher/record';

/** The default password: public, a child lock. The demo opens the teacher's screen with it. */
export const DEFAULT_TEACHER_PASSWORD = 'pianor';

/** The record a fresh device uses: the default password `pianor`, the same word as the admin default but a record of its own, until the teacher changes it. */
export const DEFAULT_TEACHER_RECORD: AdminRecord = {
  schemaVersion: ADMIN_RECORD_VERSION,
  salt: 'pianor-teacher-1',
  hash: '0995b2c1ae85df1c8edd424d5eeb665b6687a2a4d73175dd1c3026236c7c0409',
};
