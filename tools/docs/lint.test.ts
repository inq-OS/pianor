import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { readItems } from './generate';
import { knownIds, lintDocs, lintGenerated, lintIds, lintItems, lintLinks, lintOldIds, lintScripts } from './lint';
import { lintLocalLinks } from './remarkLinks';
import { loadRepo } from './repo';
import { INDEX_BLOCKS, decision, feature, makeRepo } from './testRepo';

const messages = (issues: { message: string }[]): string[] => issues.map((i) => i.message);

describe('lintItems', () => {
  const lint = (files: Record<string, string>) => lintItems(readItems(makeRepo(files)));

  it('accepts valid items', () => {
    expect(lint({ 'docs/features/ft_0_01-a.md': feature('ft_0_01'), 'docs/decisions/d001-a.md': decision('d001', ['ft_0_01']) })).toEqual([]);
  });

  it('reports broken front matter', () => {
    expect(messages(lint({ 'docs/features/ft_0_01-a.md': '# ft_0_01: A' }))).toEqual(['no front matter (see docs/decisions/workflow.md#d041)']);
  });

  it('reports an id that does not match the file name', () => {
    const issues = messages(lint({ 'docs/features/ft_0_02-a.md': feature('ft_0_01', { heading: '# ft_0_02: A' }) }));
    expect(issues).toEqual(['front matter id "ft_0_01" does not match the file name (ft_0_02)']);
  });

  it('reports a first heading that does not start with the id', () => {
    expect(messages(lint({ 'docs/features/ft_0_01-a.md': feature('ft_0_01', { heading: '# Something else' }) }))).toEqual(['the first heading must start with "# ft_0_01:"']);
    expect(messages(lint({ 'docs/features/ft_0_01-a.md': '---\nid: "ft_0_01"\ntitle: "T"\nscope: "S"\neffort: "simple"\nstatus: "x"\ncompleteness: 0\n---\nno heading' }))).toEqual(['the first heading must start with "# ft_0_01:"']);
  });

  it('reports two files with the same id', () => {
    const issues = messages(lint({ 'docs/features/ft_0_01-a.md': feature('ft_0_01'), 'docs/features/ft_0_01-b.md': feature('ft_0_01') }));
    expect(issues).toEqual(['id ft_0_01 is also used by docs/features/ft_0_01-a.md']);
  });

  it('checks depends_on and a decision\'s features', () => {
    const issues = messages(
      lint({
        'docs/features/ft_0_01-a.md': feature('ft_0_01', { extra: { depends_on: ['ft_0_09'] } }),
        'docs/decisions/d001-a.md': decision('d001', ['ft_0_77', 'all']),
      }),
    );
    expect(issues).toEqual(['depends_on names ft_0_09, which has no file', 'features names ft_0_77, which has no file']);
  });

  it('lets a part id refer to its feature', () => {
    const exists = knownIds(readItems(makeRepo({ 'docs/features/ft_0_09-a.md': feature('ft_0_09') })));
    expect(exists('ft_0_09a')).toBe(true);
    expect(exists('ft_0_10a')).toBe(false);
  });
});

describe('lintLinks (anchors in other files and paths in code)', () => {
  const repo = makeRepo({
    'docs/a.md': '[ok](b.md#hello-there) [bad](b.md#nope) [same](#x) [web](https://x.y/z#q) `docs/b.md` `docs/missing.md:12` `src/core/` `tools/*.ts`\n\n```\n[skip](b.md#nope) `docs/missing.md`\n```\n',
    'docs/b.md': '# Hello there\n\n## Hello there\n',
    'src/core/x.ts': '',
  });

  it('finds links to headings that are not there, and paths in code that do not exist', () => {
    expect(messages(lintLinks(repo))).toEqual(['link b.md#nope points at a heading that does not exist', '`docs/missing.md:12` does not exist']);
  });

  it('knows duplicate headings by their numbered anchors', () => {
    const r = makeRepo({ 'a.md': '[two](b.md#hello-there-1)', 'b.md': '# Hello there\n## Hello there' });
    expect(lintLinks(r)).toEqual([]);
  });
});

describe('lintIds', () => {
  const items = readItems(makeRepo({ 'docs/features/ft_0_01-a.md': feature('ft_0_01'), 'docs/decisions/d001-a.md': decision('d001') }));
  const repo = makeRepo({
    'docs/a.md': 'See ft_0_01, ft_0_01a, `ft_0_55`, d001, d777 and au09.\n',
    'src/x.ts': '// ft_0_01 and ft_Y_09 and d777\n',
  });

  it('flags ids with no file in docs and in code, and decision ids only in docs', () => {
    expect(messages(lintIds(repo, items))).toEqual(['ft_0_55 has no feature file', 'd777 has no file', 'au09 has no file', 'ft_Y_09 has no feature file']);
  });
});

