/**
 * The actors runtime's rules (ft_1_24.AC3, WP-05; d137): which state an actor shows, which frame of it at a time, and where
 * its frame stands so its feet are on a standing place. Pure: the scene (`src/game/adventure/`) draws what these say.
 */
import type { ActorDef, ActorState } from './actor';
import type { StandingPlace } from './scene';

/** The state an actor shows when asked for `state`: `idle` when it has no such state (contract A.4). */
export function actorStateOf(actor: ActorDef, state: ActorState): ActorState {
  return actor.states[state] ? state : 'idle';
}

/**
 * The frame of `state` shown `ms` milliseconds after the state began: the frames at the state's rate, round again when it
 * loops, else held on the last one.
 */
export function actorFrame(actor: ActorDef, state: ActorState, ms: number): number {
  const animation = actor.states[actorStateOf(actor, state)]!;
  const step = Math.floor((Math.max(0, ms) * animation.fps) / 1000);
  return animation.loop ? step % animation.frames : Math.min(step, animation.frames - 1);
}

/** Where an actor's frame goes: its top-left corner in fine pixels, its scale, whether it is mirrored, and its depth (its feet). */
export interface ActorPlacement {
  readonly x: number;
  readonly y: number;
  readonly scale: number;
  readonly mirrored: boolean;
  /** The feet's height: an actor lower on the screen stands in front (z-order by the feet). */
  readonly depth: number;
}

/**
 * Stands `actor` on `place` (fine pixels, in the scene's picture): its anchor (the feet) on the place's point, at the
 * place's scale. Facing left shows the right-facing frames mirrored, so the anchor is mirrored too.
 */
export function placeActor(actor: ActorDef, place: StandingPlace): ActorPlacement {
  const scale = place.scale ?? 1;
  const mirrored = place.facing === 'left';
  const anchorX = mirrored ? actor.size.w - actor.anchor.x : actor.anchor.x;
  return { x: place.x - anchorX * scale, y: place.y - actor.anchor.y * scale, scale, mirrored, depth: place.y };
}
