import { PIECE_BPM, type Chart } from '../chart';
import { metronomeFor } from './transport';

/**
 * How fast a practice run goes (core_03, core_02): the tempo percent and the click speed. Rules, so they live in core and
 * the practice screen only shows them.
 *
 * Three ranges, on purpose:
 * - the tempo percent the player picks: 30 to 150 in steps of ten (`TEMPO_PERCENT`);
 * - the click the player can move in Wait mode: a piece's own tempo range (`PIECE_BPM`, 30 to 500) in steps of 5
 *   (`CLICK_MIN`, `CLICK_MAX`, `CLICK_STEP`);
 * - the metronome's own safety limit (`METRONOME_BPM`, 30 to 1000): in Tempo mode the click is the music's pulse, which a fast
 *   piece at 150 percent, or a tempo ramp up to `RAMP_MAX_PERCENT`, takes past the click range, so the sound engine allows the
 *   fastest piece at the highest ramp.
 */
export const TEMPO_PERCENT = { min: 30, max: 150, step: 10, normal: 100 } as const;

/** The highest tempo percent a tempo ramp may reach (core_03.AC5); the -/+ buttons stop at TEMPO_PERCENT.max. */
export const RAMP_MAX_PERCENT = 200;

/** A tempo percent inside the range the player can pick. */
export function clampTempoPercent(percent: number): number {
  return Math.max(TEMPO_PERCENT.min, Math.min(TEMPO_PERCENT.max, percent));
}

/** The lowest and highest BPM the metronome clicks at, whatever it is asked. */
export const METRONOME_BPM = { min: PIECE_BPM.min, max: (PIECE_BPM.max * RAMP_MAX_PERCENT) / 100 } as const;

export function clampMetronomeBpm(bpm: number): number {
  return Math.min(METRONOME_BPM.max, Math.max(METRONOME_BPM.min, bpm));
}

/**
 * The click speed of the practice screen: the player raises or lowers the click in steps of 5 BPM.
 * The click is the piece's first tempo times the tempo percent (the percent buttons, steps of ten), plus a BPM offset the player set
 * with the click keys; the result stays between CLICK_MIN and CLICK_MAX. The offset belongs to Wait mode: in Tempo mode the click is
 * the pulse of the music (it follows the transport), so it must not run at another speed than the notes.
 */
export const CLICK_STEP = 5;
export const CLICK_MIN = PIECE_BPM.min;
export const CLICK_MAX = PIECE_BPM.max;

/** The click's BPM: the piece's tempo at the percent, rounded, plus the offset, clamped to the range. */
export function clickBpm(pieceBpm: number, percent: number, offset: number): number {
  return Math.max(CLICK_MIN, Math.min(CLICK_MAX, Math.round((pieceBpm * percent) / 100) + offset));
}

/** The offset after one step up (`direction` 1) or down (-1); unchanged when the step would leave the range. */
export function stepClickOffset(offset: number, direction: 1 | -1, pieceBpm: number, percent: number): number {
  const next = offset + direction * CLICK_STEP;
  const bpm = Math.round((pieceBpm * percent) / 100) + next;
  const towardRange = (direction === 1 && bpm < CLICK_MIN) || (direction === -1 && bpm > CLICK_MAX);
  return (bpm >= CLICK_MIN && bpm <= CLICK_MAX) || towardRange ? next : offset;
}

/** The Wait mode click for a chart: `metronomeFor` with the click speed offset on top. */
export function clickPlan(chart: Chart, percent: number, offset: number): { bpm: number; beatsPerBar: number } {
  const plan = metronomeFor(chart, percent);
  return { bpm: clickBpm(chart.tempoMap[0]!.bpm, percent, offset), beatsPerBar: plan.beatsPerBar };
}
