import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { emptyBlocks, mergeGenerated, refillBlocks } from './mergeDriver.ts';

const doc = (intro: string, rows: string, outro = 'Outro.'): string =>
  `# Index\n\n${intro}\n\n<!-- docs:index features ft_1 -->\n${rows}\n<!-- /docs:index -->\n\n${outro}\n`;

describe('the merge driver of generated docs blocks', () => {
  it('empties every generated block and keeps the text around it', () => {
    expect(emptyBlocks(doc('Intro.', '| a | 1 |\n| b | 2 |'))).toBe(doc('Intro.', '').replace('\n\n<!-- /docs', '\n<!-- /docs'));
  });

  it('puts back the bodies of our side by the block they belong to', () => {
    const ours = doc('Intro.', '| a | 1 |');
    expect(refillBlocks(emptyBlocks(doc('New intro.', 'x')), ours)).toBe(doc('New intro.', '| a | 1 |'));
  });

  it('merges two branches that both changed a row of a generated table without a conflict', () => {
    const base = doc('Intro.', '| a | 1 |\n| b | 1 |');
    const ours = doc('Intro.', '| a | 2 |\n| b | 1 |');
    const theirs = doc('Intro.', '| a | 1 |\n| b | 3 |', 'Their outro.');
    const result = mergeGenerated(base, ours, theirs, gitMergeFile);
    expect(result.conflicts).toBe(false);
    // the hand-written text of both sides, and our table until `npm run docs:index` writes it again
    expect(result.text).toBe(doc('Intro.', '| a | 2 |\n| b | 1 |', 'Their outro.'));
  });

  it('still reports a conflict in the hand-written text', () => {
    const base = doc('Intro.', 'x');
    const result = mergeGenerated(base, doc('Ours.', 'x'), doc('Theirs.', 'x'), gitMergeFile);
    expect(result.conflicts).toBe(true);
    expect(result.text).toContain('<<<<<<<');
  });
});

/** The real three-way merge of git, as the command-line driver uses it. */
function gitMergeFile(base: string, ours: string, theirs: string): { text: string; conflicts: boolean } {
  const dir = mkdtempSync(join(tmpdir(), 'pianor-merge-'));
  const [o, a, b] = ['base', 'ours', 'theirs'].map((n) => join(dir, n)) as [string, string, string];
  writeFileSync(o, base);
  writeFileSync(a, ours);
  writeFileSync(b, theirs);
  try {
    execFileSync('git', ['merge-file', a, o, b], { stdio: 'ignore' });
    return { text: readFileSync(a, 'utf8'), conflicts: false };
  } catch {
    return { text: readFileSync(a, 'utf8'), conflicts: true };
  }
}
