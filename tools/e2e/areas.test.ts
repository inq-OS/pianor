import { existsSync, readdirSync, statSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { specPath } from './affected.ts';
import { E2E_AREAS, NO_E2E_PATHS, SHARED_PATHS } from './areas.ts';

const specFiles = readdirSync('tests/e2e').filter((f) => f.endsWith('.spec.ts')).map((f) => `tests/e2e/${f}`);

describe('the e2e area table', () => {
  it('puts every spec file in exactly one area', () => {
    for (const file of specFiles) {
      const owners = E2E_AREAS.filter((a) => a.specs.some((s) => specPath(s) === file)).map((a) => a.name);
      expect(owners, `${file} belongs to ${owners.length} areas; add it to one area in tools/e2e/areas.ts`).toHaveLength(1);
    }
  });

  it('names only spec files that exist, and unique area names', () => {
    for (const area of E2E_AREAS) for (const s of area.specs) expect(specFiles, `${area.name}: ${s}`).toContain(specPath(s));
    const names = E2E_AREAS.map((a) => a.name);
    expect(new Set(names).size).toBe(names.length);
  });

  it('names only paths that exist, folders with a trailing slash', () => {
    const patterns = [...E2E_AREAS.flatMap((a) => a.sources), ...SHARED_PATHS, ...NO_E2E_PATHS].filter((p) => !p.startsWith('*.'));
    for (const p of patterns) {
      expect(existsSync(p), `${p} does not exist; update tools/e2e/areas.ts`).toBe(true);
      expect(statSync(p).isDirectory(), `${p}: a folder ends in /, a file does not`).toBe(p.endsWith('/'));
    }
  });
});
