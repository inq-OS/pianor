import { describe, expect, it } from 'vitest';
import type { KeyValueStore } from '../../src/core/progression';
import { MemoryStore } from '../../src/io/storage/MemoryStore';
import { MOVED_MARKER, moveSaves } from '../../src/io/storage/moveSaves';

/** A store that fails the Nth write, to simulate the browser refusing a copy halfway. */
class FailingWrites implements KeyValueStore {
  writes = 0;
  constructor(private readonly inner: KeyValueStore, private readonly failAt: number) {}
  get(key: string) { return this.inner.get(key); }
  async set(key: string, value: string) {
    if (++this.writes === this.failAt) throw new Error('QuotaExceededError');
    return this.inner.set(key, value);
  }
  remove(key: string) { return this.inner.remove(key); }
  keys(prefix: string) { return this.inner.keys(prefix); }
}

async function filledLocal(): Promise<MemoryStore> {
  const local = new MemoryStore();
  await local.set('pianor/v1/active', 'p1');
  await local.set('pianor/v1/profile/p1', '{"xp":12}');
  await local.set('unrelated', 'keep me');
  return local;
}

describe('moveSaves (localStorage to IndexedDB, one time)', () => {
  it('copies every pianor/ key, checks it reads back, then clears the old keys', async () => {
    const local = await filledLocal();
    const idb = new MemoryStore();
    const outcome = await moveSaves(local, idb, 'pianor/');
    expect(outcome).toEqual({ kind: 'moved', count: 2 });
    expect(await idb.get('pianor/v1/profile/p1')).toBe('{"xp":12}');
    expect(await idb.get('pianor/v1/active')).toBe('p1');
    expect(await idb.get(MOVED_MARKER)).not.toBeNull();
    expect(await local.keys('pianor/')).toEqual([]);
    expect(await local.get('unrelated')).toBe('keep me');
  });

  it('does nothing again once it has moved, so a second start does not copy old data over new saves', async () => {
    const local = await filledLocal();
    const idb = new MemoryStore();
    await moveSaves(local, idb, 'pianor/');
    await idb.set('pianor/v1/profile/p1', '{"xp":99}');
    await local.set('pianor/v1/profile/p1', '{"xp":1}');
    expect(await moveSaves(local, idb, 'pianor/')).toEqual({ kind: 'already' });
    expect(await idb.get('pianor/v1/profile/p1')).toBe('{"xp":99}');
  });

  it('reports nothing to move when localStorage has no saves', async () => {
    expect(await moveSaves(new MemoryStore(), new MemoryStore(), 'pianor/')).toEqual({ kind: 'nothing' });
  });

  it('on a failed copy leaves localStorage untouched and marks nothing as moved, so the next start tries again', async () => {
    const local = await filledLocal();
    const idb = new MemoryStore();
    const outcome = await moveSaves(local, new FailingWrites(idb, 2), 'pianor/');
    expect(outcome.kind).toBe('failed');
    expect(await local.get('pianor/v1/profile/p1')).toBe('{"xp":12}');
    expect(await local.get('pianor/v1/active')).toBe('p1');
    expect(await idb.get(MOVED_MARKER)).toBeNull();

    expect(await moveSaves(local, idb, 'pianor/')).toEqual({ kind: 'moved', count: 2 });
    expect(await idb.get('pianor/v1/profile/p1')).toBe('{"xp":12}');
  });

  it('treats a copy that does not read back the same as a failure', async () => {
    const local = await filledLocal();
    const idb = new MemoryStore();
    const liar: KeyValueStore = {
      get: async (key) => (key === 'pianor/v1/active' ? 'wrong' : idb.get(key)),
      set: (key, value) => idb.set(key, value),
      remove: (key) => idb.remove(key),
      keys: (prefix) => idb.keys(prefix),
    };
    expect((await moveSaves(local, liar, 'pianor/')).kind).toBe('failed');
    expect(await local.get('pianor/v1/active')).toBe('p1');
  });

  it('keeps the move when clearing an old key fails, since the saves are already safe in the new store', async () => {
    const local = await filledLocal();
    const idb = new MemoryStore();
    local.remove = async () => {
      throw new Error('SecurityError');
    };
    expect((await moveSaves(local, idb, 'pianor/')).kind).toBe('moved');
    expect(await idb.get('pianor/v1/active')).toBe('p1');
  });
});
