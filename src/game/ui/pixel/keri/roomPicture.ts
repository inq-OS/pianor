import { ROOM, ROOM_OBJECTS, lookThrough, pieceCorners, projectBounds, projectPoint, type RoomCamera, type RoomObject } from '../../../../core/layout/room';
import type { Rect } from '../../../../core/layout/rect';
import type { SkyPhase } from '../../../../core/sky/skyPhase';
import { createBitmap, type Bitmap } from '../bitmap';
import { C, PALETTE } from '../palette';
import { colour } from '../paint/materials';
import { bayer, noise2 } from '../paint/noise';
import { lensPlace, outlines, paint, type Layers, type Stage } from '../paint/painter';
import { Reducer } from '../paint/reduce';
import { cropTogether, type Overlay } from '../pack';
import type { Dab } from '../paint/trace';
import { paletteFor } from '../sky/skyLooks';
import { paintView, VIEW, type RoomPanes } from './roomView';
import { ALL_AWAKE, FOREGROUND, PAPERS, PRESSABLE_GROUPS, roomSet, setFlamePhase, type RoomAwake, type RoomSet } from './roomSet';

/**
 * The picture of the warden's room (ft_1_18.AC3): the set of `roomSet.ts` painted for a camera and an hour, then brought
 * down to the room's palette, with the small things that move as their own frames. The room's palette is the game's own
 * (so the old sprites laid into the room keep their colours) with more shades after it: the painted backgrounds this
 * follows had 256 colours, most of them browns.
 */

/** The shades the room adds to the game's palette, dark to light in each run. */
export const ROOM_RUNS = {
  wood: [0x1d1218, 0x2e1a1c, 0x432420, 0x5c3324, 0x7a4528, 0x96592f, 0xb4733c, 0xcf9150, 0xe6b06c, 0xf4cd8e],
  /** Plaster in warm light, down to its mauve shadow. */
  plaster: [0x2a1f2e, 0x43303c, 0x5e4448, 0x7c5c56, 0x9c7a68, 0xba987c, 0xd4b592, 0xe8d0aa, 0xf6e6c4, 0xfff6dc],
  /** Cool shadow, iron, moonlight. */
  cool: [0x0e0d1a, 0x181830, 0x242848, 0x343c64, 0x4a5682, 0x6677a0, 0x8a9cbd, 0xb4c3d8, 0xdbe4ee],
  brick: [0x3a1a1c, 0x5c2620, 0x823526, 0xa8482c, 0xc6603a, 0xde8052],
  /** Fire and lamplight. */
  fire: [0x7a2a0c, 0xc2410c, 0xea6a12, 0xfb9a24, 0xffc247, 0xffe27a, 0xfff4c2],
  /** Blue cloth. */
  blue: [0x14204a, 0x1f3a7a, 0x2f5aa8, 0x5282c8, 0x86acdf, 0xbcd3f0, 0xe6effa],
  green: [0x12301f, 0x1d4a2c, 0x2f6a3a, 0x4a8a4a, 0x78ae5e],
  red: [0x4a1420, 0x7a1c28, 0xa82a30, 0xcf4638, 0xe87858],
} as const satisfies Record<string, readonly number[]>;
/**
 * The runs stay short on purpose, their tones 9 to 17 L* apart: the room is a lit set, and its computed light must
 * land in few flat tones, the borders between them laid as brush streaks (art-direction rule 26). Made long (tones at most 8 L* apart) the light
 * shaded off smoothly and the room looked too 3D, not in the MI2 style (docs/art-direction.md rule 19, d111
 * point 21). Long runs are for pictures whose tones the painter lays by hand (the knoll).
 */
const RUNS = Object.entries(ROOM_RUNS);
/** The runs, then Kiur's teal in shade and in light, two colours apart. */
const SHADES: readonly number[] = [...RUNS.flatMap(([, run]) => run), 0x0f4a4c, 0x8fe6d6];

const BASE_COUNT = PALETTE.length;
/** The game's own colours the room may use: the dark and warm ones, not the bright ones of the buttons. */
const BASE_ALLOWED: readonly number[] = [
  C.ink, C.duskDeep, C.dusk, C.duskDark, C.duskLight, C.silverDark, C.silver, C.cream, C.white, C.gold, C.goldLight, C.goldDark,
  C.orange, C.orangeLight, C.redDark, C.red, C.brownDark, C.teal, C.tealDark, C.leafDark,
];

