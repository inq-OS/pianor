import { solarElevation } from './sun';

/**
 * The campaign sky's phase from the sun's height over a place (ft_1_14 scope item 2, d097). Thresholds and the place are
 * options (AX-3 provisional): night below -6 degrees (end of civil twilight), dawn or dusk between, day above +3 degrees.
 */

export type SkyPhase = 'night' | 'dawn' | 'dusk' | 'day';

/** Every phase, in the order of a day: what each painted picture is painted for (`tools/vite-keri.ts`). */
export const SKY_PHASES: readonly SkyPhase[] = ['night', 'dawn', 'day', 'dusk'];

export interface SkyOptions {
  readonly latitude: number;
  readonly longitude: number;
  readonly nightBelow: number;
  readonly dayAbove: number;
}

/** Keri island, at its lighthouse (the world model's origin, `content/world/keri.json`), with the default thresholds. */
export const KERI: SkyOptions = { latitude: 59.698722, longitude: 25.0227421, nightBelow: -6, dayAbove: 3 };

/** One minute: the sun is rising when its height a minute later is higher. */
const DIRECTION_STEP_MS = 60_000;

/** The phase at `instant` (ms since 1970 UTC). The instant alone decides it: the computer's time zone plays no part. */
export function skyPhaseAt(instant: number, options: SkyOptions = KERI): SkyPhase {
  const height = solarElevation(instant, options.latitude, options.longitude);
  if (height < options.nightBelow) return 'night';
  if (height > options.dayAbove) return 'day';
  const later = solarElevation(instant + DIRECTION_STEP_MS, options.latitude, options.longitude);
  return later > height ? 'dawn' : 'dusk';
}
