import { pickupTicks, type Chart } from '../chart';
import type { BarRange } from './difficulty';

/**
 * Bar lists as people write them, with bars numbered as printed (a pick-up is 0, the first full bar 1; d120): "1-4, 9-12"
 * is bars 1 to 4 and then 9 to 12, in that order; a bar or a range may come again ("1-2, 1-2" plays them twice). Pure; the
 * piece preview's passage box reads it (core_08.AC8).
 */
export function parseBarList(text: string, chart: Chart): { ranges: BarRange[] } | { error: string } {
  const offset = printedOffset(chart);
  const first = offset === 0 ? 0 : 1;
  const last = chart.bars.length - 1 + offset;
  const tokens = text.split(/[,;\s]+/).filter((t) => t !== '');
  if (tokens.length === 0) return { error: 'write bars like 1-4, 9-12' };
  const ranges: BarRange[] = [];
  for (const token of tokens) {
    const match = /^(\d+)(?:-(\d+))?$/.exec(token);
    if (!match) return { error: `"${token}" is not a bar or a range like 3-6` };
    const from = Number(match[1]);
    const to = match[2] === undefined ? from : Number(match[2]);
    if (to < from) return { error: `${token}: the second bar comes before the first` };
    if (from < first || to > last) return { error: `${token}: this piece has bars ${first} to ${last}` };
    ranges.push({ first: from - offset, last: to - offset });
  }
  return { ranges };
}

/** The bar list `parseBarList` reads back as `ranges`, in printed numbers: "1-4, 9". */
export function formatBarList(ranges: readonly BarRange[], chart: Chart): string {
  const offset = printedOffset(chart);
  return ranges.map((r) => (r.first === r.last ? `${r.first + offset}` : `${r.first + offset}-${r.last + offset}`)).join(', ');
}

const printedOffset = (chart: Chart) => (pickupTicks(chart.bars, chart.meterMap) > 0 ? 0 : 1);
