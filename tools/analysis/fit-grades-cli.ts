/**
 * `npx tsx tools/analysis/fit-grades-cli.ts <manifest.json>` or `... --cipi <cipi/index.json>`: fit the points above
 * Beginner (`tail`) to a graded set and print the suggestion (core_08.AC12). Nothing is written: a person accepts it.
 */
import { DIFFICULTY_WEIGHTS } from '../../src/core/piece/difficulty';
import { fitTail, gradeFitReport, scoreItems } from './gradeFit';
import { setFromArgs } from './setArgs';

const USAGE = 'usage: npx tsx tools/analysis/fit-grades-cli.ts <manifest.json> | --cipi <index.json>';
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
const scored = scoreItems(set.manifest, set.baseDir);
const fit = fitTail(scored.items, DIFFICULTY_WEIGHTS.beginnerEnd);
for (const line of gradeFitReport(set.manifest.name, fit, [...set.skipped, ...scored.skipped])) console.log(line);
