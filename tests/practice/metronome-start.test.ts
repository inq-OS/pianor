// Covers core_02.AC2.
import { describe, expect, it } from 'vitest';
import littleSteps from '../fixtures/charts/little-steps.v2.json';
import { chartSchema } from '../../src/core/chart';
import { metronomeFor } from '../../src/core/transport';
import { carryOver, metronomeAtCreate } from '../../src/game/practice/metronomeStart';

const chart = chartSchema.parse(littleSteps);

describe('the metronome at the start of a round', () => {
  it('Wait mode with the click on starts the metronome at the chart tempo and percent', () => {
    expect(metronomeAtCreate('wait', true, chart, 100)).toEqual(metronomeFor(chart, 100));
    expect(metronomeAtCreate('wait', true, chart, 60)).toEqual(metronomeFor(chart, 60));
    expect(metronomeAtCreate('wait', true, chart, 60)!.bpm).toBeLessThan(metronomeAtCreate('wait', true, chart, 100)!.bpm);
  });

  it('Wait mode with the click off does not start it', () => {
    expect(metronomeAtCreate('wait', false, chart, 100)).toBeNull();
  });

  it('Tempo mode does not start it at create, the count-in does', () => {
    expect(metronomeAtCreate('tempo', true, chart, 100)).toBeNull();
    expect(metronomeAtCreate('tempo', false, chart, 100)).toBeNull();
  });

  it('a restart carries the click, the session and its passes (ft_1_12.AC3)', () => {
    const session = { rounds: 2 };
    const passes = [{ saved: true }];
    expect(carryOver({ clickOn: true, session, passes })).toEqual({ click: true, clickOffset: 0, session, passes });
    expect(carryOver({ clickOn: false, session, passes }).click).toBe(false);
  });
});
