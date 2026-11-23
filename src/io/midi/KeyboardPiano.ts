import { EZ220_PROFILE, type KeyboardProfile } from './keyboardProfiles';

/**
 * The game's own notes played by the attached keyboard (ft_0_07.AC4): the piece preview, the ear trainer, the count-in's grace
 * note and the on-screen keys go out as MIDI notes, so no piano samples need to be in memory while the keyboard is there.
 *
 * The channel and the voice come from the keyboard's profile (`keyboardProfiles.ts`): on a keyboard whose channel 1 lights
 * keys (the EZ-220, verified) the notes go on channel 2, because a lit key would give the answer away by light (AX-0).
 */

const NOTE_ON = 0x90;
const NOTE_OFF = 0x80;
const CONTROL = 0xb0;
const PROGRAM = 0xc0;
const CC_BANK_MSB = 0;
const CC_BANK_LSB = 32;
const CC_VOLUME = 7;
const CC_ALL_NOTES_OFF = 123;
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
  private channel = EZ220_PROFILE.soundChannel;
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

  /**
   * Attach a keyboard's output with its profile, or null when it went away. A new output gets the profile's voice (when it
   * has one) and the volume, on the profile's channel.
   */
  attach(output: NoteOutput | null, profile: KeyboardProfile = EZ220_PROFILE): void {
    if (output === this.output && profile.soundChannel === this.channel) return;
    this.allNotesOff();
    this.output = output;
    this.channel = profile.soundChannel;
    this.sounding.clear();
    if (!output) return;
    if (profile.voice) {
      this.send([CONTROL | this.channel, CC_BANK_MSB, profile.voice.msb]);
      this.send([CONTROL | this.channel, CC_BANK_LSB, profile.voice.lsb]);
      this.send([PROGRAM | this.channel, profile.voice.program]);
    }
    this.sendVolume();
  }

  noteOn(midi: number, velocity: number, atMs?: number): void {
    if (!this.output) return;
    this.sounding.add(midi);
    this.send([NOTE_ON | this.channel, midi, Math.min(MIDI_MAX, Math.max(1, Math.round(velocity)))], this.domTime(atMs));
  }

  noteOff(midi: number, atMs?: number): void {
    if (!this.output) return;
    this.sounding.delete(midi);
    this.send([NOTE_OFF | this.channel, midi, 0], this.domTime(atMs));
  }

  allNotesOff(): void {
    if (!this.output) return;
    for (const midi of this.sounding) this.send([NOTE_OFF | this.channel, midi, 0]);
    this.sounding.clear();
    this.send([CONTROL | this.channel, CC_ALL_NOTES_OFF, 0]);
  }

  /** Master volume, 0 to 1, as the channel's volume. */
  setVolume(volume: number): void {
    this.volume = Math.min(1, Math.max(0, volume));
    if (this.output) this.sendVolume();
  }

  private sendVolume(): void {
    this.send([CONTROL | this.channel, CC_VOLUME, Math.round(this.volume * MIDI_MAX)]);
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
