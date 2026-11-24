// The git merge driver for docs with generated blocks (`mergeDriver.ts`). Git runs it as `... %O %A %B` for the files
// marked `merge=docs-index` in .gitattributes (set up by `npm install`'s `prepare`); the result goes into %A, and the
// exit status is 0 for a clean merge, 1 when the hand-written text still conflicts.
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { mergeGenerated } from './mergeDriver.ts';

const [basePath, oursPath, theirsPath] = process.argv.slice(2);
if (!basePath || !oursPath || !theirsPath) {
  console.error('usage: merge-driver-cli.ts <base> <ours> <theirs>');
  process.exit(2);
}
const read = (path: string): string => readFileSync(path, 'utf8');
const dir = mkdtempSync(join(tmpdir(), 'pianor-merge-'));
const result = mergeGenerated(read(basePath), read(oursPath), read(theirsPath), (base, ours, theirs) => {
  const [o, a, b] = ['base', 'ours', 'theirs'].map((name) => join(dir, name)) as [string, string, string];
  writeFileSync(o, base);
  writeFileSync(a, ours);
  writeFileSync(b, theirs);
  try {
    execFileSync('git', ['merge-file', '-L', 'ours', '-L', 'base', '-L', 'theirs', a, o, b], { stdio: 'ignore' });
    return { text: read(a), conflicts: false };
  } catch {
    return { text: read(a), conflicts: true };
  }
});
rmSync(dir, { recursive: true, force: true });
writeFileSync(oursPath, result.text);
process.exit(result.conflicts ? 1 : 0);
