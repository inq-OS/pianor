import { strings, t, type StringKey } from './strings';

/** How a piece's tag reads on its info card: its string key when there is one, otherwise the id with spaces for dashes. */
export function tagLabel(tag: string): string {
  const key = `tag.${tag}`;
  return key in strings ? t(key as StringKey) : tag.replace(/-/g, ' ');
}

/** A problem the piece checker found, as the editor gets it: the lint rule and bar when known, and the checker's own text. */
export interface PieceProblem {
  rule?: string;
  /** Counted from 1. */
  bar?: number;
  message: string;
}

/**
 * What the editor's status line says about a problem: the rule's string key with the bar in front when there is a key;
 * otherwise the checker's own (English) text, which already names the bar, so a new rule still says something useful.
 */
export function problemLabel(problem: PieceProblem): string {
  const key = `editor.problem.${problem.rule ?? ''}`;
  if (!(key in strings)) return problem.message;
  const text = t(key as StringKey);
  return problem.bar === undefined ? text : t('editor.problemAt', { bar: problem.bar, problem: text });
}

/** Which levels a piece fits, as one level or a range; null when it fits none. */
export function fitsLabel(levels: readonly number[]): string | null {
  if (levels.length === 0) return null;
  const from = levels[0]!;
  const to = levels[levels.length - 1]!;
  return from === to ? t('editor.fits', { levels: from }) : t('editor.fitsRange', { from, to });
}
