import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { renderLevels, customBlocks } from './customBlocks';
import { SCHEMAS, renderSchema, shape } from './schemaDoc';
import { loadRepo } from './repo';
import { anchorsOf, codeSpans, linesOf, slug, withoutCode } from './scan';
import { OPT_OUT, checkDocsTouched } from './touched';
import { makeRepo } from './testRepo';

describe('checkDocsTouched', () => {
  it('needs no docs when only other files changed', () => {
    expect(checkDocsTouched(['src/game/a.ts', 'README.txt'], '')).toBeNull();
    expect(checkDocsTouched(['src/core/a.test.ts', 'tools/docs/lint.ts'], '')).toBeNull();
  });

  it('accepts a change that touches a doc', () => {
    expect(checkDocsTouched(['src/core/judge/wait.ts', 'docs/features/ft_0_08-judge.md'], '')).toBeNull();
    expect(checkDocsTouched(['tools/piece/lint.ts', 'CLAUDE.md'], '')).toBeNull();
  });

  it('asks for a doc, or for "docs: n/a" and a reason', () => {
    const problem = checkDocsTouched(['src/core/judge/wait.ts', 'content/curriculum/levels.json'], 'Refactor');
    expect(problem).toContain('2 file(s)');
    expect(problem).toContain('src/core/judge/wait.ts');
    expect(checkDocsTouched(['tools/piece/lint.ts'], 'Pure rename.\n\nDocs: N/A, no behaviour change')).toBeNull();
    expect(OPT_OUT.test('docs:n/a')).toBe(true);
  });
});

describe('scan', () => {
  it('numbers lines from the top of the file, front matter included, and marks fences', () => {
    const lines = linesOf('---\nid: "x"\n---\n# T\n```\ncode\n```\ntext\n');
    expect(lines.map((l) => [l.n, l.fenced])).toEqual([[4, false], [5, true], [6, true], [7, true], [8, false], [9, false]]);
  });

  it('numbers lines of a file without front matter from 1', () => {
    expect(linesOf('a\nb')[1]?.n).toBe(2);
  });

  it('strips and lists inline code', () => {
    expect(withoutCode('a `b` c `d`')).toBe('a  c ');
    expect(codeSpans('a `b` c `d e`')).toEqual(['b', 'd e']);
  });

  it('makes GitHub anchors', () => {
    expect(slug('Hello, World! `code` [link](x.md)')).toBe('hello-world-code-link');
    expect([...anchorsOf('# One\n## Two things\n```\n# not\n```\n## One\n')]).toEqual(['one', 'two-things', 'one-1']);
  });
});

describe('custom blocks', () => {
  it('renders the level table from levels.json', () => {
    const text = loadRepo(process.cwd()).read('content/curriculum/levels.json') ?? '';
    const out = renderLevels(text);
    expect(typeof out).toBe('string');
    expect(out as string).toContain('| Level | Name | Hands |');
    expect(out as string).toMatch(/\| 1 \| Right hand, C position, steps \| RH \| treble \| C4 to G4 \|/);
  });

  it('reports a levels file that is not valid', () => {
    expect(renderLevels('{')).toMatchObject({ error: expect.stringContaining('not valid JSON') });
  });

  it('wires the blocks to the repo and knows the usage text', () => {
    expect(customBlocks(makeRepo({})).levels([])).toMatchObject({ error: expect.stringContaining('does not exist') });
    expect(customBlocks(makeRepo({ 'content/curriculum/levels.json': '{' })).levels([])).toMatchObject({ error: expect.any(String) });
    const usage = customBlocks(makeRepo({})).usage(['generate']);
    expect(usage).toContain('piece:generate <kind> --level N');
    expect(customBlocks(makeRepo({})).usage(['nope'])).toMatchObject({ error: expect.stringContaining('unknown command') });
  });
});

describe('loadRepo', () => {
  const repo = loadRepo(process.cwd());

  it('reads the docs, the scripts and the paths of this repository', () => {
    expect(repo.docs.has('CLAUDE.md')).toBe(true);
    expect(repo.docs.has('docs/features/FEATURES.md')).toBe(true);
    expect(repo.scripts.has('docs:check')).toBe(true);
    expect(repo.paths.has('docs/features')).toBe(true);
    expect(repo.paths.has('node_modules')).toBe(false);
    expect(repo.sources.has('src/core/judge/wait.ts')).toBe(true);
    expect([...repo.sources.keys()].some((p) => p.startsWith('tools/docs/'))).toBe(false);
  });

  it('reads files on demand and says null for what is not a file', () => {
    expect(repo.read('package.json')).toContain('"scripts"');
    expect(repo.read('docs')).toBeNull();
    expect(repo.read('nope.txt')).toBeNull();
  });
});

describe('schema blocks', () => {
  it('writes types compactly', () => {
    expect(shape({ type: 'integer', minimum: 0 })).toBe('int>=0');
    expect(shape({ type: 'integer', exclusiveMinimum: 0 })).toBe('int>0');
    expect(shape({ type: 'integer', minimum: -2 })).toBe('int>=-2');
    expect(shape({ type: 'number', exclusiveMinimum: 3 })).toBe('number>3');
    expect(shape({ type: 'string' })).toBe('string');
    expect(shape({ const: 1 })).toBe('1');
    expect(shape({ enum: ['a', 'b'] })).toBe('"a" | "b"');
    expect(shape({ anyOf: [{ type: 'string' }, { type: 'null' }] })).toBe('string | null');
    expect(shape({ type: 'array', items: { type: 'boolean' } })).toBe('[boolean]');
    expect(shape({ type: 'array' })).toBe('[any]');
    expect(shape({ type: 'object', properties: { a: { type: 'string' }, b: { type: 'string' } }, required: ['a'] })).toBe('{ a: string, b?: string }');
    expect(shape({ type: 'object', additionalProperties: { type: 'string' } })).toBe('{ [key]: string }');
    expect(shape({})).toBe('any');
    expect(shape(true)).toBe('any');
  });

  it('renders a zod object one field per line', () => {
    const out = renderSchema(z.object({ id: z.string(), n: z.int().min(0).optional() }));
    expect(out.split('\n')).toEqual(['```text', '{', '  id: string', '  n?: int>=0', '}', '```']);
  });

  it('renders the chart and meta schemas and rejects unknown names', () => {
    const blocks = customBlocks(makeRepo({}));
    expect(blocks.schema(['chart'])).toContain('tempoMap: [{ tick: int>=0, bpm: number>0 }]');
    expect(Object.keys(SCHEMAS)).toEqual(['chart', 'meta']);
    expect(blocks.schema(['meta'])).toContain('```text');
    expect(blocks.schema(['nope'])).toMatchObject({ error: expect.stringContaining('unknown schema') });
    expect(blocks.schema([])).toMatchObject({ error: expect.any(String) });
  });
});
