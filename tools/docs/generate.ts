import { expandBlocks, listBlocks, type BlockRenderer } from './blocks.ts';
import { KINDS, isLedger, readItem, readLedger, type Item, type Kind } from './items.ts';
import { customBlocks } from './customBlocks.ts';
import { criteriaOf } from './criteria.ts';
import { renderAuthoring, renderCompleteness, renderDecisions, renderFeatures, renderPlaytests, type Listed } from './render.ts';
import type { AuthoringMeta, DecisionMeta, FeatureMeta, PlaytestMeta } from './schemas.ts';
import type { Repo } from './repo.ts';

/** The iteration tables of FEATURES.md, each with an index block (`<!-- docs:index features GROUP -->`). */
export const FEATURE_GROUPS = ['ft_0', 'core', 'ft_1', 'ft_Y'] as const;

export function readItems(repo: Repo): Item[] {
  const items: Item[] = [];
  for (const [path, text] of repo.docs) {
    if (isLedger(path) && !KINDS.decision.file.test(path.slice(path.lastIndexOf('/') + 1))) {
      items.push(...readLedger(path, text));
      continue;
    }
    const item = readItem(path, text);
    if (item) items.push(item);
  }
  return items;
}

function listed<T>(items: Item[], kind: Kind): Listed<T>[] {
  return items.filter((i) => i.kind === kind && i.meta !== null).map((i) => ({ meta: i.meta as T, file: i.file }));
}

/** Per feature id, how many of its acceptance criteria are marked `[human]`. */
function humanChecks(items: Item[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const c of criteriaOf(items)) if (c.human) counts.set(c.feature, (counts.get(c.feature) ?? 0) + 1);
  return counts;
}

/** Fenced code block of a file (or of a named region inside it), for `docs:include`. */
export function renderInclude(repo: Repo, args: string[]): string | { error: string } {
  const [target, ...rest] = args;
  if (!target) return { error: 'docs:include needs a path' };
  const [path = '', region] = target.split('#');
  const text = repo.read(path);
  if (text === null) return { error: `docs:include: ${path} does not exist` };
  let lines = text.replace(/\r\n/g, '\n').replace(/\n$/, '').split('\n');
  if (region) {
    const start = lines.findIndex((l) => l.includes(`docs:region ${region}`));
    const end = lines.findIndex((l) => l.includes(`docs:endregion ${region}`));
    if (start === -1 || end === -1 || end < start) return { error: `docs:include: ${path} has no region "${region}" (docs:region / docs:endregion)` };
    lines = lines.slice(start + 1, end);
  }
  const lang = rest[0] ?? /\.(\w+)$/.exec(path)?.[1] ?? '';
  return ['```' + lang, ...lines, '```'].join('\n');
}

/** The renderer for every block name, reading the repo. */
export function blockRenderer(repo: Repo, extra: Record<string, (args: string[]) => string | { error: string }> = customBlocks(repo)): BlockRenderer {
  const items = readItems(repo);
  return (name, args) => {
    if (name === 'completeness') return renderCompleteness(listed<FeatureMeta>(items, 'feature'));
    if (name === 'index') {
      const [kind, group] = args;
      if (kind === 'features') {
        if (!group || !(FEATURE_GROUPS as readonly string[]).includes(group)) return { error: `docs:index features needs one of ${FEATURE_GROUPS.join(', ')}` };
        return renderFeatures(listed<FeatureMeta>(items, 'feature'), group, humanChecks(items));
      }
      if (kind === 'decisions') return renderDecisions(listed<DecisionMeta>(items, 'decision'));
      if (kind === 'authoring') return renderAuthoring(listed<AuthoringMeta>(items, 'authoring'));
      if (kind === 'playtests') return renderPlaytests(listed<PlaytestMeta>(items, 'playtest'));
      return { error: `docs:index: unknown index "${kind ?? ''}"` };
    }
    if (name === 'include') return renderInclude(repo, args);
    const custom = extra[name];
    return custom ? custom(args) : { error: `unknown block docs:${name}` };
  };
}

/** Every markdown file with its blocks expanded: the new text of the files that change, and the errors. */
export function expandAll(repo: Repo, extra?: Record<string, (args: string[]) => string | { error: string }>): { changed: Map<string, string>; errors: string[] } {
  const render = blockRenderer(repo, extra);
  const changed = new Map<string, string>();
  const errors: string[] = [];
  for (const [path, text] of repo.docs) {
    if (!text.includes('<!-- docs:')) continue;
    const result = expandBlocks(text, path, render);
    errors.push(...result.errors);
    if (result.text !== text) changed.set(path, result.text);
  }
  return { changed, errors };
}

/** The blocks every index file must contain: one index per feature group, one each for the other kinds, and the completeness summary. */
export function requiredBlocks(): { path: string; name: string; args: string[] }[] {
  const features = `${KINDS.feature.dir}/${KINDS.feature.index}`;
  return [
    ...FEATURE_GROUPS.map((group) => ({ path: features, name: 'index', args: ['features', group] })),
    { path: features, name: 'completeness', args: [] },
    { path: `${KINDS.decision.dir}/${KINDS.decision.index}`, name: 'index', args: ['decisions'] },
    { path: `${KINDS.authoring.dir}/${KINDS.authoring.index}`, name: 'index', args: ['authoring'] },
    { path: `${KINDS.playtest.dir}/${KINDS.playtest.index}`, name: 'index', args: ['playtests'] },
  ];
}

export function missingBlocks(repo: Repo): string[] {
  const problems: string[] = [];
  for (const need of requiredBlocks()) {
    const text = repo.docs.get(need.path);
    if (text === undefined) {
      problems.push(`${need.path}: the index file is missing`);
      continue;
    }
    const found = listBlocks(text).some((b) => b.name === need.name && b.args.join(' ') === need.args.join(' '));
    if (!found) problems.push(`${need.path}: no <!-- docs:${[need.name, ...need.args].join(' ')} --> block`);
  }
  return problems;
}
