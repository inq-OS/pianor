// Covers ft_1_07.AC8.
import { describe, expect, it } from 'vitest';
import { ADMIN_UNLOCK_MS, lockRemaining, unlockUntil } from './adminLock';

describe('the admin unlock window (ft_1_07.AC8)', () => {
  it('ft_1_07.AC8 the right password opens the admin features for 30 minutes', () => {
    expect(ADMIN_UNLOCK_MS).toBe(30 * 60 * 1000);
    const until = unlockUntil(1000);
    expect(lockRemaining(until, 1000)).toBe(ADMIN_UNLOCK_MS);
    expect(lockRemaining(until, 1000 + ADMIN_UNLOCK_MS - 1)).toBe(1);
  });

  it('ft_1_07.AC8 is locked once the 30 minutes are over, and before any password', () => {
    const until = unlockUntil(0);
    expect(lockRemaining(until, ADMIN_UNLOCK_MS)).toBe(0);
    expect(lockRemaining(until, ADMIN_UNLOCK_MS + 5)).toBe(0);
    expect(lockRemaining(null, 0)).toBe(0);
  });
});
