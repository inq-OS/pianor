/**
 * `npm run piece:import` (ft_Y_04 slice 2, the game importer): a MusicXML file becomes a draft game piece, `piece.abc` and
 * `piece.meta.json` in a piece folder, checked exactly as the game loads it. The reading is `src/core/import/musicxml.ts`,
 * the writing `src/core/import/toAbc.ts`; this module only chooses the folder, the meta file and the level, and talks
 * through a small `ImportIo` so it is tested with fakes (`piece-cli.ts` wires it to the files and the terminal).
 *
 * The default folder is the gitignored `private/pieces/`: the pieces students wish for are mostly copyrighted, so they stay
 * on this machine (licence "NaN", like an own piece) and the game plays them from there. `--out content/pieces` is for
 * pieces with an open licence, given with `--license` and `--source`; such a piece must pass the linter at a level, so
 * the CI stays green.
 */
import { basename, join } from 'node:path';
import { parseArgs } from 'node:util';
import type { LevelDefinition } from '../../src/core/chart';
import type { MusicXmlResult } from '../../src/core/import/musicxml';
import { chartToAbc } from '../../src/core/import/toAbc';
import { problemLabel } from '../../src/core/editor/fromChart';
import { cleanTitle } from '../../src/core/editor/abc';
import { layoutStaff } from '../../src/core/layout/staff';
import { checkPiece, type PieceCheck } from '../../src/core/piece/check';
import { formatDiagnostic } from '../../src/core/piece/diagnostics';
import { KNOWN_LICENSES } from '../../src/core/piece/lintRules';
import { unlimitedLevels } from '../../src/core/piece/levelsTable';
import { OWN_PIECE_LICENSE } from '../../src/core/chart/schema';
import type { CliArgs } from '../piece/cliArgs';
import { isPrivatePiecesDir } from '../piece/folder';
import { contentStyles } from '../piece/styles';

export const PRIVATE_PIECES = join('private', 'pieces');
const CONTENT_PIECES = join('content', 'pieces');

export const IMPORT_USAGE = [
  'usage: npm run piece:import -- <score.musicxml|.mxl|.xml> [--id <id>] [--title <title>] [--out <folder>]',
  '         [--license <licence> --source <where it is from>] [--rh <part>] [--lh <part>] [--force]',
  `  --out       the pieces folder (default ${PRIVATE_PIECES}, kept on this machine; content/pieces needs an open licence)`,
  `  --license   one of ${KNOWN_LICENSES.join(', ')} (needed for content/pieces)`,
  '  --rh, --lh  the part each hand plays, when the score has more than one (the refusal names them)',
  '  --force     replace a piece folder that is already there',
].join('\n');

export interface ImportArgs {
  file: string;
  out: string;
  id?: string;
  title?: string;
  license?: string;
  source?: string;
  rh?: string;
  lh?: string;
  force: boolean;
}

export function parseImportArgs(args: string[]): CliArgs<ImportArgs> {
  const options = {
    id: { type: 'string' }, title: { type: 'string' }, out: { type: 'string' }, license: { type: 'string' }, source: { type: 'string' },
    rh: { type: 'string' }, lh: { type: 'string' }, force: { type: 'boolean' }, help: { type: 'boolean', short: 'h' },
  } as const;
  try {
    const { values, positionals } = parseArgs({ args, options, allowPositionals: true, strict: true });
    if (values.help) return { kind: 'help' };
    if (positionals.length !== 1) return { kind: 'error', message: positionals.length === 0 ? 'name the score file to import' : `one score at a time: ${positionals.join(' ')}` };
    const { force, out, ...rest } = values;
    const given = Object.fromEntries(Object.entries(rest).filter(([k, v]) => k !== 'help' && v !== undefined)) as Omit<ImportArgs, 'file' | 'out' | 'force'>;
    return { kind: 'ok', file: positionals[0]!, out: out ?? PRIVATE_PIECES, force: force === true, ...given };
  } catch (e) {
    return { kind: 'error', message: e instanceof Error ? e.message : String(e) };
  }
}

