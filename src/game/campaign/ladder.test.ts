import { describe, expect, it } from 'vitest';
import { battleResult, startCampaign, phaseOneResult, phaseTwoResult } from '../../core/campaign/campaign';
import littleSteps from '../../../tests/fixtures/charts/little-steps.v2.json';
import { chartSchema } from '../../core/chart/schema.ts';
import { LADDER, levelChart } from './ladder';

describe('campaign battle helpers (ft_1_06, phase 3)', () => {
  it('ft_1_06.AC9 a level plays a section of the player\'s piece: level 1 its first half, levels 2 and 3 all of it', () => {
    const chart = chartSchema.parse(littleSteps);
    const half = levelChart(chart, 1);
    expect(half.bars).toHaveLength(Math.ceil(chart.bars.length / 2));
    expect(half.notes.every((n) => n.bar < half.bars.length)).toBe(true);
    expect(levelChart(chart, 2).bars).toHaveLength(chart.bars.length);
    expect(levelChart(chart, 3).notes).toHaveLength(chart.notes.length);
  });

  it('ft_1_06.AC4 a lost battle keeps the open door: the same level can be fought again', () => {
    let state = startCampaign(LADDER);
    state = phaseOneResult(state, 0, 'passed');
    state = phaseTwoResult(state, 0, 'door-open');
    const lost = battleResult(state, 0, 1, false);
    expect(lost.phase[0]).toBe('battle');
    expect(lost.doorOpen[0]).toBe(true);
    expect(battleResult(lost, 0, 1, true).beaten[0]![0]).toBe(true);
  });

  it('ft_1_06.AC5 beating level 3 unlocks the next monster', () => {
    let state = startCampaign(LADDER);
    for (const level of [1, 2, 3] as const) {
      state = phaseOneResult(state, 0, 'passed');
      state = phaseTwoResult(state, 0, 'door-open');
      state = battleResult(state, 0, level, true);
      if (level < 3) expect(state.unlocked[1]).toBe(false);
    }
    expect(state.unlocked[1]).toBe(true);
  });
});
