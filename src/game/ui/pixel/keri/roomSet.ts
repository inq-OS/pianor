import { ROOM, leanMatrix, leantPoint, onWall, wallFrame, type Block, type Lean, type LeanMatrix, type RoomObject, type WallName, type WallPiece } from '../../../../core/layout/room';
import type { SkyPhase } from '../../../../core/sky/skyPhase';
import { bricks, colour, mix, plain, planks, plaster, stripes, tint, wood, type Colour } from '../paint/materials';
import { fbm, hash2, noise2 } from '../paint/noise';
import type { Lamp } from '../paint/painter';
import { Bent, Blob, Box, Cone, Flat, Leant, Scene, type Dab, type Material, type Shape, type Split } from '../paint/trace';
import { smoothstep as step } from '../paint/ease';
import { KERI_HOURS } from './keriPalette';
import { bookBack, bookBoard, bookPages, COVERS, looseSheet, musicRolls, musicStacks, LARGE_HAND, paperRoll, sagging, sheaf, sheetLift, worn, SHEET, type Hang } from './roomPapers';

/**
 * The warden's living room as a set of shapes in metres (ft_1_18.AC3), built from the plan in `core/layout/room.ts` and the
 * reference photographs (docs/keri.md): white plaster, dark boards, the iron stove before its bricks, the bed with the
 * blue-striped cover, the blue-white rug, the desk with the blue lamp, flowered curtains, framed lighthouse photographs.
 * `roomPicture.ts` paints it.
 */

type V3 = readonly [number, number, number];
const RAD = Math.PI / 180;

/** The groups: shapes of one thing get soft lines between them, not the dark outline. */
const G = { shell: 1, piano: 2, bed: 3, stove: 4, desk: 5, chair: 6, door: 7, easel: 8, chest: 9, rug: 10, table: 11, wood: 13, lantern: 14, stool: 15 } as const;
/** The groups of the things that stand nearest the viewer and frame the picture start here. */
export const FOREGROUND = 1000;
/**
 * From this group on, the foreground's paper and books: they stand as near as the chest and the braces, yet are painted
 * in the room's light and their own warm colours, not as dark cool shapes (the 1991 rooms' foreground papers are golden).
 */
export const PAPERS = FOREGROUND + 200;
/** The left sea window's group (ft_1_17.AC1): its frame and sill; its curtains are this plus 100. */
const LEFT_WINDOW = 300;
/**
 * The groups each thing a press in the room reaches is painted in (ft_1_20; when the mouse floats over an
 * actionable element, it should be active): the room draws a contour round them under the pointer. The piano takes its
 * book and its stool.
 */
export const PRESSABLE_GROUPS = {
  piano: [G.piano, G.piano + 100, G.stool],
  door: [G.door],
  easel: [G.easel],
} as const satisfies Record<string, readonly number[]>;

/**
 * Each of the room's objects (`ROOM_OBJECTS`) is painted in two looks (ft_1_20.AC15; the piano lid is
 * normally closed and opens on hover, the door is normally closed and hover opens it): at rest, and awake while the pointer is on
 * it. These are the objects that are awake; one not named is at rest.
 */
export type RoomAwake = Readonly<Partial<Record<RoomObject, boolean>>>;
/** Every object awake: the room is painted so once, and each object's second look is cut from that painting. */
export const ALL_AWAKE: RoomAwake = { piano: true, door: true, easel: true };
/** How far the door swings into the room, in degrees. */
const DOOR_SWING = 80;

const WHITE = colour(0xf2e6cc);
const TRIM = colour(0xe9dcc0);
/** The windows' frames and casings: dark warm wood, so that a window is a thick thing in the wall. */
const WINDOW_WOOD = colour(0x6a3a20);
const FLOOR = colour(0x7a4426);
const DARK_WOOD = colour(0x5a3120);
const HONEY = colour(0xc98848);
const IRON = colour(0x2b2a36);
const BRICK = colour(0xb8502e);
const MORTAR = colour(0xb8a48c);
const LINEN = colour(0xf4eee0);
const BLUE = colour(0x2f5aa8);
const NAVY = colour(0x1f3a7a);
const BRASS = colour(0xe0a030);
const GREEN = colour(0x2f6a3a);
const RED = colour(0xa82a30);


interface WallTool {
  /** The point `a` along the wall, `y` up and `off` into the room. */
  p(a: number, y: number, off?: number): V3;
  along: V3;
  inward: V3;
  /** The turn of a box that lies along the wall. */
  turn: number;
}

function wallTool(name: WallName): WallTool {
  const f = wallFrame(name);
  return {
    p: (a, y, off = 0) => [f.x + f.ax * a + f.nx * off, y, f.z + f.az * a + f.nz * off],
    along: [f.ax, 0, f.az],
    inward: [f.nx, 0, f.nz],
    turn: Math.atan2(f.az, f.ax),
  };
}

function times(v: V3, k: number): V3 {
  return [v[0] * k, v[1] * k, v[2] * k];
}

/** The pieces of the set are added through this: it keeps the scene and a few short ways to say a shape. */
class Builder {
  private readonly scene = new Scene();
  private lean: { at: readonly [number, number, number]; matrix: LeanMatrix } | null = null;
  /** A leaning piece as the scene holds it, by the piece as it was made. */
  private readonly outers = new Map<Shape, Leant>();

  add<T extends Shape>(shape: T, group: number): T {
    if (!this.lean) return this.scene.add(shape, group);
    const outer = this.scene.add(new Leant(shape, [...this.lean.at], [...this.lean.matrix]), group);
    shape.id = outer.id; shape.group = outer.group;
    this.outers.set(shape, outer);
    return shape;
  }

  /** Everything `build` adds leans by `lean`. */
  leant<T>(lean: Lean, build: () => T): T {
    return this.moved(lean.at, leanMatrix(lean), build);
  }

  /** Everything `build` adds is moved by `matrix` round `at`, the point that stays. */
  moved<T>(at: readonly [number, number, number], matrix: LeanMatrix, build: () => T): T {
    const before = this.lean;
    this.lean = { at, matrix };
    try { return build(); } finally { this.lean = before; }
  }

  /** The piece as it stands in the scene: itself, or its leaning shape. */
  outer(shape: Shape): Shape {
    return this.outers.get(shape) ?? shape;
  }

  /** The finished scene: a leaning piece throws a shadow or not as the piece it was made from says. */
  finish(): Scene {
    for (const [made, outer] of this.outers) { outer.shadow = made.shadow; outer.outdoor = made.outdoor; }
    return this.scene;
  }

  /** A box from its middle on the floor plan, its size, and where it stands (`y0` to `y1`); `turn` in degrees as in the plan. */
  box(x: number, z: number, w: number, d: number, y0: number, y1: number, turn: number, material: Material, group: number): Box {
    return this.add(new Box([x, (y0 + y1) / 2, z], [w / 2, (y1 - y0) / 2, d / 2], -turn * RAD, material), group);
  }

  /** A box on a wall: from `a0` to `a1` along it, `y0` to `y1` up, `off0` to `off1` out of it. */
  onWall(wall: WallTool, a0: number, a1: number, y0: number, y1: number, off0: number, off1: number, material: Material, group: number): Box {
    const c = wall.p((a0 + a1) / 2, (y0 + y1) / 2, (off0 + off1) / 2);
    return this.add(new Box(c, [(a1 - a0) / 2, (y1 - y0) / 2, (off1 - off0) / 2], wall.turn, material), group);
  }

  /** A round post; with `splits` a split log (`Cone`). */
  rod(a: V3, b: V3, ra: number, rb: number, material: Material, group: number, splits: readonly Split[] = []): Cone {
    return this.add(new Cone(a, b, ra, rb, material, splits), group);
  }

  /** A sheet of paper, or a sheaf `thick` deep (`Bent`): its middle on the floor plan, its size, the height `y` its top lies at where `lift` is 0; `turn` in degrees as in the plan. Its edges are worn (`worn`). */
  bent(x: number, z: number, w: number, d: number, y: number, turn: number, lift: (lx: number, lz: number) => number, material: Material, group: number, thick: number = SHEET, seed = group): Bent {
    return this.add(new Bent([x, y, z], [w / 2, d / 2], -turn * RAD, thick, lift, material, worn(w, d, seed)), group);
  }

  blob(c: V3, r: V3, turn: number, material: Material, group: number): Blob {
    return this.add(new Blob(c, r, -turn * RAD, material), group);
  }
}

/** A point of a turned block: `lx` along its width, `lz` along its depth, from its middle. */
function inBlock(b: { x: number; z: number; turn: number }, lx: number, lz: number): { x: number; z: number } {
  const cos = Math.cos(b.turn * RAD), sin = Math.sin(b.turn * RAD);
  return { x: b.x + lx * cos + lz * sin, z: b.z - lx * sin + lz * cos };
}

/**
 * A book: its middle on the floor plan, the height it lies on, its length along its back, its depth, its thickness,
 * its turn in degrees, which side of its depth its back is on (1 the side toward the viewer of a thing not turned),
 * its cloth.
 */
interface BookAt { x: number; z: number; y: number; w: number; d: number; h: number; turn: number; back: 1 | -1; cover: Colour; seed: number }

/**
 * A book as the library of the 1991 game paints them (`roomPapers`): two boards that reach past the pale block of its
 * pages on three sides, and a rounded back with raised bands. Small and warm; no edge of it is a ruler's.
 */
function book(b: Builder, k: BookAt, group: number): void {
  const board = Math.max(0.007, k.h * 0.17), over = 0.014;
  const cloth = bookBoard(k.w, k.d, k.cover, k.seed);
  b.box(k.x, k.z, k.w, k.d, k.y, k.y + board, k.turn, cloth, group);
  b.box(k.x, k.z, k.w, k.d, k.y + k.h - board, k.y + k.h, k.turn, cloth, group);
  const mid = inBlock(k, 0, k.back * over / 2);
  b.box(mid.x, mid.z, k.w - 2 * over, k.d - over, k.y + board, k.y + k.h - board, k.turn, bookPages(k.seed), group);
  const from = inBlock(k, -k.w / 2, k.back * k.d / 2), to = inBlock(k, k.w / 2, k.back * k.d / 2);
  b.rod([from.x, k.y + k.h / 2, from.z], [to.x, k.y + k.h / 2, to.z], k.h / 2, k.h / 2, bookBack(k.w, k.cover), group);
}

// ---- cloth and pictures ----

/** The curtains of the real room: white cloth with small red flowers and green leaves, hanging in folds. */
const FLOWER = colour(0xa8504c), LEAF = colour(0x5c7c58);

/**
 * How a curtain's cloth lies at a place: a few big folds across it, as the 1991 rooms hang their curtains (mi2-bg-1-056),
 * each fold a lit stripe, a mid one and a dark one laid flat beside each other, never shaded smooth.
 */
function folded(across: number, along: number, width: number): number {
  const t = ((across / width + 0.08 * Math.sin(along * 3.1)) % 1 + 1) % 1;
  return t < 0.48 ? 1.05 : t < 0.68 ? 0.84 : TROUGH;
}

/** The dark of a fold's trough: deep, and cooled toward violet as the guest room's curtains are (mi2-bg-1-056). */
const TROUGH = 0.56, TROUGH_TONE = colour(0x5e4a78);

/** A curtain's cloth: four big folds that run down it and gather at the tie, so they fan out above and below it. */
function flowered(width: number, height: number, mirror: boolean): Material {
  return (d) => {
    const x = mirror ? width - d.u : d.u;
    printed(d, folded(x / curtainEdge(width, d.v / height), d.v, 0.25));
  };
}

/** The valance across the top of a window: the same cloth gathered in folds that run down it. */
function valanceCloth(d: Dab): void {
  printed(d, folded(d.u, d.v * 0.2, 0.16));
}

function printed(d: Dab, fold: number): void {
  if (fold === TROUGH) return tint(d, mix(LINEN, TROUGH_TONE, 0.45), fold);
  const cu = Math.floor(d.u / 0.085), cv = Math.floor(d.v / 0.1);
  const fu = d.u / 0.085 - cu - 0.5, fv = d.v / 0.1 - cv - 0.5;
  const pick = hash2(cu, cv, 77);
  const ox = (hash2(cu, cv, 78) - 0.5) * 0.5, oy = (hash2(cu, cv, 79) - 0.5) * 0.5;
  const r = Math.hypot(fu - ox, fv - oy);
  if (pick > 0.5 && r < 0.2) return tint(d, FLOWER, fold);
  if (pick > 0.5 && r < 0.34 && fv - oy < 0) return tint(d, LEAF, fold);
  tint(d, LINEN, fold);
}

