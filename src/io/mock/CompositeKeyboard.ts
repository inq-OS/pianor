import type { NoteEvent } from '../../core/judge/types';
import { Emitter } from '../emitter';
import type { KeyboardInput, KeyboardStatus, Unsubscribe } from '../keyboard';

/** Merges several keyboards (real MIDI, on-screen, computer keyboard) into one `KeyboardInput`. */
export class CompositeKeyboard implements KeyboardInput {
  readonly id = 'composite';

  private readonly notes = new Emitter<NoteEvent>();
  private readonly statuses = new Emitter<KeyboardStatus>();
  private readonly unsubscribe: Unsubscribe[] = [];
  private readonly inputs: KeyboardInput[] = [];
  private status: KeyboardStatus = { state: 'disconnected', name: null };
  private held = false;
  /** Keys whose press was dropped while held, so their release is dropped too. */
  private readonly dropped = new Set<number>();

  constructor(inputs: readonly KeyboardInput[]) {
    for (const input of inputs) this.attach(input);
    this.status = this.compute();
  }

  /** Add an input later, e.g. real MIDI once the browser has granted access. */
  add(input: KeyboardInput): void {
    this.attach(input);
    this.update();
  }

  private attach(input: KeyboardInput): void {
    this.inputs.push(input);
    this.unsubscribe.push(input.onNote((e) => this.pass(e)));
    this.unsubscribe.push(input.onStatus(() => this.update()));
  }

  /**
   * While held, a press goes nowhere (the window is covered because it is too small, d105: the hidden screen must not take
   * notes) and so does its release; the release of a key pressed before the hold still goes out, so no key stays down.
   */
  setHeld(held: boolean): void {
    this.held = held;
  }

  private pass(e: NoteEvent): void {
    const on = e.kind === 'on' && e.velocity > 0;
    if (on && this.held) {
      this.dropped.add(e.midi);
      return;
    }
    if (on) this.dropped.delete(e.midi);
    else if (this.dropped.delete(e.midi)) return;
    this.notes.emit(e);
  }

  getStatus(): KeyboardStatus {
    return { ...this.status };
  }

  onNote(listener: (event: NoteEvent) => void): Unsubscribe {
    return this.notes.on(listener);
  }

  onStatus(listener: (status: KeyboardStatus) => void): Unsubscribe {
    return this.statuses.on(listener);
  }

  /** Disposes the inputs too. */
  dispose(): void {
    this.unsubscribe.forEach((u) => u());
    this.unsubscribe.length = 0;
    this.inputs.forEach((i) => i.dispose());
    this.notes.clear();
    this.statuses.clear();
  }

  /** Connected when any input is; the name is the first connected input's. */
  private compute(): KeyboardStatus {
    const connected = this.inputs.map((i) => i.getStatus()).find((s) => s.state === 'connected');
    return connected ? { ...connected } : { state: 'disconnected', name: null };
  }

  private update(): void {
    const next = this.compute();
    if (next.state === this.status.state && next.name === this.status.name) return;
    this.status = next;
    this.statuses.emit({ ...next });
  }
}
