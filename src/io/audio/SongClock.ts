import type { SongClock } from '../audio';
import { MS_PER_SECOND } from '../../core/chart';

/** The part of `AudioContext` the clock needs. */
export interface ClockContext {
  readonly currentTime: number;
  readonly state: string;
  getOutputTimestamp?(): { contextTime?: number; performanceTime?: number };
}

/**
 * Song time is audio-clock time in milliseconds. Key events carry DOM timestamps; `fromDomTime` moves them onto
 * the audio clock using the context's own output timestamp, so key presses, notes and metronome clicks share one timeline.
 * Before the context is running (browsers keep it suspended until a user gesture) the clock falls back to the DOM clock,
 * so time still moves; it may jump once when audio starts.
 */
export class AudioSongClock implements SongClock {
  private readonly startedAtDom: number;

  constructor(private readonly context: ClockContext, private readonly domNow: () => number = () => performance.now()) {
    this.startedAtDom = domNow();
  }

  nowMs(): number {
    return this.context.state === 'running' ? this.context.currentTime * MS_PER_SECOND : this.domNow() - this.startedAtDom;
  }

  fromDomTime(domMs: number): number {
    const stamp = this.context.state === 'running' ? this.context.getOutputTimestamp?.() : undefined;
    if (stamp?.contextTime !== undefined && stamp.performanceTime !== undefined && stamp.performanceTime > 0) {
      return stamp.contextTime * MS_PER_SECOND + (domMs - stamp.performanceTime);
    }
    return this.nowMs() - (this.domNow() - domMs);
  }
}