/**
 * A valance `width` long and `height` deep: its lower edge hangs in two swags between three points, each swag
 * a full U (the root rounds its bottom and steepens its sides), and even the middle point hangs low enough to
 * cover the window's head.
 */
function swagShape(width: number, height: number): (u: number, v: number) => boolean {
  return (u, v) => v > height * (0.36 - 0.34 * Math.sqrt(Math.abs(Math.sin(Math.PI * 2 * u / width))) - 0.03 * Math.abs(Math.sin(u * 36)));
}

/** How far a curtain reaches across at a height `t` (0 at its hem, 1 at the rod): wide at the rod, gathered at the tie. */
function curtainEdge(width: number, t: number): number {
  const tie = Math.exp(-((t - 0.42) ** 2) / 0.02);
  return width * (0.62 + 0.38 * t * t - 0.2 * tie + 0.16 * Math.max(0, 0.42 - t));
}

function curtainShape(width: number, height: number, mirror: boolean): (u: number, v: number) => boolean {
  return (u, v) => {
    const x = mirror ? width - u : u;
    const hem = 0.03 * Math.abs(Math.sin(x * 40));
    return x < curtainEdge(width, v / height) && v > hem;
  };
}

/** The blue-white rug of the real room: a dark blue border, a pale field with rows of small blue ornaments, a fringe at both ends. */
function rug(d: Dab): void {
  rugPattern(d);
  // lower and cooler than its wool is: the rug lies where a painted room keeps its dark foreground, and it is no button
  d.r *= RUG_TONE[0]; d.g *= RUG_TONE[1]; d.b *= RUG_TONE[2];
}

/** How the rug's colours are lowered (art review 1 of the repaint: it was the loudest thing on the screen). */
const RUG_TONE = [0.56, 0.59, 0.69] as const;

/** The rug's wool: its blues are faded ones, so that the pattern lies in the floor and does not jump off it. */
const RUG_BLUE = colour(0x5d7298), RUG_NAVY = colour(0x34446c);

function rugPattern(d: Dab): void {
  if (d.face !== 3) return tint(d, RUG_NAVY, 0.7);
  const hw = 1.15, hd = 0.74;
  const ex = hw - Math.abs(d.u), ez = hd - Math.abs(d.v);
  const k = 0.94 + 0.1 * fbm(d.u * 4, d.v * 4, 2, 5);
  if (ex < 0.05) return tint(d, (Math.floor((d.v + 5) / 0.05) & 1) ? LINEN : RUG_NAVY, k);
  const edge = Math.min(ex - 0.05, ez);
  if (edge < 0.06) return tint(d, RUG_NAVY, k);
  if (edge < 0.1) return tint(d, LINEN, k);
  if (edge < 0.2) {
    // one row of broad teeth, not a fine lattice: a pattern the eye takes in at once
    const tooth = Math.abs((((ex - 0.05 < ez ? d.v : d.u) * 3.2) % 1 + 1) % 1 - 0.5) * 2;
    return tint(d, tooth * 0.1 > edge - 0.1 ? RUG_BLUE : LINEN, k);
  }
  if (edge < 0.23) return tint(d, RUG_NAVY, k);
  // the field: a few big diamonds, each a ring with a dot in it
  const cu = d.u / 0.42 + 0.5, cv = d.v / 0.36 + 0.5;
  const fu = cu - Math.floor(cu) - 0.5, fv = cv - Math.floor(cv) - 0.5;
  const star = Math.abs(fu) + Math.abs(fv);
  if (star < 0.09 || (star > 0.24 && star < 0.33)) return tint(d, RUG_BLUE, k);
  tint(d, LINEN, k);
}

/** One of the framed lighthouse photographs: a dark frame, a sky, a low shore, a tower. `n` varies them. */
function photo(w: number, h: number, n: number): Material {
  const sky = [colour(0x86c0ee), colour(0xe8b47a), colour(0x5a9de0), colour(0xb8c8d8), colour(0x3a7fd0), colour(0xf0d0a0)][n % 6]!;
  const land = [colour(0x4a8a4a), colour(0x5c4a30), colour(0x78ae5e), colour(0x6a6a5a), colour(0x2f6a3a), colour(0x8a7a50)][n % 6]!;
  const tower = n % 2 ? colour(0xf2e6cc) : colour(0xa83a2a);
  const at = 0.3 + 0.4 * hash2(n, 1, 3);
  return (d) => {
    const fine = Math.max(0.022, d.fine * 1.2);
    if (d.u < fine || d.v < fine || d.u > w - fine || d.v > h - fine) return tint(d, colour(0x241a1c));
    const u = (d.u - fine) / (w - 2 * fine), v = (d.v - fine) / (h - 2 * fine);
    const tw = 0.05 + 0.05 * (1 - v);
    if (Math.abs(u - at) < tw && v > 0.22 && v < 0.84) return tint(d, v > 0.74 ? colour(0x3a2a2a) : tower, u < at ? 1 : 0.8);
    if (v < 0.26 + 0.05 * noise2(u * 5, n, 2)) return tint(d, land, 0.8 + 0.3 * noise2(u * 14, v * 14, n));
    tint(d, mix(sky, colour(0xffffff), 0.5 * (1 - v) + 0.25 * step(0.55, 0.7, fbm(u * 3 + n, v * 5, 2, n))));
  };
}

/** The piano's keys seen from above: `u` along the keyboard. */
function keys(d: Dab): void {
  const key = d.u / 0.0235;
  const n = Math.floor(key), f = key - n;
  const inOctave = ((n % 7) + 7) % 7;
  // the black keys lie on the far half of the white ones
  const black = f > 0.58 && inOctave !== 2 && inOctave !== 6 && d.v > KEYS.len * 0.42;
  if (black) return tint(d, colour(0x1a1820));
  tint(d, LINEN, f < Math.max(0.12, (d.fine * 0.5) / 0.0235) ? 0.62 : 1.04);
}

/** The piano's keys as they show awake: how wide the band is, how far it rises and how deep it lies, and its length up the slope. */
const KEYS = { w: 1.24, rise: 0.095, deep: 0.2, len: Math.hypot(0.095, 0.2) } as const;

/** A sheet of music on the piano's desk: pale paper with five-line staves and specks of notes. */
function sheet(d: Dab): void {
  const line = (d.v % 0.075) / 0.075;
  const stave = line > 0.2 && line < 0.75 && Math.floor(line * 14) % 2 === 0;
  const note = stave && hash2(Math.floor(d.u / 0.022), Math.floor(d.v / 0.075), 12) > 0.6;
  tint(d, LINEN, Math.abs(d.u - 0.23) < 0.006 ? 0.6 : note ? 0.35 : stave ? 0.72 : 1.05);
}

/** The notes chalked on the board when it is awake: where each head is along the stave, and its place on it (0 the bottom line, 1 the space over it). */
const BOARD_NOTES = [[0.3, 1], [0.52, 2], [0.74, 3]] as const;

/**
 * The note-name board: a dark green board in a wooden frame with a stave on it. At rest the stave is empty, with the
 * smear of a wiped note; awake, three notes stand on it in gold chalk, each a step higher.
 */
function board(w: number, h: number, awake: boolean): Material {
  return (d) => {
    const frame = 0.035;
    if (d.u < frame || d.v < frame || d.u > w - frame || d.v > h - frame) return tint(d, HONEY, 0.9 + 0.2 * noise2(d.u * 30, d.v * 30, 6));
    const v = (d.v - frame) / (h - 2 * frame), u = (d.u - frame) / (w - 2 * frame);
    const chalk = colour(0xf4eee0), gold = colour(0xffc83d);
    if (awake) {
      for (const [at, step] of BOARD_NOTES) {
        const nx = (u - at) * (w / h), ny = v - (0.3 + step * 0.05);
        d.emit = 0.5;
        if (nx * nx * 1.2 + ny * ny * 2.6 < 0.0056) return tint(d, gold);
        if (Math.abs(nx - 0.062) < Math.max(0.012, d.fine / h) && ny > 0 && ny < 0.36) return tint(d, gold);
      }
    }
    d.emit = 0.3;
    for (let i = 0; i < 5; i++) if (Math.abs(v - (0.3 + i * 0.1)) < Math.max(0.012, (d.fine * 0.6) / h)) return tint(d, chalk, awake ? 1 : 0.8);
    // a little light of its own: the board stays green in warm light, where a dark green would go black
    d.emit = awake ? 0.24 : 0.16;
    // at rest, the pale smear where the last note was wiped off
    const smear = awake ? 0 : 0.5 * step(0.5, 0.75, fbm(u * 5 + 3, v * 9, 2, 14)) * step(0.3, 0.1, Math.hypot((u - 0.55) * 1.3, v - 0.5));
    tint(d, mix(colour(0x1d4a2c), chalk, smear * 0.45), 0.85 + 0.3 * fbm(d.u * 7, d.v * 7, 2, 9));
  };
}

/** The door's frame: dark, so that the door is a thing in the wall and not a pale patch of it. */
const DOOR_FRAME = colour(0x4e2a16);

/** The door: boards of a warm brown in a frame with two sunk panels, the joints between the boards dark. */
function doorLeaf(w: number, h: number): Material {
  const base = wood(colour(0x7a5034), 21);
  return (d) => {
    base(d);
    if (d.face !== 4 && d.face !== 5) return;
    const u = d.u + w / 2, v = d.v + h / 2;
    const board = w / 5, seam = ((u % board) + board) % board;
    if (seam < Math.max(0.012, d.fine * 0.8)) { d.r *= 0.55; d.g *= 0.55; d.b *= 0.55; return; }
    const inPanel = (v0: number, v1: number) => u > 0.12 && u < w - 0.12 && v > v0 && v < v1;
    const edge = (v0: number, v1: number) => Math.min(u - 0.12, w - 0.12 - u, v - v0, v1 - v);
    for (const [v0, v1] of [[0.16, 0.86], [1.0, h - 0.14]] as const) {
      if (!inPanel(v0, v1)) continue;
      const e = edge(v0, v1);
      const k = e < Math.max(0.025, d.fine) ? 0.5 : e < 0.06 ? 0.78 : 0.9;
      d.r *= k; d.g *= k; d.b *= k;
    }
  };
}

/** Where in the flames' loop `fireGlass` paints, 0 to 1 (1 is 0 again). */
let flamePhase = 0;
export function setFlamePhase(phase: number): void {
  flamePhase = phase;
}

/**
 * The fire in the stove's door, as the fires of the 1991 rooms are drawn: a few flat tongues, yellow inside orange
 * inside red, on the dark of the firebox, behind upright bars and inside a pale ring with round corners. `emit` below
 * zero marks the fire itself, which flickers; the bars and the ring are iron.
 */
function fireGlass(d: Dab): void {
  const W = STOVE.door.w / 2, H = STOVE.door.h / 2, turn = 2 * Math.PI * flamePhase;
  const x = d.u / W, y = d.v / H;
  // the mouth: a rectangle with round corners (a superellipse), the ring just inside its edge
  const far = (Math.abs(x) ** 4 + Math.abs(y) ** 4) ** 0.25;
  if (far > 0.98) { tint(d, IRON, 0.8); return; }
  // the ring glows a little with the fire behind it
  if (far > 0.84) { tint(d, colour(0xd8c8a0), 0.9); d.emit = 0.55; return; }
  const bar = Math.abs(((x + 1) * 2.5) % 1 - 0.5) > 0.36 && Math.abs(x) < 0.75;
  if (bar) { tint(d, colour(0x1a1216)); return; }
  // three tongues that lick: each rises and sinks in its turn round the loop, swaying, with a ripple running up it
  // (it licks, it does not bite), all in whole turns of the loop so its end meets its start
  let tongue = 0;
  for (let k = 0; k < 3; k++) {
    const own = turn - (k * 2 * Math.PI) / 3, rise = y + 0.84;
    const at = -0.5 + k * 0.5 + 0.06 * Math.sin(own + 0.8), tall = 1.0 + 0.38 * Math.sin(own), wide = 0.42 + 0.05 * Math.cos(own);
    const lean = (0.1 * Math.sin(2 * turn + k * 1.9) + 0.07 * Math.sin(2 * turn - 5 * y + k)) * rise;
    tongue = Math.max(tongue, tall * (1 - Math.abs((x - at - lean) / wide) ** 1.6));
  }
  const up = (y + 0.84) / Math.max(0.01, tongue);
  const c = tongue <= 0 || up > 1 ? colour(0x3a100c) : up > 0.72 ? colour(0xc2410c) : up > 0.4 ? colour(0xfb9a24) : colour(0xffe27a);
  tint(d, c);
  d.emit = -1;
}

