import type { PianoSound } from '../audio';
import { MIDI_SOURCE, type KeyboardInput, type Unsubscribe } from '../keyboard';

export interface MonitorOptions {
  /**
   * Also sound keys that come from real MIDI. Off by default: the EZ-220 makes its own sound, and hearing it twice
   * (once at once, once through the browser a little later) is worse than one sound. Turn on for a silent keyboard
   * or the virtual EZ-220.
   */
  monitorMidi: boolean;
}


/** Make the piano sound for what the student plays: on-screen keys and computer keys always, real MIDI only when asked. */
export function monitorKeyboard(keyboard: KeyboardInput, piano: PianoSound, options: MonitorOptions): Unsubscribe {
  return keyboard.onNote((event) => {
    if (event.source === MIDI_SOURCE && !options.monitorMidi) return;
    if (event.kind === 'on' && event.velocity > 0) piano.noteOn(event.midi, event.velocity);
    else piano.noteOff(event.midi);
  });
}
