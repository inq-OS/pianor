import { describe, expect, it } from 'vitest';
import { webPlayerLock, type LockRequester } from './playerLock';

/** The browser's lock manager, as two windows of one device share it: a held name is refused until its holder lets it go. */
function fakeLocks(): LockRequester & { held: Set<string> } {
  const held = new Set<string>();
  return {
    held,
    async request(name, _options, callback) {
      if (held.has(name)) return callback(null);
      held.add(name);
      await callback({ name });
      held.delete(name);
    },
  };
}

describe('the player lock (two tabs of one player overwrote each other)', () => {
  it('a player held by one window is refused to another until the first opens someone else', async () => {
    const locks = fakeLocks();
    const a = webPlayerLock(locks), b = webPlayerLock(locks);
    expect(await a.claim('tuvi')).toBe(true);
    expect(await a.claim('tuvi')).toBe(true);
    expect(await b.claim('tuvi')).toBe(false);
    expect(await a.claim('vint')).toBe(true);
    await Promise.resolve();
    expect(locks.held.has('pianor-player-tuvi')).toBe(false);
    expect(await b.claim('tuvi')).toBe(true);
    expect(await a.claim('tuvi')).toBe(false);
  });

  it('without the Web Locks API every claim is granted', async () => {
    expect(await webPlayerLock(undefined).claim('tuvi')).toBe(true);
  });
});
