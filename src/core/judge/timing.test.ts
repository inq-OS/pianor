// Covers core_01.AC2.
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { DEFAULT_HOLD_RULES, DEFAULT_TEMPO_WINDOWS, fullHoldMs, holdOf, timingOf } from './timing';

const w = { perfectMs: 60, goodMs: 150, windowMs: 400 };

describe('timingOf: how far off a Tempo-mode press is', () => {
  it('uses the default windows when none are given', () => {
    expect(timingOf(0)).toEqual(timingOf(0, DEFAULT_TEMPO_WINDOWS));
  });

  it('scores 100 up to and including the perfect window, either side', () => {
    expect(timingOf(0, w)).toEqual({ errorMs: 0, verdict: 'on-time', score: 100 });
    expect(timingOf(60, w).score).toBe(100);
    expect(timingOf(-60, w).score).toBe(100);
    expect(timingOf(62, w).score).toBe(99); // 61 still rounds to 100
  });

  it('is on time up to and including the good window, then early or late by its sign', () => {
    expect(timingOf(150, w).verdict).toBe('on-time');
    expect(timingOf(-150, w).verdict).toBe('on-time');
    expect(timingOf(151, w).verdict).toBe('late');
    expect(timingOf(-151, w).verdict).toBe('early');
  });

  it('falls in a straight line from 100 at the perfect window to 0 at the window, and never below', () => {
    expect(timingOf(230, w).score).toBe(50); // half way from 60 to 400
    expect(timingOf(400, w).score).toBe(0);
    expect(timingOf(-1000, w).score).toBe(0);
  });

  it('does not divide by zero when the perfect window is the whole window', () => {
    expect(timingOf(10, { perfectMs: 50, goodMs: 50, windowMs: 50 }).score).toBe(100);
    expect(timingOf(51, { perfectMs: 50, goodMs: 50, windowMs: 50 }).score).toBe(0);
  });

  it('is symmetric and never gains score further from the beat (property)', () => {
    fc.assert(fc.property(fc.integer({ min: 0, max: 1000 }), fc.integer({ min: 0, max: 1000 }), (a, b) => {
      const [near, far] = a <= b ? [a, b] : [b, a];
      expect(timingOf(-near, w).score).toBe(timingOf(near, w).score);
      expect(timingOf(far, w).score).toBeLessThanOrEqual(timingOf(near, w).score);
    }));
  });
});

describe('holdOf: how long a Tempo-mode note was held (core_01 slice f)', () => {
  it('core_01.AC6: full at max(85% of the value, value - 80 ms)', () => {
    expect(fullHoldMs(2000)).toBe(1920); // a whole note at 120 bpm: the ms slack decides
    expect(fullHoldMs(250)).toBeCloseTo(212.5, 6); // an eighth: 85% decides
    expect(holdOf(1920, 2000)).toEqual({ heldMs: 1920, fullMs: 1920, factor: 1, hold: 100 });
    expect(holdOf(5000, 2000).factor).toBe(1);
  });

  it('core_01.AC6: the factor falls linearly from 1 at a full hold to 0.5 for a tap', () => {
    expect(holdOf(0, 2000)).toMatchObject({ factor: 0.5, hold: 0 });
    expect(holdOf(960, 2000)).toMatchObject({ factor: 0.75, hold: 50 });
    expect(holdOf(-10, 2000).factor).toBe(0.5);
  });

  it('takes its numbers from one rules object', () => {
    expect(holdOf(500, 1000, { ...DEFAULT_HOLD_RULES, fullFraction: 0.5, slackMs: 1000, tapFactor: 0 })).toMatchObject({ fullMs: 500, factor: 1 });
    expect(holdOf(0, 1000, { ...DEFAULT_HOLD_RULES, tapFactor: 0.2 }).factor).toBeCloseTo(0.2, 9);
  });

  it('core_01.AC6: the hold is measured to the written end, so a late press needs less and an early one more', () => {
    expect(holdOf(1820, 2000, DEFAULT_HOLD_RULES, 100)).toMatchObject({ fullMs: 1820, factor: 1 });
    expect(holdOf(1920, 2000, DEFAULT_HOLD_RULES, -100)).toMatchObject({ fullMs: 2020, hold: 95 });
    expect(holdOf(0, 250, DEFAULT_HOLD_RULES, 300)).toMatchObject({ fullMs: 0, factor: 1 });
  });

  it('a value with no length counts as held in full', () => {
    expect(holdOf(0, 0)).toMatchObject({ factor: 1, hold: 100 });
  });

  it('the factor stays in [tap, 1] and grows with the hold', () => {
    fc.assert(fc.property(fc.integer({ min: 0, max: 5000 }), fc.integer({ min: 0, max: 5000 }), fc.integer({ min: 1, max: 4000 }), (a, b, value) => {
      const [lo, hi] = a <= b ? [a, b] : [b, a];
      const f = holdOf(lo, value).factor;
      return f >= 0.5 && f <= 1 && f <= holdOf(hi, value).factor;
    }));
  });
});
