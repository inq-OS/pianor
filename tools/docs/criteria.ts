import type { Item } from './items.ts';
import type { Issue } from './lint.ts';
import type { Repo } from './repo.ts';
import { linesOf } from './scan.ts';

/**
 * Acceptance criteria tied to tests (docs/decisions/workflow.md#d041). A feature file lists criteria as
 * `- **ft_0_08.AC1** text`; a test, a source file or a config file that covers one says `ft_0_08.AC1` in a comment or a
 * test title. A criterion that needs a person ends with `[human]` and need not be covered by code.
 */
export interface Criterion {
  id: string;
  feature: string;
  text: string;
  human: boolean;
  file: string;
  line: number;
  /** The files that mention it. */
  coveredBy: string[];
}

const DEFINITION = /^- \*\*((?:core_\d{2}|ft_[0-9Y]_\d{2}[a-z]?)\.AC\d+)\*\*:? (.+)$/;
const REFERENCE = /\b((?:core_\d{2}|ft_[0-9Y]_\d{2}[a-z]?)\.AC\d+)\b/g;

export function criteriaOf(items: Item[]): Criterion[] {
  const found: Criterion[] = [];
  for (const item of items) {
    if (item.kind !== 'feature') continue;
    for (const line of linesOf(item.body)) {
      if (line.fenced) continue;
      const m = DEFINITION.exec(line.text);
      if (!m) continue;
      const text = m[2] as string;
      found.push({ id: m[1] as string, feature: item.fileId, text, human: /\[human\]/.test(text), file: item.path, line: line.n, coveredBy: [] });
    }
  }
  return found;
}

/** Which source files mention which criterion. */
export function referencesOf(repo: Repo): Map<string, string[]> {
  const refs = new Map<string, string[]>();
  for (const [file, text] of repo.sources) {
    for (const m of text.matchAll(REFERENCE)) {
      const list = refs.get(m[1] as string) ?? [];
      if (!list.includes(file)) list.push(file);
      refs.set(m[1] as string, list);
    }
  }
  return refs;
}

export function coverage(repo: Repo, items: Item[]): Criterion[] {
  const refs = referencesOf(repo);
  return criteriaOf(items).map((c) => ({ ...c, coveredBy: refs.get(c.id) ?? [] }));
}

/**
 * Errors: a criterion defined in the wrong file or twice, a reference to a criterion that does not exist, and a feature
 * that is marked done with no tagged criteria at all, or while one of its criteria has neither a test nor `[human]`.
 */
export function lintCriteria(repo: Repo, items: Item[]): Issue[] {
  const issues: Issue[] = [];
  const all = coverage(repo, items);
  const ids = new Set<string>();
  for (const c of all) {
    if (!c.id.startsWith(`${c.feature}.`)) issues.push({ severity: 'error', file: c.file, line: c.line, message: `criterion ${c.id} must start with ${c.feature}` });
    if (ids.has(c.id)) issues.push({ severity: 'error', file: c.file, line: c.line, message: `criterion ${c.id} is defined twice` });
    ids.add(c.id);
  }
  for (const [id, files] of referencesOf(repo)) {
    if (!ids.has(id)) issues.push({ severity: 'error', file: files[0] as string, message: `${id} is not a criterion in any feature file` });
  }
  const done = new Set(items.filter((i) => i.kind === 'feature' && typeof i.meta?.['effort'] === 'string' && (i.meta['effort']).startsWith('done')).map((i) => i.fileId));
  const tagged = new Set(all.map((c) => c.feature));
  for (const item of items) {
    if (done.has(item.fileId) && !tagged.has(item.fileId)) {
      issues.push({ severity: 'error', file: item.path, message: `${item.fileId} is done but lists no tagged acceptance criteria (- **${item.fileId}.AC1** text)` });
    }
  }
  for (const c of all) {
    if (done.has(c.feature) && !c.human && c.coveredBy.length === 0) {
      issues.push({ severity: 'error', file: c.file, line: c.line, message: `${c.feature} is done but ${c.id} has no test that names it (add the id to a test, or mark the criterion [human])` });
    }
  }
  return issues;
}

/** The text of `npm run docs:criteria`. */
export function reportCriteria(repo: Repo, items: Item[]): string {
  const all = coverage(repo, items);
  const tagged = new Set(all.map((c) => c.feature));
  const features = items.filter((i) => i.kind === 'feature');
  const lines = all.map((c) => `${c.coveredBy.length > 0 ? 'covered ' : c.human ? 'human   ' : 'OPEN    '} ${c.id}  ${c.coveredBy.join(', ')}`);
  lines.push('', `${tagged.size} of ${features.length} feature files have tagged criteria; the others still have a plain Accept paragraph.`);
  return lines.join('\n');
}
