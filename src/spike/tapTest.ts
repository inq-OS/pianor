/**
 * The tap test of the hardware spike: the page plays clicks, the player presses a key on each click, and the offset of
 * each key press from the moment the click was heard shows how late the computer gets a key it was played in time
 * (MIDI delay, the part of the sound delay the browser does not report, and the player's own habit). Pure: times in, numbers out.
 */
import { median } from './median';

export interface TapAnalysis {
  clicks: number;
  taps: number;
  /** Clicks after the warm-up that found a tap. */
  matched: number;
  /** Tap minus click for every matched click, in click order (positive: the key came after the click). */
  offsetsMs: number[];
  medianMs: number | null;
  /** Median distance from the median: how steady the taps were. */
  spreadMs: number | null;
  minMs: number | null;
  maxMs: number | null;
}

/** `count` click times from `start`, one beat apart at `bpm` (all in ms). */
export function clickTimes(start: number, bpm: number, count: number): number[] {
  const beat = 60000 / bpm;
  return Array.from({ length: count }, (_, i) => start + i * beat);
}

const round = (ms: number) => Math.round(ms * 10) / 10;


/**
 * Match every click after the first `warmup` ones (the player is still finding the beat) to the nearest unused tap less
 * than half a beat away, and report the offsets.
 */
export function analyseTaps(clicks: readonly number[], taps: readonly number[], options: { warmup?: number } = {}): TapAnalysis {
  const warmup = options.warmup ?? 2;
  const spacing = clicks.length > 1 ? median(clicks.slice(1).map((c, i) => c - clicks[i]!))! : Infinity;
  const used = new Set<number>();
  const offsets: number[] = [];
  clicks.forEach((click, i) => {
    if (i < warmup) return;
    let best = -1;
    taps.forEach((tap, k) => {
      if (used.has(k) || Math.abs(tap - click) >= spacing / 2) return;
      if (best < 0 || Math.abs(tap - click) < Math.abs(taps[best]! - click)) best = k;
    });
    if (best >= 0) {
      used.add(best);
      offsets.push(round(taps[best]! - click));
    }
  });
  const mid = median(offsets);
  return {
    clicks: clicks.length,
    taps: taps.length,
    matched: offsets.length,
    offsetsMs: offsets,
    medianMs: mid === null ? null : round(mid),
    spreadMs: mid === null ? null : round(median(offsets.map((o) => Math.abs(o - mid)))!),
    minMs: offsets.length > 0 ? Math.min(...offsets) : null,
    maxMs: offsets.length > 0 ? Math.max(...offsets) : null,
  };
}
