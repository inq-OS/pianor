import { fitMap, type MapView, type World, type WorldPoint } from '../world/world';
import { caricature, type MapShape, type MapWorld } from './keriMapShape';
import { ART_DETAIL } from './frame';
import type { Rect } from './rect';

/**
 * The map of Keri as a painted picture (ft_1_18.AC2, d111): the island seen at a tilt in its sea, its painted name in the
 * lower left corner and a compass rose in the upper right, where the island (which lies north-west to south-east) leaves
 * the sea free. Pure numbers; the painting is `game/ui/pixel/keri/mapPicture.ts`.
 *
 * The map draws a caricature of the island (`MAP_SHAPE`, d125): fatter than measured and turned a little, so that it
 * fills the picture and its places can be drawn large. `plan.view` is a view of that drawn island, in map metres; a
 * point of the measured island goes through `plan.at`.
 *
 * The picture is larger than the smallest main area: every screen shows its middle, and a larger window more sea round it.
 * All rectangles here are in fine pixels of the picture unless they say cells.
 */

/** The picture's size in layout cells, and its middle that every screen shows (the main area of the target screen, d110). */
export const MAP_PICTURE = { w: 400, h: 202 } as const;
export const MAP_MIDDLE = { w: 320, h: 157 } as const;
/** How much shorter north-south is drawn than east-west: the island is seen at a slant from the south. */
export const MAP_TILT = 0.6;
/** Buildings and the lighthouse are drawn this many times their height, as on an illustrated map, so they read as landmarks. */
export const LANDMARK = 1.6;
/**
 * How the map's island differs from the measured one (the fat Keri, d125): 1.45 times
 * as wide across its short side and turned 8 degrees, so the long side lies flatter and the island fills the picture
 * as the islands of the 1991 maps do. The rest are adjustments made on the passes seen.
 */
export const MAP_SHAPE: MapShape = {
  fat: 1.45,
  tail: { from: 0, by: 1 },
  // the western tip runs out to a point (sharper, as the lines drawn on the pass
  // show): a wedge from where the southern line leaves the shore
  tip: { from: -123, sharp: 0.08 },
  turn: 8,
  swells: [],
  // the houses are drawn about twice their ground plan: so that none sits on another, the ones round the lighthouse,
  // round the warden's house and the power station stand further apart (spread them out)
  spreads: [
    { x: 0, y: 0, radius: 105, gain: 1.8 },
    { x: -116, y: 46, radius: 70, gain: 1.6 },
    { x: -128, y: 82, radius: 45, gain: 1.9 },
  ],
  // the map's own places (the power plant, the mast, the sauna and the helipad): the measured point under each. The
  // sauna stands well away from the well house; the helipad inside the tip's wedge; the well alone on its own side of
  // the fork, south of the way from the house, as measured; the memorial closer to the lighthouse than to the
  // crossroads; the northern dock over the east end of the house, as on the orthophoto
  moves: [
    { id: 'north-shed', x: -185.9, y: 87.4 },
    { id: 'mast', x: -165.2, y: 74.3 },
    { id: 'hut-middle', x: -44, y: 60.1 },
    { id: 'helipad', x: -232.1, y: 108 },
    { id: 'hut-west', x: -85.6, y: 31.1, hold: 0 },
    { id: 'memorial', x: -30.2, y: 18.6, hold: 0 },
    { id: 'docks', x: -109.2, y: 102.1, hold: 0 },
  ],
  lines: [
    // the lighthouse is drawn so large that the measured ways round it ran under it and round it (the paths
    // there made no sense, one went round the tower): the way from the west comes to the tower's foot and goes on down to the wood shed, the way to the houses in the east
    // leaves it at the foot and runs before their doors
    { id: 'track-to-lighthouse', keep: 6, points: [[-21, -3.6], [-9, -9.7], [-0.7, -15.9], [1.6, -28.4], [4, -41]] },
    { id: 'track-east-house', points: [[-0.7, -15.9], [13.5, -22.6], [30, -27.8], [44.2, -28.5]] },
    // the green line: the southern port leads towards the lighthouse, not to the small hut; its
    // head is on the way before the houses
    { id: 'slipway', points: [[29.2, -27.7], [39.5, -92]] },
    // the boat slip goes with the northern dock it leads to
    { id: 'boat-slip-north', points: [[-112.7, 67], [-107.7, 78.4], [-108.3, 90.9], [-112.3, 99]] },
  ],
};
/** The lighthouse is drawn this many times its height: the island's mark, grand on every picture that shows it. */
export const LIGHTHOUSE_DRAWN = 3.3;
/** Keri lighthouse is 31 m high (docs/keri.md). */
export const LIGHTHOUSE_METRES = 31;
/** The house's and the scenes' buttons, in cells: larger than their pictures, so a student's tap finds them. */
const HOUSE_HIT = 16;
const SCENE_HIT = 15;

export interface KeriMapPlan {
  /** The island as the map draws it, and how far north has turned on it. */
  map: MapWorld;
  /** A view of the drawn island: its points are in map metres (`map.world`). */
  view: MapView;
  /** Where a point of the measured island is in the picture; `up` its height over the ground in metres. */
  at(p: WorldPoint, up?: number): { x: number; y: number };
  /** The picture's size and its always-shown middle, in fine pixels. */
  fine: { w: number; h: number };
  middle: Rect;
  /** Where the island lies, its painted name and the compass rose. */
  island: Rect;
  /** The sand strip off the south-east end, drawn under water. */
  sand: SandStrip;
  title: Rect;
  compass: Rect;
  /** The warden's house's button, in layout cells from the picture's top-left corner. */
  house: Rect;
  /** A button for every scene (ft_1_19.AC2), in cells as the others, round the scene's place; `level` is the student's level that opens it. */
  scenes: { id: string; level: number; at: Rect }[];
}

