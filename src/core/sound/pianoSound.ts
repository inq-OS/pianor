/**
 * Which piano sound a computer plays (ft_0_07.AC3: switchable while the game runs, on the admin
 * pages): `full` is every sample as recorded; `light` is each one cut short and made mono, about a fifth of the memory once
 * unpacked; `keyboard` plays the game's own notes on the attached EZ-220 instead (ft_0_07.AC4), with no samples in memory
 * while it is attached and the full samples when it is not. Kept in the device's admin settings (`admin/adminSettings.ts`). Pure.
 */

export type PianoSoundKind = 'full' | 'light' | 'keyboard';

const ORDER: readonly PianoSoundKind[] = ['full', 'light', 'keyboard'];

/** The sound the admin page's one cycling button goes to next. */
export function nextPianoSound(sound: PianoSoundKind): PianoSoundKind {
  return ORDER[(ORDER.indexOf(sound) + 1) % ORDER.length]!;
}
