import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { SAMPLE_MIDIS, beatIntervalMs, nearestSample, playbackRate, sampleName, velocityToGain } from './mapping';

describe('samples', () => {
  it('has 21 sample notes from C2 to C7, every minor third', () => {
    expect(SAMPLE_MIDIS).toHaveLength(21);
    expect(SAMPLE_MIDIS[0]).toBe(36);
    expect(SAMPLE_MIDIS.at(-1)).toBe(96);
    for (let i = 1; i < SAMPLE_MIDIS.length - 1; i++) expect(SAMPLE_MIDIS[i]! - SAMPLE_MIDIS[i - 1]!).toBe(3);
  });

  it('names files the way the downloaded files are named', () => {
    expect(SAMPLE_MIDIS.map(sampleName)).toEqual([
      'C2', 'Ds2', 'Fs2', 'A2', 'C3', 'Ds3', 'Fs3', 'A3', 'C4', 'Ds4', 'Fs4', 'A4', 'C5', 'Ds5', 'Fs5', 'A5', 'C6', 'Ds6', 'Fs6', 'A6', 'C7',
    ]);
  });

  it('picks the nearest sample and never shifts a note more than 1.5 semitones on the keyboard (property)', () => {
    fc.assert(
      fc.property(fc.integer({ min: 36, max: 96 }), (midi) => {
        const sample = nearestSample(midi);
        expect(SAMPLE_MIDIS).toContain(sample);
        expect(Math.abs(midi - sample)).toBeLessThanOrEqual(1.5);
      }),
    );
  });

  it('uses the sample itself for sampled notes and the lower sample on a tie', () => {
    expect(nearestSample(60)).toBe(60);
    expect(nearestSample(61)).toBe(60);
    expect(nearestSample(62)).toBe(63);
    expect(nearestSample(36)).toBe(36);
    expect(nearestSample(10)).toBe(36);
    expect(nearestSample(120)).toBe(96);
  });
});

describe('playbackRate', () => {
  it('is 1 for the sample itself, 2 an octave up and 0.5 an octave down', () => {
    expect(playbackRate(60, 60)).toBe(1);
    expect(playbackRate(72, 60)).toBeCloseTo(2, 10);
    expect(playbackRate(48, 60)).toBeCloseTo(0.5, 10);
  });

  it('rises with pitch (property)', () => {
    fc.assert(
      fc.property(fc.integer({ min: 36, max: 95 }), (midi) => {
        expect(playbackRate(midi + 1, 60)).toBeGreaterThan(playbackRate(midi, 60));
      }),
    );
  });
});

describe('velocityToGain', () => {
  it('is audible when soft, loudest at 127 and strictly increasing', () => {
    expect(velocityToGain(1)).toBeGreaterThan(0.04);
    expect(velocityToGain(127)).toBeCloseTo(1, 10);
    for (let v = 2; v <= 127; v++) expect(velocityToGain(v)).toBeGreaterThan(velocityToGain(v - 1));
  });

  it('clamps out-of-range velocities', () => {
    expect(velocityToGain(0)).toBe(velocityToGain(1));
    expect(velocityToGain(500)).toBe(velocityToGain(127));
  });
});

describe('beats', () => {
  it('computes the interval in ms', () => {
    expect(beatIntervalMs(60)).toBe(1000);
    expect(beatIntervalMs(120)).toBe(500);
  });
});
