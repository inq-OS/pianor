/**
 * `docs:schema-versions`: one row per persisted or loaded format with its current `schemaVersion`, read from the code. A bump
 * changes the rendered table, so `npm run docs:check` fails until `npm run docs:index` has rewritten it, and two pull requests
 * that bump the same format clash in the doc as well as in the code (d069: one shared bump per round).
 */
import { z } from 'zod';
import { scenarioFileSchema } from '../../src/dev/autoplay/scenario.ts';
import { ladderSchema } from '../../src/core/campaign/content.ts';
import { CHART_SCHEMA_VERSION, levelsFileSchema, pieceMetaSchema } from '../../src/core/chart/index.ts';
import { PIECE_FILE_VERSION } from '../../src/core/editor/pieceFile.ts';
import { progressionConfigSchema } from '../../src/core/progression/config.ts';
import { modifierTableSchema } from '../../src/core/progression/modifiers.ts';
import { PROFILE_SCHEMA_VERSION } from '../../src/core/progression/profile.ts';
import { styleListSchema } from '../../src/core/properties/styles.ts';
import { xpBankConfigSchema } from '../../src/core/scoring/xpBankContent.ts';
import { trainerStepsSchema } from '../../src/core/trainer/steps.ts';
import { worldSchema } from '../../src/core/world/world.ts';
import { earLevelsSchema } from '../../src/core/trainer/earLevels.ts';
import { characterDefSchema } from '../../src/core/character/character.ts';
import { conversationSchema } from '../../src/core/dialogue/conversation.ts';
import { actorDefSchema } from '../../src/core/scene/actor.ts';
import { sceneDataSchema } from '../../src/core/scene/scene.ts';
import { scriptSchema } from '../../src/core/scene/script.ts';
import { OWN_PIECE_FORMAT } from '../../src/game/editor/OwnPieces.ts';
import type { Repo } from './repo.ts';

export interface PersistedFormat {
  format: string;
  /** Where the data lives: a committed file (checked against the code when it is one file), a pattern, or browser storage. */
  where: string;
  /** The single committed file whose own `schemaVersion` must equal the code's; absent when there are many or none. */
  file?: string;
  /** The named constant that holds the version, or the schema whose `schemaVersion` literal is it. */
  holder: string;
  /** The file that defines `holder`. */
  source: string;
  version: number;
  /** The module that moves older versions forward, and the test that covers it; absent while the format is at its first version. */
  migration?: string;
  migrationTest?: string;
}

/** The `schemaVersion` literal of an object schema (also behind a `.default`), or an error. */
export function literalVersion(schema: z.ZodType): number {
  const json = z.toJSONSchema(schema, { io: 'input', unrepresentable: 'any' }) as { properties?: Record<string, { const?: unknown }> };
  const value = json.properties?.['schemaVersion']?.const;
  if (typeof value !== 'number') throw new Error('the schema has no numeric schemaVersion literal');
  return value;
}

const fromSchema = (holder: string, schema: z.ZodType) => ({ holder, version: literalVersion(schema) });

