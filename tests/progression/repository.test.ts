// Covers ft_0_10.AC2, ft_0_10.AC4, ft_0_10.AC6, ft_1_07.AC1.
import { describe, expect, it } from 'vitest';
import progressionJson from '../../content/curriculum/progression.json';
import v0 from '../fixtures/saves/profile.v0.json';
import v1 from '../fixtures/saves/profile.v1.json';
import v6 from '../fixtures/saves/profile.v6.json';
import v17 from '../fixtures/saves/profile.v17.json';
import {
  PROFILE_SCHEMA_VERSION, ProfileRepository, TEST_PLAYER_NAMES, deriveProgress, parseProfile, parseProgressionConfig, recordAttempt, type KeyValueStore,
} from '../../src/core/progression';
import type { PieceResult } from '../../src/core/judge';
import { MemoryStore } from '../../src/io/storage/MemoryStore';

const config = parseProgressionConfig(progressionJson);
/** A saved record as the game holds it today. */
const parseOk = (raw: unknown) => {
  const parsed = parseProfile(raw, config);
  if (!parsed.ok) throw new Error(parsed.errors.join('; '));
  return parsed.profile;
};

/** A repository whose clock ticks one minute per call and whose ids are predictable. */
function setup(store: KeyValueStore = new MemoryStore()) {
  let minute = 0;
  let id = 0;
  const repository = new ProfileRepository(store, config, {
    now: () => new Date(Date.UTC(1998, 9, 5, 10, minute++)),
    idFactory: () => `id-${++id}`,
  });
  return { store, repository };
}

const result = (chartId: string, accuracy = 1): PieceResult => ({
  chartId, contentVersion: 1, notes: 10, firstTryCorrect: Math.round(accuracy * 10), mistakes: 0, accuracy, rhythmErrorMs: null,
  hints: { noteNames: 0, fingers: 0 }, bothHands: { notes: 0, together: 0 },
});

describe('profiles', () => {
  it('creates, saves and loads a profile with its name and an empty log', async () => {
    const { repository } = setup();
    const created = await repository.createProfile('  Mia  ');
    expect(created).toMatchObject({ id: 'id-1', name: 'Mia', attempts: [], tugs: [], schemaVersion: PROFILE_SCHEMA_VERSION, settings: { staff: { lines: 2, barsPerLine: 'auto' } } });
    const loaded = await repository.load('id-1');
    expect(loaded).toEqual({ ok: true, profile: created });
  });

  it('falls back to "Player" for a blank name', async () => {
    const { repository } = setup();
    expect((await repository.createProfile('   ')).name).toBe('Player');
  });

  it('lists profiles oldest first and knows the active one', async () => {
    const { repository } = setup();
    await repository.createProfile('First');
    await repository.createProfile('Second');
    expect((await repository.listProfiles()).map((p) => p.name)).toEqual(['First', 'Second']);
    expect(await repository.getActiveId()).toBeNull();
    await repository.setActiveId('id-2');
    expect(await repository.getActiveId()).toBe('id-2');
  });

  it('reports a profile that does not exist', async () => {
    const { repository } = setup();
    expect(await repository.load('nope')).toEqual({ ok: false, reason: 'missing' });
  });

  it('creates "Player 1" on the first start and keeps using it afterwards', async () => {
    const { repository } = setup();
    const first = await repository.loadActiveOrCreate();
    expect(first.name).toBe('Player 1');
    expect(await repository.getActiveId()).toBe(first.id);
    expect((await repository.loadActiveOrCreate()).id).toBe(first.id);
    expect(await repository.listProfiles()).toHaveLength(1);
  });

  it('uses an existing profile when the active pointer is missing or points at nothing', async () => {
    const { repository } = setup();
    const existing = await repository.createProfile('Mia');
    expect((await repository.loadActiveOrCreate()).id).toBe(existing.id);
    await repository.setActiveId('gone');
    expect((await repository.loadActiveOrCreate()).id).toBe(existing.id);
    expect(await repository.getActiveId()).toBe(existing.id);
  });
});

describe('ft_1_07.AC1: the first start seeds four players', () => {
  it('makes TUVI, VINT, KIUR and PÄÄSU in that order, with TUVI active', async () => {
    const store = new MemoryStore();
    // ids count down, so only the creation times can keep the order TUVI, VINT, KIUR, PÄÄSU
    let id = 0;
    const repository = new ProfileRepository(store, config, {
      now: () => new Date(Date.UTC(1998, 9, 25, 10)),
      idFactory: () => `seed-${9 - id++}`,
      seedNames: TEST_PLAYER_NAMES,
    });
    const active = await repository.loadActiveOrCreate();
    expect(active.name).toBe('TUVI');
    expect(await repository.getActiveId()).toBe(active.id);
    expect((await repository.listProfiles()).map((p) => p.name)).toEqual(['TUVI', 'VINT', 'KIUR', 'PÄÄSU']);
  });

  it('does not seed again once any player exists, so an old save is never joined by new players', async () => {
    const store = new MemoryStore();
    const old = new ProfileRepository(store, config, { now: () => new Date(Date.UTC(1998, 9, 1)), idFactory: () => 'old' });
    await old.createProfile('Mia');
    const seeded = new ProfileRepository(store, config, { seedNames: TEST_PLAYER_NAMES });
    expect((await seeded.loadActiveOrCreate()).name).toBe('Mia');
    expect(await seeded.listProfiles()).toHaveLength(1);
  });

  it('without seed names the first start still makes one "Player 1"', async () => {
    const { repository } = setup();
    expect((await repository.loadActiveOrCreate()).name).toBe('Player 1');
  });
});

