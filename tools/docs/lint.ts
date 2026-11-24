import { posix } from 'node:path';
import { lintPlainDocs } from './stale.ts';
import { lintCriteria } from './criteria.ts';
import { lintCompleteness } from './completeness.ts';
import { lintLocalLinks } from './remarkLinks.ts';
import { lintPrivacy } from './privacy.ts';
import { lintTags } from './tags.ts';
import { lintLedgerChecks } from './ledgerChecks.ts';
import { lintOldWords } from './oldWords.ts';
import { missingBlocks, expandAll, readItems } from './generate.ts';
import type { Item } from './items.ts';
import type { Repo } from './repo.ts';
import { anchorsOf, codeSpans, linesOf, withoutCode } from './scan.ts';
import { FEATURE_ID_IN_TEXT, type FeatureMeta } from './schemas.ts';

export interface Issue {
  severity: 'error' | 'warning';
  file: string;
  line?: number;
  message: string;
}

/** A line that says a path is not there yet may name it. */
const PLANNED = /\b(planned|will be|not yet|future|not built|does not exist|after the mvp)\b/i;

const error = (file: string, message: string, line?: number): Issue => ({ severity: 'error', file, message, ...(line === undefined ? {} : { line }) });

/** Ids that exist: every item file's id. A part id (`ft_0_09a`) also counts when its feature exists. */
export function knownIds(items: Item[]): (id: string) => boolean {
  const ids = new Set(items.map((i) => i.fileId));
  return (id) => ids.has(id) || (/[a-z]$/.test(id) && ids.has(id.slice(0, -1)));
}

