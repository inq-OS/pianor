import { describe, expect, it } from 'vitest';
import stepsJson from '../../../content/trainer/steps.json';
import { loadTrainerSteps, rangeOf, trainerStepsSchema } from './steps';

const valid = () => ({ schemaVersion: 1, steps: [{ id: 'a', name: 'A', range: { low: 60, high: 72 } }] });

describe('note-trainer steps (content/trainer/steps.json)', () => {
  // Covers ft_0_17.AC5: the steps come from validated content with a schemaVersion.
  it('ft_0_17.AC5: the shipped file validates and every step is inside the EZ-220 range', () => {
    const steps = loadTrainerSteps(stepsJson);
    expect(steps.steps.length).toBeGreaterThan(0);
    for (const s of steps.steps) {
      expect(s.range.low).toBeLessThanOrEqual(s.range.high);
      expect(rangeOf(s)).toEqual({ low: s.range.low, high: s.range.high });
    }
  });

  it('ft_0_17.AC5: rejects a file without schemaVersion 1', () => {
    expect(() => loadTrainerSteps({ ...valid(), schemaVersion: 2 })).toThrow();
    expect(() => loadTrainerSteps({ steps: valid().steps })).toThrow();
  });

  it('ft_0_17.AC5: rejects a range that is inverted or outside 36..96', () => {
    expect(trainerStepsSchema.safeParse({ schemaVersion: 1, steps: [{ id: 'a', name: 'A', range: { low: 72, high: 60 } }] }).success).toBe(false);
    expect(trainerStepsSchema.safeParse({ schemaVersion: 1, steps: [{ id: 'a', name: 'A', range: { low: 20, high: 60 } }] }).success).toBe(false);
  });

  it('ft_0_17.AC5: rejects an empty step list', () => {
    expect(trainerStepsSchema.safeParse({ schemaVersion: 1, steps: [] }).success).toBe(false);
  });
});
