import { describe, expect, it } from 'vitest';
import { coverage, criteriaOf, lintCriteria, referencesOf, reportCriteria } from './criteria';
import { readItems } from './generate';
import { feature, makeRepo } from './testRepo';

const body = '## Acceptance criteria\n\n- **ft_9_01.AC1** Covered by a test.\n- **ft_9_01.AC2** Needs a person [human]\n- **ft_9_01.AC3**: Not covered anywhere.\n\n```\n- **ft_9_01.AC9** inside a fence\n```\n';

function repoWith(effort: string, sources: Record<string, string>) {
  return makeRepo({ 'docs/features/ft_9_01-a.md': feature('ft_9_01', { effort, body }), 'docs/features/ft_9_02-b.md': feature('ft_9_02'), ...sources });
}

describe('criteria', () => {
  it('reads criteria from feature files, outside fences, with the human flag', () => {
    const found = criteriaOf(readItems(repoWith('done', {})));
    expect(found.map((c) => [c.id, c.human])).toEqual([['ft_9_01.AC1', false], ['ft_9_01.AC2', true], ['ft_9_01.AC3', false]]);
    expect(found[0]?.feature).toBe('ft_9_01');
  });

  it('finds the files that name a criterion', () => {
    const repo = repoWith('done', { 'src/a.test.ts': "it('ft_9_01.AC1 works')", 'src/b.test.ts': '// ft_9_01.AC1 ft_9_01.AC1' });
    expect(referencesOf(repo).get('ft_9_01.AC1')).toEqual(['src/a.test.ts', 'src/b.test.ts']);
    expect(coverage(repo, readItems(repo))[0]?.coveredBy).toHaveLength(2);
  });

  it('fails a done feature with a criterion that has neither a test nor [human]', () => {
    const repo = repoWith('done', { 'src/a.test.ts': '// ft_9_01.AC1' });
    const issues = lintCriteria(repo, readItems(repo));
    expect(issues.map((i) => i.message)).toEqual([expect.stringContaining('ft_9_01.AC3 has no test')]);
    expect(issues[0]?.line).toBeGreaterThan(0);
  });

  it('fails a done feature that lists no tagged criteria at all', () => {
    const repo = makeRepo({ 'docs/features/ft_9_03-c.md': feature('ft_9_03', { effort: 'done (preliminary)' }), 'docs/features/ft_9_04-d.md': feature('ft_9_04', { effort: 'medium' }) });
    expect(lintCriteria(repo, readItems(repo)).map((i) => i.message)).toEqual([expect.stringContaining('ft_9_03 is done but lists no tagged acceptance criteria')]);
  });

  it('only reports open criteria of a feature that is not done', () => {
    const repo = repoWith('simple', {});
    expect(lintCriteria(repo, readItems(repo))).toEqual([]);
    expect(reportCriteria(repo, readItems(repo))).toContain('OPEN     ft_9_01.AC3');
  });

  it('reports a reference to a criterion that does not exist, a wrong prefix and a duplicate', () => {
    const repo = makeRepo({
      'docs/features/ft_9_01-a.md': feature('ft_9_01', { body: '- **ft_9_02.AC1** wrong file\n- **ft_9_01.AC1** one\n- **ft_9_01.AC1** again\n' }),
      'src/a.test.ts': '// ft_9_01.AC7',
    });
    const messages = lintCriteria(repo, readItems(repo)).map((i) => i.message);
    expect(messages).toEqual(['criterion ft_9_02.AC1 must start with ft_9_01', 'criterion ft_9_01.AC1 is defined twice', 'ft_9_01.AC7 is not a criterion in any feature file']);
  });

  it('prints a coverage report', () => {
    const repo = repoWith('done', { 'src/a.test.ts': '// ft_9_01.AC1' });
    const text = reportCriteria(repo, readItems(repo));
    expect(text).toContain('covered  ft_9_01.AC1  src/a.test.ts');
    expect(text).toContain('human    ft_9_01.AC2');
    expect(text).toContain('1 of 2 feature files have tagged criteria');
  });
});
