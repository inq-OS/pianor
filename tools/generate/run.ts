import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseArgs } from 'node:util';
import { pieceMetaSchema, type LevelDefinition } from '../../src/core/chart/index.ts';
import { checkPieceFolder, listPieceFolders } from '../piece/folder.ts';
import { loadLevelsFile } from '../piece/levels.ts';
import { GENERATOR_KINDS, BadRequest, GenerateError, generatePiece, regenerate, type GenerateRequest, type Generated, type GeneratorKind } from './index.ts';
import { referenceWindows } from './similarity.ts';

/** Where a CLI writes its lines. */
export interface Output {
  out(line: string): void;
  err(line: string): void;
}

/** Write the two files of a piece into `<piecesDir>/<id>/`. Refuses to replace a folder that exists unless `force`. */
export function writeGenerated(piecesDir: string, piece: Generated, options: { force?: boolean }): { folder: string } {
  const folder = join(piecesDir, piece.id);
  if (existsSync(folder) && options.force !== true) throw new Error(`${folder} already exists (use --force to replace it)`);
  mkdirSync(folder, { recursive: true });
  writeFileSync(join(folder, 'piece.abc'), piece.abc);
  writeFileSync(join(folder, 'piece.meta.json'), piece.metaJson);
  return { folder };
}

/**
 * The runs of eight notes of every piece in the folder that no generator made: what a new piece must not repeat. A piece a
 * generator made is left out, so making a piece again does not collide with itself.
 */
export function loadAvoid(piecesDir: string, levels: readonly LevelDefinition[]): Set<string> {
  const charts = listPieceFolders(piecesDir).flatMap((folder) => {
    try {
      const meta = JSON.parse(readFileSync(join(piecesDir, folder, 'piece.meta.json'), 'utf-8')) as { generator?: { kind?: string } };
      if ((GENERATOR_KINDS as readonly string[]).includes(meta.generator?.kind ?? '')) return [];
    } catch {
      return []; // not readable: the lint report says why
    }
    const chart = checkPieceFolder(piecesDir, folder, levels).compiled?.chart;
    return chart ? [chart] : [];
  });
  return referenceWindows(charts);
}

export const HELP = `Usage:
  piece:generate <kind> --level N [--seed S] [--hand RH|LH|both] [--bars N] [--meter 3/4]
                 [--pattern runs|skips|pairs] [--motif "0 1 2 1"]
                 [--out content/pieces] [--levels content/curriculum/levels.json] [--print] [--force] [--no-avoid]
  piece:generate --regenerate <id> [--force]
  piece:generate --list

kinds: ${GENERATOR_KINDS.join(', ')}`;

const DESCRIPTIONS: Record<GeneratorKind, string> = {
  'five-finger': 'runs, skips of a third or repeated pairs over the five notes of the hand position',
  scale: 'a scale up and down the hand register',
  'reading-drill': 'a random walk over the hand position for reading practice (rests and eighths where the level has them)',
  echo: 'a call and its echo; with --hand both the right hand calls and the left answers an octave lower',
  phrase: 'a 4 or 8 bar tune built from one motif (--motif "0 1 2 1" is C D E D)',
};

