import { parseFrontMatter } from './frontmatter.ts';
import { classify } from './items.ts';
import type { Issue } from './lint.ts';
import type { Repo } from './repo.ts';
import { plainMeta } from './schemas.ts';

/**
 * Staleness tracking (docs/decisions/workflow.md#d041). A doc that describes code lists the paths it covers in its
 * front matter (`covers`, git pathspecs) and the commit it was last checked against (`verified_against`, set by
 * `npm run docs:verify -- <doc>` after a person has re-read it). A doc is stale when those paths changed since.
 */
export interface Tracked {
  path: string;
  covers: string[];
  verifiedAgainst: string | null;
  lastReviewed: string | null;
}

export function trackedDocs(repo: Repo): Tracked[] {
  const out: Tracked[] = [];
  for (const [path, text] of repo.docs) {
    const fm = parseFrontMatter(text);
    if (fm.kind !== 'ok') continue;
    const covers = fm.data['covers'];
    if (!Array.isArray(covers) || covers.length === 0) continue;
    const verified = fm.data['verified_against'];
    const reviewed = fm.data['last_reviewed'];
    out.push({
      path,
      covers: covers.filter((c): c is string => typeof c === 'string'),
      verifiedAgainst: typeof verified === 'string' ? verified : null,
      lastReviewed: typeof reviewed === 'string' ? reviewed : null,
    });
  }
  return out;
}

export interface Staleness {
  path: string;
  /** Never verified, or the files changed since the verified commit. */
  reason: 'never verified' | 'covered files changed';
  changed: string[];
  lastReviewed: string | null;
}

/** `changedSince(commit, covers)` lists the files under `covers` that changed after the commit (git, injected for tests). */
export function staleDocs(tracked: Tracked[], changedSince: (commit: string, covers: string[]) => string[]): Staleness[] {
  const stale: Staleness[] = [];
  for (const doc of tracked) {
    if (doc.verifiedAgainst === null) {
      stale.push({ path: doc.path, reason: 'never verified', changed: [], lastReviewed: doc.lastReviewed });
      continue;
    }
    const changed = changedSince(doc.verifiedAgainst, doc.covers);
    if (changed.length > 0) stale.push({ path: doc.path, reason: 'covered files changed', changed, lastReviewed: doc.lastReviewed });
  }
  return stale;
}

export function reportStale(stale: Staleness[], total: number): string {
  if (stale.length === 0) return `${total} tracked doc(s), none stale`;
  const lines = stale.map((s) =>
    s.reason === 'never verified'
      ? `${s.path}: never verified (read it, then npm run docs:verify -- ${s.path})`
      : `${s.path}: ${s.changed.length} covered file(s) changed since it was verified${s.lastReviewed ? ` (${s.lastReviewed})` : ''}, e.g. ${s.changed.slice(0, 3).join(', ')}`,
  );
  return [...lines, '', `${stale.length} of ${total} tracked doc(s) need a look`].join('\n');
}

/** Docs that are not items (architecture, testing, ...) may have front matter, but only the tracking fields and a title. */
export function lintPlainDocs(repo: Repo): Issue[] {
  const issues: Issue[] = [];
  for (const [path, text] of repo.docs) {
    if (classify(path)) continue;
    const fm = parseFrontMatter(text);
    if (fm.kind === 'none') continue;
    if (fm.kind === 'error') {
      issues.push({ severity: 'error', file: path, line: 1, message: fm.message });
      continue;
    }
    const parsed = plainMeta.safeParse(fm.data);
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      issues.push({ severity: 'error', file: path, line: 1, message: `front matter: ${issue?.path.join('.') || 'value'}: ${issue?.message ?? 'invalid'}` });
    }
  }
  return issues;
}
