import { z } from 'zod';
import { describe, expect, it } from 'vitest';
import { loadRepo } from './repo';
import { PERSISTED_FORMATS, literalVersion, renderSchemaVersions, type PersistedFormat } from './schemaVersions';
import { makeRepo } from './testRepo';

const row = (extra: Partial<PersistedFormat> = {}): PersistedFormat => ({
  format: 'Thing', where: 'browser storage', holder: 'THING_VERSION', source: 'src/thing.ts', version: 1, ...extra,
});

describe('docs:schema-versions', () => {
  it('reads the version from a schemaVersion literal, also behind a default', () => {
    expect(literalVersion(z.object({ schemaVersion: z.literal(3) }))).toBe(3);
    expect(literalVersion(z.object({ schemaVersion: z.literal(1).default(1), id: z.string() }))).toBe(1);
    expect(() => literalVersion(z.object({ id: z.string() }))).toThrow(/no numeric schemaVersion/);
  });

  it('renders one row per format with its version, holder and migration', () => {
    const repo = makeRepo({ 'src/thing.ts': '', 'src/migrate.ts': '', 'src/migrate.test.ts': '', 'content/thing.json': '{"schemaVersion":4}' });
    const out = renderSchemaVersions(repo, [
      row({ version: 2, migration: 'src/migrate.ts', migrationTest: 'src/migrate.test.ts' }),
      row({ format: 'Content', where: '`content/thing.json`', file: 'content/thing.json', version: 4 }),
      row({ format: 'New' }),
    ]);
    expect(typeof out).toBe('string');
    expect((out as string).split('\n')).toEqual([
      '| Format | Where | Version | Held by | Migration | Migration test |',
      '|---|---|---|---|---|---|',
      '| Thing | browser storage | 2 | `THING_VERSION` in `src/thing.ts` | `src/migrate.ts` | `src/migrate.test.ts` |',
      '| Content | `content/thing.json` | 4 | `THING_VERSION` in `src/thing.ts` | none: committed file, rewritten in each bump | none: committed file, rewritten in each bump |',
      '| New | browser storage | 1 | `THING_VERSION` in `src/thing.ts` | none yet | none yet |',
    ]);
  });

  it('fails on a missing file and on a content file whose version is not the code\'s', () => {
    const repo = makeRepo({ 'src/thing.ts': '', 'content/a.json': '{"schemaVersion":1}', 'content/b.json': 'not json' });
    const out = renderSchemaVersions(repo, [
      row({ version: 2, file: 'content/a.json', migration: 'src/gone.ts' }),
      row({ format: 'B', file: 'content/b.json' }),
    ]);
    expect(out).toEqual({ error: expect.stringContaining('docs:schema-versions:') });
    const error = (out as { error: string }).error;
    expect(error).toContain('Thing: src/gone.ts does not exist');
    expect(error).toContain('Thing: content/a.json has schemaVersion 1, the code reads 2');
    expect(error).toContain('B: content/b.json has schemaVersion not JSON, the code reads 1');
  });

  it('the real formats render from this repository, save data and chart first', () => {
    expect(PERSISTED_FORMATS.map((f) => f.format).slice(0, 2)).toEqual(['Save data (profiles)', 'Chart']);
    const out = renderSchemaVersions(loadRepo(process.cwd()));
    expect(typeof out === 'string' ? out : out.error).toMatch(/^\| Format \|/);
  });
});
