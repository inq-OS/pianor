import type { LevelDefinition } from '../chart';
import type { StyleList } from '../properties/styles';
import { compilePiece, type CompileResult } from './compile';
import { difficultyOf, type Difficulty } from './difficulty';
import { hasErrors, type Diagnostic } from './diagnostics';
import { lintPiece } from './lintRules';

/** Half stars (d157; in the Beginner grade the steps of d138) between a confirmed difficulty and the estimator's proposal that earn a warning (core_08.AC4). */
export const DIFFICULTY_MISMATCH = 2;

export interface PieceTextInput {
  /** The folder the piece lives in; its name must equal the meta `id`. Null for text that is not saved yet (a scratch piece). */
  folder: string | null;
  abc: string;
  meta: string;
  levels: readonly LevelDefinition[];
  /** The closed style list (`content/pieces/styles.json`); the caller reads it, so this module stays free of content files. */
  styles: StyleList;
  /** The piece is an own piece kept in `private/pieces/` (or in the browser): licence "NaN" is accepted without a warning. */
  privatePiece?: boolean;
}

export interface PieceCheck {
  abcFile: string;
  metaFile: string;
  compiled: CompileResult;
  /** Everything reported in order: compile problems, folder and level problems, then the linter. */
  diagnostics: Diagnostic[];
  /** The linter's part of `diagnostics`; empty when the piece could not be linted. */
  lint: Diagnostic[];
  level: LevelDefinition | null;
  /** Levels the piece passes without errors; empty when it could not be linted. */
  fitsLevels: number[];
  difficulty: Difficulty | null;
  /** True when the piece compiled, belongs to its folder and level, and has no error of any kind. */
  ok: boolean;
}

/**
 * Compile and lint a piece from the text of its two files. Pure (no file access), so the CLIs, the dev server and the
 * preview page in the browser all run exactly the same check.
 */
export function checkPiece(input: PieceTextInput): PieceCheck {
  const name = input.folder ?? 'scratch';
  const abcFile = `${name}/piece.abc`;
  const metaFile = `${name}/piece.meta.json`;
  const compiled = compilePiece({ abc: input.abc, meta: input.meta, abcFile, metaFile });
  const check: PieceCheck = { abcFile, metaFile, compiled, diagnostics: [...compiled.diagnostics], lint: [], level: null, fitsLevels: [], difficulty: null, ok: false };
  const { chart, meta } = compiled;
  if (meta && input.folder !== null && meta.id !== input.folder) {
    check.diagnostics.push({ severity: 'error', file: metaFile, message: `id "${meta.id}" must match the folder name "${input.folder}"` });
    return check;
  }
  if (!chart || !meta || hasErrors(compiled.diagnostics)) return check;

  const level = input.levels.find((l) => l.level === meta.level) ?? null;
  if (!level) {
    check.diagnostics.push({ severity: 'error', file: metaFile, message: `level ${meta.level} is not defined in levels.json`, rule: 'level' });
    return check;
  }
  const lintAt = (l: LevelDefinition) => lintPiece({ chart, meta, level: l, sources: compiled.sources, abcFile, metaFile, styles: input.styles, ...(input.privatePiece ? { privatePiece: true } : {}) });
  check.level = level;
  check.lint = lintAt(level);
  check.diagnostics.push(...check.lint);
  check.fitsLevels = input.levels.filter((l) => !hasErrors(lintAt(l))).map((l) => l.level);
  check.difficulty = difficultyOf(chart);
  if (meta.difficulty !== undefined && Math.abs(meta.difficulty - check.difficulty.scale) >= DIFFICULTY_MISMATCH) {
    const lint = { severity: 'warning', file: metaFile, rule: 'difficulty', message: `difficulty ${meta.difficulty} is far from the estimator's ${check.difficulty.scale}: check the number, or tell core_08 what it missed` } as const;
    check.lint.push(lint);
    check.diagnostics.push(lint);
  }
  check.ok = !hasErrors(check.diagnostics);
  return check;
}
