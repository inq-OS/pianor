import type { World, WorldPoint } from '../world/world';
import { ART_DETAIL } from './frame';

/**
 * The lantern over Keri: the picture of the main menu (ft_1_07, the first screen), after the reference
 * photograph of the lighthouse's lantern from the air at sunset: the tip of the lighthouse and an overview of the
 * island. The viewer hangs in the air a few metres south-south-east of the lantern, at
 * the height of its glass, and looks north-west past it: the lantern stands in the right of the picture from its
 * gallery to the ball on its dome (in every scene the lighthouse is drawn grand; the lantern stays on the right),
 * and under it the island runs out toward the setting sun: the warden's
 * house with the mast at its gable, the well house, the shingle shores and the boulders in the shallows. The picture
 * fills the whole screen, with no lower section: the players' names hang on a sheet over its left.
 *
 * The island comes from the world model: each pixel under the horizon is a point of the ground (`lanternGround`), and
 * each house stands where it stands (`lanternProject`). Only the lantern itself is the painter's, placed in fine
 * pixels after the photograph. Pure numbers; the painter is `game/ui/pixel/keri/lanternPicture.ts`.
 */
export const LANTERN = {
  /** The way the viewer looks, as a compass bearing in degrees: north-west by west, so the house lies in the middle, clear of the sheet of names on the left, and the lantern right of it. */
  heading: 307,
  /** The eye: this far east and north of the lighthouse (metres), six metres off its lantern. */
  eye: { east: 3, north: -5.2 },
  /** The eye's height over the sea, metres: the height of the lantern's glass (the lighthouse is 31 m high). */
  overSea: 30,
  /** Fine pixels per radian: how wide the picture looks (about 80 degrees). */
  lens: 380,
  /** The horizon's row, in fine pixels: straight, as the 1991 game's are (the docks' bowed one was questioned). */
  horizon: 158,
} as const;

/** The picture is the whole screen, in layout cells: the main menu has no band under it. */
export const LANTERN_PICTURE = { w: 320, h: 180 } as const;

const FINE = { w: LANTERN_PICTURE.w * ART_DETAIL, h: LANTERN_PICTURE.h * ART_DETAIL } as const;

/**
 * The lantern on the picture, in fine pixels, after the reference photograph: its middle column, the row of its
 * gallery's floor, and its parts as shares of the gallery ring's half width. From the floor up: a low iron wall, the
 * glass, a fat cornice, the dome round as a pot lid, the vent's ball with its cap.
 */
export const LANTERN_SHAPE = {
  x: 480,
  floor: 294,
  ring: 100,
  /** Half widths, as shares of the ring's. */
  glassWide: 0.8,
  corniceWide: 0.93,
  domeWide: 0.8,
  /** Heights, as shares of the ring's half width. */
  wall: 0.27,
  glass: 1.24,
  cornice: 0.11,
  dome: 0.65,
  ball: 0.3,
  /** The railing's height over the floor, and how flat the ring looks from the eye's height (its short half axis as a share of the long one). */
  rail: 0.8,
  flat: 0.1,
  /** How far it leans to the right, in fine pixels for each row up from the gallery's floor: no plumb line in the picture's largest thing (art-direction rule 3). */
  lean: 0.05,
} as const;

export interface LanternPlan {
  /** The picture's size in fine pixels. */
  fine: { w: number; h: number };
  /** The horizon's row, in fine pixels. */
  horizon: number;
  /** The lantern, in fine pixels: its middle column, its gallery floor's row, the ring's half width, the top of the ball's cap, and the glass's rows and half width. */
  lantern: { x: number; floor: number; ring: number; top: number; glass: { top: number; bottom: number; half: number } };
  /** Where the light burns in the lens, in fine pixels: its glint by day, its glow at dusk and night. */
  light: { x: number; y: number };
}

export function lanternPlan(): LanternPlan {
  const s = LANTERN_SHAPE, r = s.ring;
  const glassBottom = s.floor - s.wall * r, glassTop = glassBottom - s.glass * r;
  const top = glassTop - (s.cornice + s.dome + s.ball) * r;
  return {
    fine: { ...FINE },
    horizon: LANTERN.horizon,
    lantern: { x: s.x, floor: s.floor, ring: r, top: Math.round(top), glass: { top: Math.round(glassTop), bottom: Math.round(glassBottom), half: Math.round(s.glassWide * r) } },
    light: { x: Math.round(s.x + s.glass * r * 0.53 * s.lean + s.wall * r * s.lean) - 1, y: Math.round(glassTop + s.glass * r * 0.47) },
  };
}

/** Where the viewer's eye is, in the world's metres. */
export function lanternEye(world: World): WorldPoint {
  return { x: world.places.lighthouse.x + LANTERN.eye.east, y: world.places.lighthouse.y + LANTERN.eye.north };
}

const TURN = (LANTERN.heading * Math.PI) / 180;
/** The way the viewer looks and the way to its right, as east and north. */
const AHEAD = { x: Math.sin(TURN), y: Math.cos(TURN) } as const;
const RIGHT = { x: Math.cos(TURN), y: -Math.sin(TURN) } as const;

/**
 * Where a point of the world lands on the picture, `up` metres over the sea: fine pixels, and how far ahead of the eye
 * it is in metres (`far`; under 1 for what is beside or behind the viewer, where the pixel means nothing).
 */
export function lanternProject(eye: WorldPoint, p: WorldPoint, up = 0): { x: number; y: number; far: number } {
  const dx = p.x - eye.x, dy = p.y - eye.y;
  const far = dx * AHEAD.x + dy * AHEAD.y, across = dx * RIGHT.x + dy * RIGHT.y;
  const z = Math.max(1e-6, far);
  return { x: FINE.w / 2 + (LANTERN.lens * across) / z, y: LANTERN.horizon + (LANTERN.lens * (LANTERN.overSea - up)) / z, far };
}

/**
 * The viewer's line of sight through a pixel, `far` metres ahead of the eye: where it is over the world, and how high
 * over the sea (`up`). It goes down from the eye's height and meets the sea's plane where `lanternGround` says; the
 * painter follows it from the eye outward to find the ground that stands higher than the sea.
 */
export function lanternSight(eye: WorldPoint, px: number, py: number, far: number): WorldPoint & { up: number } {
  const across = ((px - FINE.w / 2) * far) / LANTERN.lens;
  return { x: eye.x + AHEAD.x * far + RIGHT.x * across, y: eye.y + AHEAD.y * far + RIGHT.y * across, up: LANTERN.overSea - ((py - LANTERN.horizon) * far) / LANTERN.lens };
}

/** The point of the sea's plane under a pixel, in the world's metres; null on and over the horizon (`lanternProject` undone). */
export function lanternGround(eye: WorldPoint, px: number, py: number): WorldPoint | null {
  if (py <= LANTERN.horizon) return null;
  const { x, y } = lanternSight(eye, px, py, (LANTERN.lens * LANTERN.overSea) / (py - LANTERN.horizon));
  return { x, y };
}
