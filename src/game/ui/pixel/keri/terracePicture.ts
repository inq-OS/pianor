import { DECK, GRILL, LONG_EYE, REACH, TERRACE, TORCHES, TOWER, TERRACE_LAND, TERRACE_ROCKS, deckOf, lampHook, onDeck, onReach, onTorch, onTower, reachSides, terraceFloor, underReach, terraceGrassy, terraceGroundAt, terracePlace, terraceProject, terraceShore, type P3, type TerracePlan, type TerraceShore } from '../../../../core/layout/terrace';
import type { SkyPhase } from '../../../../core/sky/skyPhase';
import type { World } from '../../../../core/world/world';
import { createBitmap, type Bitmap } from '../bitmap';
import { cropTogether, type Overlay } from '../pack';
import { clamp01, smoothstep as smooth } from '../paint/ease';
import { grain } from '../paint/grain';
import { LiveRecorder, type LiveWater } from '../paint/live';
import { paintLooks, SkyMask, type WindWay } from '../paint/motion';
import { fbm, hash2, noise2 } from '../paint/noise';
import type { SmokeTones } from '../paint/smoke';
import type { Blown } from '../sway';
import { tintedCloud, type CurlSpec } from './curlCloud';
import { KERI_HOURS, scenePalette, tone, type Hour } from './keriPalette';
import { rose } from './kit/bushes';
import { optionsOf, type KitBrush } from './kit/kit';
import { lamp, lampLit, lantern } from './kit/lights';
import { boulder, pebble } from './kit/stones';
import { reflection, rings, sea, type SeaGround, type SeaOptions, type SeaStand } from './kit/water';
import { fillQuad, KIT_WOOD, planks, post, type Plank, type PlanksOptions, type PostStep, type Pt } from './kit/wood';

/**
 * The picture of the terrace (ft_1_19): the wooden deck before the main door of the warden's house, seen from its end
 * by the door, looking away from the house over the shingle to the sea (marks on a drone photograph:
 * the terrace, looking away from the house, slightly south-west). Painted as pixel art as the docks are (d111), in
 * the manner of the 1991 game's decks and docks, never as the place is. The real terrace is a plain deck with a pipe
 * rail, red benches with gulls cut in their backs, a lifebuoy and a barrel grill (the photographs of keri.ee, studied
 * only). This one has more on it and reaches further (the terrace should have more features than it
 * actually does and extend further out over the beach): from its seaward edge a walk of grey boards on piles
 * runs out over the beach, a step lower, to a head over the water, and on the head's seaward corner stands a small
 * thatched watchtower, a storey up, with a long brass spyglass fixed on its floor, a lantern at its corner and a
 * pennant on its roof (a roofed section, perhaps a small watchtower that goes up to the second floor
 * with a static long-eye to scan the horizon). The rails are stout wood (the handrails should be made of wood, as
 * the old ones were too thin and looked as if you could fall down). A string of paper lanterns and flags hangs along
 * the walk, and on the deck stand a picnic table between two of the benches, the grill, and a barrel and crates. A boat's bow stood there in passes 1 and 2 (the deck
 * has more features and character, and the boat was too much). The walk and what is on it are the painter's,
 * not Keri's (docs/keri.md, section 9).
 *
 * Laid on back to front: the bare sky (its clouds are their own pictures and drift over it), the sea, the shingle with
 * its pebbles and the boulders in the shallows, the thicket on the right, the walk on its piles, the deck with its rail and
 * what stands on it, and the dark things near the viewer that close the corners. The hour changes the colours, not the
 * drawing; only the moon, the stars, the glints, the coals and the lamp are drawn for an hour. Nothing is painted in a
 * loop of looks: the water is live (`paint/live.ts`), and the smoke, the pennant, the lamp's light, the gulls and the
 * moths are drawn by the game (`sceneLife.ts`).
 */

/** Keri's shared palette, the kit's wood, a boat's white paint and its red (the harbour's two, `portPicture.ts`). */
const SHARED = scenePalette({
  wood: KIT_WOOD,
  // white paint: its shade blue-grey, its light warm
  hull: [0x3c4058, 0x646c84, 0x9aa2b2, 0xcfd0cc, 0xf8f4e6],
  // the benches' and the boat's red, the lifebuoy, the pennant
  red: [0x380a16, 0x741622, 0xb42c2a, 0xe0603a, 0xffae72],
}, ['dry', 'far', 'shingle', 'stone', 'earth', 'bush', 'near', 'rose', 'bloom', 'smoke'], { sky: 3 });
const R = SHARED.run;
const F = SHARED.fine;

/** The part of a whole run from one of its named tones to another. */
const part = (whole: readonly number[], from: number, to: number): readonly number[] => whole.slice(whole.indexOf(from), whole.indexOf(to) + 1);

const PEBBLE = part(F.shingle, R.shingle[0]!, R.shingle[3]!);
/** Boards gone grey in the weather (the boat's deck; half the real terrace is so): the stone's shade into the shingle's light. */
const GREY = { run: [R.stone[0]!, R.stone[1]!, R.stone[2]!, R.shingle[1]!, R.shingle[2]!, R.shingle[3]!], fine: [...part(F.stone, R.stone[0]!, R.stone[2]!), ...part(F.shingle, R.shingle[1]!, R.shingle[3]!)] } as const;

/**
 * The runs the grain of scanned paint goes over: the things' (stone, wood, paint). Not the embers' (a light keeps its
 * own) or the clouds', and not the sky's or the water's: what lies behind is smooth and what stands before it has the
 * tooth (the sky and background should be butter smooth, as in the 1991 game, while the details,
 * buildings and so on are pixel art).
 */
const GRAIN_RUNS = Object.entries(F).filter(([name]) => !['ember', 'cloud', 'sky', 'sea', 'smoke'].includes(name)).map(([, run]) => run);

export function terracePalette(phase: SkyPhase): readonly number[] {
  return SHARED.at(phase);
}

/** The terrace's runs, for the art tools and the rules' test: Keri's shared runs, the wood and the paint. */
export const terraceRuns = (): Readonly<Record<string, readonly number[]>> => SHARED.fine;

/** The wind of Keri blows mostly from the west (docs/keri.md): looking west-south-west, that is toward the viewer and to the left. */
export const TERRACE_WAY: WindWay = -1;
/** The lamp's flicker: how many looks its light has. */
export const LAMP_LOOKS = 3;

/** The moon's place in the night's sky: high on the right, away from the lantern. */
export const TERRACE_MOON = { x: 474, y: 24, r: 8 } as const;
const MOON = TERRACE_MOON;

/**
 * Where the light is in this view (west-south-west) at each hour: the side it comes from (-1 left, 1 right), the column
 * where it lies on the water (under 0: nowhere), and whether a low sun warms the sky on the right. By day the sun stands
 * in the south, to the left; at dusk it sets ahead and to the right; at dawn it rises behind the viewer.
 */
const LIGHT: Record<SkyPhase, { side: number; glint: number; warm: number }> = {
  day: { side: -0.7, glint: 96, warm: 0 },
  dawn: { side: -0.4, glint: -1, warm: 0 },
  dusk: { side: 1, glint: 566, warm: 1 },
  night: { side: 0.5, glint: MOON.x, warm: 0 },
};

/**
 * The sky's clouds, back to front (d111): each one stroke that rolls up into a head leading the way the wind blows (to
 * the left), no two alike, the big fat ones behind the long thin ones, small flat ones low over the sea. Each has its
 * left edge and top in fine pixels; they drift over the bare sky in the game.
 */
export const TERRACE_CLOUDS: readonly { at: readonly [number, number]; spec: CurlSpec }[] = [
  // low over the sea, far off: flat streaks and a small curl
  { at: [300, 73], spec: { length: 76, girth: 5, belly: 0.5, neck: 1, taper: 0.6, bend: 1, wave: 1, phase: 0.2 } },
  { at: [22, 76], spec: { length: 52, girth: 4, belly: 0.45, neck: 1, taper: 0.55, bend: 1, wave: 1.2, phase: 1.1 } },
  { at: [520, 66], spec: { length: 68, girth: 8, belly: 0.7, neck: 1, taper: 0.7, bend: 2, wave: 0.9, phase: 0.7, head: { size: 8, turns: 1.1 } } },
  // the big fat one behind, right of the middle, and a smaller one on the left; one head each (rule 13)
  { at: [330, 8], spec: { length: 120, girth: 38, belly: 0.8, neck: 0.9, taper: 1.15, bend: 10, wave: 0.75, phase: 0.15, rise: 9, head: { size: 26, turns: 1.2 } } },
  { at: [40, 30], spec: { length: 70, girth: 19, belly: 0.72, neck: 0.85, taper: 1.2, bend: 4, wave: 1, phase: 0.9, head: { size: 14, turns: 1.15 } } },
  // the long thin ones, in front of them
  { at: [484, 22], spec: { length: 126, girth: 13, belly: 0.6, neck: 0.85, taper: 0.75, bend: 7, wave: 1.35, phase: 1.05, head: { size: 18, turns: 1.3 } } },
  { at: [130, 50], spec: { length: 150, girth: 10, belly: 0.74, neck: 0.95, taper: 0.9, bend: 6, wave: 1.25, phase: 0.4, head: { size: 11, turns: 1.25, down: true } } },
];

export interface TerraceCloud {
  x: number;
  y: number;
  bitmap: Bitmap;
}

export interface TerracePicture {
  palette: readonly number[];
  /** The whole picture, the sky bare: the clouds drift over it. One look: what moves is live or drawn by the game. */
  frames: Bitmap[];
  /** What stands before the sky where the clouds go (the watchtower, the string of lanterns and its poles, the thicket's top). */
  fore: Overlay;
  /** The clouds, back to front (`TERRACE_CLOUDS`). */
  clouds: TerraceCloud[];
  /** The light of the lantern at the watchtower's corner, its pool on the head's boards with it, a frame for each flicker (`LAMP_LOOKS`); empty frames by day. */
  lamp: Overlay;
  /** The grill's coals' light on what stands round them, in the lamp's looks: nothing by day. */
  coals: Overlay;
  /** The torches' flames and their light on the boards and on what stands by them, one for each of `TORCHES`, in the lamp's looks: nothing by day. */
  torches: Overlay[];
  /** What moves on the water (its strokes, the bands round the rocks, the glints, the surf), lit as the game runs (`paint/live.ts`). */
  water: LiveWater;
  /** The gulls' colour, a place of the palette (`flock.ts`); the game flies them by day. */
  gull: number;
  /** The tones of the grill's smoke (`paint/smoke.ts`); the game draws its thread on the wind. */
  smoke: SmokeTones;
  /** What the wind moves (`sway.ts`): the pennant on the watchtower's staff, painted standing out straight, in the picture's pixels. */
  blown: Blown[];
}

/** How high the grill's wisp of smoke rises, in fine pixels: it thins out under the clouds (a fire's thread is taller; art review 1: it read as a string tied to a cloud). */
export const TERRACE_SMOKE_RISE = 46;
/** The smoke's tones, the same places of the palette at every hour. */
export const TERRACE_SMOKE: SmokeTones = { light: R.smoke[2]!, mid: R.smoke[1]!, root: R.smoke[0]!, shade: R.smoke[0]! };

const LENS = TERRACE.lens;
/** A board's width on the deck, metres: broad and few (`wood.md` rule 2). */
const BOARD = 0.44;
/** The deck's oiled boards' tones: most of them dark. */
const OILED_TONES: PlanksOptions = { light: 5, dark: 55 };
/** A board of the deck worn pale by feet and weather. */
const WORN_TONES: PlanksOptions = { light: 0, dark: 0 };
/** No board is drawn nearer than this far ahead of the eye (metres): the picture's foot is further. */
const NEAR = 1.3;
/** The rail's height over the boards, metres. */
const RAIL = 0.95;
/** The benches (the real ones are red, with white gulls on the back boards): the seat's and the back board's top, metres over the boards. */
const SEAT = 0.45, BACK = 1.0;

/** Four tones of a run for a pole or a board, dark to light. */
type Four = readonly [number, number, number, number];
const WOOD4: Four = [R.wood[0]!, R.wood[1]!, R.wood[2]!, R.wood[3]!];
const DARK4: Four = [R.wood[0]!, R.wood[0]!, R.wood[1]!, R.wood[2]!];
/** The colours of leaves and flowers. */
const LEAFY: ReadonlySet<number> = new Set([...F.bush, ...F.near, ...F.rose, ...F.bloom]);
/** A torch's iron cup. */
const IRON4: Four = [R.ink, R.stone[0]!, R.stone[0]!, R.stone[1]!];
/** A torch's head: tarred rag, charred. */
const CHARRED4: Four = [R.earth[0]!, R.earth[0]!, R.earth[1]!, R.stone[1]!];
/** Old timber gone silver in the weather (the walk's boards' greys): the watchtower's, and the handrails' top boards. */
const SILVER4: Four = [R.stone[1]!, R.stone[2]!, R.shingle[2]!, R.shingle[3]!];

const add = (a: P3, b: P3): P3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const mix = (a: P3, b: P3, t: number): P3 => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];

