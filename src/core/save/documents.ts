/**
 * The four save documents of a player (core_11, WP-03; d136; contract A.2): `profile`, `practiceLog`, `world` and
 * `curriculum`, each with its own `schemaVersion` (starting at 1), its own frozen migration steps and golden fixtures
 * (`tests/fixtures/saves/documents/`). The repository (`src/core/progression/repository.ts`) reads and writes them, one
 * key each, through `KeyValueStore`. Pure: no storage here.
 */
import { z } from 'zod';
import type { Curriculum } from '../curriculum/curriculum';
import type { WorldState } from '../island/worldState';
import { formatIssues } from '../issues';
import type { ProgressionConfig } from '../progression/config';
import { parseProfile } from '../progression/migrate';
import { practiceLogSchema, type PracticeLog } from '../progression/practiceLog';
import { PROFILE_SCHEMA_VERSION, type ProfileData } from '../progression/profile';
import { upgradeToCurrent } from '../upgrade';
import type { SaveDocument, SaveDocumentName } from './document';

export type { SaveDocument, SaveDocumentName } from './document';

/** Every document, in the order they are written and exported. */
export const SAVE_DOCUMENT_NAMES: readonly SaveDocumentName[] = ['profile', 'practiceLog', 'world', 'curriculum'];

/** A stored document that cannot be read: not JSON, not valid, or from a newer game. Old data never throws. */
export class SaveDocumentError extends Error {}

type Raw = Record<string, unknown> & { schemaVersion: number };
type Migration = SaveDocument<unknown>['migrations'][number];

/** Builds a document from its version, its steps and a validator of the current shape. */
function document<T>(
  name: SaveDocumentName,
  schemaVersion: number,
  migrations: readonly Migration[],
  empty: () => T,
  validate: (current: Record<string, unknown>) => T,
): SaveDocument<T> {
  const self: SaveDocument<T> = {
    name,
    schemaVersion,
    migrations,
    empty,
    parse(text) {
      if (text === null) return empty();
      let raw: unknown;
      try {
        raw = JSON.parse(text);
      } catch (e) {
        throw new SaveDocumentError(`${name}: not valid JSON: ${e instanceof Error ? e.message : String(e)}`);
      }
      const upgraded = upgradeToCurrent(raw, (from) => {
        const step = migrations.find((m) => m.from === from);
        return step && ((doc) => step.migrate(doc) as Raw);
      }, schemaVersion, {
        noVersion: `${name}: no schemaVersion`,
        newer: (version, understood) => `${name}: version ${version} is newer than this game understands (${understood})`,
        noStep: (version) => `${name}: no migration from version ${version}`,
      }, (message) => new SaveDocumentError(message));
      const value: Record<string, unknown> = { ...upgraded };
      delete value.schemaVersion;
      return validate(value);
    },
    serialize: (value) => JSON.stringify({ schemaVersion, ...value }),
  };
  return self;
}

function check<S extends z.ZodType>(name: SaveDocumentName, schema: S, value: unknown): z.infer<S> {
  const result = schema.safeParse(value);
  if (!result.success) throw new SaveDocumentError(`${name}: ${formatIssues(result.error).join('; ')}`);
  return result.data;
}

/** A document's stored text read without throwing: the value, or why it cannot be read. */
export function readDocument<T>(doc: SaveDocument<T>, text: string | null): { ok: true; value: T } | { ok: false; errors: string[] } {
  try {
    return { ok: true, value: doc.parse(text) };
  } catch (e) {
    return { ok: false, errors: [e instanceof Error ? e.message : String(e)] };
  }
}

/** The profile document's value: the profile without its old record version and without the practice log. */
export type ProfileCore = Omit<ProfileData, 'schemaVersion' | 'practice'>;

/**
 * The profile record version a version-1 profile document holds. Frozen (d064): a change to the profile after the split
 * is a step of this document (its version 2, d136), never a new profile record version (core_11.AC5).
 */
export const PROFILE_DOCUMENT_V1_HOLDS = 17;