/** The stove's door when no fire burns (by day and at dawn): the ring and bars of iron, the firebox dark with old ash. */
function coldGlass(d: Dab): void {
  const W = STOVE.door.w / 2, H = STOVE.door.h / 2;
  const x = d.u / W, y = d.v / H;
  const far = (Math.abs(x) ** 4 + Math.abs(y) ** 4) ** 0.25;
  if (far > 0.84) { tint(d, IRON, 0.8); return; }
  const bar = Math.abs(((x + 1) * 2.5) % 1 - 0.5) > 0.36 && Math.abs(x) < 0.75;
  tint(d, colour(bar ? 0x2a2630 : y > 0.4 ? 0x4a4446 : 0x1a1216));
}

// ---- the set ----

/** What the set needs to know about the hour. */
export interface RoomHour {
  phase: SkyPhase;
  /** Whether the lamps are lit. */
  lamps: boolean;
}

function shell(b: Builder, doorOpen: boolean): Shape {
  const H = ROOM.height;
  const slope = Math.tan(ROOM.splay * RAD);
  const inside = (u: number, v: number): boolean => Math.abs(u - 8) <= ROOM.half + slope * v + 0.02;
  const floor = b.add(new Flat([-8, 0, 0], [16, 0, 0], [0, 0, ROOM.depth], planks(FLOOR, 0.145, 3)), G.shell);
  floor.mask = inside;
  const ceiling = b.add(new Flat([-8, H, 0], [16, 0, 0], [0, 0, ROOM.depth], planks(colour(0x6e4a34), 0.2, 8, 'u')), G.shell);
  ceiling.mask = inside;
  const back = b.add(new Flat([-ROOM.half, 0, 0], [2 * ROOM.half, 0, 0], [0, H, 0], plaster(WHITE, 1)), G.shell);
  for (const [win, lean] of [[ROOM.windowLeft, ROOM.lean.windowLeft], [ROOM.windowRight, ROOM.lean.windowRight]] as const) back.holes.push({ u0: win.a0 + ROOM.half, u1: win.a1 + ROOM.half, v0: win.y0, v1: win.y1, lean });
  const left = wallTool('left'), right = wallTool('right');
  const leftWall = b.add(new Flat(left.p(0, 0), times(left.along, ROOM.depth), [0, H, 0], plaster(WHITE, 2)), G.shell);
  leftWall.holes.push({ u0: ROOM.windowSide.a0, u1: ROOM.windowSide.a1, v0: ROOM.windowSide.y0, v1: ROOM.windowSide.y1, lean: ROOM.lean.windowSide });
  const brick = bricks(BRICK, MORTAR, 4), white = plaster(WHITE, 3);
  const rightWall = b.add(new Flat(right.p(0, 0), times(right.along, ROOM.depth), [0, H, 0], (d) => (d.u < ROOM.bricks.a1 ? brick(d) : white(d))), G.shell);
  if (doorOpen) rightWall.holes.push({ u0: ROOM.door.a0, u1: ROOM.door.a1, v0: 0, v1: ROOM.door.y1, lean: ROOM.lean.door });
  // the wall behind the viewer, so no light leaks in from there
  b.add(new Flat([-8, 0, ROOM.depth], [16, 0, 0], [0, H, 0], plaster(WHITE, 5)), G.shell);
  // skirting boards and two ceiling beams
  const skirt = wood(DARK_WOOD, 6, 'u');
  b.onWall(wallTool('back'), -ROOM.half, ROOM.half, 0, 0.1, 0, 0.025, skirt, G.shell);
  b.onWall(left, 0, ROOM.depth, 0, 0.1, 0, 0.025, skirt, G.shell);
  b.onWall(right, ROOM.bricks.a1, ROOM.door.a0 - 0.09, 0, 0.1, 0, 0.025, skirt, G.shell);
  b.onWall(right, ROOM.door.a1 + 0.09, ROOM.depth, 0, 0.1, 0, 0.025, skirt, G.shell);
  // the end of the bricks: a post of pale blocks, as in the real room
  b.onWall(right, ROOM.bricks.a1 - 0.02, ROOM.bricks.a1 + 0.12, 0, H, 0, 0.05, plaster(colour(0xcfc4b0), 12), G.shell);
  // two ceiling beams, rough-hewn: each sags its own way and is thicker at one end
  const beam = wood(DARK_WOOD, 7, 'v');
  for (const [z, sag, kink, thick] of [[1.15, 0.1, 0.06, 0.085], [2.75, 0.07, -0.08, 0.1]] as const) {
    const at = (x: number): V3 => [x, H - 0.03 - thick - sag * (1 - (x / 6) ** 2) + 0.03 * Math.sin(x * 1.7 + z), z + kink * Math.sin(x * 0.9 + z * 2)];
    for (let x = -6; x < 6; x += 1.5) b.rod(at(x), at(x + 1.5), thick * (1.1 - 0.02 * x), thick * (1.1 - 0.02 * (x + 1.5)), beam, G.wood);
  }
  return back;
}

/**
 * A window: the niche through the wall, its timber frame and bars, the sill board, the trim, and the flowered curtains.
 */
function windowUnit(b: Builder, name: WallName, p: WallPiece, group: number, lean: number, cross = true): void {
  const w = wallTool(name);
  b.leant({ at: w.p((p.a0 + p.a1) / 2, p.y0), x: lean * w.along[0], z: lean * w.along[2] }, () => windowParts(b, w, p, group, cross));
}

function windowParts(b: Builder, w: WallTool, p: WallPiece, group: number, cross: boolean): void {
  const deep = times(w.inward, -ROOM.wall);
  const reveal = plaster(TRIM, 30);
  const width = p.a1 - p.a0, height = p.y1 - p.y0;
  b.add(new Flat(w.p(p.a0, p.y0), deep, [0, height, 0], reveal), G.shell);
  b.add(new Flat(w.p(p.a1, p.y0), deep, [0, height, 0], reveal), G.shell);
  b.add(new Flat(w.p(p.a0, p.y1), times(w.along, width), deep, reveal), G.shell);
  b.add(new Flat(w.p(p.a0, p.y0), times(w.along, width), deep, reveal), G.shell);
  // a fat dark frame with one thick cross, as the 1991 rooms' windows have (mi2-bg-1-056, 1-055): not thin white bars
  // the lighthouse window, seen from the side, keeps a slim frame of plain wood: a fat one's side would hide the tower
  const timber = cross ? wood(WINDOW_WOOD, 31) : plain(WINDOW_WOOD, 0.1, 31);
  const F = cross ? 0.085 : 0.05, X = 0.065, C = cross ? 0.1 : 0.06;
  const f0 = -ROOM.wall + (cross ? 0.04 : 0.05), f1 = -ROOM.wall + (cross ? 0.13 : 0.1);
  b.onWall(w, p.a0, p.a0 + F, p.y0, p.y1, f0, f1, timber, group);
  b.onWall(w, p.a1 - F, p.a1, p.y0, p.y1, f0, f1, timber, group);
  b.onWall(w, p.a0, p.a1, p.y1 - F, p.y1, f0, f1, timber, group);
  b.onWall(w, p.a0, p.a1, p.y0, p.y0 + F, f0, f1, timber, group);
  const mid = (p.a0 + p.a1) / 2, bar = p.y0 + height * 0.74; // above the sea's horizon, so the sky and the sea meet in one pane
  if (cross) {
    b.onWall(w, mid - X / 2, mid + X / 2, p.y0, p.y1, f0 + 0.01, f1 - 0.01, timber, group);
    b.onWall(w, p.a0, p.a1, bar - X / 2, bar + X / 2, f0 + 0.01, f1 - 0.01, timber, group);
  }
  // a deep sill: a thick board that stands out into the room, lit along its top, its shadow under it
  b.onWall(w, p.a0 - 0.1, p.a1 + 0.1, p.y0 - 0.075, p.y0, -ROOM.wall + 0.04, 0.16, wood(colour(0xa8703c), 32, 'u'), group);
  // the casing round it on the room's side, dark as the frame
  b.onWall(w, p.a0 - C, p.a0, p.y0, p.y1 + C, 0, 0.035, timber, group);
  b.onWall(w, p.a1, p.a1 + C, p.y0, p.y1 + C, 0, 0.035, timber, group);
  b.onWall(w, p.a0 - C, p.a1 + C, p.y1, p.y1 + C, 0, 0.035, timber, group);
  // the curtains on their rod
  const cw = 0.46, drop = 0.24, top = p.y1 + 0.14, ch = top - (p.y0 - drop);
  for (const mirror of [false, true]) {
    const a = mirror ? p.a1 + 0.22 - cw : p.a0 - 0.22;
    const cloth = b.add(new Flat(w.p(a, p.y0 - drop, 0.07), times(w.along, cw), [0, ch, 0], flowered(cw, ch, mirror)), group + 100);
    cloth.mask = curtainShape(cw, ch, mirror);
    cloth.shadow = false;
  }
  // the valance over them: the same cloth across the window's head, its lower edge in two swags
  const vw = width + 0.6, vh = cross ? 0.42 : 0.24; // shallower over the lighthouse, so its lantern shows
  const swag = b.add(new Flat(w.p(p.a0 - 0.3, top - vh + 0.04, 0.1), times(w.along, vw), [0, vh, 0], valanceCloth), group + 100);
  swag.mask = swagShape(vw, vh);
  swag.shadow = false;
  b.rod(w.p(p.a0 - 0.32, top, 0.08), w.p(p.a1 + 0.32, top, 0.08), 0.02, 0.02, plain(DARK_WOOD), group);
}

/** The piano's fallboard shut over the keys: the case's walnut, its front edge worn pale, a brass lock plate in the middle. */
function fallboard(body: Material): Material {
  return (d) => {
    body(d);
    if (d.face === 5 && Math.abs(d.u) < 0.022) return tint(d, BRASS, 1.1);
    const k = d.face === 3 ? (d.v > 0.085 ? 1.5 : 1.12) : 0.9;
    d.r *= k; d.g *= k; d.b *= k;
  };
}

/** How thick the piano's book of pieces is, in metres. */
const BOOK_THICK = 0.05;

/** The book of pieces shut, a fat one: a blue cloth cover with a pale label, and between its two boards the pale block of its pages. */
function bookCover(d: Dab): void {
  if (d.face !== 5) return Math.abs(d.face === 3 ? d.v : d.u) > BOOK_THICK / 2 - 0.012 ? tint(d, BLUE, 0.7) : tint(d, LINEN, 0.8);
  if (Math.abs(d.u) < 0.06 && d.v > 0.015 && d.v < 0.06) return tint(d, LINEN, 1.05);
  tint(d, BLUE, d.u < -0.085 ? 0.7 : 1 + 0.15 * noise2(d.u * 40, d.v * 40, 44));
}

/** Where the piano's two candles burn (their flames), as the piano was made: one a little shorter than the other. */
const PIANO_CANDLES = [-0.53, 0.53].map((sx) => ({ x: ROOM.piano.x + sx, y: 1.055 - 0.03 * Math.sign(sx), z: 0.56 }));