/** The places of the room's runs in its palette, each dark to light: what the art rules are measured on (tools/art/pictureRules.test.ts). */
export function roomRuns(): Record<string, number[]> {
  let at = BASE_COUNT;
  return Object.fromEntries(RUNS.map(([name, run]) => [name, run.map(() => at++)]));
}

/**
 * The places of the island's runs the view in the windows lays its areas with (`VIEW`), each dark to light, as they lie
 * in the room's palette after its own shades: measured with the room's runs (tools/art/pictures.ts). The clouds and the
 * lights are a few tones of their runs in so small a view, so they are not among them.
 */
export function roomViewRuns(): Record<string, number[]> {
  const fine = VIEW.fine as Record<string, readonly number[]>;
  return Object.fromEntries(['sky', 'sea', 'grass', 'bush', 'lime', 'iron'].map((name) => [name, fine[name]!.map((p) => p + SHADES.length)]));
}

/**
 * The room's palette at an hour: the game's own colours, the room's shades, then the island's shared runs as the hour
 * shows them (`VIEW`), from which the view through the windows is painted: the room has no sky or night of its own.
 */
export function roomPalette(phase: SkyPhase): readonly number[] {
  return [...paletteFor(phase).slice(0, BASE_COUNT), ...SHADES, ...VIEW.at(phase).slice(BASE_COUNT)];
}

/** The set has nothing outdoors: a ray that leaves through a window paints nothing, and the view is laid there (`roomView.ts`). */
const NO_OUTDOORS: Stage['outdoors'] = { toSun: [0, 1, 0], sun: [0, 0, 0], ambient: [0, 0, 0] };
const noSky: Stage['sky'] = (_ox, _oy, _oz, _dx, _dy, _dz, out) => { out.r = 0; out.g = 0; out.b = 0; out.emit = 0; };

/** The fire's light at its three strengths: the room breathes with it. */
export const FIRE_LOOKS = [0.78, 1, 1.24] as const;
/** How many drawings of the flames there are: one smooth loop the game goes round, blending each into the next (`flicker.ts`). */
export const FLAME_FRAMES = 16;

/** How far a brush streak moves the border between two tones, and how much of the even dither is left as grit. */
const STREAK = 0.03;
const GRIT = 0.005;
/** The painting's two hues: shade leans blue-violet, colour is stronger than the lamps alone give it, and what stands near the viewer is a dark shape. */
const GRADE = { shade: [0.8, 0.82, 1.16], paper: [1.08, 0.9, 0.74], strong: 0.95, near: [0.7, 0.68, 0.9], knee: 0.58, over: 0.3 } as const;
/**
 * What an hour lays over the whole room, light and shade alike: the dawn is lilac and cool, so that only the dusk is
 * orange (consistency review 2, finding 8: the two were hard to tell apart away from the windows).
 */
const HOUR_TINT: Record<SkyPhase, readonly [number, number, number]> = { day: [1, 1, 1], dawn: [0.96, 0.94, 1.1], dusk: [1.06, 0.97, 0.92], night: [1, 1, 1] };
/**
 * The line round a thing: the thing's own colour gone dark and violet, never black (the outdoor scenes' rule: a line in
 * the run's darkest tone, round big shapes). `full` between two things, `fold` along an edge inside one; a thing that
 * shows fewer than `small` pixels (a cup, a book, a knob) gets only `faint`.
 */
const LINE = { dark: [0.3, 0.22, 0.4], lift: [0.03, 0.02, 0.07], full: 0.85, fold: 0.3, faint: 0.3, small: 300, rim: 1.5, paper: [0.44, 0.27, 0.18], sheet: 0.8 } as const;

/**
 * The light's steps: the darkest step, how many times lighter each next one is, and how far (in steps) a brush moves a
 * border: on a floor or a table's top (`rag`) and, far less, on a wall (`ragWall`), where a border moved far from where
 * the light puts it is a lobe that nothing casts and reads as a stain (art review 2 of the repaint).
 */
const POOL = { floor: 0.085, step: 1.55, rag: 0.36, ragWall: 0.12, even: 4 } as const;

/** How much red light of its own makes a pixel a burning thing (a flame, a lamp's shade, the lantern): it keeps its colour. */
const HOT = 0.3;

