import { BOULDER, DOCKS_ROCKS, JETTY, LAMP, LANDING, TOWER, TOWER_EAVES, TOWER_FLOOR, docksGround, docksHorizon, docksProject, docksShore, jettyAt, towerCorner, type DocksPlan, type DocksShore } from '../../../../core/layout/docks';
import type { SkyPhase } from '../../../../core/sky/skyPhase';
import type { World } from '../../../../core/world/world';
import { createBitmap, type Bitmap } from '../bitmap';
import { cropTogether, type Overlay } from '../pack';
import { clamp01, smoothstep as smooth } from '../paint/ease';
import { lean, paintLooks, SkyMask, swing, type WindWay } from '../paint/motion';
import { grain } from '../paint/grain';
import { LiveRecorder, type LiveWater } from '../paint/live';
import { moonlitFoot } from '../paint/moonlit';
import { fbm, hash2, noise2 } from '../paint/noise';
import { tintedCloud, type CurlSpec } from './curlCloud';
import { KERI_HOURS, scenePalette, tone, type Hour } from './keriPalette';
import { optionsOf, type KitBrush } from './kit/kit';
import { reflection, rings, sea, type SeaGround, type SeaOptions, type SeaStand } from './kit/water';
import { fillQuad, KIT_WOOD, planks, post, type Plank, type PostStep } from './kit/wood';
import { lamp, lampLit, lantern } from './kit/lights';
import { boulder, pebble } from './kit/stones';

/**
 * The picture of the docks (ft_1_19): the jetty on the north shore behind the warden's house, painted as pixel art as
 * the knoll is (d111), after the reference photographs of the place and pictures of the docks in the
 * 1991 game (in that game's manner, not today's fittings; that game's Scabb Island docks are the model). The jetty is
 * wood and rope: fat planks that sag, each with a pale top and a dark gap, legs that lean each its own way, a rope rail.
 * Laid on back to front: the bare sky (its clouds are their own pictures and drift over it), the sea with the bay's
 * shallows, the shingle, the boulders in the water, the boulder at the jetty's end with its landing, the jetty, and the
 * things near the viewer that close the corners (a heap of boulders on the left, a leaning mooring post on the right).
 * The hour changes the colours, not the drawing; only the moon, the stars, the glints and the lamp are drawn for an hour.
 */

/** The jetty's wood: the kit's warm wood after the Phatt dock (`kit/wood.ts`, the picked look). */
const WOOD = KIT_WOOD;

/** Keri's shared palette and the docks' own wood. */

const SHARED = scenePalette({ wood: WOOD }, ['grass', 'dry', 'far', 'shingle', 'stone', 'earth', 'bush', 'near', 'rose'], { sky: 3 });
const R = SHARED.run;
const F = SHARED.fine;
/** Where the night's moonlit plane begins, where it is full, and how far up its runs it lifts the ground (fine rows; the rows a conversation's board covers and a little over). */
const DOCKS_FOOT = { from: 236, full: 320, lift: 0.4 } as const;

/** The part of a whole run from one of its named tones to another. */
const part = (whole: readonly number[], from: number, to: number): readonly number[] => whole.slice(whole.indexOf(from), whole.indexOf(to) + 1);

const PEBBLE = part(F.shingle, R.shingle[0]!, R.shingle[3]!);
/**
 * The runs the grain of scanned paint goes over: all but the embers' (a light keeps its own colours), the clouds' and
 * the sky's (a sky is smooth, as on the harbour: a long run of small steps, one tone to a row, art-direction rule 12).
 */
const GRAIN_RUNS = Object.entries(F).filter(([name]) => !['ember', 'cloud', 'sky'].includes(name)).map(([name, run]) => (name === 'sea' ? { run, dash: 3 } : run));

export function docksPalette(phase: SkyPhase): readonly number[] {
  return SHARED.at(phase);
}

/** The docks' runs, for the art tools and the rules' test: Keri's shared runs and the wood. */
export const docksRuns = (): Readonly<Record<string, readonly number[]>> => SHARED.fine;

/** The looks of the sea, the surf and the grass in one gust's loop. */
export const DOCKS_FRAMES = 8;
/** The wind of Keri blows mostly from the west (docs/keri.md): looking north-north-east, that is to the viewer's right. */
export const DOCKS_WAY: WindWay = 1;
/** The lamp's flicker: how many looks its light has. */
export const LAMP_LOOKS = 3;

/** The moon's place in the night's sky. */
const MOON = { x: 452, y: 46, r: 8 } as const;

/**
 * Where the light is in this view (north-north-east) at each hour: the side it comes from (-1 left, 1 right), the column
 * where it lies on the water, and where a low sun warms the sky. By day the sun is behind the viewer; at dusk it sets
 * in the north-west, ahead and to the left; at dawn it rises in the north-east, to the right.
 */
const LIGHT: Record<SkyPhase, { side: number; glint: number; warm: number }> = {
  day: { side: -0.35, glint: 300, warm: 0 },
  dawn: { side: 1, glint: 560, warm: 1 },
  dusk: { side: -1, glint: 70, warm: -1 },
  night: { side: -0.5, glint: MOON.x, warm: 0 },
};

/**
 * The sky's clouds, back to front (d111): each one stroke that rolls up into a head leading the way the wind
 * blows (to the right), no two alike, the big fat ones behind the long thin ones, small flat ones low over the sea.
 * Each has its left edge and top in fine pixels; they drift over the bare sky in the game.
 */
export const DOCKS_CLOUDS: readonly { at: readonly [number, number]; spec: CurlSpec }[] = [
  // low over the sea, far off: flat streaks and a small curl
  { at: [36, 114], spec: { length: 70, girth: 5, belly: 0.45, neck: 1, taper: 0.55, bend: 1, wave: 1.1, phase: 0.3 } },
  { at: [300, 117], spec: { length: 48, girth: 4, belly: 0.55, neck: 1, taper: 0.6, bend: 1, wave: 0.9, phase: 1.3 } },
  { at: [470, 110], spec: { length: 62, girth: 7, belly: 0.75, neck: 1, taper: 0.7, bend: 2, wave: 0.8, phase: 0.6, head: { size: 7, turns: 1.1 } } },
  // the big fat one behind, over the jetty's end, and a smaller one on the right; one head each (rule 13)
  { at: [190, 30], spec: { length: 112, girth: 40, belly: 0.82, neck: 0.9, taper: 1.15, bend: 11, wave: 0.7, phase: 0.1, rise: 10, head: { size: 27, turns: 1.2 } } },
  { at: [500, 62], spec: { length: 74, girth: 20, belly: 0.7, neck: 0.85, taper: 1.2, bend: 4, wave: 1, phase: 0.8, head: { size: 15, turns: 1.15 } } },
  // the long thin ones, in front of them
  { at: [40, 16], spec: { length: 138, girth: 13, belly: 0.62, neck: 0.85, taper: 0.75, bend: 8, wave: 1.4, phase: 1.0, head: { size: 19, turns: 1.3 } } },
  { at: [356, 80], spec: { length: 160, girth: 11, belly: 0.75, neck: 0.95, taper: 0.9, bend: 6, wave: 1.2, phase: 0.45, head: { size: 12, turns: 1.25, down: true } } },
];

export interface DocksCloud {
  x: number;
  y: number;
  bitmap: Bitmap;
}

export interface DocksPicture {
  palette: readonly number[];
  /** The whole picture in each look of the sea and the grass (`DOCKS_FRAMES`), the sky bare: the clouds drift over it. */
  frames: Bitmap[];
  /** In each look, what stands before the sky where the clouds go (the lamp post, the mooring post). */
  fore: Overlay;
  /** The clouds, back to front (`DOCKS_CLOUDS`). */
  clouds: DocksCloud[];
  /** The lamp's light at the jetty's end, a frame for each flicker (`LAMP_LOOKS`); empty frames by day. */
  lamp: Overlay;
  /** What moves on the water (its strokes, the bands round the legs, the glints, the surf), lit as the game runs (`paint/live.ts`). */
  water: LiveWater;
  /** The gulls' colour, a place of the palette (`flock.ts`); the game flies them by day. */
  gull: number;
}

/** The side of the walk its rope rail runs on: its left, the outer side round the boulder. */
const RAIL_SIDE = -1;

/** A point on the viewer's plan, metres: `x` right, `y` up from the sea, `z` ahead. */
type P3 = readonly [number, number, number];

