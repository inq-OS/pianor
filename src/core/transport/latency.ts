/**
 * Estimates the device's latency from taps made along with a beat.
 * Pure: takes plain millisecond times, no clock, no DOM.
 *
 * Each tap gives a difference `tap - beat` in ms. The median is robust to a few
 * wild taps. Differences more than OUTLIER_MS from that median are dropped, and the
 * median of the rest is the offset. A positive result means taps come late.
 */

import { median } from '../median';

export const MIN_TAPS_FOR_ESTIMATE = 3;
export const OUTLIER_MS = 100;


/** Offset in ms, or `null` when there are too few taps or the lists differ in length. */
export function estimateLatencyOffset(tapTimesMs: number[], beatTimesMs: number[]): number | null {
  if (tapTimesMs.length !== beatTimesMs.length) return null;
  if (tapTimesMs.length < MIN_TAPS_FOR_ESTIMATE) return null;
  if (!tapTimesMs.every(Number.isFinite) || !beatTimesMs.every(Number.isFinite)) return null;

  const diffs = tapTimesMs.map((tap, i) => tap - beatTimesMs[i]!);
  const middle = median(diffs)!;
  const kept = diffs.filter((d) => Math.abs(d - middle) <= OUTLIER_MS);
  // Two groups of taps can leave nothing within 100 ms of the median: no estimate.
  if (kept.length === 0) return null;
  return median(kept);
}
