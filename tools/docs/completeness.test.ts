import { describe, expect, it } from 'vitest';
import { DEFAULT_WEIGHT, featureGroup, lintCompleteness, parentOf, rate, summarize, weightOf, weightedMean } from './completeness';
import { expandAll, readItems } from './generate';
import { lintDocs, lintItems } from './lint';
import { renderCompleteness, renderFeatures } from './render';
import type { FeatureMeta } from './schemas';
import { INDEX_BLOCKS, decision, feature, makeRepo } from './testRepo';

const meta = (id: string, effort: FeatureMeta['effort'], completeness?: number): FeatureMeta => ({
  id,
  title: 'T',
  scope: 'S',
  effort,
  status: 's',
  ...(completeness === undefined ? {} : { completeness }),
});

const problem = (text: string): string | null => {
  const repo = makeRepo({ 'docs/features/ft_0_01-a.md': text });
  return readItems(repo)[0]?.problem ?? null;
};

describe('completeness in the front matter', () => {
  it('accepts an integer from 0 to 100', () => {
    for (const value of [0, 1, 71, 99]) expect(problem(feature('ft_0_01', { completeness: value }))).toBeNull();
    expect(problem(feature('ft_0_01', { effort: 'done', completeness: 100 }))).toBeNull();
    expect(problem(feature('ft_0_01', { effort: 'done (preliminary)', completeness: 88 }))).toBeNull();
    expect(problem(feature('ft_0_01', { effort: 'done (preliminary)', completeness: 100 }))).toBeNull();
  });

  it('rejects a missing, fractional or out-of-range value', () => {
    const without = feature('ft_0_01').replace(/completeness: .*\n/, '');
    expect(problem(without)).toMatch(/completeness: required/);
    expect(problem(feature('ft_0_01', { completeness: 50.5 }))).toMatch(/completeness/);
    expect(problem(feature('ft_0_01', { completeness: -1 }))).toMatch(/completeness/);
    expect(problem(feature('ft_0_01', { completeness: 101 }))).toMatch(/completeness/);
    expect(problem(feature('ft_0_01', { extra: { completeness: '50' } }))).toMatch(/completeness/);
  });

  it('makes a done feature 100, and 100 only for a done one', () => {
    expect(problem(feature('ft_0_01', { effort: 'done', completeness: 90 }))).toMatch(/"done" is 100/);
    expect(problem(feature('ft_0_01', { effort: 'medium', completeness: 100 }))).toMatch(/100 needs effort/);
  });

  it('gives a split feature none, and demands it of every other', () => {
    expect(problem(feature('ft_0_01', { effort: 'split' }))).toBeNull();
    expect(problem(feature('ft_0_01', { effort: 'split', extra: { completeness: 20 } }))).toMatch(/derived from its parts/);
  });

  it('is reported by the item lint with the file', () => {
    const issues = lintItems(readItems(makeRepo({ 'docs/features/ft_0_01-a.md': feature('ft_0_01', { effort: 'done', completeness: 5 }) })));
    expect(issues).toHaveLength(1);
    expect(issues[0]?.message).toMatch(/front matter: completeness/);
  });
});

describe('weights and the mean', () => {
  it('weighs trivial 1, simple 2, medium 4, large 8, and a done feature like a simple one', () => {
    expect(['trivial', 'simple', 'medium', 'large'].map(weightOf)).toEqual([1, 2, 4, 8]);
    expect(weightOf('high friction')).toBe(16);
    expect(weightOf('done')).toBe(DEFAULT_WEIGHT);
    expect(weightOf('done (preliminary)')).toBe(DEFAULT_WEIGHT);
  });

  it('is the weighted mean, and 0 for nothing', () => {
    expect(weightedMean([{ value: 100, weight: 2 }, { value: 0, weight: 6 }])).toBe(25);
    expect(weightedMean([])).toBe(0);
  });

  it('knows parts and groups', () => {
    expect(parentOf('ft_1_02a')).toBe('ft_1_02');
    expect(parentOf('core_01')).toBeNull();
    expect(parentOf('ft_1_02')).toBeNull();
    expect(featureGroup('core_09')).toBe('core');
    expect(featureGroup('ft_Y_03')).toBe('ft_Y');
  });
});

