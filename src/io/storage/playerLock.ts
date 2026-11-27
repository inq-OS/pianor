import type { PlayerLock } from '../../core/progression/repository';

/** The part of the browser's Web Locks API (`navigator.locks`) the player lock uses. */
export interface LockRequester {
  request(name: string, options: { ifAvailable: true }, callback: (lock: unknown) => Promise<void> | void): Promise<unknown>;
}

/**
 * One player in one window at a time, through the Web Locks API: a window holds the lock `pianor-player-<id>` while that player
 * is open in it, and the browser frees it when the window closes. A claim on another player frees the one held before. With
 * no Web Locks (an old browser) every claim is granted, as before.
 */
export function webPlayerLock(locks: LockRequester | undefined = globalThis.navigator?.locks): PlayerLock {
  let held: { id: string; release: () => void } | null = null;
  return {
    async claim(id: string): Promise<boolean> {
      if (!locks || held?.id === id) return true;
      let release = (): void => undefined;
      const holding = new Promise<void>((resolve) => { release = resolve; });
      const granted = await new Promise<boolean>((resolve) => {
        // a page whose origin is opaque (a sandboxed frame) has the API but is refused it: granted, as with no API
        locks.request(`pianor-player-${id}`, { ifAvailable: true }, (lock) => {
          resolve(lock !== null);
          return lock === null ? undefined : holding;
        }).catch(() => resolve(true));
      });
      if (!granted) return false;
      held?.release();
      held = { id, release };
      return true;
    },
  };
}