function piano(b: Builder, awake: boolean, lit: boolean): void {
  const p = ROOM.piano;
  // a red-brown walnut that keeps its panels readable in the shade between the windows
  const body = wood(colour(0x91522a), 40, 'u'), dark = wood(colour(0x5e3219), 41);
  const x0 = p.x - p.w / 2;
  // the case, with a sunk panel above the keys and one below
  b.box(p.x, 0.25, p.w, 0.4, 0, p.y1, 0, (d) => {
    body(d);
    if (d.face !== 5) return;
    for (const [v0, v1] of [[0.24, 0.5], [-0.42, -0.02]] as const) {
      const e = Math.min(d.u + 0.6, 0.6 - d.u, d.v - v0, v1 - d.v);
      if (e <= 0) continue;
      const k = e < Math.max(0.02, d.fine) ? 0.5 : e < 0.045 ? 1.3 : 1.08;
      d.r *= k; d.g *= k; d.b *= k;
    }
  }, G.piano);
  // a thick top board that overhangs the case on a moulding
  b.box(p.x, 0.26, p.w + 0.04, 0.44, p.y1, p.y1 + 0.03, 0, body, G.piano);
  b.box(p.x, 0.27, p.w + 0.16, 0.52, p.y1 + 0.03, p.y1 + 0.085, 0, dark, G.piano);
  b.box(p.x, 0.56, p.w, 0.26, 0.6, 0.71, 0, body, G.piano);
  // awake the keys show as a broad band: drawn tipped up toward the viewer, as a hand draws a keyboard seen from the room
  if (awake) b.add(new Flat([p.x - KEYS.w / 2, 0.705, 0.69], [KEYS.w, 0, 0], [0, KEYS.rise, -KEYS.deep], keys), G.piano);
  else b.box(p.x, 0.585, p.w - 0.16, 0.23, 0.71, 0.755, 0, fallboard(body), G.piano);
  for (const sx of [0.04, p.w - 0.04]) {
    b.box(x0 + sx, 0.56, 0.1, 0.28, 0.6, 0.8, 0, dark, G.piano);
    // a fat turned leg under the key shelf: a block, a bulb, a waist, a block
    const x = x0 + sx, z = 0.63;
    b.box(x, z, 0.1, 0.1, 0, 0.07, 0, dark, G.piano);
    b.rod([x, 0.07, z], [x, 0.2, z], 0.03, 0.06, dark, G.piano);
    b.rod([x, 0.2, z], [x, 0.36, z], 0.06, 0.03, dark, G.piano);
    b.rod([x, 0.36, z], [x, 0.5, z], 0.03, 0.05, dark, G.piano);
    b.box(x, z, 0.1, 0.1, 0.5, 0.6, 0, dark, G.piano);
  }
  b.box(p.x, 0.47, p.w, 0.05, 0, 0.12, 0, dark, G.piano);
  // the music desk with the book of pieces: shut at rest, open when the piano is awake
  b.box(p.x, 0.47, 0.74, 0.03, 0.8, 1.03, 0, dark, G.piano);
  if (awake) b.add(new Flat([p.x - 0.23, 0.82, 0.49], [0.46, 0, 0], [0, 0.2, -0.012], sheet), G.piano + 100);
  else b.box(p.x - 0.04, 0.5 + BOOK_THICK / 2 - 0.011, 0.24, BOOK_THICK, 0.82, 1.01, 3, bookCover, G.piano + 100);
  // a brass sconce either side of the music desk, each with a candle that burns when the lamps do
  for (const c of PIANO_CANDLES) {
    b.rod([c.x, 0.9, 0.45], [c.x, 0.9, c.z], 0.012, 0.012, plain(BRASS), G.piano + 101);
    b.rod([c.x, 0.9, c.z], [c.x, 0.925, c.z], 0.035, 0.028, plain(BRASS), G.piano + 101);
    b.rod([c.x, 0.925, c.z], [c.x, c.y - 0.035, c.z], 0.017, 0.015, plain(colour(0xf2e6cc), 0.05), G.piano + 101);
    if (!lit) continue;
    const flame = b.blob([c.x, c.y, c.z], [0.016, 0.034, 0.016], 0, (d) => { tint(d, colour(0xffe27a)); d.emit = 1.4; }, G.piano + 102);
    flame.shadow = false;
  }
  // two brass pedals
  for (const sx of [-0.07, 0.07]) b.box(p.x + sx, 0.53, 0.04, 0.1, 0.03, 0.055, 0, plain(BRASS), G.piano);
  // the stool
  const seat = plain(colour(0x7a1c28), 0.15, 2);
  b.blob([p.x + 0.04, 0.47, 1.2], [0.21, 0.07, 0.21], 0, seat, G.stool);
  b.rod([p.x + 0.04, 0.37, 1.2], [p.x + 0.04, 0.44, 1.2], 0.17, 0.215, dark, G.stool);
  for (let i = 0; i < 3; i++) {
    const a = i * 2.094 + 0.5;
    b.rod([p.x + 0.04 + Math.cos(a) * 0.1, 0.4, 1.2 + Math.sin(a) * 0.1], [p.x + 0.04 + Math.cos(a) * 0.24, 0, 1.2 + Math.sin(a) * 0.24], 0.034, 0.022, dark, G.stool);
  }
}

/** The pot-bellied stove's measures, in metres: the belly's middle height and radii, the cooking plate on it, and the fire door on its front. */
const STOVE = { mid: 0.5, r: 0.31, half: 0.37, plate: { y: 0.8, r: 0.27, thick: 0.05 }, door: { w: 0.25, h: 0.19, out: 0.325 } } as const;

/** How wide the belly is at the height `y`. */
function bellyAt(y: number): number {
  return STOVE.r * Math.sqrt(Math.max(0, 1 - ((y - STOVE.mid) / STOVE.half) ** 2));
}

/**
 * The pot-bellied iron stove on its plate before the bricks, in the manner of the stoves of the 1991 rooms (the stove
 * style taken directly from the 1991 game's, as the atlas shows them; studied: the inn's
 * and the map maker's of Woodtick): a round belly on bowed legs with paw feet, hoops round it, an oval door whose fire
 * glows between bars, a cooking plate with a kettle, and a pipe that goes up crooked, joint by joint, into the bricks.
 * Split logs are stacked beside it.
 */
function stove(b: Builder, lit: boolean): { x: number; y: number; z: number; glass: Shape } {
  const at = onWall('right', 0.98, 0.62);
  const s = { x: at.x, z: at.z, turn: -32 };
  // cast iron as the 1991 stoves have it: a grey-blue that takes the light in bands, never a black hole
  const iron = plain(colour(0x565c74), 0.35, 50), ironLight = plain(colour(0x767c92), 0.25, 51);
  // the plate on the floor
  const plate = inBlock(s, 0, 0.12);
  b.box(plate.x, plate.z, 0.92, 0.96, 0, 0.015, s.turn, plain(colour(0x3c3a40), 0.3, 52), G.stove + 100);
  // four bowed legs, each on a paw
  for (const a of [0.8, 2.35, 3.95, 5.5]) {
    const out = (r: number): { x: number; z: number } => inBlock(s, Math.cos(a) * r, Math.sin(a) * r);
    const hip = out(0.2), knee = out(0.31), paw = out(0.33);
    b.rod([hip.x, 0.3, hip.z], [knee.x, 0.14, knee.z], 0.04, 0.034, iron, G.stove);
    b.rod([knee.x, 0.14, knee.z], [paw.x, 0.04, paw.z], 0.034, 0.028, iron, G.stove);
    b.blob([paw.x, 0.04, paw.z], [0.055, 0.03, 0.055], 0, iron, G.stove);
  }
  // the belly, its two hoops and the skirt it sits in
  b.blob([s.x, STOVE.mid, s.z], [STOVE.r, STOVE.half, STOVE.r], 0, iron, G.stove);
  b.rod([s.x, 0.17, s.z], [s.x, 0.24, s.z], 0.17, bellyAt(0.24) + 0.012, ironLight, G.stove);
  for (const y of [0.33, 0.7]) b.rod([s.x, y - 0.014, s.z], [s.x, y + 0.014, s.z], bellyAt(y) + 0.01, bellyAt(y) + 0.01, rivets, G.stove);
  // the cooking plate, wider than the belly's top, with its rim
  const top = STOVE.plate;
  b.rod([s.x, top.y - 0.03, s.z], [s.x, top.y, s.z], bellyAt(top.y - 0.03), top.r - 0.02, iron, G.stove);
  b.rod([s.x, top.y, s.z], [s.x, top.y + top.thick, s.z], top.r, top.r, ironLight, G.stove);
  // the oval door, proud of the belly; the fire between its bars
  const door = STOVE.door, hinge = inBlock(s, 0, door.out - 0.045), front = inBlock(s, 0, door.out);
  b.blob([hinge.x, STOVE.mid, hinge.z], [door.w * 0.74, door.h * 0.8, 0.05], s.turn, ironLight, G.stove);
  const glass = b.box(front.x, front.z, door.w, 0.02, STOVE.mid - door.h / 2, STOVE.mid + door.h / 2, s.turn, lit ? fireGlass : coldGlass, G.stove);
  glass.shadow = false;
  const knob = inBlock(s, door.w * 0.66, door.out - 0.03);
  b.blob([knob.x, STOVE.mid, knob.z], [0.024, 0.04, 0.024], 0, plain(BRASS), G.stove);
  // the ash drawer under it
  const ash = inBlock(s, 0, bellyAt(0.27) - 0.01), pull = inBlock(s, 0, bellyAt(0.27) + 0.03);
  b.box(ash.x, ash.z, 0.17, 0.05, 0.235, 0.3, s.turn, ironLight, G.stove);
  b.blob([pull.x, 0.268, pull.z], [0.02, 0.015, 0.015], 0, plain(BRASS), G.stove);
  stovePipe(b, s, top.y + top.thick);
  // a fat copper kettle, its spout up
  const k = inBlock(s, -0.07, 0.1);
  const copper = plain(colour(0xc8703a), 0.2, 54);
  const y = top.y + top.thick;
  b.blob([k.x, y + 0.075, k.z], [0.1, 0.08, 0.1], 0, copper, G.stove + 101);
  b.rod([k.x, y + 0.14, k.z], [k.x, y + 0.17, k.z], 0.035, 0.014, plain(IRON), G.stove + 101);
  b.rod([k.x - 0.07, y + 0.07, k.z + 0.04], [k.x - 0.16, y + 0.15, k.z + 0.09], 0.024, 0.013, copper, G.stove + 101);
  logStack(b);
  const mouth = inBlock(s, 0, door.out + 0.1);
  return { ...leantPoint(LEANS.stove, { x: mouth.x, y: STOVE.mid, z: mouth.z }), glass };
}

/** A hoop round the stove: lighter iron with a dark rivet every few centimetres. */
function rivets(d: Dab): void {
  const along = d.u / 0.07;
  const rivet = d.face === 0 && Math.hypot((along - Math.round(along)) * 0.07, d.v - 0.014) < Math.max(0.009, d.fine * 0.7);
  tint(d, rivet ? colour(0x1c1c26) : colour(0x8a8ea2), 0.9 + 0.2 * noise2(d.u * 30, d.v * 30, 57));
}

/**
 * The stove's pipe, as the pipes of the 1991 rooms go: never straight up. From the back of the cooking plate it rises,
 * kinks toward the door, rises again and bends back into the bricks, with a paler collar at each joint.
 */
function stovePipe(b: Builder, s: { x: number; z: number; turn: number }, from: number): void {
  const w = wallTool('right');
  const pipe = plain(colour(0x40424f), 0.3, 53), collar = plain(colour(0x7a7e92), 0.2, 51);
  const R = 0.066;
  const foot = inBlock(s, 0.02, -0.12);
  const along = (a: number): V3 => [foot.x + w.along[0] * a, 0, foot.z + w.along[2] * a];
  const p = (a: number, y: number): V3 => [along(a)[0], y, along(a)[2]];
  const joints: V3[] = [p(0, from), p(-0.03, 1.22), p(0.2, 1.46), p(0.16, 1.84)];
  const last = joints[joints.length - 1]!;
  joints.push([last[0] - w.inward[0] * 0.8, 1.98, last[2] - w.inward[2] * 0.8]);
  for (let i = 0; i + 1 < joints.length; i++) {
    const a = joints[i]!, c = joints[i + 1]!;
    b.rod(a, c, R, R, pipe, G.stove);
    if (i === 0) continue;
    // an elbow: a ball to round the bend and a collar just past it
    b.blob(a, [R, R, R], 0, pipe, G.stove);
    const t = 0.07 / Math.hypot(c[0] - a[0], c[1] - a[1], c[2] - a[2]);
    const from2: V3 = [a[0] + (c[0] - a[0]) * t, a[1] + (c[1] - a[1]) * t, a[2] + (c[2] - a[2]) * t];
    const to2: V3 = [a[0] + (c[0] - a[0]) * t * 1.6, a[1] + (c[1] - a[1]) * t * 1.6, a[2] + (c[2] - a[2]) * t * 1.6];
    b.rod(from2, to2, R + 0.012, R + 0.012, collar, G.stove);
  }
  b.rod(p(0, from), p(0, from + 0.06), R + 0.018, R + 0.012, collar, G.stove);
}