/** Item front matter, ids, file names and references between items. */
export function lintItems(items: Item[]): Issue[] {
  const issues: Issue[] = [];
  const exists = knownIds(items);
  const seen = new Map<string, string>();
  for (const item of items) {
    const earlier = seen.get(item.fileId);
    if (earlier) issues.push(error(item.path, `id ${item.fileId} is also used by ${earlier}`));
    seen.set(item.fileId, item.path);
    if (item.problem || !item.meta) {
      issues.push(error(item.path, item.problem ?? 'front matter missing', 1));
      continue;
    }
    if (item.meta.id !== item.fileId) issues.push(error(item.path, `front matter id "${item.meta.id}" does not match the file name (${item.fileId})`, 2));
    const firstHeading = linesOf(item.body).find((l) => !l.fenced && /^# /.test(l.text));
    if (!firstHeading || !firstHeading.text.startsWith(`# ${item.fileId}:`)) {
      issues.push(error(item.path, `the first heading must start with "# ${item.fileId}:"`, firstHeading?.n));
    }
    const refs: [string, unknown][] = [
      ['depends_on', item.meta.depends_on],
      ['features', item.kind === 'decision' ? item.meta.features : undefined],
    ];
    for (const [field, value] of refs) {
      for (const id of Array.isArray(value) ? (value as string[]) : []) {
        if (id !== 'all' && !exists(id)) issues.push(error(item.path, `${field} names ${id}, which has no file`));
      }
    }
  }
  return issues;
}

/**
 * What remark-validate-links does not check (see remarkLinks.ts): headings in other markdown files, and file paths
 * written in inline code. Links to files and to headings in the same file are left to the plugin.
 */
export function lintLinks(repo: Repo): Issue[] {
  const issues: Issue[] = [];
  const anchors = new Map<string, Set<string>>();
  const anchorsFor = (path: string): Set<string> | null => {
    const text = repo.docs.get(path);
    if (text === undefined) return null;
    if (!anchors.has(path)) anchors.set(path, anchorsOf(text));
    return anchors.get(path) as Set<string>;
  };
  for (const [file, text] of repo.docs) {
    const dir = posix.dirname(file);
    for (const line of linesOf(text)) {
      if (line.fenced || line.ignored) continue;
      for (const m of withoutCode(line.text).matchAll(/\[[^\]]*\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g)) {
        const target = m[1] as string;
        if (/^(https?:|mailto:)/.test(target)) continue;
        const [rawPath = '', fragment] = target.split('#');
        if (rawPath === '' || !fragment) continue;
        const path = posix.normalize(posix.join(dir, rawPath));
        const found = anchorsFor(path);
        if (found && !found.has(fragment)) issues.push(error(file, `link ${target} points at a heading that does not exist`, line.n));
      }
      for (const span of codeSpans(line.text)) {
        const path = span.replace(/:\d+(-\d+)?$/, '');
        // a file on someone's machine or in a session folder is not in a clone of the repo, planned or not
        if (/^(\/(mnt|home|tmp|Users)\/|~\/|[A-Za-z]:\\)/.test(path)) {
          issues.push(error(file, `\`${span}\` is outside the repository; put the file in the repo or name it in words`, line.n));
          continue;
        }
        if (PLANNED.test(line.text)) continue;
        if (/^(docs|src|tools|tests|content|public|\.github)\/[\w./@-]+$/.test(path)) {
          if (!repo.paths.has(path.replace(/\/$/, ''))) issues.push(error(file, `\`${span}\` does not exist`, line.n));
        } else if (/^(core|game|io)\/[\w/@-]+(\.[\w]+)*\/?$/.test(path) && !['', '.ts'].some((ext) => repo.paths.has(`src/${path.replace(/\/$/, '')}${ext}`))) {
          // CLAUDE.md and the docs name source files without src/ ("game/MenuScene.ts"), modules also without .ts
          issues.push(error(file, `\`${span}\` does not exist (as src/${path})`, line.n));
        }
      }
    }
  }
  return issues;
}

/** Feature, decision and authoring ids named in text must exist (renames leave stale ids behind). */
export function lintIds(repo: Repo, items: Item[]): Issue[] {
  const issues: Issue[] = [];
  const exists = knownIds(items);
  const check = (file: string, line: number, text: string, others: boolean): void => {
    for (const m of text.matchAll(FEATURE_ID_IN_TEXT)) {
      if (!exists(m[1] as string)) issues.push(error(file, `${m[1]} has no feature file`, line));
    }
    if (!others) return;
    for (const m of text.matchAll(/\b(d\d{3}|au\d{2})\b/g)) {
      if (!exists(m[1] as string)) issues.push(error(file, `${m[1]} has no file`, line));
    }
  };
  for (const [file, text] of repo.docs) {
    for (const line of linesOf(text)) if (!line.ignored) check(file, line.n, line.text, true);
  }
  for (const [file, text] of repo.sources) {
    text.split('\n').forEach((line, i) => {
      if (!line.includes('docs:ignore')) check(file, i + 1, line, false);
    });
  }
  return issues;
}

/** The numbering before d037 (`FT17`, `WP9`) is gone from every doc. */
export function lintOldIds(repo: Repo): Issue[] {
  const issues: Issue[] = [];
  for (const [file, text] of repo.docs) {
    for (const line of linesOf(text)) {
      if (line.ignored) continue;
      for (const m of line.text.matchAll(/\b(?:FT\d\d[a-d]?|WP\d{1,2}[a-d]?)\b/g)) issues.push(error(file, `${m[0]} is the old numbering; use the id from docs/decisions/workflow.md#d037`, line.n));
    }
  }
  return issues;
}

/** `npm run X` in the docs must be a real script, and CLAUDE.md must list every script. */
export function lintScripts(repo: Repo): Issue[] {
  const issues: Issue[] = [];
  for (const [file, text] of repo.docs) {
    for (const line of linesOf(text)) {
      if (line.ignored) continue;
      for (const m of line.text.matchAll(/npm run ([\w:.-]+)/g)) {
        if (!repo.scripts.has(m[1] as string)) issues.push(error(file, `npm run ${m[1]} is not a script in package.json`, line.n));
      }
    }
  }
  const claude = repo.docs.get('CLAUDE.md') ?? '';
  for (const script of repo.scripts) {
    const lifecycle = ['prepare', 'postinstall'].includes(script) && claude.includes(`\`${script}\``);
    if (!lifecycle && !claude.includes(`npm run ${script}`) && !(script === 'test' && claude.includes('npm test'))) {
      issues.push(error('CLAUDE.md', `the Commands list does not mention the script "${script}"`));
    }
  }
  return issues;
}

/** The generated blocks must be present and up to date. */
export function lintGenerated(repo: Repo): Issue[] {
  const { changed, errors } = expandAll(repo);
  return [
    ...errors.map((message) => error('docs', message)),
    ...missingBlocks(repo).map((message) => error('docs', message)),
    ...[...changed.keys()].map((file) => error(file, 'generated blocks are out of date (run npm run docs:index)')),
  ];
}

export async function lintDocs(repo: Repo): Promise<Issue[]> {
  const items = readItems(repo);
  return [
    ...lintItems(items),
    ...lintPlainDocs(repo),
    ...(await lintLocalLinks(repo)),
    ...lintLinks(repo),
    ...lintIds(repo, items),
    ...lintScripts(repo),
    ...lintOldIds(repo),
    ...lintCriteria(repo, items),
    ...lintCompleteness(items.filter((i) => i.kind === 'feature' && i.meta).map((i) => ({ meta: i.meta as unknown as FeatureMeta, path: i.path }))),
    ...lintGenerated(repo),
    ...lintPrivacy(repo),
    ...lintLedgerChecks(repo),
    ...lintOldWords(repo),
    ...lintTags(repo),
  ];
}