/** Every format the game writes or reads. A new format gets a row here; a new version moves its number by itself. */
export const PERSISTED_FORMATS: readonly PersistedFormat[] = [
  {
    format: 'Save data (profiles)', where: 'browser storage', holder: 'PROFILE_SCHEMA_VERSION', version: PROFILE_SCHEMA_VERSION,
    source: 'src/core/progression/profile.ts', migration: 'src/core/progression/migrate.ts', migrationTest: 'src/core/progression/migrate.test.ts',
  },
  {
    format: 'Chart', where: '`build/charts/*.chart.json`, `content/dev/charts/`', holder: 'CHART_SCHEMA_VERSION', version: CHART_SCHEMA_VERSION,
    source: 'src/core/chart/schema.ts', migration: 'src/core/chart/migrate.ts', migrationTest: 'src/core/chart/migrate.test.ts',
  },
  { format: 'Piece meta', where: '`content/pieces/*/piece.meta.json`', ...fromSchema('pieceMetaSchema', pieceMetaSchema), source: 'src/core/chart/schema.ts' },
  {
    format: 'Piece file (editor export)', where: '`*.pianor-piece.json` files a person saves', holder: 'PIECE_FILE_VERSION', version: PIECE_FILE_VERSION,
    source: 'src/core/editor/pieceFile.ts', migration: 'src/core/editor/migrate.ts', migrationTest: 'src/core/editor/pieceFile.test.ts',
  },
  {
    format: 'Own piece record (editor)', where: 'browser storage', holder: 'OWN_PIECE_FORMAT', version: OWN_PIECE_FORMAT,
    source: 'src/game/editor/OwnPieces.ts', migration: 'src/core/editor/migrate.ts', migrationTest: 'tests/editor/ownPieceFormat.test.ts',
  },
  { format: 'Level table', where: '`content/curriculum/levels.json`', file: 'content/curriculum/levels.json', ...fromSchema('levelsFileSchema', levelsFileSchema), source: 'src/core/chart/schema.ts' },
  { format: 'Progression', where: '`content/curriculum/progression.json`', file: 'content/curriculum/progression.json', ...fromSchema('progressionConfigSchema', progressionConfigSchema), source: 'src/core/progression/config.ts' },
  { format: 'Level modifiers', where: '`content/curriculum/modifiers.json`', file: 'content/curriculum/modifiers.json', ...fromSchema('modifierTableSchema', modifierTableSchema), source: 'src/core/progression/modifiers.ts' },
  { format: 'XP bank', where: '`content/curriculum/xpBank.json`', file: 'content/curriculum/xpBank.json', ...fromSchema('xpBankConfigSchema', xpBankConfigSchema), source: 'src/core/scoring/xpBankContent.ts' },
  { format: 'Campaign ladder', where: '`content/campaign/ladder.json`', file: 'content/campaign/ladder.json', ...fromSchema('ladderSchema', ladderSchema), source: 'src/core/campaign/content.ts' },
  { format: 'Trainer steps', where: '`content/trainer/steps.json`', file: 'content/trainer/steps.json', ...fromSchema('trainerStepsSchema', trainerStepsSchema), source: 'src/core/trainer/steps.ts' },
  { format: 'Ear levels', where: '`content/trainer/ear-levels.json`', file: 'content/trainer/ear-levels.json', ...fromSchema('earLevelsSchema', earLevelsSchema), source: 'src/core/trainer/earLevels.ts' },
  { format: 'Piece styles', where: '`content/pieces/styles.json`', file: 'content/pieces/styles.json', ...fromSchema('styleListSchema', styleListSchema), source: 'src/core/properties/styles.ts' },
  { format: 'World model of Keri', where: '`content/world/keri.json`', file: 'content/world/keri.json', ...fromSchema('worldSchema', worldSchema), source: 'src/core/world/world.ts' },
  { format: 'Scene (WP-01)', where: '`content/scenes/*.json`', ...fromSchema('sceneDataSchema', sceneDataSchema), source: 'src/core/scene/scene.ts' },
  { format: 'Actor (WP-01)', where: '`content/actors/*.json`', ...fromSchema('actorDefSchema', actorDefSchema), source: 'src/core/scene/actor.ts' },
  { format: 'Script (WP-01)', where: '`content/scripts/*.json`', ...fromSchema('scriptSchema', scriptSchema), source: 'src/core/scene/script.ts' },
  { format: 'Character (WP-01)', where: '`content/characters/*.json`', ...fromSchema('characterDefSchema', characterDefSchema), source: 'src/core/character/character.ts' },
  { format: 'Conversation (WP-01)', where: '`content/conversations/*.json`', ...fromSchema('conversationSchema', conversationSchema), source: 'src/core/dialogue/conversation.ts' },
  { format: 'Autoplay scenarios (dev)', where: '`content/dev/scenarios.json`', file: 'content/dev/scenarios.json', ...fromSchema('scenarioFileSchema', scenarioFileSchema), source: 'src/dev/autoplay/scenario.ts' },
];

const code = (text: string): string => `\`${text}\``;
/** A format past version 1 with no migration is committed content that was rewritten in the bump; nobody holds an old copy. */
const noMigration = (f: PersistedFormat): string => (f.version === 1 ? 'none yet' : 'none: committed file, rewritten in each bump');

/** The table, or every problem found: a file that is missing, or a committed file whose `schemaVersion` is not the code's. */
export function renderSchemaVersions(repo: Repo, formats: readonly PersistedFormat[] = PERSISTED_FORMATS): string | { error: string } {
  const problems: string[] = [];
  for (const f of formats) {
    for (const path of [f.source, f.migration, f.migrationTest, f.file]) {
      if (path !== undefined && repo.read(path) === null) problems.push(`${f.format}: ${path} does not exist`);
    }
    const text = f.file === undefined ? null : repo.read(f.file);
    if (text !== null) {
      let found: unknown;
      try {
        found = (JSON.parse(text) as { schemaVersion?: unknown }).schemaVersion;
      } catch {
        found = 'not JSON';
      }
      if (found !== f.version) problems.push(`${f.format}: ${f.file} has schemaVersion ${String(found)}, the code reads ${f.version}`);
    }
  }
  if (problems.length > 0) return { error: `docs:schema-versions: ${problems.join('; ')}` };
  const head = ['Format', 'Where', 'Version', 'Held by', 'Migration', 'Migration test'];
  const rows = formats.map((f) => [
    f.format,
    f.where,
    String(f.version),
    `${code(f.holder)} in ${code(f.source)}`,
    f.migration === undefined ? noMigration(f) : code(f.migration),
    f.migrationTest === undefined ? noMigration(f) : code(f.migrationTest),
  ]);
  const line = (cells: string[]): string => `| ${cells.join(' | ')} |`;
  return [line(head), `|${head.map(() => '---').join('|')}|`, ...rows.map(line)].join('\n');
}
