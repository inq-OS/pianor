import type { PlayStats } from '../judge';
import { median } from '../median';
/** Phase 2 of a monster ("find the door"): the tracked tempo decides whether the door opens. */

export type DoorState = 'door-open' | 'key-broken';

/**
 * `ratio` is how well the part kept the tempo, 0 to 1 (`doorShareFromTempo`: the share of notes played on time);
 * `share` is the required share, 0 to 1. At or above the share the door opens.
 */
export function doorState(ratio: number, share: number): DoorState {
  return Number.isFinite(ratio) && ratio >= share ? 'door-open' : 'key-broken';
}

/**
 * Tempo ratio from note onset times (ms): the target beat length divided by the
 * median played inter-onset interval. Intervals that are not finite or not positive
 * are ignored. Returns null when fewer than 2 onsets are given or no interval is usable.
 */
export function tempoRatioFromOnsets(onsetsMs: readonly number[], targetBeatMs: number): number | null {
  if (onsetsMs.length < 2) return null;
  const intervals: number[] = [];
  for (let i = 1; i < onsetsMs.length; i++) {
    const d = (onsetsMs[i] ?? Number.NaN) - (onsetsMs[i - 1] ?? Number.NaN);
    if (Number.isFinite(d) && d > 0) intervals.push(d);
  }
  if (intervals.length === 0) return null;
  return targetBeatMs / median(intervals)!;
}

/**
 * The door's share of a part played in Tempo mode (phase 2, ft_1_06): the notes played on time (inside the judge's
 * good window, `TimingStats.onTime`) over the part's notes. Early, late, wrong and missed notes do not count, so the student
 * has to keep up with the clock, not only reach the end. A part with no notes counts as on time; a result with no timing
 * (not played in Tempo mode) counts as none on time.
 */
export function doorShareFromTempo(result: Pick<PlayStats, 'notes' | 'timing'>): number {
  if (result.notes === 0) return 1;
  return (result.timing?.onTime ?? 0) / result.notes;
}

/** The fewest of `notes` notes on time that reach `share` (what the door asks for, said to the student). */
export function doorNotesNeeded(notes: number, share: number): number {
  for (let n = 0; n <= notes; n++) if (doorState(notes === 0 ? 1 : n / notes, share) === 'door-open') return n;
  return notes;
}
