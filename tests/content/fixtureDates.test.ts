import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { FIXTURE_LAST_YEAR } from '../../tools/test/fixtureTime';

const DATE = /\b((?:19|20)\d\d)-[01]\d-[0-3]\d(?!\d)|(?:Date\.UTC|new Date)\(((?:19|20)\d\d),/g;

describe('test and fixture dates (d165)', () => {
  it(`keeps every day in tests and fixtures in ${FIXTURE_LAST_YEAR} or before`, () => {
    const files = execFileSync('git', ['ls-files', '-z', '--cached', '--others', '--exclude-standard', '--', 'src', 'tests', 'tools', 'content'], { encoding: 'utf8' })
      .split('\0')
      .filter((f) => /\.(ts|json|abc|txt)$/.test(f) && f !== 'tests/content/fixtureDates.test.ts');
    const late: string[] = [];
    for (const file of files) {
      readFileSync(file, 'utf8').split('\n').forEach((line, i) => {
        for (const m of line.matchAll(DATE)) if (Number(m[1] ?? m[2]) > FIXTURE_LAST_YEAR) late.push(`${file}:${i + 1}`);
      });
    }
    expect(late).toEqual([]);
  });
});
