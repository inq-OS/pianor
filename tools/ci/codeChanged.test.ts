import { describe, expect, it } from 'vitest';
import { codeChanged } from './codeChanged.ts';

describe('which CI steps a change needs (d090: the check job)', () => {
  it('a run with no pull request (the daily check of main, a manual run) checks the code', () => {
    expect(codeChanged(null)).toBe(true);
  });

  it('a pull request that changes only docs and Markdown skips the code steps', () => {
    expect(codeChanged(['docs/testing.md', 'projects/10x-dev/README.md', 'CLAUDE.md'])).toBe(false);
    expect(codeChanged(['docs/art/sheet.png'])).toBe(false);
    expect(codeChanged([])).toBe(false);
  });

  it('any other file is code, Windows paths included', () => {
    expect(codeChanged(['docs/testing.md', 'src/core/clock.ts'])).toBe(true);
    expect(codeChanged(['.github/workflows/ci.yml'])).toBe(true);
    expect(codeChanged(['content\\pieces\\x\\piece.meta.json'])).toBe(true);
  });
});