describe('rate and summarize', () => {
  const features = [
    meta('ft_0_00', 'done', 100),
    meta('ft_0_01', 'simple', 50),
    meta('ft_0_02', 'large', 25),
    meta('ft_1_01', 'done (preliminary)', 80),
    meta('ft_1_02', 'split'),
    meta('ft_1_02a', 'done (preliminary)', 100),
    meta('ft_1_02b', 'simple', 0),
    meta('ft_1_02c', 'medium', 50),
    meta('core_01', 'large', 71),
    meta('ft_Y_01', 'large', 0),
  ];

  it('derives a split parent from its parts, weighted by their effort', () => {
    const parent = rate(features).find((r) => r.id === 'ft_1_02');
    // a: 100 x 2, b: 0 x 2, c: 50 x 4 -> 400 / 8 = 50
    expect(parent).toMatchObject({ value: 50, split: true, weight: 0 });
  });

  it('is 0 for a parent without parts', () => {
    expect(rate([meta('ft_1_09', 'split')])[0]?.value).toBe(0);
  });

  it('summarizes each iteration, counting parts and not their parent', () => {
    const rows = summarize(rate(features));
    const mvp = rows.find((r) => r.label === 'MVP, iteration 0');
    // done 100 x 2, simple 50 x 2, large 25 x 8 -> 500 / 12 = 41.67
    expect(mvp).toMatchObject({ value: 42, done: 1, total: 3 });
    const one = rows.find((r) => r.label === 'Iteration 1');
    // 80 x 2, 100 x 2, 0 x 2, 50 x 4 -> 560 / 10 = 56
    expect(one).toMatchObject({ value: 56, done: 1, total: 4 });
    expect(rows.find((r) => r.label === 'Core behaviour')).toMatchObject({ value: 71, total: 1 });
    expect(rows.find((r) => r.label === 'Iteration not defined yet')).toMatchObject({ value: 0, total: 1 });
  });

  it('adds the overall figure last and leaves out empty groups', () => {
    const rows = summarize(rate(features));
    expect(rows.at(-1)).toMatchObject({ label: 'Overall', total: 9 });
    // 200 + 100 + 200 + 160 + 200 + 0 + 200 + 568 + 0 = 1628 / (2+2+8+2+2+2+4+8+8 = 38) = 42.8
    expect(rows.at(-1)?.value).toBe(43);
    expect(summarize(rate([meta('core_01', 'large', 10)])).map((r) => r.label)).toEqual(['Core behaviour', 'Overall']);
  });
});

describe('rendering', () => {
  const listed = (m: FeatureMeta) => ({ meta: m, file: `${m.id}-x.md` });
  const items = [meta('ft_1_02', 'split'), meta('ft_1_02a', 'simple', 40), meta('ft_1_02b', 'simple', 80)].map(listed);

  it('puts the derived value of a parent and the human count in the table', () => {
    const rows = renderFeatures(items, 'ft_1', new Map([['ft_1_02a', 2]])).split('\n').slice(2);
    expect(rows[0]).toContain('| split | 60 |  |');
    expect(rows[1]).toContain('| simple | 40 | 2 |');
    expect(rows[2]).toContain('| simple | 80 |  |');
  });

  it('renders the summary with a bar', () => {
    const out = renderCompleteness(items).split('\n');
    expect(out[0]).toBe('| Scope | Features at 100 | Done % |  |');
    expect(out[2]).toBe('| Iteration 1 | 0 of 2 | 60 | `############........` |');
    expect(out[3]).toBe('| Overall | 0 of 2 | 60 | `############........` |');
  });
});

describe('the generated docs', () => {
  const files = {
    'docs/features/FEATURES.md': INDEX_BLOCKS.features,
    'docs/decisions/DECISIONS.md': INDEX_BLOCKS.decisions,
    'docs/authoring/AUTHORING.md': INDEX_BLOCKS.authoring,
    'docs/playtests/PLAYTESTS.md': INDEX_BLOCKS.playtests,
    'docs/features/ft_1_02-a.md': feature('ft_1_02', { effort: 'split' }),
    'docs/features/ft_1_02a-a.md': feature('ft_1_02a', { effort: 'medium', completeness: 50, body: '- **ft_1_02a.AC1** by hand [human]\n' }),
  };

  it('fills the summary block and counts [human] criteria, and a second run changes nothing', () => {
    const { changed, errors } = expandAll(makeRepo(files));
    expect(errors).toEqual([]);
    const text = changed.get('docs/features/FEATURES.md') as string;
    expect(text).toContain('| Iteration 1 | 0 of 1 | 50 |');
    expect(text).toMatch(/\| \[ft_1_02a\]\(ft_1_02a-a\.md\) \| .* \| medium \| 50 \| 1 \|/);
    const settled = makeRepo({ ...files, ...Object.fromEntries(changed) });
    expect(expandAll(settled).changed.size).toBe(0);
  });

  it('keeps the hand-written text around the blocks', () => {
    const intro = 'Hand-written intro.\n\n';
    const { changed } = expandAll(makeRepo({ ...files, 'docs/features/FEATURES.md': intro + INDEX_BLOCKS.features + '\n\nOutro.\n' }));
    const text = changed.get('docs/features/FEATURES.md') as string;
    expect(text.startsWith(intro)).toBe(true);
    expect(text.endsWith('\n\nOutro.\n')).toBe(true);
  });

  it('fails the check for a split feature without parts', () => {
    const repo = makeRepo({ 'docs/features/ft_1_02-a.md': feature('ft_1_02', { effort: 'split' }) });
    const items = readItems(repo).map((i) => ({ meta: i.meta as unknown as FeatureMeta, path: i.path }));
    expect(lintCompleteness(items).map((i) => i.message)).toEqual([expect.stringContaining('ft_1_02 is split but has no part files')]);
  });

  it('fails the check for 100 while a criterion has no test', async () => {
    const repo = makeRepo(
      {
        'docs/features/ft_0_01-a.md': feature('ft_0_01', { effort: 'done', body: '- **ft_0_01.AC1** untested\n' }),
        'docs/decisions/d001-a.md': decision('d001'),
      },
      [],
    );
    const issues = (await lintDocs(repo)).map((i) => i.message);
    expect(issues.some((m) => m.includes('ft_0_01.AC1 has no test'))).toBe(true);
  });
});
