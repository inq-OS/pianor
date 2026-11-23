import type { KeyboardInput, KeyLightOutput } from './keyboard';
import { KNOWN_KEYBOARD_NAME, UNKNOWN_PROFILE, type KeyboardProfile } from './midi/keyboardProfiles';
import { MidiUnavailableError, WebMidiKeyboard } from './midi/WebMidiKeyboard';
import { CompositeKeyboard } from './mock/CompositeKeyboard';
import { OnScreenKeyboard } from './mock/OnScreenKeyboard';
import { QwertyKeyboard, type KeyTarget } from './mock/QwertyKeyboard';
import { VirtualEz220 } from './mock/VirtualEz220';

export interface KeyboardInputs {
  /** Everything the student or developer can play with, merged. Usable immediately; real MIDI joins when ready. */
  keyboard: KeyboardInput;
  /** Where "show me the next key" goes. Only the on-screen keyboard can show it until the hardware spike verifies real lighting. */
  lights: KeyLightOutput;
  onScreen: OnScreenKeyboard;
  /** Present with `virtual: true`: drive it from tests, demos and the virtual player. */
  virtualDevice: VirtualEz220 | null;
  /** The real (or virtual) MIDI input once it is open, else null. Read after `ready`. */
  midi: KeyboardInput | null;
  /** Why real MIDI is not in use ("unsupported", "denied", "failed"), or null. Read after `ready`. */
  midiProblem: string | null;
  /** The output of the keyboard being played (ft_0_07.AC4), or null. Changes with the input: read it on its status. */
  keyboardOutput(): MIDIOutput | null;
  /** The profile of the keyboard being played (ft_0_06.AC5), for the output only. Changes with the input like `keyboardOutput`. */
  keyboardProfile(): KeyboardProfile;
  /** Resolves when the attempt to open MIDI has finished, whether or not it worked. Never rejects. */
  ready: Promise<void>;
  dispose(): void;
}

export interface CreateInputsOptions {
  /** Use the virtual EZ-220 instead of real MIDI. */
  virtual: boolean;
  /** Where the on-screen keyboard goes. */
  parent: HTMLElement;
  /** Where computer-keyboard events come from. */
  keyTarget: Window;
  /** Song time "now" in ms for on-screen and computer keys. Defaults to the DOM clock. */
  now?: () => number;
  /** Maps real MIDI timestamps (DOM clock) onto song time. Defaults to the identity. */
  toSongTimeMs?: (domTimeStampMs: number) => number;
}

/**
 * The composition root for input: real or virtual MIDI, the on-screen keyboard and the computer keyboard,
 * merged into one `KeyboardInput`. It returns at once so the game can start while the browser asks for MIDI
 * permission; a missing or refused MIDI device is a status (`midiProblem`), not an error.
 */
export function createKeyboardInputs(options: CreateInputsOptions): KeyboardInputs {
  const now = options.now ? { now: options.now } : {};
  const onScreen = new OnScreenKeyboard(options.parent, now);
  const keyTarget: KeyTarget = {
    addEventListener: (type, listener) => options.keyTarget.addEventListener(type, listener as unknown as EventListener),
    removeEventListener: (type, listener) => options.keyTarget.removeEventListener(type, listener as unknown as EventListener),
  };
  const composite = new CompositeKeyboard([onScreen, new QwertyKeyboard(keyTarget, now)]);
  const virtualDevice = options.virtual ? new VirtualEz220() : null;

  const inputs: KeyboardInputs = {
    keyboard: composite, lights: onScreen, onScreen, virtualDevice, midi: null, midiProblem: null, keyboardOutput: () => null,
    keyboardProfile: () => UNKNOWN_PROFILE,
    ready: Promise.resolve(), dispose: () => composite.dispose(),
  };
  inputs.ready = WebMidiKeyboard.create({
    ...(virtualDevice ? { requestAccess: () => Promise.resolve(virtualDevice.access) } : {}),
    ...(options.toSongTimeMs ? { toSongTimeMs: options.toSongTimeMs } : {}),
    preferName: KNOWN_KEYBOARD_NAME,
  }).then((midi) => {
    inputs.midi = midi;
    inputs.keyboardOutput = () => midi.output();
    inputs.keyboardProfile = () => midi.profile();
    composite.add(midi);
  }).catch(
    (error: unknown) => {
      inputs.midiProblem = error instanceof MidiUnavailableError ? error.reason : 'failed';
    },
  );
  return inputs;
}