/** The profile document: everything the profile held, less the practice log (d136). Needs the XP rules to validate. */
export function profileDocument(config: ProgressionConfig): SaveDocument<ProfileCore> {
  return document<ProfileCore>('profile', 1, [], () => {
    throw new SaveDocumentError('profile: a player has no empty profile; create one with the repository');
  }, (value) => {
    const parsed = parseProfile({ ...value, schemaVersion: PROFILE_DOCUMENT_V1_HOLDS, practice: { bars: [] } }, config);
    if (!parsed.ok) throw new SaveDocumentError(`profile: ${parsed.errors.join('; ')}`);
    return splitProfile(parsed.profile).core;
  });
}

/** The practice log document (core_10, d092). */
export const practiceLogDocument: SaveDocument<PracticeLog> = document<PracticeLog>(
  'practiceLog', 1, [], () => ({ bars: [] }), (value) => check('practiceLog', practiceLogSchema, value),
);

const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'a day is YYYY-MM-DD');

const worldStateSchema = z.object({
  flags: z.array(z.string().min(1)),
  items: z.array(z.string().min(1)),
  met: z.record(z.string().min(1), z.object({
    firstDay: day,
    lastDay: day,
    generatedName: z.string().min(1).exactOptional(),
    taught: z.array(z.string().min(1)),
    taughtOn: z.record(z.string().min(1), day).exactOptional(),
    tugs: z.object({ won: z.int().min(0), lost: z.int().min(0), bestLevel: z.union([z.literal(0), z.literal(1), z.literal(2), z.literal(3)]) }),
    lastLostTug: z.object({ piece: z.string().min(1), at: z.string().min(1) }).exactOptional(),
  })),
  teacherVisits: z.array(z.object({ day, piece: z.string().min(1), result: z.enum(['passed', 'notYet']) })),
});

/** The world document: `WorldState` (ft_1_25, WP-08; contract A.8). */
export const worldDocument: SaveDocument<WorldState> = document<WorldState>(
  'world', 1, [], () => ({ flags: [], items: [], met: {}, teacherVisits: [] }), (value) => check('world', worldStateSchema, value),
);

/** A time of day, `HH:MM` (24 h). */
const clock = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'a time of day is HH:MM');

const curriculumSchema = z.object({
  base: z.number().min(0).max(100),
  pieces: z.array(z.object({
    piece: z.string().min(1),
    deadline: day,
    priority: z.int().min(1).max(10),
    overrides: z.object({
      base: z.number().min(0).max(100).exactOptional(),
      lastPlays: z.int().min(1).exactOptional(),
      retain: z.object({ atLeast: z.number(), belowAtMost: z.number(), byAtMost: z.number() }).exactOptional(),
    }).exactOptional(),
  })),
  calendar: z.array(z.object({
    day,
    kind: z.enum(['deadline', 'lesson', 'test', 'note']),
    text: z.string().exactOptional(),
    piece: z.string().min(1).exactOptional(),
    time: clock.exactOptional(),
  })),
  // ft_1_26.AC9: added without a version step (d069.3); absent, the defaults (Sunday and Wednesday, from the day's start)
  testWeekdays: z.array(z.int().min(0).max(6)).exactOptional(),
  testTime: clock.exactOptional(),
});

/** The curriculum document: `Curriculum` (core_12, WP-04; contract A.12). Base 85 by d139. */
export const curriculumDocument: SaveDocument<Curriculum> = document<Curriculum>(
  'curriculum', 1, [], () => ({ base: 85, pieces: [], calendar: [] }), (value) => check('curriculum', curriculumSchema, value),
);

/** The profile as the game holds it, split into what the profile and practice-log documents store. */
export function splitProfile(profile: ProfileData): { core: ProfileCore; practiceLog: PracticeLog } {
  const { practice, ...rest } = profile;
  const core: Partial<ProfileData> = { ...rest };
  delete core.schemaVersion;
  return { core: core as ProfileCore, practiceLog: practice };
}

/** The two documents joined into the profile the game holds. */
export function joinProfile(core: ProfileCore, practiceLog: PracticeLog): ProfileData {
  return { ...core, schemaVersion: PROFILE_SCHEMA_VERSION, practice: practiceLog };
}
