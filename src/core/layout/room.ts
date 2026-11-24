import { ART_DETAIL } from './frame';
import type { Rect } from './rect';

/**
 * The warden's living room on Keri (ft_1_18.AC3) as a plan in metres, and the camera that looks at it. The picture is a
 * projection of this plan, never placed by hand (d108), painted by `game/ui/pixel/keri/roomPaint.ts`; this module gives the
 * picture its place on the screen and the buttons their boxes.
 *
 * The room is a stage set in the manner of the painted adventure rooms of the art direction: the viewer stands
 * inside it and looks south, the side walls open toward the viewer so both show, and the lens bends level lines a little.
 * Axes: `x` to the right (west), 0 in the middle of the back wall; `y` up from the floor; `z` from the back (south) wall
 * toward the viewer.
 */

/** The room's objects that are buttons (ft_1_08.AC7), in the order of the scene's buttons: the piano first. */
export const ROOM_OBJECTS = ['piano', 'door', 'easel'] as const;
export type RoomObject = (typeof ROOM_OBJECTS)[number];
/**
 * Everything in the room a press reaches: the objects, which wake into a second look under the pointer (ft_1_20.AC15), and
 * the rank shield (the player's card, ft_1_20.AC13), which gets a contour (ft_1_20.AC14). The window is no button since the
 * walk went (d117).
 */
export const ROOM_PRESSABLES = [...ROOM_OBJECTS, 'shield'] as const;

export type WallName = 'back' | 'left' | 'right';

/** A piece of a wall: from `a0` to `a1` along it (metres from the back corner on a side wall, `x` on the back wall) and from `y0` up to `y1`. */
export interface WallPiece {
  readonly a0: number;
  readonly a1: number;
  readonly y0: number;
  readonly y1: number;
}

/** A thing on the floor as a box: its middle, its width and depth, from `y0` up to `y1`, turned by `turn` degrees (seen from above, anticlockwise). */
export interface Block {
  readonly x: number;
  readonly z: number;
  readonly w: number;
  readonly d: number;
  readonly y0: number;
  readonly y1: number;
  readonly turn: number;
}

/**
 * How a thing leans, as a hand draws it: round `at` (its foot, which stays), `x` and `z` metres to the right and toward
 * the viewer for each metre it rises, `tilt` metres up for each metre to the right, and `fat` and `tall` times as wide
 * and as high as it was made.
 */
export interface Lean {
  readonly at: readonly [number, number, number];
  readonly x?: number;
  readonly z?: number;
  readonly tilt?: number;
  readonly fat?: number;
  readonly tall?: number;
}

/** A lean as the nine numbers that move a point measured from the thing's foot, row by row. */
export type LeanMatrix = readonly [number, number, number, number, number, number, number, number, number];

export function leanMatrix(l: Lean): LeanMatrix {
  const fat = l.fat ?? 1;
  return [fat, l.x ?? 0, 0, l.tilt ?? 0, l.tall ?? 1, 0, 0, l.z ?? 0, fat];
}

/** Where a point of a thing as it was made stands once the thing leans. */
export function leantPoint(l: Lean, p: { x: number; y: number; z: number }): { x: number; y: number; z: number } {
  const m = leanMatrix(l), x = p.x - l.at[0], y = p.y - l.at[1], z = p.z - l.at[2];
  return { x: l.at[0] + m[0] * x + m[1] * y + m[2] * z, y: l.at[1] + m[3] * x + m[4] * y + m[5] * z, z: l.at[2] + m[6] * x + m[7] * y + m[8] * z };
}

const PIANO: Block = { x: 0, z: 0.36, w: 1.4, d: 0.62, y0: 0, y1: 1.12, turn: 0 };
const EASEL: Block = { x: 1.27, z: 0.62, w: 0.74, d: 0.5, y0: 0, y1: 1.5, turn: -12 };
const CHEST: Block = { x: -2.72, z: 1.12, w: 0.5, d: 0.86, y0: 0, y1: 0.7, turn: -18 };

/**
 * The plan (from the reference photographs and marks, docs/keri.md section 5): the piano between the two sea windows of the
 * back wall with the portrait and the rank shield over it, the desk with its blue lamp under the left sea window; in the left
 * wall the window toward the lighthouse, then the framed lighthouse photographs over the bed's head; by the right wall the
 * iron stove before its bricks, then the door.
 */