const fineRect = (cells: { w: number; h: number }): { w: number; h: number } => ({ w: cells.w * ART_DETAIL, h: cells.h * ART_DETAIL });

/** A square of `size` cells round a fine-pixel point. */
function hit(at: { x: number; y: number }, size: number): Rect {
  return { x: Math.round(at.x / ART_DETAIL - size / 2), y: Math.round(at.y / ART_DETAIL - size / 2), w: size, h: size };
}

/**
 * The sand strip off Keri's south-east end: a long strip of sand that constantly changes its
 * shape by waves and wind, sometimes goes under water and then reappears. The world model's coast has its root as land
 * (what lies south of `SAND_ROOT.y` there, as the orthophoto caught it); the map draws all of it under water and lets
 * it run on, bending, through the sea below the island. Its course is the map's own: the real one changes with the
 * weather. Metres east and north of the lighthouse.
 */
export const SAND_ROOT = { x: 88, y: -92, west: 60, east: 120, end: { x: 104, y: -150 } } as const;
/**
 * The strip's course past the root's end, in fine pixels right and down from it, and its half width there: out from
 * the island, then round in a hook under the south-east shore, broadening to a blunt end (the creature's head).
 */
const SAND_COURSE: readonly (readonly [number, number, number])[] = [[0, 0, 7], [6, 12, 7.5], [4, 24, 8.5], [-8, 33, 9.5], [-28, 37, 11], [-52, 36, 12.5], [-78, 31, 14], [-100, 24, 14.5], [-116, 17, 12]];

export interface SandStrip {
  /** A line across the island's south-east end, in fine pixels: the land beyond it, on `beyond`'s side, is the strip's root. */
  cut: readonly [{ x: number; y: number }, { x: number; y: number }];
  beyond: { x: number; y: number };
  /** The strip's middle line from the land to its far end, in fine pixels, with its half width at each point. */
  spine: { x: number; y: number; half: number }[];
}

/** Whether a fine pixel lies beyond the strip's cut: what the measured coast has there is sand under water on the map, no land. */
export function beyondCut(sand: SandStrip, x: number, y: number): boolean {
  const [a, b] = sand.cut;
  const side = (px: number, py: number): number => Math.sign((b.x - a.x) * (py - a.y) - (b.y - a.y) * (px - a.x));
  return side(x, y) === side(sand.beyond.x, sand.beyond.y);
}

function sandStrip(map: MapWorld, view: MapView, middle: Rect): SandStrip {
  const on = (x: number, y: number): { x: number; y: number } => view.toScreen(map.ground({ x, y }));
  const root = on(SAND_ROOT.x, SAND_ROOT.y), end = on(SAND_ROOT.end.x, SAND_ROOT.end.y);
  const spine = [{ ...root, half: 11 }, ...SAND_COURSE.map(([dx, dy, half]) => ({ x: end.x + dx, y: end.y + dy, half }))];
  // it stays in the part of the picture every screen shows
  const lowest = Math.max(...spine.map((p) => p.y + p.half)), over = Math.max(0, lowest - (middle.y + middle.h - 6));
  return { cut: [on(SAND_ROOT.west, SAND_ROOT.y), on(SAND_ROOT.east, SAND_ROOT.y)], beyond: end, spine: spine.map((p, i) => ({ ...p, y: p.y - (over * i) / (spine.length - 1) })) };
}

export function keriMapPlan(world: World): KeriMapPlan {
  const fine = fineRect(MAP_PICTURE);
  const mid = fineRect(MAP_MIDDLE);
  const middle: Rect = { x: (fine.w - mid.w) / 2, y: (fine.h - mid.h) / 2, ...mid };
  // the island fills the middle but for a rim of sea, lower on the screen than its middle: the lighthouse rises
  // above the ground. Large, so that places on it can be told apart and pointed at.
  // as high in the picture as its tower allows (everything as far up as possible), so
  // that the sand strip off the south-east end has the sea below the island to lie in
  const island: Rect = { x: middle.x + 26, y: middle.y + 34, w: 590, h: 226 };
  const map = caricature(world, MAP_SHAPE);
  const view = fitMap(map.world, island, 0, MAP_TILT);
  const house = map.world.buildings.find((b) => b.id === 'warden-house') ?? map.world.places.livingRoom;
  return {
    map,
    view,
    at: (p, up) => view.toScreen(map.place(p), up),
    fine,
    middle,
    island,
    title: { x: middle.x + 8, y: middle.y + 200, w: 180, h: 94 },
    compass: { x: middle.x + 578, y: middle.y + 4, w: 58, h: 76 },
    house: hit(view.toScreen(house, 3), HOUSE_HIT),
    sand: sandStrip(map, view, middle),
    scenes: (map.world.scenes ?? []).map((scene) => ({ id: scene.id, level: scene.level, at: hit(view.toScreen(scene, 2), SCENE_HIT) })),
  };
}

/**
 * Which part of the picture a main area of `screen` cells shows, in fine pixels of the picture (`crop`), and where that
 * part goes on the main area (`at`, fine pixels): the picture's middle on the screen's middle.
 */
export function keriMapView(screen: { w: number; h: number }): { crop: Rect; at: { x: number; y: number } } {
  const fine = fineRect(MAP_PICTURE);
  const have = fineRect(screen);
  const w = Math.min(fine.w, have.w), h = Math.min(fine.h, have.h);
  return {
    crop: { x: Math.floor((fine.w - w) / 2), y: Math.floor((fine.h - h) / 2), w, h },
    at: { x: Math.floor((have.w - w) / 2), y: Math.floor((have.h - h) / 2) },
  };
}
