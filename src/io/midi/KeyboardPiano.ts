/**
 * The game's own notes played by the attached EZ-220 (ft_0_07.AC4): the piece preview, the ear trainer, the count-in's grace
 * note and the on-screen keys go out as MIDI notes, so no piano samples need to be in memory while the keyboard is there.
 *
 * Channel 2, because a note on channel 1 also lights its key (verified on the hardware), and a lit key would give the answer away
 * by light (AX-0). That channel 2 sounds without lighting is remembered from a run, not yet recorded
 * (`docs/hardware-notes.md`): needs human. The voice is chosen as Grand Piano 1 by bank select and program change, per
 * Yamaha's manual (`docs/hardware/ez-220-reference.md`), unverified.
 */

/** MIDI channel 2, as the low nibble of a status byte. */
export const KEYBOARD_PIANO_CHANNEL = 1;
const NOTE_ON = 0x90 | KEYBOARD_PIANO_CHANNEL;
const NOTE_OFF = 0x80 | KEYBOARD_PIANO_CHANNEL;
const CONTROL = 0xb0 | KEYBOARD_PIANO_CHANNEL;
const PROGRAM = 0xc0 | KEYBOARD_PIANO_CHANNEL;
const CC_BANK_MSB = 0;
const CC_BANK_LSB = 32;
const CC_VOLUME = 7;
const CC_ALL_NOTES_OFF = 123;
/** Grand Piano 1, the panel default: bank MSB 0, LSB 112, program 1 (sent as 0). */
const GRAND_PIANO = { msb: 0, lsb: 112, program: 0 };
const MIDI_MAX = 127;

/** The part of a Web MIDI output this uses. */
export interface NoteOutput {
  send(data: number[], timeStamp?: number): void;
}

export interface KeyboardPianoOptions {
  /** Song time now, in ms (the audio clock). */
  songNowMs: () => number;
  /** DOM time now, in ms (`performance.now()`), the clock Web MIDI timestamps are on. */
  domNowMs?: () => number;
}

/** Sends the game's notes to one MIDI output, or drops them while there is none. */
export class KeyboardPiano {
  private output: NoteOutput | null = null;
  private volume = 1;
  /** Notes started and not yet released, so a stop or an unplug can release them. */
  private readonly sounding = new Set<number>();
  private readonly domNowMs: () => number;

  constructor(private readonly options: KeyboardPianoOptions) {
    this.domNowMs = options.domNowMs ?? (() => performance.now());
  }

  /** True while an output is attached. */
  get attached(): boolean {
    return this.output !== null;
  }

  /** Attach an output (the EZ-220's), or null when it went away. A new output gets the piano voice and the volume. */
  attach(output: NoteOutput | null): void {
    if (output === this.output) return;
    this.allNotesOff();
    this.output = output;
    this.sounding.clear();
    if (!output) return;
    this.send([CONTROL, CC_BANK_MSB, GRAND_PIANO.msb]);
    this.send([CONTROL, CC_BANK_LSB, GRAND_PIANO.lsb]);
    this.send([PROGRAM, GRAND_PIANO.program]);
    this.sendVolume();
  }

  noteOn(midi: number, velocity: number, atMs?: number): void {
    if (!this.output) return;
    this.sounding.add(midi);
    this.send([NOTE_ON, midi, Math.min(MIDI_MAX, Math.max(1, Math.round(velocity)))], this.domTime(atMs));
  }

  noteOff(midi: number, atMs?: number): void {
    if (!this.output) return;
    this.sounding.delete(midi);
    this.send([NOTE_OFF, midi, 0], this.domTime(atMs));
  }

  allNotesOff(): void {
    if (!this.output) return;
    for (const midi of this.sounding) this.send([NOTE_OFF, midi, 0]);
    this.sounding.clear();
    this.send([CONTROL, CC_ALL_NOTES_OFF, 0]);
  }

  /** Master volume, 0 to 1, as the channel's volume. */
  setVolume(volume: number): void {
    this.volume = Math.min(1, Math.max(0, volume));
    if (this.output) this.sendVolume();
  }

  private sendVolume(): void {
    this.send([CONTROL, CC_VOLUME, Math.round(this.volume * MIDI_MAX)]);
  }

  /** A song time as a Web MIDI timestamp; now (undefined) for a time already past or not given. */
  private domTime(atMs: number | undefined): number | undefined {
    if (atMs === undefined) return undefined;
    const ahead = atMs - this.options.songNowMs();
    return ahead > 0 ? this.domNowMs() + ahead : undefined;
  }

  /** A send to an output that just went away throws; the unplug that follows detaches it. */
  private send(data: number[], timeStamp?: number): void {
    try {
      if (timeStamp === undefined) this.output?.send(data);
      else this.output?.send(data, timeStamp);
    } catch {
      // unplugged mid-send: the state change detaches the output
    }
  }
}
