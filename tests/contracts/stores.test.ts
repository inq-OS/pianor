import { describe, expect, it } from 'vitest';
import { LocalStorageStore, type StorageLike } from '../../src/io/storage/LocalStorageStore';
import { MemoryStore } from '../../src/io/storage/MemoryStore';
import { storeContract } from './store.contract';

/** A fake `Storage` that behaves like the browser one: string values only, insertion-ordered keys. */
class FakeStorage implements StorageLike {
  private readonly data = new Map<string, string>();
  get length() { return this.data.size; }
  key(index: number) { return [...this.data.keys()][index] ?? null; }
  getItem(key: string) { return this.data.get(key) ?? null; }
  setItem(key: string, value: string) { this.data.set(key, String(value)); }
  removeItem(key: string) { this.data.delete(key); }
}

storeContract('MemoryStore', () => new MemoryStore());
storeContract('LocalStorageStore over a fake Storage', () => new LocalStorageStore(new FakeStorage()));

describe('LocalStorageStore when the browser storage misbehaves', () => {
  const blocked: StorageLike = {
    get length(): number { throw new Error('SecurityError'); },
    key: () => { throw new Error('SecurityError'); },
    getItem: () => { throw new Error('SecurityError'); },
    setItem: () => { throw new Error('QuotaExceededError'); },
    removeItem: () => undefined,
  };

  it('reads as empty instead of throwing', async () => {
    const store = new LocalStorageStore(blocked);
    expect(await store.get('a')).toBeNull();
    expect(await store.keys('a')).toEqual([]);
  });

  it('lets a failed write throw so the game can tell the player the save did not happen', async () => {
    await expect(new LocalStorageStore(blocked).set('a', 'b')).rejects.toThrow('QuotaExceededError');
  });

  it('shares one storage between stores, as two tabs would', async () => {
    const storage = new FakeStorage();
    await new LocalStorageStore(storage).set('k', 'v');
    expect(await new LocalStorageStore(storage).get('k')).toBe('v');
    expect(storage.getItem('k')).toBe('v');
  });
});
