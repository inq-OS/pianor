/**
 * The time window of phase 1 ("find the key", ft_1_06): the time the level's bars take at the
 * piece's own tempo, times the level's window factor. Tick-based: the bars give the ticks and the
 * tempo map turns them into milliseconds, so a meter or tempo change inside the part is followed.
 */
import type { Chart } from '../chart';
import { tickToMs } from '../chart/time';

/** Inclusive, 1-based bar range of a level, as in the ladder. */
export type LevelBars = readonly [number, number];

/** Milliseconds bars `bars[0]` to `bars[1]` (1-based, inclusive) take at the chart's tempo. Throws when they are not bars of the chart. */
export function partPlayingMs(chart: Pick<Chart, 'tempoMap' | 'bars'>, bars: LevelBars): number {
  const [first, last] = bars;
  if (!Number.isInteger(first) || !Number.isInteger(last) || first < 1 || last < first || last > chart.bars.length) {
    throw new Error(`level bars ${first} to ${last} are not bars of a chart of ${chart.bars.length}`);
  }
  return tickToMs(chart.tempoMap, chart.bars[last - 1]!.endTick) - tickToMs(chart.tempoMap, chart.bars[first - 1]!.startTick);
}

/**
 * The phase 1 window in whole milliseconds: the part's playing time times `factor`, rounded up.
 * `factor` is at least 1, so the window is never shorter than the part itself; throws otherwise.
 */
export function findKeyWindowMs(chart: Pick<Chart, 'tempoMap' | 'bars'>, bars: LevelBars, factor: number): number {
  if (!Number.isFinite(factor) || factor < 1) throw new Error(`window factor must be at least 1, got ${factor}`);
  return Math.ceil(partPlayingMs(chart, bars) * factor);
}
