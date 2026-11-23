/**
 * `npx tsx tools/analysis/calibrate-cli.ts <export.json>...`: fit the bar weights of the estimator to what players
 * measured, from their exported practice logs, and print the suggestion beside today's weights (core_08.AC14).
 * Nothing is written: a person accepts it. A piece is looked up in `content/pieces`, then the gitignored `private/pieces`.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Chart } from '../../src/core/chart';
import type { BarPlay } from '../../src/core/progression/practiceLog';
import { barSamples, calibrationReport, fitBarWeights, practiceLogOfExport } from './calibrate';
import { readScore } from './labelledSet';

const USAGE = 'usage: npx tsx tools/analysis/calibrate-cli.ts <export.json>... (player exports from the game)';
const files = process.argv.slice(2);
if (files.length === 0 || files.includes('--help')) {
  console.log(USAGE);
  process.exit(files.length === 0 ? 2 : 0);
}
const log: BarPlay[] = [];
for (const file of files) {
  try {
    log.push(...practiceLogOfExport(JSON.parse(readFileSync(file, 'utf-8'))).bars);
  } catch (error) {
    console.error(`${file}: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(2);
  }
}
const charts = new Map<string, Chart | null>();
const chartOf = (id: string): Chart | null => {
  if (!charts.has(id)) {
    const found = ['content/pieces', 'private/pieces'].map((dir) => readScore(join(dir, id))).find((r) => r.ok);
    charts.set(id, found?.ok ? found.chart : null);
  }
  return charts.get(id)!;
};
const { samples, skipped } = barSamples(log, chartOf);
for (const line of calibrationReport(fitBarWeights(samples), samples.length, skipped)) console.log(line);
