import { describe, expect, it } from 'vitest';
import type { PlayStats } from '../judge/types';
import { DEFAULT_RAMP, cleanLap, nextChoice, nextTarget, rampAfterLap, scrollRamp, toggleUnit, type TempoRamp } from './tempoRamp';

const ramp = (over: Partial<TempoRamp>): TempoRamp => ({ ...DEFAULT_RAMP, onlyClean: false, ...over });
const stats = (over: Partial<PlayStats>): PlayStats => ({
  notes: 6, firstTryCorrect: 6, mistakes: 0, accuracy: 1, rhythmErrorMs: null, hints: { noteNames: 0, fingers: 0 }, bothHands: { notes: 0, together: 0 }, ...over,
});

describe('tempo ramp of a looped section', () => {
  it('core_03.AC5 is off with a step of 0 (the default)', () => {
    expect(rampAfterLap(DEFAULT_RAMP, 122, 80, 0, true)).toEqual({ percent: 80, laps: 1 });
  });

  it('core_03.AC5 goes up by the step in BPM every N laps', () => {
    const r = ramp({ step: 2, stepUnit: 'bpm', every: 2, target: 200, targetUnit: 'percent' });
    expect(rampAfterLap(r, 100, 80, 0, false)).toEqual({ percent: 80, laps: 1 });
    expect(rampAfterLap(r, 100, 80, 1, false)).toEqual({ percent: 82, laps: 0 });
  });

  it('core_03.AC5 a step of 2% of 122 BPM is about 2.44 BPM, and a target of 200% stops at 244 BPM', () => {
    const r = ramp({ step: 2, stepUnit: 'percent', target: 200, targetUnit: 'percent' });
    expect(rampAfterLap(r, 122, 100, 0, true).percent).toBe(102);
    expect(rampAfterLap(r, 122, 199, 0, true).percent).toBe(200); // never past the target
    expect(rampAfterLap(r, 122, 200, 0, true)).toEqual({ percent: 200, laps: 1 }); // looping goes on, the tempo stays
  });

  it('core_03.AC5 a target in BPM stops the ramp there; a tempo already above it is left alone', () => {
    const r = ramp({ step: 10, stepUnit: 'bpm', target: 130, targetUnit: 'bpm' });
    expect(rampAfterLap(r, 100, 125, 0, true).percent).toBe(130);
    expect(rampAfterLap(r, 100, 140, 0, true).percent).toBe(140);
  });

  it('core_03.AC5 with only clean laps, an unclean lap never increments, even after more than N laps', () => {
    const r = ramp({ step: 5, stepUnit: 'percent', every: 2, onlyClean: true, target: 150 });
    expect(rampAfterLap(r, 100, 80, 3, false)).toEqual({ percent: 80, laps: 4 });
    expect(rampAfterLap(r, 100, 80, 4, true)).toEqual({ percent: 85, laps: 0 });
  });

  it('core_03.AC5 a clean lap is 100% pitch and, in Tempo mode, a timing score of 95 or more', () => {
    expect(cleanLap(stats({}))).toBe(true);
    expect(cleanLap(stats({ accuracy: 5 / 6, firstTryCorrect: 5 }))).toBe(false);
    expect(cleanLap(stats({ mistakes: 1 }))).toBe(false);
    const timing = { played: 6, onTime: 6, early: 0, late: 0, missed: 0, meanAbsErrorMs: 10 };
    expect(cleanLap(stats({ timing: { ...timing, score: 95 } }))).toBe(true);
    expect(cleanLap(stats({ timing: { ...timing, score: 94 } }))).toBe(false);
  });

  it('core_03.AC5 the unit toggles between BPM and %, keeping the value to a whole number', () => {
    const r = ramp({ step: 2, stepUnit: 'percent', target: 200, targetUnit: 'percent' });
    expect(toggleUnit(r, 'step', 122)).toMatchObject({ step: 2, stepUnit: 'bpm' });
    expect(toggleUnit(r, 'target', 122)).toMatchObject({ target: 244, targetUnit: 'bpm' });
    expect(toggleUnit(toggleUnit(r, 'target', 122), 'target', 122)).toMatchObject({ target: 200, targetUnit: 'percent' });
  });

  it('core_03.AC5 the cycling buttons take the next choice and wrap round', () => {
    expect(nextChoice([1, 2, 3], 2)).toBe(3);
    expect(nextChoice([1, 2, 3], 3)).toBe(1);
    expect(nextTarget(ramp({ target: 100, targetUnit: 'percent' }), 122)).toBe(110);
    expect(nextTarget(ramp({ target: 122, targetUnit: 'bpm' }), 122)).toBe(134);
    expect(nextTarget(ramp({ target: 200, targetUnit: 'percent' }), 122)).toBe(100);
  });
});

describe('tempo ramp: the mouse wheel', () => {
  it('core_03.AC5 a notch moves a value by one in its unit, within its range', () => {
    const r = ramp({ step: 0, stepUnit: 'bpm', every: 1, target: 244, targetUnit: 'bpm' });
    expect(scrollRamp(r, 'step', 1, 122).step).toBe(1);
    expect(scrollRamp(r, 'step', -1, 122).step).toBe(0);
    expect(scrollRamp(r, 'every', -1, 122).every).toBe(1);
    expect(scrollRamp(r, 'every', 1, 122).every).toBe(2);
    expect(scrollRamp(r, 'target', 1, 122).target).toBe(244); // 200% of 122
    expect(scrollRamp(r, 'target', -1, 122).target).toBe(243);
    expect(scrollRamp(ramp({ target: 30, targetUnit: 'percent' }), 'target', -1, 122).target).toBe(30);
  });
});