/** A leg's thickness, metres: thick posts, after the Phatt dock (`wood.md` rule 5). */
const LEG = 0.19;
/** A plank's width along the walk, metres: broad and few (`wood.md` rule 2). */
const PLANK = 0.42;


class DocksPainter {
  readonly palette: readonly number[];
  readonly sky: SkyMask;
  private readonly hour: Hour & (typeof LIGHT)[SkyPhase];
  private readonly w: number;
  private readonly h: number;
  private readonly hz: number;
  private readonly shore: DocksShore[];
  private px: Uint8Array = new Uint8Array(0);
  /** Which thing painted each pixel (0 the sky, the sea and the shingle; then each thing in the order it was painted): the ink outlines go where things meet. */
  private owner: Uint16Array = new Uint16Array(0);
  private thing = 0;
  private things = 0;
  private stands: readonly SeaStand[] | undefined;
  /** The shingle's ground laid in bands and pockets (the wet strip, the shaded near ground) and its colour: the grain leaves it as laid, or it reads as static. */
  private calm = new Map<number, number>();
  /** What moves on the water, recorded in the first look (`paint/live.ts`). */
  private readonly live: LiveRecorder;
  water: LiveWater | null = null;

  /** The gulls' colour (`flock.ts` flies them in the game): pale against the sky, warm in the low sun where the sky is warm. */
  gullTone(): number {
    return this.hour.warm !== 0 ? R.cloud[3]! : R.stone[1]!;
  }
  /** The darkest tone of the run each colour belongs to: a thing's outline is drawn in it. */
  private readonly darkest = new Map<number, number>();
  /** The second lightest tone of the run each colour belongs to: at night a thing's moonlit top edge takes it. */
  private readonly lit = new Map<number, number>();

  constructor(world: World, private readonly plan: DocksPlan, phase: SkyPhase) {
    this.w = plan.fine.w;
    this.h = plan.fine.h;
    this.hz = plan.horizon;
    this.hour = { ...KERI_HOURS[phase], ...LIGHT[phase] };
    this.palette = docksPalette(phase);
    this.shore = docksShore(world);
    this.sky = new SkyMask(this.w, this.h);
    this.live = new LiveRecorder(this.w, this.h, () => this.px, this.hz, DOCKS_WAY, R.foam);
    for (const run of Object.values(F)) for (const c of run) if (!this.darkest.has(c)) {
      this.darkest.set(c, run[0]!);
      this.lit.set(c, run[Math.max(0, run.length - 2)]!);
    }
  }

  /** Paints one thing: what it paints is its own, so its outline can be found. */
  private as(draw: () => void): void {
    const was = this.thing;
    this.thing = ++this.things;
    draw();
    this.thing = was;
  }

