import type { KeyValueStore } from '../../core/progression';

/** The part of `Storage` this store uses. Tests pass a fake; the game passes `window.localStorage`. */
export interface StorageLike {
  readonly length: number;
  key(index: number): string | null;
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

/**
 * Saves in `localStorage`, which survives reloads and restarts. Reads never throw (a blocked or broken storage reads as empty);
 * writes throw so the caller can tell the player a save did not happen.
 */
export class LocalStorageStore implements KeyValueStore {
  constructor(private readonly storage: StorageLike) {}

  async get(key: string): Promise<string | null> {
    try {
      return this.storage.getItem(key);
    } catch {
      return null;
    }
  }

  async set(key: string, value: string): Promise<void> {
    this.storage.setItem(key, value);
  }

  async remove(key: string): Promise<void> {
    this.storage.removeItem(key);
  }

  async keys(prefix: string): Promise<string[]> {
    const found: string[] = [];
    try {
      for (let i = 0; i < this.storage.length; i++) {
        const key = this.storage.key(i);
        if (key !== null && key.startsWith(prefix)) found.push(key);
      }
    } catch {
      return [];
    }
    return found;
  }
}