/** A colour as the painter mixes it: its shade turned blue-violet, its hue made stronger; a thing near the viewer dark and cool. */
function graded(r: number, g: number, b: number, near: boolean, tint: readonly [number, number, number], hot = false, paper = false): [number, number, number] {
  r *= tint[0]; g *= tint[1]; b *= tint[2];
  if (near && !hot) { r *= GRADE.near[0]; g *= GRADE.near[1]; b *= GRADE.near[2]; }
  const luma = 0.3 * r + 0.5 * g + 0.2 * b;
  const t = Math.min(1, Math.max(0, (0.5 - luma) / 0.42)), dark = t * t * (3 - 2 * t);
  // (paper's shade is warm: an old sheet in the dark goes brown, never grey)
  const shade = paper ? GRADE.paper : GRADE.shade;
  r *= 1 + (shade[0] - 1) * dark; g *= 1 + (shade[1] - 1) * dark; b *= 1 + (shade[2] - 1) * dark;
  const grey = 0.3 * r + 0.5 * g + 0.2 * b;
  let strong: number = GRADE.strong;
  if (!hot && !paper) {
    // only what burns keeps a pure colour (and old paper its gold): a lit board or brick past the knee is held back toward its grey
    const max = Math.max(r, g, b), pure = max > 0 ? (max - Math.min(r, g, b)) / max : 0;
    if (pure > GRADE.knee) strong *= (GRADE.knee + (pure - GRADE.knee) * GRADE.over) / pure;
  }
  return [Math.max(0, grey + (r - grey) * strong), Math.max(0, grey + (g - grey) * strong), Math.max(0, grey + (b - grey) * strong)];
}

/** Bright light rolls off softly instead of burning out to white. */
function soften(v: number): number {
  return v < 0.7 ? v : 0.7 + 0.3 * (1 - Math.exp(-(v - 0.7) * 2.4));
}

/** The old sprites and the pictures on the wall, as the game's palette indexes on the fine grid. */
export interface RoomArt {
  portrait: Bitmap;
  /** The rank shield of every level, the first for level 1. */
  shields: readonly Bitmap[];
  kiur: readonly Bitmap[];
  /** Kiur woken on the bed under the pointer (ft_1_21.AC14): one frame the size of his sleeping ones, at the same place. */
  kiurAwake: Bitmap;
  /** The colours of the letters of Kiur's sleep, in his frame (`KIUR_ZZZ`): the game floats the letters themselves. */
  zzz: Bitmap;
  /** The colours of the tea's steam on the mug's mouth (`steamTones`): the game draws the wisps themselves. */
  steam: readonly Bitmap[];
  metronome: readonly Bitmap[];
  /** The note plant at each size it grows through as the level's XP fills (`PLANT_STAGES`). */
  plant: readonly Bitmap[];
}

export interface RoomPicture {
  palette: readonly number[];
  /** One picture for each strength of the fire (`FIRE_LOOKS`). */
  looks: Bitmap[];
  /** The flames behind the stove's glass, the sea's second glint, and the living things. */
  flames: Overlay;
  shimmer: Overlay;
  kiur: Overlay;
  /** Kiur's second look: awake on the bed, while the pointer is on him once a practice tug is his to play. */
  kiurAwake: Overlay;
  /** The letters of Kiur's sleep: their two colours in the light of his place, in his frame (the game floats them, `wisps.ts`). */
  zzz: Overlay;
  /** The tea's steam: its two colours in the light of the mug, in the box the wisps rise in (the game draws them, `wisps.ts`). */
  steam: Overlay;
  metronome: Overlay;
  /** A frame per level. */
  shield: Overlay;
  /** The note plant on the sill, a frame per size it grows through (the XP of the level). */
  plant: Overlay;
  /** The contour round the shield, the one thing a press reaches that has no second look: shown under the pointer. */
  hover: Overlay;
  /**
   * Each object's second look (ft_1_20.AC15): what of the picture changes when it wakes under the pointer, a frame for each
   * strength of the fire (`FIRE_LOOKS`), to lie on the look of the same strength.
   */
  awake: Record<RoomObject, Overlay>;
}

/**
 * The contour (ft_1_20; for the MVP a simple contour highlight): a light line `HOVER_LINE` fine pixels wide
 * round the thing's painted shape, and the room's ink outside it, so it reads on a light wall and on a dark beam alike.
 * AX-3 provisional: the colours and the width. The room's objects wake under the pointer instead (ft_1_20.AC15), so the
 * contour is the shield's alone.
 */
export const HOVER_LINE = 2;
export const HOVER_COLOURS = { line: C.cream, edge: C.ink } as const;

