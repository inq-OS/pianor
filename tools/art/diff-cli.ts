import { execFileSync, spawn } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { changeOf, contactSheet, diffSheet, imageTokens, readPng, rgbPngBytes, type DiffRow, type RgbPicture } from './diff.ts';

/**
 * `npm run art:diff -- <picture | kit [family] | figures | ui <sheet>> [hour] [--base <ref>]`: paints the picture on
 * this working tree and on the base (default: where this branch left origin/main), at every hour or the one given, at
 * 1x, and writes ONE sheet to look at: before, after and the changed pixels, cropped round the change
 * (`test-logs/art/<name>-diff.png`); for a change over a quarter of the picture, the four hours at 1x instead. It
 * prints what changed, hour by hour, and what the sheet costs to look at. The base's paintings are kept by commit in
 * `node_modules/.cache/pianor-art-diff`, so a painter's second look paints only the branch (the `paint-a-scene` skill).
 */

const HOURS = ['day', 'dawn', 'dusk', 'night'];
const BIG = 0.25;
const root = process.cwd();
const args = process.argv.slice(2);
const baseAt = args.indexOf('--base');
const baseRef = baseAt >= 0 ? args.splice(baseAt, 2)[1]! : undefined;
const git = (...a: string[]) => execFileSync('git', a, { encoding: 'utf8' }).trim();

const name = args.shift() ?? '';
const family = name === 'kit' && args[0] && !HOURS.includes(args[0]) ? args.shift() : undefined;
const sheet = name === 'ui' ? args.shift() : undefined;
const hours = name === 'ui' ? [''] : args[0] && HOURS.includes(args[0]) ? [args[0]] : HOURS;
if (!name || (name === 'ui' && !sheet)) {
  console.error('usage: npm run art:diff -- <picture | kit [family] | figures | ui <sheet>> [day|dawn|dusk|night] [--base <ref>]');
  process.exit(2);
}
const label = [name, family ?? sheet].filter(Boolean).join('-');

/** The render-cli words for one hour, writing to `file` at 1x. */
const renderArgs = (hour: string, file: string): string[] =>
  name === 'ui' ? ['ui', sheet!, file, '1'] : [name, ...(family ? [family] : []), hour, file, '1'];

const tsx = join(root, 'node_modules', '.bin', 'tsx');
/** Paints each hour in `cwd` to `files`, all at once; the paths of the ones that painted. */
async function paint(cwd: string, files: string[]): Promise<(string | undefined)[]> {
  return Promise.all(hours.map((hour, k) => new Promise<string | undefined>((done) => {
    const child = spawn(tsx, ['tools/art/render-cli.ts', ...renderArgs(hour, files[k]!)], { cwd, stdio: ['ignore', 'ignore', 'pipe'] });
    let err = '';
    child.stderr.on('data', (d: Buffer) => (err += d.toString()));
    child.on('close', (code) => {
      if (code !== 0 && cwd === root) console.error(err.trim());
      done(code === 0 ? files[k] : undefined);
    });
  })));
}

let base: string;
try {
  base = git('rev-parse', baseRef ?? git('merge-base', 'HEAD', 'origin/main'));
} catch {
  console.error(`Cannot find the base ${baseRef ?? 'origin/main'} (git fetch origin main first).`);
  process.exit(2);
}
const started = Date.now();
const out = join(root, 'test-logs', 'art');
const cache = join(root, 'node_modules', '.cache', 'pianor-art-diff', base.slice(0, 12));
mkdirSync(out, { recursive: true });
mkdirSync(cache, { recursive: true });

const afterFiles = hours.map((h) => join(out, `${[label, h].filter(Boolean).join('-')}-1x.png`));
const beforeFiles = hours.map((h) => join(cache, `${[label, h].filter(Boolean).join('-')}.png`));
const missing = beforeFiles.some((f) => !existsSync(f));
let tree: string | undefined;
if (missing) {
  tree = join(cache, 'tree');
  rmSync(tree, { recursive: true, force: true });
  git('worktree', 'prune');
  git('worktree', 'add', '--detach', tree, base);
  symlinkSync(join(root, 'node_modules'), join(tree, 'node_modules'));
}
const [after, before] = await Promise.all([paint(root, afterFiles), missing ? paint(tree!, beforeFiles) : Promise.resolve(beforeFiles)]);
if (tree) {
  rmSync(tree, { recursive: true, force: true });
  git('worktree', 'prune');
}
if (after.some((f) => !f)) process.exit(1);

const read = (f: string): RgbPicture => readPng(new Uint8Array(readFileSync(f)));
const afters = after.map((f) => read(f!));
const rows: DiffRow[] = [];
let biggest = 0;
console.log(`${label} against ${base.slice(0, 9)}${missing ? '' : ' (base from cache)'}:`);
hours.forEach((hour, k) => {
  const was = before[k];
  if (!was || !existsSync(was)) {
    console.log(`  ${hour || label}: new, nothing to compare with`);
    biggest = 1;
    return;
  }
  const c = changeOf(read(was), afters[k]!);
  biggest = Math.max(biggest, c.share);
  if (!c.box) return console.log(`  ${hour || label}: no change`);
  console.log(`  ${hour || label}: ${c.changed} pixels changed (${(c.share * 100).toFixed(2)}%), in ${c.box.w} x ${c.box.h} at ${c.box.x}, ${c.box.y}`);
  rows.push({ before: read(was), after: afters[k]!, box: c.box });
});

const file = join(out, `${label}-diff.png`);
let look: RgbPicture | undefined;
if (biggest > BIG) {
  look = contactSheet(afters);
  console.log(`A big change: the ${hours.length > 1 ? 'hours' : 'picture'} at 1x${hours.length > 1 ? ', two by two (day, dawn / dusk, night)' : ''}.`);
} else if (rows.length) {
  look = diffSheet(rows);
  console.log('One row per changed hour: before | after | the changed pixels in magenta.');
}
if (look) {
  writeFileSync(file, rgbPngBytes(look));
  console.log(`${resolve(file)}: ${look.width} x ${look.height}, about ${imageTokens(look.width, look.height)} tokens to look at`);
} else console.log('Nothing changed: no sheet.');
console.log(`(${((Date.now() - started) / 1000).toFixed(1)} s)`);
