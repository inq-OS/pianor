import type { ProgressionConfig } from './config';
import { t } from '../text/strings';
import { language } from '../text/language';
import { defaultNoteNaming } from '../text/noteName';
import {
  SAVE_DOCUMENT_NAMES, curriculumDocument, joinProfile, practiceLogDocument, profileDocument, readDocument, splitProfile, worldDocument,
  type ProfileCore, type SaveDocument, type SaveDocumentName,
} from '../save/documents';
import type { Curriculum } from '../curriculum/curriculum';
import type { WorldState } from '../island/worldState';
import type { PracticeLog } from './practiceLog';
import { parseProfile } from './migrate';
import { emptyProfile, type ProfileData } from './profile';

/** Claims a player for this window; a claim on another player frees the one held before. False while another window holds it. */
export interface PlayerLock {
  claim(id: string): Promise<boolean>;
}

/** Where saves live. Async so a later IndexedDB or file-sync implementation fits; the game never touches storage directly. */
export interface KeyValueStore {
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<void>;
  remove(key: string): Promise<void>;
  /** All keys that start with `prefix`. */
  keys(prefix: string): Promise<string[]>;
}

export interface ProfileSummary {
  id: string;
  name: string;
  createdAt: string;
}

export type LoadResult =
  | { ok: true; profile: ProfileData }
  | { ok: false; reason: 'missing' }
  | { ok: false; reason: 'corrupt'; errors: string[]; backupKey: string };

export type ProfileImportResult = { ok: true; profile: ProfileData } | { ok: false; errors: string[] };

export interface RepositoryOptions {
  now?: () => Date;
  /** Makes new profile ids. Defaults to time plus random, unique enough for one device. Tests pass their own. */
  idFactory?: () => string;
  /**
   * Players made on the first start, in this order, when there is no player yet (the first one is active). Empty: the
   * single "Player 1" of before. Only the end-to-end tests' `?players=test` passes `TEST_PLAYER_NAMES`: a new install asks
   * for the first player's name instead (ft_1_07.AC1).
   */
  seedNames?: readonly string[];
}

/**
 * The four players a dev server makes on a first start with `?players=test` (the end-to-end tests): bird names, like Kiur.
 * A real install makes none (a new instance has no premade profiles, ft_1_07.AC1).
 */
export const TEST_PLAYER_NAMES = ['TUVI', 'VINT', 'KIUR', 'PÄÄSU'] as const;

const PREFIX = 'pianor/v1/';
/** The single profile record of before the split (core_11): read once and moved, then kept untouched until the next release. */
const PROFILE_PREFIX = `${PREFIX}profile/`;
/** A player's documents: `pianor/v1/player/<id>/<document>` (d136). */
const PLAYER_PREFIX = `${PREFIX}player/`;
const ACTIVE_KEY = `${PREFIX}active`;
const EXPORT_FORMAT = 'pianor-profile';
/** 1: one profile; 2 (core_11): the player's documents. */
const EXPORT_VERSION = 2;

/** The value each document holds. */
export interface PlayerDocuments {
  profile: ProfileCore;
  practiceLog: PracticeLog;
  world: WorldState;
  curriculum: Curriculum;
}

const documentKey = (id: string, name: SaveDocumentName) => `${PLAYER_PREFIX}${id}/${name}`;

/**
 * Profile saves on top of a `KeyValueStore`: one key per player and document (so players never mix and each document
 * migrates alone, core_11, d136), an active-profile pointer, migration on load, JSON export and import. The single
 * profile record of before is moved into the documents on its first load and kept. A save that cannot be read is copied
 * aside before anything replaces it.
 * Data stays on the device: there are no accounts (docs/futureproofing.md 1.5).
 */
export class ProfileRepository {
  private readonly now: () => Date;
  private readonly idFactory: () => string;
  private readonly seedNames: readonly string[];
  private readonly docs: { [N in SaveDocumentName]: SaveDocument<PlayerDocuments[N]> };

  constructor(
    private readonly store: KeyValueStore,
    private readonly config: ProgressionConfig,
    options: RepositoryOptions = {},
  ) {
    this.now = options.now ?? (() => new Date());
    this.idFactory = options.idFactory ?? (() => `p-${this.now().getTime().toString(36)}-${Math.random().toString(36).slice(2, 8)}`);
    this.seedNames = options.seedNames ?? [];
    this.docs = { profile: profileDocument(config), practiceLog: practiceLogDocument, world: worldDocument, curriculum: curriculumDocument };
  }

