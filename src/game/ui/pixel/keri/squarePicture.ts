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
 * boat, the shore, the cinema house, the plaza of flagstones in rings round its lamp, the lighthouse's side building as
 * the left wing and the old boat shed's corner as the right. The plaza and what stands on it (the flagstones, the lamp,
 * the benches, the barrels, the string of pennants) are the painter's props; the houses and the pier stand where the
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
const RINGS = [10, 19, 30, 43, 58, 76, 98, 124] as const;
const RX = 3.9, RY = 0.86;

/** The lanterns: the lamp's two arms, the side building's corner. Each by its hook (fine pixels, flat plan). */
const LANTERNS: readonly { x: number; y: number; reach: number }[] = [
  { x: 312, y: 70, reach: 40 },
  { x: 362, y: 64, reach: 40 },
  { x: 150, y: 124, reach: 30 },
];

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
        if (within([[640, 176], [596, 186], [404, 218], [214, 252], [640, 252]])) return 1;
        if (within([[334, 204], [338, 208], [236, 199], [232, 195]])) return 0.8;
        // the side building's eaves shade the foot of its wall
        return 0;
      case 'dawn':
        // the sun ahead over the sea: every shade comes toward the viewer
        if (within([[112, 164], [250, 160], [304, 204], [84, 218]])) return 1;
        if (within([[334, 208], [340, 208], [412, 248], [396, 248]])) return 0.8;
        if (within([[452, 204], [524, 204], [560, 236], [470, 236]])) return 0.7;
        return 0;
      case 'dusk':
        // the sun behind the viewer: the lighthouse's own long shadow lies across the square, its lantern at the far end
        if (within([[30, 248], [176, 248], [322, 190], [304, 186]])) return 1;
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
        if (hour.night) t += 0.3 * Math.exp(-(((x - MOON.x) / (26 + d)) ** 2)) * smooth(0, 6, d);
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
    for (const [x, y, r] of [[262, 100, 6], [300, 97, 4], [612, 100, 7], [442, 98, 3]] as const) this.as(() => {
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

  private pier(): void {
    const { hour } = this;
    this.as(() => {
      // the boat moored on its far side: a red hull, a white cabin, a mast and a pennant
      this.poly([[506, 110], [588, 104], [578, 128], [516, 130]], (x, y) => this.worn(F.red, hour.front * 0.7 + (y < 116 ? 0.16 : 0), x, y, 0.05));
      this.line([508, 112], [586, 106], R.red[4]!);
      this.poly([[528, 92], [560, 90], [560, 108], [528, 110]], (x, y) => tone(F.plaster, hour.front + (x < 534 ? -0.2 : 0.08), x, y));
      this.poly([[524, 92], [564, 88], [564, 84], [526, 87]], (x, y) => tone(F.tin, 0.42, x, y));
      this.poly([[534, 96], [544, 96], [544, 103], [534, 104]], () => (this.lit ? R.ember[4]! : R.tin[1]!));
      this.line([552, 90], [554, 52], R.wood[1]!, 2);
      this.poly([[555, 54], [572, 58], [555, 63]], () => R.red[2]!, 0.3);
    });
    this.as(() => {
      // the quay: its top a pale band of slabs, its face big blocks in the shade
      this.poly([[344, 156], [384, 166], [650, 118], [650, 104]], (x, y) => {
        const slab = Math.floor((x + (y - 100) * 2.2) / 22);
        const seam = Math.floor((x + (y - 100) * 2.2 + 1) / 22) !== slab;
        return seam ? tone(F.stone, 0.3, x, y) : this.worn(F.shingle, hour.ground + 0.08 + (hash2(slab, 3, 840) - 0.5) * 0.14, x, y, 0.05);
      });
      this.poly([[384, 166], [392, 176], [650, 130], [650, 118]], this.blocks(hour.north + 0.1, 6, 15, 1));
      // bollards along it, and the beacon at its head as the port has one
      for (const t of [0.12, 0.3, 0.48, 0.66, 0.84]) {
        const x = 384 + (640 - 384) * t, y = 164 + (118 - 164) * t - 1;
        this.poly([[x - 3, y], [x + 3, y], [x + 2, y - 7], [x - 2, y - 7]], (px) => tone(F.stone, px < bend(x, y)[0] ? 0.16 : 0.34, px, 0), 0.3);
      }
    });
  }

  private shore(): void {
    const { hour } = this;
    // the shingle beach below the square, curving round to the east point on the left
    this.poly([[224, 150], [256, 122], [320, 126], [344, 152], [392, 176], [650, 132], [650, 200], [0, 200], [0, 150]], (x, y) => {
      const pebble = hash2(x >> 1, y, 850);
      return tone(F.shingle, clamp01(hour.ground + 0.06 + (pebble > 0.86 ? 0.14 : pebble < 0.12 ? -0.2 : 0) - 0.1 * smooth(150, 196, y)), x, y);
    }, 1.6);
  }

  /** The small shed by the shore (`shore-shed`): plaster, a flat roof of boards. */
  private shoreShed(): void {
    const { hour } = this;
    this.as(() => {
      this.poly([[290, 130], [316, 131], [315, 152], [290, 151]], (x, y) => this.worn(F.plaster, hour.front + (x > 310 ? 0.14 : 0), x, y, 0.06));
      this.poly([[286, 126], [320, 128], [320, 132], [286, 131]], (x, y) => tone(F.boards, 0.36, x, y));
      this.poly([[298, 138], [306, 138], [306, 151], [298, 151]], () => R.boards[0]!, 0.3);
    });
  }

  // ---- the houses

  /** Lime plaster in a light: flat worn patches, damp and darker at its foot, and stone blocks where the plaster has fallen. */
  private plaster(light: number, foot: number, seed: number, fallen = 0.66): Tone {
    const stone = this.blocks(light - 0.12, 9, 21, seed);
    return (x, y) => {
      if (fbm(x / 31, y / 19, 3, 860 + seed) > fallen) return stone(x, y);
      const damp = 0.16 * smooth(foot - 26, foot, y + 6 * noise2(x / 9, 1, 861 + seed));
      return this.worn(F.plaster, light - damp, x, y, 0.07, seed);
    };
  }

  /** A blue tin roof: ribs down its slope every few pixels, a pale side and a dark side to each, rust in patches. */
  private tin(light: number, slope: number, seed: number): Tone {
    return (x, y) => {
      const along = x - y * slope;
      const rib = ((along % 9) + 9) % 9;
      if (fbm(x / 17, y / 9, 2, 870 + seed) > 0.7) return tone(F.wood, 0.4 + (rib < 2 ? 0.14 : 0), x, y);
      return this.worn(F.tin, light + (rib < 1.5 ? 0.2 : rib > 7 ? -0.18 : 0), x, y, 0.05, seed);
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
      this.poly([[104, 168], [250, 160], [256, 118], [104, 124]], this.plaster(hour.front, 164, 2, 0.72));
      // the gable end turned to the sea, in the other light
      this.poly([[232, 161], [250, 160], [256, 118], [236, 119]], this.plaster(hour.south - 0.06, 162, 3, 0.74));
    });
    this.as(() => {
      // a hip roof that sags along its ridge
      this.poly([[92, 128], [118, 92], [170, 96], [232, 88], [272, 120], [180, 124]], this.tin(hour.front * 0.5 + 0.22, 0.5, 2), 1.4);
      this.poly([[92, 128], [180, 124], [272, 120], [272, 124], [180, 129], [94, 133]], () => R.tin[0]!, 0.5);
      // the engine room's stovepipe, crooked
      this.line([138, 96], [134, 70], R.stone[1]!, 4);
      this.line([134, 70], [140, 62], R.stone[1]!, 4);
      this.line([136, 96], [132, 70], R.stone[3]!, 1);
    });
    this.as(() => {
      // the cinema's double doors under an awning with a row of bulbs, a poster (a picture, no words), a window
      this.poly([[174, 163], [206, 161], [206, 132], [174, 134]], (x, y) => (this.lit ? tone(F.ember, 0.72 + 0.2 * noise2(x / 5, y / 7, 890), x, y) : this.worn(F.wood, 0.34, x, y, 0.1)), 0.4);
      this.line([190, 133], [190, 162], this.lit ? R.ember[1]! : R.wood[0]!, 1);
      this.poly([[164, 134], [214, 131], [220, 121], [164, 124]], (x, y) => this.worn(F.red, 0.46 + (((x >> 2) & 1) ? 0.12 : 0), x, y, 0.05), 0.5);
      for (let x = 168; x < 216; x += 6) this.put(...bend(x, 133 - (x - 168) * 0.05), this.lit ? R.ember[5]! : R.dry[3]!);
      this.poly([[216, 136], [232, 135], [232, 157], [216, 158]], () => R.boards[1]!, 0.3);
      this.poly([[218, 138], [230, 137], [230, 155], [218, 156]], (x, y) => tone(F.red, 0.5, x, y), 0.2);
      this.oval(224, 149, 4, 3, () => R.tin[0]!);
      this.oval(227, 142, 1.6, 1.6, () => R.dry[3]!);
    });
    this.as(() => this.window([[146, 138], [160, 137], [160, 150], [146, 151]], this.lit));
    this.as(() => this.window([[118, 140], [130, 139], [130, 152], [118, 153]], false));
  }

  /** The lighthouse's side building (`building-2`): the left wing, its south wall running off east from beside the viewer. */
  private sideBuilding(): void {
    const { hour } = this;
    this.as(() => {
      this.poly([[-10, 262], [140, 186], [146, 104], [-10, -30]], this.plaster(hour.south, 250, 5, 0.6), 1.6);
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
      this.poly([[-20, -16], [160, 118], [154, 92], [-20, -60]], this.tin(hour.south * 0.5 + 0.2, -0.7, 5), 1.4);
      this.poly([[-20, -16], [160, 118], [160, 125], [-20, -8]], () => R.tin[0]!, 0.6);
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
      // a lantern's bracket on the corner
      this.line([146, 122], [152, 122], R.ink, 1);
    });
  }

  /** The lighthouse's own foot at the viewer's left hand: a low curve of big limestone blocks in the shade, dark and near. */
  private lighthouseFoot(): void {
    this.as(() => {
      this.poly([[-10, 262], [-10, 190], [30, 194], [76, 210], [112, 236], [122, 262]], this.blocks(0.12, 14, 30, 11), 1.2);
      this.poly([[-10, 190], [30, 194], [76, 210], [112, 236], [108, 243], [72, 217], [28, 201], [-10, 197]], (x, y) => tone(F.stone, 0.34, x, y), 0.8);
    });
  }

  /** The old boat shed's corner (`wood-shed`): the right wing, upright boards of every width, in the shade, a net and floats hung on it. */
  private boatShed(): void {
    const { hour } = this;
    this.as(() => {
      this.poly([[590, 262], [660, 262], [660, 30], [604, 58]], (x, y) => {
        const board = Math.floor((x + 3 * noise2(y / 50, 1, 910)) / 9), inBoard = x + 3 * noise2(y / 50, 1, 910) - board * 9;
        if (inBoard < 1.2) return R.boards[0]!;
        return this.worn(F.boards, hour.north + (hash2(board, 4, 911) - 0.5) * 0.14 + (inBoard < 2.6 ? 0.08 : 0), x, y, 0.07, 9);
      }, 1.2);
      // its corner post catches the light
      this.poly([[588, 262], [598, 262], [610, 58], [602, 58]], (x, y) => this.worn(F.boards, hour.north + 0.34, x, y, 0.06, 10), 0.8);
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
    this.poly([[-10, 262], [-10, 190], [120, 168], [250, 160], [344, 152], [396, 176], [650, 168], [650, 262]], (x, y) => {
      const sh = this.shade(x, y);
      const grassy = fbm(x / 37, y / 11, 3, 920) + 0.12 * smooth(200, 150, y);
      const light = hour.ground - sh * 0.46;
      if (grassy > 0.56) {
        const blade = hash2(x, y >> 1, 921);
        return blade > 0.8 ? tone(F.dry, clamp01(light - 0.1 + blade * 0.2), x, y) : tone(F.grass, clamp01(light - 0.34 + blade * 0.42), x, y);
      }
      return this.worn(F.earth, light + 0.12 + (hash2(x >> 1, y, 922) > 0.9 ? 0.2 : 0), x, y, 0.1);
    }, 1.8);
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
    const count = 5 + ring * 3;
    const turn = (a / (Math.PI * 2) + 1 + ring * 0.137) * count;
    const stone = Math.floor(turn), inStone = turn - stone;
    const arc = ((r * Math.PI * 2) / count) * (RX * Math.abs(Math.sin(a)) + RY * Math.abs(Math.cos(a)));
    const fat = y > 214 ? 1.5 : 1;
    const seam = (r - inner) * perUnit < 1.2 * fat || Math.min(inStone, 1 - inStone) * arc < fat;
    // a stone's far edge catches the light: the row or two just inside its seam on the side away from the viewer
    const top = dy < 0 ? (outer - r) * perUnit < 2.6 : (r - inner) * perUnit < 2.6;
    return { ring, stone: stone % count, seam, top };
  }

  private plaza(): void {
    const { hour } = this;
    this.as(() => {
      this.poly([[124, 194], [244, 170], [344, 158], [392, 178], [600, 186], [606, 262], [24, 262]], (x, y) => {
        const f = this.flag(x, y);
        const sh = this.shade(x, y);
        const light = hour.ground + 0.06 - sh * 0.6;
        if (!f) return this.worn(F.earth, light + 0.1, x, y, 0.1);
        if (f.seam) {
          // grass and moss in the joints, more of it toward the plaza's edge
          const green = hash2(x >> 1, y >> 1, 931) < 0.12 + f.ring * 0.05;
          return green ? tone(F.grass, clamp01(light - 0.2 + hash2(x, y, 932) * 0.3), x, y) : tone(F.plaster, clamp01(light * 0.4 - 0.2), x, y);
        }
        const own = (hash2(f.stone, f.ring, 933) - 0.5) * 0.3;
        // a broken or missing stone here and there shows the earth
        if (hash2(f.stone, f.ring, 934) > 0.93) return this.worn(F.earth, light + 0.04, x, y, 0.12);
        return this.worn(hash2(f.stone, f.ring, 935) > 0.62 ? F.shingle : F.plaster, light + own + (f.top ? 0.1 : 0), x, y, 0.05, f.ring);
      }, 2.2);
    });
    this.tufts();
  }

  /** Tufts in the joints and at the plaza's edge: growth of every height, most of it low (rule 23). */
  private tufts(): void {
    const { hour } = this;
    for (let k = 0; k < 150; k++) {
      const x = 20 + hash2(k, 1, 940) * 580, y = 172 + hash2(k, 2, 940) ** 0.7 * 74;
      const f = this.flag(x, y);
      if (f && !f.seam && f.ring < 6) continue;
      if (!F.shingle.includes(this.at(x, y)) && !F.earth.includes(this.at(x, y)) && !F.grass.includes(this.at(x, y)) && !F.stone.includes(this.at(x, y))) continue;
      const tall = 2 + Math.floor(hash2(k, 3, 940) ** 2 * (4 + (y - 170) * 0.09));
      const light = hour.ground - this.shade(x, y) * 0.36;
      for (let b = -1; b <= 1; b++) {
        const h = tall - Math.abs(b) - (hash2(k, b, 941) > 0.5 ? 1 : 0), run = hash2(k, b, 942) > 0.78 ? F.dry : F.grass;
        for (let i = 0; i < h; i++) this.put(x + b * 1.4 + (i * b) / 3 - i * 0.25, y - i, tone(run, clamp01(light - 0.3 + (i / Math.max(1, h)) * 0.42), 0, 0));
      }
    }
  }

  /** The lamp in the plaza's middle: a round stone step with a bench of boards round it, a crooked iron post, two arms. */
  private lampPost(): void {
    const { hour } = this;
    const { x, y } = SQUARE.lamp;
    this.as(() => {
      // the step's side, then its top
      this.oval(x, y + 8, 42, 13, (px, py) => this.blocks(hour.north + 0.08, 8, 13, 13)(px, py));
      this.oval(x, y, 42, 12, (px, py) => this.worn(F.plaster, hour.ground + 0.14 - this.shade(px, py) * 0.4 + (py < bend(x, y)[1] - 6 ? 0.06 : 0), px, py, 0.05, 14));
    });
    this.as(() => {
      // the bench: a ring of boards on the step
      this.oval(x, y - 3, 27, 7.5, (px, py) => this.worn(F.wood, 0.3, px, py, 0.08));
      this.oval(x, y - 6, 27, 7, (px, py) => {
        const a = Math.atan2((py - bend(x, y - 6)[1]) / 7, (px - bend(x, y - 6)[0]) / 27);
        return Math.abs(((a * 7) % 1) + 1) % 1 < 0.14 ? R.wood[1]! : this.worn(F.wood, hour.ground * 0.7 + 0.14, px, py, 0.08);
      });
      this.oval(x, y - 7, 13, 3.6, (px, py) => this.worn(F.shingle, hour.ground - 0.06, px, py, 0.05, 15));
    });
    this.as(() => {
      // the post, crooked, fatter at its foot, a collar halfway; the light side to the hour's sun
      const post: readonly Pt[] = [[x, y - 8], [x - 2, y - 52], [x, y - 100], [x + 3, y - 140]];
      for (let k = 0; k < post.length - 1; k++) this.line(post[k]!, post[k + 1]!, R.stone[0]!, k === 0 ? 8 : k === 1 ? 6 : 5);
      for (let k = 0; k < post.length - 1; k++) this.line([post[k]![0] + hour.side * 1.4, post[k]![1]], [post[k + 1]![0] + hour.side * 1.4, post[k + 1]![1]], R.stone[2]!, 1);
      this.oval(x - 2, y - 52, 6, 2.6, () => R.stone[1]!);
      this.oval(x, y - 100, 5, 2.2, () => R.stone[1]!);
      this.oval(x, y - 10, 9, 3.4, () => R.stone[1]!);
      // two arms in curls, one higher than the other
      const arm = (to: Pt, lift: number): void => {
        for (let t = 0; t <= 1; t += 0.02) {
          const ax = x + 3 + (to[0] - x - 3) * t, ay = y - 136 + (to[1] - (y - 136)) * t - lift * Math.sin(Math.PI * t);
          this.put(...bend(ax, ay), R.stone[0]!);
          this.put(...bend(ax, ay + 1), R.stone[0]!);
        }
      };
      arm([LANTERNS[0]!.x, LANTERNS[0]!.y], 9);
      arm([LANTERNS[1]!.x, LANTERNS[1]!.y], 12);
      this.oval(x + 3, y - 143, 3.4, 3.4, () => R.stone[1]!);
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
    // a coil of rope on the stones
    this.as(() => {
      this.oval(410, 232, 13, 4.5, (x, y) => tone(F.dry, 0.3 + 0.3 * noise2(x / 2, y, 950), x, y));
      this.oval(410, 230, 13, 4.5, (x, y) => tone(F.dry, 0.56 + 0.3 * (((x + y * 3) >> 1) % 2), x, y));
      this.oval(410, 230, 5, 1.6, () => R.earth[0]!);
    });
  }

  /** A string of pennants from the side building's corner to the boat shed's eave; bulbs between them, lit at dusk and night. */
  private stringOfLights(): void {
    const a: Pt = [150, 112], b: Pt = [592, 70];
    this.as(() => {
      const colours = [R.red[2]!, R.dry[3]!, R.tin[3]!, R.plaster[4]!];
      for (let k = 0; k <= 660; k++) {
        const t = k / 660;
        const x = a[0] + (b[0] - a[0]) * t, y = a[1] + (b[1] - a[1]) * t + 44 * Math.sin(Math.PI * t);
        this.put(...bend(x, y), R.ink);
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
    // one on the lamp's top, one on the cinema's ridge: painted still; the flock that flies is the game's
    for (const [x, y] of [[340, 57], [206, 86]] as const) this.as(() => {
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
    this.pier();
    this.shore();
    this.shoreShed();
    this.ground();
    this.cinema();
    this.plaza();
    this.lampPost();
    this.props();
    this.sideBuilding();
    this.lighthouseFoot();
    this.boatShed();
    this.stringOfLights();
    this.lanterns();
    this.gulls();
    grain(this.px, this.w, GRAIN_RUNS, { seed: 640, strength: 0.26 });
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
        bitmap.pixels[0] = R.ink;
        return bitmap;
      }
      for (const [k, l] of LANTERNS.entries()) {
        const [x, y] = bend(l.x, l.y);
        lamp.paint(brush, Math.round(x), Math.round(y), optionsOf(lamp, 'no-water', { reach: l.reach + look * 3, lantern: false }), k);
      }
      // the lamp's pool on the plaza under it, and the doors' light spilling out over the stones
      this.pool(bitmap, base, SQUARE.lamp.x, SQUARE.lamp.y + 8, 112 + look * 4, 27 + look);
      this.pool(bitmap, base, 192, 172, 42 + look * 2, 9);
      return bitmap;
    }));
  }

  /**
   * A pool of warm light on the ground: laid only on tones already lit, in two flat steps with a ragged edge, seams
   * and shade keeping the night's colour (the kit's lamp does the same round a lantern).
   */
  private pool(into: Bitmap, base: Bitmap, cx: number, cy: number, rx: number, ry: number): void {
    const { w, h } = this;
    const place = new Map<number, number>();
    for (const [name, run] of Object.entries(F)) if (!['sky', 'cloud', 'sea', 'ember'].includes(name)) run.forEach((c, k) => place.set(c, k / (run.length - 1)));
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