/**
 * How far past an object's outline its second look reaches, in fine pixels: the ink line round it and the soft edge of
 * its own shadow. Past that the picture stays as it is at rest: painted again, the soft light falls a little differently
 * all over the room (10,000 to 28,000 pixels), which is no part of the object waking.
 */
const AWAKE_REACH: Readonly<Record<RoomObject, number>> = { piano: 2, door: 4, easel: 2 };

/** `mask` with every pixel within `reach` pixels of it, corners counted as next to each other. */
function grown(mask: Uint8Array, w: number, h: number, reach: number): Uint8Array {
  let from = mask;
  for (let ring = 0; ring < reach; ring++) {
    const to = new Uint8Array(from);
    from.forEach((set, i) => {
      if (!set) return;
      const x = i % w, y = (i - x) / w;
      for (let ny = Math.max(0, y - 1); ny <= Math.min(h - 1, y + 1); ny++) for (let nx = Math.max(0, x - 1); nx <= Math.min(w - 1, x + 1); nx++) to[ny * w + nx] = 1;
    });
    from = to;
  }
  return from;
}

class RoomPainter {
  readonly palette: readonly number[];
  readonly set: RoomSet;
  readonly layers: Layers;
  readonly stage: Stage;
  private readonly indoors: Reducer;
  private readonly ink: Float32Array;
  /** How many pixels each group of shapes shows. */
  private readonly sizes = new Map<number, number>();
  private readonly panes: RoomPanes;
  /** The island behind the wall, in the room's palette places: what the windows' glass shows. */
  private readonly view: Bitmap;
  /** How bright the soft light is at each pixel, steady and from the fire, evened once more (`calm`): what the pools are cut from. */
  private readonly soft: Float32Array;
  private readonly softGlow: Float32Array;

  constructor(private readonly fine: { w: number; h: number }, private readonly camera: RoomCamera, private readonly phase: SkyPhase, awake: RoomAwake = {}) {
    this.palette = roomPalette(phase);
    this.set = roomSet({ phase, lamps: phase !== 'day' }, awake);
    this.stage = {
      scene: this.set.scene, lamps: this.set.lamps, ambient: this.set.ambient, outdoors: NO_OUTDOORS, sky: noSky,
      eye: camera, lens: camera.f, look: (px, py) => lookThrough(camera, px, py),
    };
    this.layers = paint(this.stage, fine.w, fine.h);
    this.ink = outlines(this.layers);
    for (const g of this.layers.group) this.sizes.set(g, (this.sizes.get(g) ?? 0) + 1);
    const extras = SHADES.map((_, i) => BASE_COUNT + i);
    this.indoors = new Reducer(this.palette, [...BASE_ALLOWED, ...extras]);
    const pane = (wall: 'back' | 'left', piece: typeof ROOM.windowSide) => projectBounds(camera, pieceCorners(wall, piece));
    this.panes = { side: pane('left', ROOM.windowSide), left: pane('back', ROOM.windowLeft), right: pane('back', ROOM.windowRight) };
    this.view = this.viewOf(0);
    this.soft = this.calm(this.layers.light);
    this.softGlow = this.calm(this.layers.glow);
  }