  /**
   * The ink line of the 1991 game: wherever a thing lies over what was painted before it (another thing, the sea, the
   * shingle), its edge pixel takes the darkest tone of its own colour; a line one pixel thin keeps its colour.
   */
  private outline(): void {
    const { w, h, px, owner } = this;
    const edge: number[] = [], rim: number[] = [];
    // at night the moon (high on the right) catches the top and right edges of things, as on the 1991 game's night shores
    const moonlit = this.hour.night;
    for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) {
      const i = y * w + x, a = owner[i]!;
      if (a === 0) continue;
      for (const [d, o] of [[-w, w], [1, -1], [-1, 1], [w, -w]] as const) {
        const b = owner[i + d]!;
        if (b < a && owner[i + o] === a) { (moonlit && (d === -w || d === 1) ? rim : edge).push(i); break; }
      }
    }
    for (const i of edge) px[i] = this.darkest.get(px[i]!) ?? px[i]!;
    for (const i of rim) px[i] = this.lit.get(px[i]!) ?? px[i]!;
  }

  private put(x: number, y: number, c: number): void {
    x = Math.round(x); y = Math.round(y);
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return;
    this.px[y * this.w + x] = c;
    this.owner[y * this.w + x] = this.thing;
    this.sky.put(y * this.w + x);
  }

  /** How far ahead the water's edge is in a column (metres). */
  private edge(x: number): number {
    return this.shore[Math.max(0, Math.min(this.w - 1, Math.round(x)))]!.far;
  }

  /** Whether the floor at a pixel is water (true), shingle (false), or above the horizon (null). */
  private wet(x: number, y: number): boolean | null {
    const g = docksGround(x, y);
    return g ? g.z > this.edge(x) : null;
  }

  cloud(spec: CurlSpec): Bitmap {
    return tintedCloud(spec, false, R.cloud);
  }

  // ---- the sky

  private paintSky(): void {
    const { w, hz, hour } = this;
    this.sky.sky = true;
    // down to the horizon (straight; `docksHorizon` still follows `DOCKS.bow`)
    for (let x = 0; x < w; x++) for (let y = 0, end = Math.round(docksHorizon(x)); y <= end; y++) {
      let t = Math.min(1, Math.pow(y / hz, 0.85));
      if (hour.warm !== 0) t += 0.3 * clamp01(hour.warm > 0 ? (x - w * 0.3) / (w * 0.7) : (w * 0.7 - x) / (w * 0.7)) * (y / hz) ** 2 - 0.12;
      this.put(x, y, tone(F.sky, clamp01(t), x, y));
    }
    if (hour.night) this.stars();
    this.sky.sky = false;
    // the haze over the far water
    for (let x = 0; x < w; x++) this.put(x, Math.round(docksHorizon(x)) - 1, R.sky[4]!);
  }

  private stars(): void {
    const { w, hz } = this;
    for (let gy = 0; gy < hz - 8; gy += 8) for (let gx = 0; gx < w; gx += 9) {
      const pick = hash2(gx, gy, 21);
      if (pick > 0.42) continue;
      const x = gx + Math.floor(hash2(gx, gy, 22) * 9), y = gy + Math.floor(hash2(gx, gy, 23) * 8);
      this.put(x, y, pick < 0.14 ? R.star[0]! : R.star[1]!);
      if (pick < 0.035) for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) this.put(x + dx, y + dy, R.star[1]!);
    }
    for (let dy = -MOON.r - 9; dy <= MOON.r + 9; dy++) for (let dx = -MOON.r - 9; dx <= MOON.r + 9; dx++) {
      const far = Math.hypot(dx, dy), x = MOON.x + dx, y = MOON.y + dy;
      if (far <= MOON.r) this.put(x, y, Math.hypot(dx - 3, dy + 3) < MOON.r * 0.55 || hash2(x >> 1, y >> 1, 24) > 0.86 ? R.moon[1]! : R.moon[0]!);
      // its halo: one flat ring of the sky's palest tone, ragged at its outer edge, no ordered dither
      else if (far < MOON.r + 3.5 + 1.5 * hash2(Math.round(Math.atan2(dy, dx) * 6), 1, 25)) this.put(x, y, R.sky[4]!);
    }
  }

  // ---- the sea and the shingle

  /** Puts a pixel of the shingle's calm ground (`calm`). */
  private lay(x: number, y: number, c: number): void {
    this.put(x, y, c);
    this.calm.set(y * this.w + x, c);
  }

  private paintFloor(look: number): void {
    const { w, h, hz } = this;
    this.calm.clear();
    for (let y = hz; y < h; y++) for (let x = 0; x < w; x++) {
      const g = docksGround(x, y);
      // the haze along the horizon, where the sky's last row and the sea's first do not quite meet
      if (!g) { if (y > Math.round(docksHorizon(x))) this.put(x, y, R.sky[4]!); continue; }
      const far = this.edge(x);
      if (g.z > far) continue;
      const inland = far - g.z;
      // the wet strip at the water's edge: two tones in short level dashes, never a speckle
      if (inland < 0.9) this.lay(x, y, hash2((x + 3 * (y & 3)) >> 2, y, 205) > 0.5 ? R.shingle[0]! : R.stone[1]!);
      else if (inland > 1.3 && inland < 2.0 + 0.5 * noise2(g.x / 2, 1, 206) && fbm(g.x * 1.6, g.z * 3, 2, 207) > 0.56 && hash2((x + 3 * (y & 3)) >> 2, y, 211) > 0.3) {
        // the wrack line: dried seaweed the sea left along the shingle
        this.lay(x, y, hash2((x + (y & 3)) >> 2, y, 208) > 0.6 ? R.earth[0]! : hash2((x + 2 * (y & 1)) >> 2, y, 209) > 0.5 ? R.earth[1]! : R.bush[0]!);
      } else {
        const band = fbm(g.x / 5, g.z / 1.2, 2, 210);
        // the near shingle lies in the shade of the viewer's side: a dark foreground band, as MI2's rooms have
        // the dark between its stones lies in small pockets, never a speckle of lone dots (stones.md point 9: no static)
        const shade = this.foreground(x, y);
        if (shade > 0.5) this.lay(x, y, fbm(x / 7, y / 2.2, 2, 212) > 0.58 ? R.near[1]! : tone(F.stone, 0.12 * band, x, y, 0));
        else this.put(x, y, tone(PEBBLE, 0.12 + 0.55 * smooth(0.18, 0.82, band), x, y, 0));
      }
    }
    // the sea, its far band, body and shallows and its wave strokes (`water/sea` of the kit, after the Phatt dock)
    sea.paint(this.brush(look), this.seaGround(), this.seaOptions(), 0);
  }

  /**
   * What stands in the water as the picture shows it, each with the column and row of its foot and its half width in
   * fine pixels: the jetty's and the landing's legs (which cast reflections) and the boulders.
   */
  private standing(): readonly SeaStand[] {
    if (this.stands) return this.stands;
    const out: SeaStand[] = [];
    const add = (x: number, z: number, half: number, leg: boolean) => {
      const p = docksProject(x, 0, z);
      if (z > this.edge(p.x) + 0.2 && p.x > -40 && p.x < this.w + 40) out.push({ x: p.x, y: p.y, r: Math.max(leg ? 1 : 2, (470 * half) / z), leg });
    };
    for (let s = 1.1; s < JETTY.long - 0.5; s += JETTY.legs) for (const side of [-1, 1]) {
      const [x, , z] = this.along(s, side * 1.06, 0);
      add(x, z, LEG / 2, true);
    }
    for (let x = LANDING.x0 + 0.3; x < LANDING.x1; x += 2.4) add(x, LANDING.z0 + 0.15, LEG / 2, true);
    for (const r of DOCKS_ROCKS) add(r.x, r.z, r.r, false);
    add(BOULDER.x, BOULDER.z - BOULDER.r * 0.5, BOULDER.r, false);
    return (this.stands = out);
  }

  /** The sea's ground for the kit's water (`kit/water.ts`): where the water is, how far out, the light on it, what stands in it. */
  private seaGround(): SeaGround {
    const { w, h, hz } = this;
    return {
      width: w,
      height: h,
      horizon: hz,
      glint: this.hour.glint,
      stands: this.standing(),
      place: (x, y) => {
        const g = docksGround(x, y);
        const far = g ? this.edge(x) : 0;
        return g && g.z > far ? { shore: g.z - far, gx: g.x, gz: g.z } : null;
      },
      // at night a broad plane of the bay catches the moon, in two flat bands with ragged edges along the swell, as the
      // 1991 nights light one big plane pale; the rest of the sea stays deep
      moon: (x, y) => {
        const depth = y - hz, wobble = 10 * (fbm(x / 30, depth / 5, 2, 215) - 0.5);
        return smooth(w * 0.5, w * 0.3, x + wobble * 2) * smooth(10, 22, depth + wobble) * smooth(92, 70, depth + wobble);
      },
    };
  }

  private seaOptions(): SeaOptions {
    return optionsOf(sea, undefined, { band: 33, way: DOCKS_WAY });
  }

  /** The pale bands round the legs and boulders (`water/rings`) and the dark reflections under the legs (`water/reflection`). */
  private seaBands(look: number): void {
    const brush = this.brush(look);
    rings.paint(brush, this.seaGround(), this.seaOptions(), 0);
    for (const o of this.standing()) if (o.leg) reflection.paint(brush, o.x, o.y, optionsOf(reflection, undefined, { r: o.r, way: DOCKS_WAY }), Math.round(o.x * 7 + o.y * 3));
  }

  /** Glints where the light lies on the water, and the surf along the shingle: recorded for live water (`paint/live.ts`), lit as the game runs. */
  private seaLights(): void {
    const { w, hz, hour } = this;
    for (let gy = hz + 2; gy < hz + 50; gy++) for (let gx = Math.max(0, hour.glint - 120); gx < Math.min(w, hour.glint + 120); gx++) {
      if (this.wet(gx, gy) !== true) continue;
      const near = Math.exp(-(((gx - hour.glint) / (14 + (gy - hz) * 1.5)) ** 2));
      // each glint flashes on its own beat as the game runs (`paint/live.ts`)
      if (hash2(gx, gy, 57) > 1 - 0.22 * near) {
        const glint = hour.night ? R.moon[0]! : hour.warm !== 0 ? R.cloud[0]! : R.foam, beat = hash2(gx, gy, 63);
        this.live.glint(gx, gy, glint, beat);
        if (hash2(gx, gy, 58) > 0.5) this.live.glint(gx + 1, gy, glint, beat);
      }
    }
    // a boat far out (the reference aerial photograph has one coming in)
    for (let k = 0; k < 5; k++) this.put(496 + k, hz + 4, R.shingle[3]!);
    for (let k = 0; k < 2; k++) this.put(498 + k, hz + 3, R.stone[1]!);
    for (let k = 0; k < 7; k++) this.live.glint(488 + k - (k >> 1), hz + 5, R.foam, hash2(k, 0, 64));
    // the surf: a white line at the water's edge and a broken one further out, coming and going as the game runs
    for (let x = 0; x < w; x++) {
      const edge = Math.round(this.shore[x]!.water);
      if (edge < this.h + 2) this.live.surf(x, edge);
    }
  }

  /** Pebbles on the shingle, far to near: each a lump of a few flat tones, light on top and dark under, bigger near the viewer. */
  /** How far a pixel lies in the dark band along the foot of the picture (0 out of it, 1 in it): its edge wanders. */
  private foreground(x: number, y: number): number {
    const edge = this.h * 0.8 + 7 * (fbm(x / 40, 1, 2, 213) - 0.5) - 40 * (Math.abs(x - this.w * 0.55) / (this.w * 0.55)) ** 2;
    return y > edge ? 1 : 0;
  }

  private pebbles(): void {
    const brush = this.brush(0);
    const stones: { x: number; z: number; r: number; seed: number }[] = [];
    for (let gz = 1.6; gz < 40; gz += 0.5) for (let gx = -14; gx < 30; gx += 0.5) {
      const pick = hash2(Math.round(gx * 10), Math.round(gz * 10), 220);
      if (pick < 0.5) continue;
      const x = gx + hash2(Math.round(gx * 10), Math.round(gz * 10), 221) * 0.5, z = gz + hash2(Math.round(gx * 10), Math.round(gz * 10), 222) * 0.5;
      const p = docksProject(x, 0, z);
      if (p.x < -8 || p.x > this.w + 8 || z > this.edge(p.x) - 0.3) continue;
      // mostly pebbles, now and then a cobble
      const r = (0.09 + 0.17 * hash2(Math.round(gx * 10), Math.round(gz * 10), 223) ** 2) * (pick > 0.95 ? 2.2 : 1);
      stones.push({ x, z, r, seed: pick });
    }
    stones.sort((a, b) => b.z - a.z);
    for (const s of stones) {
      const p = docksProject(s.x, 0, s.z);
      const rx = (470 * s.r) / s.z;
      if (rx < 0.8) continue;
      // in the near shade, fewer and bigger: a pebble of a pixel or two there reads as static (stones.md point 9)
      const shaded = this.foreground(p.x, p.y) > 0.5;
      if (shaded && rx < 3) continue;
      const kind = hash2(Math.round(s.seed * 1e4), 1, 224);
      const tones = shaded ? 'dark' : kind > 0.86 ? 'brown' : kind > 0.62 ? 'stone' : 'shingle';
      // the kit's pebble (`kit/stones.ts`) stands on its foot: its middle sits 0.3 of its width over the floor's row
      pebble.paint(brush, p.x, p.y - rx * 0.3 + rx * pebble.options.flat, optionsOf(pebble, undefined, { r: rx, tones }), Math.round(s.seed * 1e4));
    }
  }

  /**
   * The brush the kit's things paint through (`kit/kit.ts`): this painter's pixels with their owner and the sky's mask,
   * the docks' palette and hour, and the loop of `look` for what moves.
   */
  private brush(look: number): KitBrush {
    return {
      put: (x, y, c) => this.put(x, y, c), run: R, fine: F, hour: this.hour, side: this.hour.side,
      sway: (phase) => swing(look, DOCKS_FRAMES, phase), beat: look / DOCKS_FRAMES, live: this.live,
      // only the open water is bare: the sea's own strokes and bands, never the shingle or a thing
      under: (x, y) => {
        const px = Math.round(x), py = Math.round(y);
        if (px < 0 || py < 0 || px >= this.w || py >= this.h) return undefined;
        const i = py * this.w + px;
        return { colour: this.px[i]!, thing: this.owner[i] !== 0 || this.wet(px, py) !== true };
      },
    };
  }

  /** A boulder of the kit (`stones/boulder`): `foot` the row of its foot, `wide` its half width and `high` its height in fine pixels. */
  private boulder(cx: number, foot: number, wide: number, high: number, seed: number, look: number, wet = true, dark = 0): void {
    boulder.paint(this.brush(look), cx, foot, optionsOf(boulder, undefined, { wide, high, wet, dark }), seed);
  }

  /** A boulder of the plan (metres) in the water. */
  private rock(x: number, z: number, r: number, look: number, high = r * 0.75): void {
    const p = docksProject(x, 0, z), top = docksProject(x, high, z);
    const wide = (470 * r) / z;
    this.boulder(p.x, Math.round(p.y), wide, Math.max(2, p.y - top.y), Math.round(x * 13 + z * 7), look);
  }

  // ---- the jetty

  /** A quad of the plan filled with a colour for each pixel. */
  private quad(pts: readonly P3[], colour: (x: number, y: number) => number): void {
    fillQuad((x, y, c) => this.put(x, y, c), pts.map(([X, Y, Z]) => docksProject(X, Y, Z)), this.w, this.h, colour);
  }

  /**
   * A point of the jetty `s` metres along its way from its root, `side` half widths to its right (on the curve round the
   * boulder, its right is the outer side), `y` metres over the sea: it sways a little and sags between legs.
   */
  private along(s: number, side: number, y: number): P3 {
    const p = jettyAt(s);
    const sway = 0.2 * Math.sin(s / 6.5) + 0.06 * Math.sin(s / 2.1 + 1);
    const across = side * (JETTY.wide / 2) + sway;
    const sag = -0.07 * Math.sin((Math.PI * s) / JETTY.legs) ** 2 + 0.05 * Math.sin(s / 5 + 0.7);
    return [p.x + p.uz * across, y + sag, p.z - p.ux * across];
  }

  /**
   * A leg or a post (the kit's `wood/post`, after the Phatt dock): a thick crooked pole from `y0` up to `y1` metres at
   * (`x`, `z`), leaning its own way, seen through the docks' lens; its cut top shows when it ends over the deck. In the
   * water only what stands above it is drawn and the water laps round its foot.
   */
  private leg(x: number, z: number, y0: number, y1: number, thick: number, seed: number, look: number, wetFoot: boolean): void {
    const lx = (hash2(seed, 1, 240) - 0.5) * 0.8, lz = (hash2(seed, 2, 241) - 0.5) * 0.35, bend = (hash2(seed, 3, 242) - 0.5) * 0.28;
    const n = 60, steps: PostStep[] = [];
    let top = { x: 0, y: 0, wide: 0 };
    for (let k = 0; k < n; k++) {
      const t = k / n, t2 = (k + 1) / n;
      const Y = y0 + (y1 - y0) * t;
      const a = docksProject(x + lx * t + bend * Math.sin(t * Math.PI), Y, z + lz * t);
      const b = docksProject(x + lx * t2 + bend * Math.sin(t2 * Math.PI), y0 + (y1 - y0) * t2, z + lz * t2);
      const wide = Math.max(1, (470 * thick * (1 - 0.15 * t)) / a.far);
      top = { x: b.x, y: b.y, wide };
      steps.push({ x: a.x, top: Math.min(a.y, b.y), bottom: Math.max(a.y, b.y), wide, up: Y });
    }
    const foot = docksProject(x, 0, z);
    post.paint(this.brush(look), foot.x, foot.y, optionsOf(post, undefined, { thick: (470 * thick) / foot.far, cap: y1 > JETTY.deck - 0.05, water: wetFoot, spine: { steps, top } }), seed);
  }

  /** A rope that sags between two points of the plan, in the dry stalk's colours. */
  private rope(a: P3, b: P3, sag: number): void {
    for (let k = 0; k <= 90; k++) {
      const t = k / 90;
      const q = docksProject(a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t - sag * 4 * t * (1 - t), a[2] + (b[2] - a[2]) * t);
      this.put(q.x, q.y, k % 7 < 2 ? R.dry[0]! : R.earth[1]!);
    }
  }

  /** Whether a thing `far` metres ahead is behind the big boulder (painted before it) or before it. */
  private static behind(far: number): boolean {
    return far > BOULDER.z;
  }

  /**
   * The jetty: its legs, the beams under the deck, the fat planks, the rope rail on its outer side, and what stands on
   * it; everything painted far to near, `behind` the part behind the big boulder (painted before it) or the rest.
   */
  private jetty(look: number, behind: boolean): void {
    const long = JETTY.long;
    const parts: { far: number; draw: () => void }[] = [];
    // the planks (the kit's `wood/planks`, after the Phatt dock): broad and few, ragged ends sticking out by different
    // amounts, a little askew; now and then one missing; each painted by the kit in its turn among the legs
    for (let s = 0, i = 0; s < long; s += PLANK, i++) {
      if (i === 26 || i === 61) continue;
      const seed = i * 17 + 3;
      const out = hash2(seed, 6, 259);
      const left = -1.1 + (hash2(seed, 1, 250) - 0.5) * 0.3 - (out < 0.14 ? 0.28 : 0), right = 1.1 + (hash2(seed, 2, 251) - 0.5) * 0.3 + (out > 0.86 ? 0.28 : 0);
      const skew = (hash2(seed, 3, 252) - 0.5) * 0.2, lift = (hash2(seed, 4, 253) - 0.5) * 0.1;
      const d = JETTY.deck + lift;
      // far off, where a gap would be thinner than a pixel, the planks close up
      const len = this.along(s, 0, d)[2] > 12 ? PLANK : PLANK - 0.05;
      const corners: P3[] = [this.along(s + skew, left, d), this.along(s + len - skew, left, d), this.along(s + len + skew, right, d), this.along(s - skew, right, d)];
      const mid = this.along(s, 0, d);
      const at = (q: P3): { x: number; y: number } => docksProject(...q);
      const plank: Plank = {
        i,
        corners: [at(corners[0]!), at(corners[1]!), at(corners[2]!), at(corners[3]!)],
        ends: [at(this.along(s, left, d)).x, at(this.along(s, right, d)).x],
        edge: [at(corners[1]!), at(corners[2]!)],
        tall: Math.abs(at(this.along(s, 0, d)).y - at(this.along(s + len, 0, d)).y),
        // under the deck: near-black beams on both sides
        beams: [-1, 1].map((k) => [at(this.along(s, k, JETTY.deck - 0.02)), at(this.along(s + PLANK, k, JETTY.deck - 0.02)), at(this.along(s + PLANK, k, JETTY.deck - 0.38)), at(this.along(s, k, JETTY.deck - 0.38))] as const),
        // the near-black gap between it and the next plank in, laid under the plank and a little toward the viewer
        // (the nearer plank, painted after it, covers the rest), so no shingle shows through
        gap: [at(this.along(s - 0.22, Math.min(left, -1.1), d - 0.03)), at(this.along(s + len, Math.min(left, -1.1), d - 0.03)), at(this.along(s + len, Math.max(right, 1.1), d - 0.03)), at(this.along(s - 0.22, Math.max(right, 1.1), d - 0.03))],
        // nails at both ends when the plank is near enough to show them
        nails: mid[2] < 14 ? [left + 0.18, right - 0.18].map((u) => at(this.along(s + len * 0.45, u, d))) : [],
      };
      parts.push({ far: mid[2], draw: () => planks.paint(this.brush(look), { width: this.w, height: this.h, planks: [plank] }, planks.options, 0) });
    }
    // the legs in pairs, the outer one carrying the rope rail
    const posts: P3[] = [];
    for (let s = 1.1, i = 0; s < long - 0.5; s += JETTY.legs, i++) for (const side of [-1, 1]) {
      const [x, , z] = this.along(s, side * 1.06, 0);
      const wetFoot = z > this.edge(docksProject(x, 0, z).x);
      // the rail runs on the walk's left, the outer side where it goes round the boulder, away from the rock
      const railed = side === RAIL_SIDE;
      if (railed) posts.push(this.along(s, RAIL_SIDE * 1.06, JETTY.deck + JETTY.rail - 0.06));
      parts.push({ far: z + 0.01, draw: () => this.leg(x, z, -0.4, JETTY.deck + (railed ? JETTY.rail + 0.1 * hash2(i, 1, 256) : 0.08 + 0.32 * hash2(i, side, 257) ** 2), LEG, i * 7 + side + 11, look, wetFoot) });
    }
    // the rope rail, post to post, lashed at each post
    for (let k = 0; k + 1 < posts.length; k++) {
      const a = posts[k]!, b = posts[k + 1]!;
      parts.push({ far: Math.min(a[2], b[2]) - 0.02, draw: () => {
        this.rope(a, b, 0.2);
        const knot = docksProject(...a);
        for (let q = -1; q <= 1; q++) this.put(knot.x + q, knot.y + q, R.dry[1]!);
      } });
    }
    // what stands on it, after the 1991 game's docks: a barrel and a crate near the root, the platform at its end
    const barrel = this.along(9.4, 0.45, JETTY.deck), crate = this.along(7.2, 0.3, JETTY.deck);
    parts.push({ far: barrel[2] - 0.3, draw: () => this.as(() => this.barrel(barrel, 0.3, 0.82, 401)) });
    parts.push({ far: crate[2] - 0.3, draw: () => this.as(() => this.crate(crate, 0.32, 404)) });
    parts.push({ far: LANDING.z0, draw: () => this.as(() => this.landing(look)) });
    parts.filter((p) => DocksPainter.behind(p.far) === behind).sort((p, q) => q.far - p.far).forEach((p) => p.draw());
  }

  /** A barrel standing at a point of the plan: bulging staves lit on the light's side, two iron hoops, its lid seen from above. */
  private barrel(at: P3, r: number, high: number, seed: number): void {
    const [x, y, z] = at;
    const foot = docksProject(x, y, z), top = docksProject(x, y + high, z);
    const half0 = (470 * r) / z, side = this.hour.side;
    const lid = Math.max(1.5, half0 * 0.32);
    for (let py = Math.round(top.y); py <= Math.round(foot.y); py++) {
      const h = (foot.y - py) / Math.max(1, foot.y - top.y);
      const half = half0 * (1 + 0.12 * Math.sin(Math.PI * h));
      const hoop = Math.abs(h - 0.18) < 0.05 || Math.abs(h - 0.82) < 0.05;
      for (let px = Math.floor(foot.x - half); px <= Math.ceil(foot.x + half); px++) {
        const u = (px - foot.x) / half;
        if (Math.abs(u) > 1) continue;
        const t = 0.5 - u * side * 0.55 - Math.abs(u) ** 3 * 0.35 + (hash2(Math.round(u * 5), seed, 410) - 0.5) * 0.15;
        let c = hoop ? (t > 0.55 ? R.stone[2]! : R.stone[1]!) : tone(F.wood, clamp01(Math.round(clamp01(t) * 4) / 4), px, py, 0);
        if (!hoop && Math.round(u * 5) !== Math.round(((px + 1 - foot.x) / half) * 5)) c = R.wood[1]!;
        if (Math.abs(u) > 0.93) c = R.wood[0]!;
        this.put(px, py + lid * Math.sqrt(Math.max(0, 1 - u * u)), c);
      }
    }
    // the lid: an ellipse of boards with a dark rim
    for (let dy = -lid; dy <= lid; dy++) for (let dx = -half0; dx <= half0; dx++) {
      const e = (dx / half0) ** 2 + (dy / lid) ** 2;
      if (e > 1) continue;
      this.put(top.x + dx, top.y + dy, e > 0.7 ? R.wood[1]! : Math.round(dx) % 4 === 0 ? R.wood[2]! : R.wood[4]!);
    }
  }

  /** A wooden crate on the deck, a cube of the plan `half` metres to each side: boarded faces, a darker frame, a lit top. */
  private crate(at: P3, half: number, seed: number): void {
    const [x, y, z] = at, top = y + half * 2;
    const board = (base: number) => (px: number, py: number) => (hash2(px >> 2, py, seed) > 0.85 ? R.wood[base - 1]! : py % 4 === 0 ? R.wood[base - 1]! : R.wood[base]!);
    const lit = this.hour.side < 0;
    // the side face toward the viewer's middle, then the front, then the top
    const sx = x < 0 ? x + half : x - half;
    this.quad([[sx, y, z - half], [sx, y, z + half], [sx, top, z + half], [sx, top, z - half]], board(lit === x > 0 ? 3 : 2));
    this.quad([[x - half, y, z - half], [x + half, y, z - half], [x + half, top, z - half], [x - half, top, z - half]], board(3));
    this.quad([[x - half, top, z - half], [x + half, top, z - half], [x + half, top, z + half], [x - half, top, z + half]], () => R.wood[4]!);
    // the frame round the front and a brace across it
    const c = [docksProject(x - half, y, z - half), docksProject(x + half, y, z - half), docksProject(x + half, top, z - half), docksProject(x - half, top, z - half)];
    for (let k = 0; k < 4; k++) this.line(c[k]!, c[(k + 1) % 4]!, R.wood[1]!);
    this.line(c[0]!, c[2]!, R.wood[2]!);
  }

  /** A straight line between two points of the picture. */
  private line(a: { x: number; y: number }, b: { x: number; y: number }, c: number): void {
    const n = Math.max(1, Math.ceil(Math.max(Math.abs(b.x - a.x), Math.abs(b.y - a.y))));
    for (let k = 0; k <= n; k++) this.put(a.x + ((b.x - a.x) * k) / n, a.y + ((b.y - a.y) * k) / n, c);
  }

  /**
   * The landing behind the boulder at the walk's end, where boats come in (the grounding area is behind the
   * rock): a long deck on legs, its right end showing past the boulder with a bollard, a coil of rope and a small
   * barrel on it, and a ladder down to the water (the painter's props).
   */
  private landing(look: number): void {
    const { x0, x1, z0, z1 } = LANDING, d = JETTY.deck;
    for (let x = x0 + 0.3, i = 0; x < x1; x += 2.4, i++) for (const z of [z0 + 0.15, z1 - 0.15]) this.leg(x, z, -0.4, d + (i % 3 === 2 && z < z1 - 1 ? 0.55 : 0.1 + 0.2 * hash2(i, 3, 258)), LEG, 500 + i * 3 + Math.round(z), look, true);
    this.quad([[x0, d, z0], [x1, d, z0], [x1, d - 0.28, z0], [x0, d - 0.28, z0]], () => R.wood[1]!);
    this.quad([[x0, d, z0], [x1, d, z0], [x1, d, z1], [x0, d, z1]], (px, py) => (px % 4 === 0 ? R.wood[2]! : fbm(px / 4, py * 2, 2, 260) > 0.55 ? R.wood[5]! : R.wood[4]!));
    // the ladder down its near side into the water, at the right end
    for (const ax of [x1 - 1.3, x1 - 0.9]) this.leg(ax, z0 - 0.05, -0.3, d + 0.35, 0.05, Math.round(ax * 31), look, true);
    for (let k = 0; k < 3; k++) this.line(docksProject(x1 - 1.3, 0.15 + k * 0.3, z0 - 0.05), docksProject(x1 - 0.9, 0.15 + k * 0.3, z0 - 0.05), R.wood[3]!);
    // the bollard, the coil of rope and a small barrel on the deck
    this.leg(x1 - 0.5, z0 + 0.5, d - 0.1, d + 0.6, 0.17, 77, look, false);
    const coil = docksProject(x1 - 2.1, d + 0.02, z0 + 0.9);
    for (let a = 0; a < Math.PI * 2; a += 0.04) for (const [k, c] of [[1, R.dry[1]!], [0.66, R.dry[2]!], [0.36, R.dry[0]!]] as const) this.put(coil.x + Math.cos(a) * k * 3, coil.y + Math.sin(a) * k * 1, c);
    this.as(() => this.barrel([x1 - 3.2, d, z0 + 1.2], 0.24, 0.62, 402));
  }

  /**
   * The big boulder with the tower on its top and the stair up to it from the walk; the iron ring to moor to low on its
   * face (the reference photograph marks the mooring points).
   */
  private rockAndTower(look: number): void {
    const { x, z, r, high } = BOULDER;
    this.as(() => {
      this.rock(x, z, r, look, high);
      const ring = docksProject(x + 2.6, 0.7, z - r * 0.85);
      for (let a = 0; a < Math.PI * 2; a += 0.3) this.put(ring.x + Math.cos(a) * 1.6, ring.y + Math.sin(a) * 1.6, R.ink);
    });
    this.as(() => this.tower());
    this.as(() => this.stair(look));
  }

  /** A straight pole between two points of the plan, `thick` metres thick, lit on the light's side. */
  private pole(a: P3, b: P3, thick: number): void {
    const side = this.hour.side;
    const steps = 40;
    for (let k = 0; k < steps; k++) {
      const p = docksProject(a[0] + ((b[0] - a[0]) * k) / steps, a[1] + ((b[1] - a[1]) * k) / steps, a[2] + ((b[2] - a[2]) * k) / steps);
      const q = docksProject(a[0] + ((b[0] - a[0]) * (k + 1)) / steps, a[1] + ((b[1] - a[1]) * (k + 1)) / steps, a[2] + ((b[2] - a[2]) * (k + 1)) / steps);
      const wide = Math.max(1, (470 * thick) / p.far);
      const n = Math.max(1, Math.ceil(Math.max(Math.abs(q.x - p.x), Math.abs(q.y - p.y))));
      for (let j = 0; j < n; j++) {
        const x = p.x + ((q.x - p.x) * j) / n, y = p.y + ((q.y - p.y) * j) / n;
        for (let s = 0; s < wide; s++) {
          const u = (s + 0.5) / wide - 0.5;
          this.put(x - wide / 2 + s, y, u * side > 0.15 ? R.wood[3]! : u * side < -0.2 ? R.wood[1]! : R.wood[2]!);
        }
      }
    }
  }

  /**
   * The birdwatching hut on the boulder (built directly on top of the stone, the stone its
   * floor), after the thatched lookouts of the 1991 game's treehouses: stout corner posts set into the rock, a log sill
   * on the stone, an open rail of thin balusters with a gap where the stair comes up, a round shaggy thatched roof with
   * a knob and a gull on it, a spyglass on the rail, the lantern on a bracket at the near right post. Crooked as the
   * 1991 game's buildings are: it leans a little and its roof sits off the middle.
   */
  private tower(): void {
    const T = TOWER, side = this.hour.side;
    const lean = 0.6; // metres the top leans to the left
    const total = T.posts + T.roof;
    const at = (a: number, b: number, y: number): P3 => {
      const c = towerCorner(a, b);
      return [c.x - (lean * (y - T.base)) / total, y, c.z];
    };
    const ring = [[-1, -1], [1, -1], [1, 1], [-1, 1]] as const;
    const floor = TOWER_FLOOR, eaves = TOWER_EAVES;
    // the roof's underside, seen from below between the posts: dark straw and rafters
    const rE = (T.half + T.eaves) * 1.05, c = at(0, 0, eaves - 0.15);
    for (let j = 0; j < 16; j++) {
      const t0 = (j / 16) * Math.PI * 2, t1 = ((j + 1) / 16) * Math.PI * 2;
      this.quad([c, [c[0] + rE * Math.cos(t0), c[1], T.z + rE * Math.sin(t0) * 0.95], [c[0] + rE * Math.cos(t1), c[1], T.z + rE * Math.sin(t1) * 0.95], c], (px) => (px % 5 === 0 ? R.wood[0]! : R.wood[1]!));
    }
    // the sides far to near: the far posts and rail show through the open near ones
    const faces = ring.map((p, i) => {
      const q = ring[(i + 1) % 4]!;
      const A = at(p[0], p[1], floor), B = at(q[0], q[1], floor);
      const nx = B[2] - A[2], nz = -(B[0] - A[0]), n = Math.hypot(nx, nz);
      return { p, q, far: (A[2] + B[2]) / 2, nx: nx / n, nz: nz / n, front: p[1] === -1 && q[1] === -1 };
    }).sort((m, n) => n.far - m.far);
    const post = (a: number, b: number): void => this.pole(at(a, b, floor - 0.35), at(a, b, eaves), 0.22);
    const drawn = new Set<string>();
    for (const f of faces) {
      const lerp = (u: number, y: number): P3 => {
        const A = at(f.p[0], f.p[1], y), B = at(f.q[0], f.q[1], y);
        return [A[0] + (B[0] - A[0]) * u, y, A[2] + (B[2] - A[2]) * u];
      };
      for (const [a, b] of [f.p, f.q]) if (!drawn.has(`${a}${b}`) && at(a, b, floor)[2] > f.far) { post(a, b); drawn.add(`${a}${b}`); }
      // a log sill on the stone
      this.pole(lerp(0, floor + 0.05), lerp(1, floor + 0.05), 0.16);
      // thin balusters, a mid rail and a top rail; a gap on the front where the stair comes up
      const gap = (u: number): boolean => f.front && u > 0.2 && u < 0.45;
      // one baluster every few pixels as seen, so a side seen edge-on stays open rather than turning into a wall of boards
      const seen = Math.abs(docksProject(...lerp(1, floor)).x - docksProject(...lerp(0, floor)).x);
      const n = Math.max(2, Math.min(Math.round(2 * T.half * 4), Math.round(seen / 5)));
      for (let k = 1; k < n; k++) {
        if (gap(k / n)) continue;
        const wob = (hash2(k, f.p[0] * 3 + f.p[1], 613) - 0.5) * 0.08;
        const foot = lerp(k / n, floor + 0.1);
        this.pole(foot, [foot[0] + wob, floor + T.rail, foot[2]], 0.05);
      }
      for (const [y, thick] of [[floor + T.rail * 0.45, 0.06], [floor + T.rail, 0.1]] as const) {
        if (f.front) {
          this.pole(lerp(0, y), lerp(0.2, y), thick);
          this.pole(lerp(0.45, y), lerp(1, y), thick);
        } else this.pole(lerp(0, y), lerp(1, y), thick);
      }
      for (const [a, b] of [f.p, f.q]) if (!drawn.has(`${a}${b}`)) { post(a, b); drawn.add(`${a}${b}`); }
    }
    this.thatchRoof(at, eaves);
    // a wooden knob on the roof's point, a gull sitting on it
    const apex: P3 = [at(0, 0, eaves + T.roof)[0] - 0.25, eaves + T.roof, T.z];
    const peak = docksProject(...apex), knob = docksProject(apex[0], apex[1] + 0.25, apex[2]);
    this.line(peak, knob, R.wood[0]!);
    for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) if (dx * dx + dy * dy <= 5) this.put(knob.x + dx, knob.y + dy, dx * side > 0 ? R.wood[3]! : dy > 0 ? R.wood[0]! : R.wood[1]!);
    const g = { x: Math.round(knob.x), y: Math.round(knob.y) - 3 };
    const W = R.shingle[3]!, G = R.stone[2]!, K = R.stone[0]!, B = R.dry[2]!, L = R.rose[2]!;
    const gull: [number, number, number][] = [[1, -4, W], [2, -4, W], [3, -4, B], [4, -4, B], [0, -3, W], [1, -3, W], [2, -3, K], [-2, -2, W], [-1, -2, G], [0, -2, G], [1, -2, W], [2, -2, W], [-4, -1, K], [-3, -1, G], [-2, -1, G], [-1, -1, G], [0, -1, W], [1, -1, W], [0, 0, L], [1, 0, L]];
    for (const [dx, dy, col] of gull) this.put(g.x + dx, g.y + dy, col);
    // a spyglass laid on the rail at the near right corner, looking out to sea
    const s0 = at(0.55, -1.04, floor + T.rail + 0.06), s1: P3 = [s0[0] + 1.0, s0[1] + 0.2, s0[2] + 0.5];
    this.pole(s0, s1, 0.08);
    const lens = docksProject(...s1);
    this.put(lens.x, lens.y, R.dry[3]!); this.put(lens.x + 1, lens.y, R.dry[3]!);
    // the lantern on its bracket at the near right post
    const root = docksProject(LAMP.x - (lean * (LAMP.y - T.base)) / total, LAMP.y, LAMP.z), hook = this.plan.lamp;
    this.line(root, hook, R.wood[0]!);
    this.line(docksProject(LAMP.x - (lean * (LAMP.y - 0.4 - T.base)) / total, LAMP.y - 0.4, LAMP.z), { x: (root.x + hook.x) / 2, y: (root.y + hook.y) / 2 }, R.wood[1]!);
    this.lantern(hook.x, hook.y + 1);
  }

  /**
   * The hut's round thatched roof, as on the 1991 game's treehouse huts: a bell of straw in bands, wide at the lip and
   * rounding to a small top, pale grey-beige where the light falls and brown under, a thick shaggy lip.
   */
  private thatchRoof(at: (a: number, b: number, y: number) => P3, eaves: number): void {
    const T = TOWER, side = this.hour.side;
    // straw, not the planks' wood, so the hut stands apart from the warm walk (art review 3 of the docks)
    const STRAW = [R.wood[0]!, R.wood[1]!, R.dry[0]!, R.dry[1]!, R.dry[2]!, R.dry[3]!];
    const N = 16, rE = (T.half + T.eaves) * 1.05;
    const levels = [{ r: rE, y: eaves - 0.15 }, { r: rE * 0.74, y: eaves + T.roof * 0.32 }, { r: rE * 0.4, y: eaves + T.roof * 0.72 }, { r: 0.08, y: eaves + T.roof }];
    const P = (l: number, j: number): P3 => {
      const L = levels[l]!, th = (j / N) * Math.PI * 2, c = at(0, 0, L.y);
      const sag = l === 0 ? (hash2(j % N, 1, 650) - 0.5) * 0.14 : 0;
      return [c[0] - 0.25 * (L.y - eaves) / T.roof + L.r * Math.cos(th), L.y + sag, T.z + L.r * Math.sin(th) * 0.95];
    };
    const quads: { pts: P3[]; far: number; lit: number; l: number }[] = [];
    for (let l = 0; l < levels.length - 1; l++) for (let j = 0; j < N; j++) {
      const th = ((j + 0.5) / N) * Math.PI * 2;
      const pts = [P(l, j), P(l, j + 1), P(l + 1, j + 1), P(l + 1, j)];
      quads.push({ pts, far: (pts[0]![2] + pts[1]![2]) / 2, lit: 0.5 + Math.cos(th) * -side * 0.32 - Math.sin(th) * 0.12 + l * 0.12, l });
    }
    quads.sort((m, n) => n.far - m.far);
    for (const q of quads) {
      this.quad(q.pts, (px, py) => {
        const band = Math.floor(py / 4);
        const streak = hash2(px, band, 641 + q.l);
        const t = q.lit + (streak - 0.5) * 0.3 - (streak > 0.9 ? 0.2 : 0);
        return STRAW[Math.max(0, Math.min(5, Math.round(clamp01(t) * 5)))]!;
      });
    }
    // the lip: the cut ends of the straw, lit along their top, dark under, a fringe hanging ragged
    for (let j = 0; j < N; j++) {
      const a = P(0, j), b = P(0, j + 1);
      if ((a[2] + b[2]) / 2 > T.z + 0.3) continue;
      const pa = docksProject(...a), pb = docksProject(...b);
      const n = Math.max(1, Math.ceil(Math.abs(pb.x - pa.x)));
      for (let k = 0; k <= n; k++) {
        const x = Math.round(pa.x + ((pb.x - pa.x) * k) / n), y = Math.round(pa.y + ((pb.y - pa.y) * k) / n);
        this.put(x, y - 1, STRAW[4]!);
        this.put(x, y, STRAW[2]!);
        this.put(x, y + 1, STRAW[1]!);
        const hang = Math.floor(hash2(x, 3, 651) * 3.4);
        for (let d = 0; d < hang; d++) this.put(x, y + 2 + d, d === hang - 1 ? STRAW[0]! : STRAW[1]!);
      }
    }
  }

  /** Where the stair reaches the hut: the gap in the front rail, on the stone. */
  private stairTop(): P3 {
    const c = towerCorner(-0.35, -1.15);
    return [c.x - 0.1, TOWER.base - 0.05, c.z - 0.2];
  }

  /** The stair from the walk on the boulder's left up its face to the gap in the hut's rail: wooden steps on two stringers, a rope to hold. */
  private stair(look: number): void {
    const { x, z } = BOULDER;
    const a0 = (200 * Math.PI) / 180;
    const bottom: P3 = [x + 4.85 * Math.cos(a0), JETTY.deck, z + 4.85 * Math.sin(a0)];
    const top = this.stairTop();
    const steps = 9;
    const ux = top[0] - bottom[0], uz = top[2] - bottom[2], n = Math.hypot(ux, uz);
    const ax = (-uz / n) * 0.36, az = (ux / n) * 0.36;
    for (let i = steps - 1; i >= 0; i--) {
      const t0 = i / steps, t1 = (i + 1) / steps;
      const y = bottom[1] + (top[1] - bottom[1]) * t1;
      const p0 = [bottom[0] + ux * t0, bottom[2] + uz * t0], p1 = [bottom[0] + ux * t1, bottom[2] + uz * t1];
      // the step's tread, and its riser under its near edge
      this.quad([[p0[0]! - ax, y, p0[1]! - az], [p0[0]! + ax, y, p0[1]! + az], [p1[0]! + ax, y, p1[1]! + az], [p1[0]! - ax, y, p1[1]! - az]], (px, py) => (hash2(px >> 1, py, 630 + i) > 0.85 ? R.wood[3]! : R.wood[4]!));
      const rise = (top[1] - bottom[1]) / steps;
      this.quad([[p0[0]! - ax, y, p0[1]! - az], [p0[0]! + ax, y, p0[1]! + az], [p0[0]! + ax, y - rise, p0[1]! + az], [p0[0]! - ax, y - rise, p0[1]! - az]], () => R.wood[1]!);
    }
    // the stringers, and the rope on posts at its foot and its head
    for (const k of [-1, 1]) this.line(docksProject(bottom[0] + ax * k, bottom[1] - 0.15, bottom[2] + az * k), docksProject(top[0] + ax * k, top[1] - 0.15, top[2] + az * k), R.wood[0]!);
    const footPost: P3 = [bottom[0] - ax * 1.2, bottom[1], bottom[2] - az * 1.2], headPost: P3 = [top[0] - ax * 1.2, top[1] - 0.1, top[2] - az * 1.2];
    this.leg(footPost[0], footPost[2], bottom[1] - 0.2, bottom[1] + 0.95, 0.08, 640, look, false);
    this.leg(headPost[0], headPost[2], top[1] - 0.3, top[1] + 0.95, 0.08, 641, look, false);
    this.rope([footPost[0], footPost[1] + 0.9, footPost[2]], [headPost[0], headPost[1] + 0.9, headPost[2]], 0.15);
  }

  /** The lantern: a dark cage with a cap, its glass pale by day and lit by the flame at dusk and night. */
  /** The kit's lantern (`lights/lantern`), hanging from (`x`, `y`). */
  private lantern(x: number, y: number): void {
    lantern.paint(this.brush(0), x, y - 1, optionsOf(lantern), 0);
  }

  // ---- what is near the viewer

  /**
   * Dry grass and sea kale growing out of the shingle, bending with the gust: `far` the tufts on the spit beyond the
   * jetty (painted before it), else the few on the shingle before it.
   */
  private tufts(look: number, far: boolean): void {
    for (let n = 0; n < 26; n++) {
      const x = far ? 440 + hash2(n, 1, 270) * 190 : 250 + hash2(n, 1, 275) * 200;
      const y = far ? 128 + hash2(n, 2, 271) * 60 : 214 + hash2(n, 2, 276) * 36;
      const g = docksGround(x, y);
      if (!g || g.z > this.edge(x) - 1.5 || (!far && n > 9)) continue;
      const tall = (5 + 12 * hash2(n, 3, 272)) * (0.6 + (y - 120) / 70);
      const dry = hash2(n, 4, 273) > 0.35;
      const blades = tall > 14 ? 7 : 5;
      for (let b = 0; b < blades; b++) {
        const u = (b + 0.5) / blades - 0.5;
        const high = tall * (0.6 + 0.4 * hash2(n, b, 274));
        const tipLean = lean(x, y, look, DOCKS_FRAMES, DOCKS_WAY) * high;
        for (let i = 0; i <= high; i++) {
          const t = i / high;
          const c = dry ? (t < 0.3 ? R.dry[0]! : t < 0.75 ? R.dry[1]! : R.dry[2]!) : t < 0.3 ? R.grass[0]! : t < 0.75 ? R.grass[2]! : R.grass[3]!;
          this.put(x + u * tall * 0.5 * (0.3 + t) + tipLean * t * t, y - i, c);
        }
      }
    }
  }

  /** The heap of boulders that closes the lower left corner, at the water's edge. */
  private cornerRocks(look: number): void {
    this.as(() => this.boulder(118, 364, 34, 30, 301, look, false, 0.3));
    this.as(() => this.boulder(-10, 364, 70, 92, 302, look, false, 0.36));
    this.as(() => this.boulder(54, 374, 48, 44, 303, look, false, 0.42));
    // and a low dark heap under the mooring post on the right, so both wings are dark (MI2 frames its lit middle so)
    this.as(() => this.boulder(630, 366, 46, 62, 304, look, false, 0.42));
  }

  /**
   * The big mooring post near the viewer on the right, leaning across the corner as the post on the 1991 game's jetty
   * does (the reference picture): a thick crooked pile, darker for being near and against the light, a rope wound on it,
   * and from an arm near its top a crooked board on two ropes with a fish painted on it (the painter's quirk).
   */
  private mooringPost(look: number): void {
    const foot = { x: 606, y: 374 }, top = { x: 566, y: 70 };
    for (let y = top.y; y <= foot.y; y++) {
      const t = (y - top.y) / (foot.y - top.y);
      const cx = top.x + (foot.x - top.x) * t + Math.sin(t * Math.PI * 1.3) * 5;
      const half = 9 + 5 * t;
      for (let x = Math.floor(cx - half); x <= Math.ceil(cx + half); x++) {
        const u = (x - cx) / half;
        const grain = fbm(x / 3, y / 14, 2, 280);
        let c = u < -0.55 ? R.wood[2]! : u > 0.4 ? R.wood[0]! : grain > 0.58 ? R.wood[2]! : R.wood[1]!;
        if (y < top.y + 5 && Math.abs(u) < 0.9) c = y < top.y + 2 ? R.wood[3]! : R.wood[2]!;
        if (Math.abs(u) > 0.95) c = R.wood[0]!;
        this.put(x, y, c);
      }
    }
    // the rope wound round it, and running off down to the left
    for (let k = 0; k < 4; k++) {
      const y = 136 + k * 5;
      const t = (y - top.y) / (foot.y - top.y), cx = top.x + (foot.x - top.x) * t + Math.sin(t * Math.PI * 1.3) * 5, half = 9 + 5 * t;
      for (let x = Math.floor(cx - half); x <= Math.ceil(cx + half); x++) {
        const u = (x - cx) / half;
        const dy = Math.round(u * 2);
        this.put(x, y + dy, u > 0.5 ? R.dry[0]! : R.dry[2]!);
        this.put(x, y + dy + 1, u > 0.3 ? R.earth[0]! : R.dry[1]!);
      }
    }
    this.hangingBoard(look);
  }

  /** The arm out to the left of the mooring post, and the board hanging crooked from it on two ropes, a fish painted on it. */
  private hangingBoard(look: number): void {
    const arm = { x0: 568, y: 98, x1: 512 };
    for (let x = arm.x1; x <= arm.x0; x++) for (let k = 0; k < 4; k++) this.put(x, arm.y + k + Math.round((arm.x0 - x) * 0.06), k === 0 ? R.wood[2]! : k === 3 ? R.wood[0]! : R.wood[1]!);
    const tilt = 0.14 + 0.02 * swing(look, DOCKS_FRAMES, 0.2), board = { x: 534, y: 132, w: 22, h: 14 };
    const hang = [[board.x - 15, arm.y + 4], [board.x + 15, arm.y + 2]] as const;
    for (const [hx, hy] of hang) {
      const by = board.y - board.h + (hx - board.x) * tilt;
      this.line({ x: hx, y: hy }, { x: hx, y: by }, R.dry[0]!);
    }
    for (let dy = -board.h - 2; dy <= board.h + 2; dy++) for (let dx = -board.w - 2; dx <= board.w + 2; dx++) {
      const u = dx * Math.cos(tilt) + dy * Math.sin(tilt), v = -dx * Math.sin(tilt) + dy * Math.cos(tilt);
      if (Math.abs(u) > board.w || Math.abs(v) > board.h) continue;
      const rim = Math.abs(u) > board.w - 2 || Math.abs(v) > board.h - 2;
      // the fish: an oval body and a forked tail, an eye
      const fx = (u + 3) / 13, fy = v / 6.5;
      const body = fx * fx + fy * fy < 1, tail = u < -14 && u > -20 && Math.abs(v) < (-14 - u) * 0.9;
      const eye = Math.hypot(u - 7, v + 1.5) < 1.3;
      let c = rim ? R.wood[0]! : Math.round(v + 30) % 7 === 0 ? R.wood[1]! : fbm(u / 4, v / 2, 2, 290) > 0.55 ? R.wood[3]! : R.wood[2]!;
      if (!rim && (body || tail)) c = eye ? R.ink : v < -2 ? R.shingle[3]! : R.shingle[2]!;
      this.put(board.x + dx, board.y + dy, c);
    }
  }

  // ---- the pictures

  private painted(look: number): Bitmap {
    const bitmap = createBitmap(this.w, this.h);
    this.px = bitmap.pixels;
    this.owner = new Uint16Array(this.w * this.h);
    this.things = 0;
    this.live.on = look === 0;
    this.paintSky();
    this.paintFloor(look);
    this.seaBands(look);
    this.seaLights();
    this.pebbles();
    // far to near: the boulders behind the big one, the walk behind it, the big boulder with its tower and stair, the rest of the walk
    const rocks = [...DOCKS_ROCKS].sort((a, b) => b.z - a.z);
    for (const r of rocks) if (r.z > BOULDER.z) this.as(() => this.rock(r.x, r.z, r.r, look));
    this.as(() => this.jetty(look, true));
    this.rockAndTower(look);
    for (const r of rocks) if (r.z <= BOULDER.z) this.as(() => this.rock(r.x, r.z, r.r, look));
    this.tufts(look, true);
    this.as(() => this.jetty(look, false));
    this.tufts(look, false);
    this.cornerRocks(look);
    this.as(() => this.mooringPost(look));
    // at night the shore and the water nearest the eye are a moonlit plane, the rocks, the walk and the post dark shapes on it
    if (this.hour.night) moonlitFoot(this.px, this.w, [F.shingle, F.stone, F.grass, F.dry, F.sea], { ...DOCKS_FOOT, keep: (i) => this.owner[i] !== 0 });
    if (look === 0) this.water = this.live.seal(bitmap);
    // the grain of scanned paint over every run (not the embers, not the clouds, which drift as their own pictures)
    grain(this.px, this.w, GRAIN_RUNS, { seed: 400, keep: (i) => this.calm.get(i) === this.px[i] });
    this.outline();
    return bitmap;
  }

  /** Every look, and in each what stands before the sky in the rows the clouds reach (`band`). */
  frames(band: number): { frames: Bitmap[]; fore: Overlay } {
    return paintLooks(DOCKS_FRAMES, this.sky, Math.min(band, this.hz + 1), (look) => this.painted(look));
  }

  /** The lamp's light: a soft ring of its glow round the lantern at dusk and night, flickering; nothing by day. */
  lamp(): Overlay {
    const { w, h, plan } = this;
    const lit = lampLit(this.brush(0));
    return cropTogether(Array.from({ length: LAMP_LOOKS }, (_, look) => {
      const bitmap = createBitmap(w, h);
      if (!lit) {
        bitmap.pixels[0] = R.ink;
        return bitmap;
      }
      // the kit's lamp (`lights/lamp`, after Woodtick) on its own layer: it reads the picture and paints the overlay,
      // a little further each look as it flickers
      const brush: KitBrush = {
        ...this.brush(look),
        put: (x, y, c) => {
          const px = Math.round(x), py = Math.round(y);
          if (px >= 0 && py >= 0 && px < w && py < h) bitmap.pixels[py * w + px] = c;
        },
        under: (x, y) => {
          const px = Math.round(x), py = Math.round(y);
          if (px < 0 || py < 0 || px >= w || py >= h) return undefined;
          const i = py * w + px;
          return { colour: this.px[i]!, thing: this.owner[i] !== 0 };
        },
      };
      lamp.paint(brush, plan.lamp.x, plan.lamp.y, optionsOf(lamp, undefined, { reach: 40 + look * 2, water: this.hz - plan.lamp.y, lantern: false }), look);
      return bitmap;
    }));
  }
}

/** Paints the docks of `world` as planned, for one hour of the sky. */
export function paintDocks(world: World, plan: DocksPlan, phase: SkyPhase): DocksPicture {
  const p = new DocksPainter(world, plan, phase);
  const clouds = DOCKS_CLOUDS.map(({ at, spec }) => ({ x: at[0], y: at[1], bitmap: p.cloud(spec) }));
  const { frames, fore } = p.frames(Math.max(...clouds.map((c) => c.y + c.bitmap.height)));
  return { palette: p.palette, frames, fore, clouds, lamp: p.lamp(), water: p.water!, gull: p.gullTone() };
}
