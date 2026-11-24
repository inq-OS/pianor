/**
 * `npx tsx tools/analysis/train-cli.ts <manifest.json>` or `... --cipi <cipi/index.json>`: fit the Learned model of the
 * difficulty estimator (core_08.AC11) and write it to `private/models/` (or `content/models/` for a publishable set).
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { setFromArgs } from './setArgs';
import { buildSamples, modelPath, trainModel, trainReport } from './train';

const USAGE = 'usage: npx tsx tools/analysis/train-cli.ts <manifest.json> | --cipi <index.json>';
const args = process.argv.slice(2);
if (args.length === 0 || args.includes('--help')) {
  console.log(USAGE);
  process.exit(args.length === 0 ? 2 : 0);
}

const set = setFromArgs(args);
if (!set.ok) {
  console.error(`${set.error}\n${USAGE}`);
  process.exit(2);
}
const manifest = set.manifest;
let skipped = set.skipped;
const read = buildSamples(manifest, set.baseDir);
skipped = [...skipped, ...read.skipped];
if (new Set(read.samples.map((s) => s.group)).size < 2) {
  console.error(`${manifest.name}: ${read.samples.length} item(s) read from ${new Set(read.samples.map((s) => s.group)).size} composer(s); cross-validation needs two or more.`);
  for (const s of skipped.slice(0, 10)) console.error(`  ${s.id}: ${s.reason}`);
  if (skipped.length > 10) console.error(`  ... and ${skipped.length - 10} more`);
  process.exit(1);
}
const model = trainModel(manifest, read.samples, { trainedAt: new Date().toISOString() });
const out = modelPath(model);
mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, `${JSON.stringify(model, null, 2)}\n`);
for (const line of trainReport(model, skipped, out)) console.log(line);
