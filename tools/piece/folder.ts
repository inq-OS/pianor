import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';
import type { LevelDefinition } from '../../src/core/chart/index.ts';
import { checkPiece, type PieceCheck } from '../../src/core/piece/check.ts';
import type { CompileResult } from '../../src/core/piece/compile.ts';
import type { Diagnostic } from '../../src/core/piece/diagnostics.ts';
import { contentStyles } from './styles.ts';

/** Folders of `piecesDir` that hold a `piece.abc`, in name order. */
export function listPieceFolders(piecesDir: string): string[] {
  if (!existsSync(piecesDir)) return [];
  return readdirSync(piecesDir)
    .filter((name) => statSync(join(piecesDir, name)).isDirectory() && existsSync(join(piecesDir, name, 'piece.abc')))
    .sort();
}

/** True for a `private/pieces` folder (the gitignored home of own pieces), however the path is written. */
export function isPrivatePiecesDir(piecesDir: string): boolean {
  const dir = resolve(piecesDir);
  return basename(dir) === 'pieces' && basename(dirname(dir)) === 'private';
}

export interface PieceFolderCheck extends Omit<PieceCheck, 'compiled'> {
  folder: string;
  /** The compile result; null when the meta file is missing. */
  compiled: CompileResult | null;
}

/**
 * Read `<piecesDir>/<folder>/piece.abc` and `piece.meta.json` and check them (`checkPiece`). The one place that turns a
 * piece folder into a checked piece (the CLIs and the dev server use it); the check itself works on text.
 */
export function checkPieceFolder(piecesDir: string, folder: string, levels: readonly LevelDefinition[]): PieceFolderCheck {
  const abcFile = `${folder}/piece.abc`;
  const metaFile = `${folder}/piece.meta.json`;
  const metaPath = join(piecesDir, folder, 'piece.meta.json');
  if (!existsSync(metaPath)) {
    const missing: Diagnostic = { severity: 'error', file: metaFile, message: 'missing: every piece needs a piece.meta.json next to piece.abc' };
    return { folder, abcFile, metaFile, compiled: null, diagnostics: [missing], lint: [], level: null, fitsLevels: [], difficulty: null, ok: false };
  }
  const check = checkPiece({
    styles: contentStyles,
    folder, levels,
    abc: readFileSync(join(piecesDir, folder, 'piece.abc'), 'utf-8'),
    meta: readFileSync(metaPath, 'utf-8'),
    ...(isPrivatePiecesDir(piecesDir) ? { privatePiece: true } : {}),
  });
  return { ...check, folder };
}
