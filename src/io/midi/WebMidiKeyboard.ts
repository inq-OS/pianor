import type { NoteEvent } from '../../core/judge/types';
import { Emitter } from '../emitter';
import { MIDI_SOURCE, type KeyboardInput, type KeyboardStatus, type Unsubscribe } from '../keyboard';
import { profileOfPort, type KeyboardProfile } from './keyboardProfiles';
import { parseMidiMessage } from './parse';

export type MidiUnavailableReason = 'unsupported' | 'denied' | 'failed';

/** Thrown by `WebMidiKeyboard.create` when Web MIDI cannot be used. The game then falls back to the on-screen keyboard. */
export class MidiUnavailableError extends Error {
  constructor(readonly reason: MidiUnavailableReason, message: string, options?: { cause?: unknown }) {
    super(message, options);
  }
}

export interface MidiDeviceInfo {
  id: string;
  name: string;
  manufacturer: string;
  connected: boolean;
}

export interface WebMidiOptions {
  /** Defaults to `navigator.requestMIDIAccess`. Tests and the virtual EZ-220 pass their own. */
  requestAccess?: () => Promise<MIDIAccess>;
  /** Current DOM high-resolution time in ms. Defaults to `performance.now()`. */
  now?: () => number;
  /** Maps DOM timestamps (`MIDIMessageEvent.timeStamp`) onto the song/audio clock. Identity until the audio clock is given. */
  toSongTimeMs?: (domTimeStampMs: number) => number;
  /** Auto-selection prefers an input whose name matches. */
  preferName?: RegExp;
  source?: string;
}

async function defaultRequestAccess(): Promise<MIDIAccess> {
  if (typeof navigator === 'undefined' || typeof navigator.requestMIDIAccess !== 'function') {
    throw new MidiUnavailableError('unsupported', 'Web MIDI is not available in this browser (use Chrome or Edge).');
  }
  return navigator.requestMIDIAccess({ sysex: false });
}

/**
 * Raw Web MIDI input behind `KeyboardInput`. Works with any `MIDIAccess`, real or the virtual EZ-220.
 * Selection: automatic (preferred name, else first connected input) unless an input is picked with `selectInput`.
 * Hot-plug: follows `statechange`; keys still held when the device goes away are released with synthetic note-offs.
 */
export class WebMidiKeyboard implements KeyboardInput {
  readonly id = 'web-midi';

  private readonly notes = new Emitter<NoteEvent>();
  private readonly statuses = new Emitter<KeyboardStatus>();
  private readonly held = new Set<number>();
  private active: MIDIInput | null = null;
  private pickedId: string | null = null;
  private status: KeyboardStatus = { state: 'disconnected', name: null };
  private disposed = false;

  private readonly now: () => number;
  private readonly toSongTimeMs: (domTimeStampMs: number) => number;
  private readonly source: string;
  private readonly preferName: RegExp | undefined;

  private constructor(private readonly access: MIDIAccess, options: WebMidiOptions) {
    this.now = options.now ?? (() => performance.now());
    this.toSongTimeMs = options.toSongTimeMs ?? ((t) => t);
    this.source = options.source ?? MIDI_SOURCE;
    this.preferName = options.preferName;
  }

  static async create(options: WebMidiOptions = {}): Promise<WebMidiKeyboard> {
    let access: MIDIAccess;
    try {
      access = await (options.requestAccess ?? defaultRequestAccess)();
    } catch (error) {
      if (error instanceof MidiUnavailableError) throw error;
      const name = error instanceof Error ? error.name : '';
      const denied = name === 'SecurityError' || name === 'NotAllowedError';
      throw new MidiUnavailableError(denied ? 'denied' : 'failed', denied ? 'MIDI permission was denied.' : 'Could not open MIDI.', { cause: error });
    }
    const keyboard = new WebMidiKeyboard(access, options);
    access.onstatechange = () => keyboard.refresh();
    keyboard.refresh();
    return keyboard;
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

  /** All MIDI inputs the browser knows about, connected or not. */
  listInputs(): MidiDeviceInfo[] {
    const out: MidiDeviceInfo[] = [];
    this.access.inputs.forEach((input) => {
      out.push({ id: input.id, name: input.name ?? '', manufacturer: input.manufacturer ?? '', connected: input.state === 'connected' });
    });
    return out;
  }

  /**
   * The output of the keyboard being played (ft_0_07.AC4): the connected output named like the active input, else one whose
   * name holds the input's name, else one matching the preferred name. Null while no input is active or no output matches,
   * so the game's notes never go to some other device.
   */
  output(): MIDIOutput | null {
    const inputName = this.active?.name ?? '';
    if (!this.active) return null;
    const outputs: MIDIOutput[] = [];
    this.access.outputs.forEach((o) => {
      if (o.state === 'connected') outputs.push(o);
    });
    return outputs.find((o) => (o.name ?? '') === inputName)
      ?? outputs.find((o) => inputName !== '' && (o.name ?? '').includes(inputName))
      ?? outputs.find((o) => this.preferName?.test(o.name ?? '') === true)
      ?? null;
  }

  /** What the game knows about the keyboard being played, from its port name (ft_0_06.AC5); the unknown profile while none is. */
  profile(): KeyboardProfile {
    return profileOfPort(this.active?.name);
  }

  /** Pick a specific input by id, or null to go back to automatic selection. */
  selectInput(id: string | null): void {
    this.pickedId = id;
    this.refresh();
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.access.onstatechange = null;
    this.detach();
    this.notes.clear();
    this.statuses.clear();
  }

  private connectedInputs(): MIDIInput[] {
    const inputs: MIDIInput[] = [];
    this.access.inputs.forEach((input) => {
      if (input.state === 'connected') inputs.push(input);
    });
    return inputs;
  }

  private choose(inputs: MIDIInput[]): MIDIInput | null {
    if (this.pickedId !== null) return inputs.find((i) => i.id === this.pickedId) ?? null;
    if (this.active && inputs.includes(this.active)) return this.active; // keep the current one when still there
    const preferred = this.preferName ? inputs.find((i) => this.preferName!.test(i.name ?? '')) : undefined;
    return preferred ?? inputs[0] ?? null;
  }

  private refresh(): void {
    if (this.disposed) return;
    const next = this.choose(this.connectedInputs());
    if (next !== this.active) {
      this.detach();
      this.active = next;
      if (next) next.onmidimessage = (event) => this.onMessage(event);
    }
    this.setStatus(next ? { state: 'connected', name: next.name ?? null } : { state: 'disconnected', name: null });
  }

  private detach(): void {
    if (this.active) this.active.onmidimessage = null;
    this.active = null;
    const timeMs = this.toSongTimeMs(this.now());
    for (const midi of [...this.held]) this.notes.emit({ kind: 'off', midi, velocity: 0, timeMs, source: this.source });
    this.held.clear();
  }

  private onMessage(event: MIDIMessageEvent): void {
    if (!event.data) return;
    const note = parseMidiMessage(event.data, this.toSongTimeMs(event.timeStamp), this.source);
    if (!note) return;
    if (note.kind === 'on') this.held.add(note.midi);
    else this.held.delete(note.midi);
    this.notes.emit(note);
  }

  private setStatus(next: KeyboardStatus): void {
    if (next.state === this.status.state && next.name === this.status.name) return;
    this.status = next;
    this.statuses.emit({ ...next });
  }
}
