import type { NoteEvent } from '../../core/judge/types';
import { DATA_MASK, NOTE_OFF, NOTE_ON, STATUS_BIT, TYPE_MASK } from './bytes';

/**
 * Turn raw MIDI bytes into a `NoteEvent`, or null for anything that is not a key press or release
 * (active sensing, clock, control changes, program changes, partial messages).
 * A note-on with velocity 0 is a note-off, and note-off release velocity is dropped.
 */
export function parseMidiMessage(data: ArrayLike<number>, timeMs: number, source: string): NoteEvent | null {
  if (data.length < 3) return null;
  const status = data[0]!;
  if ((status & STATUS_BIT) === 0) return null; // a data byte, not a status byte
  const type = status & TYPE_MASK;
  if (type !== NOTE_ON && type !== NOTE_OFF) return null;
  const midi = data[1]! & DATA_MASK;
  const velocity = data[2]! & DATA_MASK;
  if (type === NOTE_OFF || velocity === 0) return { kind: 'off', midi, velocity: 0, timeMs, source };
  return { kind: 'on', midi, velocity, timeMs, source };
}