describe('a second profile has separate progress', () => {
  it('attempts, XP and records of one profile never show in the other', async () => {
    const { repository } = setup();
    const a = await repository.createProfile('A');
    const b = await repository.createProfile('B');
    const played = recordAttempt(a, result('little-steps'), config, new Date('1998-10-05T12:00:00.000Z'));
    await repository.save(played.profile);

    const reloadedA = await repository.load(a.id);
    const reloadedB = await repository.load(b.id);
    expect(reloadedA.ok && deriveProgress(reloadedA.profile, config).pieces['little-steps']?.xp).toBe(70);
    expect(reloadedB.ok && deriveProgress(reloadedB.profile, config).pieces).toEqual({});
    expect(reloadedB.ok && reloadedB.profile.attempts).toEqual([]);
  });

  it('saves survive a restart: a new repository on the same store sees everything', async () => {
    const store = new MemoryStore();
    const first = setup(store).repository;
    const profile = await first.createProfile('Mia');
    await first.setActiveId(profile.id);
    await first.save(recordAttempt(profile, result('little-steps', 0.8), config, new Date('1998-10-05T12:00:00.000Z')).profile);

    const second = setup(store).repository; // same storage, as after a reload
    const loaded = await second.loadActiveOrCreate();
    expect(loaded.name).toBe('Mia');
    expect(deriveProgress(loaded, config).pieces['little-steps']?.xp).toBe(64);
  });
});

describe('damaged saves', () => {
  it('copies an unreadable save aside before anything can replace it, and says what was wrong', async () => {
    const { store, repository } = setup();
    await store.set('pianor/v1/profile/bad', '{ nope');
    const loaded = await repository.load('bad');
    expect(loaded).toMatchObject({ ok: false, reason: 'corrupt', errors: [expect.stringContaining('not valid JSON')] });
    const backupKey = (loaded as { backupKey: string }).backupKey;
    expect(await store.get(backupKey)).toBe('{ nope');
    expect(await store.get('pianor/v1/profile/bad')).toBe('{ nope'); // the original is untouched
  });

  it('copies aside a save that parses but is invalid', async () => {
    const { store, repository } = setup();
    await store.set('pianor/v1/profile/odd', JSON.stringify({ schemaVersion: 1, id: 'odd', name: '', createdAt: 'x', attempts: [] }));
    const loaded = await repository.load('odd');
    expect(loaded).toMatchObject({ ok: false, reason: 'corrupt' });
    expect((await store.keys('pianor/v1/corrupt/')).length).toBe(1);
  });

  it('keeps one copy of a damaged save however often it is read (the menu lists profiles on every start)', async () => {
    const { store, repository } = setup();
    await store.set('pianor/v1/profile/bad', '{ nope');
    const first = await repository.load('bad');
    await repository.listProfiles();
    await repository.loadActiveOrCreate();
    const again = await repository.load('bad');
    expect(await store.keys('pianor/v1/corrupt/')).toHaveLength(1);
    expect(again).toMatchObject({ backupKey: (first as { backupKey: string }).backupKey });
  });

  it('copies a damaged save aside again when it has changed since the last copy', async () => {
    const { store, repository } = setup();
    await store.set('pianor/v1/profile/bad', '{ nope');
    await repository.load('bad');
    await store.set('pianor/v1/profile/bad', '{ still nope');
    await repository.load('bad');
    const copies = await Promise.all((await store.keys('pianor/v1/corrupt/')).map((k) => store.get(k)));
    expect(copies.sort()).toEqual(['{ nope', '{ still nope']);
  });

  it('a save from a newer game is not touched or migrated, only reported', async () => {
    const { store, repository } = setup();
    await store.set('pianor/v1/profile/future', JSON.stringify({ ...v1, id: 'future', schemaVersion: 99 }));
    const loaded = await repository.load('future');
    expect(loaded).toMatchObject({ ok: false, reason: 'corrupt', errors: [expect.stringContaining('newer')] });
  });

  it('listing skips damaged profiles and starting up falls back to a fresh one without deleting them', async () => {
    const { store, repository } = setup();
    await store.set('pianor/v1/profile/bad', 'garbage');
    await repository.setActiveId('bad');
    expect(await repository.listProfiles()).toEqual([]);
    const fresh = await repository.loadActiveOrCreate();
    expect(fresh.name).toBe('Player 1');
    expect(await store.get('pianor/v1/profile/bad')).toBe('garbage');
  });

  it('a save from before the health bar is loaded with its battles kept as tug records', async () => {
    const { store, repository } = setup();
    await store.set('pianor/v1/profile/p-fixture-6', JSON.stringify(v6));
    const loaded = await repository.load('p-fixture-6');
    expect(loaded.ok && loaded.profile.tugs.map((b) => [b.won, b.xp])).toEqual([[true, 30], [false, 4]]);
  });

  it('migrates an old save when it is loaded', async () => {
    const { store, repository } = setup();
    await store.set('pianor/v1/profile/p-fixture-0', JSON.stringify(v0));
    const loaded = await repository.load('p-fixture-0');
    expect(loaded.ok && loaded.profile.schemaVersion).toBe(PROFILE_SCHEMA_VERSION);
    expect(loaded.ok && deriveProgress(loaded.profile, config).totalXp).toBe(214); // v0 is replayed through the current rules (replay 30%)
  });
});

