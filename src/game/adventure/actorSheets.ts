import type { ActorDef, ActorState } from '../../core/scene/actor';
import type { SkyPhase } from '../../core/sky/skyPhase';
import type { Bitmap } from '../ui/pixel/bitmap';
import type { RgbaArt } from '../ui/pixel/PixelObjects';
import { figureFrames } from '../ui/pixel/actors/figure';
import { KIUR_MOODS } from '../ui/pixel/kiur/kiurFrames';
import { puuvaimFrames } from '../ui/pixel/keri/puuvaim';

/**
 * The hand-made figures' frames by sheet id and state (contract A.4, `ActorDef.sheet`), on the fine grid (d110), facing
 * right. A sheet that is not here, or a state it lacks, is drawn as the actor's labelled box (d137), so code never
 * waits for the painter.
 */
const SHEETS: Readonly<Record<string, Partial<Record<ActorState, readonly Bitmap[]>>>> = {
  // Kiur (d114): at rest; talking, his bill opening to sing and closing
  kiur: { idle: [KIUR_MOODS.idle], talk: [KIUR_MOODS.idle, KIUR_MOODS.cheer] },
};

/**
 * The hand-made figures that are part of a painted picture and so lit by its hour, by sheet id: Puuvaim's face in the
 * knoll's tree (WP-11), painted with the picture's own strokes and palette (`keri/puuvaim.ts`).
 */
const LIT_SHEETS: Readonly<Record<string, (state: ActorState, hour: SkyPhase) => readonly RgbaArt[] | null>> = {
  puuvaim: puuvaimFrames,
};

/** The frames of `state` on sheet `sheet`, or null when the game has no such sheet or state. */
export function sheetFrames(sheet: string | undefined, state: ActorState): readonly Bitmap[] | null {
  if (sheet === undefined) return null;
  return SHEETS[sheet]?.[state] ?? null;
}

/** The template character's frames, cast once per actor, state and hour: casting a person takes a few milliseconds. */
const cast = new Map<string, readonly RgbaArt[]>();

/**
 * The frames an actor shows in `state` at `hour`, on the fine grid and facing right: its sheet's, or the template
 * character's cast from its features (d142, `figureFrames`), lit by the hour as the pictures are. Null when the game has no
 * art for it, and the actor is drawn as its labelled box.
 */
export function actorFrames(actor: ActorDef, state: ActorState, hour: SkyPhase): readonly (Bitmap | RgbaArt)[] | null {
  if (actor.template === undefined) {
    const lit = actor.sheet !== undefined ? LIT_SHEETS[actor.sheet] : undefined;
    return lit ? lit(state, hour) : sheetFrames(actor.sheet, state);
  }
  const key = `${actor.id}:${state}:${hour}`;
  let frames = cast.get(key);
  if (frames === undefined) {
    frames = figureFrames(actor.template.features, state, { hour }).map((f) => ({ width: f.w, height: f.h, rgba: f.rgba }));
    cast.set(key, frames);
  }
  return frames;
}
