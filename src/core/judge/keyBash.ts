import type { Chart } from '../chart';
import { buildSteps } from './steps';
import type { NoteEvent } from './types';

/**
 * Key bashing (ft_1_15): more keys held at once than two hands have fingers. Eleven or more keys down together can only
 * be palms or arms, so the rule never looks at wrong notes or slowness and a struggling beginner cannot trigger it
 * (the architect's axiom call, AX-2.1).
 */
export const KEY_BASH_LIMIT = 10;

/** How long a held-back key waits to see whether a bash is forming before it goes to the judge. */
export const KEY_BASH_SETTLE_MS = 80;

export interface KeyBashOptions {
  /**
   * Keys pass to the judge at once while at most this many are down; one more is held back for `settleMs`, so the keys of
   * a bash that is forming never reach the judge (`passHeldFor` gives it for a chart).
   */
  passHeld: number;
  settleMs?: number;
}

export interface KeyBashOutput {
  /** The events for the judge, in the order they were played. */
  pass: NoteEvent[];
  /** True once, on the key that made the bash. */
  bash: boolean;
}

/**
 * How many keys may be down before the next one is held back: twice the piece's largest chord (the keys of a step and of
 * the step before, still held while the next is pressed, legato), one more when the piece has grace notes (the grace is
 * still down when its main note comes, d121), at most `KEY_BASH_LIMIT`. A right play never waits.
 */
export function passHeldFor(chart: Chart): number {
  const largest = Math.max(1, ...buildSteps(chart).map((step) => step.noteIndices.length));
  const grace = (chart.graces?.length ?? 0) > 0 ? 1 : 0;
  return Math.min(KEY_BASH_LIMIT, 2 * largest + grace);
}

/**
 * Stands between the keyboard and the judge and keeps key bashing out of it (ft_1_15.AC1, AC2): the keys of a bash are
 * not judged, so they leave no wrong notes and nothing in the practice log. Up to `passHeld` keys down pass at once; a
 * key beyond that waits `settleMs` (`release`) and goes on unless an eleventh key comes down meanwhile. After a bash
 * every key is dropped until all of them are up again. While `muted` (the screen is paused) new keys are dropped too.
 * A key that reached the judge always gets its note-off, so the judge never thinks a key is still down.
 *
 * AX-3 provisional: one burst counts (no repeat threshold); the at most `passHeld` keys that were down before the bash
 * could be told from playing are judged.
 */
export class KeyBashGuard {
  private readonly passHeld: number;
  private readonly settleMs: number;
  /** Every key down on the keyboard now. */
  private readonly held = new Set<number>();
  /** Keys whose note-on went to the judge and whose note-off has not yet. */
  private readonly passed = new Set<number>();
  /** Keys whose note-on waits in `queue`. */
  private readonly queued = new Set<number>();
  private queue: NoteEvent[] = [];
  private bashing = false;
  private mutedNow = false;

  constructor(options: KeyBashOptions) {
    this.passHeld = Math.max(1, Math.min(KEY_BASH_LIMIT, options.passHeld));
    this.settleMs = options.settleMs ?? KEY_BASH_SETTLE_MS;
  }

  /** Drop new key presses (the screen is paused); note-offs of keys the judge has still go through. */
  setMuted(muted: boolean): void {
    this.mutedNow = muted;
    if (muted) this.dropQueue();
  }

  get muted(): boolean {
    return this.mutedNow;
  }

  /** The time of the oldest held-back key, or null: a clock-driven judge must not be moved past it (Tempo mode). */
  get heldBackSince(): number | null {
    return this.queue[0]?.timeMs ?? null;
  }

  /** The clock a judge may be moved to at `nowMs`: never past a key that is still held back. */
  judgeClock(nowMs: number): number {
    const since = this.heldBackSince;
    return since === null ? nowMs : Math.min(nowMs, since);
  }

  handle(event: NoteEvent): KeyBashOutput {
    return event.kind === 'off' || event.velocity === 0 ? this.keyUp(event) : this.keyDown(event);
  }

  /** The held-back keys whose wait is over at `nowMs`, for the judge. */
  release(nowMs: number): NoteEvent[] {
    const first = this.queue[0];
    if (!first || nowMs - first.timeMs < this.settleMs) return [];
    const out = this.queue;
    this.queue = [];
    for (const event of out) {
      if (event.kind === 'on' && event.velocity > 0) this.passed.add(event.midi);
      else this.passed.delete(event.midi);
    }
    this.queued.clear();
    return out;
  }

  private keyDown(event: NoteEvent): KeyBashOutput {
    this.held.add(event.midi);
    if (this.bashing || this.mutedNow) return { pass: [], bash: false };
    if (this.held.size > KEY_BASH_LIMIT) {
      this.bashing = true;
      this.dropQueue();
      return { pass: [], bash: true };
    }
    if (this.queue.length > 0 || this.held.size > this.passHeld) {
      this.queue.push(event);
      this.queued.add(event.midi);
      return { pass: [], bash: false };
    }
    this.passed.add(event.midi);
    return { pass: [event], bash: false };
  }

  private keyUp(event: NoteEvent): KeyBashOutput {
    this.held.delete(event.midi);
    if (this.held.size === 0) this.bashing = false;
    if (this.queued.has(event.midi)) {
      // its note-on waits: the note-off waits behind it, so the judge gets both in order
      this.queue.push(event);
      return { pass: [], bash: false };
    }
    if (!this.passed.has(event.midi)) return { pass: [], bash: false };
    if (this.queue.length > 0) {
      // keys played before it still wait: it goes after them, in the order played
      this.queue.push(event);
      return { pass: [], bash: false };
    }
    this.passed.delete(event.midi);
    return { pass: [event], bash: false };
  }

  /** The waiting keys never reach the judge; note-offs of keys the judge has stay, so none of them stays down there. */
  private dropQueue(): void {
    const offs = this.queue.filter((e) => (e.kind === 'off' || e.velocity === 0) && this.passed.has(e.midi) && !this.queued.has(e.midi));
    this.queue = [];
    this.queued.clear();
    // a note-off of a key the judge has, stuck behind dropped keys, is kept for the next release
    if (offs.length > 0) this.queue = offs;
  }
}
