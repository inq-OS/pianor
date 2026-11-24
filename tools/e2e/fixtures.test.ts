import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const DIR = 'tests/e2e';
const specs = readdirSync(DIR).filter((f) => f.endsWith('.spec.ts'));

describe('the end-to-end specs use the shared fixtures (tests/e2e/fixtures.ts)', () => {
  it('every spec takes test and expect from ./fixtures, never from Playwright, so the page-error guard runs in every test', () => {
    expect(specs.length).toBeGreaterThan(0);
    const wrong = specs.filter((file) => {
      const text = readFileSync(join(DIR, file), 'utf8');
      const fromPlaywright = /import \{([^}]*)\} from '@playwright\/test'/.exec(text)?.[1] ?? '';
      const values = fromPlaywright.split(',').map((n) => n.trim()).filter((n) => n && !n.startsWith('type '));
      return values.includes('test') || values.includes('expect') || !/from '\.\/fixtures'/.test(text);
    });
    expect(wrong).toEqual([]);
  });
});
