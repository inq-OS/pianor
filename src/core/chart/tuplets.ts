import type { Chart, ChartTuplet } from './schema.ts';

/** A note or rest of a chart, by what places it in a tuplet. */
interface Placed {
  track: string;
  voice: number;
  tick: number;
}

/** The tuplet a note or rest belongs to (core_09.AC49, d163): one of its own track and voice whose span holds its start. */
export function tupletOf(chart: Pick<Chart, 'tuplets'>, e: Placed): ChartTuplet | undefined {
  return chart.tuplets?.find((t) => t.track === e.track && t.voice === e.voice && e.tick >= t.startTick && e.tick <= t.endTick);
}

/**
 * The length a note or rest is written with: its played length, or inside a tuplet that length times `actual / normal`
 * (an eighth triplet plays 160 ticks and is written as an eighth, 240). The staff draws this, never the played length (core_09.AC50).
 */
export function writtenDurOf(chart: Pick<Chart, 'tuplets'>, e: Placed & { dur: number }): number {
  const t = tupletOf(chart, e);
  return t ? (e.dur * t.actual) / t.normal : e.dur;
}