/** Split logs stacked in the corner beside the stove, their pale ends toward the room. */
function logStack(b: Builder): void {
  const w = wallTool('right');
  const bark = plain(colour(0x5c3a21), 0.3, 55), cut = plain(colour(0xe6b06c), 0.25, 56);
  const logEnd = (d: Dab) => (d.face === 0 ? bark(d) : cut(d));
  const rows = [[0, 1, 2, 3], [0.5, 1.5, 2.5], [1, 2]];
  rows.forEach((row, level) => row.forEach((i) => {
    const r = 0.055 + 0.012 * hash2(i, level, 9);
    const a = 0.16 + i * 0.12;
    const from = w.p(a, 0.06 + level * 0.1, 0.06), to = w.p(a, 0.06 + level * 0.1, 0.5 + 0.06 * hash2(i, level, 4));
    b.rod(from, to, r, r, logEnd, G.wood + 100 + level * 10 + Math.floor(i * 2));
  }));
}

/** The bed with its head at the left wall: a wooden frame, a plump striped cover, two pillows, a folded blanket at the foot. */
function bed(b: Builder): { x: number; y: number; z: number; turn: number } {
  const w = wallTool('left');
  const head = 2.3;
  const c = onWall('left', head, 1.06);
  const turn = -ROOM.splay;
  const at = { x: c.x, z: c.z, turn };
  const frame = wood(colour(0xb86a34), 60, 'u');
  b.box(c.x, c.z, 2.04, 1.46, 0.08, 0.36, turn, frame, G.bed);
  b.box(c.x, c.z, 1.98, 1.4, 0.36, 0.5, turn, plain(LINEN, 0.1, 61), G.bed);
  const cover = stripes(LINEN, colour(0x6f8cb6), 0.22, 0.3);
  const dv = inBlock(at, 0.2, 0);
  b.box(dv.x, dv.z, 1.62, 1.5, 0.26, 0.55, turn, cover, G.bed);
  b.blob([dv.x, 0.52, dv.z], [0.86, 0.14, 0.76], turn, cover, G.bed);
  const lump = inBlock(at, 0.5, 0.2);
  b.blob([lump.x, 0.55, lump.z], [0.42, 0.12, 0.5], turn, cover, G.bed);
  for (const [lz, lean] of [[-0.36, 8], [0.34, -6]] as const) {
    const p = inBlock(at, -0.76, lz);
    b.blob([p.x, 0.62, p.z], [0.2, 0.11, 0.3], turn + lean, plain(colour(0xfbf6ea), 0.12, 62), G.bed + 100 + (lz > 0 ? 1 : 0));
  }
  const fold = inBlock(at, 0.86, 0);
  b.box(fold.x, fold.z, 0.3, 1.3, 0.55, 0.63, turn, (d) => {
    const check = (Math.floor((d.u + 2) / 0.11) + Math.floor((d.v + 2) / 0.11)) & 1;
    tint(d, check ? colour(0xb04a3e) : colour(0x8a2e2e), 0.95 + 0.1 * noise2(d.u * 12, d.v * 12, 3));
  }, G.bed + 102);
  // a headboard against the wall, its top arched between two posts with a ball on them
  b.onWall(w, head - 0.74, head + 0.74, 0.3, 0.86, 0, 0.05, frame, G.bed);
  const arch = (lx: number, top: number, rise: number): void => {
    const m = inBlock(at, lx, 0);
    b.blob([m.x, top, m.z], [0.03, rise, 0.7], turn, frame, G.bed);
    for (const lz of [-0.75, 0.75]) {
      const q = inBlock(at, lx, lz);
      b.rod([q.x, 0, q.z], [q.x, top + 0.08, q.z], 0.05, 0.042, frame, G.bed);
      b.blob([q.x, top + 0.13, q.z], [0.07, 0.07, 0.07], 0, frame, G.bed);
    }
  };
  arch(-1.0, 0.86, 0.16);
  // at the foot only the two posts, so the folded blanket shows
  for (const lz of [-0.75, 0.75]) {
    const q = inBlock(at, 1.04, lz);
    b.rod([q.x, 0, q.z], [q.x, 0.66, q.z], 0.05, 0.042, frame, G.bed);
    b.blob([q.x, 0.71, q.z], [0.07, 0.07, 0.07], 0, frame, G.bed);
  }
  const k = inBlock(at, 0.5, -0.08);
  return { x: k.x, y: 0.66, z: k.z, turn };
}

/** The desk under the left sea window with the blue lamp of the real room, books, and a chair with a green seat. */
function desk(b: Builder, lit: boolean): { x: number; y: number; z: number } {
  const top = wood(HONEY, 70, 'u'), leg = wood(colour(0x9a5e30), 71);
  b.box(-1.62, 0.4, 1.16, 0.62, 0.69, 0.75, 0, top, G.desk);
  b.box(-1.62, 0.4, 1.0, 0.5, 0.57, 0.69, 0, leg, G.desk);
  // legs that taper to the floor and stand a little apart at the foot
  for (const [x, z] of [[-2.1, 0.17], [-1.14, 0.17], [-2.1, 0.63], [-1.14, 0.63]] as const) {
    b.rod([x + Math.sign(x + 1.62) * 0.03, 0, z], [x, 0.57, z], 0.026, 0.046, leg, G.desk);
  }
  b.blob([-1.62, 0.655, 0.655], [0.03, 0.02, 0.015], 0, plain(BRASS), G.desk);
  // the lamp: a blue pot, a pale shade
  const lx = -1.92, lz = 0.36;
  b.blob([lx, 0.84, lz], [0.075, 0.095, 0.075], 0, plain(colour(0x2f5aa8), 0.15, 72), G.desk + 100);
  b.rod([lx, 0.92, lz], [lx, 1.0, lz], 0.016, 0.016, plain(BRASS), G.desk + 100);
  const shade = b.rod([lx, 0.98, lz], [lx, 1.17, lz], 0.15, 0.085, (d) => {
    tint(d, colour(0xfff0c8), 0.95 + 0.1 * noise2(d.u * 30, d.v * 30, 7));
    d.emit = lit ? 0.95 : 0;
  }, G.desk + 101);
  shade.shadow = false;
  // two small books lying crooked on each other, and a sheet of music that hangs over the desk's front edge
  book(b, { x: -1.36, z: 0.36, y: 0.75, w: 0.25, d: 0.18, h: 0.05, turn: 14, back: 1, cover: COVERS[0]!, seed: 102 }, G.desk + 102);
  book(b, { x: -1.38, z: 0.35, y: 0.8, w: 0.22, d: 0.16, h: 0.042, turn: -22, back: -1, cover: COVERS[1]!, seed: 103 }, G.desk + 103);
  const droop: Hang = { side: 'near', out: 0.1, curl: 0.02, corner: [-1, -1] };
  b.bent(-1.68, 0.62, 0.26, 0.34, 0.75 + SHEET, 8, sheetLift(0.26, 0.34, droop), looseSheet(0.26, 0.34, 21), G.desk + 105);
  b.rod([-1.6, 0.75, 0.25], [-1.6, 0.84, 0.25], 0.035, 0.04, plain(colour(0xe6effa), 0.1), G.desk + 104);
  chair(b);
  return leantPoint(LEANS.desk, { x: lx, y: 1.02, z: lz });
}

/**
 * The desk's chair, a spindle-back as the 1991 rooms have them (the map maker's): a thick seat with a green cushion on
 * four splayed legs, and a back of thin spindles under a bowed rail, the two outer posts leaning apart.
 */
function chair(b: Builder): void {
  const ch = { x: -1.5, z: 1.02, turn: 28 };
  const wd = wood(colour(0xa86a36), 73);
  const cp = (lx: number, y: number, lz: number): V3 => { const q = inBlock(ch, lx, lz); return [q.x, y, q.z]; };
  b.box(ch.x, ch.z, 0.44, 0.42, 0.41, 0.46, ch.turn, wd, G.chair);
  b.blob([ch.x, 0.47, ch.z], [0.19, 0.045, 0.18], ch.turn, plain(GREEN, 0.2, 74), G.chair);
  for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]] as const) b.rod(cp(sx * 0.24, 0, sz * 0.22), cp(sx * 0.16, 0.42, sz * 0.15), 0.02, 0.03, wd, G.chair);
  // the bowed rail: highest in the middle, on two posts and four spindles
  const rail = (lx: number): number => 0.97 - 1.1 * lx * lx;
  const backZ = 0.19;
  const xs = [-0.23, -0.14, -0.05, 0.05, 0.14, 0.23];
  for (let i = 0; i + 1 < xs.length; i++) b.rod(cp(xs[i]!, rail(xs[i]!), backZ + 0.02), cp(xs[i + 1]!, rail(xs[i + 1]!), backZ + 0.02), 0.028, 0.028, wd, G.chair);
  xs.forEach((lx, i) => {
    const post = i === 0 || i === xs.length - 1;
    b.rod(cp(lx * (post ? 0.8 : 0.85), 0.46, backZ), cp(lx, rail(lx), backZ + 0.02), post ? 0.022 : 0.011, post ? 0.022 : 0.011, wd, G.chair);
  });
}

/** The hallway behind the door: how far it runs straight on from the doorway, and how much wider than the door it is on each side, in metres. */
const HALL = { length: 5, side: 0.16, height: 2.3 } as const;

/** A coat on its peg, seen flat: the loop and collar at the top, the shoulders, the sleeves hanging at its sides, the hem. `u` from its middle, `v` up from the hem. */
function coatShape(u: number, v: number): boolean {
  const x = Math.abs(u - 0.3);
  if (v > 1.06) return x < 0.02;
  if (v > 0.96) return x < 0.05 + (1.06 - v) * 1.7;
  const body = 0.2 + 0.035 * Math.sin(v * 5.2) + (v < 0.12 ? -0.02 * Math.abs(Math.sin(u * 34)) : 0);
  const sleeve = v > 0.3 ? 0.27 - 0.03 * ((v - 0.3) / 0.66) : 0;
  return x < Math.max(body, sleeve) && v > 0.012 * Math.abs(Math.sin(u * 40));
}

/** The warden's oilskin: yellow, in long folds, a dark line down its front and a darker collar. */
function oilskin(d: Dab): void {
  const x = d.u - 0.3;
  const fold = 0.8 + 0.2 * Math.sin(d.u * 38 + Math.sin(d.v * 3.1) * 1.4);
  if (d.v > 0.93) return tint(d, colour(0x8a5a10), fold);
  if (Math.abs(x) < Math.max(0.008, d.fine * 0.6)) return tint(d, colour(0x8a5a10), 0.8);
  // a little light of its own: the yellow stays yellow in the hallway's dim, cool light
  d.emit = 0.22;
  if (Math.abs(x) > 0.2 && d.v > 0.3) return tint(d, colour(0xd9a521), fold * 0.78);
  tint(d, colour(0xe8b830), fold);
}

/**
 * The hallway the door leads to (the door actually leads to a hallway; just render a wall there
 * with perhaps a coat hanger, and it goes straight ahead): a passage that runs on from the doorway, away from the
 * room. From where the viewer stands the doorway shows its floor and the wall on the stove's side going away: painted
 * boards below, plaster above, and a row of pegs with the warden's oilskin, a cap and a scarf. The things on the pegs
 * are props.
 */