class TerracePainter {
  readonly palette: readonly number[];
  readonly sky: SkyMask;
  private readonly hour: Hour & (typeof LIGHT)[SkyPhase];
  private readonly w: number;
  private readonly h: number;
  private readonly hz: number;
  private readonly shore: TerraceShore[];
  /** The floor under each pixel: 0 none (the sky), 1 the sea, 2 the shingle, 3 the grass; how far ahead and how far inland it lies. */
  private readonly kind: Uint8Array;
  private readonly ahead: Float32Array;
  private readonly inland: Float32Array;
  private px: Uint8Array = new Uint8Array(0);
  /** Which thing painted each pixel (0 the sky, the sea and the shingle; then each thing in the order it was painted): the ink outlines go where things meet. */
  private owner: Uint16Array = new Uint16Array(0);
  private thing = 0;
  private things = 0;
  /** The pixels a shadow already lies on: no pixel is shaded twice. */
  private shaded: Uint8Array = new Uint8Array(0);
  private stands: readonly SeaStand[] | undefined;
  /** What moves on the water, recorded as it is painted (`paint/live.ts`). */
  private readonly live: LiveRecorder;
  water: LiveWater | null = null;
  /** The deck's boards as a thing of the picture (its number in `owner`), for the light that falls on them. */
  private deckThing = 0;
  /** The walk's boards as a thing of the picture, likewise. */
  private reachThing = 0;
  /** How far under the deck's boards the floor being furnished lies: 0 on the deck, the step down on the reach. */
  private base = 0;
  /** The darkest tone of the run each colour belongs to: a thing's outline is drawn in it. */
  private readonly darkest = new Map<number, number>();
  /** The second lightest tone of the run each colour belongs to: at night a thing's moonlit top edge takes it. */
  private readonly lit = new Map<number, number>();
  /** Where each colour of the wood and of the grey boards sits in its run: a shadow moves it down. */
  private readonly shadeOf = new Map<number, number>();

  /** The gulls' colour (`flock.ts` flies them in the game): pale against the sky, warm in the low sun where the sky is warm. */
  gullTone(): number {
    return this.hour.warm !== 0 ? R.cloud[3]! : R.stone[1]!;
  }

