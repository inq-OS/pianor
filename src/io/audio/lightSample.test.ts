import { describe, expect, it } from 'vitest';
import { LIGHT_FADE_SECONDS, LIGHT_SECONDS, lightChannel } from './lightSample';

describe('the light piano\'s samples (ft_0_07.AC3)', () => {
  const rate = 100;
  const long = (value: number) => new Float32Array(16 * rate).fill(value);

  it('is one channel, the average of the recording\'s, cut to its length', () => {
    const out = lightChannel([long(0.2), long(0.6)], rate);
    expect(out).toHaveLength(LIGHT_SECONDS * rate);
    expect(out[0]).toBeCloseTo(0.4);
  });

  it('fades to silence over its last second and is whole before it', () => {
    const out = lightChannel([long(1)], rate);
    const fadeFrom = (LIGHT_SECONDS - LIGHT_FADE_SECONDS) * rate;
    expect(out[fadeFrom - 1]).toBe(1);
    expect(out[fadeFrom + 50]).toBeCloseTo(0.5, 1);
    expect(out.at(-1)!).toBeLessThan(0.02);
  });

  it('keeps a short recording\'s length', () => {
    expect(lightChannel([new Float32Array(2 * rate).fill(1)], rate)).toHaveLength(2 * rate);
  });

  it('is empty for a recording with no channels', () => {
    expect(lightChannel([], rate)).toHaveLength(0);
  });
});