function hallway(b: Builder, w: WallTool): void {
  const p = ROOM.door, left = p.a0 - HALL.side, right = p.a1 + HALL.side, H = HALL.height;
  /** A point `s` metres down the hallway from the room wall's far face, `y` up and `out` metres from its left wall. */
  const at = (s: number, y: number, out = 0): V3 => w.p(left + out, y, -ROOM.wall - s);
  const away = times(w.inward, -1), turn = Math.atan2(away[2], away[0]);
  const boards = colour(0x5c6680);
  b.add(new Flat(at(0, 0), times(away, HALL.length), [0, H, 0], (d) => {
    if (d.v > 1.1) return plaster(WHITE, 85)(d);
    if (d.v > 1.04 || d.v < 0.1) return tint(d, colour(0x343c64), 0.9 + 0.2 * noise2(d.u * 20, d.v * 20, 86));
    const gap = (d.u % 0.13) < Math.max(0.014, d.fine * 0.7);
    tint(d, boards, gap ? 0.6 : 0.88 + 0.24 * fbm(d.u * 1.5, d.v * 9, 2, 87));
  }), G.door);
  b.add(new Flat(at(0, 0, right - left), times(away, HALL.length), [0, H, 0], plaster(WHITE, 90)), G.door);
  b.add(new Flat(at(HALL.length, 0), times(w.along, right - left), [0, H, 0], plaster(WHITE, 95)), G.door);
  b.add(new Flat(at(0, 0), times(w.along, right - left), times(away, HALL.length), planks(colour(0x6a3a22), 0.145, 88)), G.door);
  b.add(new Flat(at(0, H), times(w.along, right - left), times(away, HALL.length), plaster(WHITE, 89)), G.door);
  // the row of pegs on the left wall
  b.add(new Box(at(0.8, 1.65, 0.015), [0.66, 0.05, 0.015], turn, wood(DARK_WOOD, 91, 'u')), G.door);
  for (const s of [0.3, 0.8, 1.3]) b.rod(at(s, 1.65, 0.03), at(s, 1.69, 0.13), 0.013, 0.016, wood(DARK_WOOD, 92), G.door);
  // a dark blue cap, the oilskin, a red scarf
  const scarf = b.add(new Flat(at(1.3 - 0.065, 0.82, 0.09), times(away, 0.13), [0, 0.86, 0], (d) => {
    tint(d, Math.floor(d.v / 0.07) % 3 === 0 ? LINEN : RED, 0.85 + 0.2 * Math.sin(d.u * 60));
  }), G.door);
  scarf.mask = (u, v) => v > 0.03 * Math.abs(Math.sin(u * 90)) && Math.abs(u - 0.065) < 0.065 - 0.02 * Math.sin(v * 6);
  const coat = b.add(new Flat(at(0.8 - 0.3, 0.6, 0.1), times(away, 0.6), [0, 1.1, 0], oilskin), G.door);
  coat.mask = coatShape;
  b.blob(at(0.3, 1.6, 0.11), [0.085, 0.075, 0.085], 0, plain(NAVY, 0.2, 93), G.door);
  b.blob(at(0.3, 1.55, 0.16), [0.1, 0.022, 0.1], 0, plain(colour(0x14204a), 0.1, 94), G.door);
}

/**
 * The door to the hallway, shut at rest: boards in a frame on two iron strap hinges at the stove's side. Awake it stands
 * open: the leaf swung into the room on those hinges, so the viewer sees its far side and, past it, the doorway through
 * the thick wall and the hallway's wall with its pegs.
 */
function door(b: Builder, awake: boolean): void {
  const w = wallTool('right');
  const p = ROOM.door;
  b.leant({ at: w.p((p.a0 + p.a1) / 2, 0), x: ROOM.lean.door * w.along[0], z: ROOM.lean.door * w.along[2] }, () => doorParts(b, w, awake));
  if (awake) hallway(b, w);
}

function doorParts(b: Builder, w: WallTool, awake: boolean): void {
  const p = ROOM.door;
  // a fat frame darker than the leaf, its head over-sailing it, and a threshold step (the 1991 rooms' doors, mi2-bg-1-055, 1-056)
  const frame = wood(DOOR_FRAME, 80);
  b.onWall(w, p.a0 - 0.14, p.a0, 0, p.y1 + 0.14, 0, 0.06, frame, G.door);
  b.onWall(w, p.a1, p.a1 + 0.14, 0, p.y1 + 0.14, 0, 0.06, frame, G.door);
  b.onWall(w, p.a0 - 0.2, p.a1 + 0.2, p.y1 + 0.1, p.y1 + 0.2, 0, 0.09, frame, G.door);
  b.onWall(w, p.a0 - 0.16, p.a1 + 0.16, 0, 0.045, 0, 0.13, wood(colour(0x8a5430), 83, 'u'), G.door);
  const lw = p.a1 - p.a0, brass = plain(BRASS, 0.1), iron = plain(IRON, 0.2, 84);
  if (!awake) {
    b.onWall(w, p.a0, p.a1, 0.01, p.y1, 0, 0.02, doorLeaf(lw, p.y1 - 0.01), G.door);
    for (const y of [0.34, 1.62]) {
      b.onWall(w, p.a0 - 0.02, p.a0 + 0.36, y - 0.028, y + 0.028, 0.02, 0.03, iron, G.door);
      b.rod(w.p(p.a0 - 0.01, y - 0.07, 0.035), w.p(p.a0 - 0.01, y + 0.07, 0.035), 0.016, 0.016, iron, G.door);
    }
    b.blob(w.p(p.a1 - 0.1, 1.02, 0.06), [0.035, 0.035, 0.035], 0, brass, G.door);
    b.onWall(w, p.a1 - 0.14, p.a1 - 0.06, 0.94, 1.1, 0.02, 0.028, brass, G.door);
    return;
  }
  const th = DOOR_SWING * RAD;
  const dx = Math.cos(th) * w.along[0] + Math.sin(th) * w.inward[0], dz = Math.cos(th) * w.along[2] + Math.sin(th) * w.inward[2];
  const hinge = w.p(p.a0, 0, 0.01);
  b.add(new Box([hinge[0] + dx * lw / 2, (0.01 + p.y1) / 2, hinge[2] + dz * lw / 2], [lw / 2, (p.y1 - 0.01) / 2, 0.02], Math.atan2(dz, dx), doorLeaf(lw, p.y1 - 0.01)), G.door);
  for (const y of [0.34, 1.62]) b.rod(w.p(p.a0 - 0.01, y - 0.07, 0.035), w.p(p.a0 - 0.01, y + 0.07, 0.035), 0.016, 0.016, iron, G.door);
  // the knob on the leaf's room side, and the one outside
  for (const side of [1, -1]) b.blob([hinge[0] + dx * (lw - 0.1) + side * dz * 0.06, 1.02, hinge[2] + dz * (lw - 0.1) - side * dx * 0.06], [0.035, 0.035, 0.035], 0, brass, G.door);
  // the doorway through the wall: its reveal and the worn threshold
  const reveal = plaster(TRIM, 81);
  b.onWall(w, p.a0 - 0.02, p.a0, 0, p.y1, -ROOM.wall, 0, reveal, G.door);
  b.onWall(w, p.a1, p.a1 + 0.02, 0, p.y1, -ROOM.wall, 0, reveal, G.door);
  b.onWall(w, p.a0, p.a1, p.y1, p.y1 + 0.02, -ROOM.wall, 0, reveal, G.door);
  b.onWall(w, p.a0, p.a1, -0.02, 0.025, -ROOM.wall, 0.03, wood(DARK_WOOD, 82, 'u'), G.door);
}

function easel(b: Builder, awake: boolean): void {
  const e: Block = ROOM.easel;
  const wd = wood(colour(0xb07840), 90);
  const at = (lx: number, lz: number, y: number): V3 => {
    const q = inBlock(e, lx, lz);
    return [q.x, y, q.z];
  };
  b.rod(at(-0.3, 0.2, 0), at(-0.1, -0.02, 1.5), 0.02, 0.016, wd, G.easel);
  b.rod(at(0.3, 0.2, 0), at(0.1, -0.02, 1.5), 0.02, 0.016, wd, G.easel);
  b.rod(at(0, -0.24, 0), at(0, -0.02, 1.46), 0.02, 0.016, wd, G.easel);
  b.rod(at(-0.34, 0.2, 0.62), at(0.34, 0.2, 0.62), 0.018, 0.018, wd, G.easel);
  const bw = 0.72, bh = 0.54;
  const o = at(-bw / 2, 0.21, 0.66), right = at(bw / 2, 0.21, 0.66), up = at(-bw / 2, 0.06, 0.66 + bh);
  b.add(new Flat(o, [right[0] - o[0], 0, right[2] - o[2]], [up[0] - o[0], up[1] - o[1], up[2] - o[2]], board(bw, Math.hypot(bh, 0.15), awake)), G.easel);
}

/**
 * The chest under the lighthouse window, with the warden's brass spyglass and a rolled sea chart lying on it: a quiet
 * thing, no button. The gramophone that stood here went (remove the gramophone; all
 * non-piano trainers and minigames are done through the stand), and the ear trainer opens from the stand's panel.
 */
function chest(b: Builder): void {
  const e: Block = ROOM.chest;
  const boards = wood(colour(0x8a5228), 100, 'u');
  b.box(e.x, e.z, e.w, e.d, 0, 0.58, e.turn, (d) => {
    boards(d);
    // two iron bands round it and a hasp at the front
    if (Math.abs(Math.abs(d.u) - 0.28) < Math.max(0.02, d.fine * 0.7) && d.face !== 3) tint(d, IRON);
    if (d.face === 0 && Math.abs(d.u) < 0.045 && d.v > 0.4 && d.v < 0.54) tint(d, colour(0x4a4652));
  }, G.chest);
  b.box(e.x, e.z, e.w + 0.03, e.d + 0.03, 0.58, 0.63, e.turn, boards, G.chest);
  const top = 0.63;
  // the spyglass, lying a little across the lid: a barrel in dark leather, then two brass draws, each narrower, with a
  // dark ring at each joint (pale brass alone washes out to the chart's colour in the sun)
  const leather = plain(colour(0x5a2e16), 0.2, 107), brass = plain(colour(0xc08a28), 0.25, 102), ring = plain(colour(0x6a3a14), 0.2, 105);
  const along = (t: number, side: number, r: number): V3 => {
    const p = inBlock(e, side - t * 0.24, -0.24 + t * 0.5);
    return [p.x, top + r, p.z];
  };
  const draws = [[0, 0.42, 0.052], [0.42, 0.7, 0.042], [0.7, 0.86, 0.034]] as const;
  draws.forEach(([from, to, r], i) => {
    b.rod(along(from, 0.12, 0.052), along(to, 0.12, 0.052), r, r, i === 0 ? leather : brass, G.chest + 100);
    b.rod(along(to - 0.025, 0.12, 0.052), along(to, 0.12, 0.052), r + 0.007, r + 0.007, i === 0 ? brass : ring, G.chest + 100);
  });
  b.rod(along(0, 0.12, 0.052), along(0.04, 0.12, 0.052), 0.058, 0.058, brass, G.chest + 100);
  // the lens: a dark round at the wide end with a speck of sky in it
  const lens = along(0, 0.12, 0.052);
  b.blob([lens[0], lens[1], lens[2] - 0.004], [0.044, 0.044, 0.012], e.turn, (d) => {
    tint(d, colour(0x1c2436));
    if (d.u < -0.3 && d.v > 0.3) tint(d, colour(0xb4c3d8));
  }, G.chest + 100);
  // the chart, rolled and tied with a red string, behind the spyglass
  const a = inBlock(e, -0.14, -0.3), z = inBlock(e, -0.12, 0.2);
  const paper: Material = (d) => {
    tint(d, colour(0xcdb27e));
    if (d.face === 0 && Math.abs(d.v - 0.31) < 0.02) tint(d, colour(0xa83a2c));
  };
  b.rod([a.x, top + 0.06, a.z], [z.x, top + 0.06, z.z], 0.06, 0.06, paper, G.chest + 101);
}

/** The framed lighthouse photographs on the left wall over the bed's head. */
function photos(b: Builder): void {
  const w = wallTool('left');
  const frames: readonly (readonly [number, number, number, number])[] = [
    [1.72, 1.58, 0.3, 0.42], [2.1, 1.6, 0.3, 0.42], [2.48, 1.56, 0.34, 0.46],
    [1.7, 1.12, 0.46, 0.34], [2.24, 1.1, 0.46, 0.34], [2.9, 1.3, 0.4, 0.5],
  ];
  frames.forEach(([a, y, fw, fh], n) => {
    b.add(new Flat(w.p(a, y, 0.02), times(w.along, fw), [0, fh, 0], photo(fw, fh, n)), 200 + n);
  });
}

/** The mug's radius and height: fatter than a real one, as the tankards on the tables of the 1991 game (mi2-bg-2-039). */
const MUG_R = 0.06, MUG_H = 0.105;

/**
 * The warden's mug of tea, painted in the room's light like everything round it (it was a flat sprite with a black
 * line): a fat cream body with a blue lip, a blue stripe and a blue handle, so its shape reads in the table's shade; dark tea inside.
 */
