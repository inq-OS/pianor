// Covers core_11.AC1, core_11.AC2, core_11.AC3, core_11.AC4, core_11.AC5.
import { describe, expect, it } from 'vitest';
import progressionJson from '../../content/curriculum/progression.json';
import curriculumV1 from '../fixtures/saves/documents/curriculum.v1.json';
import practiceLogV1 from '../fixtures/saves/documents/practiceLog.v1.json';
import profileV1 from '../fixtures/saves/documents/profile.v1.json';
import record from '../fixtures/saves/documents/record.v17.json';
import worldV1 from '../fixtures/saves/documents/world.v1.json';
import {
  PROFILE_SCHEMA_VERSION, ProfileRepository, parseProfile, parseProgressionConfig, recordAttempt,
} from '../../src/core/progression';
import {
  PROFILE_DOCUMENT_V1_HOLDS, SAVE_DOCUMENT_NAMES, curriculumDocument, joinProfile, practiceLogDocument, profileDocument, readDocument,
  splitProfile, worldDocument,
} from '../../src/core/save/documents';
import type { WorldState } from '../../src/core/island/worldState';
import type { Curriculum } from '../../src/core/curriculum/curriculum';
import { MemoryStore } from '../../src/io/storage/MemoryStore';

const config = parseProgressionConfig(progressionJson);
const fixtures = import.meta.glob<unknown>('../fixtures/saves/profile.v*.json', { eager: true, import: 'default' });

function setup(store = new MemoryStore()) {
  let id = 0;
  return { store, repository: new ProfileRepository(store, config, { now: () => new Date(Date.UTC(1998, 10, 17, 10)), idFactory: () => `id-${++id}` }) };
}

const key = (id: string, name: string) => `pianor/v1/player/${id}/${name}`;
const pretty = (text: string | null) => `${JSON.stringify(JSON.parse(text!), null, 2)}\n`;
const fileText = (value: unknown) => `${JSON.stringify(value, null, 2)}\n`;

const world: WorldState = {
  flags: ['met-puuvaim'], items: ['golden-leaf'],
  met: { puuvaim: { firstDay: '1998-11-17', lastDay: '1998-11-18', taught: ['puuvaim-1'], taughtOn: { 'puuvaim-1': '1998-11-17' }, tugs: { won: 1, lost: 2, bestLevel: 1 }, lastLostTug: { piece: 'puuvaim-1', at: '1998-11-18T16:00:00.000Z' } } },
  teacherVisits: [{ day: '1998-11-18', piece: 'little-steps', result: 'notYet' }],
};
const curriculum: Curriculum = {
  base: 85,
  pieces: [{ piece: 'little-steps', deadline: '1998-12-01', priority: 7, overrides: { lastPlays: 8 } }],
  calendar: [{ day: '1998-12-01', kind: 'lesson', text: 'teacher' }],
};

