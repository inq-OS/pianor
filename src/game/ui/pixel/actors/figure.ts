import type { ActorState } from '../../../../core/scene/actor';
import type { SkyPhase } from '../../../../core/sky/skyPhase';
import { KERI_HOURS, lit } from '../keri/keriPalette';
import { lookFromFeatures } from './features';
import { BODY_A, BODY_CHILD, castFigure, type Body, type Look } from './figureModel';
import { TEMPLATE_STATES } from './states';

/** MI2's own grid: the figure is sampled on blocks of 2 x 2 fine pixels (d144). */
export const FIGURE_GRID = 2;

/** One frame of a person on the fine grid: RGBA, transparent around it, the feet at `anchor`. */
export interface FigureFrame {
  readonly w: number;
  readonly h: number;
  readonly rgba: Uint8Array;
  readonly anchor: { readonly x: number; readonly y: number };
}

export interface FigureOptions {
  /** The size at a standing place (`StandingPlace.scale`): the figure is drawn at that size, never scaled as a bitmap. */
  readonly scale?: number;
  /** The scene's hour: the figure takes the same light as the picture (d123); a ghost keeps its own glow. */
  readonly hour?: SkyPhase;
  /** The body; by default body A, or the student's for a child (d154). */
  readonly body?: Body;
}

function scaled(body: Body, scale: number): Body {
  if (scale === 1) return body;
  const out = { ...body };
  for (const key of Object.keys(out) as (keyof Body)[]) if (key !== 'headW') out[key] *= scale;
  return out;
}

/** A look from either `ActorDef.template.features` or a look made by hand. */
function asLook(person: Look | Readonly<Record<string, string>>): Look {
  return 'ramps' in person ? (person as Look) : lookFromFeatures(person);
}

/** The frames of a state; a state the person has no frames for (play without an instrument) is idle (A.4). */
export function figureFrames(person: Look | Readonly<Record<string, string>>, state: ActorState, options: FigureOptions = {}): FigureFrame[] {
  const look = asLook(person);
  const body = scaled(options.body ?? (look.child ? BODY_CHILD : BODY_A), options.scale ?? 1);
  const reach = body.upperArm + body.foreArm;
  let poses = TEMPLATE_STATES[state].frames(look, reach);
  if (poses.length === 0) poses = TEMPLATE_STATES.idle.frames(look, reach);
  return poses.map((pose) => {
    const coarse = castFigure(body, look, pose, FIGURE_GRID);
    const frame = doubled(coarse);
    return options.hour && options.hour !== 'day' && !look.ghost ? atHour(frame, options.hour) : frame;
  });
}

/** Every pixel of a figure cast on MI2's grid as a block of 2 x 2 fine pixels. */
function doubled(f: ReturnType<typeof castFigure>): FigureFrame {
  const g = FIGURE_GRID;
  const w = f.w * g;
  const h = f.h * g;
  const rgba = new Uint8Array(w * h * 4);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const from = (Math.floor(y / g) * f.w + Math.floor(x / g)) * 4;
      rgba.set(f.rgba.subarray(from, from + 4), (y * w + x) * 4);
    }
  return { w, h, rgba, anchor: { x: Math.round(f.ox), y: Math.round(f.oy) } };
}

/** A frame under an hour's light, as the painted pictures take it (`lit` in keriPalette.ts). */
function atHour(frame: FigureFrame, hour: SkyPhase): FigureFrame {
  const rgba = frame.rgba.slice();
  const cache = new Map<number, number>();
  for (let i = 0; i < rgba.length; i += 4) {
    if (!rgba[i + 3]) continue;
    const hex = (rgba[i]! << 16) | (rgba[i + 1]! << 8) | rgba[i + 2]!;
    let out = cache.get(hex);
    if (out === undefined) {
      out = lit(hex, KERI_HOURS[hour]);
      cache.set(hex, out);
    }
    rgba[i] = (out >> 16) & 255;
    rgba[i + 1] = (out >> 8) & 255;
    rgba[i + 2] = out & 255;
  }
  return { ...frame, rgba };
}

/** The `ActorDef` numbers of the template at a size: one frame's size, the feet, and each state's frames and rate. */
export function templateActorNumbers(person: Look | Readonly<Record<string, string>>, scale = 1): {
  size: { w: number; h: number };
  anchor: { x: number; y: number };
  states: Record<ActorState, { frames: number; fps: number; loop: boolean }>;
} {
  const look = asLook(person);
  const idle = figureFrames(look, 'idle', { scale })[0]!;
  const states = {} as Record<ActorState, { frames: number; fps: number; loop: boolean }>;
  for (const state of Object.keys(TEMPLATE_STATES) as ActorState[]) {
    const s = TEMPLATE_STATES[state];
    const n = s.frames(look, 1).length;
    states[state] = n > 0 ? { frames: n, fps: s.fps, loop: s.loop } : { frames: TEMPLATE_STATES.idle.frames(look, 1).length, fps: TEMPLATE_STATES.idle.fps, loop: true };
  }
  return { size: { w: idle.w, h: idle.h }, anchor: idle.anchor, states };
}
