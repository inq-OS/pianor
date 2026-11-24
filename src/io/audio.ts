/**
 * Audio interfaces the rest of the game may depend on (`src/game` imports only this file from `src/io`).
 * One audio clock serves the whole game: song time is `AudioContext` time in milliseconds, and key events,
 * the metronome and note playback are all placed on it.
 */
import type { Unsubscribe } from './keyboard';
import type { PianoSoundKind } from '../core/sound/pianoSound';

/**
 * How far ahead (ms) sounds are handed to Web Audio: the metronome places its clicks this far ahead, and a scheduled note
 * (the count-in's grace, d121) is queued no earlier, so a screen that stops or starts over leaves at most this much behind.
 */
export const SCHEDULE_LOOKAHEAD_MS = 120;

export interface SongClock {
  /** Current song time in ms on the audio clock. */
  nowMs(): number;
  /** Map a DOM timestamp (`event.timeStamp`, the `performance.now()` timeline) onto song time. */
  fromDomTime(domMs: number): number;
}

export interface PianoSound {
  /** True once the samples are decoded. Notes played before that are silent. */
  readonly loaded: boolean;
  /** Resolves when loading has finished (also if some samples failed; see `failed`). Never rejects. */
  readonly ready: Promise<void>;
  /** Number of samples that could not be loaded. */
  readonly failed: number;
  /** Start a note now, or at song time `atMs`. Velocity is MIDI velocity 1 to 127. */
  noteOn(midi: number, velocity: number, atMs?: number): void;
  /** Release a note (the damper comes down) now or at song time `atMs`. */
  noteOff(midi: number, atMs?: number): void;
  allNotesOff(): void;
  /** Master volume, 0 to 1. */
  setVolume(volume: number): void;
  /** The full recordings or the light ones (short and mono, ft_0_07.AC3). */
  readonly sound: PianoSoundKind;
  /** Switch between them while the game runs; resolves once new notes play the new sound. Never rejects. */
  setSound(sound: PianoSoundKind): Promise<void>;
}

export interface BeatInfo {
  /** Beats since the metronome started, from 0. */
  index: number;
  bar: number;
  /** 0 for the first beat of the bar. */
  beatInBar: number;
  /** Song time in ms the click sounds at. */
  atMs: number;
  /** Ms from this beat to the next at the tempo it was placed with (the beat ring's sweep, core_13). */
  intervalMs: number;
}

export interface MetronomeSound {
  readonly running: boolean;
  /**
   * Start clicking. The first beat is at `startAtMs` song time, or as soon as possible; with `beats`, stop after that many.
   * Beats at a time in `silentAtMs` are counted and reported but not clicked (a count-in's grace note, d121).
   * `firstBeat` numbers the first click when it joins a bar part-way (default 0, the bar's first beat, which is accented).
   */
  start(options: { bpm: number; beatsPerBar: number; startAtMs?: number; beats?: number; silentAtMs?: readonly number[]; firstBeat?: number }): void;
  stop(): void;
  /** Change tempo; it applies from the next beat. */
  setBpm(bpm: number): void;
  /** Called about when each beat sounds. */
  onBeat(listener: (beat: BeatInfo) => void): Unsubscribe;
}

export interface GameAudio {
  clock: SongClock;
  piano: PianoSound;
  metronome: MetronomeSound;
}
