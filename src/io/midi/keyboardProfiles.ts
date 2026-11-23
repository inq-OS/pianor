/**
 * What the game must know about a MIDI keyboard to send its own notes to it (ft_0_06.AC5, ft_0_07.AC4), told apart by the
 * name of its port. Only `src/io` reads this: input is the same for every keyboard (`KeyboardInput`, `NoteEvent`), so
 * nothing above `src/io/keyboard.ts` knows which keyboard is attached.
 *
 * What is verified on hardware is in `docs/hardware-notes.md`; the rest of each profile is an assumption marked below.
 */

/** A voice picked by bank select and program change (program sent 0-based). */
export interface KeyboardVoice {
  msb: number;
  lsb: number;
  program: number;
}

export interface KeyboardProfile {
  readonly id: 'ez-220' | 'ydp-166' | 'unknown';
  /** True when a note the computer sends on channel 1 may light a key, which would give the answer away (AX-0). */
  readonly lightsKeys: boolean;
  /** The channel (0-based, the low nibble of a status byte) the game's own notes go out on. */
  readonly soundChannel: number;
  /** The voice to pick before the first note, or null to keep the one chosen on the keyboard's panel. */
  readonly voice: KeyboardVoice | null;
}

/**
 * Yamaha EZ-220. Port "Digital Keyboard" on Windows (verified). Channel 1 lights keys (verified), so the game's notes go on
 * channel 2; Grand Piano 1 is bank 0/112, program 1 per Yamaha's manual (`docs/hardware/ez-220-reference.md`), unverified.
 */
export const EZ220_PROFILE: KeyboardProfile = { id: 'ez-220', lightsKeys: true, soundChannel: 1, voice: { msb: 0, lsb: 112, program: 0 } };

/**
 * Yamaha YDP-166 (Arius), 88 keys, no key lights. Assumptions until a person runs the spike on it: the port is named like
 * Yamaha's other digital pianos ("Digital Piano") or carries the model; channel 1 plays the panel's voice. No voice is sent,
 * because its bank numbers are not checked against its MIDI reference: whatever voice is set on the panel plays.
 */
export const YDP166_PROFILE: KeyboardProfile = { id: 'ydp-166', lightsKeys: false, soundChannel: 0, voice: null };

/** Any other keyboard: it may light keys, so channel 2; no voice is sent, since its bank numbers are unknown. */
export const UNKNOWN_PROFILE: KeyboardProfile = { id: 'unknown', lightsKeys: true, soundChannel: 1, voice: null };

const BY_NAME: readonly [RegExp, KeyboardProfile][] = [
  [/EZ-?220|^Digital Keyboard/i, EZ220_PROFILE],
  [/YDP-?166|^Digital Piano/i, YDP166_PROFILE],
];

/** The profile of the keyboard whose port has this name; `UNKNOWN_PROFILE` for any other or no name. */
export function profileOfPort(name: string | null | undefined): KeyboardProfile {
  const port = name ?? '';
  return BY_NAME.find(([pattern]) => pattern.test(port))?.[1] ?? UNKNOWN_PROFILE;
}

/** Ports the automatic choice prefers over others: a keyboard Pianor knows. */
export const KNOWN_KEYBOARD_NAME = /EZ-?220|YDP-?166|^Digital (Keyboard|Piano)|Yamaha/i;
