import type { PlayStats } from '../judge/types';
import { RAMP_MAX_PERCENT, TEMPO_PERCENT } from './practiceSpeed';

/** How a ramp value is given: in beats per minute, or in percent of the piece's own tempo. */
export type RampUnit = 'bpm' | 'percent';

/**
 * The tempo ramp of a looped section (core_03.AC5): every `every` laps the tempo goes up by `step` until it reaches
 * `target`; then it stays there and the section keeps looping. A `step` of 0 is off.
 */
export interface TempoRamp {
  step: number;
  stepUnit: RampUnit;
  /** Laps per increment, 1 or more. */
  every: number;
  /** Only a clean lap may increment (`cleanLap`), even once `every` laps have passed. */
  onlyClean: boolean;
  target: number;
  targetUnit: RampUnit;
}

/** Off, with the piece's own tempo as its target: what a section starts with. */
export const DEFAULT_RAMP: TempoRamp = { step: 0, stepUnit: 'bpm', every: 1, onlyClean: true, target: 100, targetUnit: 'percent' };

/** The values the cycling buttons step through (a press takes the next, after the last comes the first). */
export const RAMP_CHOICES = {
  step: { bpm: [0, 1, 2, 3, 5, 10], percent: [0, 1, 2, 5, 10] },
  every: [1, 2, 3, 4, 5, 8, 10],
  targetPercent: [100, 110, 120, 125, 150, 175, 200],
} as const;


/** `value` given in `unit` as a percent of `baseBpm`. */
export function toPercent(value: number, unit: RampUnit, baseBpm: number): number {
  return unit === 'percent' ? value : (value / baseBpm) * 100;
}

/** A percent of `baseBpm` given in `unit`, rounded to a whole number as the buttons show it. */
export function fromPercent(percent: number, unit: RampUnit, baseBpm: number): number {
  return Math.round(unit === 'percent' ? percent : (percent * baseBpm) / 100);
}

/** The ramp with one value switched to the other unit, keeping (to the nearest whole number) what it means. */
export function toggleUnit(ramp: TempoRamp, which: 'step' | 'target', baseBpm: number): TempoRamp {
  if (which === 'step') {
    const unit: RampUnit = ramp.stepUnit === 'bpm' ? 'percent' : 'bpm';
    return { ...ramp, stepUnit: unit, step: fromPercent(toPercent(ramp.step, ramp.stepUnit, baseBpm), unit, baseBpm) };
  }
  const unit: RampUnit = ramp.targetUnit === 'bpm' ? 'percent' : 'bpm';
  return { ...ramp, targetUnit: unit, target: fromPercent(toPercent(ramp.target, ramp.targetUnit, baseBpm), unit, baseBpm) };
}

/** The next choice after `value` in `choices` (the first one when `value` is the last, or not in the list). */
export function nextChoice(choices: readonly number[], value: number): number {
  return choices.find((c) => c > value) ?? choices[0]!;
}

/** The next target a press shows: the next of the target percents, in the target's unit. */
export function nextTarget(ramp: TempoRamp, baseBpm: number): number {
  const choices = RAMP_CHOICES.targetPercent.map((p) => fromPercent(p, ramp.targetUnit, baseBpm));
  return nextChoice(choices, ramp.target);
}

/**
 * A lap is clean when every note was right at the first try with no wrong key (100% pitch) and, in Tempo mode, the
 * timing score is at least 95. AX-3 provisional: Wait mode has no beat to keep, so there only the pitch counts.
 */
export function cleanLap(stats: PlayStats): boolean {
  if (stats.accuracy < 1 || stats.mistakes > 0) return false;
  return stats.timing === undefined || stats.timing.score >= 95;
}

/**
 * After a lap: the tempo percent of the next lap and the laps counted towards the next increment. `laps` counts the laps
 * since the last increment, this one not yet included.
 */
export function rampAfterLap(ramp: TempoRamp, baseBpm: number, percent: number, laps: number, clean: boolean): { percent: number; laps: number } {
  const counted = laps + 1;
  const step = toPercent(ramp.step, ramp.stepUnit, baseBpm);
  const target = Math.min(RAMP_MAX_PERCENT, toPercent(ramp.target, ramp.targetUnit, baseBpm));
  if (!(step > 0) || percent >= target) return { percent, laps: counted };
  if (counted < Math.max(1, ramp.every) || (ramp.onlyClean && !clean)) return { percent, laps: counted };
  return { percent: Math.min(target, percent + step), laps: 0 };
}

/** The highest step and laps per step a scroll can reach. */
export const RAMP_WHEEL_MAX = { step: 50, every: 99 } as const;

/**
 * One notch of the mouse wheel over a ramp value: the value one whole number up (`direction` 1) or down, in its unit,
 * within its range (the target from TEMPO_PERCENT's lowest 30 % to RAMP_MAX_PERCENT of the piece).
 */
export function scrollRamp(ramp: TempoRamp, which: 'step' | 'every' | 'target', direction: 1 | -1, baseBpm: number): TempoRamp {
  const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
  if (which === 'step') return { ...ramp, step: clamp(ramp.step + direction, 0, RAMP_WHEEL_MAX.step) };
  if (which === 'every') return { ...ramp, every: clamp(ramp.every + direction, 1, RAMP_WHEEL_MAX.every) };
  const lo = Math.ceil(fromPercentExact(TEMPO_PERCENT.min, ramp.targetUnit, baseBpm));
  const hi = Math.floor(fromPercentExact(RAMP_MAX_PERCENT, ramp.targetUnit, baseBpm));
  return { ...ramp, target: clamp(ramp.target + direction, lo, hi) };
}

function fromPercentExact(percent: number, unit: RampUnit, baseBpm: number): number {
  return unit === 'percent' ? percent : (percent * baseBpm) / 100;
}