  /** Every player id: those with documents and those with only a record of before the split. */
  private async playerIds(): Promise<string[]> {
    const ids = new Set<string>();
    for (const key of await this.store.keys(PLAYER_PREFIX)) {
      if (key.endsWith('/profile')) ids.add(key.slice(PLAYER_PREFIX.length, -'/profile'.length));
    }
    for (const key of await this.store.keys(PROFILE_PREFIX)) ids.add(key.slice(PROFILE_PREFIX.length));
    return [...ids].sort();
  }

  async listProfiles(): Promise<ProfileSummary[]> {
    const summaries: ProfileSummary[] = [];
    for (const id of await this.playerIds()) {
      const loaded = await this.load(id);
      if (loaded.ok) summaries.push({ id: loaded.profile.id, name: loaded.profile.name, createdAt: loaded.profile.createdAt });
    }
    return summaries.sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id));
  }

  async getActiveId(): Promise<string | null> {
    return this.store.get(ACTIVE_KEY);
  }

  async setActiveId(id: string): Promise<void> {
    await this.store.set(ACTIVE_KEY, id);
  }

  /** Remove a player's save. The caller moves the active pointer; this only removes the save (ft_1_07, admin). */
  async deleteProfile(id: string): Promise<void> {
    // The old record, then the profile document, then the rest: a delete cut short never lists the player again (core_11).
    await this.store.remove(PROFILE_PREFIX + id);
    for (const name of SAVE_DOCUMENT_NAMES) await this.store.remove(documentKey(id, name));
  }

  async createProfile(name: string): Promise<ProfileData> {
    const profile = this.newProfile(name);
    await this.save(profile);
    return profile;
  }

  /** A new player as `createProfile` makes it, not saved: the stand-in a new install shows until the first name is given (ft_1_07.AC1). */
  newProfile(name: string): ProfileData {
    const profile = emptyProfile(this.idFactory(), name.trim() || t('profile.blankName'), this.now().toISOString());
    profile.settings.noteNaming = defaultNoteNaming(language());
    return profile;
  }

  async load(id: string): Promise<LoadResult> {
    const profileText = await this.store.get(documentKey(id, 'profile'));
    if (profileText === null) return this.moveRecord(id);
    const practiceLogText = await this.store.get(documentKey(id, 'practiceLog'));
    // The profile document is written last, so without its log this is not a finished save: move again from the record, if there is one.
    if (practiceLogText === null && (await this.store.get(PROFILE_PREFIX + id)) !== null) {
      await this.backUp(`${id}-profile`, profileText); // kept, in case the profile had moved on since the record
      return this.moveRecord(id);
    }
    const core = readDocument(this.docs.profile, profileText);
    if (!core.ok) return { ok: false, reason: 'corrupt', errors: core.errors, backupKey: await this.backUp(`${id}-profile`, profileText) };
    // A missing or unreadable practice log costs the bar history, never the player: the player loads with an
    // empty log, a damaged log is copied aside first, and the next save writes a fresh one.
    const log = practiceLogText === null ? null : readDocument(this.docs.practiceLog, practiceLogText);
    if (log?.ok) return { ok: true, profile: joinProfile(core.value, log.value) };
    if (practiceLogText !== null) await this.backUp(`${id}-practiceLog`, practiceLogText);
    return { ok: true, profile: joinProfile(core.value, this.docs.practiceLog.empty()) };
  }

  /**
   * The players whose profile cannot be read (a damaged save, copied aside by `load`): listed apart so the menu can show them
   * instead of leaving them out without a word. The name is what the damaged text still holds, or empty.
   */
  async damagedProfiles(): Promise<{ id: string; name: string }[]> {
    const damaged: { id: string; name: string }[] = [];
    for (const id of await this.playerIds()) {
      const loaded = await this.load(id);
      if (loaded.ok || loaded.reason !== 'corrupt') continue;
      const text = (await this.store.get(documentKey(id, 'profile'))) ?? (await this.store.get(PROFILE_PREFIX + id));
      damaged.push({ id, name: nameIn(text) });
    }
    return damaged;
  }

  /**
   * The one-time move (core_11.AC2): a record of before the split is migrated as before and written as the documents (the
   * world and the curriculum empty); the record itself stays untouched until the next release (d136).
   */
  private async moveRecord(id: string): Promise<LoadResult> {
    const loaded = await this.loadRecord(id);
    if (!loaded.ok) return loaded;
    await this.writeDocuments(loaded.profile, { world: this.docs.world.empty(), curriculum: this.docs.curriculum.empty() });
    return loaded;
  }

  private async loadRecord(id: string): Promise<LoadResult> {
    const raw = await this.store.get(PROFILE_PREFIX + id);
    if (raw === null) return { ok: false, reason: 'missing' };
    let parsed: unknown;
    let errors: string[] = [];
    try {
      parsed = JSON.parse(raw);
    } catch (e) {
      errors = [`not valid JSON: ${e instanceof Error ? e.message : String(e)}`];
    }
    if (errors.length === 0) {
      const result = parseProfile(parsed, this.config);
      if (result.ok) return { ok: true, profile: result.profile };
      errors = result.errors;
    }
    return { ok: false, reason: 'corrupt', errors, backupKey: await this.backUp(id, raw) };
  }

  /**
   * Copy a damaged save aside, once: a profile is read on every start (listing, then loading), and a new copy each time
   * would fill the browser's storage with the same text. A save that changed since its last copy is copied again.
   */
  private async backUp(id: string, raw: string): Promise<string> {
    const prefix = `${PREFIX}corrupt/${id}-`;
    for (const key of await this.store.keys(prefix)) {
      // `<id>-<time>` only: the backups of a profile whose id starts with this id and a dash are not this one's.
      if (/^\d+$/.test(key.slice(prefix.length)) && (await this.store.get(key)) === raw) return key;
    }
    const backupKey = `${prefix}${this.now().getTime()}`;
    await this.store.set(backupKey, raw);
    return backupKey;
  }

  /**
   * Writes the practice-log and profile documents, the profile last: a profile document means its practice log was written
   * (a move or save cut short is found and redone, core_11.AC2). The world and the curriculum are written alone (`saveDocument`).
   */
  async save(profile: ProfileData): Promise<void> {
    const { core, practiceLog } = splitProfile(profile);
    await this.store.set(documentKey(profile.id, 'practiceLog'), this.docs.practiceLog.serialize(practiceLog));
    await this.store.set(documentKey(profile.id, 'profile'), this.docs.profile.serialize(core));
  }

  /** Every document, the profile last (it marks the move as done). */
  private async writeDocuments(profile: ProfileData, rest: Pick<PlayerDocuments, 'world' | 'curriculum'>): Promise<void> {
    await this.saveDocument(profile.id, 'world', rest.world);
    await this.saveDocument(profile.id, 'curriculum', rest.curriculum);
    await this.save(profile);
  }

  /** One document of a player alone (the world, the curriculum); a missing one is its empty value. */
  async loadDocument<N extends 'world' | 'curriculum'>(id: string, name: N): Promise<{ ok: true; value: PlayerDocuments[N] } | { ok: false; errors: string[] }> {
    const doc = this.docs[name] as SaveDocument<PlayerDocuments[N]>;
    return readDocument(doc, await this.store.get(documentKey(id, name)));
  }

  /** Writes one document alone; the others stay byte for byte as they were (core_11.AC4). */
  async saveDocument<N extends 'world' | 'curriculum'>(id: string, name: N, value: PlayerDocuments[N]): Promise<void> {
    const doc = this.docs[name] as SaveDocument<PlayerDocuments[N]>;
    await this.store.set(documentKey(id, name), doc.serialize(value));
  }

  /** The active profile. With no player yet it makes the seeded players (`seedNames`), or else "Player 1"; also when the active one is gone. */
  async loadActiveOrCreate(): Promise<ProfileData> {
    const activeId = await this.getActiveId();
    if (activeId) {
      const loaded = await this.load(activeId);
      if (loaded.ok) return loaded.profile;
    }
    const existing = (await this.listProfiles())[0];
    if (!existing && this.seedNames.length > 0) return this.seedPlayers();
    if (existing) {
      const loaded = await this.load(existing.id);
      if (loaded.ok) {
        await this.setActiveId(existing.id);
        return loaded.profile;
      }
    }
    const created = await this.createProfile(t('profile.defaultName', { n: 1 }));
    await this.setActiveId(created.id);
    return created;
  }

  /**
   * Make the seeded players. Their creation times are a millisecond apart, so the list keeps the order given (the list
   * sorts by creation time).
   */
  private async seedPlayers(): Promise<ProfileData> {
    const start = this.now().getTime();
    const made = this.seedNames.map((name, i) => emptyProfile(this.idFactory(), name, new Date(start + i).toISOString()));
    for (const profile of made) await this.save(profile);
    await this.setActiveId(made[0]!.id);
    return made[0]!;
  }

  /** The player as a JSON text for backup or moving to another device: every document, each with its version (core_11.AC3). */
  async exportProfile(id: string): Promise<string> {
    const loaded = await this.load(id);
    if (!loaded.ok) throw new Error(`profile ${id} cannot be exported: ${loaded.reason}`);
    const { core, practiceLog } = splitProfile(loaded.profile);
    const world = await this.loadDocument(id, 'world');
    const curriculum = await this.loadDocument(id, 'curriculum');
    if (!world.ok || !curriculum.ok) throw new Error(`profile ${id} cannot be exported: ${[...(world.ok ? [] : world.errors), ...(curriculum.ok ? [] : curriculum.errors)].join('; ')}`);
    const documents = {
      profile: JSON.parse(this.docs.profile.serialize(core)) as unknown,
      practiceLog: JSON.parse(this.docs.practiceLog.serialize(practiceLog)) as unknown,
      world: JSON.parse(this.docs.world.serialize(world.value)) as unknown,
      curriculum: JSON.parse(this.docs.curriculum.serialize(curriculum.value)) as unknown,
    };
    return `${JSON.stringify({ format: EXPORT_FORMAT, exportVersion: EXPORT_VERSION, exportedAt: this.now().toISOString(), documents }, null, 2)}\n`;
  }

  /** The player in an export: version 1 holds one profile (migrated as a record of before), version 2 the documents. */
  private readExport(wrapper: { exportVersion: number; profile?: unknown; documents?: unknown }): { ok: true; profile: ProfileData; rest: Pick<PlayerDocuments, 'world' | 'curriculum'> } | { ok: false; errors: string[] } {
    if (wrapper.exportVersion < 2) {
      const parsed = parseProfile(wrapper.profile, this.config);
      return parsed.ok ? { ok: true, profile: parsed.profile, rest: { world: this.docs.world.empty(), curriculum: this.docs.curriculum.empty() } } : parsed;
    }
    const documents = (typeof wrapper.documents === 'object' && wrapper.documents !== null ? wrapper.documents : {}) as Record<string, unknown>;
    if (documents.profile === undefined) return { ok: false, errors: ['the export has no profile document'] };
    const text = (name: SaveDocumentName) => (documents[name] === undefined ? null : JSON.stringify(documents[name]));
    const core = readDocument(this.docs.profile, text('profile'));
    const log = readDocument(this.docs.practiceLog, text('practiceLog'));
    const world = readDocument(this.docs.world, text('world'));
    const curriculum = readDocument(this.docs.curriculum, text('curriculum'));
    if (!core.ok || !log.ok || !world.ok || !curriculum.ok) {
      return { ok: false, errors: [core, log, world, curriculum].flatMap((r) => (r.ok ? [] : r.errors)) };
    }
    return { ok: true, profile: joinProfile(core.value, log.value), rest: { world: world.value, curriculum: curriculum.value } };
  }

  /**
   * Read an export. `mode: "new"` stores it as a new profile (a new id, so nothing is overwritten); `"replace"` keeps its id
   * and overwrites the saved profile with that id. Older save versions are migrated.
   */
  async importProfile(text: string, mode: 'new' | 'replace'): Promise<ProfileImportResult> {
    let doc: unknown;
    try {
      doc = JSON.parse(text);
    } catch (e) {
      return { ok: false, errors: [`not valid JSON: ${e instanceof Error ? e.message : String(e)}`] };
    }
    const wrapper = doc as { format?: unknown; exportVersion?: unknown; profile?: unknown; documents?: unknown } | null;
    if (!wrapper || wrapper.format !== EXPORT_FORMAT) return { ok: false, errors: [`not a Pianor profile export (format should be "${EXPORT_FORMAT}")`] };
    if (typeof wrapper.exportVersion !== 'number' || wrapper.exportVersion > EXPORT_VERSION) {
      return { ok: false, errors: [`export version ${String(wrapper.exportVersion)} is newer than this game understands`] };
    }
    const parsed = this.readExport({ ...wrapper, exportVersion: wrapper.exportVersion });
    if (!parsed.ok) return { ok: false, errors: parsed.errors };
    const profile = mode === 'new' ? { ...parsed.profile, id: this.idFactory() } : parsed.profile;
    await this.writeDocuments(profile, parsed.rest);
    return { ok: true, profile };
  }
}

/** The player's name a save's text still holds, when it parses and has one; otherwise empty. */
function nameIn(text: string | null): string {
  try {
    const name = (JSON.parse(text ?? '') as { name?: unknown } | null)?.name;
    return typeof name === 'string' ? name.trim() : '';
  } catch {
    return '';
  }
}
