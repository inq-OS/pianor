import type { LevelDefinition } from '../../src/core/chart';
import type { Difficulty } from '../../src/core/piece/difficulty';
import type { Diagnostic } from '../../src/core/piece/diagnostics';
import { dirname, join } from 'node:path';
import { pieceFactsOf, type PieceFacts } from '../../src/core/song/resolve';
import { checkPieceFolder, listPieceFolders } from './folder';
import { lintSongs } from './songs';

export interface PieceLint {
  id: string;
  level: number;
  difficulty: Difficulty;
  /** The `difficulty` a person confirmed in the meta file (d138), if any. */
  confirmedDifficulty?: number;
  /** Levels this piece passes without errors, so pieces can be matched to a level automatically. */
  fitsLevels: number[];
  diagnostics: Diagnostic[];
}

export interface LintReport {
  /** Pieces found (folders with a piece.abc). */
  pieces: number;
  linted: PieceLint[];
  /** Songs found (folders with a song.json) beside the pieces (ft_1_36 rule 14). */
  songs: number;
  /** Everything reported, including compile problems of pieces that could not be linted and the songs' problems. */
  diagnostics: Diagnostic[];
}

/**
 * Compile and lint every `<piecesDir>/<id>/piece.abc` against the level named in its meta file.
 * A piece that does not compile is reported but not linted; a piece whose level is missing from the table is an error.
 * Then every song in `songsDir` (by default `songs` beside the pieces folder) is checked against the pieces that compiled.
 */
export function lintPieces(piecesDir: string, levels: readonly LevelDefinition[], songsDir = join(dirname(piecesDir), 'songs')): LintReport {
  const report: LintReport = { pieces: 0, linted: [], songs: 0, diagnostics: [] };
  const facts = new Map<string, PieceFacts>();
  for (const folder of listPieceFolders(piecesDir)) {
    report.pieces++;
    const check = checkPieceFolder(piecesDir, folder, levels);
    report.diagnostics.push(...check.diagnostics);
    const { compiled, level, difficulty } = check;
    if (compiled?.chart) facts.set(compiled.chart.id, pieceFactsOf(compiled.chart));
    if (!compiled?.meta || !level || !difficulty) continue; // it did not compile, or its level is unknown: already reported
    const confirmed = compiled.meta.difficulty;
    report.linted.push({ id: compiled.meta.id, level: compiled.meta.level, difficulty, ...(confirmed === undefined ? {} : { confirmedDifficulty: confirmed }), fitsLevels: check.fitsLevels, diagnostics: check.lint });
  }
  const songs = lintSongs(songsDir, (id) => facts.get(id));
  report.songs = songs.songs.length;
  report.diagnostics.push(...songs.diagnostics);
  return report;
}
