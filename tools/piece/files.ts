import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { compilePiece } from '../../src/core/piece/compile';
import { hasErrors, type Diagnostic } from '../../src/core/piece/diagnostics';
import { listPieceFolders } from './folder';

export interface BuildReport {
  /** Pieces found (directories with a piece.abc), built or not. */
  pieces: number;
  built: { id: string; file: string }[];
  diagnostics: Diagnostic[];
}

/**
 * Compile every `<piecesDir>/<id>/piece.abc` with its `piece.meta.json` into `<outDir>/<id>.chart.json`.
 * The folder name must equal the piece id. Pieces with errors are not written. Warnings never stop a build.
 */
export function buildPieces(piecesDir: string, outDir: string): BuildReport {
  const report: BuildReport = { pieces: 0, built: [], diagnostics: [] };
  const folders = listPieceFolders(piecesDir);

  for (const folder of folders) {
    report.pieces++;
    const abcFile = `${folder}/piece.abc`;
    const metaFile = `${folder}/piece.meta.json`;
    const metaPath = join(piecesDir, folder, 'piece.meta.json');
    if (!existsSync(metaPath)) {
      report.diagnostics.push({ severity: 'error', file: metaFile, message: 'missing: every piece needs a piece.meta.json next to piece.abc' });
      continue;
    }
    const result = compilePiece({
      abc: readFileSync(join(piecesDir, folder, 'piece.abc'), 'utf-8'),
      meta: readFileSync(metaPath, 'utf-8'),
      abcFile,
      metaFile,
    });
    report.diagnostics.push(...result.diagnostics);
    if (result.meta && result.meta.id !== folder) {
      report.diagnostics.push({ severity: 'error', file: metaFile, message: `id "${result.meta.id}" must match the folder name "${folder}"` });
      continue;
    }
    if (!result.chart || hasErrors(result.diagnostics)) continue;
    mkdirSync(outDir, { recursive: true });
    const file = join(outDir, `${result.chart.id}.chart.json`);
    writeFileSync(file, `${JSON.stringify(result.chart, null, 2)}\n`);
    report.built.push({ id: result.chart.id, file });
  }
  return report;
}
