import { MIDI_MAX, MIDI_VELOCITY_MIN } from '../../core/chart';
import { EZ220_HIGH, EZ220_LOW } from '../ez220';
import { ACTIVE_SENSING, DEFAULT_RELEASE_VELOCITY, NOTE_OFF, NOTE_ON } from '../midi/bytes';

export interface VirtualEz220Options {
  /** Port name. The real device name is unverified until the hardware spike, so this is only a label. */
  name?: string;
  /** How a key release is sent: note-on with velocity 0 (running-status style) or a real note-off. */
  noteOffStyle?: 'velocity0' | 'note-off';
  /** DOM-style clock for message timestamps. Defaults to `performance.now()`. */
  now?: () => number;
  /** Start unplugged. */
  connected?: boolean;
}

type Listener<E> = ((event: E) => void) | null;

/** Structural stand-in for `MIDIInput`: only what `WebMidiKeyboard` and tests use. */
class FakeInput {
  readonly type = 'input';
  readonly manufacturer = 'Virtual';
  state: 'connected' | 'disconnected' = 'connected';
  connection: 'open' | 'closed' | 'pending' = 'closed';
  onmidimessage: Listener<MIDIMessageEvent> = null;
  onstatechange: Listener<MIDIConnectionEvent> = null;
  constructor(readonly id: string, readonly name: string) {}
  open(): Promise<this> {
    this.connection = 'open';
    return Promise.resolve(this);
  }
  close(): Promise<this> {
    this.connection = 'closed';
    return Promise.resolve(this);
  }
}

class FakeOutput {
  readonly type = 'output';
  readonly manufacturer = 'Virtual';
  state: 'connected' | 'disconnected' = 'connected';
  connection: 'open' | 'closed' | 'pending' = 'closed';
  onstatechange: Listener<MIDIConnectionEvent> = null;
  /** Everything sent to the keyboard, e.g. to check what the game does with key lights. */
  readonly sent: { data: number[]; timeStamp: number | undefined }[] = [];
  constructor(readonly id: string, readonly name: string) {}
  send(data: number[], timeStamp?: number): void {
    if (this.state !== 'connected') {
      const error = new Error('The MIDI port is disconnected.');
      error.name = 'InvalidStateError';
      throw error;
    }
    this.sent.push({ data: [...data], timeStamp });
  }
  open(): Promise<this> {
    this.connection = 'open';
    return Promise.resolve(this);
  }
  close(): Promise<this> {
    this.connection = 'closed';
    return Promise.resolve(this);
  }
}

/**
 * A fake keyboard behind a fake `MIDIAccess`, so the real Web MIDI wrapper runs unchanged without hardware.
 * Traits modelled: raw MIDI bytes on channel 1, 61-key range (MIDI 36 to 96), note-off as velocity 0 or a real note-off,
 * active sensing, hot-plug. Not modelled (unverified until the hardware spike): real latency, key lighting, driver quirks, port names.
 */
export class VirtualEz220 {
  readonly input: FakeInput;
  readonly output: FakeOutput;
  /** Hand this to `WebMidiKeyboard.create({ requestAccess })`. */
  readonly access: MIDIAccess;

  private readonly accessImpl: { inputs: Map<string, FakeInput>; outputs: Map<string, FakeOutput>; sysexEnabled: boolean; onstatechange: Listener<MIDIConnectionEvent> };
  private readonly now: () => number;
  private readonly noteOffStyle: 'velocity0' | 'note-off';

  constructor(options: VirtualEz220Options = {}) {
    const name = options.name ?? 'Virtual EZ-220 (simulated)';
    this.now = options.now ?? (() => performance.now());
    this.noteOffStyle = options.noteOffStyle ?? 'velocity0';
    this.input = new FakeInput('virtual-ez220-in', name);
    this.output = new FakeOutput('virtual-ez220-out', name);
    this.accessImpl = {
      inputs: new Map([[this.input.id, this.input]]),
      outputs: new Map([[this.output.id, this.output]]),
      sysexEnabled: false,
      onstatechange: null,
    };
    this.access = this.accessImpl as unknown as MIDIAccess;
    if (options.connected === false) {
      this.input.state = 'disconnected';
      this.output.state = 'disconnected';
    }
  }

  get isConnected(): boolean {
    return this.input.state === 'connected';
  }

  /** Press a key (channel 1). Throws outside the EZ-220's 61 keys or while unplugged. */
  press(midi: number, velocity = 80, timeStamp = this.now()): void {
    this.assertKey(midi);
    if (velocity < MIDI_VELOCITY_MIN || velocity > MIDI_MAX) throw new RangeError(`Velocity must be ${MIDI_VELOCITY_MIN}..${MIDI_MAX}, got ${velocity}`);
    this.sendRaw([NOTE_ON, midi, velocity], timeStamp);
  }

  release(midi: number, timeStamp = this.now()): void {
    this.assertKey(midi);
    this.sendRaw(this.noteOffStyle === 'velocity0' ? [NOTE_ON, midi, 0] : [NOTE_OFF, midi, DEFAULT_RELEASE_VELOCITY], timeStamp);
  }

  /** One active-sensing byte, which the real device sends periodically. Must be ignored by consumers. */
  activeSensing(timeStamp = this.now()): void {
    this.sendRaw([ACTIVE_SENSING], timeStamp);
  }

  /** Deliver any raw bytes to whoever is listening. Throws while unplugged. */
  sendRaw(data: number[], timeStamp = this.now()): void {
    if (!this.isConnected) throw new Error('The virtual keyboard is unplugged.');
    this.input.onmidimessage?.({ data: Uint8Array.from(data), timeStamp, target: this.input } as unknown as MIDIMessageEvent);
  }

  disconnect(): void {
    this.setState('disconnected');
  }

  connect(): void {
    this.setState('connected');
  }

  private setState(state: 'connected' | 'disconnected'): void {
    if (this.input.state === state) return;
    this.input.state = state;
    this.output.state = state;
    for (const port of [this.input, this.output]) {
      const event = { port } as unknown as MIDIConnectionEvent;
      port.onstatechange?.(event);
      this.accessImpl.onstatechange?.(event);
    }
  }

  private assertKey(midi: number): void {
    if (!Number.isInteger(midi) || midi < EZ220_LOW || midi > EZ220_HIGH) {
      throw new RangeError(`The EZ-220 has keys ${EZ220_LOW} to ${EZ220_HIGH}, got ${midi}`);
    }
    if (!this.isConnected) throw new Error('The virtual keyboard is unplugged.');
  }
}

/** Make `requestMIDIAccess` on a navigator-like object resolve to the virtual keyboard (for browser tests and dev). */
export function installVirtualMidi(target: { requestMIDIAccess?: unknown }, device: VirtualEz220): void {
  target.requestMIDIAccess = () => Promise.resolve(device.access);
}