describe('core_11.AC1: a player is four documents, each with its own version', () => {
  it('names the four documents and each starts at version 1 with no steps yet', () => {
    expect(SAVE_DOCUMENT_NAMES).toEqual(['profile', 'practiceLog', 'world', 'curriculum']);
    for (const doc of [profileDocument(config), practiceLogDocument, worldDocument, curriculumDocument]) {
      expect([doc.schemaVersion, doc.migrations]).toEqual([1, []]);
    }
  });

  it('golden: each version-1 fixture reads and writes back byte for byte', () => {
    const cases = [[profileDocument(config), profileV1], [practiceLogDocument, practiceLogV1], [worldDocument, worldV1], [curriculumDocument, curriculumV1]] as const;
    for (const [doc, fixture] of cases) {
      const value = (doc as typeof worldDocument).parse(JSON.stringify(fixture));
      expect(pretty((doc as typeof worldDocument).serialize(value)), doc.name).toBe(fileText(fixture));
    }
  });

  // core_12.AC9
  it('a filled world and curriculum go round, and a missing document is its empty value', () => {
    expect(worldDocument.parse(worldDocument.serialize(world))).toEqual(world);
    expect(curriculumDocument.parse(curriculumDocument.serialize(curriculum))).toEqual(curriculum);
    expect(worldDocument.parse(null)).toEqual({ flags: [], items: [], met: {}, teacherVisits: [] });
    expect(curriculumDocument.parse(null)).toEqual({ base: 85, pieces: [], calendar: [] });
    expect(practiceLogDocument.parse(null)).toEqual({ bars: [] });
  });

  it('ft_1_26.AC9 the test days and times go round in the curriculum version 1; a version 1 save without them still reads (d069.3)', () => {
    const timed: Curriculum = { ...curriculum, testWeekdays: [1, 4], testTime: '17:30', calendar: [...curriculum.calendar, { day: '1998-11-23', kind: 'test', time: '14:05' }] };
    expect(curriculumDocument.parse(curriculumDocument.serialize(timed))).toEqual(timed);
    expect(readDocument(curriculumDocument, JSON.stringify(curriculumV1))).toMatchObject({ ok: true });
    expect(readDocument(curriculumDocument, JSON.stringify({ ...curriculumV1, testTime: '25:00' }))).toMatchObject({ ok: false });
    expect(readDocument(curriculumDocument, JSON.stringify({ ...curriculumV1, testWeekdays: [7] }))).toMatchObject({ ok: false });
  });

  it('refuses a document from a newer game, broken JSON and a wrong shape with a reason, never by throwing from readDocument', () => {
    expect(readDocument(worldDocument, JSON.stringify({ ...worldV1, schemaVersion: 2 }))).toMatchObject({ ok: false, errors: [expect.stringContaining('newer')] });
    expect(readDocument(worldDocument, '{ nope')).toMatchObject({ ok: false, errors: [expect.stringContaining('not valid JSON')] });
    expect(readDocument(curriculumDocument, JSON.stringify({ ...curriculumV1, base: 'x' }))).toMatchObject({ ok: false });
    expect(readDocument(profileDocument(config), JSON.stringify({ schemaVersion: 1, id: 'x' }))).toMatchObject({ ok: false });
    expect(readDocument(practiceLogDocument, JSON.stringify({ bars: [] }))).toMatchObject({ ok: false, errors: [expect.stringContaining('no schemaVersion')] });
  });

  it('stores one key per player and document', async () => {
    const { store, repository } = setup();
    const p = await repository.createProfile('Mia');
    await repository.saveDocument(p.id, 'world', world);
    expect((await store.keys('pianor/v1/player/')).sort()).toEqual([key(p.id, 'practiceLog'), key(p.id, 'profile'), key(p.id, 'world')]);
    expect(await store.keys('pianor/v1/profile/')).toEqual([]);
    expect(await repository.loadDocument(p.id, 'world')).toEqual({ ok: true, value: world });
    expect(await repository.loadDocument(p.id, 'curriculum')).toEqual({ ok: true, value: { base: 85, pieces: [], calendar: [] } });
  });
});

