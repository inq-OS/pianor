import type { KeyValueStore } from '../../core/progression';

const STORE = 'kv';

/**
 * Saves in IndexedDB: a large quota (a share of free disk, not 5 MB) and no string-size limit that a growing attempt log would hit.
 * Every call is one transaction, so a write is on disk when its promise resolves. Errors reject, as the game needs them to
 * tell the player a save did not happen.
 */
export class IndexedDbStore implements KeyValueStore {
  constructor(private readonly db: IDBDatabase) {}

  get(key: string): Promise<string | null> {
    return this.run<string | undefined>('readonly', (store) => store.get(key)).then((value) => value ?? null);
  }

  async set(key: string, value: string): Promise<void> {
    await this.run('readwrite', (store) => store.put(value, key));
  }

  async remove(key: string): Promise<void> {
    await this.run('readwrite', (store) => store.delete(key));
  }

  async keys(prefix: string): Promise<string[]> {
    const all = await this.run<IDBValidKey[]>('readonly', (store) => store.getAllKeys());
    return all.map(String).filter((key) => key.startsWith(prefix));
  }

  private run<T>(mode: IDBTransactionMode, operation: (store: IDBObjectStore) => IDBRequest): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const tx = this.db.transaction(STORE, mode);
      const request = operation(tx.objectStore(STORE));
      let result: T;
      request.onsuccess = () => {
        result = request.result as T;
      };
      tx.oncomplete = () => resolve(result);
      tx.onerror = () => reject(tx.error ?? request.error ?? new Error('IndexedDB request failed'));
      tx.onabort = () => reject(tx.error ?? new Error('IndexedDB transaction aborted'));
    });
  }
}

/** Opens (and creates on first use) the save database. Rejects if the browser refuses, so the caller can fall back. */
export function openIndexedDbStore(factory: IDBFactory, name = 'pianor'): Promise<IndexedDbStore> {
  return new Promise((resolve, reject) => {
    const request = factory.open(name, 1);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE)) request.result.createObjectStore(STORE);
    };
    request.onsuccess = () => resolve(new IndexedDbStore(request.result));
    request.onerror = () => reject(request.error ?? new Error('IndexedDB open failed'));
    request.onblocked = () => reject(new Error('IndexedDB open blocked'));
  });
}