function mug(b: Builder, at: { x: number; y: number; z: number }): void {
  const cream = colour(0xf4e2bc), stripe = colour(0x5c80b8), tea = colour(0x5a2e14);
  // pot-bellied and a little askew: a lower half that swells, an upper half that draws in to the lip
  const belly = at.y + MUG_H * 0.5, lean = 0.008;
  const side = (from: number) => (d: Dab) => {
    const t = (from + d.v) / MUG_H;
    tint(d, t > 0.86 || (t > 0.48 && t < 0.62) ? stripe : cream, 1.25);
  };
  b.rod([at.x, at.y, at.z], [at.x + lean / 2, belly, at.z], MUG_R * 0.94, MUG_R * 1.1, side(0), G.table + 100);
  b.rod([at.x + lean / 2, belly, at.z], [at.x + lean, at.y + MUG_H, at.z], MUG_R * 1.1, MUG_R, (d) => {
    // the top: a broad pale ring of the lip all round, the dark tea well inside it
    if (d.face === 2) return Math.hypot(d.u, d.v) > MUG_R * 0.64 ? tint(d, cream, 1.3) : tint(d, tea);
    side(MUG_H * 0.5)(d);
  }, G.table + 100);
  // the handle: a thick C on the mug's right, from under the rim to near its foot
  const handle = plain(stripe, 0.15, 105), hx = at.x + MUG_R * 0.95, out = 0.048;
  const ring: V3[] = [[hx, at.y + 0.085, at.z], [hx + out, at.y + 0.08, at.z], [hx + out + 0.008, at.y + 0.05, at.z], [hx + out, at.y + 0.022, at.z], [hx, at.y + 0.02, at.z]];
  for (let i = 0; i + 1 < ring.length; i++) b.rod(ring[i]!, ring[i + 1]!, 0.019, 0.019, handle, G.table + 100);
}

/** A small round table by the bed with a book on it and the warden's mug of tea. */
function teaTable(b: Builder): { x: number; y: number; z: number } {
  const x = -1.02, z = 2.78;
  const wd = wood(colour(0xa06838), 110);
  b.rod([x, 0.475, z], [x, 0.535, z], 0.27, 0.29, wd, G.table);
  // a fat turned post: a bulb low down, a waist, a collar under the top
  b.rod([x, 0.1, z], [x, 0.24, z], 0.05, 0.085, wd, G.table);
  b.rod([x, 0.24, z], [x, 0.4, z], 0.085, 0.04, wd, G.table);
  b.rod([x, 0.4, z], [x, 0.475, z], 0.04, 0.1, wd, G.table);
  for (let i = 0; i < 3; i++) {
    const a = i * 2.094 + 1.1;
    b.rod([x, 0.14, z], [x + Math.cos(a) * 0.24, 0.02, z + Math.sin(a) * 0.24], 0.04, 0.028, wd, G.table);
  }
  book(b, { x: x + 0.08, z: z - 0.06, y: 0.535, w: 0.23, d: 0.16, h: 0.04, turn: 20, back: 1, cover: COVERS[3]!, seed: 100 }, G.table + 100);
  const spot = { x: x - 0.08, y: 0.535, z: z + 0.07 };
  mug(b, spot);
  return spot;
}

/**
 * What stands nearest the viewer and frames the picture, as the foreground of a painted adventure room does (d111):
 * a brace under the ceiling in each top corner, a sea chest with books, sheet music and rolled maps on the left,
 * stacks of the warden's music on the right; the paper has `pages` of light of its own. Nothing here is a button,
 * and nothing stands in front of one.
 */
function foreground(b: Builder, pages: number): void {
  const timber = plain(colour(0x4a2818), 0.35, 140);
  b.rod([-2.7, 1.29, 3.6], [-0.9, 2.33, 3.6], 0.1, 0.1, timber, FOREGROUND);
  b.rod([2.7, 1.35, 3.6], [1.2, 2.3, 3.6], 0.095, 0.095, timber, FOREGROUND + 100);
  // over each brace the roof's near boards, in the dark and plain: a calm field under the door, the backpack and the gear
  const roof = plain(colour(0x3a2418), 0.08, 144);
  b.rod([-3.4, 1.5, 3.52], [-0.7, 3.05, 3.52], 0.42, 0.42, roof, FOREGROUND + 102);
  b.rod([3.4, 1.62, 3.52], [0.4, 3.05, 3.52], 0.46, 0.46, roof, FOREGROUND + 103);

  // the sea chest, its front turned to the viewer
  const chest = { x: -1.2, z: 4.02, turn: 38 };
  // its front of broad boards laid level, each its own tone with a dark seam, a lock plate in the middle (rule 25: worn, not made in a factory)
  const boards = planks(colour(0x8a5230), 0.13, 141, 'u'), strap = plain(IRON, 0.2, 142);
  const oak: Material = (d) => {
    boards(d);
    if (d.face === 0 && Math.abs(d.u) < 0.05 && d.v > 0.42 && d.v < 0.56) tint(d, colour(0x6a6470));
    if (d.face === 0 && Math.abs(d.u) < 0.012 && d.v > 0.44 && d.v < 0.5) tint(d, colour(0x1c1820));
  };
  b.box(chest.x, chest.z, 0.95, 0.5, 0, 0.62, chest.turn, oak, FOREGROUND + 101);
  b.box(chest.x, chest.z, 0.99, 0.54, 0.62, 0.68, chest.turn, oak, FOREGROUND + 101);
  for (const lx of [-0.3, 0.3]) {
    const p = inBlock(chest, lx, 0);
    b.box(p.x, p.z, 0.06, 0.56, 0, 0.69, chest.turn, strap, FOREGROUND + 101);
  }
  // books as the library of the 1991 game has them: small, warm, each lying crooked on the one under it (the pile no
  // higher than the lid of the chest behind it), and a sheet of the warden's music on them
  const pile = inBlock(chest, 0.27, 0.0);
  const books = [[0.27, 0.19, 0.05, 6, 1, 0], [0.24, 0.17, 0.042, -15, -1, 2], [0.25, 0.18, 0.05, 20, 1, 3], [0.2, 0.15, 0.038, -8, 1, 4]] as const;
  let y = 0.68;
  books.forEach(([w, d, h, lean, back, cover], i) => {
    const at = inBlock(chest, 0.27 + 0.02 * (i % 2 ? 1 : -1), 0.01 * (i - 1));
    book(b, { x: at.x, z: at.z, y, w, d, h, turn: chest.turn + lean, back, cover: COVERS[cover]!, seed: 143 + i }, PAPERS + 150 + i);
    y += h;
  });
  b.bent(pile.x, pile.z, 0.24, 0.2, y + SHEET, chest.turn - 12, sheetLift(0.24, 0.2, { side: 'none', out: 0, curl: 0.03, corner: [1, 1] }), looseSheet(0.24, 0.2, 7, pages), PAPERS + 160);
  chartBasket(b, inBlock(chest, -0.1, -0.02));

  music(b, pages);
}

/** A rolled chart: where it stands in the basket's mouth, how it leans, its length and thickness, its paper. */
export interface ChartRoll { foot: readonly [number, number]; rim: readonly [number, number]; len: number; r: number; paper: number }

/**
 * The rolls in the basket, none like another: thick and thin, long and short, old yellowed paper and a blue-grey sea
 * chart. Each stands on the basket's bottom (`foot`, metres from its middle) and leans on its rim (`rim`), so none goes
 * through the wicker; none leans far toward the viewer, where its open end would stare out of the picture.
 */
export const CHART_ROLLS: readonly ChartRoll[] = [
  { foot: [-0.03, -0.01], rim: [-0.075, -0.03], len: 0.66, r: 0.034, paper: 0xf6e8bc },
  { foot: [0.02, -0.03], rim: [0.02, -0.08], len: 0.74, r: 0.026, paper: 0xe9d7a2 },
  { foot: [0.035, 0.01], rim: [0.085, 0.0], len: 0.56, r: 0.04, paper: 0xf2e2b4 },
  { foot: [-0.01, 0.03], rim: [-0.03, 0.065], len: 0.47, r: 0.03, paper: 0xc9d3d6 },
  { foot: [0.0, 0.0], rim: [0.035, 0.04], len: 0.6, r: 0.022, paper: 0xdcc890 },
];

/** The basket's shape: it stands on `y0`, bulges to `wide` at `belly` and draws in a little to its rim at `y1` (radii in metres). */
export const BASKET = { y0: 0.68, belly: 0.82, y1: 0.95, foot: 0.095, wide: 0.142, mouth: 0.13 } as const;

/**
 * A wicker basket of rolled charts on the sea chest: woven in rows, each row lit along its top, with the stakes' shade
 * between; a rope rim and a foot ring; dark inside. The rolls are tied with a red ribbon, each at its own height.
 */
function chartBasket(b: Builder, at: { x: number; z: number }): void {
  const B = BASKET;
  const wicker = (d: Dab): void => {
    if (d.face !== 0) return tint(d, DARK_WOOD, d.face === 2 ? 0.22 : 0.5);
    const row = Math.floor(d.v / 0.021), inRow = d.v / 0.021 - row;
    const across = d.u / 0.042 + (row & 1) * 0.5, stake = across - Math.floor(across) < 0.2;
    tint(d, HONEY, (0.74 + 0.34 * inRow) * (stake ? 0.68 : 1) * (0.9 + 0.2 * hash2(Math.floor(across), row, 160)));
  };
  const rope = (d: Dab): void => tint(d, HONEY, d.face !== 0 ? 0.5 : 0.62 + 0.3 * (Math.floor((d.u + d.v * 1.4) / 0.018) & 1));
  const g = FOREGROUND + 130;
  b.rod([at.x, B.y0, at.z], [at.x, B.belly, at.z], B.foot, B.wide, wicker, g);
  b.rod([at.x, B.belly, at.z], [at.x, B.y1, at.z], B.wide, B.mouth, wicker, g);
  b.rod([at.x, B.y0, at.z], [at.x, B.y0 + 0.022, at.z], B.foot + 0.008, B.foot + 0.012, rope, g);
  b.rod([at.x, B.y1 - 0.012, at.z], [at.x, B.y1 + 0.016, at.z], B.mouth + 0.012, B.mouth + 0.008, rope, g);
  CHART_ROLLS.forEach((roll, i) => {
    const paper = colour(roll.paper), tie = roll.len * (0.5 + 0.09 * (i % 3));
    const skin = (d: Dab): void => {
      // the open end: the paper's coil round a small dark middle
      if (d.face !== 0) return tint(d, paper, Math.hypot(d.u, d.v) < roll.r * 0.38 ? 0.4 : 0.86);
      if (Math.abs(d.v - tie) < 0.016) return tint(d, RED, 1.15);
      // the sheet's edge runs along the roll; the paper is foxed and darker toward its foot
      const edge = Math.abs(d.u - roll.r * 1.2) < d.fine * 0.7 ? 0.78 : 1;
      tint(d, paper, (0.98 + 0.12 * noise2(d.u * 50, d.v * 18, 150 + i)) * edge * (0.9 + 0.1 * Math.min(1, d.v / 0.3)));
    };
    // from its foot through its place on the rim, and on as far as it is long
    const rise = B.y1 - (B.y0 + 0.03), k = roll.len / Math.hypot(rise, roll.rim[0] - roll.foot[0], roll.rim[1] - roll.foot[1]);
    const foot: V3 = [at.x + roll.foot[0], B.y0 + 0.03, at.z + roll.foot[1]];
    const top: V3 = [foot[0] + (roll.rim[0] - roll.foot[0]) * k, foot[1] + rise * k, foot[2] + (roll.rim[1] - roll.foot[1]) * k];
    b.rod(foot, top, roll.r, roll.r * (0.9 + 0.05 * i), skin, FOREGROUND + 131 + i);
  });
}

/**
 * The stacks of the warden's music by the door (stacks of music notation, the pages should
 * show notes, hand written, crossed out and rewritten; and of the first try, slabs: the books and paper still looked like
 * blocks of stone): ragged piles of thin sagging sheaves with a book or a stray sheet between them, loose sheets that
 * droop and curl on top, a fat roll on the tall one (`roomPapers`). Each piece is its own thing, so each gets its line.
 */
function music(b: Builder, glow: number): void {
  const flat: Hang = { side: 'none', out: 0, curl: 0, corner: [1, 1] };
  for (const p of musicStacks()) {
    const group = PAPERS + p.seed;
    if (p.kind === 'sheet') b.bent(p.x, p.z, p.w, p.d, p.y1, p.turn, sheetLift(p.w, p.d, p.hang ?? flat), looseSheet(p.w, p.d, p.seed, glow, LARGE_HAND), group);
    else if (p.kind === 'book') book(b, { x: p.x, z: p.z, y: p.y0, w: p.w, d: p.d, h: p.y1 - p.y0, turn: p.turn, back: p.seed % 2 ? 1 : -1, cover: COVERS[p.seed % COVERS.length]!, seed: p.seed }, group);
    else if (p.y0 === 0) b.box(p.x, p.z, p.w, p.d, p.y0, p.y1, p.turn, sheaf(p.w, p.d, p.y1 - p.y0, p.seed, glow), group);
    else b.bent(p.x, p.z, p.w, p.d, p.y1, p.turn, sagging(p.w, p.d, 0.01, p.seed), sheaf(p.w, p.d, p.y1 - p.y0, p.seed, glow, LARGE_HAND), group, p.y1 - p.y0 + 0.01, p.seed);
  }
  for (const r of musicRolls()) {
    const len = Math.hypot(r.b[0] - r.a[0], r.b[1] - r.a[1], r.b[2] - r.a[2]);
    b.rod(r.a, r.b, r.r, r.r, paperRoll(r.r, len, r.seed, glow), PAPERS + 120 + r.on);
  }
}

