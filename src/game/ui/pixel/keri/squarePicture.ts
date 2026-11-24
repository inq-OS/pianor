import { bend, SQUARE, type SquarePlan } from '../../../../core/layout/square';
import type { SkyPhase } from '../../../../core/sky/skyPhase';
import { createBitmap, type Bitmap } from '../bitmap';
import { cropTogether, type Overlay } from '../pack';
import { clamp01, smoothstep as smooth } from '../paint/ease';
import { grain } from '../paint/grain';
import { paintLooks, SkyMask } from '../paint/motion';
import { fbm, hash2, noise2 } from '../paint/noise';
import { tintedCloud, type CurlSpec } from './curlCloud';
import { KERI_HOURS, scenePalette, tone, type Hour } from './keriPalette';
import { optionsOf, type KitBrush } from './kit/kit';
import { lamp, lampLit, lantern } from './kit/lights';
import { KIT_WOOD } from './kit/wood';

/**
 * The picture of the village square (ft_1_19; `core/layout/square.ts`): the open ground between the houses at the
 * lighthouse, seen from the lighthouse's south-west foot, looking east-south-east to the southern pier. Painted in the
 * 1991 game's manner after its town pictures (Phatt's town for the sunlit walls against violet cast shade and the dark
 * shapes near the viewer, Booty's for houses each in its own colour): walls that lean and bulge, roofs that sag, flat
 * bands of tone, an ink line round every thing in the darkest tone of its own colour.
 *
 * Laid back to front: the bare sky (its clouds are their own pictures and drift over it), the sea with the pier and a
 * boat, the beak and the dune strip, the far shore under the hill's brow, the cinema house, the plaza of flagstones in rings round its flower bed, the lighthouse's side building as
 * the left wing and the old boat shed's corner as the right. The plaza and what stands on it (the flagstones,
 * the flower bed, the benches, the barrels, the string of pennants) are the painter's props; the houses and the pier stand where the
 * world model has them. The hour changes the colours and where the shade lies, not the drawing.
 */

const SHARED = scenePalette({
  wood: KIT_WOOD,
  // lime plaster: its shade violet, its light cream
  plaster: [0x3a3262, 0x6a5e8c, 0xa494a8, 0xd8ccb4, 0xf6edd0],
  // the houses' blue tin roofs: shade to ink blue, light to pale cyan
  tin: [0x161c48, 0x2a3c80, 0x4468b0, 0x78a4d4, 0xb6d6ec],
  // old weathered boards, grey-brown: shade to plum, light to straw
  boards: [0x281c30, 0x4c3844, 0x785e56, 0xa6896c, 0xcbbfa6],
  // a boat's red, an awning, a pennant
  red: [0x380a16, 0x741622, 0xb42c2a, 0xe0603a, 0xffae72],
}, ['grass', 'dry', 'shingle', 'stone', 'earth'], { sky: 3 });
const R = SHARED.run;
const F = SHARED.fine;

/** The runs the grain of scanned paint goes over: the things', never the sky's, the sea's, the clouds' or a light's. */
const GRAIN_RUNS = Object.entries(F).filter(([name]) => !['ember', 'cloud', 'sky', 'sea'].includes(name)).map(([, run]) => run);

export function squarePalette(phase: SkyPhase): readonly number[] {
  return SHARED.at(phase);
}

/** The square's runs, for the art tools and the rules' test. */
export const squareRuns = (): Readonly<Record<string, readonly number[]>> => SHARED.fine;

/** Where the corner lantern hangs in the picture (fine pixels): the moths' middle. */
export const SQUARE_LANTERN = { x: Math.round(bend(152, 154)[0]), y: Math.round(bend(152, 154)[1]) } as const;

/** The lamps' flicker: how many looks their light has. */
export const SQUARE_LAMP_LOOKS = 3;

/** The moon's place in the night's sky. */
const MOON = { x: 468, y: 30, r: 8 } as const;

/**
 * The light at each hour in this view (east-south-east). `south`, `front` and `north` are how light a wall is that
 * faces south (the side building's), the viewer (the cinema's front) and north (the boat shed's corner); `ground` the
 * open ground; `glint` the column where the sun or the moon lies on the sea (-1: none). By day the sun stands in the
 * south, to the right; at dawn it rises ahead over the sea; at dusk it sets behind the viewer and the lighthouse's own
 * shadow lies across the square.
 */
const LIGHT: Record<SkyPhase, { south: number; front: number; north: number; ground: number; glint: number; side: number }> = {
  day: { south: 0.84, front: 0.66, north: 0.16, ground: 0.72, glint: 606, side: 1 },
  dawn: { south: 0.5, front: 0.34, north: 0.5, ground: 0.56, glint: 318, side: -0.4 },
  dusk: { south: 0.6, front: 0.82, north: 0.4, ground: 0.68, glint: -1, side: -1 },
  night: { south: 0.58, front: 0.5, north: 0.3, ground: 0.52, glint: MOON.x, side: 0.5 },
};

/** The sky's clouds, back to front, each its own stroke with a head leading left with the wind, no two alike (rule 13). */
export const SQUARE_CLOUDS: readonly { at: readonly [number, number]; spec: CurlSpec }[] = [
  { at: [262, 78], spec: { length: 64, girth: 5, belly: 0.5, neck: 1, taper: 0.6, bend: 1, wave: 1, phase: 0.4 } },
  { at: [470, 74], spec: { length: 80, girth: 6, belly: 0.45, neck: 1, taper: 0.55, bend: 1, wave: 1.2, phase: 1.1 } },
  { at: [330, 8], spec: { length: 118, girth: 36, belly: 0.8, neck: 0.9, taper: 1.15, bend: 10, wave: 0.7, phase: 0.2, rise: 8, head: { size: 25, turns: 1.2 } } },
  { at: [180, 34], spec: { length: 120, girth: 14, belly: 0.6, neck: 0.85, taper: 0.75, bend: 7, wave: 1.4, phase: 0.9, head: { size: 17, turns: 1.3 } } },
  { at: [486, 40], spec: { length: 96, girth: 16, belly: 0.72, neck: 0.9, taper: 1, bend: 5, wave: 1, phase: 0.5, head: { size: 13, turns: 1.15 } } },
];

export interface SquareCloud {
  x: number;
  y: number;
  bitmap: Bitmap;
}

export interface SquarePicture {
  palette: readonly number[];
  /** The whole picture, the sky bare: the clouds drift over it. */
  frames: Bitmap[];
  /** What stands before the sky where the clouds go (roofs, the lamp, the mast). */
  fore: Overlay;
  clouds: SquareCloud[];
  /** The lamps' and windows' light on what is round them, a frame for each flicker (`SQUARE_LAMP_LOOKS`); empty by day. */
  lamp: Overlay;
  /** The gulls' colour, a place of the palette (`flock.ts`). */
  gull: number;
}

type Pt = readonly [number, number];
type Tone = (x: number, y: number) => number;

/** Whether (`x`, `y`) lies inside the polygon `pts`. */
function inside(pts: readonly Pt[], x: number, y: number): boolean {
  let within = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [xi, yi] = pts[i]!, [xj, yj] = pts[j]!;
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) within = !within;
  }
  return within;
}

/** The plaza's rings of flagstones: each ring's outer edge, in units of the lamp's step (`RX` wide, `RY` high). */
const RINGS = [10, 19, 30, 43, 58, 76, 98, 124, 154, 190] as const;
const RX = 3.9, RY = 0.86;

/** The lanterns: the side building's corner. Each by its hook (fine pixels, flat plan). */
const LANTERNS: readonly { x: number; y: number; reach: number }[] = [
  { x: 152, y: 150, reach: 26 },
];

/**
 * The pier as the stage has it, far off below the hill: its top's two edges run from the far shore to one point on the
 * horizon, and it ends `PIER.head` of the way there. The same heavy stone quay as the port's own picture.
 */
const PIER = { near: 130, left: 436, right: 494, to: { x: 584, y: SQUARE.horizon }, head: 0.74, face: 0.62 } as const;
/** The brow of the hill the plaza lies on, past which the ground drops away to the shore: its row at a column. */
const brow = (x: number): number => 149 + ((x - 440) / 210) ** 2 * 20;
/** A point of the pier's top: `t` from the shore (0) toward the horizon (1), `across` from its left edge (0) to its right (1). */
function onPier(t: number, across: number): Pt {
  const x = PIER.left + (PIER.right - PIER.left) * across;
  return [x + (PIER.to.x - x) * t, PIER.near + (PIER.to.y - PIER.near) * t];
}

class SquarePainter {
  readonly palette: readonly number[];
  readonly sky: SkyMask;
  private readonly hour: Hour & (typeof LIGHT)[SkyPhase];
  private readonly lit: boolean;
  private readonly w: number;
  private readonly h: number;
  private px: Uint8Array = new Uint8Array(0);
  /** Which thing painted each pixel (0 the sky and the sea): the ink line goes where a thing meets what was painted before it. */
  private owner: Uint16Array = new Uint16Array(0);
  private thing = 0;
  private things = 0;
  private readonly darkest = new Map<number, number>();

  constructor(plan: SquarePlan, private readonly phase: SkyPhase) {
    this.w = plan.fine.w;
    this.h = plan.fine.h;
    this.hour = { ...KERI_HOURS[phase], ...LIGHT[phase] };
    this.lit = this.hour.night || this.hour.glow >= 0.5;
    this.palette = squarePalette(phase);
    this.sky = new SkyMask(this.w, this.h);
    for (const [name, run] of Object.entries(F)) if (!['sky', 'sea', 'cloud'].includes(name)) for (const c of run) if (!this.darkest.has(c)) this.darkest.set(c, run[0]!);
  }

  gullTone(): number {
    return R.stone[4]!;
  }