describe('export and import', () => {
  it('export then import reproduces the state exactly', async () => {
    const { store, repository } = setup();
    await store.set('pianor/v1/profile/p-fixture-14', JSON.stringify(v17));
    const text = await repository.exportProfile('p-fixture-14');
    expect(JSON.parse(text)).toMatchObject({ format: 'pianor-profile', exportVersion: 2, documents: { profile: { schemaVersion: 2, id: 'p-fixture-14', settings: { staff: { lines: 2, barsPerLine: 4 } }, tugs: [{ won: true }, { won: false }, { won: true }, { won: true }, { won: false }] } } });

    const other = setup().repository; // a different device
    const imported = await other.importProfile(text, 'replace');
    expect(imported.ok).toBe(true);
    const loaded = await other.load('p-fixture-14');
    expect(loaded.ok && loaded.profile).toEqual(parseOk(v17));
    expect(loaded.ok && deriveProgress(loaded.profile, config)).toEqual(deriveProgress(parseOk(v17), config));
  });

  it('importing as new keeps the old profile and adds a copy under a new id', async () => {
    const { store, repository } = setup();
    await store.set('pianor/v1/profile/p-fixture-1', JSON.stringify(v1));
    const text = await repository.exportProfile('p-fixture-1');
    const imported = await repository.importProfile(text, 'new');
    expect(imported).toMatchObject({ ok: true, profile: { id: 'id-1', name: 'Fixture Player' } });
    expect((await repository.listProfiles()).map((p) => p.id).sort()).toEqual(['id-1', 'p-fixture-1']);
  });

  it('importing with replace overwrites the saved profile with that id', async () => {
    const { repository } = setup();
    const profile = await repository.createProfile('Mia');
    const text = await repository.exportProfile(profile.id);
    await repository.save(recordAttempt(profile, result('a'), config, new Date('1998-10-05T12:00:00.000Z')).profile);
    await repository.importProfile(text, 'replace');
    const loaded = await repository.load(profile.id);
    expect(loaded.ok && loaded.profile.attempts).toEqual([]);
  });

  it('an export of an old save version is migrated on import', async () => {
    const { repository } = setup();
    const text = JSON.stringify({ format: 'pianor-profile', exportVersion: 1, exportedAt: 'x', profile: v0 });
    const imported = await repository.importProfile(text, 'new');
    expect(imported.ok && imported.profile.attempts).toHaveLength(4);
  });

  it('refuses things that are not a profile export, with a reason, and stores nothing', async () => {
    const { store, repository } = setup();
    const bad = async (text: string) => (await repository.importProfile(text, 'new')) as { ok: false; errors: string[] };
    expect((await bad('{ nope')).errors[0]).toContain('not valid JSON');
    expect((await bad('{}')).errors[0]).toContain('not a Pianor profile export');
    expect((await bad('null')).errors[0]).toContain('not a Pianor profile export');
    expect((await bad(JSON.stringify({ format: 'pianor-profile', exportVersion: 9, profile: v1 }))).errors[0]).toContain('newer');
    expect((await bad(JSON.stringify({ format: 'pianor-profile', exportVersion: 1, profile: { schemaVersion: 1 } }))).errors.length).toBeGreaterThan(0);
    expect(await store.keys('pianor/v1/profile/')).toEqual([]);
    expect(await store.keys('pianor/v1/player/')).toEqual([]);
  });

  it('cannot export a profile that does not exist', async () => {
    await expect(setup().repository.exportProfile('nope')).rejects.toThrow('cannot be exported');
  });
});

describe('default ids and clock', () => {
  it('make usable unique ids without being told how', async () => {
    const repository = new ProfileRepository(new MemoryStore(), config);
    const a = await repository.createProfile('A');
    const b = await repository.createProfile('B');
    expect(a.id).toMatch(/^p-/);
    expect(a.id).not.toBe(b.id);
    expect(Number.isNaN(Date.parse(a.createdAt))).toBe(false);
  });
});
