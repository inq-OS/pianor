import { midiToSpelling, noteName } from '../../src/core/chart/index.ts';
import { HELP } from '../generate/run.ts';
import { parseLevels } from '../../src/core/piece/levelsTable.ts';
import type { Repo } from './repo.ts';
import { SCHEMAS, renderSchema } from './schemaDoc.ts';
import { renderSchemaVersions } from './schemaVersions.ts';

type Block = (args: string[]) => string | { error: string };

const LEVELS_FILE = 'content/curriculum/levels.json';
const LEGAL_NOTE_VALUES = ['whole', 'dottedHalf', 'half', 'dottedQuarter', 'quarter', 'dottedEighth', 'eighth', 'sixteenth'];

const yes = (flag: boolean): string => (flag ? 'yes' : 'no');
const key = (midi: number): string => noteName(midiToSpelling(midi));

/** `docs:levels`: the level table as the linter reads it, rendered from content/curriculum/levels.json. */
export function renderLevels(text: string): string | { error: string } {
  const { levels, diagnostics } = parseLevels(text, LEVELS_FILE);
  const problem = diagnostics.find((d) => d.severity === 'error');
  if (problem) return { error: `docs:levels: ${LEVELS_FILE}: ${problem.message}` };
  const head = ['Level', 'Name', 'Hands', 'Clefs', 'Range', 'Note values', 'Rests', 'Meters', 'Largest leap (steps)', 'Hands together', 'Bars'];
  const rows = levels.map((l) => [
    String(l.level),
    l.name,
    l.hands.join(', '),
    l.clefs.join(', '),
    `${key(l.range.low)} to ${key(l.range.high)}`,
    LEGAL_NOTE_VALUES.filter((v) => (l.noteValues as string[]).includes(v)).join(', '),
    yes(l.rests),
    l.meters.map((m) => `${m.num}/${m.den}`).join(', '),
    String(l.maxLeapSteps),
    yes(l.handsTogether),
    `${l.bars.min} to ${l.bars.max}`,
  ]);
  const line = (cells: string[]): string => `| ${cells.join(' | ')} |`;
  return [line(head), `|${head.map(() => '---').join('|')}|`, ...rows.map(line)].join('\n');
}

/** The blocks that read the code or the content instead of the docs. */
export function customBlocks(repo: Repo): { levels: Block; usage: Block; schema: Block; 'schema-versions': Block } {
  return {
    levels: () => {
      const text = repo.read(LEVELS_FILE);
      return text === null ? { error: `docs:levels: ${LEVELS_FILE} does not exist` } : renderLevels(text);
    },
    schema: ([which]) => {
      const schema = which ? SCHEMAS[which] : undefined;
      return schema ? renderSchema(schema) : { error: `docs:schema: unknown schema "${which ?? ''}" (known: ${Object.keys(SCHEMAS).join(', ')})` };
    },
    'schema-versions': () => renderSchemaVersions(repo),
    usage: ([which]) => (which === 'generate' ? '```text\n' + HELP + '\n```' : { error: `docs:usage: unknown command "${which ?? ''}" (known: generate)` }),
  };
}
