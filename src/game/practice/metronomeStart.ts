import type { Chart } from '../../core/chart';
import { clickPlan } from '../../core/transport';

/**
 * Whether the practice scene starts the metronome the moment it is created, and with what plan.
 * Only Wait mode does: it has no count-in to start the click later, so a (re)start with the click on starts it here.
 * Tempo mode starts it with the count-in, and with the click off nothing starts.
 */
export function metronomeAtCreate(
  mode: 'wait' | 'tempo',
  clickOn: boolean,
  chart: Chart,
  percent: number,
  clickOffset = 0,
): { bpm: number; beatsPerBar: number } | null {
  return mode !== 'tempo' && clickOn ? clickPlan(chart, percent, clickOffset) : null;
}

/** What a restart (loop, section round, tempo change) hands to the next round: the click, the session and its passes (ft_1_12). */
export function carryOver<S, P>(state: { clickOn: boolean; clickOffset?: number; session: S; passes: P }): { click: boolean; clickOffset: number; session: S; passes: P } {
  return { click: state.clickOn, clickOffset: state.clickOffset ?? 0, session: state.session, passes: state.passes };
}
