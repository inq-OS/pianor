import { describe, expect, it } from 'vitest';
import { lintPlainDocs, reportStale, staleDocs, trackedDocs } from './stale';
import { makeRepo } from './testRepo';

const fm = (lines: string[]): string => `---\n${lines.join('\n')}\n---\n# Doc\n`;

describe('trackedDocs', () => {
  it('lists docs that declare what they cover', () => {
    const repo = makeRepo({
      'docs/a.md': fm(['covers: ["src/core/"]', 'verified_against: "abc1234"', 'last_reviewed: "1998-10-01"']),
      'docs/b.md': fm(['covers: ["tests/"]']),
      'docs/c.md': fm(['title: "No covers"']),
      'docs/d.md': '# no front matter',
      'docs/e.md': '---\nbroken\n---\n',
      'docs/f.md': fm(['covers: []']),
    });
    expect(trackedDocs(repo)).toEqual([
      { path: 'docs/a.md', covers: ['src/core/'], verifiedAgainst: 'abc1234', lastReviewed: '1998-10-01' },
      { path: 'docs/b.md', covers: ['tests/'], verifiedAgainst: null, lastReviewed: null },
    ]);
  });
});

describe('staleDocs', () => {
  const tracked = [
    { path: 'docs/a.md', covers: ['src/core/'], verifiedAgainst: 'abc1234', lastReviewed: '1998-10-01' },
    { path: 'docs/b.md', covers: ['tests/'], verifiedAgainst: null, lastReviewed: null },
    { path: 'docs/c.md', covers: ['tools/'], verifiedAgainst: 'def5678', lastReviewed: null },
  ];
  const changedSince = (commit: string, covers: string[]): string[] => (commit === 'abc1234' ? [`${covers[0]}x.ts`, `${covers[0]}y.ts`] : []);

  it('finds docs never verified and docs whose covered files changed', () => {
    const stale = staleDocs(tracked, changedSince);
    expect(stale.map((s) => [s.path, s.reason])).toEqual([['docs/a.md', 'covered files changed'], ['docs/b.md', 'never verified']]);
  });

  it('reports them, or says none is stale', () => {
    const text = reportStale(staleDocs(tracked, changedSince), 3);
    expect(text).toContain('docs/a.md: 2 covered file(s) changed since it was verified (1998-10-01), e.g. src/core/x.ts, src/core/y.ts');
    expect(text).toContain('docs/b.md: never verified (read it, then npm run docs:verify -- docs/b.md)');
    expect(text).toContain('2 of 3 tracked doc(s) need a look');
    expect(reportStale([], 3)).toBe('3 tracked doc(s), none stale');
    expect(reportStale(staleDocs([tracked[2]!], () => []), 1)).toBe('1 tracked doc(s), none stale');
  });
});

describe('lintPlainDocs', () => {
  it('accepts the tracking fields and complains about anything else', () => {
    const repo = makeRepo({
      'docs/ok.md': fm(['covers: ["src/"]', 'title: "T"']),
      'docs/none.md': '# plain',
      'docs/unknown.md': fm(['colour: "red"']),
      'docs/broken.md': '---\nnot front matter\n---\n',
      'docs/features/ft_0_01-a.md': '---\nid: "ft_0_01"\n---\n',
    });
    const issues = lintPlainDocs(repo);
    expect(issues.map((i) => i.file)).toEqual(['docs/unknown.md', 'docs/broken.md']);
  });
});