/** A piece id from a title or file name: lowercase words joined by dashes. */
export function pieceIdOf(text: string): string {
  return text.toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40).replace(/-+$/, '') || 'imported-piece';
}

export interface ImportIo {
  readScore: (path: string) => MusicXmlResult;
  exists: (path: string) => boolean;
  write: (path: string, text: string) => void;
  levels: readonly LevelDefinition[];
  say: (line: string) => void;
}

/** True when the staff can draw the chart (the game leaves out a piece it cannot), else the reason. */
function drawProblem(check: PieceCheck): string | null {
  try {
    layoutStaff(check.compiled.chart!, { viewport: { width: 1280, height: 720 } });
    return null;
  } catch (e) {
    return e instanceof Error ? e.message : String(e);
  }
}

/** Who may receive the piece: an open licence and a source for the shared folder, none needed for the private one. */
function licenceProblem(args: ImportArgs, privateFolder: boolean): string | null {
  if (privateFolder) return null;
  if (!args.license || !KNOWN_LICENSES.includes(args.license)) {
    return `${args.out} is committed and shared, so it needs --license (one of ${KNOWN_LICENSES.join(', ')}) and --source; a piece that may not be shared goes in ${PRIVATE_PIECES} (the default)`;
  }
  if (!args.source) return `${args.out} needs --source: where the score comes from (a web page, a book, "own arrangement")`;
  return null;
}

type Written = Extract<ReturnType<typeof chartToAbc>, { ok: true }>;
type Read = Extract<MusicXmlResult, { ok: true }>;

/** The score read and written as ABC, or null after saying why not. */
function writeScore(args: ImportArgs, io: ImportIo): { read: Read; written: Written } | null {
  const read = io.readScore(args.file);
  if (!read.ok) return io.say(`Not imported: ${args.file} could not be read: ${read.reason}`), null;
  const tracks = { ...(args.rh ? { RH: args.rh } : {}), ...(args.lh ? { LH: args.lh } : {}) };
  const written = chartToAbc(read.chart, { ...(args.title ? { title: args.title } : {}), tracks });
  if (written.ok) return { read, written };
  io.say(`Not imported: ${written.reason}.`);
  for (const p of written.problems) io.say(`  ${problemLabel(p)}`);
  if (written.reason.includes('more than one part')) io.say('  Choose with --rh <part> and --lh <part>.');
  if (written.problems.length > 0) io.say('Fix these in the score (MuseScore opens MusicXML) and import it again.');
  return null;
}

/** The piece's folder, or null after saying why the id cannot be used. */
function folderOf(args: ImportArgs, io: ImportIo, id: string, privateFolder: boolean): string | null {
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(id)) return io.say(`Not imported: the id "${id}" must be lowercase words joined by dashes.`), null;
  const folder = join(args.out, id);
  if (io.exists(folder) && !args.force) return io.say(`Not imported: ${folder} is already there (--force replaces it, or give another --id).`), null;
  if (privateFolder && io.exists(join(CONTENT_PIECES, id))) return io.say(`Not imported: the game already has a piece "${id}" (give another --id).`), null;
  return folder;
}

/** False after saying why the checked piece cannot go into its folder: it does not compile, fails the linter in the shared folder, or cannot be drawn. */
function usable(check: PieceCheck, args: ImportArgs, io: ImportIo, privateFolder: boolean): boolean {
  if (!check.compiled.chart) {
    io.say('Not imported: the written piece does not compile (a fault in the importer, please report it):');
    for (const d of check.diagnostics) io.say(`  ${formatDiagnostic(d)}`);
    return false;
  }
  const errors = check.lint.filter((d) => d.severity === 'error');
  if (!privateFolder && errors.length > 0) {
    io.say(`Not imported: it fits no level of the curriculum, so piece:lint would fail on it in ${args.out}. Level ${check.level?.level} says:`);
    for (const d of errors) io.say(`  ${formatDiagnostic(d)}`);
    io.say(`A piece outside the curriculum goes in ${PRIVATE_PIECES} (the default), where the game plays it without the level limits.`);
    return false;
  }
  const drawn = drawProblem(check);
  if (drawn) return io.say(`Not imported: the staff cannot draw it yet (${drawn}), so the game would leave it out.`), false;
  return true;
}