describe('core_11.AC2: the one-time move from the single profile record', () => {
  it('golden: a version 17 record becomes the four fixture documents and the record stays untouched', async () => {
    const { store, repository } = setup();
    const text = JSON.stringify(record);
    await store.set('pianor/v1/profile/p-fixture-move', text);
    const loaded = await repository.load('p-fixture-move');
    expect(loaded.ok).toBe(true);
    expect(pretty(await store.get(key('p-fixture-move', 'profile')))).toBe(fileText(profileV1));
    expect(pretty(await store.get(key('p-fixture-move', 'practiceLog')))).toBe(fileText(practiceLogV1));
    expect(pretty(await store.get(key('p-fixture-move', 'world')))).toBe(fileText(worldV1));
    expect(pretty(await store.get(key('p-fixture-move', 'curriculum')))).toBe(fileText(curriculumV1));
    expect(await store.get('pianor/v1/profile/p-fixture-move')).toBe(text);
  });

  it('runs once: later loads read the documents, not the record', async () => {
    const { store, repository } = setup();
    await store.set('pianor/v1/profile/p-fixture-move', JSON.stringify(record));
    const first = await repository.load('p-fixture-move');
    await store.set('pianor/v1/profile/p-fixture-move', JSON.stringify({ ...record, name: 'Changed' }));
    const again = await repository.load('p-fixture-move');
    expect(again).toEqual(first);
    expect(again.ok && again.profile.name).toBe('Fixture Player');
  });

  it('a record of every earlier version moves with every attempt, battle, practice entry and campaign step kept', async () => {
    expect(Object.keys(fixtures).length).toBe(PROFILE_SCHEMA_VERSION + 1);
    for (const [path, raw] of Object.entries(fixtures)) {
      const { store, repository } = setup();
      const id = (raw as { id: string }).id;
      await store.set(`pianor/v1/profile/${id}`, JSON.stringify(raw));
      const expected = parseProfile(raw, config);
      expect(expected.ok, path).toBe(true);
      const moved = await repository.load(id);
      expect(moved, path).toEqual({ ok: true, profile: expected.ok && expected.profile });
      // read back from the documents alone, on a new repository
      const reread = await setup(store).repository.load(id);
      expect(reread, path).toEqual(moved);
    }
  });

  it('a move cut short by a failed write is redone on the next start, with every practice bar kept', async () => {
    const store = new MemoryStore();
    await store.set('pianor/v1/profile/p-fixture-move', JSON.stringify(record));
    for (let failAt = 1; failAt <= 4; failAt++) {
      for (const name of SAVE_DOCUMENT_NAMES) await store.remove(key('p-fixture-move', name));
      let writes = 0;
      const flaky = { ...store, get: store.get.bind(store), keys: store.keys.bind(store), remove: store.remove.bind(store),
        set: async (k: string, v: string) => { if (++writes === failAt) throw new Error('closed'); await store.set(k, v); } };
      await expect(setup(flaky as MemoryStore).repository.load('p-fixture-move'), `write ${failAt}`).rejects.toThrow('closed');
      const again = await setup(store).repository.load('p-fixture-move');
      expect(again.ok && again.profile.practice.bars, `write ${failAt}`).toHaveLength(3);
      expect(pretty(await store.get(key('p-fixture-move', 'practiceLog')))).toBe(fileText(practiceLogV1));
    }
  });

  it('a profile document without its practice log and without a record loads with an empty log: the bar history is lost, never the player', async () => {
    const { store, repository } = setup();
    const p = await repository.createProfile('Mia');
    await store.remove(key(p.id, 'practiceLog'));
    const loaded = await repository.load(p.id);
    expect(loaded.ok && loaded.profile.name).toBe('Mia');
    expect(loaded.ok && loaded.profile.practice.bars).toEqual([]);
    expect((await repository.listProfiles()).map((s) => s.name)).toEqual(['Mia']);
  });

  it('a profile document without its practice log beside an old record is copied aside, then moved again', async () => {
    const { store, repository } = setup();
    await store.set('pianor/v1/profile/p-fixture-move', JSON.stringify(record));
    await repository.load('p-fixture-move');
    const profileText = await store.get(key('p-fixture-move', 'profile'));
    await store.remove(key('p-fixture-move', 'practiceLog'));
    const again = await repository.load('p-fixture-move');
    expect(again.ok && again.profile.practice.bars).toHaveLength(3);
    const copies = await store.keys('pianor/v1/corrupt/p-fixture-move-profile-');
    expect(copies).toHaveLength(1);
    expect(await store.get(copies[0]!)).toBe(profileText);
  });

  it('a delete cut short never brings the player back', async () => {
    const store = new MemoryStore();
    await store.set('pianor/v1/profile/p-fixture-move', JSON.stringify(record));
    await setup(store).repository.load('p-fixture-move');
    for (let failAt = 1; failAt <= 5; failAt++) {
      let removes = 0;
      const flaky = { ...store, get: store.get.bind(store), keys: store.keys.bind(store), set: store.set.bind(store),
        remove: async (k: string) => { if (++removes === failAt) throw new Error('closed'); await store.remove(k); } };
      await setup(flaky as MemoryStore).repository.deleteProfile('p-fixture-move').catch(() => undefined);
      if (failAt > 2) expect(await setup(store).repository.listProfiles(), `remove ${failAt}`).toEqual([]);
      // the record goes first: once it is gone, whatever is left can only be the moved player, never the progress from before the move
      expect(await store.get('pianor/v1/profile/p-fixture-move'), `remove ${failAt}`).toBe(failAt === 1 ? JSON.stringify(record) : null);
    }
    expect(await setup(store).repository.listProfiles()).toEqual([]);
  });

  it('a damaged record is copied aside and not moved', async () => {
    const { store, repository } = setup();
    await store.set('pianor/v1/profile/bad', '{ nope');
    expect(await repository.load('bad')).toMatchObject({ ok: false, reason: 'corrupt' });
    expect(await store.keys('pianor/v1/player/')).toEqual([]);
  });

  it('a damaged practice log is copied aside and the player loads with an empty log, the other documents untouched', async () => {
    const { store, repository } = setup();
    const p = await repository.createProfile('Mia');
    await store.set(key(p.id, 'practiceLog'), '{ nope');
    const profileText = await store.get(key(p.id, 'profile'));
    const loaded = await repository.load(p.id);
    expect(loaded.ok && loaded.profile.practice.bars).toEqual([]);
    const copies = await store.keys(`pianor/v1/corrupt/${p.id}-practiceLog-`);
    expect(copies).toHaveLength(1);
    expect(await store.get(copies[0]!)).toBe('{ nope');
    expect(await store.get(key(p.id, 'profile'))).toBe(profileText);
    expect((await repository.listProfiles()).map((s) => s.name)).toEqual(['Mia']);
  });

  it('a damaged profile document is reported and copied aside; the player is listed as damaged, by the name the text still holds', async () => {
    const { store, repository } = setup();
    const p = await repository.createProfile('Mia');
    const broken = JSON.stringify({ schemaVersion: 1, name: 'Mia', settings: 'x' });
    await store.set(key(p.id, 'profile'), broken);
    const loaded = await repository.load(p.id);
    expect(loaded).toMatchObject({ ok: false, reason: 'corrupt', errors: [expect.stringContaining('profile')] });
    expect(await store.get((loaded as { backupKey: string }).backupKey)).toBe(broken);
    expect(await repository.listProfiles()).toEqual([]);
    expect(await repository.damagedProfiles()).toEqual([{ id: p.id, name: 'Mia' }]);
  });

  it('a damaged profile with no readable name is listed as damaged under no name; a readable player is never in that list', async () => {
    const { store, repository } = setup();
    const p = await repository.createProfile('Mia');
    const q = await repository.createProfile('Sam');
    await store.set(key(p.id, 'profile'), 'xx{');
    expect(await repository.damagedProfiles()).toEqual([{ id: p.id, name: '' }]);
    expect((await repository.listProfiles()).map((s) => s.id)).toEqual([q.id]);
  });

  it('deleting a player removes its documents and its old record', async () => {
    const { store, repository } = setup();
    await store.set('pianor/v1/profile/p-fixture-move', JSON.stringify(record));
    await repository.load('p-fixture-move');
    await repository.deleteProfile('p-fixture-move');
    expect([...(await store.keys('pianor/v1/player/')), ...(await store.keys('pianor/v1/profile/'))]).toEqual([]);
    expect(await repository.listProfiles()).toEqual([]);
  });

  it('lists moved and not yet moved players once each', async () => {
    const { store, repository } = setup();
    await store.set('pianor/v1/profile/p-fixture-move', JSON.stringify(record));
    await repository.load('p-fixture-move');
    await store.set('pianor/v1/profile/other', JSON.stringify({ ...record, id: 'other', createdAt: '1998-10-02T09:00:00.000Z' }));
    expect((await repository.listProfiles()).map((p) => p.id)).toEqual(['p-fixture-move', 'other']);
  });
});

