import { describe, expect, it } from 'vitest';
import { IndexedDbStore, openIndexedDbStore } from '../../src/io/storage/IndexedDbStore';
import { storeContract } from '../contracts/store.contract';
import { FakeIndexedDbFactory } from './fakeIndexedDb';

storeContract('IndexedDbStore over a fake IndexedDB', async () => {
  return openIndexedDbStore(new FakeIndexedDbFactory().asFactory(), 'test');
});

describe('openIndexedDbStore', () => {
  it('opens the database and keeps saves when it is opened again', async () => {
    const factory = new FakeIndexedDbFactory();
    const first = await openIndexedDbStore(factory.asFactory(), 'pianor');
    await first.set('pianor/v1/active', 'p1');
    const second = await openIndexedDbStore(factory.asFactory(), 'pianor');
    expect(await second.get('pianor/v1/active')).toBe('p1');
  });

  it('rejects when the browser refuses to open the database, so the game can fall back', async () => {
    const factory = new FakeIndexedDbFactory();
    factory.failOpen = new Error('UnknownError');
    await expect(openIndexedDbStore(factory.asFactory(), 'pianor')).rejects.toThrow('UnknownError');
  });

  it('lists only the keys under the prefix', async () => {
    const store = await openIndexedDbStore(new FakeIndexedDbFactory().asFactory(), 'pianor');
    await store.set('pianor/v1/profile/a', '{}');
    await store.set('pianor/v1/profile/b', '{}');
    await store.set('other/x', '1');
    expect((await store.keys('pianor/v1/profile/')).sort()).toEqual(['pianor/v1/profile/a', 'pianor/v1/profile/b']);
  });

  it('is an IndexedDbStore', async () => {
    const store = await openIndexedDbStore(new FakeIndexedDbFactory().asFactory(), 'pianor');
    expect(store).toBeInstanceOf(IndexedDbStore);
  });
});
