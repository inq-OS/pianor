import { skyPhaseAt, KERI, type SkyOptions, type SkyPhase } from './skyPhase';
import { windOfDay, type Wind } from './wind';

/**
 * Everything that changes how a scene and the room's window look, resolved in one place (d097). The scene reads
 * only this object: the seasons, weather and holidays of ft_Y_14 fill the null and empty slots later without rewiring.
 */
export interface SceneLook {
  readonly phase: SkyPhase;
  readonly season: null;
  readonly weather: null;
  /** How hard the wind blows: the sea, clouds, trees, grass and scarf all read this one number. */
  readonly wind: Wind;
  readonly holidays: readonly string[];
}

/**
 * The look at `instant`; `forcedPhase` (the dev switch `?sky=`) replaces the computed phase when given, `forcedWind`
 * (`?wind=`) the day's wind.
 */
export function sceneLook(instant: number, options: SkyOptions = KERI, forcedPhase: SkyPhase | null = null, forcedWind: Wind | null = null): SceneLook {
  return { phase: forcedPhase ?? skyPhaseAt(instant, options), season: null, weather: null, wind: forcedWind ?? windOfDay(instant), holidays: [] };
}