/**
 * How the furniture leans (`Lean`): nothing stands plumb or square, each thing its own way, and the stove is a fat
 * pot-bellied one (the rooms of the 1991 game; quirk is good). A thing that carries a living
 * sprite (the piano's metronome and plant, the table's mug) hands its spot through `leantPoint`.
 */
const LEANS = {
  ...ROOM.leans,
  stove: { at: [onWall('right', 0.98, 0.62).x, 0, onWall('right', 0.98, 0.62).z], x: -0.07, z: 0.03, fat: 1.1, tall: 1.08 },
  desk: { at: [-1.62, 0, 0.4], x: 0.075, tilt: 0.05 },
  table: { at: [-1.02, 0, 2.78], x: 0.07, tilt: -0.04 },
} as const satisfies Record<string, Lean>;


/** A storm lantern on a hook between the bricks and the door. */
function lantern(b: Builder, lit: boolean): { x: number; y: number; z: number } {
  const w = wallTool('right');
  const c = w.p(ROOM.bricks.a1 + 0.2, 1.5, 0.13);
  const metal = plain(colour(0x4a5682), 0.2, 120);
  b.rod([c[0], c[1] - 0.1, c[2]], [c[0], c[1] - 0.07, c[2]], 0.055, 0.05, metal, G.lantern);
  const glass = b.rod([c[0], c[1] - 0.07, c[2]], [c[0], c[1] + 0.07, c[2]], 0.04, 0.045, (d) => {
    tint(d, lit ? colour(0xffe27a) : colour(0xb4c3d8));
    d.emit = lit ? 1.2 : 0;
  }, G.lantern);
  glass.shadow = false;
  b.rod([c[0], c[1] + 0.07, c[2]], [c[0], c[1] + 0.12, c[2]], 0.05, 0.02, metal, G.lantern);
  b.rod([c[0], c[1] + 0.12, c[2]], w.p(ROOM.bricks.a1 + 0.2, 1.72, 0.01), 0.008, 0.008, plain(IRON), G.lantern);
  return { x: c[0], y: c[1], z: c[2] };
}

// ---- the hour ----

interface Hour {
  ambient: Colour;
  /** The way to the sun (or the moon) for the light it throws, and its colour. */
  toSun: V3;
  sun: Colour;
  /** How bright the daylight from the windows is, and how it is tinted (toward yellow by day, lilac at dawn, the moon's blue at night). */
  windows: number;
  tint: Colour;
  /** How strongly the lamps burn: not at all by day, low at dawn when the morning takes over. */
  lamps: number;
  /** Whether the stove burns: only at dusk and by night (fire only at night and dusk). */
  fire: boolean;
  /** How much light of its own the foreground's paper has, so that a page in the shade by the door is still read; little by night. Kept under the painter's `HOT`, or the paper would be laid flat. */
  pages: number;
}

function towards(x: number, y: number, z: number): V3 {
  const l = Math.hypot(x, y, z);
  return [x / l, y / l, z / l];
}

/** How much of a window's daylight comes back from the room's near end. */
const FILL = 0.3;
/** How much of it reaches the near things' faces from behind the viewer, and by night the moon's cool light there instead. */
const NEAR_FILL = 0.35;
const NEAR_MOON = [0.75, 0.9, 1.6] as const;

const HOURS: Record<SkyPhase, Hour> = {
  day: { ambient: [0.34, 0.3, 0.38], toSun: towards(-0.22, 0.72, -1), sun: [1.2, 1.1, 0.9], windows: 0.9, tint: [1.12, 1.02, 0.84], lamps: 0, fire: false, pages: 0.22 },
  dawn: { ambient: [0.27, 0.25, 0.4], toSun: towards(-1, 0.24, -0.42), sun: [1.2, 0.78, 0.72], windows: 0.42, tint: [0.92, 0.84, 1.2], lamps: 0.55, fire: false, pages: 0.2 },
  dusk: { ambient: [0.27, 0.22, 0.32], toSun: towards(0.34, 0.2, -1), sun: [1.2, 0.74, 0.5], windows: 0.34, tint: [1.2, 0.98, 0.74], lamps: 0.9, fire: true, pages: 0.2 },
  night: { ambient: [0.095, 0.105, 0.2], toSun: towards(0.34, 0.42, -1), sun: [0.3, 0.42, 0.7], windows: 0.3, tint: [0.92, 1.06, 1.34], lamps: 1, fire: true, pages: 0 },
};

/**
 * The set and its lamps for an hour. Nothing of it stands outdoors: where a ray leaves through a window the picture
 * shows the island, painted flat from the island's shared palette (`roomView.ts`).
 */
export interface RoomSet {
  scene: Scene;
  lamps: Lamp[];
  ambient: Colour;
  /** Where the small living things stand (their feet): Kiur on the bed, the mug on the table, the metronome on the piano, the plant on the right sill. */
  spots: Record<'kiur' | 'mug' | 'metronome' | 'plant', { x: number; y: number; z: number }>;
  /** The stove's glass, whose flames move, and the back wall, where the portrait and the shield hang. */
  glass: Shape;
  backWall: Shape;
}

export function roomSet(hour: RoomHour, awake: RoomAwake = {}): RoomSet {
  const b = new Builder();
  const h = HOURS[hour.phase];
  const back = shell(b, awake.door === true);
  windowUnit(b, 'back', ROOM.windowLeft, LEFT_WINDOW, ROOM.lean.windowLeft);
  windowUnit(b, 'back', ROOM.windowRight, 310, ROOM.lean.windowRight);
  // (the lighthouse window has no cross: nothing cuts the tower, which every scene shows grand)
  windowUnit(b, 'left', ROOM.windowSide, 320, ROOM.lean.windowSide, false);
  b.leant(LEANS.piano, () => piano(b, awake.piano === true, h.lamps > 0));
  const fire = b.leant(LEANS.stove, () => stove(b, h.fire));
  const kiur = bed(b);
  const lamp = b.leant(LEANS.desk, () => desk(b, hour.lamps));
  door(b, awake.door === true);
  b.leant(LEANS.easel, () => easel(b, awake.easel === true));
  b.leant(LEANS.chest, () => chest(b));
  photos(b);
  const mug = b.leant(LEANS.table, () => teaTable(b));
  const hung = lantern(b, hour.lamps);
  foreground(b, h.pages);
  for (const [x, z, turn] of [[-1.18, 1.86, 20], [-1.05, 1.95, 34]] as const) b.blob([x, 0.035, z], [0.05, 0.035, 0.1], turn, plain(colour(0xc98848), 0.2, 130), 400 + Math.round(z * 100));
  const rugAt = { x: 0.1, z: 1.78, turn: 5 };
  b.box(rugAt.x, rugAt.z, 2.3, 1.48, 0, 0.012, rugAt.turn, rug, G.rug);

  const lamps: Lamp[] = [
    { x: h.toSun[0], y: h.toSun[1], z: h.toSun[2], far: true, r: h.sun[0], g: h.sun[1], b: h.sun[2], reach: 0, size: 0.02, flickers: false },
  ];
  // the fire's light comes out of a small barred mouth: no more than a red glow on the floor in front of the stove and on
  // the stove's own front (it does not make sense for it to light the whole room; at best it casts
  // a reddish shadow on the floor in front of it); low and near the door, with a short reach
  if (h.fire) lamps.push({ x: fire.x, y: fire.y, z: fire.z, far: false, r: 2.4, g: 0.62, b: 0.22, reach: 0.7, size: 0.07, flickers: true });
  // the daylight of each window, as a soft lamp just inside its glass, from the island's sky at its horizon
  // warmer than the sky it comes from: the painting sets warm light against cool shade
  // by night it is the moon's: cool, and strong enough to lay a blue plane on what faces a window
  const sky = colour(KERI_HOURS[hour.phase].sky[4]);
  const day: Colour = [sky[0] * h.windows * 2.2 * h.tint[0], sky[1] * h.windows * 2.2 * h.tint[1], sky[2] * h.windows * 2.2 * h.tint[2]];
  for (const [name, p] of [['back', ROOM.windowLeft], ['back', ROOM.windowRight], ['left', ROOM.windowSide]] as const) {
    const at = wallTool(name).p((p.a0 + p.a1) / 2, (p.y0 + p.y1) / 2 + 0.1, -0.12);
    lamps.push({ x: at[0], y: at[1], z: at[2], far: false, r: day[0], g: day[1], b: day[2], reach: 2.2, size: 0.3, flickers: false });
  }
  // the piano's candles: a small warm pool on the keys' lid, the music desk and the wall behind
  if (h.lamps > 0) for (const c of PIANO_CANDLES) {
    const at = leantPoint(LEANS.piano, c);
    lamps.push({ x: at.x, y: at.y + 0.02, z: at.z + 0.03, far: false, r: 1.15 * h.lamps, g: 0.8 * h.lamps, b: 0.42 * h.lamps, reach: 0.75, size: 0.03, flickers: false });
  }
  // what the daylight throws back from the room's near end onto the things that face the viewer: without it the piano,
  // between two bright windows, is a dark shape, and a painted room keeps its main thing readable
  lamps.push({ x: 0.2, y: 1.9, z: 3.4, far: false, r: day[0] * FILL, g: day[1] * FILL, b: day[2] * FILL, reach: 3.4, size: 0.5, flickers: false });
  // and the same from behind the viewer onto the near things' faces (the sea chest, its basket and books, the bed's
  // foot): without it the picture's lower left is one dark mass with nothing drawn in it; by night it is the moon's,
  // a cool low light, so the near things stand as shapes the eye can read and not as a black slab
  const near = hour.phase === 'night' ? NEAR_MOON : [day[0] * NEAR_FILL, day[1] * NEAR_FILL, day[2] * NEAR_FILL];
  lamps.push({ x: -1.1, y: 1.7, z: 5.9, far: false, r: near[0], g: near[1], b: near[2], reach: 2.6, size: 0.5, flickers: false });
  if (awake.door) {
    // the hallway's own light, from its far end: by day a window that is out of sight, after dark a small lamp
    const at = wallTool('right').p((ROOM.door.a0 + ROOM.door.a1) / 2, 1.8, -ROOM.wall - HALL.length * 0.5);
    const k = hour.lamps ? [1.1 * h.lamps, 0.75 * h.lamps, 0.38 * h.lamps] : [day[0] * 1.1, day[1] * 1.15, day[2] * 1.3];
    lamps.push({ x: at[0], y: at[1], z: at[2], far: false, r: k[0]!, g: k[1]!, b: k[2]!, reach: 2.2, size: 0.2, flickers: false });
  }
  if (hour.lamps) {
    lamps.push({ x: lamp.x, y: lamp.y - 0.06, z: lamp.z, far: false, r: 1.5 * h.lamps, g: 1.08 * h.lamps, b: 0.62 * h.lamps, reach: 1.9, size: 0.05, flickers: false });
    lamps.push({ x: hung.x - 0.1, y: hung.y, z: hung.z, far: false, r: 0.62 * h.lamps, g: 0.44 * h.lamps, b: 0.25 * h.lamps, reach: 1.05, size: 0.04, flickers: false });
  }
  return {
    scene: b.finish(),
    lamps,
    ambient: h.ambient,
    spots: {
      kiur: { x: kiur.x, y: kiur.y, z: kiur.z }, mug: leantPoint(LEANS.table, mug),
      metronome: leantPoint(LEANS.piano, { x: ROOM.piano.x + 0.5, y: ROOM.piano.y1 + 0.035, z: 0.3 }),
      // the note plant grows with the level's XP (ft_1_20.AC13): on the piano's top, left of the metronome, where nothing stands in front of it
      plant: leantPoint(LEANS.piano, { x: ROOM.piano.x - 0.45, y: ROOM.piano.y1 + 0.035, z: 0.3 }),
    },
    glass: b.outer(fire.glass),
    backWall: back,
  };
}

