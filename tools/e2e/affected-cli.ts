import { execFileSync, spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { playwrightArgs, selectAreas } from './affected.ts';

// `npm run test:e2e:affected [-- <base>] [--dry-run] [playwright options]`: runs the e2e areas that the changes since
// <base> (default origin/main) touch, plus the smoke tests, including uncommitted and new files (docs/testing.md section 10).
// CI's `changes` job runs this file with `node --experimental-strip-types` before any npm ci, so this file and what it
// imports up to `--dry-run` stay plain type-strippable TypeScript: `.ts` import paths, no enums, no packages (affected.test.ts).
const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const base = args.find((a) => !a.startsWith('-')) ?? 'origin/main';
const passThrough = args.filter((a) => a.startsWith('-') && a !== '--dry-run');

const git = (...a: string[]): string[] => execFileSync('git', a, { encoding: 'utf8' }).split('\n').map((l) => l.trim()).filter(Boolean);

let changed: string[];
try {
  changed = [...new Set([
    ...git('diff', '--name-only', '--no-renames', `${base}...HEAD`),
    ...git('diff', '--name-only', '--no-renames', 'HEAD'),
    ...git('ls-files', '--others', '--exclude-standard'),
  ])];
} catch {
  console.error(`Cannot compare with ${base} (fetch it first: git fetch origin main). Running every area.`);
  changed = ['(unknown changes)'];
}

const selection = selectAreas(changed);
const extra = playwrightArgs(selection);
console.log(`Changed files: ${changed.length}`);
for (const r of selection.reasons) console.log(`  ${r}`);
if (extra === null) {
  console.log('No end-to-end area is affected: nothing to run.');
  process.exit(0);
}
console.log(selection.all ? 'Running every area.' : `Running areas ${selection.areas.join(', ')} and the smoke tests.`);
if (dryRun) process.exit(0);

const cli = createRequire(import.meta.url).resolve('@playwright/test/cli');
const run = spawnSync(process.execPath, [cli, 'test', ...extra, ...passThrough], {
  stdio: 'inherit',
  env: { ...process.env, E2E_SELECTION: JSON.stringify(selection.reasons) },
});
process.exit(run.status ?? 1);
