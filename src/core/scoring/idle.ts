/**
 * Idle detector for a practice run (WP-X). Once more than one bar has passed without a key press, the player is idle,
 * and each bar's first click (its downbeat, counted from tick 0) bites once, until the next key press.
 * Pure: the caller passes the time in ticks, so the tests run on a fake clock (core time is in ticks, never frames).
 */

export interface IdleDetectorOptions {
  /** Ticks in one bar (for example 1920 in 4/4 at PPQ 480). Bars are counted from tick 0. */
  barTicks: number;
}

export class IdleDetector {
  private readonly barTicks: number;
  private lastPress = 0;
  private lastNow = 0;
  /** Index of the last bar downbeat already counted as a bite, -1 before any. */
  private countedBar = -1;

  constructor(options: IdleDetectorOptions) {
    if (!(options.barTicks > 0)) throw new RangeError('bar must be a positive tick count');
    this.barTicks = options.barTicks;
  }

  /** Idle bites due from the last call up to `now` (ticks, never going backwards). */
  advance(now: number): number {
    if (now < this.lastNow) throw new RangeError(`time went backwards: ${now} < ${this.lastNow}`);
    this.lastNow = now;
    const idleFrom = this.lastPress + this.barTicks;
    // Bites fall on bar downbeats strictly after the idle start and up to now, each counted once.
    const firstBar = Math.max(Math.floor(idleFrom / this.barTicks) + 1, this.countedBar + 1);
    const lastBar = Math.floor(now / this.barTicks);
    if (lastBar < firstBar) return 0;
    this.countedBar = lastBar;
    return lastBar - firstBar + 1;
  }

  /** A key press at `now`: returns the idle bites due before it, then restarts the idle timer. */
  press(now: number): number {
    const bites = this.advance(now);
    this.lastPress = now;
    return bites;
  }
}