/** The `piece:generate` command. Returns the exit code: 0 done, 1 the piece differs or a file exists, 2 a bad request. */
export function runCli(argv: string[], io: Output): number {
  let parsed;
  try {
    parsed = parseArgs({
      args: argv,
      allowPositionals: true,
      options: {
        level: { type: 'string' }, seed: { type: 'string' }, hand: { type: 'string' }, bars: { type: 'string' }, meter: { type: 'string' },
        pattern: { type: 'string' }, motif: { type: 'string' }, out: { type: 'string' }, levels: { type: 'string' },
        print: { type: 'boolean' }, force: { type: 'boolean' }, 'no-avoid': { type: 'boolean' }, list: { type: 'boolean' }, regenerate: { type: 'string' }, help: { type: 'boolean' },
      },
    });
  } catch (e) {
    io.err(`${e instanceof Error ? e.message : String(e)}\n${HELP}`);
    return 2;
  }
  const { values, positionals } = parsed;
  if (values.help) {
    io.out(HELP);
    return 0;
  }
  if (values.list) {
    for (const kind of GENERATOR_KINDS) io.out(`${kind.padEnd(14)} ${DESCRIPTIONS[kind]}`);
    return 0;
  }

  const piecesDir = values.out ?? 'content/pieces';
  const { levels, diagnostics } = loadLevelsFile(values.levels ?? 'content/curriculum/levels.json');
  if (diagnostics.some((d) => d.severity === 'error')) {
    io.err(`the level table has errors: ${diagnostics.map((d) => d.message).join('; ')}`);
    return 2;
  }
  const avoid = values['no-avoid'] ? undefined : loadAvoid(piecesDir, levels);
  const context = { levels, ...(avoid ? { avoid } : {}) };

  try {
    if (values.regenerate !== undefined) return runRegenerate(values.regenerate, piecesDir, context, values.force === true, io);

    const kind = positionals[0];
    if (kind === undefined) {
      io.err(`say which generator to use\n${HELP}`);
      return 2;
    }
    if (values.level === undefined || !/^\d+$/.test(values.level)) {
      io.err(`--level N is required (a level number from the level table)\n${HELP}`);
      return 2;
    }
    const number = (text: string | undefined, name: string) => {
      if (text === undefined) return undefined;
      if (!/^\d+$/.test(text)) throw new BadRequest(`${name} must be a whole number, not "${text}"`);
      return Number(text);
    };
    const seed: string | number = values.seed === undefined ? Math.floor(Math.random() * 1_000_000) : /^\d+$/.test(values.seed) ? Number(values.seed) : values.seed;
    const request: GenerateRequest = {
      kind: kind as GeneratorKind, level: Number(values.level), seed,
      ...(values.hand !== undefined ? { hand: values.hand as 'RH' | 'LH' | 'both' } : {}),
      ...(values.bars !== undefined ? { bars: number(values.bars, '--bars')! } : {}),
      ...(values.meter !== undefined ? { meter: values.meter } : {}),
      ...(values.pattern !== undefined ? { pattern: values.pattern as 'runs' } : {}),
      ...(values.motif !== undefined ? { motif: values.motif } : {}),
    };
    const piece = generatePiece(request, context);
    if (values.print) {
      io.out(piece.abc);
      io.out(piece.metaJson);
      return 0;
    }
    const { folder } = writeGenerated(piecesDir, piece, { force: values.force === true });
    io.out(`Wrote ${folder} (piece.abc, piece.meta.json): "${piece.title}", level ${request.level}, seed ${seed}, ${piece.attempts} candidate(s) tried.`);
    io.out('It passed the linter with no error and no warning. It is a draft: listen to it, play it and approve it with npm run piece:preview.');
    return 0;
  } catch (e) {
    if (e instanceof BadRequest) {
      io.err(e.message);
      return 2;
    }
    if (e instanceof GenerateError || (e instanceof Error && /already exists/.test(e.message))) {
      io.err(e.message);
      return 1;
    }
    throw e;
  }
}

function runRegenerate(id: string, piecesDir: string, context: Parameters<typeof generatePiece>[1], force: boolean, io: Output): number {
  const folder = join(piecesDir, id);
  if (!existsSync(join(folder, 'piece.meta.json'))) {
    io.err(`there is no piece "${id}" in ${piecesDir}`);
    return 2;
  }
  let raw: unknown;
  try {
    raw = JSON.parse(readFileSync(join(folder, 'piece.meta.json'), 'utf-8'));
  } catch (e) {
    io.err(`the meta file of "${id}" is not valid: ${e instanceof Error ? e.message : String(e)}`);
    return 2;
  }
  const meta = pieceMetaSchema.safeParse(raw);
  if (!meta.success) {
    io.err(`the meta file of "${id}" is not valid: ${meta.error.issues[0]?.message}`);
    return 2;
  }
  let again: Generated;
  try {
    again = regenerate(meta.data, context);
  } catch (e) {
    if (e instanceof BadRequest) {
      io.err(`"${id}" is not a generator piece: ${e.message}`);
      return 2;
    }
    throw e;
  }
  const same = readFileSync(join(folder, 'piece.abc'), 'utf-8') === again.abc && readFileSync(join(folder, 'piece.meta.json'), 'utf-8') === again.metaJson;
  if (same) {
    io.out(`"${id}" is identical to what the generator makes now.`);
    return 0;
  }
  if (!force) {
    io.out(`"${id}" differs from what the generator makes now (the files were edited, or the generator changed). Use --force to replace the files.`);
    return 1;
  }
  writeGenerated(piecesDir, again, { force: true });
  io.out(`Replaced "${id}" with what the generator makes now. Its status is draft again: review it before approving.`);
  return 0;
}
