import { describe, expect, it, afterEach } from 'vitest';
import progressionJson from '../../../content/curriculum/progression.json';
import { setLanguage } from '../text/language';
import { parseProgressionConfig } from './config';
import { ProfileRepository, type KeyValueStore } from './repository';

const config = parseProgressionConfig(progressionJson);

/** An in-memory store, enough for the repository's create and read path. */
function memoryStore(): KeyValueStore {
  const data = new Map<string, string>();
  return {
    get: async (key) => data.get(key) ?? null,
    set: async (key, value) => void data.set(key, value),
    remove: async (key) => void data.delete(key),
    keys: async (prefix) => [...data.keys()].filter((k) => k.startsWith(prefix)),
  };
}

afterEach(() => setLanguage('en'));

describe('a new player starts with the letter naming of the language (ft_0_18, item 7)', () => {
  it('ft_0_18 an Estonian player starts with H', async () => {
    setLanguage('et');
    const repo = new ProfileRepository(memoryStore(), config);
    const profile = await repo.createProfile('Mari');
    expect(profile.settings.noteNaming).toBe('H');
  });

  it('ft_0_18 an English player keeps B, as before', async () => {
    setLanguage('en');
    const repo = new ProfileRepository(memoryStore(), config);
    const profile = await repo.createProfile('Sam');
    expect(profile.settings.noteNaming).toBe('B');
  });
});
