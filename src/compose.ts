import { appConfig } from './appConfig';
import { createAudio } from './io/audio/createAudio';
import { monitorKeyboard } from './io/audio/monitor';
import { RoutedPiano } from './io/audio/RoutedPiano';
import { createKeyboardInputs } from './io/createInputs';
import { KeyboardPiano } from './io/midi/KeyboardPiano';

export interface SoundAndInputOptions {
  /** Load no piano samples until `audio.piano.setSound` gives this computer's sound (the game, from its admin settings). */
  waitForSound?: boolean;
}

/**
 * Composition root for sound and input, shared by the game and the dev pages: one audio system and one set of
 * keyboards (on-screen, computer and real or virtual MIDI), with the piano sounding for what is played. The piano plays
 * on the attached keyboard when this computer's sound is `keyboard` (ft_0_07.AC4), else on the browser's samples.
 */
export function createSoundAndInput(keyboardHost: HTMLElement, options: SoundAndInputOptions = {}) {
  const system = createAudio({ baseUrl: `${import.meta.env.BASE_URL}audio/salamander/`, deferLoad: true });
  system.unlock(window);
  const { clock } = system;
  const inputs = createKeyboardInputs({
    virtual: appConfig.flags.virtualDevice, parent: keyboardHost, keyTarget: window,
    now: () => clock.fromDomTime(performance.now()), toSongTimeMs: (t) => clock.fromDomTime(t),
  });
  const piano = new RoutedPiano(system.piano, new KeyboardPiano({ songNowMs: () => clock.nowMs() }), { waitForSound: options.waitForSound ?? false });
  void inputs.ready.then(() => {
    const follow = () => piano.attachKeyboard(inputs.keyboardOutput(), inputs.keyboardProfile());
    follow();
    inputs.midi?.onStatus(follow);
  });
  const audio = { ...system, piano, samples: system.piano };
  monitorKeyboard(inputs.keyboard, audio.piano, { monitorMidi: appConfig.flags.monitorMidi });
  return { audio, inputs };
}
