import type { ZodType } from 'zod';
import { parseFrontMatter } from './frontmatter.ts';
import { authoringMeta, decisionMeta, featureMeta, playtestMeta } from './schemas.ts';

/** The doc folders whose files are items listed in an index (docs/decisions/workflow.md#d152). */
export type Kind = 'feature' | 'decision' | 'authoring' | 'playtest';

export const KINDS: Record<Kind, { dir: string; index: string; file: RegExp; schema: ZodType<{ id: string }> }> = {
  feature: { dir: 'docs/features', index: 'FEATURES.md', file: /^((?:core_\d{2}|ft_[0-9Y]_\d{2}[a-z]?))-[\w-]+\.md$/, schema: featureMeta },
  decision: { dir: 'docs/decisions', index: 'DECISIONS.md', file: /^(d\d{3})-[\w-]+\.md$/, schema: decisionMeta },
  authoring: { dir: 'docs/authoring', index: 'AUTHORING.md', file: /^(au\d{2})-[\w-]+\.md$/, schema: authoringMeta },
  playtest: { dir: 'docs/playtests', index: 'PLAYTESTS.md', file: /^(pt\d{2})-[\w-]+\.md$/, schema: playtestMeta },
};

export interface Item {
  kind: Kind;
  /** Repo-relative path with forward slashes. */
  path: string;
  /** The file name inside its folder. */
  file: string;
  /** The id the file name carries. */
  fileId: string;
  /** The validated front matter, when it is valid. */
  meta: ({ id: string } & Record<string, unknown>) | null;
  /** What is wrong with the front matter, if anything. */
  problem: string | null;
  body: string;
}

/** Which kind a repo-relative path belongs to, with the id its name carries; null for index files and other docs. */
export function classify(path: string): { kind: Kind; fileId: string } | null {
  for (const [kind, spec] of Object.entries(KINDS) as [Kind, (typeof KINDS)[Kind]][]) {
    const prefix = spec.dir + '/';
    if (!path.startsWith(prefix)) continue;
    const match = spec.file.exec(path.slice(prefix.length));
    if (match) return { kind, fileId: match[1] as string };
  }
  return null;
}

/**
 * A decision ledger (d152): any Markdown file in docs/decisions/ other than the index. Each decision is one entry:
 *
 *     ## d095
 *
 *     **The piece is the player's.** Features: ft_1_21, core_12. Supersedes d057.
 *
 *     The rule, in a few sentences.
 *
 * Its link is `<ledger>.md#d095`. The entry runs to the next `## ` heading.
 */
export function isLedger(path: string): boolean {
  const prefix = `${KINDS.decision.dir}/`;
  if (!path.startsWith(prefix) || !path.endsWith('.md')) return false;
  const name = path.slice(prefix.length);
  return !name.includes('/') && name !== KINDS.decision.index;
}

const ENTRY_HEAD = /^## (d\d{3})\s*$/;
const ENTRY_LINE = /^\*\*(.+?)\*\* Features: ([^.]*)\.(?: Supersedes ((?:d\d{3}(?:, )?)+)\.)?/;

export function readLedger(path: string, text: string): Item[] {
  const file = path.slice(path.lastIndexOf('/') + 1);
  const lines = parseFrontMatter(text).body.split('\n');
  const items: Item[] = [];
  for (let i = 0; i < lines.length; i++) {
    const head = ENTRY_HEAD.exec(lines[i] as string);
    if (!head) continue;
    const id = head[1] as string;
    let end = i + 1;
    while (end < lines.length && !(lines[end] as string).startsWith('## ')) end++;
    const entry = lines.slice(i + 1, end);
    const first = entry.find((l) => l.trim() !== '') ?? '';
    const base = { kind: 'decision' as const, path, file: `${file}#${id}`, fileId: id };
    const m = ENTRY_LINE.exec(first);
    if (!m) {
      items.push({ ...base, meta: null, problem: `${id}: the entry must start with "**Title.** Features: ids or none." (no date: the id orders the entries, git keeps the day; d165)`, body: '' });
    } else {
      const features = (m[2] as string).trim() === 'none' ? [] : (m[2] as string).split(',').map((f) => f.trim()).filter(Boolean);
      const raw: Record<string, unknown> = { id, title: (m[1] as string).replace(/\.$/, ''), features };
      if (m[3]) raw.supersedes = m[3].split(',').map((f) => f.trim());
      const parsed = KINDS.decision.schema.safeParse(raw);
      const body = `# ${id}: ${raw.title as string}\n\n${entry.join('\n')}`;
      if (parsed.success) items.push({ ...base, meta: parsed.data, problem: null, body });
      else items.push({ ...base, meta: null, problem: `${id}: ${parsed.error.issues[0]?.path.join('.') ?? ''}: ${parsed.error.issues[0]?.message ?? 'invalid'}`, body });
    }
    i = end - 1;
  }
  return items;
}

export function readItem(path: string, text: string): Item | null {
  const found = classify(path);
  if (!found) return null;
  const fm = parseFrontMatter(text);
  const base = { kind: found.kind, path, file: path.slice(path.lastIndexOf('/') + 1), fileId: found.fileId, body: fm.body };
  if (fm.kind === 'none') return { ...base, meta: null, problem: 'no front matter (see docs/decisions/workflow.md#d041)' };
  if (fm.kind === 'error') return { ...base, meta: null, problem: fm.message };
  const parsed = KINDS[found.kind].schema.safeParse(fm.data);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return { ...base, meta: null, problem: `front matter: ${issue?.path.join('.') || 'value'}: ${issue?.message ?? 'invalid'}` };
  }
  return { ...base, meta: parsed.data, problem: null };
}