  /**
   * The brightness of a light, evened over `POOL.even` pixels each way on the same face of the same thing. One shadow
   * ray a pixel leaves the soft light speckled in the dither's own pattern; cut into steps as it is, every border between
   * two pools frays into rows of dashes, and a shadow beside a thing seems to dissolve the thing into the wall (as
   * the piano's right leg did). A window as wide as two of the pattern takes the speckle out whole.
   */
  private calm(light: Float32Array): Float32Array {
    const { w, h, shape, facing } = this.layers;
    const out = new Float32Array(w * h);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const i = y * w + x;
      if (shape[i] === 0) continue;
      let sum = 0, n = 0;
      for (let yy = Math.max(0, y - POOL.even); yy < Math.min(h, y + POOL.even); yy++) for (let xx = Math.max(0, x - POOL.even); xx < Math.min(w, x + POOL.even); xx++) {
        const j = yy * w + xx;
        if (shape[j] !== shape[i]) continue;
        if (facing[i * 3]! * facing[j * 3]! + facing[i * 3 + 1]! * facing[j * 3 + 1]! + facing[i * 3 + 2]! * facing[j * 3 + 2]! < 0.92) continue;
        sum += 0.3 * light[j * 3]! + 0.5 * light[j * 3 + 1]! + 0.2 * light[j * 3 + 2]!;
        n++;
      }
      out[i] = sum / n;
    }
    return out;
  }

  /** The view through the windows in the room's palette places (the island's runs lie after the room's shades). */
  private viewOf(shimmer: number): Bitmap {
    const view = paintView(this.fine, this.panes, this.camera.cy, this.phase, shimmer);
    view.pixels.forEach((p, i) => { view.pixels[i] = p >= BASE_COUNT ? p + SHADES.length : C.ink; });
    return view;
  }

  /**
   * The brush's streak at pixel `i`, 0 to 1: long and thin, running level along a wall or a thing's side and along
   * the boards on the floor and on a table's top. It moves the border between two tones, so a border is a ragged
   * streak as a brush leaves it and not an even checkerboard.
   */
  private streak(i: number): number {
    const { at, facing } = this.layers;
    const x = at[i * 3]!, y = at[i * 3 + 1]!, z = at[i * 3 + 2]!;
    if (Math.abs(facing[i * 3 + 1]!) > 0.7) return 0.6 * noise2(x * 30, z * 2.4, 71) + 0.4 * noise2(x * 9, z * 1.1, 72);
    // on a wall the brush goes down and a little across, in short broad strokes
    const along = z * facing[i * 3]! - x * facing[i * 3 + 2]!;
    return 0.6 * noise2(along * 9 + y * 3, y * 7 - along * 2, 73) + 0.4 * noise2(along * 3, y * 2.4, 74);
  }

  /** The palette index of pixel `i` for a colour before the outline. */
  private index(i: number, r: number, g: number, b: number, hot = false): number {
    const x = i % this.fine.w, y = Math.floor(i / this.fine.w);
    // through a window: the island, as the view has it
    if (this.layers.outside[i] === 1) return this.view.pixels[i]!;
    // (the foreground's paper and books are painted in the room's light, not as dark shapes)
    const group = this.layers.group[i]!;
    [r, g, b] = graded(r, g, b, group >= FOREGROUND && group < PAPERS, HOUR_TINT[this.phase], hot, group >= PAPERS);
    // (round a sheet of paper the line is brown and as firm for a small sheet as for a large: the dark line under each sheet is what makes a pile of them)
    const paper = group >= PAPERS, dark = paper ? LINE.paper : LINE.dark;
    const line = this.ink[i]! >= 1 ? (paper ? LINE.sheet : this.sizes.get(group)! < LINE.small ? LINE.faint : LINE.full) : this.ink[i]! > 0 ? LINE.fold : 0;
    // an edge that looks up at the light gets a pale stroke in place of the dark line: a table's top, a lid, a sill
    if (this.ink[i]! >= 1 && this.layers.facing[i * 3 + 1]! > 0.6 && group < FOREGROUND) return this.indoors.shifted(soften(r * LINE.rim), soften(g * LINE.rim), soften(b * LINE.rim * 0.94), 0);
    const part = (v: number, k: number): number => soften(v) * (1 - line) + (soften(v) * dark[k]! + (paper ? 0 : LINE.lift[k]!)) * line;
    const d = (this.streak(i) - 0.5) * STREAK + (bayer(x, y) - 0.5) * GRIT;
    return this.indoors.shifted(part(r, 0), part(g, 1), part(b, 2), d);
  }

  /**
   * The light on pixel `i` as the painter lays it: in flat steps, each `POOL.step` times the one under it, the border
   * between two steps a ragged streak. A lamp's light is a pool with a hard warm core and two or three rings, never the
   * smooth ramp the light computes (art-direction rule 26; artist's notes, light and heat, rule 3).
   */
  private pooled(i: number, lum: number): number {
    if (lum <= 0) return 0;
    const level = Math.abs(this.layers.facing[i * 3 + 1]!) > 0.7;
    const n = Math.log(lum / POOL.floor) / Math.log(POOL.step) + (this.rag(i) - 0.5) * (level ? POOL.rag : POOL.ragWall);
    return POOL.floor * POOL.step ** Math.max(0, Math.round(n));
  }

  /** The ragged edge of a pool of light at pixel `i`, 0 to 1: blotches a brush leaves, longer along the boards of a floor. */
  private rag(i: number): number {
    const { at, facing } = this.layers;
    const x = at[i * 3]!, y = at[i * 3 + 1]!, z = at[i * 3 + 2]!;
    if (Math.abs(facing[i * 3 + 1]!) > 0.7) return 0.7 * noise2(x * 5, z * 1.2, 81) + 0.3 * noise2(x * 13, z * 3.5, 82);
    const along = z * facing[i * 3]! - x * facing[i * 3 + 2]!;
    return 0.7 * noise2(along * 1.6, y * 3, 83) + 0.3 * noise2(along * 5, y * 9, 84);
  }

  look(gain: number): Bitmap {
    const { albedo, own, ownFire, light, sun, glow, shape } = this.layers;
    const bitmap = createBitmap(this.fine.w, this.fine.h);
    const c = [0, 0, 0];
    for (let i = 0; i < bitmap.pixels.length; i++) {
      const o = i * 3;
      let k = 1;
      if (shape[i] !== 0 && !this.layers.outside[i]) {
        const lr = light[o]! + sun[o]! + gain * glow[o]!, lg = light[o + 1]! + sun[o + 1]! + gain * glow[o + 1]!, lb = light[o + 2]! + sun[o + 2]! + gain * glow[o + 2]!;
        const lum = 0.3 * lr + 0.5 * lg + 0.2 * lb;
        // the pool is cut from the evened light; the sun's own shadows stay as sharp as they fall
        k = lum > 0 ? this.pooled(i, this.soft[i]! + 0.3 * sun[o]! + 0.5 * sun[o + 1]! + 0.2 * sun[o + 2]! + gain * this.softGlow[i]!) / lum : 1;
      }
      for (let j = 0; j < 3; j++) c[j] = albedo[o + j]! * (light[o + j]! + sun[o + j]! + gain * glow[o + j]!) * k + own[o + j]! + gain * ownFire[o + j]!;
      bitmap.pixels[i] = this.index(i, c[0]!, c[1]!, c[2]!, own[o]! + gain * ownFire[o]! > HOT);
    }
    return bitmap;
  }

  /** The light that falls round pixel (x, y), fire included at its middle strength: what a sprite laid there is lit by. */
  private lightAt(x: number, y: number): [number, number, number] {
    const { light, sun, glow, w, h } = this.layers;
    const sum = [0, 0, 0];
    let n = 0;
    for (let dy = -2; dy <= 2; dy++) for (let dx = -3; dx <= 3; dx++) {
      const px = Math.round(x) + dx, py = Math.round(y) + dy;
      if (px < 0 || py < 0 || px >= w || py >= h) continue;
      const i = py * w + px;
      if (this.layers.outside[i] || this.layers.shape[i] === 0) continue;
      for (let k = 0; k < 3; k++) sum[k]! += light[i * 3 + k]! + sun[i * 3 + k]! + glow[i * 3 + k]!;
      n++;
    }
    // a sprite keeps readable: never darker than a third, never burnt out
    return sum.map((v) => Math.min(1.1, Math.max(0.34, n ? v / n : 0.6))) as [number, number, number];
  }

  /** A sprite in the game's colours as it looks in the light `light`: each colour goes to the room's nearest shade. */
  private lit(sprite: Bitmap, light: readonly [number, number, number]): Bitmap {
    const out = createBitmap(sprite.width, sprite.height);
    const known = new Map<number, number>();
    sprite.pixels.forEach((index, i) => {
      if (index === 0) return;
      let to = known.get(index);
      if (to === undefined) {
        const c = colour(PALETTE[index] ?? 0);
        to = this.indoors.pixel(soften(c[0] * light[0]), soften(c[1] * light[1]), soften(c[2] * light[2]), 0, 0, 0);
        known.set(index, to);
      }
      out.pixels[i] = to;
    });
    return out;
  }

  /** Sprite frames standing on a point of the room (their bottom middle on it), lit by the light there. */
  standing(frames: readonly Bitmap[], at: { x: number; y: number; z: number }): Overlay {
    const still = projectPoint(this.camera, at.x, at.y, at.z);
    const p = lensPlace(still.x, still.y);
    const light = this.lightAt(p.x, p.y + 1);
    const tall = Math.max(...frames.map((f) => f.height));
    const wide = Math.max(...frames.map((f) => f.width));
    return { x: Math.round(p.x - wide / 2), y: Math.round(p.y - tall), frames: frames.map((f) => {
      const lit = this.lit(f, light);
      if (f.height === tall && f.width === wide) return lit;
      const out = createBitmap(wide, tall);
      for (let y = 0; y < f.height; y++) out.pixels.set(lit.pixels.subarray(y * f.width, (y + 1) * f.width), (tall - f.height + y) * wide);
      return out;
    }) };
  }

  /** Sprite frames hung flat on the back wall at `rect`, in the wall's light there. */
  hung(frames: readonly Bitmap[], rect: Rect): Overlay {
    // where the painted wall shows the rect's middle: the picture hangs there, moved as a whole
    const mid = lensPlace(rect.x + rect.w / 2, rect.y + rect.h / 2);
    const light = this.lightAt(mid.x, mid.y);
    // a picture on a wall is seen by its own contrast: keep it a little brighter than its wall
    const lift = light.map((v) => Math.max(v, 0.62)) as [number, number, number];
    return { x: Math.round(mid.x - rect.w / 2), y: Math.round(mid.y - rect.h / 2), frames: frames.map((f) => this.lit(f, lift)) };
  }

  /** Lays a sprite into a look, behind whatever of the room is nearer than `depth` metres. */
  bake(look: Bitmap, overlay: Overlay, depth: number): void {
    const frame = overlay.frames[0]!;
    for (let y = 0; y < frame.height; y++) for (let x = 0; x < frame.width; x++) {
      const px = overlay.x + x, py = overlay.y + y;
      const index = frame.pixels[y * frame.width + x]!;
      if (index === 0 || px < 0 || py < 0 || px >= look.width || py >= look.height) continue;
      if (this.layers.depth[py * look.width + px]! < depth) continue;
      look.pixels[py * look.width + px] = index;
    }
  }

  /** Where the thing of `groups` shows in the picture: its pixels, one byte each. */
  shapeOf(groups: readonly number[]): Uint8Array {
    const { group } = this.layers;
    const mask = new Uint8Array(group.length);
    for (let i = 0; i < group.length; i++) if (groups.includes(group[i]!)) mask[i] = 1;
    return mask;
  }

  /** Every pixel any frame of the overlay covers. */
  private overlayShape(overlay: Overlay): Uint8Array {
    const { w, h } = this.fine;
    const mask = new Uint8Array(w * h);
    for (const f of overlay.frames) f.pixels.forEach((p, i) => {
      const x = overlay.x + (i % f.width), y = overlay.y + Math.floor(i / f.width);
      if (p !== 0 && x >= 0 && y >= 0 && x < w && y < h) mask[y * w + x] = 1;
    });
    return mask;
  }

  /** The contour round a shape: `HOVER_LINE` pixels of light just outside it, then one of ink. */
  contour(mask: Uint8Array): Bitmap {
    const { w, h } = this.fine;
    const out = createBitmap(w, h);
    let inside = mask;
    for (let ring = 0; ring <= HOVER_LINE; ring++) {
      const grown = new Uint8Array(inside);
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        if (inside[y * w + x]) continue;
        let near = false;
        for (let dy = -1; dy <= 1 && !near; dy++) for (let dx = -1; dx <= 1 && !near; dx++) {
          const nx = x + dx, ny = y + dy;
          near = nx >= 0 && ny >= 0 && nx < w && ny < h && inside[ny * w + nx] === 1;
        }
        if (!near) continue;
        grown[y * w + x] = 1;
        out.pixels[y * w + x] = ring < HOVER_LINE ? HOVER_COLOURS.line : HOVER_COLOURS.edge;
      }
      inside = grown;
    }
    return out;
  }

  /** The shield's hover contour: the game lays it under the living things, which hide a line that runs behind them. */
  hover(shield: Overlay): Overlay {
    return cropTogether([this.contour(this.overlayShape(shield))]);
  }

  /**
   * Where `thing` may change the picture when it wakes: its outline at rest (this painting) and awake (`woken`) together,
   * `AWAKE_REACH` pixels more, and never a pixel of another object: two objects that stand side by side (the piano and
   * the note board) keep to their own.
   */
  awakeMask(thing: RoomObject, woken: RoomPainter): Uint8Array {
    const { w, h } = this.fine;
    const own = this.shapeOf(PRESSABLE_GROUPS[thing]);
    woken.shapeOf(PRESSABLE_GROUPS[thing]).forEach((v, i) => { if (v) own[i] = 1; });
    const mask = grown(own, w, h, AWAKE_REACH[thing]);
    for (const other of ROOM_OBJECTS) {
      if (other === thing) continue;
      for (const p of [this, woken]) p.shapeOf(PRESSABLE_GROUPS[other]).forEach((v, i) => { if (v) mask[i] = 0; });
    }
    return mask;
  }

  depthOf(at: { x: number; z: number }): number {
    return Math.hypot(at.x - this.camera.x, at.z - this.camera.z) - 0.12;
  }

  /** The flames behind the glass, `FLAME_FRAMES` of them, at the fire's middle strength. */
  flames(): Overlay {
    const { shape, at, w, h } = this.layers;
    const glass = this.set.glass;
    const dab: Dab = { x: 0, y: 0, z: 0, fine: 0.01, nx: 0, ny: 0, nz: 1, u: 0, v: 0, face: 0, r: 0, g: 0, b: 0, emit: 0 };
    const frames: Bitmap[] = [];
    for (let f = 0; f < FLAME_FRAMES; f++) {
      setFlamePhase(f / FLAME_FRAMES);
      const bitmap = createBitmap(w, h);
      for (let i = 0; i < w * h; i++) {
        if (shape[i] !== glass.id) continue;
        dab.x = at[i * 3]!; dab.y = at[i * 3 + 1]!; dab.z = at[i * 3 + 2]!;
        glass.skin(dab.x, dab.y, dab.z, dab);
        if (dab.face < 4) continue;
        glass.material(dab);
        bitmap.pixels[i] = this.index(i, dab.r, dab.g, dab.b, true);
      }
      frames.push(bitmap);
    }
    setFlamePhase(0);
    return cropTogether(frames);
  }

  /** The sea and sky again with the glints moved: only the pixels that change. */
  shimmer(first: Bitmap): Overlay {
    const { w, h, shape, outside } = this.layers;
    const again = this.viewOf(1);
    const bitmap = createBitmap(w, h);
    for (let i = 0; i < w * h; i++) {
      if (!outside[i] || shape[i] !== 0) continue;
      if (again.pixels[i] !== first.pixels[i]) bitmap.pixels[i] = again.pixels[i]!;
    }
    return cropTogether([bitmap]);
  }
}

