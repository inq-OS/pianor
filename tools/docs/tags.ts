import type { Issue } from './lint.ts';
import type { Repo } from './repo.ts';

/**
 * Work tags (d214, `docs/automation/todo-tags.md`): in a doc a tag names its project and, for a `TODO`, may name its
 * release; in code a tag only points at the doc that holds it (`TODO(painter, R2) in ft_1_32`). Code spans and fenced
 * blocks in a doc are examples, not tags.
 */
const TAG = /\b(ASAP|TODO|IDEA)\(([^)]*)\)/g;
const FORM = /^(?:builder|painter|architect)(?:, (?:R[1-5]|Later))?$/;
const POINTER = /^\s*(?:`\s*)?in (?:ft_[\dY]_\d{2}[a-z]?|core_\d{2}|docs\/)/;
const CODE = /^(?:src|tools|tests)\/.*\.(?:ts|js|mjs|py)$/;

export function lintTags(repo: Repo): Issue[] {
  const issues: Issue[] = [];
  for (const [file, text] of repo.docs) {
    let fenced = false;
    text.split('\n').forEach((line, i) => {
      if (line.trimStart().startsWith('```')) fenced = !fenced;
      if (fenced) return;
      for (const m of line.replace(/`[^`]*`/g, ' ').matchAll(TAG)) {
        if (!FORM.test(m[2] as string)) issues.push({ severity: 'error', file, line: i + 1, message: `${m[0]}: a tag is ${m[1]}(builder|painter|architect[, R1 to R5 or Later]) (d214)` });
      }
    });
  }
  for (const [file, text] of repo.sources) {
    if (!CODE.test(file) || file.startsWith('tools/docs/')) continue;
    text.split('\n').forEach((line, i) => {
      for (const m of line.matchAll(TAG)) {
        const after = line.slice((m.index ?? 0) + m[0].length);
        if (!POINTER.test(after)) issues.push({ severity: 'error', file, line: i + 1, message: `${m[0]}: a tag in code only points at its doc ("${m[0]} in ft_X_YY"); write the tag there (d214)` });
      }
    });
  }
  return issues;
}
