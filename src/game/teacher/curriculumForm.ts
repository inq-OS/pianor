import type { DayString, PieceId } from '../../core/contracts';
import type { Curriculum, CurriculumPiece } from '../../core/curriculum/curriculum';
import { DEFAULT_EVALUATION_RULES, type EvaluationRules } from '../../core/curriculum/evaluate';

/**
 * Setting one curriculum piece on the teacher's screen (ft_1_26.AC3): a new piece's defaults, the fields she steps up and
 * down, and putting the piece into (or out of) the curriculum. Pure; `TeacherPieceScene` draws it.
 */

/** A new curriculum piece is due this many days from today. AX-3 provisional: two weeks, a usual stretch between lessons. */
export const NEW_PIECE_DAYS = 14;
/** A new curriculum piece's priority: the middle of 1 to 10. */
export const NEW_PIECE_PRIORITY = 5;

/** The fields she can step, in the order they are shown; the ones after `priority` are under "more". */
export const FIELDS = ['deadline', 'priority', 'base', 'lastPlays', 'atLeast', 'belowAtMost', 'byAtMost'] as const;
export type Field = (typeof FIELDS)[number];
/** The fields shown without "more". */
export const MAIN_FIELDS: readonly Field[] = ['deadline', 'priority'];
/** Each field's small and big step (days for the deadline). */
export const STEPS: Readonly<Record<Field, readonly [number, number]>> = {
  deadline: [1, 7], priority: [1, 1], base: [1, 5], lastPlays: [1, 5], atLeast: [1, 1], belowAtMost: [1, 1], byAtMost: [1, 5],
};

/** `day` moved by `days` calendar days. */
export function addDays(day: DayString, days: number): DayString {
  const [y, m, d] = day.split('-').map(Number) as [number, number, number];
  const moved = new Date(Date.UTC(y, m - 1, d + days));
  return moved.toISOString().slice(0, 10);
}

/** A piece newly put on the curriculum: due in two weeks, priority 5, no overrides. */
export function newCurriculumPiece(piece: PieceId, today: DayString): CurriculumPiece {
  return { piece, deadline: addDays(today, NEW_PIECE_DAYS), priority: NEW_PIECE_PRIORITY };
}

/** The numbers a piece is measured by: its overrides, else the curriculum's base and the rules' X, Y, Z and B. */
export function fieldValues(cp: CurriculumPiece, curriculum: Pick<Curriculum, 'base'>, rules: EvaluationRules = DEFAULT_EVALUATION_RULES): Record<Exclude<Field, 'deadline'>, number> {
  const retain = cp.overrides?.retain ?? rules.retain;
  return {
    priority: cp.priority, base: cp.overrides?.base ?? curriculum.base, lastPlays: cp.overrides?.lastPlays ?? rules.lastPlays,
    atLeast: retain.atLeast, belowAtMost: retain.belowAtMost, byAtMost: retain.byAtMost,
  };
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/**
 * `cp` with `field` moved by `by`, kept in range: the deadline not before today, priority 1 to 10 (A.12), the base 0 to 100,
 * X 3 to 30, Y and Z 0 to X, B 0 to 50. An override equal to the default is dropped, so a piece keeps only what she changed.
 */
export function stepField(
  cp: CurriculumPiece, field: Field, by: number, today: DayString, curriculum: Pick<Curriculum, 'base'>, rules: EvaluationRules = DEFAULT_EVALUATION_RULES,
): CurriculumPiece {
  if (field === 'deadline') {
    const moved = addDays(cp.deadline, by);
    return { ...cp, deadline: moved < today ? today : moved };
  }
  const v = fieldValues(cp, curriculum, rules);
  if (field === 'priority') return { ...cp, priority: clamp(v.priority + by, 1, 10) };
  const next = { ...v };
  if (field === 'base') next.base = clamp(v.base + by, 0, 100);
  if (field === 'lastPlays') next.lastPlays = clamp(v.lastPlays + by, 3, 30);
  if (field === 'atLeast') next.atLeast = clamp(v.atLeast + by, 0, next.lastPlays);
  if (field === 'belowAtMost') next.belowAtMost = clamp(v.belowAtMost + by, 0, next.lastPlays);
  if (field === 'byAtMost') next.byAtMost = clamp(v.byAtMost + by, 0, 50);
  next.atLeast = Math.min(next.atLeast, next.lastPlays);
  next.belowAtMost = Math.min(next.belowAtMost, next.lastPlays);
  const retain = { atLeast: next.atLeast, belowAtMost: next.belowAtMost, byAtMost: next.byAtMost };
  const sameRetain = retain.atLeast === rules.retain.atLeast && retain.belowAtMost === rules.retain.belowAtMost && retain.byAtMost === rules.retain.byAtMost;
  const overrides = {
    ...(next.base !== curriculum.base ? { base: next.base } : {}),
    ...(next.lastPlays !== rules.lastPlays ? { lastPlays: next.lastPlays } : {}),
    ...(sameRetain ? {} : { retain }),
  };
  const rest: CurriculumPiece = { piece: cp.piece, deadline: cp.deadline, priority: cp.priority };
  return Object.keys(overrides).length > 0 ? { ...rest, overrides } : rest;
}

/** The curriculum with `cp` in it: replacing the same piece where it was, or added at the end. */
export function withPiece(curriculum: Curriculum, cp: CurriculumPiece): Curriculum {
  const at = curriculum.pieces.findIndex((p) => p.piece === cp.piece);
  const pieces = at < 0 ? [...curriculum.pieces, cp] : curriculum.pieces.map((p, i) => (i === at ? cp : p));
  return { ...curriculum, pieces };
}

/** The curriculum without `piece`. */
export function withoutPiece(curriculum: Curriculum, piece: PieceId): Curriculum {
  return { ...curriculum, pieces: curriculum.pieces.filter((p) => p.piece !== piece) };
}
