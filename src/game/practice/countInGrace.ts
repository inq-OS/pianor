import { PLAYBACK_VELOCITY } from '../../core/chart';
import type { Transport } from '../../core/transport';
import { SCHEDULE_LOOKAHEAD_MS, type PianoSound } from '../../io/audio';

/**
 * The count-in's grace note (d121, core_09.AC34): when the piece's first note has one, the piano sounds it on
 * the count-in's last beat, which the metronome leaves silent (`Transport.metronome`). The transport decides when; this
 * hands the notes to the piano, but only once the beat is within `SCHEDULE_LOOKAHEAD_MS`, like the metronome's clicks: a
 * note queued on the piano cannot be taken back, so one queued a whole count-in ahead would still sound after the screen
 * started over or was left. Call `update` every frame; once per start of a transport, then nothing.
 */
export class CountInGrace {
  /** The transport and start whose grace is dealt with (sounded, or none to sound). */
  private doneFor: { transport: Transport; startMs: number } | null = null;
  private stopped = false;

  update(transport: Transport, piano: Pick<PianoSound, 'noteOn' | 'noteOff'>, nowMs: number): void {
    const startMs = transport.songStartMs;
    if (this.stopped || startMs === null) return;
    if (this.doneFor?.transport === transport && this.doneFor.startMs === startMs) return;
    const graces = transport.countInGraces();
    if (graces.length > 0 && nowMs < graces[0]!.atMs - SCHEDULE_LOOKAHEAD_MS) return; // not yet: nothing queued
    this.doneFor = { transport, startMs };
    for (const grace of graces) {
      if (nowMs >= grace.endMs) continue; // its time is over (a frame came too late): never sound it late
      piano.noteOn(grace.midi, PLAYBACK_VELOCITY, grace.atMs);
      piano.noteOff(grace.midi, grace.endMs);
    }
  }

  /** The screen stops or is left: no grace is queued from now on. */
  stop(): void {
    this.stopped = true;
  }
}
