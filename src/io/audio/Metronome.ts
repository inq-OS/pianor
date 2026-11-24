import { Emitter } from '../emitter';
import { SCHEDULE_LOOKAHEAD_MS, type BeatInfo, type MetronomeSound } from '../audio';
import type { Unsubscribe } from '../keyboard';
import { clampMetronomeBpm } from '../../core/transport';
import { beatIntervalMs } from './mapping';
import { MS_PER_SECOND } from '../../core/chart';

export interface Timers {
  setInterval(run: () => void, ms: number): unknown;
  clearInterval(handle: unknown): void;
  setTimeout(run: () => void, ms: number): unknown;
  clearTimeout(handle: unknown): void;
}

const realTimers: Timers = {
  setInterval: (run, ms) => setInterval(run, ms),
  clearInterval: (handle) => clearInterval(handle as ReturnType<typeof setInterval>),
  setTimeout: (run, ms) => setTimeout(run, ms),
  clearTimeout: (handle) => clearTimeout(handle as ReturnType<typeof setTimeout>),
};

/** Scheduler defaults: how far ahead clicks are placed, how often the timer wakes, and the lead before the first beat. */
const DEFAULT_LOOKAHEAD_MS = SCHEDULE_LOOKAHEAD_MS;
const DEFAULT_TICK_MS = 25;
const START_LEAD_MS = 60;
/** A beat this close (ms) to a silent time is that silent beat: the grid is computed, so it may differ by rounding. */
const SILENT_MATCH_MS = 1;

/**
 * The click's sound: a square wave, higher and louder on the first beat of the bar, with a 2 ms attack, a decay to near
 * silence by 50 ms, and the oscillator stopped at 60 ms. Frequencies in Hz, gains 0 to 1, times in seconds.
 */
export const CLICK = {
  accentHz: 1600,
  beatHz: 1000,
  accentGain: 0.35,
  beatGain: 0.22,
  /** The decay ends here: an exponential ramp cannot reach 0. */
  silentGain: 0.001,
  attackS: 0.002,
  decayS: 0.05,
  stopS: 0.06,
} as const;

export interface MetronomeOptions {
  /** How far ahead beats are scheduled on the audio clock. Longer survives a busy main thread. */
  lookaheadMs?: number;
  /** How often the scheduler wakes up. */
  tickMs?: number;
  timers?: Timers;
  output?: AudioNode;
}

/**
 * A metronome that is sample-accurate: a short timer wakes up often, but every click is placed on the audio clock
 * a little ahead of time, so main-thread jitter never moves a beat. Beat times are a perfect grid
 * (start + n * interval); a tempo change takes effect from the next beat.
 */
export class Metronome implements MetronomeSound {
  running = false;

  private readonly beats = new Emitter<BeatInfo>();
  private readonly lookaheadMs: number;
  private readonly tickMs: number;
  private readonly timers: Timers;
  private bpm = 100;
  private beatsPerBar = 4;
  private nextBeatMs = 0;
  private index = 0;
  /** Beats still to click; Infinity when the metronome runs until stopped. */
  private beatsLeft = Number.POSITIVE_INFINITY;
  /** Beat times that are not clicked (a grace note sounds there, d121). */
  private silentAtMs: readonly number[] = [];
  private interval: unknown = null;
  private pending = new Set<unknown>();
  private readonly output: AudioNode;

  constructor(private readonly context: AudioContext, options: MetronomeOptions = {}) {
    this.lookaheadMs = options.lookaheadMs ?? DEFAULT_LOOKAHEAD_MS;
    this.tickMs = options.tickMs ?? DEFAULT_TICK_MS;
    this.timers = options.timers ?? realTimers;
    this.output = options.output ?? context.destination;
  }

  start(options: { bpm: number; beatsPerBar: number; startAtMs?: number; beats?: number; silentAtMs?: readonly number[]; firstBeat?: number }): void {
    this.stop();
    this.silentAtMs = options.silentAtMs ?? [];
    this.bpm = clampMetronomeBpm(options.bpm);
    this.beatsPerBar = Math.max(1, Math.round(options.beatsPerBar));
    this.nextBeatMs = options.startAtMs ?? this.nowMs() + START_LEAD_MS;
    this.index = Math.max(0, Math.floor(options.firstBeat ?? 0));
    this.beatsLeft = options.beats === undefined ? Number.POSITIVE_INFINITY : Math.max(0, Math.floor(options.beats));
    if (this.beatsLeft === 0) return;
    this.running = true;
    this.pump();
    if (this.running) this.interval = this.timers.setInterval(() => this.pump(), this.tickMs);
  }

  stop(): void {
    this.running = false;
    if (this.interval !== null) this.timers.clearInterval(this.interval);
    this.interval = null;
    for (const handle of this.pending) this.timers.clearTimeout(handle);
    this.pending.clear();
  }

  setBpm(bpm: number): void {
    this.bpm = clampMetronomeBpm(bpm);
  }

  onBeat(listener: (beat: BeatInfo) => void): Unsubscribe {
    return this.beats.on(listener);
  }

  private nowMs(): number {
    return this.context.currentTime * MS_PER_SECOND;
  }

  private pump(): void {
    const horizon = this.nowMs() + this.lookaheadMs;
    while (this.running && this.nextBeatMs < horizon) {
      const beat: BeatInfo = {
        index: this.index,
        bar: Math.floor(this.index / this.beatsPerBar),
        beatInBar: this.index % this.beatsPerBar,
        atMs: this.nextBeatMs,
      };
      // a silent beat still counts and is still reported: only its click is left out
      if (!this.silentAtMs.some((ms) => Math.abs(ms - beat.atMs) < SILENT_MATCH_MS)) this.click(beat);
      const handle = this.timers.setTimeout(() => {
        this.pending.delete(handle);
        this.beats.emit(beat);
      }, Math.max(0, beat.atMs - this.nowMs()));
      this.pending.add(handle);
      this.nextBeatMs += beatIntervalMs(this.bpm);
      this.index++;
      if (--this.beatsLeft <= 0) this.finishScheduling();
    }
  }

  /** The last of a limited number of beats is placed: no more scheduling, the beat callbacks still to come still come. */
  private finishScheduling(): void {
    this.running = false;
    if (this.interval !== null) this.timers.clearInterval(this.interval);
    this.interval = null;
  }

  /** A short synthesized click: higher and louder on the first beat of the bar. */
  private click(beat: BeatInfo): void {
    const at = Math.max(this.context.currentTime, beat.atMs / MS_PER_SECOND);
    const accent = beat.beatInBar === 0;
    const osc = this.context.createOscillator();
    osc.type = 'square';
    osc.frequency.value = accent ? CLICK.accentHz : CLICK.beatHz;
    const gain = this.context.createGain();
    gain.gain.setValueAtTime(0, at);
    gain.gain.linearRampToValueAtTime(accent ? CLICK.accentGain : CLICK.beatGain, at + CLICK.attackS);
    gain.gain.exponentialRampToValueAtTime(CLICK.silentGain, at + CLICK.decayS);
    osc.connect(gain);
    gain.connect(this.output);
    osc.start(at);
    osc.stop(at + CLICK.stopS);
    osc.onended = () => {
      osc.disconnect();
      gain.disconnect();
    };
  }
}