/** What was written, the level and difficulty, every warning, and what the person does next. */
function report(check: PieceCheck, title: string, folder: string, warnings: readonly string[], hands: readonly string[], io: ImportIo, privateFolder: boolean): void {
  const chart = check.compiled.chart!;
  const level = check.level!.level;
  io.say(`Imported ${title} into ${folder}: ${chart.bars.length} bars, ${chart.notes.length} notes, ${hands.join(' and ')}.`);
  io.say(`Level ${level}${check.fitsLevels.length > 0 ? '' : ' (it fits no level: the level limits are shown, the game plays it anyway)'}; difficulty ${check.difficulty ? `${check.difficulty.scale} of 10` : 'not estimated'}.`);
  for (const w of warnings) io.say(`  warning: ${w}`);
  if (privateFolder) {
    // outside the curriculum the level limits only describe the piece: counted, not listed one by one
    const counts = new Map<string, number>();
    for (const d of check.lint.filter((x) => x.severity === 'error')) counts.set(d.rule ?? 'other', (counts.get(d.rule ?? 'other') ?? 0) + 1);
    if (counts.size > 0) io.say(`  past the limits of level ${level}: ${[...counts].map(([rule, n]) => `${rule} ${n}`).join(', ')}`);
  } else for (const d of check.lint) io.say(`  ${formatDiagnostic(d)}`);
  io.say(`It is a draft: \`npm run dev\` shows it. A person who has played it through sets "status": "approved" in ${join(folder, 'piece.meta.json')}, and the student's game has it.`);
}

/** Import one score; true when the piece folder was written. Says every step, refusal and warning through `io.say`. */
export function importPiece(args: ImportArgs, io: ImportIo): boolean {
  const privateFolder = isPrivatePiecesDir(args.out);
  const refusal = licenceProblem(args, privateFolder);
  if (refusal) return io.say(`Not imported: ${refusal}`), false;
  const score = writeScore(args, io);
  if (!score) return false;
  const { read, written } = score;
  // the reader names a score without a title after its file
  const title = cleanTitle(args.title ?? read.chart.title);
  const id = args.id ?? pieceIdOf(title);
  const folder = folderOf(args, io, id, privateFolder);
  if (!folder) return false;

  const levels = privateFolder ? unlimitedLevels(io.levels) : io.levels;
  const meta = (level: number) => JSON.stringify({
    id, title, level, ...(privateFolder ? { unlockLevel: 1 } : {}), status: 'draft', hands: written.hands, phrases: [], styles: [], tags: ['imported'],
    source: args.source ?? `imported from ${basename(args.file)}`, license: privateFolder ? args.license ?? OWN_PIECE_LICENSE : args.license!,
    generator: { kind: 'import', params: { format: 'musicxml', file: basename(args.file) } },
  }, null, 2);
  const check = (level: number) => checkPiece({ folder: id, abc: written.abc, meta: meta(level), levels, styles: contentStyles, ...(privateFolder ? { privatePiece: true } : {}) });
  const first = check(levels[0]!.level);
  const level = first.fitsLevels[0] ?? levels[levels.length - 1]!.level;
  const best = level === levels[0]!.level ? first : check(level);
  if (!usable(best, args, io, privateFolder)) return false;
  io.write(join(folder, 'piece.abc'), written.abc);
  io.write(join(folder, 'piece.meta.json'), `${meta(level)}\n`);
  report(best, title, folder, [...read.warnings, ...written.warnings], written.hands, io, privateFolder);
  return true;
}