export const ROOM = {
  /** Half the back wall's width, the room's height, and how far the side walls run toward the viewer. */
  half: 2.7,
  height: 2.4,
  depth: 7,
  /** The side walls open toward the viewer by this many degrees, as a stage set's do. */
  splay: 18,
  /** How thick the outer walls are: the depth of a window's niche. */
  wall: 0.32,
  windowLeft: { a0: -2.1, a1: -1.15, y0: 0.85, y1: 2.02 } as WallPiece,
  windowRight: { a0: 1.15, a1: 2.1, y0: 0.85, y1: 2.02 } as WallPiece,
  /** In the left (east) wall, toward the lighthouse. */
  windowSide: { a0: 0.62, a1: 1.5, y0: 0.9, y1: 2.0 } as WallPiece,
  /** In the right wall: the bricks behind the stove from the corner to `a1`, then the door. */
  bricks: { a0: 0, a1: 1.55, y0: 0, y1: 2.4 } as WallPiece,
  door: { a0: 1.82, a1: 2.66, y0: 0, y1: 1.98 } as WallPiece,
  /** The old wall telephone (ft_1_34): on the bricks of the right wall, beside the stove's pipe, at a child's reach. */
  phone: { a0: 1.3, a1: 1.5, y0: 1.15, y1: 1.55 } as WallPiece,
  piano: PIANO,
  /** The note-name board on its easel, beside the piano and turned a little toward the viewer. */
  easel: EASEL,
  /**
   * A chest under the lighthouse window with a spyglass on it, no button: the gramophone that stood here is gone,
   * and the ear trainer opens from the stand (ft_1_08.AC11).
   */
  chest: CHEST,
  /**
   * How the openings lean, as nothing in a drawn room is plumb: metres along the wall for each metre a window or the
   * door rises. The set and the holes in its walls are built from these.
   */
  lean: { windowLeft: -0.075, windowRight: 0.06, windowSide: 0.08, door: 0.035 },
  /**
   * How the things that are buttons lean (`Lean`), each its own way (the rooms of the 1991 game:
   * quirk, not realism). The set builds them so and a button's box is laid round the thing as it leans.
   */
  leans: {
    piano: { at: [PIANO.x, 0, PIANO.z], x: -0.065, tilt: 0.045, fat: 1.03 },
    easel: { at: [EASEL.x, 0, EASEL.z], x: 0.085, tilt: -0.03 },
    chest: { at: [CHEST.x, 0, CHEST.z], x: 0.06, tilt: 0.03, fat: 1.08 },
  } as { readonly piano: Lean; readonly easel: Lean; readonly chest: Lean },
  /** What hangs over the piano: the portrait's and the shield's middle on the back wall. */
  portrait: { x: -0.3, y: 1.75 },
  shield: { x: 0.52, y: 1.86 },
} as const;

const RAD = Math.PI / 180;

/** Where a wall starts (at the back corner; the back wall at its middle), the way it runs, and the way into the room from it. */
export function wallFrame(name: WallName): { x: number; z: number; ax: number; az: number; nx: number; nz: number } {
  const sin = Math.sin(ROOM.splay * RAD), cos = Math.cos(ROOM.splay * RAD);
  if (name === 'back') return { x: 0, z: 0, ax: 1, az: 0, nx: 0, nz: 1 };
  if (name === 'left') return { x: -ROOM.half, z: 0, ax: -sin, az: cos, nx: cos, nz: sin };
  return { x: ROOM.half, z: 0, ax: sin, az: cos, nx: -cos, nz: sin };
}

/** The point `a` metres along a wall and `off` metres into the room from it. */
export function onWall(name: WallName, a: number, off = 0): { x: number; z: number } {
  const w = wallFrame(name);
  return { x: w.x + w.ax * a + w.nx * off, z: w.z + w.az * a + w.nz * off };
}

/**
 * The camera: where the eye is, which way it is turned (`yaw`, radians, to the right), and a lens that maps the angle
 * round the eye evenly across the picture (`f` fine pixels per radian) with uprights kept upright. Such a lens shows both side
 * walls without stretching them, and it draws a level line as a gentle bow: no ruler-straight ceiling or floor edge.
 * (`cx`, `cy`) is where the eye looks, on the horizon, in fine pixels of the picture.
 */
export interface RoomCamera {
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly yaw: number;
  readonly f: number;
  readonly cx: number;
  readonly cy: number;
  /** The bend a hand gives the view (`BEND`), and the picture's middle row and half its height, which it is measured from. */
  readonly bend: { readonly fan: number; readonly bow: number; readonly mid: number; readonly half: number };
}

/** The eye: a little right of the middle and turned a little left, so the room is not seen square on. */
const EYE = { x: 0.22, y: 1.5, z: 5.4, yaw: -0.035 } as const;
/** Fine pixels per radian: about 68 fine pixels per metre in the middle of the back wall, so a portrait of 66 pixels hangs over the piano. */
const LENS = 367;
/**
 * The picture's size in layout cells: the whole width of the target screen and a low band of its height (d110), the same
 * on every screen, as a painted background is. A larger main area shows night round it.
 */
