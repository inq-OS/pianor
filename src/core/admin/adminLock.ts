import { MS_PER_MINUTE } from '../chart';
/**
 * How long the admin features stay open after the right password (ft_1_07.AC8). The window starts at the password and is not
 * extended by use; a manual lock ends it early. Kept in memory only, so a reload locks again. Pure: the caller gives the time.
 */

/** Thirty minutes, in milliseconds. */
export const ADMIN_UNLOCK_MS = 30 * MS_PER_MINUTE;

/** The moment the window opened at `now` closes. */
export function unlockUntil(now: number): number {
  return now + ADMIN_UNLOCK_MS;
}

/** Milliseconds left in the window (0 when locked: never opened, locked by hand, or over). */
export function lockRemaining(until: number | null, now: number): number {
  return until === null ? 0 : Math.max(0, until - now);
}
