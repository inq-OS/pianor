import type { PlaybackNote } from '../../core/chart';
import type { PianoSound, SongClock } from '../../io/audio';

export interface PlayerTimers {
  setInterval(run: () => void, ms: number): unknown;
  clearInterval(handle: unknown): void;
}

const realTimers: PlayerTimers = {
  setInterval: (run, ms) => setInterval(run, ms),
  clearInterval: (handle) => clearInterval(handle as ReturnType<typeof setInterval>),
};

/** Time before the first note, so the audio clock and the screen are ready. */
const LEAD_IN_MS = 200;
/** How far ahead notes are handed to the sampler. Small, because the sampler counts scheduled notes as voices. */
const LOOKAHEAD_MS = 300;
const TICK_MS = 50;

/**
 * Plays a piece's notes on the song clock, a little ahead of time, so main-thread jitter never moves a note. A short
 * timer wakes up often and schedules the notes that start within the lookahead. This is the preview tool's "listen";
 * it knows nothing about charts, only about notes with times.
 */
export class ChartPlayer {
  private handle: unknown = null;
  private startAtMs = 0;
  private lengthMs = 0;
  private notes: readonly PlaybackNote[] = [];
  private next = 0;
  private onEnd: (() => void) | undefined;

  constructor(
    private readonly piano: PianoSound,
    private readonly clock: SongClock,
    private readonly timers: PlayerTimers = realTimers,
  ) {}

  get isPlaying(): boolean {
    return this.handle !== null;
  }

  /** Song time since the first note: negative during the lead-in, null when nothing is playing. */
  elapsedMs(): number | null {
    return this.isPlaying ? this.clock.nowMs() - this.startAtMs : null;
  }

  /** Start playing `notes` (times from 0). Anything already playing stops without calling its `onEnd`. */
  start(notes: readonly PlaybackNote[], lengthMs: number, onEnd?: () => void): void {
    this.halt();
    this.notes = notes;
    this.lengthMs = lengthMs;
    this.next = 0;
    this.onEnd = onEnd;
    this.startAtMs = this.clock.nowMs() + LEAD_IN_MS;
    this.handle = this.timers.setInterval(() => this.tick(), TICK_MS);
    this.tick();
  }

  /** Stop at once and silence the piano. Does not call `onEnd`. */
  stop(): void {
    this.halt();
  }

  private halt(): void {
    if (this.handle === null) return;
    this.timers.clearInterval(this.handle);
    this.handle = null;
    this.onEnd = undefined;
    this.piano.allNotesOff();
  }

  private tick(): void {
    const elapsed = this.clock.nowMs() - this.startAtMs;
    while (this.next < this.notes.length && this.notes[this.next]!.startMs <= elapsed + LOOKAHEAD_MS) {
      const note = this.notes[this.next++]!;
      const length = note.endMs - note.startMs;
      // Let go a little before the end (at most 60 ms, a tenth of a short note) so the same key can sound again.
      const release = note.endMs - Math.min(60, length * 0.1);
      this.piano.noteOn(note.midi, note.velocity, this.startAtMs + note.startMs);
      this.piano.noteOff(note.midi, this.startAtMs + release);
    }
    if (elapsed >= this.lengthMs && this.next >= this.notes.length) {
      const done = this.onEnd;
      this.halt();
      done?.();
    }
  }
}