export const ROOM_PICTURE = { w: 320, h: 124 } as const;
/** The horizon's row in the picture, in fine pixels. */
const HORIZON = 71;

/**
 * How far the view is bent, in fine pixels at the picture's corners, as the rooms of the 1991 game are drawn
 * (not realistic, with quirk): what stands up fans out toward the top (`fan`), and level
 * lines arch, high in the middle and drawn in at the corners (`bow`). An even lens draws a room as a camera sees it;
 * this is the hand's lean on top of it.
 */
export const BEND = { fan: 13, bow: 9 } as const;

/** The room's camera. The picture is painted once for it when the game is built (`tools/vite-keri.ts`). */
export function roomCamera(): RoomCamera {
  const half = (ROOM_PICTURE.h * ART_DETAIL) / 2;
  return { ...EYE, f: LENS, cx: (ROOM_PICTURE.w * ART_DETAIL) / 2, cy: HORIZON, bend: { ...BEND, mid: half, half } };
}

/** Where the even lens shows what the bent view shows at the pixel (px, py). */
function unbent(camera: RoomCamera, px: number, py: number): { x: number; y: number } {
  const u = (px - camera.cx) / camera.cx, v = (py - camera.bend.mid) / camera.bend.half;
  return { x: px + camera.bend.fan * u * v, y: py + camera.bend.bow * v * u * u };
}

/** Where a point of the room lands on the picture, in fine pixels, and the picture's scale there (fine pixels per metre). */
export function projectPoint(camera: RoomCamera, x: number, y: number, z: number): { x: number; y: number; scale: number } {
  const dx = x - camera.x, dz = camera.z - z;
  const scale = camera.f / Math.hypot(dx, dz);
  const even = { x: camera.cx + camera.f * (Math.atan2(dx, dz) - camera.yaw), y: camera.cy - (y - camera.y) * scale };
  // the bend is gentle, so its way back is found in a few steps
  let p = even;
  for (let step = 0; step < 5; step++) {
    const at = unbent(camera, p.x, p.y);
    p = { x: p.x + even.x - at.x, y: p.y + even.y - at.y };
  }
  return { ...p, scale };
}

/** The way a pixel of the picture looks from the eye: a direction whose level length is 1, so a point `t` along it is `t` metres away on the plan. */
export function lookThrough(camera: RoomCamera, px: number, py: number): { x: number; y: number; z: number } {
  const even = unbent(camera, px, py);
  const angle = (even.x - camera.cx) / camera.f + camera.yaw;
  return { x: Math.sin(angle), y: -(even.y - camera.cy) / camera.f, z: -Math.cos(angle) };
}

type Point = readonly [number, number, number];

/** The corners of a floor box, where they stand when the box leans by `lean`. */
export function blockCorners(b: Block, lean?: Lean): Point[] {
  const cos = Math.cos(b.turn * RAD), sin = Math.sin(b.turn * RAD);
  const out: Point[] = [];
  for (const sx of [-0.5, 0.5]) for (const sz of [-0.5, 0.5]) for (const y of [b.y0, b.y1]) {
    const made = { x: b.x + sx * b.w * cos + sz * b.d * sin, y, z: b.z - sx * b.w * sin + sz * b.d * cos };
    const p = lean ? leantPoint(lean, made) : made;
    out.push([p.x, p.y, p.z]);
  }
  return out;
}

/** The corners of a piece of a wall, which leans `lean` metres along the wall for each metre it rises. */
export function pieceCorners(wall: WallName, p: WallPiece, lean = 0): Point[] {
  return [p.a0, p.a1].flatMap((a) => [p.y0, p.y1].map((y): Point => {
    const at = onWall(wall, a + lean * (y - p.y0));
    return [at.x, y, at.z];
  }));
}

/** The smallest rectangle of fine pixels round the picture of `points`. */
export function projectBounds(camera: RoomCamera, points: readonly Point[]): Rect {
  let left = Infinity, top = Infinity, right = -Infinity, bottom = -Infinity;
  for (const [x, y, z] of points) {
    const p = projectPoint(camera, x, y, z);
    left = Math.min(left, p.x); right = Math.max(right, p.x); top = Math.min(top, p.y); bottom = Math.max(bottom, p.y);
  }
  return { x: Math.floor(left), y: Math.floor(top), w: Math.ceil(right) - Math.floor(left), h: Math.ceil(bottom) - Math.floor(top) };
}

