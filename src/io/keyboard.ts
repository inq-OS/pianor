/**
 * The io interfaces the rest of the game may depend on. `src/game` imports only this file from `src/io`,
 * never an implementation (lint-enforced). Implementations: Web MIDI wrapper (`io/midi`), and for development
 * and tests the on-screen keyboard, QWERTY keyboard, scripted/replay keyboard and virtual EZ-220 (`io/mock`).
 */
import type { NoteEvent } from '../core/judge/types';

export type Unsubscribe = () => void;

export interface KeyboardStatus {
  state: 'connected' | 'disconnected';
  /** Device name when known. */
  name: string | null;
}

/** The `source` of the events from a real MIDI keyboard (`WebMidiKeyboard`); the monitor leaves them silent by default. */
export const MIDI_SOURCE = 'midi';

/** A source of key events. Emits `NoteEvent`s only: never a Web MIDI object, never a DOM event. */
export interface KeyboardInput {
  readonly id: string;
  getStatus(): KeyboardStatus;
  /** Note events. A note-on with velocity 0 never appears: it is delivered as a note-off. */
  onNote(listener: (event: NoteEvent) => void): Unsubscribe;
  onStatus(listener: (status: KeyboardStatus) => void): Unsubscribe;
  /** Stop listening to the device and drop all listeners. Safe to call twice. */
  dispose(): void;
}

/** Lights keys to show the next note. Real EZ-220 lighting is unverified until the hardware spike. */
export interface KeyLightOutput {
  /** False when lighting does nothing on this output. */
  readonly supported: boolean;
  /** Replace the set of lit keys. */
  setLitKeys(midis: readonly number[]): void;
}
