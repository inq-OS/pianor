import type { PianoSound } from '../audio';
import type { PianoSoundKind } from '../../core/sound/pianoSound';
import type { KeyboardPiano, NoteOutput } from '../midi/KeyboardPiano';
import type { SamplerPiano } from './SamplerPiano';

export interface RoutedPianoOptions {
  /** The sound to start with; full when not given. */
  sound?: PianoSoundKind;
  /** Load no samples until `setSound` says which sound this computer uses (the game reads it from the admin settings). */
  waitForSound?: boolean;
}

/**
 * The piano the game plays (ft_0_07.AC3, AC4): the browser's samples, full or light, or with `keyboard` the attached EZ-220,
 * falling back on the full samples while no keyboard is attached. The samples are fetched only once they are needed: at
 * once for `full` and `light`, and for `keyboard` only once MIDI has settled with no keyboard or the keyboard goes away.
 */
export class RoutedPiano implements PianoSound {
  private kind: PianoSoundKind;
  private soundKnown: boolean;
  private midiKnown = false;
  private onKeyboard = false;

  constructor(private readonly samples: SamplerPiano, private readonly keyboard: KeyboardPiano, options: RoutedPianoOptions = {}) {
    this.kind = options.sound ?? 'full';
    this.soundKnown = !options.waitForSound;
    void samples.setSound(this.kind);
    this.update();
  }

  get loaded(): boolean {
    return this.onKeyboard || this.samples.loaded;
  }

  get ready(): Promise<void> {
    return this.onKeyboard ? Promise.resolve() : this.samples.ready;
  }

  get failed(): number {
    return this.onKeyboard ? 0 : this.samples.failed;
  }

  get sound(): PianoSoundKind {
    return this.kind;
  }

  /** The samples' voices sounding or releasing, for the tests and the audio demo (none while the keyboard plays). */
  get voiceCount(): number {
    return this.samples.voiceCount;
  }

  /** True while the game's notes go to the keyboard. */
  get playsOnKeyboard(): boolean {
    return this.onKeyboard;
  }

  noteOn(midi: number, velocity: number, atMs?: number): void {
    if (this.onKeyboard) this.keyboard.noteOn(midi, velocity, atMs);
    else this.samples.noteOn(midi, velocity, atMs);
  }

  noteOff(midi: number, atMs?: number): void {
    if (this.onKeyboard) this.keyboard.noteOff(midi, atMs);
    else this.samples.noteOff(midi, atMs);
  }

  allNotesOff(): void {
    this.keyboard.allNotesOff();
    this.samples.allNotesOff();
  }

  setVolume(volume: number): void {
    this.keyboard.setVolume(volume);
    this.samples.setVolume(volume);
  }

  async setSound(sound: PianoSoundKind): Promise<void> {
    this.soundKnown = true;
    this.kind = sound;
    const switching = this.samples.setSound(sound);
    this.update();
    await switching;
  }

  /** The keyboard's output once MIDI has settled (null: none, or it went away). Call it again on every change. */
  attachKeyboard(output: NoteOutput | null): void {
    this.midiKnown = true;
    this.keyboard.attach(output);
    this.update();
  }

  private update(): void {
    const onKeyboard = this.kind === 'keyboard' && this.keyboard.attached;
    if (onKeyboard !== this.onKeyboard) {
      if (this.onKeyboard) this.keyboard.allNotesOff();
      else this.samples.allNotesOff();
      this.onKeyboard = onKeyboard;
    }
    const needSamples = !onKeyboard && this.soundKnown && (this.kind !== 'keyboard' || this.midiKnown);
    if (needSamples) void this.samples.load();
  }
}
