// Covers core_03.AC2, core_03.AC3.
import { describe, expect, it } from 'vitest';
import { PIECE_BPM } from '../chart';
import { BPM_MAX, BPM_MIN } from '../editor/model';
import { CLICK_MAX, RAMP_MAX_PERCENT, CLICK_MIN, METRONOME_BPM, TEMPO_PERCENT, clampMetronomeBpm, clampTempoPercent } from './practiceSpeed';

describe('practice speed ranges', () => {
  it('the tempo percent is 30 to 150 in steps of ten, and a value outside is pulled back in', () => {
    expect(TEMPO_PERCENT).toEqual({ min: 30, max: 150, step: 10, normal: 100 });
    expect(clampTempoPercent(10)).toBe(30);
    expect(clampTempoPercent(80)).toBe(80);
    expect(clampTempoPercent(400)).toBe(150);
  });

  it('the metronome clamps to 30 to 1000 BPM, wider than the click keys, so the fastest piece at its highest ramp keeps its pulse', () => {
    expect(clampMetronomeBpm(10)).toBe(30);
    expect(clampMetronomeBpm(100)).toBe(100);
    expect(clampMetronomeBpm(2000)).toBe(1000);
    expect(METRONOME_BPM.max).toBeGreaterThan(CLICK_MAX);
    expect(clampMetronomeBpm(BPM_MAX * (TEMPO_PERCENT.max / 100))).toBe(BPM_MAX * (TEMPO_PERCENT.max / 100));
    expect(clampMetronomeBpm(BPM_MAX * (RAMP_MAX_PERCENT / 100))).toBe(METRONOME_BPM.max);
  });

  it('a piece may be as fast as 500 BPM, and every BPM limit comes from that one range (PIECE_BPM)', () => {
    expect(PIECE_BPM).toEqual({ min: 30, max: 500 });
    expect([BPM_MIN, BPM_MAX]).toEqual([PIECE_BPM.min, PIECE_BPM.max]);
    expect([CLICK_MIN, CLICK_MAX]).toEqual([PIECE_BPM.min, PIECE_BPM.max]);
    expect(METRONOME_BPM).toEqual({ min: PIECE_BPM.min, max: (PIECE_BPM.max * RAMP_MAX_PERCENT) / 100 });
  });

  it('is asked only for tempos it plays: the click speed and editor ranges lie inside the metronome range', () => {
    for (const [min, max] of [[CLICK_MIN, CLICK_MAX], [BPM_MIN, BPM_MAX]] as const) {
      expect(min).toBeGreaterThanOrEqual(METRONOME_BPM.min);
      expect(max).toBeLessThanOrEqual(METRONOME_BPM.max);
    }
  });
});
