import { describe, expect, it } from 'vitest';
import setup, { treeChangedWarning, treeState } from './treeGuard';

const HEAD_A = 'a'.repeat(40);
const HEAD_B = 'b'.repeat(40);

describe('the working-tree guard of the unit-test run', () => {
  it('says nothing when the tree is the one the run started on, or outside git', () => {
    expect(treeChangedWarning(`${HEAD_A}\n`, `${HEAD_A}\n`)).toBeNull();
    expect(treeChangedWarning(null, `${HEAD_A}\n`)).toBeNull();
    expect(treeChangedWarning(`${HEAD_A}\n`, null)).toBeNull();
  });

  it('warns when the checked-out commit changed during the run, as a pull would', () => {
    const warning = treeChangedWarning(`${HEAD_A}\n`, `${HEAD_B}\n M content/campaign/ladder.json\n`);
    expect(warning).toContain('the checked-out commit changed (aaaaaaa to bbbbbbb)');
    expect(warning).toContain('Run the tests again');
  });

  it('warns when tracked files changed on the same commit', () => {
    expect(treeChangedWarning(`${HEAD_A}\n`, `${HEAD_A}\n M src/core/campaign/content.ts\n`)).toContain('tracked files changed');
  });

  it('reads the commit and the changed files from git, and gives null when git fails', () => {
    const calls: string[][] = [];
    const fake = (args: string[]) => (calls.push(args), args[0] === 'rev-parse' ? `${HEAD_A}\n` : ' M x.ts\n');
    expect(treeState(fake)).toBe(`${HEAD_A}\n M x.ts\n`);
    expect(calls).toEqual([['rev-parse', 'HEAD'], ['status', '--porcelain', '--untracked-files=no']]);
    expect(treeState(() => { throw new Error('not a git repository'); })).toBeNull();
    expect(treeState()).toMatch(/^[0-9a-f]{40}\n/); // this repository
  });

  it('as the global setup, returns a teardown that stays quiet on an unchanged tree', () => {
    const warn: unknown[] = [];
    const original = console.warn;
    console.warn = (...args: unknown[]) => void warn.push(args);
    try {
      setup()();
    } finally {
      console.warn = original;
    }
    expect(warn).toEqual([]);
  });
});