/**
 * Each object's second look as what it changes: `woken` is the room painted with every object awake, and of its looks
 * (`wokenLooks`, one per strength of the fire) an object keeps the pixels inside its own mask that differ from the look at
 * rest. One painting serves them all, as no object's waking reaches another's place.
 */
function awakeLayers(rest: RoomPainter, restLooks: readonly Bitmap[], woken: RoomPainter, wokenLooks: readonly Bitmap[]): Record<RoomObject, Overlay> {
  return Object.fromEntries(ROOM_OBJECTS.map((thing) => {
    const mask = rest.awakeMask(thing, woken);
    const frames = wokenLooks.map((look, n) => {
      const out = createBitmap(look.width, look.height);
      const before = restLooks[n]!.pixels;
      look.pixels.forEach((p, i) => { if (mask[i] && p !== before[i]) out.pixels[i] = p; });
      return out;
    });
    return [thing, cropTogether(frames)];
  })) as Record<RoomObject, Overlay>;
}

/**
 * Paints the room for a camera and an hour. `places` says where the portrait and the shield hang (fine pixels, from
 * `roomView`); `art` gives the sprites.
 */
export function paintRoom(fine: { w: number; h: number }, camera: RoomCamera, phase: SkyPhase, places: { portrait: Rect; shield: Rect }, art: RoomArt): RoomPicture {
  const p = new RoomPainter(fine, camera, phase);
  const looks = FIRE_LOOKS.map((gain) => p.look(gain));
  const { spots } = p.set;
  const portrait = p.hung([art.portrait], places.portrait);
  // the room again with its objects awake (ft_1_20.AC15), the same portrait laid into it
  const woken = new RoomPainter(fine, camera, phase, ALL_AWAKE);
  const wokenLooks = FIRE_LOOKS.map((gain) => woken.look(gain));
  for (const [painter, set] of [[p, looks], [woken, wokenLooks]] as const) {
    for (const look of set) {
      painter.bake(look, portrait, 5);
    }
  }
  const steam = p.standing(art.steam, { ...spots.mug, y: spots.mug.y + 0.1 });
  const shield = p.hung(art.shields, places.shield);
  return {
    palette: p.palette,
    looks,
    flames: p.flames(),
    shimmer: p.shimmer(looks[1]!),
    kiur: p.standing(art.kiur, spots.kiur),
    kiurAwake: p.standing([art.kiurAwake], spots.kiur),
    zzz: p.standing([art.zzz], spots.kiur),
    steam,
    metronome: p.standing(art.metronome, spots.metronome),
    shield,
    plant: p.standing(art.plant, spots.plant),
    hover: p.hover(shield),
    awake: awakeLayers(p, looks, woken, wokenLooks),
  };
}
