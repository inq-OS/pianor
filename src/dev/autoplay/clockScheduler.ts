/**
 * Playing a performance on the game's audio clock (ft_Y_09). The virtual player's events are placed on song time, and this
 * scheduler lets each one go when the clock reaches it, so Tempo mode sees the notes exactly where the transport expects them
 * even if the clock jumps (the browser starts the audio clock on the first user gesture). `playThroughDevice` takes a `Scheduler`;
 * `deviceOnClock` turns the song-time stamp it passes into the DOM-time stamp a MIDI message carries.
 */
import type { SongClock } from '../../io/audio';
import type { Scheduler } from '../../io/mock/scheduler';

export class ClockScheduler implements Scheduler {
  private queue: { at: number; order: number; run: () => void }[] = [];
  private order = 0;
  private timer: ReturnType<typeof setInterval> | null = null;
  private waiting: (() => void)[] = [];

  /** `now` is the song clock in ms; `pollMs` how often it is looked at. */
  constructor(private readonly now: () => number, private readonly pollMs = 4) {}

  /** Run `run` when the clock reaches `atMs` (song time, not a delay). Starts the polling. */
  at(atMs: number, run: () => void): void {
    this.queue.push({ at: atMs, order: this.order++, run });
    this.timer ??= setInterval(() => this.pump(), this.pollMs);
  }

  get pending(): number {
    return this.queue.length;
  }

  /** Run everything that is due, in time order (ties in the order added). */
  pump(): void {
    const now = this.now();
    this.queue.sort((a, b) => a.at - b.at || a.order - b.order);
    while (this.queue.length > 0 && this.queue[0]!.at <= now) this.queue.shift()!.run();
    if (this.queue.length === 0) this.settle();
  }

  /** Resolves when nothing is left to run (at once if nothing is). */
  idle(): Promise<void> {
    if (this.queue.length === 0) return Promise.resolve();
    return new Promise((resolve) => this.waiting.push(resolve));
  }

  /** Forget everything that has not run yet. */
  cancel(): void {
    this.queue = [];
    this.settle();
  }

  private settle(): void {
    if (this.timer !== null) clearInterval(this.timer);
    this.timer = null;
    const waiting = this.waiting;
    this.waiting = [];
    waiting.forEach((resolve) => resolve());
  }
}

/** What `playThroughDevice` needs of the virtual keyboard. */
export interface KeyDevice {
  readonly isConnected: boolean;
  press(midi: number, velocity?: number, timeStamp?: number): void;
  release(midi: number, timeStamp?: number): void;
}

/**
 * The same keyboard, but the time stamps it is given are song time: they are turned into DOM time with `toDomTime`, so the
 * message carries the moment the player meant (and the game maps it back to exactly that song time).
 */
export function deviceOnClock(device: KeyDevice, toDomTime: (songMs: number) => number): KeyDevice {
  return {
    get isConnected() {
      return device.isConnected;
    },
    press: (midi, velocity, songMs) => device.press(midi, velocity, songMs === undefined ? undefined : toDomTime(songMs)),
    release: (midi, songMs) => device.release(midi, songMs === undefined ? undefined : toDomTime(songMs)),
  };
}

/**
 * The DOM time that the game maps back to `songMs`: the inverse of `clock.fromDomTime`, read at the moment of the press, so a
 * planned note reaches the judge at exactly its planned song time. Not `performance.now() - (clock.nowMs() - songMs)`: `nowMs`
 * is the context's `currentTime`, which runs ahead of the output timestamp `fromDomTime` uses by the output latency, so every
 * note arrived early by that much, and by a different amount when the machine was busy.
 */
export function songToDomTime(clock: Pick<SongClock, 'fromDomTime'>, domNow: () => number = () => performance.now()): (songMs: number) => number {
  return (songMs) => {
    const now = domNow();
    return now + (songMs - clock.fromDomTime(now));
  };
}
