import type { KeyValueStore } from '../../core/progression';

/** A store that lives only as long as the page. For tests, and as the fallback when the browser blocks storage. */
export class MemoryStore implements KeyValueStore {
  private readonly data = new Map<string, string>();

  async get(key: string): Promise<string | null> {
    return this.data.get(key) ?? null;
  }

  async set(key: string, value: string): Promise<void> {
    this.data.set(key, value);
  }

  async remove(key: string): Promise<void> {
    this.data.delete(key);
  }

  async keys(prefix: string): Promise<string[]> {
    return [...this.data.keys()].filter((k) => k.startsWith(prefix));
  }
}