describe('core_11.AC3: export and import carry every document', () => {
  it('export then import on another device gives the same documents, byte for byte', async () => {
    const { store, repository } = setup();
    const p = recordAttempt(await repository.createProfile('Mia'), {
      chartId: 'a', contentVersion: 1, notes: 10, firstTryCorrect: 9, mistakes: 1, accuracy: 0.9, rhythmErrorMs: null,
      hints: { noteNames: 0, fingers: 0 }, bothHands: { notes: 0, together: 0 },
    }, config, new Date('1998-11-17T12:00:00.000Z')).profile;
    await repository.save(p);
    await repository.saveDocument(p.id, 'world', world);
    await repository.saveDocument(p.id, 'curriculum', curriculum);
    const text = await repository.exportProfile(p.id);
    expect(Object.keys(JSON.parse(text).documents)).toEqual(['profile', 'practiceLog', 'world', 'curriculum']);
    const other = setup();
    expect(await other.repository.importProfile(text, 'replace')).toMatchObject({ ok: true, profile: { id: p.id } });
    for (const name of SAVE_DOCUMENT_NAMES) expect(await other.store.get(key(p.id, name)), name).toBe(await store.get(key(p.id, name)));
  });

  it('refuses an export with any document newer than this game, with a plain message, and stores nothing', async () => {
    const { repository } = setup();
    const p = await repository.createProfile('Mia');
    const doc = JSON.parse(await repository.exportProfile(p.id));
    const other = setup();
    doc.documents.world.schemaVersion = 5;
    const result = await other.repository.importProfile(JSON.stringify(doc), 'new');
    expect(result).toEqual({ ok: false, errors: ['world: version 5 is newer than this game understands (1)'] });
    expect(await other.store.keys('pianor/v1/')).toEqual([]);
  });

  it('an export of version 1 (one profile) still imports, with an empty world and curriculum', async () => {
    const { store, repository } = setup();
    const text = JSON.stringify({ format: 'pianor-profile', exportVersion: 1, exportedAt: 'x', profile: record });
    const result = await repository.importProfile(text, 'new');
    expect(result).toMatchObject({ ok: true, profile: { id: 'id-1', name: 'Fixture Player' } });
    expect(pretty(await store.get(key('id-1', 'world')))).toBe(fileText(worldV1));
  });

  it('refuses a version 2 export without a profile document', async () => {
    const { repository } = setup();
    const result = await repository.importProfile(JSON.stringify({ format: 'pianor-profile', exportVersion: 2, documents: {} }), 'new');
    expect(result).toEqual({ ok: false, errors: ['the export has no profile document'] });
  });
});

