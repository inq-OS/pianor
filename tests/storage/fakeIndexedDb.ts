/**
 * A small in-memory stand-in for the IndexedDB calls `IndexedDbStore` makes: open with an upgrade, one object store,
 * one request per transaction, and the events the real API fires (onsuccess, oncomplete, onerror). Requests run on
 * timers, as the real ones do, so the code under test must wait for them.
 */
export class FakeIndexedDbFactory {
  readonly databases = new Map<string, Map<string, Map<string, unknown>>>();
  /** When set, the next open fails the way a blocked or broken database does. */
  failOpen: unknown = null;

  open(name: string): IDBOpenDBRequest {
    const request: Record<string, unknown> = {};
    setTimeout(() => {
      if (this.failOpen !== null) {
        request.error = this.failOpen;
        (request.onerror as (() => void) | undefined)?.();
        return;
      }
      let stores = this.databases.get(name);
      if (!stores) {
        stores = new Map();
        this.databases.set(name, stores);
        request.result = this.database(stores);
        (request.onupgradeneeded as (() => void) | undefined)?.();
      }
      request.result = this.database(stores);
      (request.onsuccess as (() => void) | undefined)?.();
    }, 0);
    return request as unknown as IDBOpenDBRequest;
  }

  asFactory(): IDBFactory {
    return this as unknown as IDBFactory;
  }

  private database(stores: Map<string, Map<string, unknown>>) {
    return {
      objectStoreNames: { contains: (n: string) => stores.has(n) },
      createObjectStore: (n: string) => {
        stores.set(n, new Map());
      },
      transaction: (n: string) => this.transaction(stores.get(n)!),
    };
  }

  private transaction(entries: Map<string, unknown>) {
    const tx: Record<string, unknown> = {};
    const run = (operation: () => unknown) => {
      const request: Record<string, unknown> = {};
      setTimeout(() => {
        try {
          request.result = operation();
          (request.onsuccess as (() => void) | undefined)?.();
          setTimeout(() => (tx.oncomplete as (() => void) | undefined)?.(), 0);
        } catch (error) {
          tx.error = error;
          (tx.onerror as (() => void) | undefined)?.();
        }
      }, 0);
      return request;
    };
    const store = {
      get: (key: string) => run(() => entries.get(key) ?? undefined),
      put: (value: unknown, key: string) => run(() => entries.set(key, value)),
      delete: (key: string) => run(() => entries.delete(key)),
      getAllKeys: () => run(() => [...entries.keys()]),
    };
    tx.objectStore = () => store;
    return tx;
  }
}