describe('lintScripts', () => {
  it('flags unknown scripts and scripts CLAUDE.md does not mention', () => {
    const repo = makeRepo({ 'docs/a.md': 'run `npm run nope` or `npm run build`', 'CLAUDE.md': 'Use npm run build and npm test.' }, ['build', 'test', 'extra']);
    expect(messages(lintScripts(repo))).toEqual(['npm run nope is not a script in package.json', 'the Commands list does not mention the script "extra"']);
  });

  it('takes the install hook named in backticks', () => {
    expect(messages(lintScripts(makeRepo({ 'CLAUDE.md': 'npm install runs `prepare`' }, ['prepare'])))).toEqual([]);
    expect(messages(lintScripts(makeRepo({ 'CLAUDE.md': 'nothing' }, ['prepare'])))).toEqual(['the Commands list does not mention the script "prepare"']);
  });
});

describe('docs:ignore, planned paths and old numbering', () => {
  it('skips a line that says docs:ignore in every rule', () => {
    const repo = makeRepo({
      'docs/a.md': 'See ft_0_99 and `docs/gone.md` and npm run nope and FT17 <!-- docs:ignore -->\nSee ft_0_98.\n',
      'src/x.ts': '// ft_0_97 docs:ignore\n',
    });
    const items = readItems(repo);
    expect(messages(lintIds(repo, items))).toEqual(['ft_0_98 has no feature file']);
    expect(lintLinks(repo)).toEqual([]);
    expect(lintScripts(repo)).toEqual([]);
    expect(lintOldIds(repo)).toEqual([]);
  });

  it('flags a path outside the repository even on a planned line, and checks src paths written without src/', () => {
    const repo = makeRepo({
      'docs/a.md': 'Planned in `/mnt/project-files/x.md` and `~/notes.md`.\nSee `game/MenuScene.ts`, `game/Gone.ts`, `game/*Scene.ts` and `core/judge/`.\n',
      'src/game/MenuScene.ts': '',
      'src/core/judge/x.ts': '',
    });
    expect(messages(lintLinks(repo))).toEqual([
      '`/mnt/project-files/x.md` is outside the repository; put the file in the repo or name it in words',
      '`~/notes.md` is outside the repository; put the file in the repo or name it in words',
      '`game/Gone.ts` does not exist (as src/game/Gone.ts)',
    ]);
  });

  it('allows a missing path on a line that says it is planned', () => {
    const repo = makeRepo({ 'docs/a.md': 'A `tools/import/` folder (planned).\nNow `tools/other/` exists.\n' });
    expect(messages(lintLinks(repo))).toEqual(['`tools/other/` does not exist']);
  });

  it('flags the old numbering in every doc', () => {
    const repo = makeRepo({ 'docs/a.md': 'Was FT17 and WP9a.\n', 'docs/decisions/d001-x.md': 'History: FT17.\n' });
    expect(messages(lintOldIds(repo))).toEqual([
      'FT17 is the old numbering; use the id from docs/decisions/workflow.md#d037',
      'WP9a is the old numbering; use the id from docs/decisions/workflow.md#d037',
      'FT17 is the old numbering; use the id from docs/decisions/workflow.md#d037',
    ]);
  });
});

describe('lintGenerated and lintDocs', () => {
  const index = {
    'docs/features/FEATURES.md': INDEX_BLOCKS.features,
    'docs/decisions/DECISIONS.md': INDEX_BLOCKS.decisions,
    'docs/authoring/AUTHORING.md': INDEX_BLOCKS.authoring,
    'docs/playtests/PLAYTESTS.md': INDEX_BLOCKS.playtests,
  };

  it('says which generated files are stale and which blocks are missing', () => {
    const stale = lintGenerated(makeRepo({ ...index, 'docs/features/ft_0_01-a.md': feature('ft_0_01') }));
    expect(stale.some((i) => i.file === 'docs/features/FEATURES.md' && i.message.includes('out of date'))).toBe(true);
    expect(messages(lintGenerated(makeRepo({})))).toContain('docs/features/FEATURES.md: the index file is missing');
    expect(lintGenerated(makeRepo({ 'a.md': '<!-- docs:bad -->\n<!-- /docs:bad -->', ...index })).some((i) => i.message.includes('unknown block'))).toBe(true);
  });
});

describe('lintLocalLinks (remark-validate-links on real files)', () => {
  const root = mkdtempSync(join(tmpdir(), 'docs-links-'));
  afterAll(() => rmSync(root, { recursive: true, force: true }));
  const write = (path: string, text: string): void => {
    mkdirSync(dirname(join(root, path)), { recursive: true });
    writeFileSync(join(root, path), text);
  };
  write('docs/a.md', '---\nid: "x"\n---\n# Title\n\n[ok](b.md) [missing](gone.md) [heading](#nothing) [self](#title)\n\n![img](pic.png)\n');
  write('docs/b.md', '# B\n');

  it('reports links to missing files and to headings that are not in the same file, with line numbers', async () => {
    const repo = loadRepo(root);
    const issues = await lintLocalLinks(repo);
    const found = issues.map((i) => `${i.file}:${i.line}`);
    expect(found).toEqual(['docs/a.md:6', 'docs/a.md:6', 'docs/a.md:8']);
    expect(issues[0]?.severity).toBe('error');
  });
});

describe('this repository', () => {
  it('passes its own docs check', async () => {
    const issues = await lintDocs(loadRepo(process.cwd()));
    expect(issues.map((i) => `${i.file}${i.line ? `:${i.line}` : ''}: ${i.message}`)).toEqual([]);
  }, 60000);
});
