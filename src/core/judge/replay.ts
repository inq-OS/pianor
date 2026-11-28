import type { NoteEvent, PlayMode } from './types';

/**
 * Pick a Wait-mode pass up again on a fresh judge (the screen was left for the settings and drawn anew): the keys of the
 * pass so far are handed to `mode` in order, shifted in time so the last one lands at `nowMs` (the next key's rhythm is
 * measured from the moment the pass came back, not across the time away), and every key still held is let go. Returns
 * false when the keys would finish the piece: that pass is over and is not picked up (the caller starts afresh).
 */
export function replayKeys(mode: PlayMode, keys: readonly NoteEvent[], nowMs: number): boolean {
  const shift = keys.length === 0 ? 0 : nowMs - keys[keys.length - 1]!.timeMs;
  const held = new Set<number>();
  for (const key of keys) {
    const events = mode.handle({ ...key, timeMs: key.timeMs + shift, source: 'replay' });
    if (events.some((e) => e.type === 'PieceCompleted')) return false;
    if (key.kind === 'on' && key.velocity > 0) held.add(key.midi);
    else held.delete(key.midi);
  }
  for (const midi of held) mode.handle({ kind: 'off', midi, velocity: 0, timeMs: nowMs, source: 'replay' });
  return true;
}
