import type { KeyLightOutput } from '../keyboard';

/**
 * Key lighting on the real EZ-220 is unverified until the hardware spike, so the real output does nothing.
 * Replace this with a Web MIDI implementation only after the hardware spike records how lighting works in `docs/hardware-notes.md`.
 */
export const nullKeyLights: KeyLightOutput = {
  supported: false,
  setLitKeys() {
    // intentionally empty
  },
};
