import { describe, expect, it } from 'vitest';
import type { KeyValueStore } from '../../src/core/progression';
import { chooseSaveStore } from '../../src/io/storage/chooseSaveStore';
import { MemoryStore } from '../../src/io/storage/MemoryStore';

const PROFILE = 'pianor/v1/profile/p1';

/** A store whose `remove` always fails, as when the browser refuses to clear an old key. */
class StickyRemove extends MemoryStore {
  override async remove(): Promise<void> {
    throw new Error('SecurityError');
  }
}

const idbDown = async (): Promise<KeyValueStore> => {
  throw new Error('IndexedDB open failed');
};

describe('chooseSaveStore', () => {
  it('after the move, a session that falls back to IndexedDB-down keeps its progress out of localStorage', async () => {
    const local = new MemoryStore();
    await local.set(PROFILE, '{"xp":12}');
    const idb = new MemoryStore();

    // Start 1: IndexedDB works, the one-time move runs.
    const first = await chooseSaveStore({ openIdb: async () => idb, local });
    expect(first.store).toBe(idb);
    await first.store.set(PROFILE, '{"xp":30}');

    // Start 2: IndexedDB refuses to open. The session must not write into localStorage,
    // because start 3 reads IndexedDB and would never see those writes.
    const second = await chooseSaveStore({ openIdb: idbDown, local });
    expect(second.store).not.toBe(local);
    expect(second.persistent).toBe(false);
    await second.store.set(PROFILE, '{"xp":40}');
    expect(await local.get(PROFILE)).toBeNull();

    // Start 3: IndexedDB opens again and holds the last saved progress from start 1.
    const third = await chooseSaveStore({ openIdb: async () => idb, local });
    expect(third.store).toBe(idb);
    expect(await third.store.get(PROFILE)).toBe('{"xp":30}');
  });

  it('a leftover old key that failed to clear is never read once the move is done', async () => {
    const local = new StickyRemove();
    await local.set(PROFILE, '{"xp":12}');
    const idb = new MemoryStore();

    await chooseSaveStore({ openIdb: async () => idb, local });
    expect(await local.get(PROFILE)).toBe('{"xp":12}');

    const down = await chooseSaveStore({ openIdb: idbDown, local });
    expect(await down.store.get(PROFILE)).toBeNull();
  });

  it('before any move, IndexedDB down still uses localStorage, and the next start moves those writes', async () => {
    const local = new MemoryStore();
    await local.set(PROFILE, '{"xp":12}');
    const idb = new MemoryStore();

    const down = await chooseSaveStore({ openIdb: idbDown, local });
    expect(down.store).toBe(local);
    expect(down.persistent).toBe(true);
    await down.store.set(PROFILE, '{"xp":20}');

    await chooseSaveStore({ openIdb: async () => idb, local });
    expect(await idb.get(PROFILE)).toBe('{"xp":20}');
  });

  it('with localStorage blocked and IndexedDB down, saves live in memory only', async () => {
    const chosen = await chooseSaveStore({ openIdb: idbDown, local: null });
    expect(chosen.persistent).toBe(false);
  });
});