  constructor(world: World, private readonly plan: TerracePlan, phase: SkyPhase) {
    this.w = plan.fine.w;
    this.h = plan.fine.h;
    this.hz = plan.horizon;
    this.hour = { ...KERI_HOURS[phase], ...LIGHT[phase] };
    this.palette = terracePalette(phase);
    this.shore = terraceShore(world);
    this.sky = new SkyMask(this.w, this.h);
    this.live = new LiveRecorder(this.w, this.h, () => this.px, this.hz, TERRACE_WAY, R.foam);
    for (const run of Object.values(F)) for (const c of run) if (!this.darkest.has(c)) {
      this.darkest.set(c, run[0]!);
      this.lit.set(c, run[Math.max(0, run.length - 2)]!);
    }
    for (const run of [F.wood, GREY.fine, F.shingle, F.stone, F.dry, F.far]) run.forEach((c, k) => { if (!this.shadeOf.has(c)) this.shadeOf.set(c, run[Math.max(0, k - Math.max(2, Math.round(run.length * 0.3)))]!); });
    // the floor under every pixel, once
    const { w, h } = this, place = terracePlace(world);
    this.kind = new Uint8Array(w * h);
    this.ahead = new Float32Array(w * h);
    this.inland = new Float32Array(w * h);
    for (let y = this.hz + 1; y < h; y++) for (let x = 0; x < w; x++) {
      const f = terraceFloor(this.shore, x, y);
      if (!f) continue;
      const i = y * w + x;
      this.ahead[i] = f.z;
      this.inland[i] = f.inland;
      this.kind[i] = f.wet ? 1 : f.inland > 5 && terraceGrassy(world, place, f.x, f.z) ? 3 : 2;
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

  /** Where a point of the plan lands on the picture. */
  private at(p: P3): { x: number; y: number; far: number } {
    return terraceProject(p[0], p[1], p[2]);
  }

  cloud(spec: CurlSpec): Bitmap {
    return tintedCloud(spec, true, R.cloud);
  }

  /**
   * The brush the kit's things paint through (`kit/kit.ts`): this painter's pixels with their owner and the sky's mask,
   * the terrace's palette and hour. Nothing sways: the picture has one look.
   */
  private brush(): KitBrush {
    return {
      put: (x, y, c) => this.put(x, y, c), run: R, fine: F, hour: this.hour, side: this.hour.side, live: this.live,
      // only the open water is bare: the sea's own strokes and bands, never the shingle or a thing
      under: (x, y) => {
        const px = Math.round(x), py = Math.round(y);
        if (px < 0 || py < 0 || px >= this.w || py >= this.h) return undefined;
        const i = py * this.w + px;
        return { colour: this.px[i]!, thing: this.owner[i] !== 0 || this.kind[i]! > 1 };
      },
    };
  }

  // ---- the sky

  private paintSky(): void {
    const { w, hz, hour } = this;
    this.sky.sky = true;
    // smooth: no dither and no grain on what lies behind
    for (let x = 0; x < w; x++) for (let y = 0; y <= hz; y++) {
      let t = Math.min(1, Math.pow(y / hz, 0.85));
      // at dusk the sky warms on the right, where the sun goes down
      if (hour.warm !== 0) t += 0.3 * clamp01((x - w * 0.25) / (w * 0.75)) * (y / hz) ** 2 - 0.1;
      this.put(x, y, tone(F.sky, clamp01(t), x, y));
    }
    if (hour.night) this.stars();
    this.sky.sky = false;
    // the haze over the far water
    for (let x = 0; x < w; x++) this.put(x, hz - 1, R.sky[4]!);
  }

  private stars(): void {
    const { w, hz } = this;
    for (let gy = 0; gy < hz - 8; gy += 8) for (let gx = 0; gx < w; gx += 9) {
      const pick = hash2(gx, gy, 721);
      if (pick > 0.42) continue;
      const x = gx + Math.floor(hash2(gx, gy, 722) * 9), y = gy + Math.floor(hash2(gx, gy, 723) * 8);
      this.put(x, y, pick < 0.14 ? R.star[0]! : R.star[1]!);
      if (pick < 0.03) for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) this.put(x + dx, y + dy, R.star[1]!);
    }
    for (let dy = -MOON.r - 9; dy <= MOON.r + 9; dy++) for (let dx = -MOON.r - 9; dx <= MOON.r + 9; dx++) {
      const far = Math.hypot(dx, dy), x = MOON.x + dx, y = MOON.y + dy;
      if (far <= MOON.r) this.put(x, y, Math.hypot(dx + 3, dy + 3) < MOON.r * 0.55 || hash2(x >> 1, y >> 1, 724) > 0.86 ? R.moon[1]! : R.moon[0]!);
      // its halo: one flat ring of the sky's palest tone, ragged at its outer edge, no ordered dither
      else if (far < MOON.r + 3.5 + 1.5 * hash2(Math.round(Math.atan2(dy, dx) * 6), 1, 725)) this.put(x, y, R.sky[4]!);
    }
  }

  // ---- the shingle and the sea

  /** Whether a point of the ground lies in the shade under the reach's boards: the boards over it, and their shadow thrown away from the light. */
  private underBow(x: number, z: number): boolean {
    const { u, v } = deckOf(x, z);
    return underReach(u + this.hour.side * 0.6, v + 0.3) || underReach(u, v);
  }

  private paintFloor(): void {
    const { w, h, hz } = this;
    for (let y = hz; y < h; y++) for (let x = 0; x < w; x++) {
      const i = y * w + x, kind = this.kind[i]!;
      if (kind === 0) { this.put(x, y, R.sky[4]!); continue; }
      if (kind === 1) continue;
      const z = this.ahead[i]!, inland = this.inland[i]!, gx = ((x + 0.5 - w / 2) * z) / LENS;
      const band = fbm(gx / 4, z / 1.6, 2, 710);
      let c: number;
      if (inland < 0.7 + 0.5 * noise2(gx / 1.5, 2, 705)) c = hash2(x, y, 705) > 0.5 ? R.shingle[0]! : R.stone[1]!;
      else if (inland > 1.5 && inland < 2.3 + 0.6 * noise2(gx / 2, 1, 706) && fbm(gx * 1.6, z * 3, 2, 707) > 0.54 && hash2(x, y, 711) > 0.35) {
        // the wrack line: dried seaweed the sea left along the shingle
        c = hash2(x >> 1, y, 708) > 0.6 ? R.earth[0]! : hash2(x, y, 709) > 0.5 ? R.earth[1]! : R.bush[0]!;
      } else if (kind === 3) {
        // the island's grass, dry and gold by the shore, paler far off
        // patches a stride across, and tussocks a hand across inside them, so the ground near the eye is not one flat tone
        const far = smooth(18, 50, z), patch = fbm(gx * 0.9, z * 0.9, 3, 712), fine = fbm(gx * 7, z * 4, 2, 714);
        c = patch > 0.6 ? tone(F.far, 0.15 + 0.7 * fine + 0.2 * far, x, y, 0.3) : patch > 0.44 ? tone(F.dry, 0.0 + 0.85 * fine + 0.2 * far, x, y, 0.3) : tone(PEBBLE, 0.2 + 0.4 * band + 0.3 * fine, x, y, 0.25);
      } else {
        // the shingle: pale and dry up the bank, greyer toward the water
        const up = smooth(1.5, TERRACE_LAND.beach, inland);
        c = tone(PEBBLE, 0.1 + 0.5 * smooth(0.18, 0.82, band) + 0.16 * up, x, y, 0.25);
      }
      if (this.underBow(gx, z)) c = hash2(x >> 1, y, 713) > 0.75 ? R.near[1]! : tone(F.stone, 0.05 + 0.2 * band, x, y, 0);
      this.put(x, y, c);
    }
    sea.paint(this.brush(), this.seaGround(), this.seaOptions(), 0);
    this.calm();
    if (this.hour.night) this.moonSea();
    this.live.settle();
  }

  /**
   * Takes the ordered dither out of the open water (the kit's sea mixes two neighbours of its run in a chessboard where
   * a band shades into the next; with no grain over it that shows as a pattern, and what lies behind
   * is smooth): a chessboard of two tones becomes short level dashes of the one or the other, and a lone dot of one tone
   * in the other goes. As the harbour does (`portPicture.ts`).
   */
  private calm(): void {
    const { w, h } = this;
    const place = new Map(F.sea.map((c, k) => [c, k]));
    const was = this.px.slice();
    const at = (x: number, y: number): number | undefined => (x < 0 || y < 0 || x >= w || y >= h ? undefined : place.get(was[y * w + x]!));
    for (let y = this.hz + 1; y < h; y++) for (let x = 0; x < w; x++) {
      const k = at(x, y);
      if (k === undefined || this.kind[y * w + x] !== 1) continue;
      const beside = [at(x - 1, y), at(x + 1, y), at(x, y - 1), at(x, y + 1)];
      const j = beside.find((n) => n !== undefined && Math.abs(n - k) === 1);
      if (j === undefined || beside.filter((n) => n === j).length < 3) continue;
      const own = [at(x - 1, y - 1), at(x + 1, y - 1), at(x - 1, y + 1), at(x + 1, y + 1)].filter((n) => n === k).length;
      // a chessboard: both its tones stay, in dashes four long that do not stack into columns; a lone dot takes the tone round it
      const dash = (x + Math.floor(hash2(y, 3, 791) * 4)) >> 2;
      const to = own >= 3 ? (hash2(dash, y, 792) > 0.5 ? Math.max(j, k) : Math.min(j, k)) : j;
      this.px[y * w + x] = F.sea[to]!;
    }
  }

  /**
   * The night's sea is navy, not black, and the moon lays a path on it (the 1991 nights reach from near black to a
   * moonlit plane; art review 1 found this sea a murk): every tone of the open water is lifted a little up its run, and
   * under the moon a wedge of level bars, widening toward the shore, is lifted further, its middle most. Whole bars of
   * one tone, ragged at their ends: no dither, so the water stays smooth.
   */
  private moonSea(): void {
    const { w, h, hz } = this;
    const place = new Map(F.sea.map((c, k) => [c, k]));
    const top = F.sea.length - 1;
    for (let y = hz + 1; y < h; y++) {
      const down = y - hz;
      const half = 7 + down * 1.25, bar = hash2(y, 1, 795);
      const l = MOON.x - half * (0.55 + 0.45 * hash2(y, 2, 796)), r = MOON.x + half * (0.55 + 0.45 * hash2(y, 3, 797));
      for (let x = 0; x < w; x++) {
        const i = y * w + x;
        if (this.kind[i] !== 1) continue;
        const k = place.get(this.px[i]!);
        if (k === undefined) continue;
        // the far water under the horizon keeps a darker band, as the day's does
        let lift = down < 5 ? 1 : 2;
        if (x >= l && x <= r && bar > 0.22) {
          const mid = Math.abs(x - MOON.x) / half;
          lift += mid < 0.22 + 0.1 * hash2(y, 4, 798) ? 5 : mid < 0.5 ? 3 : 2;
        }
        this.px[i] = F.sea[Math.min(top, k + lift)]!;
      }
    }
  }

  /** What stands in the water as the picture shows it: the boulders, and the piles under the bow where they stand in it. */
  private standing(): readonly SeaStand[] {
    if (this.stands) return this.stands;
    const out: SeaStand[] = [];
    for (const r of TERRACE_ROCKS) {
      const p = terraceProject(r.x, 0, r.z);
      if (r.z > this.edge(p.x) + 0.2 && p.x > -40 && p.x < this.w + 40) out.push({ x: p.x, y: p.y, r: Math.max(2, (LENS * r.r) / r.z), leg: false });
    }
    for (const pile of this.piles()) if (pile.wet) {
      const p = terraceProject(pile.x, 0, pile.z);
      out.push({ x: p.x, y: p.y, r: Math.max(1, (LENS * 0.11) / pile.z), leg: true });
    }
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
        if (x < 0 || y <= hz || x >= w || y >= h) return null;
        const i = y * w + x;
        if (this.kind[i] !== 1) return null;
        const z = this.ahead[i]!;
        return { shore: -this.inland[i]!, gx: ((x + 0.5 - w / 2) * z) / LENS, gz: z };
      },
      // at night a broad plane of the sea under the moon catches its light, in flat bands with ragged edges along the swell
      moon: (x, y) => {
        const depth = y - hz, wobble = 10 * (fbm(x / 30, depth / 5, 2, 715) - 0.5);
        return smooth(MOON.x - 110, MOON.x - 50, x + wobble * 2) * smooth(MOON.x + 110, MOON.x + 50, x - wobble * 2) * smooth(3, 10, depth + wobble);
      },
    };
  }

  private seaOptions(): SeaOptions {
    return optionsOf(sea, undefined, { band: 22, way: TERRACE_WAY });
  }

  /** The pale bands round the boulders and the piles (`water/rings`) and the dark reflections under the piles (`water/reflection`). */
  private seaBands(): void {
    const brush = this.brush();
    rings.paint(brush, this.seaGround(), this.seaOptions(), 0);
    for (const o of this.standing()) if (o.leg) reflection.paint(brush, o.x, o.y, optionsOf(reflection, undefined, { r: o.r, way: TERRACE_WAY }), Math.round(o.x * 7 + o.y * 3));
  }

  /** Glints where the light lies on the water, and the surf along the shingle: recorded for live water (`paint/live.ts`), lit as the game runs. */
  private seaLights(): void {
    const { w, h, hz, hour } = this;
    if (hour.glint >= 0) for (let gy = hz + 2; gy < hz + 60; gy++) for (let gx = Math.max(0, hour.glint - 110); gx < Math.min(w, hour.glint + 110); gx++) {
      if (this.kind[gy * w + gx] !== 1) continue;
      const near = Math.exp(-(((gx - hour.glint) / (14 + (gy - hz) * 1.5)) ** 2));
      // a level dash of light now and then, each flashing on its own beat as the game runs
      if ((gy - hz) % 3 === 0 && hash2(gx >> 2, gy, 757) > 1 - (hour.night ? 0.32 : 0.2) * near) {
        this.live.glint(gx, gy, hour.night ? R.moon[0]! : hour.warm !== 0 ? R.cloud[0]! : R.foam, hash2(gx >> 2, gy, 763));
      }
    }
    // a boat far out
    for (let k = 0; k < 5; k++) this.put(410 + k, hz + 4, R.shingle[3]!);
    for (let k = 0; k < 2; k++) this.put(412 + k, hz + 3, R.stone[1]!);
    for (let k = 0; k < 7; k++) this.live.glint(404 + k - (k >> 1), hz + 5, R.foam, hash2(k, 0, 764));
    // the surf: a white line at the water's edge and a broken one further out, coming and going as the game runs
    for (let x = 0; x < w; x++) {
      let y = hz + 1;
      while (y < h && this.kind[y * w + x] === 1) y++;
      if (y > hz + 2 && y < h) this.live.surf(x, y - 1);
    }
  }

  /** Pebbles on the shingle, far to near: each a lump of a few flat tones, light on top and dark under, bigger near the viewer (the kit's). */
  private pebbles(): void {
    const brush = this.brush();
    const stones: { x: number; z: number; y: number; r: number; seed: number }[] = [];
    for (let gz = 5; gz < 46; gz += 0.5) for (let gx = -22; gx < 30; gx += 0.5) {
      const kx = Math.round(gx * 10), kz = Math.round(gz * 10);
      const pick = hash2(kx, kz, 720);
      if (pick < 0.46) continue;
      const x = gx + hash2(kx, kz, 721) * 0.5, z = gz + hash2(kx, kz, 722) * 0.5;
      const px = this.w / 2 + (LENS * x) / z;
      if (px < -8 || px > this.w + 8) continue;
      const inland = this.edge(px) - z;
      // on the beach, thinning out up the bank where the grass begins
      if (inland < 0.3 || (inland > TERRACE_LAND.beach * 0.8 && pick < 0.74)) continue;
      const r = (0.08 + 0.16 * hash2(kx, kz, 723) ** 2) * (pick > 0.95 ? 2.3 : 1);
      stones.push({ x, z, y: terraceGroundAt(this.shore, x, z), r, seed: pick });
    }
    stones.sort((a, b) => b.z - a.z);
    for (const s of stones) {
      const p = terraceProject(s.x, s.y, s.z);
      const rx = (LENS * s.r) / s.z;
      if (rx < 0.8) continue;
      const kind = hash2(Math.round(s.seed * 1e4), 1, 724);
      const tones = this.underBow(s.x, s.z) ? 'dark' : kind > 0.86 ? 'brown' : kind > 0.6 ? 'stone' : 'shingle';
      pebble.paint(brush, p.x, p.y - rx * 0.3 + rx * pebble.options.flat, optionsOf(pebble, undefined, { r: rx, tones }), Math.round(s.seed * 1e4));
    }
  }

  /** A boulder of the plan (metres), in the water or on the shingle (the kit's `stones/boulder`). */
  private rock(x: number, z: number, r: number): void {
    const wet = z > this.edge(this.w / 2 + (LENS * x) / z);
    const y = wet ? 0 : terraceGroundAt(this.shore, x, z);
    const p = terraceProject(x, y, z), top = terraceProject(x, y + r * 0.8, z);
    boulder.paint(this.brush(), p.x, Math.round(p.y), optionsOf(boulder, undefined, { wide: (LENS * r) / z, high: Math.max(2, p.y - top.y), wet, dark: 0 }), Math.round(x * 13 + z * 7));
  }

  /** Dry grass and sea kale growing out of the shingle up the bank: tufts of a few blades, gold, now and then green. */
  private tufts(): void {
    const all: { x: number; z: number; seed: number }[] = [];
    for (let n = 0; n < 240; n++) {
      const x = -20 + hash2(n, 1, 730) * 52, z = 4.6 + hash2(n, 2, 731) ** 1.8 * 42;
      const px = this.w / 2 + (LENS * x) / z;
      if (px < -10 || px > this.w + 10) continue;
      const inland = this.edge(px) - z;
      if (inland < 5 + 4 * hash2(n, 5, 734) || this.underBow(x, z)) continue;
      // none under the boards, and only a few close under the deck's edge, so their tips are blades and not a band
      const on = deckOf(x, z);
      if (on.u > DECK.u0 - 0.3 && on.u < DECK.u1 + 0.3 && (on.v < DECK.v1 + 0.15 || (on.v < DECK.v1 + 1.6 && hash2(n, 6, 736) > 0.3))) continue;
      all.push({ x, z, seed: n });
    }
    all.sort((a, b) => b.z - a.z);
    for (const { x, z, seed: n } of all) {
      const foot = terraceProject(x, terraceGroundAt(this.shore, x, z), z);
      const tall = (LENS * (0.28 + 0.4 * hash2(n, 3, 732))) / z;
      if (tall < 2) continue;
      const kale = hash2(n, 4, 733) > 0.8;
      const blades = tall > 14 ? 7 : 5;
      for (let b = 0; b < blades; b++) {
        const u = (b + 0.5) / blades - 0.5;
        const high = tall * (0.6 + 0.4 * hash2(n, b, 735));
        // they lean the wind's way
        const tip = TERRACE_WAY * 0.22 * high;
        for (let i = 0; i <= high; i++) {
          const t = i / high;
          const c = kale ? (t < 0.3 ? R.bush[1]! : t < 0.75 ? R.bush[2]! : R.bush[3]!) : t < 0.3 ? R.dry[0]! : t < 0.75 ? R.dry[1]! : R.dry[2]!;
          this.put(foot.x + u * tall * 0.5 * (0.3 + t) + tip * t * t, foot.y - i, c);
        }
      }
    }
  }

  /**
   * The thicket of dog rose beyond the deck's far end, closing the picture's right side (the kit's `bushes/rose`, which
   * banks against a left side: laid mirrored).
   */
  private thicket(): void {
    const { w } = this;
    const mirrored: KitBrush = { ...this.brush(), put: (x, y, c) => this.put(w - 1 - x, y, c), side: -this.hour.side };
    delete mirrored.under;
    delete mirrored.live;
    rose.paint(mirrored, 58, 170, optionsOf(rose, 'low', { wide: 150, high: 96, lumps: 12, deep: 60 }), 7);
  }

  // ---- lines, poles and faces of the plan

  /** A straight line between two points of the picture. */
  private line(a: Pt, b: Pt, c: number): void {
    const n = Math.max(1, Math.ceil(Math.max(Math.abs(b.x - a.x), Math.abs(b.y - a.y))));
    for (let k = 0; k <= n; k++) this.put(a.x + ((b.x - a.x) * k) / n, a.y + ((b.y - a.y) * k) / n, c);
  }

  /** A straight line between two points of the plan. */
  private line3(a: P3, b: P3, c: number): void {
    this.line(this.at(a), this.at(b), c);
  }

  /** A quad of the plan filled with a colour for each pixel. */
  private quad(pts: readonly P3[], colour: (x: number, y: number) => number): void {
    fillQuad((x, y, c) => this.put(x, y, c), pts.map((p) => this.at(p)), this.w, this.h, colour);
  }

  /**
   * A flat face of the plan from `o` along `a` and `b`, painted point by point: `colour` takes how far along each (0 to
   * 1) and gives a colour, or -1 for a hole.
   */
  private face(o: P3, a: P3, b: P3, colour: (s: number, t: number, x: number, y: number) => number): void {
    const p0 = this.at(o), pa = this.at(add(o, a)), pb = this.at(add(o, b)), pc = this.at(add(add(o, a), b));
    const na = Math.ceil(Math.max(Math.hypot(pa.x - p0.x, pa.y - p0.y), Math.hypot(pc.x - pb.x, pc.y - pb.y)) * 1.5) + 1;
    const nb = Math.ceil(Math.max(Math.hypot(pb.x - p0.x, pb.y - p0.y), Math.hypot(pc.x - pa.x, pc.y - pa.y)) * 1.5) + 1;
    for (let i = 0; i <= na; i++) for (let j = 0; j <= nb; j++) {
      const s = i / na, t = j / nb;
      const p = this.at([o[0] + a[0] * s + b[0] * t, o[1] + a[1] * s + b[1] * t, o[2] + a[2] * s + b[2] * t]);
      const c = colour(s, t, Math.round(p.x), Math.round(p.y));
      if (c >= 0) this.put(p.x, p.y, c);
    }
  }

  /**
   * A pole between two points of the plan, `thick` metres at `a` thinning to `thin` at `b`, in four tones dark to
   * light: one that stands is lit on the light's side, one that lies is lit along its top. `bow` bends its middle
   * sideways (metres), since nothing here is straight.
   */
  private pole(a: P3, b: P3, thick: number, tones: Four, thin = thick, bow = 0): void {
    const side = this.hour.side;
    const pa = this.at(a), pb = this.at(b);
    const lies = Math.abs(pb.x - pa.x) > Math.abs(pb.y - pa.y);
    const steps = Math.max(2, Math.ceil(Math.hypot(pb.x - pa.x, pb.y - pa.y) * 1.4));
    for (let k = 0; k <= steps; k++) {
      const t = k / steps;
      const q = mix(a, b, t);
      const p = this.at([q[0] + bow * Math.sin(Math.PI * t), q[1], q[2]]);
      const wide = Math.max(1, Math.round((LENS * (thick + (thin - thick) * t)) / p.far));
      for (let s = 0; s < wide; s++) {
        const u = wide === 1 ? 0 : (s + 0.5) / wide - 0.5;
        if (lies) this.put(p.x, p.y - wide / 2 + s + 0.5, wide === 1 ? tones[2] : u < -0.2 ? tones[3] : u > 0.2 ? tones[1] : tones[2]);
        else this.put(p.x - wide / 2 + s + 0.5, p.y, wide === 1 ? tones[2] : u * side > 0.15 ? tones[3] : u * side < -0.2 ? tones[1] : tones[2]);
      }
    }
  }

  /** A rope that sags between two points of the plan, in the dry stalk's colours; `thick` rows of it. */
  private rope(a: P3, b: P3, sag: number, thick = 1): void {
    const pa = this.at(a), pb = this.at(b);
    const n = Math.max(8, Math.ceil(Math.hypot(pb.x - pa.x, pb.y - pa.y) * 1.3));
    for (let k = 0; k <= n; k++) {
      const t = k / n;
      const q = this.at([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t - sag * 4 * t * (1 - t), a[2] + (b[2] - a[2]) * t]);
      for (let s = 0; s < thick; s++) this.put(q.x, q.y + s, (k + s) % 7 < 2 ? R.dry[0]! : s > 0 ? R.earth[1]! : R.dry[1]!);
    }
  }

  /**
   * A leg or a post (the kit's `wood/post`, after the Phatt dock): a thick crooked pole from `y0` up to `y1` metres at
   * (`x`, `z`), leaning its own way, seen through the terrace's lens; its cut top shows when `cap`. In the water only
   * what stands above it is drawn and the water laps round its foot.
   */
  private leg(x: number, z: number, y0: number, y1: number, thick: number, seed: number, wetFoot: boolean, cap: boolean): void {
    const lx = (hash2(seed, 1, 740) - 0.5) * 0.5, lz = (hash2(seed, 2, 741) - 0.5) * 0.3, bend = (hash2(seed, 3, 742) - 0.5) * 0.2;
    const n = 60, steps: PostStep[] = [];
    let top = { x: 0, y: 0, wide: 0 };
    for (let k = 0; k < n; k++) {
      const t = k / n, t2 = (k + 1) / n;
      const Y = y0 + (y1 - y0) * t;
      const a = terraceProject(x + lx * t + bend * Math.sin(t * Math.PI), Y, z + lz * t);
      const b = terraceProject(x + lx * t2 + bend * Math.sin(t2 * Math.PI), y0 + (y1 - y0) * t2, z + lz * t2);
      const wide = Math.max(1, (LENS * thick * (1 - 0.15 * t)) / a.far);
      top = { x: b.x, y: b.y, wide };
      steps.push({ x: a.x, top: Math.min(a.y, b.y), bottom: Math.max(a.y, b.y), wide, up: wetFoot ? Y : 1 });
    }
    const foot = terraceProject(x, Math.max(0, y0), z);
    post.paint(this.brush(), foot.x, foot.y, optionsOf(post, undefined, { thick: (LENS * thick) / foot.far, cap, water: wetFoot, spine: { steps, top } }), seed);
  }

  /**
   * A shadow on the boards (the thing numbered `only`) round a point of the deck's frame, thrown away from the light:
   * a flat round patch, `ru` and `rv` its half sizes (metres), the boards' own colours a few places down their run.
   */
  private shadowAt(u: number, v: number, ru: number, rv: number, only: number): void {
    const { w, h, px, owner } = this;
    const thrown = -this.hour.side * 0.3;
    const near = this.at(onDeck(u, v)), step = Math.max(0.004, 0.5 / ((LENS / near.far) * 1.5));
    for (let du = -ru; du <= ru; du += step) for (let dv = -rv; dv <= rv; dv += step) {
      if ((du / ru) ** 2 + (dv / rv) ** 2 > 1 + 0.25 * (hash2(Math.round(du * 9), Math.round(dv * 9), 743) - 0.5)) continue;
      const p = this.at(onDeck(u + du + thrown, v + dv + 0.12));
      const x = Math.round(p.x), y = Math.round(p.y);
      if (x < 0 || y < 0 || x >= w || y >= h) continue;
      const i = y * w + x;
      if (owner[i] !== only || this.shaded[i]) continue;
      this.shaded[i] = 1;
      px[i] = this.shadeOf.get(px[i]!) ?? px[i]!;
    }
  }

  // ---- the reach over the beach: a walk of boards on piles, a step under the deck, out to a head by the water

  /** A point over the floor being furnished: the deck's boards, or the reach's a step lower (`base`). */
  private floor(u: number, v: number, up = 0): P3 {
    return onDeck(u, v, up + this.base);
  }

  /** The piles under the reach, a row across it every few metres and three rows under the head: each its place on the plan, its top, and whether it stands in the water. */
  private piles(): { x: number; z: number; top: number; wet: boolean; seed: number; row: number }[] {
    const walk = [REACH.u0 + 0.3, REACH.u1 - 0.3], head = [REACH.head.u0 + 0.3, 3.1, 5.6, REACH.head.u1 - 0.3];
    const rows: (readonly [number, readonly number[]])[] = [[2.4, walk], [4.8, walk], [7.2, walk], [REACH.long + 0.4, head], [REACH.long + REACH.deep / 2, head], [REACH.long + REACH.deep - 0.4, head]];
    return rows.flatMap(([t, us], row) => us.map((u, k) => {
      const [x, , z] = onReach(u + 0.2 * (hash2(row, k, 801) - 0.5), t + 0.3 * (hash2(row, k, 802) - 0.5));
      return { x, z, top: DECK.y - REACH.drop - 0.1, wet: z > this.edge(this.w / 2 + (LENS * x) / z), seed: 800 + row * 11 + k * 7, row };
    }));
  }

  /** The piles, far to near, each row tied pile to pile where it stands tall enough to show it. */
  private pilework(): void {
    const piles = this.piles();
    const foot = (p: { x: number; z: number; wet: boolean }): number => (p.wet ? 0 : terraceGroundAt(this.shore, p.x, p.z));
    for (let row = Math.max(...piles.map((p) => p.row)); row >= 0; row--) {
      const mine = piles.filter((p) => p.row === row);
      this.as(() => {
        for (let k = 0; k + 1 < mine.length; k++) {
          const a = mine[k]!, b = mine[k + 1]!;
          if (a.top - foot(a) < 0.7) continue;
          const from = k % 2 ? a : b, to = k % 2 ? b : a;
          // a level tie from pile to pile, a little askew: never a diagonal, which reads as a stair down to the shingle
          // (art review 3; no way down)
          const high = Math.max(foot(a), foot(b)) + 0.45;
          for (const d of [0, 0.06]) this.line3([from.x, high + 0.08 - d, from.z], [to.x, high - 0.04 - d, to.z], d ? R.wood[0]! : R.wood[1]!);
        }
      });
      for (const pile of mine.sort((a, b) => b.z - a.z)) this.as(() => this.leg(pile.x, pile.z, pile.wet ? -0.3 : foot(pile) - 0.1, pile.top, 0.22, pile.seed, pile.wet, false));
    }
  }

  /**
   * The reach's boards, laid across it and gone grey in the weather, far to near: no two the same length (their ends
   * stick out a hand more or less), each a little askew, and one in ten a new board still in the wood's own colour.
   * Under their near ends runs the beam they are nailed to, and the head's near side shows its own.
   */
  private reachDeck(): void {
    const grey: KitBrush = { ...this.brush(), run: { ...R, wood: GREY.run }, fine: { ...F, wood: GREY.fine } };
    const fresh = this.brush();
    const end = REACH.long + REACH.deep, wide = 0.42, { head } = REACH;
    const at = (u: number, t: number): Pt => this.at(onReach(u, t));
    const beam = (o: P3, along: P3): void => this.face(add(o, [0, -0.26, 0]), [0, 0.22, 0], along, (s, _t, x, y) => (s > 0.82 ? R.wood[0]! : hash2(x >> 2, y, 815) > 0.85 ? R.wood[2]! : R.wood[1]!));
    const span = (a: P3, b: P3): P3 => [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
    // the beams that show: the head's seaward-left side and its near side either side of the walk, then the walk's left side
    beam(onReach(head.u0, REACH.long), span(onReach(head.u0, REACH.long), onReach(head.u0, end)));
    beam(onReach(head.u0, REACH.long), span(onReach(head.u0, REACH.long), onReach(REACH.u0, REACH.long)));
    beam(onReach(REACH.u1, REACH.long), span(onReach(REACH.u1, REACH.long), onReach(head.u1, REACH.long)));
    beam(onReach(REACH.u0, 0), span(onReach(REACH.u0, 0), onReach(REACH.u0, REACH.long)));
    const n = Math.ceil(end / wide);
    for (let i = n - 1; i >= 0; i--) {
      const t0 = i * wide, t1 = Math.min(end, t0 + wide);
      const { u0, u1 } = reachSides((t0 + t1) / 2);
      const ua = u0 - 0.03 - 0.16 * hash2(i, 1, 810), ub = u1 + 0.03 + 0.16 * hash2(i, 2, 810), skew = 0.07 * (hash2(i, 3, 810) - 0.5);
      const c0 = at(ua, t0 - skew), c1 = at(ua, t1 - skew), c2 = at(ub, t1 + skew), c3 = at(ub, t0 + skew);
      const isNew = hash2(i, 4, 810) > 0.9;
      const plank: Plank = { i: 300 + i, corners: [c0, c1, c2, c3], ends: [c0.x, c3.x], edge: [c1, c2], tall: Math.abs(c0.y - c1.y) };
      planks.paint(isNew ? fresh : grey, { width: this.w, height: this.h, planks: [plank] }, isNew ? WORN_TONES : planks.options, 0);
      // the gap before it, where it is broad enough to show one
      if (Math.abs(c0.y - c1.y) > 1.6) this.line(c0, c3, isNew ? R.wood[0]! : R.stone[0]!);
    }
    // the deck's edge over the step down to the walk: a dark line under a pale nosing
    this.line(this.at(onDeck(REACH.u0 - 0.1, DECK.v1 + 0.04)), this.at(onDeck(REACH.u1 + 0.1, DECK.v1 + 0.04)), R.wood[0]!);
  }

  /**
   * A wooden handrail from foot to foot (make the handrails out of wood, as they were
   * too thin and looked as if you could fall down): a stout post at each foot, a broad handrail gone silver along their
   * heads and a board under it (two boards made a lattice that hid the walk, art review 4), none quite level and no post quite upright. `to` continues the rails to a point where
   * another thing's post takes them (a corner of the watchtower). Returns the posts' heads.
   */
  private woodRail(feet: readonly P3[], seed: number, to?: P3): P3[] {
    const posts = feet.map((foot, k) => {
      const lean = (hash2(seed + k, 1, 840) - 0.5) * 0.2, high = RAIL + 0.16 * (hash2(seed + k, 2, 841) - 0.4);
      return { foot, head: add(foot, [lean, high, 0]) };
    });
    const ends = to ? [...posts, { foot: to, head: add(to, [0, RAIL, 0]) }] : posts;
    this.as(() => {
      // the boards between the posts, the handrail last, then the posts over their ends
      for (const [part, thick, tones] of [[0.52, 0.09, WOOD4], [0.98, 0.14, SILVER4]] as const) for (let k = 0; k + 1 < ends.length; k++) {
        const a = ends[k]!, b = ends[k + 1]!;
        this.pole(mix(a.foot, a.head, part), mix(b.foot, b.head, part), thick, tones);
      }
      posts.forEach(({ foot, head }, k) => {
        this.pole(foot, add(head, [0, 0.1, 0]), 0.16, WOOD4, 0.14, (hash2(seed + k, 3, 842) - 0.5) * 0.08);
        // its head cut to a point
        const top = this.at(add(head, [0, 0.1, 0]));
        this.put(top.x, top.y - 1, R.wood[3]!);
      });
    });
    return posts.map((post) => post.head);
  }

  /** The rail's feet along the walk or the head (`u`, and `t` metres out), on the walk's boards. */
  private static reachFeet(at: readonly (readonly [number, number])[]): P3[] {
    return at.map(([u, t]) => onReach(u, t));
  }

  /**
   * The watchtower on the head's seaward corner (a roofed section, perhaps a small watchtower
   * that goes up to the second floor with a static long-eye to scan the horizon): four crooked posts, a floor a storey up with a
   * boarded parapet and a ladder to it, a long brass spyglass fixed on a post there, and a thatched roof with a staff
   * for the pennant; a bench in its shade below. Painted back to front.
   */
  private tower(): void {
    const T = TOWER, side = this.hour.side;
    const lean: Record<string, number> = { '00': -0.05, '10': 0.07, '01': 0.04, '11': -0.06 };
    const post = (a: number, b: number): void => this.pole(onTower(a, b), add(onTower(a, b, T.eave), [lean[`${a}${b}`]!, 0, 0]), 0.2, SILVER4, 0.17, lean[`${a}${b}`]! * 1.5);
    const span = (a: P3, b: P3): P3 => [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
    const boards = (base: number, seed: number) => (s: number, t: number, x: number, y: number): number => (Math.abs(((s * 7) % 1) - 0.5) > 0.42 || t < 0.08 ? R.stone[0]! : tone(GREY.fine, base + 0.12 * (hash2(Math.floor(s * 7), seed, 880) - 0.5) + 0.05 * (hash2(x >> 1, y, 881) - 0.5), x, y, 0));
    // the far posts, and a cross of braces between them
    post(1, 1);
    post(0, 1);
    this.line3(onTower(0, 1, 0.25), onTower(1, 1, T.floor - 0.3), R.stone[1]!);
    this.line3(onTower(1, 1, 0.25), onTower(0, 1, T.floor - 0.3), R.stone[1]!);
    // the bench in the tower's shade, its back to the sea
    this.base = -REACH.drop;
    this.bench(T.u0 + 0.3, DECK.v1 + T.t1 - 0.35, [1, 0], [0, -1], T.u1 - T.u0 - 0.6, true, 4);
    this.base = 0;
    // the floor a storey up: its underside dark, the beams that carry it on the two near sides
    this.quad([onTower(-0.06, -0.06, T.floor), onTower(1.06, -0.06, T.floor), onTower(1.06, 1.06, T.floor), onTower(-0.06, 1.06, T.floor)], () => R.wood[0]!);
    // the far parapet, seen over the near one
    this.face(onTower(0, 1, T.floor), span(onTower(0, 1), onTower(1, 1)), [0, T.rail, 0], boards(0.3, 3));
    // the long-eye on its post: a long brass tube, broad at its far end, pointing out along the horizon
    const pivot = onTower(LONG_EYE.a, LONG_EYE.b, T.floor + LONG_EYE.high);
    const out = (m: number, up: number): P3 => [pivot[0] + LONG_EYE.aim.x * m, pivot[1] + up, pivot[2] + LONG_EYE.aim.z * m];
    this.pole(onTower(LONG_EYE.a, LONG_EYE.b, T.floor), add(pivot, [0, -0.08, 0]), 0.1, DARK4);
    const brass: Four = [R.earth[0]!, R.earth[1]!, R.dry[1]!, R.dry[3]!];
    const eye = out(-LONG_EYE.long * 0.2, -0.06), far = out(LONG_EYE.long * 0.8, 0.14);
    // a thin tube, a dark line under it, so the brass stands off the sky: a spyglass, not a beam of the roof (art review 4)
    this.pole(add(eye, [0, -0.07, 0]), add(far, [0, -0.09, 0]), 0.09, [R.ink, R.ink, R.ink, R.ink], 0.15);
    this.pole(eye, far, 0.09, brass, 0.15);
    const pe = this.at(eye), pf = this.at(far), ring = this.at(mix(eye, far, 0.42));
    for (let dy = -2; dy <= 2; dy++) { this.put(pf.x, pf.y + dy, R.dry[3]!); this.put(pf.x + 1, pf.y + dy, R.earth[0]!); this.put(pf.x - 1, pf.y + dy, R.ink); }
    for (let dy = -1; dy <= 1; dy++) { this.put(pe.x, pe.y + dy, R.ink); this.put(ring.x, ring.y + dy, R.earth[0]!); }
    // the near posts, the near parapet between them (a gap at the ladder's head), the handrail over it
    post(1, 0);
    post(0, 0);
    this.face(onTower(0, 0, T.floor - 0.2), span(onTower(0, 0), onTower(1, 0)), [0, 0.2, 0], (s, _t, x, y) => (s < 0.02 || s > 0.98 ? R.stone[0]! : tone(GREY.fine, 0.3 + 0.06 * hash2(x >> 2, y, 882), x, y, 0)));
    this.face(onTower(0, 0, T.floor), span(onTower(0, 0), onTower(0.62, 0)), [0, T.rail * 0.72, 0], boards(side < 0 ? 0.62 : 0.5, 5));
    this.face(onTower(0, 0, T.floor - 0.2), span(onTower(0, 0), onTower(0, 1)), [0, 0.2 + T.rail * 0.72, 0], boards(side < 0 ? 0.42 : 0.6, 7));
    this.pole(onTower(-0.04, 0, T.floor + T.rail), onTower(0.64, 0, T.floor + T.rail + 0.04), 0.1, SILVER4);
    this.pole(onTower(0.9, 0, T.floor + T.rail), onTower(1.02, 0, T.floor + T.rail), 0.1, SILVER4);
    // the ladder to the gap in the parapet: two poles and their rungs
    const ladder = (a: number, up: number): P3 => onTower(a, -0.3 * (1 - up / (T.floor + T.rail)), up);
    for (let up = 0.3; up < T.floor; up += 0.34) this.line3(ladder(0.67, up), ladder(0.87, up), R.shingle[2]!);
    for (const a of [0.66, 0.88]) this.pole(ladder(a, 0), ladder(a, T.floor + T.rail), 0.07, SILVER4);
    // the roof: its dark underside, then its thatch from the eave to the peak, row on row, ragged at the eave
    const d = T.over / (T.u1 - T.u0);
    const eave = (a: number, b: number): P3 => onTower(a ? 1 + d : -d, b ? 1 + d : -d, T.eave + 0.1 * (hash2(a, b, 883) - 0.5));
    const peak = onTower(0.5, 0.5, T.peak);
    this.quad([eave(0, 0), eave(1, 0), eave(1, 1), eave(0, 1)], () => R.wood[0]!);
    const thatch = (from: P3, to: P3, base: number, seed: number): void => {
      const pa = this.at(from), pb = this.at(to), pp = this.at(peak);
      const na = Math.ceil(Math.hypot(pb.x - pa.x, pb.y - pa.y) * 1.6) + 2, nt = Math.ceil(Math.max(Math.hypot(pp.x - pa.x, pp.y - pa.y), Math.hypot(pp.x - pb.x, pp.y - pb.y)) * 1.6) + 2;
      for (let i = 0; i <= na; i++) for (let j = 0; j <= nt; j++) {
        const s = i / na, t = j / nt;
        const q = this.at(mix(mix(from, to, s), peak, t));
        // rows of reed, each darker under the row above it; the lowest hangs a ragged fringe over the eave
        const row = t * 5 + 0.25 * hash2(Math.round(q.x) >> 1, seed, 884);
        const under = row % 1 < 0.22;
        this.put(q.x, q.y, under ? R.dry[0]! : tone(F.dry, base + 0.16 * (row % 1) + 0.07 * (hash2(Math.round(q.x), Math.round(q.y) >> 1, 885) - 0.5), Math.round(q.x), Math.round(q.y), 0));
        if (j === 0 && hash2(Math.round(q.x), seed, 886) > 0.45) this.put(q.x, q.y + 1, R.dry[1]!);
      }
    };
    thatch(eave(0, 1), eave(0, 0), side < 0 ? 0.56 : 0.34, 11);
    thatch(eave(0, 0), eave(1, 0), side < 0 ? 0.4 : 0.58, 12);
    // a wooden cap on the peak and the pennant's staff
    const cap = this.at(peak);
    for (let dy = -2; dy <= 1; dy++) for (let dx = -2 - dy; dx <= 2 + dy; dx++) this.put(cap.x + dx, cap.y + dy, dy < 0 ? R.wood[2]! : R.wood[1]!);
    this.pole(peak, add(peak, [0, T.staff + 0.12, 0]), 0.05, DARK4);
    // the lantern on an arm at the corner toward the walk, a brace under the arm
    const hook = lampHook(), arm = add(hook, [0, 0.42, 0]), root = add(onTower(1, 0, T.eave - 0.3), [lean['10']!, 0, 0]);
    this.pole(root, add(arm, [0, 0.04, 0]), 0.08, SILVER4, 0.06);
    this.line3(add(root, [0, -0.5, 0]), mix(root, arm, 0.6), R.stone[1]!);
    const at = this.plan.lamp;
    this.line(this.at(arm), { x: at.x, y: at.y - 1 }, R.ink);
    // the docks' own lantern, one upright bar: with a bar across too its lit panes read as a face (art review 4)
    lantern.paint(this.brush(), at.x, at.y, optionsOf(lantern), 0);
  }

  /**
   * A torch of the plaza (add torches during the night, as the terrace is like the village plaza and not
   * just a random place): a crooked pole lashed to a rail's post, its head a fat bundle of tarred rag bound with
   * cord, charred dark. By day it stands unlit; its flame and its light are a layer of their own (`torches`).
   */
  private torch(k: number): void {
    const torch = TORCHES[k]!, kind = k % 3;
    // no two alike (art review 5: seven of one make a fence): a fat bundle, an iron cup on a thin neck, a long thin bundle
    const long = kind === 2 ? 0.52 : kind === 1 ? 0.26 : 0.36;
    const foot = onTorch(torch), neck = onTorch(torch, torch.high - long), head = onTorch(torch, torch.high);
    this.pole(foot, neck, kind === 1 ? 0.09 : 0.11, WOOD4, kind === 1 ? 0.07 : 0.09, (hash2(k, 1, 861) - 0.5) * 0.07);
    // two lashings to the rail's post
    for (const up of [0.55, 0.85]) {
      const p = this.at(onTorch(torch, up)), wide = Math.max(1, Math.round((LENS * 0.13) / p.far));
      for (let dx = -Math.ceil(wide / 2); dx <= Math.ceil(wide / 2); dx++) this.put(p.x + dx, p.y, R.dry[2]!);
    }
    const across = (up: number, wide: number, c: number): void => {
      const p = this.at(onTorch(torch, up)), half = Math.floor(Math.round((LENS * wide) / p.far) / 2);
      if (half >= 1) for (let dx = -half; dx <= half; dx++) this.put(p.x + dx, p.y, c);
    };
    if (kind === 1) {
      this.pole(neck, head, 0.1, IRON4, 0.3);
      across(torch.high, 0.32, R.stone[2]!);
    } else {
      this.pole(neck, head, kind === 2 ? 0.14 : 0.2, CHARRED4, kind === 2 ? 0.19 : 0.25);
      // the cord round the bundle
      for (const down of kind === 2 ? [0.14, 0.36] : [0.2]) across(torch.high - down, kind === 2 ? 0.17 : 0.22, R.dry[1]!);
    }
  }

  /**
   * A string of paper lanterns and small flags from pole to pole (the painter's: a deck dressed for a summer evening):
   * it hangs slack between its fastenings, a flag and a lantern in turn. The lanterns are pale paper by day and glow
   * from dusk on.
   */
  private festoon(points: readonly P3[]): void {
    const lit = lampLit(this.brush());
    let item = 0;
    for (let k = 0; k + 1 < points.length; k++) {
      const a = points[k]!, b = points[k + 1]!;
      const long = Math.hypot(b[0] - a[0], b[2] - a[2]), sag = 0.12 * long;
      const hang = (s: number): P3 => [a[0] + (b[0] - a[0]) * s, a[1] + (b[1] - a[1]) * s - sag * 4 * s * (1 - s), a[2] + (b[2] - a[2]) * s];
      const n = Math.max(8, Math.ceil(long * 14));
      for (let i = 0; i <= n; i++) { const q = this.at(hang(i / n)); this.put(q.x, q.y, R.earth[0]!); }
      const things = Math.max(2, Math.round(long / 0.8));
      for (let i = 1; i < things; i++, item++) {
        const q = this.at(hang(i / things)), x = Math.round(q.x), y = Math.round(q.y);
        if (item % 2) {
          // a flag: red, white and gold in turn
          const run = [F.red, F.hull, F.dry][(item >> 1) % 3]!, size = Math.max(3, Math.round((LENS * 0.3) / q.far));
          for (let dy = 0; dy < size; dy++) for (let dx = -Math.floor((size - dy) / 2); dx <= Math.floor((size - dy - 1) / 2); dx++) this.put(x + dx, y + 1 + dy, tone(run, dx < 0 ? 0.55 : 0.72, x, y, 0));
        } else {
          // a paper lantern: a round of pale paper with a dark cap, lit from inside when the lamps are
          this.paperLantern(x, y, Math.max(1.6, (LENS * 0.13) / q.far), [F.red, F.dry, F.hull][(item >> 1) % 3]!, lit);
          this.put(x, y + 1, R.ink);
        }
      }
    }
  }

  /** One paper lantern of the string, hung at (`x`, `y`): a round of `paper`, or of the embers' light when `lit`. */
  private paperLantern(x: number, y: number, r: number, paper: readonly number[], lit: boolean): void {
    for (let dy = -Math.ceil(r); dy <= Math.ceil(r); dy++) for (let dx = -Math.ceil(r); dx <= Math.ceil(r); dx++) {
      const d = Math.hypot(dx, dy * 0.85) / r;
      if (d > 1) continue;
      this.put(x + dx, y + 2 + Math.ceil(r) + dy, lit ? (d < 0.5 ? F.ember[10]! : d < 0.8 ? F.ember[8]! : F.ember[5]!) : tone(paper, 0.75 - 0.3 * d - 0.15 * (dx / r) * this.hour.side, x, y, 0));
    }
  }

  /** Fishing rods leaning in the head's corner, a float hanging from one (the painter's). */
  private rods(u: number, t: number): void {
    for (const [k, lean] of [[0, -0.5], [1, 0.25]] as const) {
      const foot = onReach(u + 0.18 * k, t), tip = onReach(u + lean + 0.18 * k, t + 0.3, 3.3 - 0.5 * k);
      this.line3(foot, mix(foot, tip, 0.45), R.earth[1]!);
      this.line3(mix(foot, tip, 0.45), tip, R.dry[1]!);
      if (k === 0) {
        const end = this.at(tip);
        for (let d = 1; d < 9; d++) this.put(end.x - 1, end.y + d, R.hull[2]!);
        this.put(end.x - 1, end.y + 9, R.red[2]!);
        this.put(end.x - 1, end.y + 10, R.hull[4]!);
      }
    }
  }

  /** The pennant on the watchtower's staff, painted standing out straight to the left (its hoist at the staff): the game flaps it on the wind (`sway.ts`). */
  pennant(): Blown {
    const wide = 22, high = 9;
    const bitmap = createBitmap(wide, high);
    for (let x = 0; x < wide; x++) {
      // its hoist is its right end; it tapers to a swallow tail
      const from = (wide - 1 - x) / (wide - 1), half = 4 - 2.4 * from;
      for (let y = 0; y < high; y++) {
        const d = y - 4;
        if (Math.abs(d) > half) continue;
        if (from > 0.72 && Math.abs(d) < (from - 0.72) * 9) continue;
        // plain red, darker along its lower half: a pennant, no country's flag
        bitmap.pixels[y * wide + x] = d > 1 ? R.red[1]! : d < -1 ? R.red[3]! : R.red[2]!;
      }
    }
    return { kind: 'flag', x: this.plan.pennant.x - wide - 1, y: this.plan.pennant.y - 2, bitmap };
  }

  // ---- the deck and what stands on it

  /**
   * One board lying along the deck's `v` (the kit's `wood/planks`): `near` its two edges across the deck at `va`, where
   * it begins, `far` its two edges at its far end (`fa` on its near edge, `fb` on its far one), so no board need be
   * straight. The dark gap along its far edge and the pale line of its lit edge are drawn here, since the kit lays
   * those for boards that lie across a walk.
   */
  private board(brush: KitBrush, near: readonly [number, number], far: readonly [number, number], va: number, fa: number, fb: number, i: number, gap: number, pale: number, tones: PlanksOptions = planks.options): void {
    const at = (u: number, v: number): Pt => this.at(onDeck(u, v));
    const c0 = at(far[0], fa), c1 = at(far[1], fb), c2 = at(near[1], va), c3 = at(near[0], va);
    const plank: Plank = { i, corners: [c0, c1, c2, c3], ends: [c0.x, c3.x], edge: [c1, c2], tall: 0 };
    planks.paint(brush, { width: this.w, height: this.h, planks: [plank] }, tones, 0);
    // the gap beyond its far edge, and its lit edge a pixel inside it, broken
    this.line(c1, c2, gap);
    const mid = at((near[0] + near[1] + far[0] + far[1]) / 4, (va + fa) / 2), on = at((near[1] + far[1]) / 2, (va + fb) / 2);
    const n = Math.hypot(mid.x - on.x, mid.y - on.y);
    if (n > 2.2) {
      const dx = (mid.x - on.x) / n, dy = (mid.y - on.y) / n;
      const steps = Math.ceil(Math.max(Math.abs(c2.x - c1.x), Math.abs(c2.y - c1.y)));
      for (let k = 0; k <= steps; k++) {
        const x = c1.x + ((c2.x - c1.x) * k) / steps + dx * 1.2, y = c1.y + ((c2.y - c1.y) * k) / steps + dy * 1.2;
        if (hash2(Math.round(x) >> 3, i, 812) > 0.62) this.put(x, y, pale);
      }
    }
    // its butt end toward the eye, and a nail either side of it
    this.line(c2, c3, gap);
    if (n > 3) for (const k of [0.25, 0.75]) {
      const nail = at(near[0] + (near[1] - near[0]) * k, va + 0.12);
      this.put(nail.x, nail.y, gap);
    }
  }

  /**
   * The terrace's boards, far to near: long warm boards running out toward the sea, each strip of two or three end to
   * end, ragged at the seaward edge, and none quite straight: every seam between two strips wanders its own way (the
   * 1991 game's decks are laid by eye).
   */
  private deck(): void {
    const brush = this.brush();
    const turn = (DECK.turn * Math.PI) / 180;
    // how near a strip comes: to the house's wall, or to the picture's foot
    const near = (u: number): number => Math.max(DECK.v0, (NEAR - u * Math.cos(turn)) / Math.sin(turn));
    const count = Math.ceil((DECK.u1 - DECK.u0) / BOARD);
    /** The seam on the near side of strip `k` (counted from the deck's far end), at `v`: it wanders up to a hand's width. */
    const seam = (k: number, v: number): number => {
      const base = DECK.u1 - k * BOARD;
      if (k <= 0 || k >= count) return k <= 0 ? DECK.u1 : DECK.u0;
      return base + 0.07 * (hash2(k, 3, 832) - 0.5) + 0.05 * (hash2(k, 4, 833) - 0.5) * (v / DECK.v1) + 0.025 * Math.sin(v * 1.3 + k * 2.1);
    };
    for (let i = 0; i < count; i++) {
      const ub = DECK.u1 - i * BOARD, ua = Math.max(DECK.u0, ub - BOARD);
      const from = Math.max(near(ua), near(ub));
      const joins = ua > REACH.u0 - 0.2 && ub < REACH.u1 + 0.2;
      const end = DECK.v1 + (joins ? 0 : (hash2(i, 1, 830) - 0.4) * 0.24);
      // one floor: the terrace's boards are oiled red-brown from the house to the step (the real deck's grey half is
      // the walk's here), each strip two or three boards end to end, their joins nowhere in a row
      const cuts = [from, from + (end - from) * (0.3 + 0.16 * (hash2(i, 0, 831) - 0.5)), from + (end - from) * (0.68 + 0.2 * (hash2(i, 1, 831) - 0.5))]
        .filter((c, j) => j === 0 || (c > from + 0.8 && c < end - 0.5));
      for (let j = cuts.length - 1; j >= 0; j--) {
        const va = cuts[j]!, far = j === cuts.length - 1 ? end : cuts[j + 1]!;
        // a board in seven has lost its oil to feet and weather, and lies paler
        const worn = hash2(i, j, 836) > 0.86;
        this.board(brush, [seam(i + 1, va), seam(i, va)], [seam(i + 1, far), seam(i, far)], va, far, far, i * 5 + j, R.wood[0]!, R.wood[3]!, worn ? WORN_TONES : OILED_TONES);
      }
    }
  }

  /** The lifebuoy hung on a post of the rail (the real terrace has one on a post, with a sign): red and white quarters, a rope round it. */
  private lifebuoy(u: number, v: number): void {
    const c = this.at(this.floor(u - 0.05, v - 0.1, 0.52));
    const r = (LENS * 0.31) / c.far, side = this.hour.side;
    for (let dy = -Math.ceil(r); dy <= Math.ceil(r); dy++) for (let dx = -Math.ceil(r); dx <= Math.ceil(r); dx++) {
      const d = Math.hypot(dx, dy);
      if (d > r || d < r * 0.46) continue;
      const turn = Math.floor((Math.atan2(dy, dx) + Math.PI / 8 + Math.PI * 2) / (Math.PI / 4)) % 2;
      const lit = 0.62 - 0.22 * ((dx / r) * -side) - 0.2 * (dy / r);
      this.put(c.x + dx, c.y + dy, turn ? tone(F.red, lit - 0.1, 0, 0, 0) : tone(F.hull, lit + 0.2, 0, 0, 0));
    }
  }

  /**
   * The grill at the deck's far corner: half a barrel on crossed legs (the real terrace's own), a fish on its grate; its
   * coals glow at dusk and night, and the game draws its smoke.
   */
  private grill(): void {
    const foot = this.at(onDeck(GRILL.u, GRILL.v)), top = this.plan.fire;
    const half = (LENS * 0.44) / foot.far, deep = (LENS * 0.3) / foot.far, side = this.hour.side, cy = top.y + 1;
    const lit = lampLit(this.brush());
    // crossed legs
    for (const k of [-1, 1]) for (let s = 0; s < 2; s++) this.line({ x: top.x + k * half * 0.75 + s, y: cy + deep * 0.7 }, { x: top.x - k * half * 0.6 + s, y: foot.y }, s ? R.stone[0]! : R.stone[1]!);
    // the trough: rusty iron, lit on the light's side
    for (let dy = 0; dy <= deep; dy++) {
      const wide = half * Math.sqrt(Math.max(0, 1 - 0.8 * (dy / deep) ** 2));
      for (let dx = -Math.ceil(wide); dx <= Math.ceil(wide); dx++) {
        const u = dx / wide;
        if (Math.abs(u) > 1) continue;
        const rust = fbm((top.x + dx) / 3, (cy + dy) / 2, 2, 860) > 0.6;
        const t = 0.3 + 0.3 * u * side - 0.25 * (dy / deep);
        this.put(top.x + dx, cy + dy, rust ? (t > 0.3 ? R.earth[2]! : R.earth[1]!) : tone(F.stone, clamp01(t), 0, 0, 0));
      }
    }
    // its open top: the coals, then the grate's bars and the fish
    const ry = Math.max(2.5, half * 0.24);
    for (let dy = -Math.ceil(ry); dy <= Math.ceil(ry); dy++) for (let dx = -Math.ceil(half); dx <= Math.ceil(half); dx++) {
      const e = (dx / half) ** 2 + (dy / ry) ** 2;
      if (e > 1) continue;
      const k = hash2(top.x + dx, cy + dy, 861);
      const coal = lit ? (k > 0.7 ? R.ember[4]! : k > 0.35 ? R.ember[2]! : R.ember[1]!) : k > 0.93 ? R.ember[2]! : k > 0.5 ? R.stone[0]! : R.stone[1]!;
      this.put(top.x + dx, cy + dy, e > 0.72 ? (dy < 0 ? R.stone[3]! : R.stone[2]!) : dx % 6 === 0 ? R.stone[0]! : coal);
    }
    const fish: [number, number, number][] = [[-5, 0, R.shingle[2]!], [-4, -1, R.shingle[3]!], [-3, -1, R.shingle[3]!], [-2, -1, R.shingle[3]!], [-1, -1, R.shingle[3]!], [0, -1, R.shingle[2]!], [-4, 0, R.shingle[2]!], [-3, 0, R.stone[2]!], [-2, 0, R.shingle[2]!], [-1, 0, R.stone[2]!], [0, 0, R.shingle[2]!], [1, 0, R.stone[2]!], [2, -1, R.stone[2]!], [2, 1, R.stone[2]!], [3, -1, R.shingle[2]!], [3, 1, R.shingle[2]!], [-4, -1, R.ink]];
    for (const [dx, dy, c] of fish) this.put(top.x + 1 + dx, cy - 1 + dy, c);
  }

  /** A gull in flight, painted white on a back board: whether a point `s` along the board (in gulls) and `t` up it (0 to 1) is in one. */
  private static gull(s: number, t: number): boolean {
    const d = Math.abs((s % 1) - 0.5) / 0.44;
    if (d > 1) return false;
    // long shallow wings, thick at the shoulder and fine at the tip, and a round body under them: a bird, not a letter
    // (art review 1: the first gulls read as "M M")
    if ((d / 0.15) ** 2 + ((t - 0.42) / 0.17) ** 2 < 1) return true;
    const wing = 0.5 + 0.16 * Math.sin(d * Math.PI * 0.8) - 0.12 * d * d;
    return Math.abs(t - wing) < 0.1 * (1.12 - d);
  }

  /**
   * A bench of the terrace (red, with white gulls on its back board, as the real ones): its back stands along the line
   * from (`u`, `v`) for `long` metres the way `along` points (a unit vector of the deck's frame), its seat lies off to
   * `front`; `dark` for one near the viewer, against the light.
   */
  private bench(u: number, v: number, along: readonly [number, number], front: readonly [number, number], long: number, dark: boolean, seed: number): void {
    const run = F.red, low = dark ? 0.1 : 0.3, lit = clamp01(0.55 - 0.3 * this.hour.side);
    const flat = (du: number, dv: number): P3 => add(onDeck(du, dv), [0, -DECK.y, 0]);
    const a = flat(along[0] * long, along[1] * long), f = flat(front[0] * 0.44, front[1] * 0.44);
    const at = (s: number, d: number, up: number): P3 => this.floor(u + along[0] * s + front[0] * d, v + along[1] * s + front[1] * d, up);
    const legs = dark ? DARK4 : WOOD4;
    const seat = (): void => {
      for (const s of [0.2, long - 0.2]) this.pole(at(s, 0.4, 0), at(s, 0.4, SEAT), 0.08, legs);
      this.face(at(0, 0.02, SEAT), f, a, (d, _t, x, y) => (Math.abs(d - 0.5) < 0.05 ? run[0]! : tone(run, low + 0.28 + 0.2 * lit + 0.06 * (hash2(x >> 2, y, 870 + seed) - 0.5), x, y, 0)));
      this.face(at(0, 0.46, SEAT - 0.06), [0, 0.06, 0], a, (_s, _t, x, y) => tone(run, low + 0.06 * hash2(x >> 2, seed, 871), x, y, 0));
    };
    const back = (): void => {
      for (const s of [0.12, long - 0.12]) this.pole(at(s, 0, 0), at(s, 0, BACK + 0.2), 0.09, legs);
      const gulls = Math.max(1, Math.round(long / 1.15));
      // far off a gull is three pixels that read as a face: the board is left plain there
      const drawn = this.at(at(long / 2, 0, 0)).far < 14;
      // the back board, a dark line where its two planks meet, the gulls across both
      this.face(at(0, 0, SEAT + 0.12), [0, BACK - SEAT, 0], a, (s, t, x, y) => {
        if (drawn && TerracePainter.gull(t * gulls, s)) return dark ? R.hull[2]! : R.hull[4]!;
        if (Math.abs(s - 0.5) < 0.035 || t < 0.012 || t > 0.988) return run[0]!;
        return tone(run, low + 0.14 + 0.26 * (dark ? 1 - lit : lit) * (dark ? 0.4 : 1) + 0.07 * (hash2(x >> 2, y, 873 + seed) - 0.5) + (s > 0.9 ? 0.1 : 0), x, y, 0);
      });
    };
    // whichever is further from the eye first
    if (this.at(at(long / 2, 0, 0)).far > this.at(at(long / 2, 0.44, 0)).far) { back(); seat(); } else { seat(); back(); }
  }

  /** The picnic table between the benches (the painter's): a top of pale scrubbed boards on crossed legs, a jug and two mugs on it. */
  private table(u: number, v: number, long: number, wide: number, seed: number): void {
    const high = 0.74, lit = clamp01(0.55 - 0.3 * this.hour.side);
    const at = (s: number, d: number, up: number): P3 => this.floor(u + s, v + d, up);
    const span = (a: P3, b: P3): P3 => [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
    // crossed legs at each end, then the top's boards and the apron under its near edge
    for (const s of [0.22, long - 0.22]) {
      this.pole(at(s, 0.02, 0), at(s, wide - 0.1, high), 0.08, DARK4);
      this.pole(at(s, wide - 0.02, 0), at(s, 0.1, high), 0.08, WOOD4);
    }
    const o = at(0, 0, high);
    this.face(o, span(o, at(long, 0, high)), span(o, at(0, wide, high)), (s, t, x, y) => (s < 0.015 || s > 0.985 ? R.wood[1]! : Math.abs(((t * 4) % 1) - 0.5) > 0.44 ? R.wood[1]! : tone(F.wood, 0.72 + 0.2 * lit + 0.08 * (hash2(x >> 2, y, 876 + seed) - 0.5), x, y, 0)));
    this.face(at(0, 0, high - 0.07), [0, 0.07, 0], span(o, at(long, 0, high)), (_s, _t, x, y) => tone(F.wood, 0.3 + 0.06 * hash2(x >> 2, seed, 877), x, y, 0));
    // a jug and two mugs on it
    const jug = this.at(at(long * 0.42, wide * 0.5, high));
    const jar = Math.max(2, Math.round((LENS * 0.09) / jug.far)), tall = Math.max(4, Math.round((LENS * 0.26) / jug.far));
    for (let dy = 0; dy < tall; dy++) for (let dx = -jar; dx <= jar; dx++) this.put(jug.x + dx, jug.y - dy, dy > tall - 2 ? R.hull[4]! : dx * this.hour.side > 0 ? R.hull[3]! : R.hull[2]!);
    this.put(jug.x + jar + 1, jug.y - tall + 2, R.hull[1]!);
    this.put(jug.x + jar + 1, jug.y - tall + 3, R.hull[1]!);
    for (const k of [0.68, 0.2]) {
      const mug = this.at(at(long * k, wide * (k > 0.5 ? 0.3 : 0.6), high));
      for (let dy = 0; dy < Math.max(2, tall / 2); dy++) for (let dx = -1; dx <= 1; dx++) this.put(mug.x + dx, mug.y - dy, dx > 0 ? R.dry[1]! : R.dry[3]!);
    }
  }

  /** A barrel standing at a point of the plan: bulging staves lit on the light's side, two iron hoops, its lid seen from above; `dark` near the viewer. */
  private barrel(at: P3, r: number, high: number, seed: number, dark: boolean): void {
    const [x, y, z] = at;
    const foot = terraceProject(x, y, z), top = terraceProject(x, y + high, z);
    const half0 = (LENS * r) / z, side = this.hour.side, low = dark ? 0.3 : 0;
    const lid = Math.max(1.5, half0 * 0.32);
    for (let py = Math.round(top.y); py <= Math.min(this.h, Math.round(foot.y)); py++) {
      const h = (foot.y - py) / Math.max(1, foot.y - top.y);
      const half = half0 * (1 + 0.12 * Math.sin(Math.PI * h));
      const hoop = Math.abs(h - 0.2) < 0.045 || Math.abs(h - 0.8) < 0.045;
      for (let px = Math.floor(foot.x - half); px <= Math.ceil(foot.x + half); px++) {
        const u = (px - foot.x) / half;
        if (Math.abs(u) > 1) continue;
        const t = 0.5 - u * side * 0.55 - Math.abs(u) ** 3 * 0.35 + (hash2(Math.round(u * 5), seed, 890) - 0.5) * 0.15 - low;
        let c = hoop ? (t > 0.4 ? R.stone[2]! : R.stone[1]!) : tone(F.wood, clamp01(Math.round(clamp01(t) * 5) / 5), px, py, 0);
        if (!hoop && Math.round(u * 5) !== Math.round(((px + 1 - foot.x) / half) * 5)) c = R.wood[dark ? 0 : 1]!;
        if (Math.abs(u) > 0.95) c = R.wood[0]!;
        this.put(px, py + lid * Math.sqrt(Math.max(0, 1 - u * u)), c);
      }
    }
    // the lid: an ellipse of boards with a dark rim
    for (let dy = -lid; dy <= lid; dy++) for (let dx = -half0; dx <= half0; dx++) {
      const e = (dx / half0) ** 2 + (dy / lid) ** 2;
      if (e > 1) continue;
      this.put(top.x + dx, top.y + dy, e > 0.7 ? R.wood[1]! : Math.round(dx) % 5 === 0 ? R.wood[1]! : R.wood[dark ? 3 : 4]!);
    }
  }

  /** A wooden crate on the deck at a point of its frame, `half` metres to each side: boarded faces, a darker frame, a lit top. */
  private crate(u: number, v: number, half: number, seed: number, float = true): void {
    const o = this.floor(u - half, v - half), du = add(onDeck(2 * half, 0), [0, -DECK.y, 0]), dv = add(onDeck(0, 2 * half), [0, -DECK.y, 0]), up: P3 = [0, 2 * half, 0];
    const boards = (base: number) => (s: number, t: number, x: number, y: number): number => (s < 0.06 || s > 0.94 || t < 0.06 || t > 0.94 ? R.wood[0]! : Math.abs(((t * 4) % 1) - 0.5) > 0.42 ? R.wood[Math.max(0, base - 1)]! : hash2(x >> 2, y, seed) > 0.85 ? R.wood[Math.max(0, base - 1)]! : R.wood[base]!);
    // the side along the deck's `v` toward the eye, the side across, the top
    this.face(o, dv, up, boards(this.hour.side < 0 ? 3 : 2));
    this.face(o, du, up, boards(this.hour.side < 0 ? 2 : 3));
    this.face(add(o, up), du, dv, (s, t) => (s < 0.06 || s > 0.94 || t < 0.06 || t > 0.94 ? R.wood[1]! : Math.abs(((s * 3) % 1) - 0.5) > 0.44 ? R.wood[1]! : R.wood[3]!));
    if (!float) return;
    // a net float lying on it: a ball in the benches' red, a white band round it
    const c = this.at(this.floor(u + 0.02, v - 0.03, 2 * half + 0.13)), r = (LENS * 0.14) / c.far;
    for (let dy = -Math.ceil(r); dy <= Math.ceil(r); dy++) for (let dx = -Math.ceil(r); dx <= Math.ceil(r); dx++) {
      if (Math.hypot(dx, dy) > r) continue;
      const lit = 0.55 - 0.3 * (dx / r) * -this.hour.side - 0.3 * (dy / r);
      this.put(c.x + dx, c.y + dy, Math.abs(dx + dy * 0.4) < r * 0.28 ? tone(F.hull, lit + 0.2, 0, 0, 0) : tone(F.red, lit, 0, 0, 0));
    }
  }

  /** A coil of rope lying on the boards at a point of the deck's frame. */
  private coil(u: number, v: number, r: number): void {
    // a fat flat coil: a body of rope's tan filled turn on turn, dark between the turns and where the rope is laid
    const c = this.at(onDeck(u, v, 0.05)), rx = (LENS * r) / c.far, ry = (rx * (c.y - this.hz)) / LENS;
    for (let dy = -Math.ceil(ry) - 1; dy <= Math.ceil(ry); dy++) for (let dx = -Math.ceil(rx); dx <= Math.ceil(rx); dx++) {
      const d = Math.hypot(dx / rx, dy / ry);
      if (d > 1 || d < 0.16) continue;
      const turn = (d * 4.2) % 1, strand = Math.sin(Math.atan2(dy / ry, dx / rx) * 11 + d * 9) > 0.6;
      this.put(c.x + dx, c.y + dy, turn < 0.22 ? R.earth[0]! : strand ? R.earth[1]! : dx * this.hour.side > 0 === turn > 0.6 ? R.dry[2]! : R.dry[1]!);
    }
    // its thickness toward the eye
    for (let dx = -Math.ceil(rx); dx <= Math.ceil(rx); dx++) {
      const edge = ry * Math.sqrt(Math.max(0, 1 - (dx / rx) ** 2));
      for (let k = 1; k <= 2; k++) this.put(c.x + dx, c.y + edge + k, R.earth[0]!);
    }
  }

  // ---- the picture

  private painted(): Bitmap {
    const bitmap = createBitmap(this.w, this.h);
    this.px = bitmap.pixels;
    this.owner = new Uint16Array(this.w * this.h);
    this.shaded = new Uint8Array(this.w * this.h);
    this.things = 0;
    this.live.on = true;
    this.paintSky();
    this.paintFloor();
    this.seaBands();
    this.seaLights();
    this.pebbles();
    // far to near: the boulders, the tufts on the bank, the thicket on the right
    for (const r of [...TERRACE_ROCKS].sort((a, b) => b.z - a.z)) this.as(() => this.rock(r.x, r.z, r.r));
    this.tufts();
    this.as(() => this.thicket());
    // the reach over the beach: its piles, its boards, its far rail, what stands on its head, then its near rail
    const end = REACH.long + REACH.deep, { head } = REACH;
    this.pilework();
    this.as(() => { this.reachThing = this.thing; this.reachDeck(); });
    const feet = TerracePainter.reachFeet;
    // the head's seaward rail from its far right corner to the tower, and the rail down the walk's right side and round the head's
    this.woodRail(feet([[head.u1 - 0.12, end - 0.12], [6.3, end - 0.1], [4.9, end - 0.1]]), 870, onTower(1, 1));
    this.woodRail(feet([[REACH.u1 - 0.1, 0.5], [REACH.u1 - 0.1, 2.7], [REACH.u1 - 0.1, 4.9], [REACH.u1 - 0.1, 7.1], [REACH.u1 - 0.1, REACH.long - 0.05], [head.u1 - 0.12, REACH.long + 0.15], [head.u1 - 0.12, REACH.long + 2], [head.u1 - 0.12, REACH.long + 3.8], [head.u1 - 0.12, end - 0.12]]), 880);
    this.base = -REACH.drop;
    this.as(() => this.rods(head.u1 - 0.5, end - 0.2));
    this.as(() => this.crate(head.u1 - 0.75, DECK.v1 + end - 0.8, 0.3, 905));
    this.base = 0;
    this.as(() => this.tower());
    // the string of lanterns: from a pole at the deck's edge, by a pole half way out the walk and one at the head's corner, to the tower
    const poles: P3[] = [onDeck(8.9, DECK.v1 - 0.25), onReach(REACH.u1 - 0.1, 4.7), onReach(head.u1 - 0.12, REACH.long + 0.15)];
    const tops = poles.map((foot, k): P3 => [foot[0] + 0.12 * (hash2(k, 1, 848) - 0.5), foot[1] + 2.75 - 0.15 * k, foot[2]]);
    poles.forEach((foot, k) => { if (k > 0) this.as(() => this.pole(foot, tops[k]!, 0.13, WOOD4, 0.08, 0.1 * (hash2(k, 2, 849) - 0.5))); });
    this.as(() => this.festoon([...tops, onTower(1, 0, TOWER.eave - 0.5)]));
    // the walk's torches, at its right rail
    this.as(() => this.torch(2));
    this.as(() => this.torch(1));
    // the rail down the walk's left side and along the head's to the tower, nearest the eye
    this.woodRail(feet([[REACH.u0 + 0.1, 0.5], [REACH.u0 + 0.1, 2.7], [REACH.u0 + 0.1, 4.9], [REACH.u0 + 0.1, 7.1], [REACH.u0 + 0.1, REACH.long - 0.05], [head.u0 + 0.12, REACH.long + 0.15], [head.u0 + 0.12, REACH.long + 1.5]]), 890, onTower(0, 0));
    // the terrace: its boards, the rail and what hangs on it, the grill, the picnic table and its benches
    let deck = 0;
    this.as(() => { deck = this.thing; this.deck(); });
    this.deckThing = deck;
    this.shadowAt(GRILL.u, GRILL.v, 0.5, 0.4, deck);
    this.shadowAt(6.6, 3.0, 1.7, 1.4, deck);
    // the corner by the barrel and the crate lies in their shade: a dark wing
    this.shadowAt(0.1, 4.7, 1.2, 1.9, deck);
    // the deck's own rail along its seaward edge: right of the walk round the far corner and back along the deck's end, and left of the walk out of the picture
    this.woodRail([[REACH.u1 + 0.35, DECK.v1 - 0.1], [7.7, DECK.v1 - 0.1], [8.75, DECK.v1 - 0.1], [9.65, DECK.v1 - 0.1], [DECK.u1 - 0.12, DECK.v1 - 0.12], [DECK.u1 - 0.12, 5.3], [DECK.u1 - 0.12, 4.2], [DECK.u1 - 0.12, 3.05]].map(([u, v]) => onDeck(u!, v!)), 850);
    this.woodRail([[REACH.u0 - 0.35, DECK.v1 - 0.1], [0.9, DECK.v1 - 0.1], [-0.2, DECK.v1 - 0.1], [-1.1, DECK.v1 - 0.1]].map(([u, v]) => onDeck(u!, v!)), 860);
    this.as(() => this.pole(poles[0]!, tops[0]!, 0.14, WOOD4, 0.09, 0.08));
    // the deck's torches, on posts of its rail, far to near: at the far corner, right of the walk's mouth, on the
    // right side, left of the mouth and on the left by the barrel
    for (const k of [3, 6, 4, 5, 0]) this.as(() => this.torch(k));
    this.as(() => this.grill());
    // the walk's lifebuoy, on a post of its near rail (the real terrace's hangs on a post, with a sign)
    this.base = -REACH.drop;
    this.as(() => this.lifebuoy(REACH.u0 + 0.1, DECK.v1 + 3.3));
    this.base = 0;
    // near the viewer: a barrel, a crate and a coil of rope on the left; on the right the picnic set, a bench facing
    // the eye, the table, and a bench with its back to the eye, the darkest
    this.as(() => this.crate(0.3, 5.95, 0.26, 907, false));
    this.as(() => this.coil(1.55, 4.35, 0.36));
    this.as(() => this.crate(0.62, 4.2, 0.27, 903));
    this.as(() => this.barrel(onDeck(-0.25, 4.75), 0.31, 0.86, 901, true));
    this.as(() => this.bench(5.5, 4.0, [1, 0], [0, -1], 2.4, false, 3));
    this.as(() => this.table(5.4, 2.55, 2.4, 0.85, 5));
    this.as(() => this.bench(4.9, 1.75, [1, 0], [0, 1], 3.0, true, 2));
    this.water = this.live.seal(bitmap);
    this.live.on = false;
    // the grain of scanned paint over the things' runs (not the sky, the sea, the clouds or a light)
    grain(this.px, this.w, GRAIN_RUNS.filter((run) => run !== F.wood), { seed: 700 });
    grain(this.px, this.w, [F.wood], { seed: 701, strength: 0.18 });
    this.outline();
    return bitmap;
  }

  /** The picture, and what stands before the sky in the rows the clouds reach (`band`). */
  frames(band: number): { frames: Bitmap[]; fore: Overlay } {
    return paintLooks(1, this.sky, Math.min(band, this.hz + 1), () => this.painted());
  }

  /** The lamp's light: its glow round the lantern and a pool on the head's boards under it at dusk and night, flickering; nothing by day. */
  lamp(): Overlay {
    const hook = lampHook();
    return this.glow(this.plan.lamp, 34, Math.round(this.hz + (LENS * TERRACE.overSea) / hook[2]) - this.plan.lamp.y, (bitmap, look) => {
      this.pool(bitmap, look, TOWER.u0 + (TOWER.u1 - TOWER.u0) * 1.32, DECK.v1 + TOWER.t0 - 0.3, 2.0, 1);
      // the kit's halo leaves the lantern's own place open, which reads as a ring round a dark hole against the smooth
      // night sky (art reviews 1 to 3): the glow's heart is laid behind the lantern, the brightest of it
      const { x, y } = this.plan.lamp;
      for (let dy = -6; dy <= 6; dy++) for (let dx = -6; dx <= 6; dx++) {
        const i = (y + 3 + dy) * this.w + x + dx;
        if (dx * dx + dy * dy < 34 && bitmap.pixels[i] === 0 && this.owner[i] === 0) bitmap.pixels[i] = F.ember[5]!;
      }
    });
  }

  /** The coals' light on the boards round the grill at dusk and night, flickering as the lantern does; nothing by day. */
  coals(): Overlay {
    return this.glow({ x: this.plan.fire.x, y: this.plan.fire.y - 2 }, 30, 0, (bitmap, look) => {
      // the coals have no halo in the air: the kit's lies on the shingle beyond the grill, where it reads as a thing
      // standing on the grate (art review 3)
      for (let i = 0; i < bitmap.pixels.length; i++) if (bitmap.pixels[i] !== 0 && this.owner[i] === 0) bitmap.pixels[i] = 0;
      this.pool(bitmap, look, GRILL.u, GRILL.v, 1.7);
      this.warmed(bitmap, look, this.plan.fire, 44);
    });
  }

  /**
   * The torches' fire at dusk and night, one layer for each so that no two flicker alike: its flame over the head, a
   * ring of its light on the bare sky, a pool on the boards under it and warmth on what stands by it; nothing by day.
   * The nearer the torch, the bigger its flame and the further its light, to the picture's scale.
   */
  torches(): Overlay[] {
    return this.plan.torches.map((at, k) => {
      const torch = TORCHES[k]!, far = Math.max(8, Math.round(at.tall * 1.5));
      const heart = { x: at.x, y: at.y - Math.round(at.tall * 0.35) };
      // where open water shows right under the flame, its light lies on it in streaks (light-and-heat.md, 10)
      const water = F.sea.includes(this.px[(this.hz + 3) * this.w + at.x + 4]!) ? this.hz + 1 - (heart.y - 3) : 0;
      return this.glow({ x: heart.x, y: heart.y - 3 }, far, water, (bitmap, look) => {
        for (let i = 0; i < bitmap.pixels.length; i++) {
          if (bitmap.pixels[i] === 0) continue;
          // the kit's ring lies only on bare sky, so two torches wore one and five none (art review 5): each gets its own
          // halo below. And leaves take no lamplight here: scattered warm pixels on the thicket read as the bush on fire
          if ((this.owner[i] === 0 && i < (this.hz + 1) * this.w) || LEAFY.has(this.px[i]!)) bitmap.pixels[i] = 0;
        }
        // by dusk a torch is lit but the low sun still lights the boards, brighter than the embers' reds: a pool there
        // reads as a stain, so it lies only at night (as the crossroads keeps its lamps' warmth off a sun-lit wall)
        if (this.hour.night) this.pool(bitmap, look, torch.u, torch.on === 'deck' ? torch.v : DECK.v1 + torch.v, 2.1, 2, true);
        this.warmed(bitmap, look, heart, Math.round(far * 1.4));
        this.halo(bitmap, at, look, k);
        this.flame(bitmap, at, look, k);
      });
    });
  }

  /**
   * The halo in the air round a torch's flame (light-and-heat.md, 8): a disc of the fire's light about its heart, its
   * rim scattered into the night as single pixels, a little wider in each look. It lies over whatever is behind the
   * flame, the same for every torch, and leaves the torch's own head and pole dark.
   */
  private halo(bitmap: Bitmap, at: { x: number; y: number; tall: number }, look: number, seed: number): void {
    const r = Math.max(4, at.tall * 0.55 + 1 + look * 0.7), cy = at.y - at.tall * 0.42;
    for (let y = Math.max(0, Math.floor(cy - r)); y <= at.y - 1; y++) for (let x = Math.max(0, Math.floor(at.x - r)); x <= Math.min(this.w - 1, Math.ceil(at.x + r)); x++) {
      const d = Math.hypot(x - at.x, (y - cy) * 1.05) / r;
      if (d >= 1) continue;
      // a dark orange, so the flame's own tongue stays the brightest thing in it
      if (d < 0.5 || hash2(x, y, 880 + seed) < ((1 - d) / 0.5) * 0.8) bitmap.pixels[y * this.w + x] = d < 0.75 ? R.ember[2]! : R.ember[1]!;
    }
  }

  /**
   * A torch's flame standing on its head at `at`: a tongue fattest a quarter of the way up and drawn to a point, a pale
   * heart low in it, orange round that and red at its tip, in flat tones. Each look stands a little taller and leans
   * another way, so the looks blended (`flicker.ts`) make it lick.
   */
  private flame(bitmap: Bitmap, at: { x: number; y: number; tall: number }, look: number, seed: number): void {
    const tall = Math.max(4, Math.round(at.tall * (0.76 + 0.12 * look))), wide = Math.max(1, at.tall * 0.17);
    const sway = (hash2(seed, look, 871) - 0.5) * 1.6 * wide;
    for (let dy = -1; dy < tall; dy++) {
      const t = Math.max(0, dy) / tall;
      const half = wide * (t < 0.25 ? 0.7 + 1.2 * t : (1 - (t - 0.25) / 0.75) ** 0.8);
      const cx = at.x + sway * t * t + 0.35 * wide * Math.sin(t * 5 + seed * 2.1 + look);
      for (let x = Math.round(cx - half); x <= Math.round(cx + half); x++) {
        const y = at.y - dy;
        if (x < 0 || x >= this.w || y < 0 || y >= this.h) continue;
        const d = Math.abs(x - cx) / Math.max(0.6, half);
        bitmap.pixels[y * this.w + x] = t > 0.86 ? R.ember[2]! : t < 0.5 && d < 0.45 ? R.ember[5]! : t < 0.75 && d < 0.8 ? R.ember[4]! : R.ember[3]!;
      }
    }
  }

  /**
   * A light's pool on the boards round the point (`u`, `v`) of the deck's frame, `reach` metres wide: the lit boards
   * go to the embers' dark reds, warmest under the light. Each board keeps its own drawing (a pale board is lit
   * warmer than a dark one, a seam stays a seam), and toward its rim the pool breaks up, the dark boards dropping out
   * first, so it has no ruled edge (art review 2) and needs no dither. It lies on the deck's boards and the walk's
   * alike; `strong` is how warm it is under the light (the coals' 2, a lantern high on its post 1).
   * `even` lays it in flat rings about the light whatever the board's own tone, only the seams left out (a torch's:
   * a pale board lit warmer than its neighbours read as a rug, and the walk's grained boards as rust; art review 5).
   */
  private pool(bitmap: Bitmap, look: number, u: number, v: number, reach: number, strong = 2, even = false): void {
    const { w, h, hz } = this;
    const boards = new Map<number, number>();
    for (const run of [F.wood, GREY.fine]) run.forEach((c, k) => boards.set(c, k / (run.length - 1)));
    const wide = reach * (1 + 0.05 * look);
    for (let y = hz + 2; y < h; y++) for (let x = 0; x < w; x++) {
      const i = y * w + x, owner = this.owner[i]!;
      if (bitmap.pixels[i] !== 0 || (owner !== this.deckThing && owner !== this.reachThing)) continue;
      const lightness = boards.get(this.px[i]!);
      if (lightness === undefined || lightness < 0.15) continue;
      const z = (LENS * (TERRACE.overSea - DECK.y + (owner === this.reachThing ? REACH.drop : 0))) / (y - hz), at = deckOf(((x + 0.5 - w / 2) * z) / LENS, z);
      const far = Math.hypot(at.u - u, at.v - v) / wide + 0.16 * (hash2(Math.round(Math.atan2(at.v - v, at.u - u) * 6), 3, 993) - 0.5);
      if (far >= 1) continue;
      const k = (far < 0.3 ? strong : far < 0.62 ? strong - 1 : strong - 2) + (even ? (lightness > 0.3 ? 0 : -1) : lightness > 0.62 ? 1 : lightness > 0.38 ? 0 : -1);
      if (k >= 0) bitmap.pixels[i] = F.ember[k]!;
    }
  }

  /**
   * What stands by a light takes its warmth on the side toward it: the red of a bench, the white of a post or a
   * lifebuoy within `far` pixels of the light at `at` go to the embers' tones, in two flat steps,
   * so a light is seen on its neighbours and not only on the floor (art review 2).
   */
  private warmed(bitmap: Bitmap, look: number, at: { x: number; y: number }, far: number): void {
    const { w, h } = this;
    const takes = new Map<number, number>();
    for (const run of [F.red, F.hull]) run.forEach((c, k) => takes.set(c, k / (run.length - 1)));
    const reach = far + 2 * look;
    for (let y = Math.max(0, at.y - reach); y < Math.min(h, at.y + reach); y++) for (let x = Math.max(0, at.x - reach); x < Math.min(w, at.x + reach); x++) {
      const i = y * w + x, lightness = takes.get(this.px[i]!);
      if (lightness === undefined || bitmap.pixels[i] !== 0 || this.owner[i] === 0) continue;
      // two flat steps, the nearer the warmer, their rim ragged; no dither (art-direction rule 12), and a thing's dark
      // tones stay the night's
      const d = Math.hypot(x - at.x, (y - at.y) * 1.25) / reach + 0.1 * (hash2(Math.round(Math.atan2(y - at.y, x - at.x) * 7), 5, 994) - 0.5);
      if (d >= 0.8 || lightness < 0.5) continue;
      bitmap.pixels[i] = F.ember[Math.min(F.ember.length - 1, Math.round(lightness * 3 + (d < 0.45 ? 1 : 0)))]!;
    }
  }

  /** A light's glow round `at` as its own layer (the kit's `lights/lamp`), in `LAMP_LOOKS` looks. */
  private glow(at: { x: number; y: number }, far: number, water: number, more?: (bitmap: Bitmap, look: number) => void): Overlay {
    const { w, h } = this;
    const lit = lampLit(this.brush());
    return cropTogether(Array.from({ length: LAMP_LOOKS }, (_, look) => {
      const bitmap = createBitmap(w, h);
      if (!lit) {
        bitmap.pixels[0] = R.ink;
        return bitmap;
      }
      // the kit's lamp (`lights/lamp`, after Woodtick) on its own layer: it reads the picture and paints the overlay,
      // a little further each look as it flickers
      const brush: KitBrush = {
        ...this.brush(),
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
      delete brush.live;
      lamp.paint(brush, at.x, at.y, optionsOf(lamp, undefined, { reach: far + look * 2, water, lantern: false }), look);
      more?.(bitmap, look);
      return bitmap;
    }));
  }
}

/** Paints the terrace of `world` as planned, for one hour of the sky. */
export function paintTerrace(world: World, plan: TerracePlan, phase: SkyPhase): TerracePicture {
  const p = new TerracePainter(world, plan, phase);
  const clouds = TERRACE_CLOUDS.map(({ at, spec }) => ({ x: at[0], y: at[1], bitmap: p.cloud(spec) }));
  const { frames, fore } = p.frames(Math.max(...clouds.map((c) => c.y + c.bitmap.height)));
  return { palette: p.palette, frames, fore, clouds, lamp: p.lamp(), coals: p.coals(), torches: p.torches(), water: p.water!, gull: p.gullTone(), smoke: TERRACE_SMOKE, blown: [p.pennant()] };
}
