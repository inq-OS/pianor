import type { NoteEvent } from '../../core/judge/types';
import { Emitter } from '../emitter';
import type { KeyboardInput, KeyboardStatus, Unsubscribe } from '../keyboard';
import type { Scheduler } from './scheduler';
import type { TimedNoteEvent } from './performance';

/**
 * A `KeyboardInput` that plays back a fixed list of events: a recorded session (replay) or a composed performance.
 * Events skip the MIDI byte layer. Use `VirtualEz220` when the byte path matters too.
 */
export class ScriptedKeyboard implements KeyboardInput {
  readonly id = 'scripted';

  private readonly notes = new Emitter<NoteEvent>();
  private readonly statuses = new Emitter<KeyboardStatus>();
  private next = 0;
  private disposed = false;

  constructor(private readonly events: readonly TimedNoteEvent[], private readonly source = 'replay') {}

  getStatus(): KeyboardStatus {
    return { state: 'connected', name: 'Scripted keyboard' };
  }

  onNote(listener: (event: NoteEvent) => void): Unsubscribe {
    return this.notes.on(listener);
  }

  onStatus(listener: (status: KeyboardStatus) => void): Unsubscribe {
    return this.statuses.on(listener);
  }

  get remaining(): number {
    return this.events.length - this.next;
  }

  /** Emit the next event. Returns false when the script is over. */
  step(): boolean {
    const event = this.events[this.next];
    if (!event || this.disposed) return false;
    this.next++;
    this.notes.emit({ kind: event.kind, midi: event.midi, velocity: event.velocity, timeMs: event.atMs, source: this.source });
    return true;
  }

  /** Emit everything that is left, right now. */
  flush(): void {
    while (this.step());
  }

  /** Emit the remaining events at their own times on a scheduler. */
  start(scheduler: Scheduler): void {
    for (const event of this.events.slice(this.next)) scheduler.at(event.atMs, () => void this.step());
  }

  dispose(): void {
    this.disposed = true;
    this.notes.clear();
    this.statuses.clear();
  }
}
