import { describe, expect, it } from 'vitest';
import type { KeyValueStore } from '../../src/core/progression';

/** Behaviour every `KeyValueStore` must have, so a new storage (IndexedDB, files, cloud) can replace another safely. */
export function storeContract(name: string, create: () => KeyValueStore | Promise<KeyValueStore>): void {
  describe(`KeyValueStore contract: ${name}`, () => {
    it('returns null for a key that was never set', async () => {
      expect(await (await create()).get('missing')).toBeNull();
    });

    it('stores and returns a value, replacing the old one on a second set', async () => {
      const store = await create();
      await store.set('a', 'one');
      expect(await store.get('a')).toBe('one');
      await store.set('a', 'two');
      expect(await store.get('a')).toBe('two');
    });

    it('keeps keys apart and stores any text, including empty, long and non-ASCII', async () => {
      const store = await create();
      const long = 'x'.repeat(100_000);
      await store.set('a', '');
      await store.set('b', long);
      await store.set('c', 'Zażółć gęślą jaźń \u{1F3B9} \n "quotes"');
      expect(await store.get('a')).toBe('');
      expect(await store.get('b')).toBe(long);
      expect(await store.get('c')).toBe('Zażółć gęślą jaźń \u{1F3B9} \n "quotes"');
    });

    it('removes a key, and removing a missing key is harmless', async () => {
      const store = await create();
      await store.set('a', '1');
      await store.remove('a');
      expect(await store.get('a')).toBeNull();
      await expect(store.remove('never')).resolves.toBeUndefined();
    });

    it('lists the keys with a prefix, and only those', async () => {
      const store = await create();
      await store.set('pianor/profile/1', 'x');
      await store.set('pianor/profile/2', 'x');
      await store.set('pianor/active', 'x');
      await store.set('other', 'x');
      expect((await store.keys('pianor/profile/')).sort()).toEqual(['pianor/profile/1', 'pianor/profile/2']);
      expect((await store.keys('pianor/')).length).toBe(3);
      expect(await store.keys('nothing/')).toEqual([]);
    });

    it('does not list removed keys', async () => {
      const store = await create();
      await store.set('p/1', 'x');
      await store.remove('p/1');
      expect(await store.keys('p/')).toEqual([]);
    });
  });
}