/** A rectangle of fine pixels as the layout cells that hold it (d110), kept inside `area`. */
function toCells(fine: Rect, area: Rect): Rect {
  const x0 = Math.max(area.x, Math.floor(fine.x / ART_DETAIL)), y0 = Math.max(area.y, Math.floor(fine.y / ART_DETAIL));
  const x1 = Math.min(area.x + area.w, Math.ceil((fine.x + fine.w) / ART_DETAIL)), y1 = Math.min(area.y + area.h, Math.ceil((fine.y + fine.h) / ART_DETAIL));
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
}

/** The largest portrait the wall holds over the piano (the private one, ft_1_08.AC10, d110), and the shield's size, in fine pixels. */
export const PORTRAIT_MAX = { w: 66, h: 80 } as const;
export const SHIELD_FINE = 48;
/** Fine pixels of wall kept between the portrait and the shield. */
const HUNG_GAP = 5;
/** The focus ring reaches two cells past a button; a button stays this far inside the picture so its ring shows whole. */
const RING = 2;
/**
 * Rows of layout cells kept free under the picture: the place of the verb buttons and the inventory
 * of a point-and-click interface, when that is built. A lower, wider picture also keeps the room from looking too high.
 * AX-3 provisional: the strip's height waits for that interface's design.
 */
export const STRIP_ROWS = 33;

export interface RoomPlan {
  camera: RoomCamera;
  /** The picture's size in fine pixels. */
  fine: { w: number; h: number };
  /** Each object's button, in layout cells from the picture's top-left corner. */
  objects: Record<RoomObject, Rect>;
  /** Where the portrait and the rank shield hang on the back wall, in fine pixels of the picture. */
  portrait: Rect;
  shield: Rect;
  /** The telephone on the right wall (ft_1_34): its button in layout cells, as the objects'. */
  phone: Rect;
}

/**
 * The room's picture as planned: the camera, the buttons' boxes and the places of the two pictures over the piano.
 * `portrait` is the portrait's size in fine pixels.
 */
export function roomPlan(portrait: { w: number; h: number } = PORTRAIT_MAX): RoomPlan {
  const camera = roomCamera();
  const inside = { x: RING, y: RING, w: ROOM_PICTURE.w - 2 * RING, h: ROOM_PICTURE.h - 2 * RING };
  const button = (points: readonly Point[]): Rect => toCells(projectBounds(camera, points), inside);
  const hung = (at: { x: number; y: number }, size: { w: number; h: number }): Rect => {
    const p = projectPoint(camera, at.x, at.y, 0);
    return { x: Math.round(p.x - size.w / 2), y: Math.round(p.y - size.h / 2), w: size.w, h: size.h };
  };
  const shield = hung(ROOM.shield, { w: SHIELD_FINE, h: SHIELD_FINE });
  // a wide portrait moves left to stay clear of the shield
  const usual = hung(ROOM.portrait, portrait);
  const picture = { ...usual, x: Math.min(usual.x, shield.x - HUNG_GAP - usual.w) };
  return {
    camera,
    fine: { w: ROOM_PICTURE.w * ART_DETAIL, h: ROOM_PICTURE.h * ART_DETAIL },
    objects: {
      piano: button(blockCorners(ROOM.piano, ROOM.leans.piano)), door: button(pieceCorners('right', ROOM.door, ROOM.lean.door)),
      easel: button(blockCorners(ROOM.easel, ROOM.leans.easel)),
    },
    portrait: picture,
    shield,
    phone: button(pieceCorners('right', ROOM.phone)),
  };
}

/** Where the picture and the strip under it go on a main area of `screen` layout cells: the picture in the middle of the room above the strip.
 * Under the action and inventory band (ft_1_20) the band is the strip, so the scene passes 0 `stripRows`.
 */
export function roomView(screen: { w: number; h: number }, stripRows: number = STRIP_ROWS): { picture: Rect; strip: Rect } {
  return pictureView(ROOM_PICTURE)(screen, stripRows);
}

/**
 * Where a place's picture of `size` layout cells and the strip under it go on a main area: the picture in the middle of the
 * rows above the strip, at the top when it is as high as they are or higher.
 */
export function pictureView(size: { w: number; h: number }): (screen: { w: number; h: number }, stripRows?: number) => { picture: Rect; strip: Rect } {
  return (screen, stripRows = STRIP_ROWS) => {
    const above = screen.h - stripRows;
    return {
      picture: { x: Math.floor((screen.w - size.w) / 2), y: Math.max(0, Math.floor((above - size.h) / 2)), w: size.w, h: size.h },
      strip: { x: 0, y: above, w: screen.w, h: stripRows },
    };
  };
}
