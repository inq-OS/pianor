import { C, PALETTE } from '../palette';
import { sceneLook, type SceneLook } from '../../../../core/sky/sceneLook';
import type { SkyPhase } from '../../../../core/sky/skyPhase';
import type { Wind } from '../../../../core/sky/wind';
import { KERI } from '../../../../core/sky/skyPhase';

/**
 * The phase colours of the sky (ft_1_14 scope item 4, d097), first made for the old campaign trail and now the base of the
 * painted room's palette. Pixel art is palette indexes; a phase
 * replaces the colours of the sky, cloud, moon and halo slots, dark to light, and leaves every other colour alone. The
 * night phase is the base palette. Table values are the mock colours of the feature file (AX-3 provisional).
 */

interface PhaseSlots {
  readonly sky: readonly number[];
  readonly cloud: readonly number[];
  readonly moon: readonly number[];
  readonly halo: readonly number[];
}

const DAWN: PhaseSlots = {
  sky: [0x1e2a5a, 0x3a4a80, 0x8a7aa8, 0xf0b8a8],
  cloud: [0x2a3060, 0x5a6090, 0xa090b8, 0xe8c0d0, 0xfff0f0],
  moon: [0xf0a070, 0xffd0a0, 0xfff0d0],
  halo: [0x9a7aa8, 0xb896b4, 0xd8b4bc],
};

const DAY: PhaseSlots = {
  sky: [0x3a7fd0, 0x5a9de0, 0x86c0ee, 0xb8def8],
  cloud: [0x4a6a9a, 0x9ab0d0, 0xcfdcec, 0xeef4fb, 0xffffff],
  moon: [0xe8a820, 0xffd040, 0xfff0a0],
  halo: [0x6aa8e6, 0x8cbcee, 0xb0d4f4],
};

const DUSK: PhaseSlots = {
  sky: [0x1a1840, 0x3a2458, 0x7a3a5e, 0xe0704a],
  cloud: [0x2a1838, 0x52304e, 0x8e4a5e, 0xd8786a, 0xf4b08a],
  moon: [0xc2402a, 0xe8642e, 0xffa050],
  halo: [0x8a3a5a, 0xa8485a, 0xc45a58],
};

/** Writes one slot run of the palette, starting at palette index `start`. */
function place(palette: number[], start: number, colours: readonly number[]): void {
  colours.forEach((rgb, i) => {
    palette[start + i] = rgb;
  });
}

function paletteWith(slots: PhaseSlots): readonly number[] {
  const palette = [...PALETTE];
  place(palette, C.skyDeep, slots.sky);
  place(palette, C.cloudInk, slots.cloud);
  place(palette, C.moonDark, slots.moon);
  place(palette, C.haloDark, slots.halo);
  return palette;
}

const PALETTES: Readonly<Record<SkyPhase, readonly number[]>> = {
  night: PALETTE,
  dawn: paletteWith(DAWN),
  day: paletteWith(DAY),
  dusk: paletteWith(DUSK),
};

/** The palette of pixel art in this phase (`toRgba(bitmap, paletteFor(phase))`). */
export function paletteFor(phase: SkyPhase): readonly number[] {
  return PALETTES[phase];
}

/**
 * The look for this page load: the phase at `instant` (the PC clock by default), or the dev switch `?sky=` when given.
 * Decided once, when a picture of Keri (the room, the map, a scene) opens (ft_1_14 scope item 6).
 */
export function currentLook(instant: number = Date.now(), forcedPhase: SkyPhase | null = null, forcedWind: Wind | null = null): SceneLook {
  return sceneLook(instant, KERI, forcedPhase, forcedWind);
}