  cloud(spec: CurlSpec): Bitmap {
    return tintedCloud(spec, true, R.cloud);
  }

  private put(x: number, y: number, c: number): void {
    x = Math.round(x); y = Math.round(y);
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return;
    const i = y * this.w + x;
    this.px[i] = c;
    this.owner[i] = this.thing;
    this.sky.put(i);
  }

  private at(x: number, y: number): number {
    x = Math.round(x); y = Math.round(y);
    return x < 0 || y < 0 || x >= this.w || y >= this.h ? 0 : this.px[y * this.w + x]!;
  }

  /** Paints one thing: what it paints is its own, so its outline can be found. */
  private as(draw: () => void): void {
    const was = this.thing;
    this.thing = ++this.things;
    draw();
    this.thing = was;
  }

  /** The ink line of the 1991 game: a thing's edge over what was painted before it takes the darkest tone of its own colour. */
  private outline(): void {
    const { w, h, px, owner } = this;
    const edge: number[] = [];
    for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) {
      const i = y * w + x, a = owner[i]!;
      if (a === 0) continue;
      for (const [d, o] of [[-w, w], [1, -1], [-1, 1], [w, -w]] as const) {
        const b = owner[i + d]!;
        if (b < a && owner[i + o] === a) { edge.push(i); break; }
      }
    }
    for (const i of edge) px[i] = this.darkest.get(px[i]!) ?? px[i]!;
  }

  /**
   * A shape of the flat plan, bent into the picture (`bend`) and filled with `colour`; its edge wavers by `wobble`
   * fine pixels, so no edge is ruler-straight (rule 3).
   */
  private poly(flat: readonly Pt[], colour: Tone, wobble = 0.9, seed = 0): void {
    const pts = flat.map(([x, y]) => bend(x, y) as Pt);
    const x0 = Math.max(0, Math.floor(Math.min(...pts.map((p) => p[0])) - 2)), x1 = Math.min(this.w - 1, Math.ceil(Math.max(...pts.map((p) => p[0])) + 2));
    const y0 = Math.max(0, Math.floor(Math.min(...pts.map((p) => p[1])) - 2)), y1 = Math.min(this.h - 1, Math.ceil(Math.max(...pts.map((p) => p[1])) + 2));
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const wx = x + (noise2(y / 9, x / 61, 801 + seed) - 0.5) * 2 * wobble, wy = y + (noise2(x / 11, y / 53, 802 + seed) - 0.5) * 2 * wobble;
      if (inside(pts, wx, wy)) this.put(x, y, colour(x, y));
    }
  }

  /** A stroke from `a` to `b` of the flat plan, `wide` fine pixels thick, bent into the picture. */
  private line(a: Pt, b: Pt, colour: Tone | number, wide = 1): void {
    const [ax, ay] = bend(a[0], a[1]), [bx, by] = bend(b[0], b[1]);
    const n = Math.ceil(Math.hypot(bx - ax, by - ay)) + 1;
    for (let k = 0; k <= n; k++) {
      const x = ax + ((bx - ax) * k) / n, y = ay + ((by - ay) * k) / n;
      for (let dy = 0; dy < wide; dy++) for (let dx = 0; dx < wide; dx++) {
        const px = Math.round(x) + dx - (wide >> 1), py = Math.round(y) + dy - (wide >> 1);
        this.put(px, py, typeof colour === 'number' ? colour : colour(px, py));
      }
    }
  }

  private oval(cx: number, cy: number, rx: number, ry: number, colour: Tone): void {
    const [x, y] = bend(cx, cy);
    for (let dy = -Math.ceil(ry); dy <= ry; dy++) for (let dx = -Math.ceil(rx); dx <= rx; dx++) {
      const far = (dx / rx) ** 2 + (dy / ry) ** 2 + (noise2((x + dx) / 5, (y + dy) / 5, 811) - 0.5) * 0.2;
      if (far <= 1) this.put(x + dx, y + dy, colour(x + dx, y + dy));
    }
  }

  /** A tone of a run for a light `t`, broken into flat patches a place or two apart (weather, wear), never a smooth ramp. */
  private worn(run: readonly number[], t: number, x: number, y: number, rough = 0.1, seed = 0): number {
    const patch = Math.round((fbm(x / 23, y / 13, 2, 700 + seed) - 0.5) * 6) / 3;
    return tone(run, clamp01(t + patch * rough), x, y);
  }

  // ---- the shade that lies on the ground at each hour

  /** How deep the shade is on the ground at a pixel, 0 none to 1: where it lies changes with the hour, the drawing does not. */
  private shade(x: number, y: number): number {
    const ragged = (noise2(x / 13, y / 7, 820) - 0.5) * 7;
    const within = (pts: readonly Pt[]): boolean => inside(pts.map(([px, py]) => bend(px, py) as Pt), x + ragged, y + ragged * 0.4);
    switch (this.phase) {
      case 'day':
        // the sun in the south, to the right: the boat shed's corner throws its shade over the plaza's right, the lamp a thin one
        if (within([[640, 172], [590, 182], [380, 212], [170, 252], [120, 300], [150, 372], [640, 372]])) return 1;
        // the bush in the flower bed and the bench throw theirs to the left
        if (within([[300, 198], [262, 202], [248, 210], [280, 216], [304, 213]])) return 0.9;
        if (within([[452, 206], [430, 212], [436, 219], [500, 214]])) return 0.8;
        return 0;
      case 'dawn':
        // the sun ahead over the sea: every shade comes toward the viewer
        if (within([[112, 164], [250, 160], [304, 204], [84, 218]])) return 1;
        if (within([[452, 204], [524, 204], [560, 236], [470, 236]])) return 0.7;
        // the bush in the flower bed throws its own at the viewer, and the things at the viewer's feet theirs
        if (within([[300, 214], [372, 214], [396, 262], [286, 262]])) return 0.8;
        if (within([[470, 318], [640, 300], [640, 372], [440, 372]])) return 0.9;
        return 0;
      case 'dusk':
        // the sun behind the viewer: the lighthouse's own long shadow lies across the square, its lantern at the far end
        if (within([[-10, 372], [250, 372], [322, 190], [304, 186]])) return 1;
        if (within([[298, 190], [328, 192], [336, 184], [318, 178], [300, 182]])) return 1;
        return 0;
      default:
        return 0;
    }
  }

  // ---- the sky and the sea

  private paintSky(): void {
    const { w, hour } = this;
    const hz = SQUARE.horizon + SQUARE.bow;
    this.sky.sky = true;
    for (let x = 0; x < w; x++) for (let y = 0; y <= hz; y++) {
      let t = Math.min(1, Math.pow(y / hz, 0.85));
      // at dawn the sky warms ahead, round where the sun comes up
      if (this.phase === 'dawn') t += 0.25 * Math.exp(-(((x - hour.glint) / 200) ** 2)) * (y / hz) ** 2 - 0.08;
      this.put(x, y, tone(F.sky, clamp01(t), x, y));
    }
    if (hour.night) this.stars();
    this.sky.sky = false;
  }

  private stars(): void {
    for (let gy = 0; gy < SQUARE.horizon - 8; gy += 8) for (let gx = 0; gx < this.w; gx += 9) {
      const pick = hash2(gx, gy, 31);
      if (pick > 0.42) continue;
      this.put(gx + Math.floor(hash2(gx, gy, 32) * 9), gy + Math.floor(hash2(gx, gy, 33) * 8), pick < 0.14 ? R.star[0]! : R.star[1]!);
    }
    for (let dy = -MOON.r - 9; dy <= MOON.r + 9; dy++) for (let dx = -MOON.r - 9; dx <= MOON.r + 9; dx++) {
      const far = Math.hypot(dx, dy), x = MOON.x + dx, y = MOON.y + dy;
      if (far <= MOON.r) this.put(x, y, Math.hypot(dx + 3, dy + 3) < MOON.r * 0.55 || hash2(x >> 1, y >> 1, 34) > 0.86 ? R.moon[1]! : R.moon[0]!);
      else if (far < MOON.r + 3.5 + 1.5 * hash2(Math.round(Math.atan2(dy, dx) * 6), 1, 35)) this.put(x, y, R.sky[4]!);
    }
  }

  /** The horizon's row at a column: it bows with the view. */
  private horizonAt(x: number): number {
    return Math.round(bend(x, SQUARE.horizon)[1]);
  }

  /** The sea from the horizon down: flat bands by its depth, long level strokes of the next tone, the light's dashes. */
  private paintSea(): void {
    const { w, hour } = this;
    for (let x = 0; x < w; x++) {
      const hz = this.horizonAt(x);
      for (let y = hz; y < 190; y++) {
        const d = y - hz;
        let t = 0.06 + 0.5 * smooth(0, 78, d);
        // long level strokes, each a place or two off the band it lies in
        const row = hash2(y, 7, 51), dash = hash2((x + Math.floor(row * 40)) >> (d > 30 ? 4 : 3), y, 52);
        if (dash > 0.74) t += 0.1; else if (dash < 0.16) t -= 0.07;
        // under the moon one broad pale plane
        if (hour.night) t += 0.24 + 0.3 * Math.exp(-(((x - MOON.x) / (26 + d)) ** 2)) * smooth(0, 6, d);
        this.put(x, y, d === 0 ? R.sea[0]! : tone(F.sea, clamp01(t), x, y));
      }
    }
    if (hour.glint < 0) return;
    for (let x = 0; x < w; x++) {
      const hz = this.horizonAt(x);
      for (let d = 2; d < 70; d += 2) {
        const near = Math.exp(-(((x - hour.glint) / (10 + d * 1.3)) ** 2));
        if (hash2(x >> 2, d, 357) > 1 - (hour.night ? 0.4 : 0.3) * near) this.put(x, hz + d, hour.night ? R.moon[0]! : R.foam);
      }
    }
  }

  // ---- far things: rocks, the pier and its boat, the shore

  private farRocks(): void {
    for (const [x, y, r] of [[262, 100, 6], [300, 97, 4], [226, 97, 3]] as const) this.as(() => {
      this.oval(x, y, r, r * 0.5, (px, py) => tone(F.stone, py < bend(x, y)[1] ? 0.5 : 0.2, px, py));
    });
  }

  /** A wall of big stone blocks: each a flat tone a little off its neighbours, a dark seam round it, a pale upper edge. */
  private blocks(light: number, course: number, long: number, seed: number): Tone {
    return (x, y) => {
      const row = Math.floor((y + 2 * noise2(x / 40, 1, 830 + seed)) / course);
      const k = Math.floor((x + row * long * 0.5 + 3 * hash2(row, 2, 831 + seed)) / long);
      const inRow = (y + 2 * noise2(x / 40, 1, 830 + seed)) - row * course, inBlock = (x + row * long * 0.5 + 3 * hash2(row, 2, 831 + seed)) - k * long;
      if (inRow < 1 || inBlock < 1) return tone(F.stone, clamp01(light - 0.34), x, y);
      const own = (hash2(k, row, 832 + seed) - 0.5) * 0.16;
      return this.worn(F.stone, light + own + (inRow < 2.2 ? 0.1 : 0), x, y, 0.06, seed);
    };
  }

  /**
   * Keri's south-east beak and the dune strip beyond it: the shore reaches out in a short point of shingle that curves
   * a little, and far out, not joined to the island, a long low bar of sand lies over the waterline, a dune along its
   * back, shoal water pale round it and surf where the swell breaks.
   */
  private spit(): void {
    const { hour } = this;
    // one line of sand and shingle: the hook leaves Keri's shore left of the pier, runs out and sweeps round to the
    // right, and goes on behind the pier as the long low dune strip, knee-high over the water, right across the distance
    const SPINE: readonly (readonly [number, number, number])[] = [[262, 131, 14], [286, 123.5, 9], [312, 117, 6], [340, 112.5, 4.2], [366, 109.5, 2.6], [404, 106.5, 2.8], [466, 103.5, 3], [520, 101, 2.6], [570, 99, 2.1], [612, 97.5, 1.6]];
    const at = (x: number): readonly [number, number] => {
      const k = Math.max(0, Math.min(SPINE.length - 2, SPINE.findIndex(([px]) => px > x) - 1 < 0 ? (x < SPINE[0]![0] ? 0 : SPINE.length - 2) : SPINE.findIndex(([px]) => px > x) - 1));
      const [x0, y0, w0] = SPINE[k]!, [x1, y1, w1] = SPINE[k + 1]!, t = clamp01((x - x0) / (x1 - x0)), e = t * t * (3 - 2 * t);
      return [y0 + (y1 - y0) * e, w0 + (w1 - w0) * e];
    };
    const L = SPINE[0]![0], RGT = SPINE[SPINE.length - 1]![0];
    const crest = (x: number): number => at(x)[0] - at(x)[1] * 0.5 - 1.1 * (noise2(x / 17, 1, 847) - 0.5);
    const foot = (x: number): number => at(x)[0] + at(x)[1] * 0.5 + 0.8 * (noise2(x / 23, 2, 847) - 0.5);
    // a gap of open water between the two: the beak ends in a point, the dune begins beyond it
    const GAP = { from: 366, to: 404 } as const;
    const band = (from: number, to: number): Pt[] => {
      const xs = Array.from({ length: 30 }, (_, k) => from + (k * (to - from)) / 29);
      return [...xs.map((x): Pt => [x, crest(x)]), ...xs.slice().reverse().map((x): Pt => [x, foot(x)])];
    };
    const parts = [band(L, GAP.from), band(GAP.to, RGT)];
    const shapes = parts.map((part) => part.map(([x, y]) => bend(x, y) as Pt));
    const onSand = (x: number, y: number): boolean => shapes.some((shape) => inside(shape, x, y));
    // the shoal: the sea a tone or two paler in level dashes round the sand
    for (let y = this.horizonAt(430) + 2; y < 128; y++) for (let x = L; x < this.w; x++) {
      let near = false;
      for (const [dx, dy] of [[0, 3], [-8, 1], [8, 1], [-15, 0], [15, 0], [0, -2]] as const) if (onSand(x + dx, y - dy)) { near = true; break; }
      if (near && hash2(x >> 2, y, 845) > 0.3) this.put(x, y, tone(F.sea, 0.82 + 0.18 * hash2(x >> 3, y, 846), x, y));
    }
    // the swell breaks on its far side and bursts up over the crest in white heaps, each its own size, smaller far out
    for (const [cx, wide, high, seed] of [[385, 6, 4, 1], [432, 8, 7, 2], [488, 9, 7, 3], [540, 5, 4, 4], [584, 4, 3, 5]] as const) {
      for (let dx = -wide; dx <= wide; dx++) {
        const top = high * (1 - (dx / wide) ** 2) * (0.6 + 0.4 * hash2(dx, seed, 851));
        for (let i = 0; i < top; i++) if (i < top - 2 || hash2(dx, i + seed * 9, 852) > 0.4) this.put(...bend(cx + dx, crest(cx + dx) - i), R.foam);
      }
      // spray thrown clear of the heap
      for (let k = 0; k < 7; k++) this.put(...bend(cx + (hash2(k, seed, 853) - 0.5) * wide * 2.6, crest(cx) - high * (0.7 + 0.6 * hash2(k, seed, 854))), R.foam);
    }
    this.as(() => {
      // its own height: a pale lit top, the straw-yellow slope under it and a dark wet foot at the water; shingle and
      // stones where it leaves the shore, sand further out
      for (const part of parts) this.poly(part, (x, y) => {
        const v = (y - bend(x, crest(x))[1]) / Math.max(1, foot(x) - crest(x));
        const pebble = hash2(x >> 1, y, 850);
        if (x < GAP.from && pebble < 0.16 * (1 - (x - L) / 110)) return tone(F.stone, clamp01(hour.ground - 0.1), x, y);
        if (v < 0.34) return this.worn(F.shingle, hour.ground + 0.34, x, y, 0.03, 28);
        if (v < 0.72) return this.worn(F.dry, hour.ground + 0.16 + (pebble > 0.8 ? 0.1 : 0), x, y, 0.04, 21);
        return this.worn(F.dry, hour.ground - 0.3, x, y, 0.05, 27);
      }, 0.6, 4);
      // marram grass in tufts along the crest
      for (let k = 0; k < 46; k++) {
        const x = GAP.to + 6 + hash2(k, 1, 843) * 170, tall = 1 + Math.floor(hash2(k, 3, 843) * 3 * (1 - (x - 360) / 300));
        if (noise2(x / 21, 3, 848) < 0.42) continue;
        for (let i = 0; i < tall; i++) this.put(...bend(x, crest(x) - i), tone(k % 4 ? F.grass : F.dry, clamp01(hour.ground - 0.24 + i * 0.12), 0, 0));
      }
    });
    // surf in short level dashes along its near edge
    for (let k = 0; k < 170; k++) {
      const x = 300 + hash2(k, 1, 849) * (RGT - 300), y = foot(x) + 1 + hash2(k, 2, 849) * 3;
      for (let d = 0; d < 2 + hash2(k, 3, 849) * 4; d++) this.put(...bend(x + d, y), R.foam);
    }
  }

  /**
   * The southern pier, the port's own (`portPicture.ts`) seen from the land: a heavy quay of grey stone on arches going
   * straight out, a pale top of big slabs, bollards, crates and a barrel, the red and white beacon with its lantern at
   * the head, the low landing beyond it with the rowing boat, and the red houseboat moored at its landward end.
   */
  private pier(): void {
    const { hour } = this;
    const { head, face } = PIER;
    const drop = (t: number): number => face * (onPier(t, 1)[1] - PIER.to.y);
    this.as(() => {
      // the low landing beyond the head, wet and darker, and the head's own end
      this.poly([onPier(head, -0.1), onPier(head, 1), onPier(head + 0.07, 1), onPier(head + 0.07, -0.1)].map(([x, y]) => [x, y + drop(head) * 0.7] as Pt), (x, y) => this.worn(F.stone, hour.ground * 0.6 + 0.1, x, y, 0.05, 23), 0.4);
      const [hx, hy] = onPier(head, 0), [rx, ry] = onPier(head, 1);
      this.poly([[hx, hy], [rx, ry], [rx, ry + drop(head) * 0.7], [hx, hy + drop(head) * 0.7]], this.blocks(hour.front * 0.6 + 0.1, 4, 9, 2), 0.3);
      // its long face on the viewer's side, in the shade: a pale coping, courses of big blocks, the arches' dark tops over the water
      this.poly([onPier(0, 1), onPier(head, 1), [rx, ry + drop(head)], [PIER.right, PIER.near + drop(0)]], (x, y) => {
        const t = (PIER.right - x) / (PIER.right - PIER.to.x), top = PIER.near + (PIER.to.y - PIER.near) * t, tall = face * (top - PIER.to.y);
        const v = (y - bend(x, top)[1]) / tall;
        if (v < 0.16) return this.worn(F.stone, hour.north + 0.3, x, y, 0.04, 24);
        for (const c of [0.1, 0.24, 0.37, 0.49, 0.6, 0.69]) {
          const half = 0.05 * (1 - c);
          if (Math.abs(t - c) < half && v > 0.5 + 0.5 * ((t - c) / half) ** 2) return R.stone[0]!;
        }
        return this.blocks(hour.north - 0.04, 4, 8, 1)(x, y);
      }, 0.5);
      // its top: big pale slabs going away
      this.poly([onPier(0, 0), onPier(0, 1), onPier(head, 1), onPier(head, 0)], (x, y) => {
        // big slabs: a seam only now and then, each slab its own flat tone
        const along = Math.floor(Math.sqrt(Math.max(0, y - PIER.to.y - 8)) * 1.3);
        const seam = along !== Math.floor(Math.sqrt(Math.max(0, y - PIER.to.y - 9)) * 1.3) && hash2(x >> 3, along, 839) > 0.3;
        return seam ? tone(F.stone, 0.24, x, y) : this.worn(F.stone, hour.ground * 0.4 + 0.36 + (hash2(along, 3, 840) - 0.5) * 0.1, x, y, 0.04);
      }, 0.5);
    });
    // the houseboat moored on the viewer's side, before the pier's face: a brown hull, a red cabin under a grey roof, a stovepipe, the seal at its bow
    const at = (x: number, y: number): Pt => [534 + (x - 552) * 0.4, 114 + (y - 128) * 0.4];
    this.as(() => {
      this.poly([at(552, 133), at(560, 142), at(640, 144), at(640, 128), at(566, 129)], (x, y) => this.worn(F.wood, 0.46, x, y, 0.06), 0.3);
      this.poly([at(572, 112), at(614, 110), at(614, 129), at(572, 130)], (x, y) => this.worn(F.red, hour.front * 0.6 + 0.14, x, y, 0.05), 0.3);
      this.poly([at(566, 113), at(570, 104), at(614, 102), at(620, 111)], (x, y) => tone(F.stone, 0.3, x, y), 0.3);
      this.poly([at(580, 116), at(590, 116), at(590, 124), at(580, 124)], () => (this.lit ? R.ember[4]! : R.tin[3]!), 0.1);
      this.line(at(604, 104), at(606, 86), R.stone[3]!, 1);
      this.oval(...at(558, 124), 2, 2.4, (x, y) => tone(F.stone, 0.6, x, y));
    });
    // bollards along its edge, smaller the further out
    for (const t of [0.08, 0.26, 0.42]) this.as(() => {
      const [x, y] = onPier(t, 0.14), s = 1 - t;
      this.poly([[x - 2 * s, y], [x + 2 * s, y], [x + 1.4 * s, y - 5 * s], [x + 3 * s, y - 5 * s], [x + 3 * s, y - 7 * s], [x - 3 * s, y - 7 * s], [x - 3 * s, y - 5 * s], [x - 1.4 * s, y - 5 * s]], () => R.stone[0]!, 0.2);
    });
    this.as(() => {
      // crates and a barrel near the head
      const [x, y] = onPier(head - 0.1, 0.55);
      this.poly([[x - 3, y], [x + 1, y], [x + 1, y - 3], [x - 1, y - 3], [x - 1, y - 5], [x - 3, y - 5]], (px, py) => this.worn(F.wood, 0.46, px, py, 0.08, 25), 0.1);
      this.oval(x + 3, y - 1.5, 1.4, 1.8, (px, py) => this.worn(F.wood, 0.36, px, py, 0.06, 26));
    });
    this.as(() => {
      // the beacon at the head: a post in red and white bands, an arm and its lantern
      const [x, y] = onPier(head - 0.03, 0.6);
      for (let i = 0; i < 18; i++) for (let d = -1; d <= 1; d++) this.put(...bend(x + d, y - i), [R.plaster[4]!, R.plaster[4]!, R.red[2]!][Math.floor(i / 2.2) % 3]!);
      this.line([x, y - 18], [x - 5, y - 17], R.boards[0]!, 1);
      for (const [dx, dy] of [[-6, -16], [-5, -16], [-6, -15], [-5, -15], [-6, -14], [-5, -14]] as const) this.put(...bend(x + dx, y + dy), this.lit ? R.ember[5]! : R.stone[0]!);
    });
    this.as(() => {
      // the tarred rowing boat at the landing
      const [x, y] = onPier(head + 0.02, 0);
      this.poly([[x - 11, y + 1], [x - 2, y], [x - 3, y + 3], [x - 9, y + 3]], () => R.boards[0]!, 0.2);
    });
  }

  /**
   * The far shore below the hill: a thin pale strand, small and far, and between it and the hill's brow the dark tops of
   * the wild rose thickets on the low ground, so the eye drops from the lit brow to what lies far under it.
   */
  private shore(): void {
    const { hour } = this;
    this.poly([[224, 150], [256, 124], [300, 127], [340, 126], [450, 124], [560, 123], [650, 120], [650, 150], [0, 150]], (x, y) => {
      const pebble = hash2(x >> 1, y >> 1, 850);
      return pebble > 0.84 ? tone(F.shingle, clamp01(hour.ground + 0.3), x, y) : pebble < 0.14 ? tone(F.stone, clamp01(hour.ground - 0.1), x, y) : tone(F.dry, clamp01(hour.ground + 0.24), x, y);
    }, 1.6);
    this.as(() => {
      const thicket: Tone = (x, y) => {
        const lump = Math.round(fbm(x / 9, y / 5, 2, 851) * 4) / 4;
        return tone(F.grass, clamp01(hour.ground * 0.3 - 0.12 + lump * 0.22 + (hash2(x, y, 852) > 0.94 ? 0.12 : 0)), x, y);
      };
      this.poly([[244, 162], [262, 140], [300, 136], [340, 133], [420, 131], [520, 130], [650, 127], [650, 184], [244, 184]], thicket, 1.6, 7);
      // its top is lumps of bushes, no two alike
      for (let k = 0; k < 34; k++) {
        const x = 268 + k * 11.4 + hash2(k, 1, 853) * 6, top = 136 - (x - 268) * 0.022;
        this.oval(x, top + 1, 5 + hash2(k, 2, 853) * 5, 2.4 + hash2(k, 3, 853) * 3, thicket);
      }
    });
    // the path's end, small, down through the thickets to the pier's root
    this.poly([[502, 160], [512, 160], [490, 142], [480, 127], [462, 127], [478, 142]], (x, y) => this.worn(F.shingle, hour.ground + 0.1, x, y, 0.05, 30), 0.6, 8);
  }

  // ---- the houses

  /** Lime plaster in a light: flat worn patches, damp and darker at its foot, and stone blocks where the plaster has fallen. */
  private plaster(light: number, foot: number, seed: number, fallen = 0.66, wash: readonly number[] = F.plaster): Tone {
    const stone = this.blocks(light - 0.12, 9, 21, seed);
    return (x, y) => {
      if (fbm(x / 31, y / 19, 3, 860 + seed) > fallen) return stone(x, y);
      const damp = 0.16 * smooth(foot - 26, foot, y + 6 * noise2(x / 9, 1, 861 + seed));
      return this.worn(wash, light - damp, x, y, 0.07, seed);
    };
  }

  /**
   * A wall as the 1991 game builds a town's: stones of every size laid in loose courses, each its own flat blotch of
   * colour (the wash, ochre, a rusty one now and then), pale soft mortar and no dark joints, the whole wall mottled in
   * broad patches and damp at its foot. `lift` moves the courses up or down at a pixel, for a wall that curves or leans.
   */
  private masonry(light: number, foot: number, seed: number, wash: readonly number[] = F.plaster, scale = 1, lift: (x: number) => number = () => 0): Tone {
    return (x, y) => {
      const yy = y + lift(x) + 2.4 * noise2(x / 34, 1, 960 + seed);
      const course = Math.floor(yy / (8 * scale)), tall = 8 * scale;
      const long = (13 + 12 * hash2(course, 1, 961 + seed)) * scale;
      const along = (x + hash2(course, 2, 961 + seed) * 40) / long + 0.3 * noise2(course, x / 60, 962 + seed);
      const k = Math.floor(along), u = along - k, v = yy / tall - course;
      const patch = (fbm(x / 60, y / 40, 2, 963 + seed) - 0.5) * 0.3;
      const damp = 0.16 * smooth(foot - 26, foot, y + 6 * noise2(x / 9, 1, 861 + seed));
      const base = light + patch - damp;
      // the mortar: a pale soft line, wider at a stone's corners so each stone is rounded
      const edge = Math.min(u, 1 - u) * long, bed = Math.min(v, 1 - v) * tall;
      if (edge < 1 || bed < 0.9 || edge + bed < 2.6) return this.worn(wash, base + 0.16, x, y, 0.04, seed);
      const kind = hash2(k, course, 964 + seed), own = (hash2(k, course, 965 + seed) - 0.5) * 0.26;
      // a stone's far edge catches the light, its near edge is a tone down
      const dome = v < 0.3 ? 0.06 : v > 0.74 ? -0.08 : 0;
      if (kind > 0.96) return this.worn(F.earth, base + 0.56 + own + dome, x, y, 0.05, seed);
      if (kind > 0.86) return this.worn(F.dry, base + 0.1 + own + dome, x, y, 0.05, seed);
      if (kind > 0.6) return this.worn(F.shingle, base - 0.04 + own + dome, x, y, 0.05, seed);
      return this.worn(wash, base - 0.06 + own + dome, x, y, 0.05, seed);
    };
  }

  /** A tin roof, blue or painted red: ribs down its slope every few pixels, a pale side and a dark side to each, rust in patches. */
  private tin(light: number, slope: number, seed: number, paint: readonly number[] = F.tin): Tone {
    return (x, y) => {
      const along = x - y * slope;
      const rib = ((along % 9) + 9) % 9;
      if (fbm(x / 17, y / 9, 2, 870 + seed) > 0.7) return tone(F.wood, 0.4 + (rib < 2 ? 0.14 : 0), x, y);
      return this.worn(paint, light + (rib < 1.5 ? 0.2 : rib > 7 ? -0.18 : 0), x, y, 0.05, seed);
    };
  }

  /** A window: a fat dark frame, a cross, the glass dark by day and lit at dusk and night. */
  private window(pts: readonly [Pt, Pt, Pt, Pt], lit: boolean): void {
    const [a, b, c, d] = pts;
    this.poly(pts, () => R.boards[0]!, 0.4);
    const inset = (p: Pt, q: Pt, t: number): Pt => [p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t];
    const glass = [inset(a, c, 0.16), inset(b, d, 0.16), inset(c, a, 0.16), inset(d, b, 0.16)];
    this.poly(glass, (x, y) => (lit ? (hash2(x >> 1, y >> 1, 880) > 0.7 ? R.ember[4]! : R.ember[5]!) : tone(F.tin, 0.12 + 0.2 * noise2(x / 6, y / 6, 881), x, y)), 0.3);
    this.line(inset(a, b, 0.5), inset(d, c, 0.5), R.boards[0]!, 2);
    this.line(inset(a, d, 0.5), inset(b, c, 0.5), R.boards[0]!, 2);
  }

  /** The cinema house (`building-3`), further back: a long house whose left part is hidden behind the side building. */
  private cinema(): void {
    const { hour } = this;
    this.as(() => {
      this.poly([[104, 168], [250, 160], [256, 118], [104, 124]], ((wall: Tone): Tone => (x, y) => (x + noise2(y / 9, 1, 862) * 5 < 170 ? tone(F.dry, clamp01(hour.front * 0.3), x, y) : wall(x, y)))(this.masonry(hour.front * 0.8 + 0.1, 164, 2, F.dry, 0.8)));
      // the gable end turned to the sea, in the other light
      this.poly([[232, 161], [250, 160], [256, 118], [236, 119]], this.masonry(hour.south * 0.8 + 0.08, 162, 3, F.dry, 0.8));
    });
    this.as(() => {
      // a hip roof that sags along its ridge
      this.poly([[92, 128], [118, 92], [170, 96], [232, 88], [272, 120], [180, 124]], this.tin(hour.front * 0.5 + 0.2, 0.5, 2, F.red), 1.4);
      this.poly([[92, 128], [180, 124], [272, 120], [272, 124], [180, 129], [94, 133]], () => R.red[0]!, 0.5);
      // the engine room's stovepipe, crooked
      this.line([138, 96], [134, 70], R.stone[1]!, 4);
      this.line([134, 70], [140, 62], R.stone[1]!, 4);
      this.line([136, 96], [132, 70], R.stone[3]!, 1);
    });
    this.as(() => {
      // the cinema's double doors under an awning with a row of bulbs, a poster (a picture, no words), a window
      this.poly([[174, 163], [206, 161], [206, 132], [174, 134]], (x, y) => (this.lit ? tone(F.ember, 0.72 + 0.2 * noise2(x / 5, y / 7, 890), x, y) : this.worn(F.wood, 0.34, x, y, 0.1)), 0.4);
      this.line([190, 133], [190, 162], this.lit ? R.ember[1]! : R.wood[0]!, 1);
      this.poly([[164, 134], [214, 131], [220, 121], [164, 124]], (x, y) => (((x >> 2) & 1) ? this.worn(F.tin, 0.5, x, y, 0.05) : this.worn(F.plaster, 0.8, x, y, 0.05)), 0.5);
      for (let x = 168; x < 216; x += 6) this.put(...bend(x, 133 - (x - 168) * 0.05), this.lit ? R.ember[5]! : R.dry[3]!);
      this.poly([[216, 136], [232, 135], [232, 157], [216, 158]], () => R.boards[1]!, 0.3);
      this.poly([[218, 138], [230, 137], [230, 155], [218, 156]], (x, y) => tone(F.red, 0.5, x, y), 0.2);
      this.oval(224, 149, 4, 3, () => R.tin[0]!);
      this.oval(227, 142, 1.6, 1.6, () => R.dry[3]!);
    });
    // a small window high in the gable end, lit at dusk and night
    this.as(() => this.window([[238, 128], [248, 127], [248, 138], [238, 139]], this.lit));
  }

  /** The lighthouse's side building (`building-2`): the left wing, its south wall running off east from beside the viewer. */
  private sideBuilding(): void {
    const { hour } = this;
    this.as(() => {
      this.poly([[-10, 262], [140, 186], [146, 104], [-10, -30]], this.masonry(hour.south, 250, 5, F.plaster, 1.5, (x) => -x * 0.16), 1.6);
      // the eaves' shade lies in a slanting band under the roof
      this.poly([[-10, -10], [146, 114], [146, 126], [-10, 22]], (x, y) => this.worn(F.plaster, hour.south - 0.34, x, y, 0.05, 6), 1.8);
      // the corner's dressed stones
      for (let k = 0; k < 6; k++) {
        const y = 118 + k * 12, wide = k % 2 ? 9 : 14;
        this.poly([[141 - wide, y + (wide * 0.5)], [144, y - 1], [144, y + 9], [141 - wide, y + 10 + wide * 0.5]], this.blocks(hour.south - 0.08, 30, 40, 7 + k), 0.4);
      }
    });
    this.as(() => {
      // the tin roof above, its eave a fat dark edge
      this.poly([[-20, -16], [70, 58], [160, 118], [154, 92], [72, 24], [-20, -60]], this.tin(hour.south * 0.5 + 0.2, -0.7, 5), 1.4);
      this.poly([[-20, -16], [70, 58], [160, 118], [160, 125], [70, 66], [-20, -8]], () => R.tin[0]!, 0.6);
    });
    this.as(() => {
      // a window boarded up: three planks nailed across it, none level
      this.poly([[18, 64], [62, 96], [60, 164], [18, 154]], () => R.boards[0]!, 0.6);
      this.poly([[24, 76], [56, 100], [55, 156], [24, 148]], (x, y) => tone(F.tin, 0.06 + 0.1 * noise2(x / 7, y / 7, 900), x, y), 0.4);
      for (const [y0, y1, s] of [[84, 112, 1], [108, 128, 2], [128, 154, 3]] as const) {
        this.poly([[12, y0], [68, y1], [67, y1 + 9], [12, y0 + 10]], (x, y) => this.worn(F.boards, hour.south - 0.1 + (hash2(x >> 3, s, 901) - 0.5) * 0.1, x, y, 0.08, s), 0.5);
      }
    });
    this.as(() => {
      // a door with planks nailed across in a cross
      this.poly([[84, 214], [112, 199], [112, 128], [84, 118]], () => R.boards[0]!, 0.5);
      this.poly([[88, 210], [108, 200], [108, 132], [88, 124]], (x, y) => this.worn(F.wood, 0.3 + ((x >> 2) % 2 ? 0.06 : 0), x, y, 0.08), 0.4);
      this.line([84, 138], [112, 186], (x, y) => this.worn(F.boards, hour.south - 0.06, x, y, 0.06), 4);
      this.line([112, 140], [84, 196], (x, y) => this.worn(F.boards, hour.south, x, y, 0.06), 4);
    });
    this.as(() => {
      // a drainpipe down the wall from the eave, bent at its foot, into the rain barrel
      this.line([126, 108], [124, 150], R.stone[1]!, 3);
      this.line([124, 150], [127, 182], R.stone[1]!, 3);
      this.line([127, 108], [125, 150], R.stone[3]!, 1);
      for (const y of [122, 148, 172]) this.line([122, y], [129, y], R.stone[0]!, 1);
    });
    this.barrel(128, 204, 10, 22, 4);
    this.as(() => {
      // a lantern's bracket on the corner
      this.line([145, 147], [152, 147], R.boards[0]!, 2);
    });
  }

  /** The old boat shed's corner (`wood-shed`): the right wing, upright boards of every width, in the shade, a net and floats hung on it. */
  private boatShed(): void {
    const { hour } = this;
    this.as(() => {
      this.poly([[582, 372], [660, 372], [660, 30], [604, 58]], (x, y) => {
        const board = Math.floor((x + 3 * noise2(y / 50, 1, 910)) / 9), inBoard = x + 3 * noise2(y / 50, 1, 910) - board * 9;
        if (inBoard < 1.2) return R.boards[0]!;
        return this.worn(F.boards, hour.north + (hash2(board, 4, 911) - 0.5) * 0.14 + (inBoard < 2.6 ? 0.08 : 0), x, y, 0.07, 9);
      }, 1.2);
      // its corner post catches the light
      this.poly([[580, 372], [591, 372], [610, 58], [602, 58]], (x, y) => this.worn(F.boards, hour.north + 0.34, x, y, 0.06, 10), 0.8);
    });
    this.as(() => {
      this.poly([[574, 66], [660, 22], [660, -10], [606, 6]], (x, y) => this.worn(F.boards, 0.2 + (((x + y) >> 3) % 2 ? 0.08 : 0), x, y, 0.08, 12), 1.2);
      this.poly([[574, 66], [660, 22], [660, 30], [578, 72]], () => R.boards[0]!, 0.5);
    });
    this.as(() => {
      // a net hung in two swags, cork floats along it
      for (const [l, r, top, sag] of [[600, 640, 120, 46], [608, 640, 126, 30]] as const) {
        for (let x = l; x <= r; x++) {
          const t = (x - l) / (r - l + 6), y = top + sag * Math.sin(Math.PI * t * 0.9);
          this.put(...bend(x, y), R.dry[1]!);
          if ((x - l) % 9 === 4) this.oval(x, y + 1, 2.2, 2.2, () => R.red[3]!);
        }
      }
    });
  }

  // ---- the plaza

  /** The ground round the plaza: trodden earth and thin grass, broken marks of every tone (rule 23). */
  private ground(): void {
    const { hour } = this;
    this.poly([[-10, 372], [-10, 190], [120, 168], [250, 160], ...Array.from({ length: 21 }, (_, k): Pt => [250 + k * 20, k === 0 ? 160 : brow(250 + k * 20)]), [650, 372]], (x, y) => {
      const sh = this.shade(x, y);
      const grassy = fbm(x / 37, y / 11, 3, 920) + 0.12 * smooth(200, 150, y);
      // the hill is a fat belly: its brow is the picture's strongest edge on the land
      const over = x > 250 ? y - bend(x, brow(x))[1] : 99;
      // dark where it rounds over against the pale strand far below, then a lit band where the belly turns up to the sun
      const light = hour.ground - sh * 0.46 + (over < 6 ? -0.5 : over < 10 ? -0.2 : over < 22 ? 0.14 : 0);
      if (grassy > 0.56 || over < 20) {
        const blade = hash2(x, y >> 1, 921);
        return blade > 0.8 ? tone(F.dry, clamp01(light - 0.1 + blade * 0.2), x, y) : tone(F.grass, clamp01(light - 0.34 + blade * 0.42), x, y);
      }
      return this.worn(F.earth, light + 0.12 + (hash2(x >> 1, y, 922) > 0.9 ? 0.2 : 0), x, y, 0.1);
    }, 1.8);
  }

  /**
   * The trodden paths: one from the plaza to the cinema's doors and on into the gap behind the side building (it goes
   * on round the lighthouse), one from the plaza down to the pier's root. Pale gravel beaten into the earth, ragged edges.
   */
  private paths(): void {
    const { hour } = this;
    const beaten: Tone = (x, y) => {
      // the gap between the two houses is a shady alley: the path darkens as it goes in under the eaves
      const light = hour.ground + 0.16 - this.shade(x, y) * 0.46 - 0.44 * smooth(196, 156, x + (y - 170) * 0.8), speck = hash2(x >> 1, y, 923);
      return speck < 0.12 ? tone(F.earth, clamp01(light + 0.1), x, y) : this.worn(F.shingle, light - 0.04 + (speck > 0.9 ? 0.12 : 0), x, y, 0.06, 29);
    };
    this.poly([[262, 186], [236, 170], [206, 165], [176, 166], [120, 167], [120, 174], [170, 178], [200, 184], [222, 196]], beaten, 1.6, 5);
    this.poly([[430, 186], [492, 184], [530, 172], [524, 153], [498, 152], [498, 164], [452, 174]], beaten, 2, 6);
  }

  /** A boulder: a heap of two or three round lumps, a pale top, a hard shade side away from the hour's sun, a dark foot. */
  private boulder(x: number, foot: number, wide: number, high: number, seed: number): void {
    const { hour } = this;
    this.as(() => {
      for (const [dx, r, up] of [[-0.4, 0.62, 0.7], [0.36, 0.56, 0.6], [0, 0.74, 1]] as const) {
        const cx = x + dx * wide, cy = foot - (high * up) / 2, [bx, by] = bend(cx, cy);
        this.oval(cx, cy, wide * r, (high * up) / 2, (px, py) => {
          const lit = -(py - by) / ((high * up) / 2) * 0.6 + ((px - bx) / (wide * r)) * hour.side * 0.5;
          return tone(F.stone, clamp01(hour.ground * 0.6 + 0.1 + Math.round(lit * 3) / 3 * 0.36 - this.shade(px, py) * 0.2 + (hash2(px, py, 955 + seed) > 0.94 ? 0.14 : 0)), px, py);
        });
      }
    });
  }

  /** What lies on the hill and the strand below it: boulders, an upturned boat on the shingle, crooked posts with a rope down the path to the pier, a sail far out. */
  private far(): void {
    // a sail on the horizon
    this.as(() => {
      this.poly([[306, 91], [306, 82], [312, 91]], () => R.plaster[4]!, 0.1);
      this.line([302, 92], [314, 92], R.boards[0]!, 1);
    });
    for (const [x, foot, wide, high, seed] of [[420, 129, 3, 2.4, 1], [346, 130, 3, 2.2, 2], [556, 128, 4, 3, 3], [600, 126, 3, 2.4, 4], [512, 129, 2.6, 2, 5]] as const) this.boulder(x, foot, wide, high, seed);
    this.as(() => {
      // a boat pulled up and turned over on the shingle, its keel a pale line
      this.poly([[430, 129], [433, 125], [446, 124], [450, 128]], (x, y) => this.worn(F.boards, 0.3, x, y, 0.05, 31), 0.3);
      this.line([433, 125], [446, 124], R.boards[3]!, 1);
    });
  }

  /** On the hill's brow: boulders in the grass, tall tufts standing against the far shore, and the posts down the path. */
  private browThings(): void {
    const { hour } = this;
    this.boulder(300, 160, 10, 8, 6);
    this.boulder(318, 162, 6, 4.4, 7);
    this.boulder(590, 176, 13, 10, 8);
    this.boulder(404, 157, 5, 3.6, 9);
    // tufts along the brow, tall enough to break its line
    for (let k = 0; k < 60; k++) {
      const x = 262 + hash2(k, 1, 956) * 330, y = brow(x) + 1 + hash2(k, 2, 956) * 4, tall = 3 + Math.floor(hash2(k, 3, 956) ** 2 * 8);
      if (x > 494 && x < 530) continue;
      for (let b = -1; b <= 1; b++) {
        const h = tall - Math.abs(b) * 2, run = hash2(k, b, 957) > 0.7 ? F.dry : F.grass, lean = (hash2(k, 4, 956) - 0.3) * 0.5;
        for (let i = 0; i < h; i++) this.put(...bend(x + b * 1.3 + i * (lean + b * 0.16), y - i), tone(run, clamp01(hour.ground - 0.4 + (i / Math.max(1, h)) * 0.56), 0, 0));
      }
    }
    // crooked posts down the right of the path, a rope sagging from one to the next, smaller as they go over the brow
    const posts: readonly (readonly [number, number, number])[] = [[548, 190, 24], [541, 174, 18], [534, 162, 13], [528, 154, 9]];
    this.as(() => {
      posts.forEach(([x, y, tall], k) => {
        const lean = (k % 2 ? 1 : -1) * 1.2;
        this.line([x, y], [x + lean, y - tall], R.wood[0]!, tall > 10 ? 3 : 2);
        this.line([x + hour.side, y], [x + lean + hour.side, y - tall], R.wood[3]!, 1);
        const next = posts[k + 1];
        if (!next) return;
        for (let t = 0; t <= 1; t += 0.04) this.put(...bend(x + lean + (next[0] - x) * t, y - tall + 2 + (next[1] - next[2] - y + tall) * t + 3 * Math.sin(Math.PI * t)), R.dry[2]!);
      });
    });
  }

  /** A flagstone's ring and its place round it, or null off the plaza. */
  private flag(x: number, y: number): { ring: number; stone: number; seam: boolean; top: boolean } | null {
    const [cx, cy] = bend(SQUARE.lamp.x, SQUARE.lamp.y);
    const dx = (x - cx) / RX, dy = (y - cy) / RY;
    const r = Math.hypot(dx, dy) + 1.6 * (noise2(x / 23, y / 9, 930) - 0.5), a = Math.atan2(dy, dx);
    const ring = RINGS.findIndex((edge) => r < edge);
    if (ring < 0) return null;
    const inner = ring === 0 ? 0 : RINGS[ring - 1]!, outer = RINGS[ring]!;
    const perUnit = RX * Math.abs(Math.cos(a)) + RY * Math.abs(Math.sin(a));
    const count = 7 + ring * 4 + (ring > 7 ? 10 : 0);
    const turn = (a / (Math.PI * 2) + 1 + ring * 0.137) * count;
    const stone = Math.floor(turn), inStone = turn - stone;
    const arc = ((r * Math.PI * 2) / count) * (RX * Math.abs(Math.sin(a)) + RY * Math.abs(Math.cos(a)));
    const fat = y > 290 ? 3 : y > 214 ? 2 : 1.3;
    const seam = (r - inner) * perUnit < 1.2 * fat || Math.min(inStone, 1 - inStone) * arc < fat;
    // a stone's far edge catches the light: the row or two just inside its seam on the side away from the viewer
    const top = dy < 0 ? (outer - r) * perUnit < 2.6 : (r - inner) * perUnit < 2.6;
    return { ring, stone: stone % count, seam, top };
  }

  private plaza(): void {
    const { hour } = this;
    this.as(() => {
      // cobbles after the 1991 game's town streets: a pale ground of worn stone with no drawn joints; here and there
      // a cobble shows as a warm rounded blotch, bigger toward the viewer, and the light and the cast shade carry the plane
      this.poly([[124, 194], [244, 170], [344, 158], [392, 178], [600, 186], [612, 372], [-10, 372], [-10, 290]], (x, y) => {
        const f = this.flag(x, y);
        const sh = this.shade(x, y);
        const light = hour.ground + 0.06 - sh * 0.74;
        if (!f) return this.worn(F.earth, light + 0.1, x, y, 0.1);
        // bare earth in a few soft patches where the stones are gone, and moss in a speck here and there
        if (fbm(x / 44, y / 15, 2, 934) > 0.84) return this.worn(F.earth, light + 0.3, x, y, 0.1);
        if (hash2(x >> 1, y >> 1, 931) < 0.003 + f.ring * 0.0015) return tone(F.grass, clamp01(light - 0.2 + hash2(x, y, 932) * 0.3), x, y);
        // the cobbles' courses: low and small far off, tall and broad at the viewer's feet, each course shifted on the last
        const depth = Math.sqrt(Math.max(0, y - 150)) * 1.9, course = Math.floor(depth), v = depth - course;
        const tall = (2 * Math.sqrt(Math.max(1, y - 150))) / 1.9, wide = tall * 2.5;
        const along = (x - SQUARE.lamp.x) / wide + hash2(course, 1, 941) * 7, stone = Math.floor(along), u = along - stone;
        // which cobbles show: in drifts, so some stretches are all pale ground and others busy with stones
        const shows = hash2(stone, course, 935) < 0.26 + 0.6 * fbm(x / 80, y / 30, 2, 937);
        const wobble = 0.36 * (noise2(x / 4 + stone * 3.1, y / 2.4 + course * 1.7, 938) - 0.5);
        const round = ((u - 0.5) / 0.5) ** 2 + ((v - 0.5) / 0.5) ** 2 + wobble;
        const size = 0.46 + 0.42 * hash2(stone, course, 939);
        if (shows && round < size) {
          const own = (hash2(stone, course, 933) - 0.5) * 0.22, kind = hash2(stone, course, 936);
          // lit on its far side, darker along its near edge: a low dome
          const dome = v < 0.4 ? 0.1 : v > 0.7 ? -0.14 : 0;
          // in the sun warm tan and rust, in the shade cool grey with a rusty one among them
          if (sh > 0.5) return this.worn(kind > 0.88 ? F.earth : F.stone, light + (kind > 0.88 ? 0.42 : 0.3) + own + dome, x, y, 0.05, course);
          return this.worn(kind > 0.88 ? F.earth : kind > 0.36 ? F.dry : F.shingle, light + (kind > 0.88 ? 0.5 : kind > 0.36 ? 0 : -0.1) + own + dome, x, y, 0.05, course);
        }
        // the pale ground between: mottled in broad soft patches, a tone darker close round a cobble
        const mottle = Math.round((fbm(x / 26, y / 9, 2, 936) - 0.5) * 6) / 6;
        return this.worn(fbm(x / 33, y / 12, 2, 940) > 0.62 ? F.shingle : F.plaster, light + 0.22 + mottle * 0.3 - (shows && round < size + 0.3 ? 0.1 : 0), x, y, 0.06, 3);
      }, 2.2);
    });
    this.tufts();
  }

  /** Tufts in the joints and at the plaza's edge: growth of every height, most of it low (rule 23). */
  private tufts(): void {
    const { hour } = this;
    for (let k = 0; k < 280; k++) {
      const x = 20 + hash2(k, 1, 940) * 580, y = 172 + hash2(k, 2, 940) ** 0.8 * 186;
      const f = this.flag(x, y);
      if (f && !f.seam && f.ring < 8) continue;
      if (!F.shingle.includes(this.at(x, y)) && !F.earth.includes(this.at(x, y)) && !F.grass.includes(this.at(x, y)) && !F.stone.includes(this.at(x, y))) continue;
      const tall = 2 + Math.floor(hash2(k, 3, 940) ** 2 * (4 + (y - 170) * 0.09));
      const light = hour.ground - this.shade(x, y) * 0.36;
      for (let b = -1; b <= 1; b++) {
        const h = tall - Math.abs(b) - (hash2(k, b, 941) > 0.5 ? 1 : 0), run = hash2(k, b, 942) > 0.78 ? F.dry : F.grass;
        for (let i = 0; i < h; i++) this.put(x + b * 1.4 + (i * b) / 3 - i * 0.25, y - i, tone(run, clamp01(light - 0.3 + (i / Math.max(1, h)) * 0.42), 0, 0));
      }
    }
  }

  /** The plaza's middle: a round flower bed in a kerb of stone, a rose bush grown tall in its middle. */
  private flowerBed(): void {
    const { hour } = this;
    const { x, y } = SQUARE.lamp;
    this.as(() => {
      // the kerb's side, then its top
      this.oval(x, y + 8, 42, 13, (px, py) => this.blocks(hour.north + 0.08, 8, 13, 13)(px, py));
      this.oval(x, y, 42, 12, (px, py) => this.worn(F.plaster, hour.ground + 0.14 - this.shade(px, py) * 0.4 + (py < bend(x, y)[1] - 6 ? 0.06 : 0), px, py, 0.05, 14));
    });
    this.as(() => {
      // the soil, and the growth heaped on it: leaves in flat clumps, dark at the foot and on the side away from the sun
      this.oval(x, y - 1, 35, 8.6, (px, py) => this.worn(F.earth, 0.2, px, py, 0.08, 15));
      const [cx, cy] = bend(x, y - 6);
      this.oval(x, y - 6, 32, 9.4, (px, py) => {
        const clump = fbm(px / 7, py / 4, 2, 951), across = (px - cx) / 32, up = (cy - py) / 9.4;
        return tone(F.grass, clamp01(hour.ground * 0.5 + 0.1 + clump * 0.34 + up * 0.14 + across * hour.side * 0.14), px, py);
      });
      // the flowers: red, yellow and white heads on stems of every height, the tall ones at the post
      const heads = [R.red[3]!, R.red[4]!, R.dry[R.dry.length - 1]!, R.plaster[4]!, R.red[2]!, R.dry[3]!];
      for (let k = 0; k < 64; k++) {
        const a = hash2(k, 1, 952) * Math.PI * 2, r = Math.sqrt(hash2(k, 2, 952));
        const fx = x + Math.cos(a) * r * 30, fy = y - 6 + Math.sin(a) * r * 8;
        const tall = Math.floor(hash2(k, 3, 952) ** 2 * (3 + 6 * (1 - r)));
        const [px, py] = bend(fx, fy);
        for (let i = 0; i < tall; i++) this.put(px, py - i, R.grass[1]!);
        const head = heads[Math.floor(hash2(k, 4, 952) * heads.length)]!;
        this.put(px, py - tall, head);
        this.put(px + 1, py - tall, head);
        this.put(px, py - tall - 1, head);
        if (hash2(k, 5, 952) > 0.4) this.put(px + 1, py - tall - 1, head);
      }
    });
    this.as(() => {
      // the rose bush in the middle: lumps of leaves heaped up, each lit on top and toward the hour's sun, dark under
      // its neighbour; the roses in bunches on the lit sides
      const lumps: readonly (readonly [number, number, number, number])[] = [[-9, -12, 10, 9], [9, -14, 11, 10], [-2, -26, 12, 11], [12, -27, 7, 6], [-13, -22, 6, 6], [2, -36, 7, 6]];
      for (const [dx, dy, rx, ry] of lumps) {
        const [cx, cy] = bend(x + dx, y + dy);
        this.oval(x + dx, y + dy, rx, ry, (px, py) => {
          const lit = -(py - cy) / ry * 0.5 + ((px - cx) / rx) * hour.side * 0.4 + (fbm(px / 3, py / 3, 2, 953) - 0.5) * 0.5;
          return tone(F.grass, clamp01(hour.ground * 0.5 + 0.2 + Math.round(lit * 3) / 3 * 0.42), px, py);
        });
      }
      for (const [k, [dx, dy, rx, ry]] of lumps.entries()) for (let n = 0; n < 3 + (k % 3); n++) {
        const [px, py] = bend(x + dx + (hash2(k, n, 954) - 0.5 + hour.side * 0.25) * rx * 1.1, y + dy - hash2(k, n, 955) * ry * 0.7);
        const head = hash2(k, n, 956) > 0.4 ? R.red[3]! : R.red[4]!;
        this.put(px, py, head); this.put(px + 1, py, head); this.put(px, py + 1, R.red[2]!); this.put(px + 1, py + 1, R.red[2]!);
        if (n % 2) { this.put(px + 2, py + 1, head); this.put(px + 1, py - 1, R.red[4]!); }
      }
    });
  }

  /** The lanterns themselves (the kit's), each on its hook. */
  private lanterns(): void {
    const brush = this.brush((x, y, c) => this.put(x, y, c));
    LANTERNS.forEach((l, k) => this.as(() => {
      const [x, y] = bend(l.x, l.y);
      lantern.paint(brush, Math.round(x), Math.round(y), optionsOf(lantern), k);
    }));
  }

  private bench(x: number, y: number, wide: number): void {
    const { hour } = this;
    this.as(() => {
      const seat: Tone = (px, py) => this.worn(F.wood, hour.ground * 0.7 + 0.2 - this.shade(px, py) * 0.3, px, py, 0.08, 16);
      // a back of two boards on crooked posts, a seat, four legs, none alike
      this.line([x + 2, y - 2], [x + 1, y - 26], R.wood[1]!, 3);
      this.line([x + wide - 3, y - 4], [x + wide - 1, y - 28], R.wood[1]!, 3);
      this.poly([[x - 2, y - 24], [x + wide + 2, y - 27], [x + wide + 2, y - 21], [x - 2, y - 18]], seat, 0.5);
      this.poly([[x - 1, y - 15], [x + wide + 1, y - 18], [x + wide + 1, y - 13], [x - 1, y - 10]], seat, 0.5);
      this.poly([[x - 4, y - 6], [x + wide + 4, y - 9], [x + wide + 6, y - 2], [x - 2, y + 2]], seat, 0.5);
      this.line([x, y + 1], [x - 1, y + 10], R.wood[0]!, 3);
      this.line([x + wide, y - 2], [x + wide + 2, y + 8], R.wood[0]!, 3);
    });
  }

  /** A barrel: fat in the middle, staves in flat bands lit from the hour's side, two iron hoops. */
  private barrel(x: number, foot: number, r: number, tall: number, seed: number): void {
    const { hour } = this;
    this.as(() => {
      for (let dy = 0; dy <= tall; dy++) {
        const belly = r * (0.8 + 0.2 * Math.sin((Math.PI * dy) / tall));
        for (let dx = -Math.ceil(belly); dx <= belly; dx++) {
          const [px, py] = bend(x + dx, foot - dy);
          const across = dx / belly, hoop = dy === Math.round(tall * 0.22) || dy === Math.round(tall * 0.78) || dy === Math.round(tall * 0.22) + 1;
          const light = 0.5 + 0.34 * across * hour.side - 0.2 * Math.abs(across) - this.shade(px, py) * 0.24;
          const stave = Math.floor((across + 1) * 3.4 + seed);
          this.put(px, py, hoop ? tone(F.stone, clamp01(light * 0.5), px, py) : this.worn(F.wood, light + (stave % 2 ? 0.05 : -0.03), px, py, 0.06, seed));
        }
      }
      this.oval(x, foot - tall, r * 0.8, r * 0.3, (px, py) => this.worn(F.wood, 0.56, px, py, 0.05, seed));
    });
  }

  private crate(x: number, foot: number, wide: number, tall: number): void {
    const { hour } = this;
    this.as(() => {
      this.poly([[x, foot], [x + wide, foot - 3], [x + wide + 1, foot - tall - 3], [x - 1, foot - tall]], (px, py) => this.worn(F.boards, hour.north + 0.2 + (((py + (px >> 3)) >> 2) % 2 ? 0.06 : 0) - this.shade(px, py) * 0.2, px, py, 0.08, 18), 0.6);
      this.poly([[x - 1, foot - tall], [x + wide + 1, foot - tall - 3], [x + wide + 8, foot - tall - 9], [x + 6, foot - tall - 6]], (px, py) => this.worn(F.boards, hour.ground * 0.8 + 0.1, px, py, 0.06, 19), 0.6);
      this.line([x + 1, foot - 2], [x + wide, foot - tall - 2], R.boards[1]!, 2);
    });
  }

  private props(): void {
    this.bench(452, 208, 70);
    // a small bench by the cinema's wall
    this.as(() => {
      this.poly([[258, 170], [292, 169], [293, 173], [258, 174]], (x, y) => this.worn(F.wood, 0.5, x, y, 0.08, 20), 0.4);
      this.line([261, 174], [260, 181], R.wood[0]!, 2);
      this.line([289, 173], [290, 180], R.wood[0]!, 2);
    });
    this.crate(482, 242, 32, 24);
    this.barrel(552, 238, 12, 28, 1);
    this.barrel(574, 246, 11, 24, 2);
    this.barrel(530, 247, 10, 20, 3);
    // at the viewer's feet, big and in the near shade: boulders by the side building's wall, a fish crate and barrels by the shed
    this.boulder(214, 352, 30, 30, 5);
    this.boulder(262, 362, 18, 16, 6);
    this.crate(484, 356, 56, 40);
    this.barrel(566, 352, 20, 48, 5);
    this.barrel(604, 366, 17, 40, 6);
  }

  /** A string of pennants from the side building's corner to the boat shed's eave; bulbs between them, lit at dusk and night. */
  private stringOfLights(): void {
    const a: Pt = [150, 112], b: Pt = [598, 122];
    this.as(() => {
      const colours = [R.red[2]!, R.dry[3]!, R.tin[3]!, R.plaster[4]!];
      for (let k = 0; k <= 660; k++) {
        const t = k / 660;
        const x = a[0] + (b[0] - a[0]) * t, y = a[1] + (b[1] - a[1]) * t + 30 * Math.sin(Math.PI * t);
        this.put(...bend(x, y), R.boards[0]!);
        if (k % 33 === 16) {
          const c = colours[(k / 33) % colours.length | 0]!;
          this.poly([[x - 2.6, y + 1], [x + 2.6, y + 1], [x + 0.4 * (((k / 33) | 0) % 3 - 1), y + 7]], () => c, 0.2);
        } else if (k % 33 === 0 && k > 0 && k < 660) {
          this.put(...bend(x, y + 1), this.lit ? R.ember[5]! : R.shingle[3]!);
          this.put(...bend(x, y + 2), this.lit ? R.ember[4]! : R.shingle[2]!);
        }
      }
    });
  }

  private gulls(): void {
    // one on the barrels, one on the cinema's ridge: painted still; the flock that flies is the game's
    for (const [x, y] of [[536, 207], [206, 86]] as const) this.as(() => {
      this.oval(x, y, 4, 2.4, (px, py) => tone(F.plaster, py < bend(x, y)[1] ? 0.9 : 0.62, px, py));
      this.oval(x + 4, y - 3, 1.8, 1.8, () => R.plaster[4]!);
      this.put(...bend(x + 6, y - 3), R.dry[2]!);
      this.put(...bend(x - 4, y), R.stone[1]!);
    });
  }

  // ---- the whole

  private brush(put: KitBrush['put'], under?: KitBrush['under']): KitBrush {
    return { put, run: R, fine: F, hour: this.hour, side: this.hour.side, ...(under ? { under } : {}) };
  }

  private paint(): Bitmap {
    const bitmap = createBitmap(this.w, this.h);
    this.px = bitmap.pixels;
    this.owner = new Uint16Array(this.w * this.h);
    this.things = 0;
    this.paintSky();
    this.paintSea();
    this.farRocks();
    this.spit();
    this.pier();
    this.shore();
    this.far();
    this.ground();
    this.paths();
    this.browThings();
    this.cinema();
    this.plaza();
    this.flowerBed();
    this.props();
    this.sideBuilding();
    this.boatShed();
    this.stringOfLights();
    this.lanterns();
    this.gulls();
    grain(this.px, this.w, GRAIN_RUNS, { seed: 640, strength: 0.34 });
    this.outline();
    return bitmap;
  }

  frames(band: number): { frames: Bitmap[]; fore: Overlay } {
    return paintLooks(1, this.sky, Math.min(band, SQUARE.horizon + SQUARE.bow + 1), () => this.paint());
  }

  /** The lamps' light on what is round them, and the cinema door's on the stones before it: a layer for each flicker. */
  lamp(base: Bitmap): Overlay {
    const { w, h } = this;
    const owned = this.owner;
    return cropTogether(Array.from({ length: SQUARE_LAMP_LOOKS }, (_, look) => {
      const bitmap = createBitmap(w, h);
      const brush = this.brush(
        (x, y, c) => {
          const px = Math.round(x), py = Math.round(y);
          if (px >= 0 && py >= 0 && px < w && py < h) bitmap.pixels[py * w + px] = c;
        },
        (x, y) => {
          const px = Math.round(x), py = Math.round(y);
          if (px < 0 || py < 0 || px >= w || py >= h) return undefined;
          return { colour: base.pixels[py * w + px]!, thing: owned[py * w + px] !== 0 };
        },
      );
      if (!lampLit(brush)) {
        bitmap.pixels[0] = R.boards[0]!;
        return bitmap;
      }
      for (const [k, l] of LANTERNS.entries()) {
        const [x, y] = bend(l.x, l.y);
        lamp.paint(brush, Math.round(x), Math.round(y), optionsOf(lamp, 'no-water', { reach: l.reach + look * 3, lantern: false }), k);
      }
      // the doors' light spilling out over the stones
      this.pool(bitmap, base, 192, 171, 30 + look * 2, 6);
      return bitmap;
    }));
  }

  /**
   * A pool of warm light on the ground: laid only on tones already lit, in two flat steps with a ragged edge, seams
   * shade and what grows keeping the night's colour (the kit's lamp does the same round a lantern).
   */
  private pool(into: Bitmap, base: Bitmap, cx: number, cy: number, rx: number, ry: number): void {
    const { w, h } = this;
    const place = new Map<number, number>();
    for (const [name, run] of Object.entries(F)) if (!['sky', 'cloud', 'sea', 'ember', 'grass', 'red'].includes(name)) run.forEach((c, k) => place.set(c, k / (run.length - 1)));
    const [x0, y0] = bend(cx, cy);
    // the lightness of what lies under, evened over a few pixels, so the pool's steps are flat shapes and not specks
    const even = (x: number, y: number): number | undefined => {
      let sum = 0, n = 0;
      for (let d = -2; d <= 2; d++) {
        const l = place.get(base.pixels[y * w + Math.max(0, Math.min(w - 1, x + d))]!);
        if (l !== undefined) { sum += l; n++; }
      }
      return n ? sum / n : undefined;
    };
    for (let dy = -Math.ceil(ry); dy <= ry; dy++) for (let dx = -Math.ceil(rx); dx <= rx; dx++) {
      const x = Math.round(x0 + dx), y = Math.round(y0 + dy);
      if (x < 0 || y < 0 || x >= w || y >= h) continue;
      const far = Math.hypot(dx / rx, dy / ry) + 0.1 * noise2(x / 11, y / 4, 960);
      if (far >= 1) continue;
      const own = place.get(base.pixels[y * w + x]!), lightness = even(x, y);
      // seams, shade and the ink keep the night's colour
      if (own === undefined || lightness === undefined || own < 0.24 || lightness < 0.3) continue;
      // a pale heart, a warm body, and at the rim level dashes that thin out: no chessboard
      const dash = hash2(x >> 2, y, 961) < 1.6 - far * 1.7;
      if (far < 0.2) into.pixels[y * w + x] = R.ember[4]!;
      else if (far < 0.6 || dash) into.pixels[y * w + x] = own > 0.55 ? R.ember[3]! : R.ember[2]!;
    }
  }
}

/** Paints the village square as planned, for one hour of the sky. */
export function paintSquare(plan: SquarePlan, phase: SkyPhase): SquarePicture {
  const p = new SquarePainter(plan, phase);
  const clouds = SQUARE_CLOUDS.map(({ at, spec }) => ({ x: at[0], y: at[1], bitmap: p.cloud(spec) }));
  const { frames, fore } = p.frames(Math.max(...clouds.map((c) => c.y + c.bitmap.height)));
  return { palette: p.palette, frames, fore, clouds, lamp: p.lamp(frames[0]!), gull: p.gullTone() };
}
