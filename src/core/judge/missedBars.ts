import type { JudgeEvent } from './types';

/** How many bars in a row with nothing played right start the piece over (core_01.AC11). */
export const AUTO_RESET_BARS = 2;

/**
 * The auto reset of Tempo mode (core_01.AC11): it reads the judge's finished bars in order and says when `AUTO_RESET_BARS`
 * of them in a row had notes to play and none played right (wrong keys do not count as played; a bar of rests neither
 * counts nor breaks the run). The screen then starts over and waits for the start again, as after the space bar. Bar
 * results come in bar order even when holds finish late, so the run is the bars' own order.
 */
export class MissedBars {
  constructor(private run = 0, private readonly limit = AUTO_RESET_BARS) {}

  /** Bars in a row so far with nothing played right. */
  get missed(): number {
    return this.run;
  }

  /** Read one batch of judge events; true once the run reaches the limit. */
  push(events: readonly JudgeEvent[]): boolean {
    for (const event of events) {
      if (event.type !== 'BarCompleted' || event.result.notes === 0) continue;
      const played = event.result.timing?.played ?? event.result.firstTryCorrect;
      this.run = played === 0 ? this.run + 1 : 0;
    }
    return this.run >= this.limit;
  }
}
