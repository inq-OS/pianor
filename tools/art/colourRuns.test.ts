import { describe, expect, it } from 'vitest';
import { runStats } from './colourRuns';

describe('runStats', () => {
  it('measures the steps in lightness between neighbours', () => {
    const s = runStats([0x000000, 0x777777, 0xffffff]);
    expect(s.lightness).toHaveLength(3);
    expect(s.steps).toHaveLength(2);
    expect(s.maxStep).toBeCloseTo(Math.max(...s.steps), 6);
    expect(s.grey).toBe(true);
    expect(s.hueTurnPer10L).toBeNull();
  });

  it('gives the hue turn per 10 L* with its sign: a red-brown run that warms to orange turns positive', () => {
    // dark red-brown to orange, as the wood of Monkey Island 2 does
    const s = runStats([0x3a1410, 0x6a2a18, 0x9a4420, 0xc8682c]);
    expect(s.grey).toBe(false);
    expect(s.hueTurnPer10L).not.toBeNull();
    expect(s.hueTurnPer10L!).toBeGreaterThan(0);
  });

  it('turns negative when a blue run goes from violet to cyan', () => {
    const s = runStats([0x1c1a6a, 0x2a50b0, 0x50a0e0, 0xa0e0f8]);
    expect(s.hueTurnPer10L!).toBeLessThan(0);
  });

  it('crosses hue 0 the short way round', () => {
    // magenta-red (hue about 350) to red-orange (about 35): +45, not -315
    const s = runStats([0x501030, 0xa02a2a, 0xe0603a]);
    expect(s.hueTurnPer10L!).toBeGreaterThan(0);
    expect(s.hueTurnPer10L!).toBeLessThan(20);
  });

  it('leaves a near-black end out of the hue turn: its hue is noise', () => {
    // a near-black blue-grey, then leaves that go from green to yellow-green
    const s = runStats([0x0a1216, 0x1e3e28, 0x346034, 0x5a8a3a]);
    expect(s.hueFrom).not.toBeNull();
    expect(s.hueTo!).toBeLessThan(s.hueFrom!);
    expect(s.light.L).toBeGreaterThan(50);
  });

  it('names where the most saturated colour sits, as a fraction of the run', () => {
    const s = runStats([0x202020, 0xc03020, 0xf0e0e0]);
    expect(s.chromaPeakAt).toBeCloseTo(0.5, 6);
  });

  it('refuses a run that is not dark to light', () => {
    expect(() => runStats([0xffffff, 0x000000])).toThrow(/dark to light/);
  });

  it('takes a run of one colour', () => {
    const s = runStats([0x808080]);
    expect(s.steps).toEqual([]);
    expect(s.maxStep).toBe(0);
    expect(s.chromaPeakAt).toBe(0);
  });
});
