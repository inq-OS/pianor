import { describe, expect, it } from 'vitest';
import { classify, readItem } from './items';
import { expandAll, missingBlocks, readItems, renderInclude, requiredBlocks } from './generate';
import { renderAuthoring, renderDecisions, renderFeatures, renderPlaytests, featureGroup } from './render';
import type { AuthoringMeta, DecisionMeta, FeatureMeta, PlaytestMeta } from './schemas';
import { INDEX_BLOCKS, decision, feature, makeRepo } from './testRepo';

describe('classify and readItem', () => {
  it('knows the four kinds by folder and file name', () => {
    expect(classify('docs/features/ft_0_08-judge.md')).toEqual({ kind: 'feature', fileId: 'ft_0_08' });
    expect(classify('docs/features/ft_1_02a-editor.md')).toEqual({ kind: 'feature', fileId: 'ft_1_02a' });
    expect(classify('docs/features/core_01-tempo.md')).toEqual({ kind: 'feature', fileId: 'core_01' });
    expect(classify('docs/decisions/d039-x.md')).toEqual({ kind: 'decision', fileId: 'd039' });
    expect(classify('docs/authoring/au04-levels.md')).toEqual({ kind: 'authoring', fileId: 'au04' });
    expect(classify('docs/playtests/pt01-first.md')).toEqual({ kind: 'playtest', fileId: 'pt01' });
  });

  it('leaves index files and other docs alone', () => {
    expect(classify('docs/features/FEATURES.md')).toBeNull();
    expect(classify('docs/testing.md')).toBeNull();
    expect(readItem('docs/testing.md', 'x')).toBeNull();
  });

  it('explains what is wrong with front matter', () => {
    expect(readItem('docs/features/ft_0_01-a.md', '# T')?.problem).toMatch(/no front matter/);
    expect(readItem('docs/features/ft_0_01-a.md', '---\nid: x\n---\n')?.problem).toMatch(/not JSON/);
    expect(readItem('docs/features/ft_0_01-a.md', '---\nid: "nope"\n---\n')?.problem).toMatch(/front matter: id/);
    expect(readItem('docs/features/ft_0_01-a.md', '---\nid: "ft_0_01"\nextra: 1\n---\n')?.problem).toMatch(/front matter/);
  });

  it('reads a valid item', () => {
    const item = readItem('docs/features/ft_0_01-a.md', feature('ft_0_01'));
    expect(item?.problem).toBeNull();
    expect(item?.meta?.id).toBe('ft_0_01');
    expect(item?.file).toBe('ft_0_01-a.md');
  });
});

const f = (id: string, over: Partial<FeatureMeta> = {}): { meta: FeatureMeta; file: string } => ({
  meta: { id, title: 'T', scope: 'S | with pipe', effort: 'simple', status: 'idea', completeness: 0, ...over },
  file: `${id}-x.md`,
});

describe('rendering', () => {
  it('groups features by iteration and sorts by id, parts after their feature', () => {
    expect(featureGroup('core_03')).toBe('core');
    expect(featureGroup('ft_1_02a')).toBe('ft_1');
    const out = renderFeatures([f('ft_1_02b'), f('ft_1_02'), f('ft_0_01'), f('ft_1_02a')], 'ft_1');
    const ids = out.split('\n').slice(2).map((row) => /\[(\w+)\]/.exec(row)?.[1]);
    expect(ids).toEqual(['ft_1_02', 'ft_1_02a', 'ft_1_02b']);
  });

  it('writes the header, links to the file and escapes pipes', () => {
    const out = renderFeatures([f('ft_0_01')], 'ft_0').split('\n');
    expect(out[0]).toBe('| ID | Feature | Scope | Effort | Done % | Human | Status |');
    expect(out[1]).toBe('|---|---|---|---|---|---|---|');
    expect(out[2]).toBe('| [ft_0_01](ft_0_01-x.md) | T | S \\| with pipe | simple | 0 |  | idea |');
  });

  it('renders decisions, authoring topics and playtests', () => {
    const d: DecisionMeta = { id: 'd001', title: 'D', features: ['ft_0_00', 'ft_0_01'] };
    expect(renderDecisions([{ meta: d, file: 'd001-x.md' }]).split('\n')[2]).toBe('| [d001](d001-x.md) | D | ft_0_00, ft_0_01 |');
    const a: AuthoringMeta = { id: 'au01', summary: 'Piece files' };
    expect(renderAuthoring([{ meta: a, file: 'au01-x.md' }]).split('\n')[2]).toBe('| [au01](au01-x.md) | Piece files |');
    const p: PlaytestMeta = { id: 'pt01', pieces: 'Little Steps', finding: 'Liked it' };
    expect(renderPlaytests([{ meta: p, file: 'pt01-first.md' }]).split('\n')[2]).toBe('| [pt01](pt01-first.md) | Little Steps | Liked it |');
  });

  it('shows "none yet" while there are no playtests', () => {
    expect(renderPlaytests([])).toContain('| none yet |');
  });
});

