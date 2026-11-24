import type { PlayStats } from '../judge';
/**
 * The share of a part played on time in Tempo mode, once phase 2 of a monster ("find the door", removed by d135) and now
 * the tug's Tempo measure (ft_1_21). `DoorState` stays because the saved campaign phase still names the door.
 */

export type DoorState = 'door-open' | 'key-broken';

/**
 * `ratio` is how well the part kept the tempo, 0 to 1 (`doorShareFromTempo`: the share of notes played on time);
 * `share` is the required share, 0 to 1. At or above the share the door opens.
 */
export function doorState(ratio: number, share: number): DoorState {
  return Number.isFinite(ratio) && ratio >= share ? 'door-open' : 'key-broken';
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