describe('core_11.AC4: one document changes without touching the others', () => {
  it('adding the world and the curriculum leaves the profile and the practice log byte-identical', async () => {
    const { store, repository } = setup();
    await store.set('pianor/v1/profile/p-fixture-move', JSON.stringify(record));
    await repository.load('p-fixture-move');
    const before = { profile: await store.get(key('p-fixture-move', 'profile')), practiceLog: await store.get(key('p-fixture-move', 'practiceLog')) };
    await repository.saveDocument('p-fixture-move', 'world', world);
    await repository.saveDocument('p-fixture-move', 'curriculum', curriculum);
    expect({ profile: await store.get(key('p-fixture-move', 'profile')), practiceLog: await store.get(key('p-fixture-move', 'practiceLog')) }).toEqual(before);
    expect(await repository.loadDocument('p-fixture-move', 'world')).toEqual({ ok: true, value: world });
  });

  it('saving the profile leaves the world and the curriculum byte-identical', async () => {
    const { store, repository } = setup();
    const p = await repository.createProfile('Mia');
    await repository.saveDocument(p.id, 'world', world);
    const before = await store.get(key(p.id, 'world'));
    await repository.save({ ...p, name: 'Mari' });
    expect(await store.get(key(p.id, 'world'))).toBe(before);
  });
});

describe('core_11.AC5: the profile document holds the version 17 profile', () => {
  it('a profile change after the split is a step of the profile document, not a new record version', () => {
    // When this fails, the v18 round (or any profile change) went into the old record chain: add it as the profile
    // document's version 2 instead (d136), with a golden step from profile.v1.json.
    expect(PROFILE_SCHEMA_VERSION).toBe(PROFILE_DOCUMENT_V1_HOLDS);
  });

  it('splitting and joining a profile gives it back', () => {
    const parsed = parseProfile(record, config);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    const { core, practiceLog } = splitProfile(parsed.profile);
    expect('practice' in core || 'schemaVersion' in core).toBe(false);
    expect(joinProfile(core, practiceLog)).toEqual(parsed.profile);
  });
});