describe('expandAll and missingBlocks', () => {
  const base = {
    'docs/features/FEATURES.md': INDEX_BLOCKS.features,
    'docs/decisions/DECISIONS.md': INDEX_BLOCKS.decisions,
    'docs/authoring/AUTHORING.md': INDEX_BLOCKS.authoring,
    'docs/playtests/PLAYTESTS.md': INDEX_BLOCKS.playtests,
  };

  it('fills every index from the item files', () => {
    const repo = makeRepo({ ...base, 'docs/features/ft_0_01-a.md': feature('ft_0_01'), 'docs/decisions/d001-a.md': decision('d001') });
    const { changed, errors } = expandAll(repo);
    expect(errors).toEqual([]);
    expect(changed.get('docs/features/FEATURES.md')).toContain('[ft_0_01](ft_0_01-a.md)');
    expect(changed.get('docs/decisions/DECISIONS.md')).toContain('[d001](d001-a.md)');
    expect(changed.get('docs/playtests/PLAYTESTS.md')).toContain('none yet');
  });

  it('skips items whose front matter is broken (the linter reports them)', () => {
    const repo = makeRepo({ ...base, 'docs/features/ft_0_01-a.md': '# no front matter' });
    expect(readItems(repo)).toHaveLength(1);
    expect(expandAll(repo).changed.get('docs/features/FEATURES.md')).not.toContain('ft_0_01');
  });

  it('changes nothing once the files are up to date', () => {
    const repo = makeRepo({ ...base, 'docs/features/ft_0_01-a.md': feature('ft_0_01') });
    const { changed } = expandAll(repo);
    const settled = makeRepo({ ...base, ...Object.fromEntries(changed), 'docs/features/ft_0_01-a.md': feature('ft_0_01') });
    expect(expandAll(settled).changed.size).toBe(0);
  });

  it('reports unknown indexes, unknown blocks and bad arguments', () => {
    const repo = makeRepo({
      'a.md': '<!-- docs:index nothing -->\n<!-- /docs:index -->\n<!-- docs:index features zzz -->\n<!-- /docs:index -->\n<!-- docs:wat -->\n<!-- /docs:wat -->',
    });
    expect(expandAll(repo).errors).toHaveLength(3);
  });

  it('lists the index blocks that are missing', () => {
    expect(requiredBlocks()).toHaveLength(8);
    expect(missingBlocks(makeRepo(base))).toEqual([]);
    const problems = missingBlocks(makeRepo({ 'docs/features/FEATURES.md': '<!-- docs:index features ft_0 -->\n<!-- /docs:index -->' }));
    expect(problems.some((p) => p.includes('features core'))).toBe(true);
    expect(problems.some((p) => p.includes('<!-- docs:completeness --> block'))).toBe(true);
    expect(problems.some((p) => p.includes('DECISIONS.md: the index file is missing'))).toBe(true);
  });
});

describe('docs:include', () => {
  const repo = makeRepo({ 'src/a.ts': 'line1\n// docs:region demo\nconst x = 1;\n// docs:endregion demo\nline5\n', 'data.json': '{"a":1}\n' });

  it('copies a whole file as a fenced block with the language of its extension', () => {
    expect(renderInclude(repo, ['data.json'])).toBe('```json\n{"a":1}\n```');
  });

  it('copies a named region', () => {
    expect(renderInclude(repo, ['src/a.ts#demo'])).toBe('```ts\nconst x = 1;\n```');
  });

  it('takes the language from the second argument', () => {
    expect(renderInclude(repo, ['src/a.ts#demo', 'typescript'])).toBe('```typescript\nconst x = 1;\n```');
  });

  it('reports a missing path, region or argument', () => {
    expect(renderInclude(repo, [])).toEqual({ error: 'docs:include needs a path' });
    expect(renderInclude(repo, ['nope.ts'])).toEqual({ error: 'docs:include: nope.ts does not exist' });
    expect(renderInclude(repo, ['src/a.ts#missing'])).toMatchObject({ error: expect.stringContaining('no region "missing"') });
  });

  it('is available as a block', () => {
    const r = makeRepo({ 'd.md': '<!-- docs:include data.json -->\n<!-- /docs:include -->', 'data.json': '1' });
    expect(expandAll(r).changed.get('d.md')).toContain('```json');
  });
});
