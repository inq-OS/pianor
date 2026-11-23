import type { BoatKind } from '../../../../core/layout/port';
import { blit, createBitmap, type Bitmap } from '../bitmap';
import type { Overlay } from '../pack';
import { fbm, hash2 } from '../paint/noise';
import type { Blown, BlownKind } from '../sway';
import { tone } from './keriPalette';

/**
 * The visitors' boats at the southern port (ft_1_19; the port is drawn so that various boats can
 * be shown, with only the pier, the water and any boats that visitors came with): each its own picture, laid at a berth on the quay's
 * far side, so any boat can lie at any berth. Seen side-on, bow to the right, in the 1991 game's manner: a banana of a
 * hull with a sheer that leaps at the bow, a rounded stem and a raked stern, its planks in flat bands under a lit rail, a
 * little of its inside showing, and nothing ruler-straight: cabins sag, funnels bend, masts lean, flags flap, every
 * edge wobbles a pixel. An ink line goes round each thing. Only what stands over the quay shows in the scene, so a boat
 * is mostly its rail, its upper planks, its cabin, its mast and what is heaped or hung on it; the hull is painted whole
 * all the same. No boat carries a real service's marks (the border guard's boat is a plain grey boat).
 */

/** The runs a boat is painted from: the port's palette (`portPicture.ts`). */
export interface BoatRuns {
  ink: number;
  hull: readonly number[];
  red: readonly number[];
  wood: readonly number[];
  stone: readonly number[];
  shingle: readonly number[];
  sponge: readonly number[];
  dry: readonly number[];
  sea: readonly number[];
  /** Tar and brown canvas: the rowing boat's hull, a furled sail. */
  tar: readonly number[];
  /** The lamp's glass when lit (dusk and night), else null. */
  lit: number | null;
}

/** Fine pixels per metre at the berths (about 17 m from the eye). */
const SCALE = 26;

interface Spec {
  /** Length and freeboard in the middle (metres), the sheer's rise at the bow and the stern, the bow's and stern's rake. */
  long: number;
  board: number;
  bow: number;
  stern: number;
  rake: number;
  aft: number;
  /** How full the stem's curve is (0 a straight raked stem, 1 a round tug's nose), and the stern's (0 a flat transom). */
  round: number;
  tuck: number;
  /** How far the far gunwale shows over the near one amidships (fine pixels): how much of the inside we see. */
  lift: number;
  /** The sheer's wobble (metres): a hand-drawn line, never a ruler's. */
  wob: number;
}

const SPECS: Record<BoatKind, Spec> = {
  launch: { long: 6.6, board: 1.0, bow: 0.78, stern: 0.3, rake: 0.75, aft: 0.32, round: 0.85, tuck: 0.7, lift: 6, wob: 0.025 },
  row: { long: 4.6, board: 0.72, bow: 0.9, stern: 0.66, rake: 0.72, aft: 0.6, round: 0.8, tuck: 0.8, lift: 7, wob: 0.04 },
  rib: { long: 6.2, board: 0.9, bow: 0.38, stern: 0.08, rake: 1.1, aft: 0.06, round: 0.35, tuck: 0, lift: 4, wob: 0.015 },
  sail: { long: 7.2, board: 0.85, bow: 0.52, stern: 0.22, rake: 0.95, aft: 0.38, round: 0.5, tuck: 0.35, lift: 5, wob: 0.02 },
  motor: { long: 5.0, board: 0.8, bow: 0.48, stern: 0.1, rake: 0.75, aft: 0.06, round: 0.55, tuck: 0, lift: 5, wob: 0.03 },
  houseboat: { long: 7.6, board: 0.9, bow: 0.95, stern: 0.6, rake: 1.2, aft: 0.5, round: 0.65, tuck: 0.6, lift: 5, wob: 0.035 },
  galleon: { long: 7.2, board: 1.0, bow: 0.9, stern: 0.75, rake: 1.3, aft: 0.35, round: 0.7, tuck: 0.5, lift: 5, wob: 0.03 },
};

/** How high over the water a boat's tallest part reaches (fine pixels): the picture's room above its waterline. */
const REACH = 126;
/** Room left of the stern and right of the bow (fine pixels), for an oar or a flag. */
const MARGIN = 26;

/** Puts colour `c` at a pixel; a colour below 0 leaves it as it is (a net's holes). */
type Put = (x: number, y: number, c: number) => void;
type Pt = readonly [number, number];

/** The colour at `t` along a run (0 its dark end, 1 its light end). */
const col = (run: readonly number[], t: number): number => run[Math.max(0, Math.min(run.length - 1, Math.round(t * (run.length - 1))))]!;

/** A quadratic curve from `a` to `b` pulled toward `c`, as `n` + 1 points. */
function quad(a: Pt, c: Pt, b: Pt, n = 20): [number, number][] {
  return Array.from({ length: n + 1 }, (_, i) => {
    const u = i / n, v = 1 - u;
    return [v * v * a[0] + 2 * u * v * c[0] + u * u * b[0], v * v * a[1] + 2 * u * v * c[1] + u * u * b[1]];
  });
}

const lerp2 = (a: Pt, b: Pt, u: number): [number, number] => [a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u];

/**
 * A polygon's edges cut into short pieces, each point nudged by a smooth noise up to `amp` pixels: the hand's wobble, so
 * no cabin or box is ruler-straight.
 */
function wonky(pts: readonly Pt[], amp: number, seed: number): [number, number][] {
  const out: [number, number][] = [];
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i]!, b = pts[(i + 1) % pts.length]!;
    const n = Math.max(1, Math.round(Math.hypot(b[0] - a[0], b[1] - a[1]) / 5));
    for (let k = 0; k < n; k++) {
      const [x, y] = lerp2(a, b, k / n);
      out.push([x + amp * (fbm(x / 7, y / 7, 2, seed) - 0.5) * 2, y + amp * (fbm(x / 7 + 9, y / 7, 2, seed + 1) - 0.5) * 2]);
    }
  }
  return out;
}

/** Fills a polygon (even-odd, pixel centres), each pixel's colour from `colour`. */
function fill(put: Put, pts: readonly Pt[], colour: (x: number, y: number) => number): void {
  const ys = pts.map((p) => p[1]);
  for (let y = Math.floor(Math.min(...ys)); y <= Math.ceil(Math.max(...ys)); y++) {
    const xs: number[] = [];
    for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
      const [ax, ay] = pts[i]!, [bx, by] = pts[j]!;
      if (ay > y + 0.5 !== by > y + 0.5) xs.push(ax + ((y + 0.5 - ay) * (bx - ax)) / (by - ay));
    }
    xs.sort((a, b) => a - b);
    for (let k = 0; k + 1 < xs.length; k += 2) for (let x = Math.round(xs[k]!); x < Math.round(xs[k + 1]!); x++) put(x, y, colour(x, y));
  }
}

/** A straight stroke of `width` pixels. */
function stroke(put: Put, ax: number, ay: number, bx: number, by: number, c: number, width = 1): void {
  const n = Math.max(1, Math.ceil(Math.hypot(bx - ax, by - ay)));
  const steep = Math.abs(by - ay) > Math.abs(bx - ax);
  for (let i = 0; i <= n; i++) {
    const x = ax + ((bx - ax) * i) / n, y = ay + ((by - ay) * i) / n;
    for (let k = 0; k < width; k++) put(x + (steep ? k : 0), y + (steep ? 0 : k), c);
  }
}

/** A line along points, each pixel's colour from `colour` (its place along the line, 0 to 1). */
function trace(put: Put, pts: readonly Pt[], colour: (u: number) => number): void {
  for (let i = 0; i + 1 < pts.length; i++) {
    const [ax, ay] = pts[i]!, [bx, by] = pts[i + 1]!;
    const n = Math.max(1, Math.ceil(Math.hypot(bx - ax, by - ay)));
    for (let k = 0; k <= n; k++) put(ax + ((bx - ax) * k) / n, ay + ((by - ay) * k) / n, colour((i + k / n) / (pts.length - 1)));
  }
}

class BoatPainter {
  readonly bitmap: Bitmap;
  private readonly owner: Uint8Array;
  private thing = 0;
  private readonly w: number;
  private readonly h: number;
  /** The waterline's row in the bitmap, and the stern's column at the water. */
  readonly water: number;
  readonly stern: number;
  private readonly s: Spec;
  private readonly seed: number;
  private readonly darkest = new Map<number, number>();

  /** What the wind moves, by the numbers of the things that make each one up (`blown`). */
  private readonly loose: { kind: BlownKind; from: number; to: number }[] = [];

  /**
   * `wind`: 'with' paints the boat whole, what the wind moves on it too (a pennant, the washing), as it hangs in still
   * air; 'without' leaves those out, for the game to lay them over it as the wind has them (`sway.ts`).
   */
  constructor(private readonly kind: BoatKind, private readonly r: BoatRuns, private readonly wind: 'with' | 'without', ties?: BoatTies) {
    this.s = SPECS[kind];
    this.seed = 11 + Object.keys(SPECS).indexOf(kind) * 7;
    // a boat tied farther out than its margins is painted wide enough to hold its lines
    const left = Math.max(MARGIN, ...(ties ? [ties.bow.x, ties.stern.x].map((x) => 2 - x) : []));
    const right = Math.max(MARGIN, ...(ties ? [ties.bow.x, ties.stern.x].map((x) => x + 2 - Math.ceil(this.s.long * SCALE)) : []));
    this.w = Math.ceil(this.s.long * SCALE) + left + right;
    this.h = REACH + 14;
    this.water = REACH;
    this.stern = left;
    this.bitmap = createBitmap(this.w, this.h);
    this.owner = new Uint8Array(this.w * this.h);
    for (const run of [r.hull, r.red, r.wood, r.stone, r.shingle, r.sponge, r.dry, r.sea, r.tar]) for (const c of run) if (!this.darkest.has(c)) this.darkest.set(c, run[0]!);
  }

  readonly put: Put = (x, y, c) => {
    x = Math.round(x); y = Math.round(y);
    if (c < 0 || x < 0 || y < 0 || x >= this.w || y >= this.h) return;
    this.bitmap.pixels[y * this.w + x] = c;
    this.owner[y * this.w + x] = this.thing;
  };

  private as(draw: () => void): void {
    this.thing++;
    draw();
  }

  /** Paints something the wind moves (all that `draw` paints is one such thing), unless this painting leaves them out. */
  private blown(kind: BlownKind, draw: () => void): void {
    if (this.wind === 'without') return;
    const from = this.thing + 1;
    draw();
    this.loose.push({ kind, from, to: this.thing });
  }

  /** What the wind moves on the boat, each cut out of the painting with its contour: its picture and where it lies. */
  blownParts(): Blown[] {
    const { w, h, owner } = this;
    return this.loose.flatMap(({ kind, from, to }) => {
      let l = w, r = -1, t = h, b = -1;
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        const a = owner[y * w + x]!;
        if (a < from || a > to) continue;
        l = Math.min(l, x); r = Math.max(r, x); t = Math.min(t, y); b = Math.max(b, y);
      }
      if (r < 0) return [];
      const bitmap = createBitmap(r - l + 1, b - t + 1);
      for (let y = t; y <= b; y++) for (let x = l; x <= r; x++) {
        const a = owner[y * w + x]!;
        if (a >= from && a <= to) bitmap.pixels[(y - t) * bitmap.width + x - l] = this.bitmap.pixels[y * w + x]!;
      }
      return [{ kind, x: l, y: t, bitmap }];
    });
  }

  /** The column at `m` metres from the stern, and the row at `up` metres over the water. */
  private X(m: number): number { return this.stern + m * SCALE; }
  private Y(up: number): number { return this.water - up * SCALE; }

  /** The sheer (the gunwale's height over the water, metres) at `t` from stern (0) to bow (1): a banana, a little wobbly. */
  private sheer(t: number): number {
    const s = this.s;
    return s.board + s.bow * t ** 2.4 + s.stern * (1 - t) ** 2.6 + s.wob * Math.sin(t * 9.5 + this.seed);
  }

  /** The gunwale's point at `t`: its column and row. */
  private gunwale(t: number): [number, number] {
    return [this.X(-this.s.aft * (1 - t) + t * this.s.long), this.Y(this.sheer(t))];
  }

  /** Where along the boat (0 stern, 1 bow) column `x` lies, and the near gunwale's row there. */
  private tOf(x: number): number { return Math.max(0, Math.min(1, (x - this.X(-this.s.aft)) / ((this.s.long + this.s.aft) * SCALE))); }
  private top(x: number): number { return Math.round(this.Y(this.sheer(this.tOf(x)))); }

  /** The hull: the sheer on top, a rounded stem, a raked stern; each pixel's colour from `paint` (`d` rows under the rail's top). */
  hull(paint: (x: number, y: number, d: number, up: number) => number): void {
    const s = this.s;
    const bottom = this.Y(0) + 3;
    const top = Array.from({ length: 61 }, (_, i) => this.gunwale(i / 60));
    const bowTop = top[60]!, sternTop = top[0]!;
    const fore: Pt = [this.X(s.long - s.rake), bottom], aft: Pt = [this.X(0), bottom];
    const stem = quad(bowTop, lerp2(lerp2(bowTop, fore, 0.5), [bowTop[0] + 2, bottom - 4], s.round), fore);
    const back = quad(aft, lerp2(lerp2(aft, sternTop, 0.5), [sternTop[0], bottom - 2], s.tuck), sternTop);
    this.as(() => fill(this.put, [...top, ...stem, ...back], (x, y) => paint(x, y, y - this.top(x), this.water - y)));
  }

  /** The rail along the sheer: a lit wooden (or metal) strip with an ink line over and under it, poking past the stem. */
  rail(run: readonly number[]): void {
    this.as(() => {
      for (let x = Math.round(this.X(-this.s.aft)) - 1; x <= Math.round(this.X(this.s.long)) + 2; x++) {
        const g = this.top(x);
        for (let k = -1; k <= 2; k++) this.put(x, g + k, k <= 0 ? col(run, 0.95) : col(run, 0.6));
      }
    });
  }

  /** The inside past the near gunwale: we look down into the boat a little, its far gunwale higher, its ribs in a row. */
  inside(c: readonly number[], ribs = 9): void {
    const s = this.s;
    this.as(() => {
      for (let x = Math.ceil(this.X(-s.aft)) + 2; x <= this.X(s.long) - 3; x++) {
        const t = this.tOf(x), g = this.top(x);
        const lift = Math.round(s.lift * Math.sin(Math.PI * t) ** 0.5);
        if (lift < 1) continue;
        for (let y = g - lift - 1; y <= g + 1; y++) {
          const k = y - (g - lift - 1);
          this.put(x, y, k <= 1 ? col(c, 0.9) : k === 2 ? col(c, 0.6) : ribs && x % ribs === 0 ? col(c, 0.45) : (g - y) % 3 === 0 ? col(c, 0) : col(c, 0.2));
        }
      }
    });
  }

  /** A mast at `t` along the boat, `tall` metres over the water, leaning `lean` pixels at its top: three pixels wide, lit on its left. */
  mast(t: number, tall: number, lean: number, c: readonly number[], from = 4): { x: number; y: number } {
    const [x0, y0] = this.gunwale(t);
    const top = { x: x0 + lean, y: Math.max(3, this.Y(tall)) };
    this.as(() => {
      stroke(this.put, x0 - 1, y0 + from, top.x - 1, top.y, col(c, 0.4), 3);
      stroke(this.put, x0, y0 + from, top.x, top.y, col(c, 0.85), 1);
      for (let dx = -2; dx <= 2; dx++) for (let dy = -2; dy <= 0; dy++) this.put(top.x + dx, top.y + dy, col(c, dy === -1 && dx < 1 ? 0.85 : 0.5));
    });
    return top;
  }

  /**
   * A pennant flying from `at` to the left (the wind blows from the west), a swallowtail at its end: painted as it
   * stands out straight, since the game flaps it on the wind (`blown`).
   */
  pennant(at: { x: number; y: number }, c: readonly number[], len = 16, tall = 7): void {
    this.blown('flag', () => this.as(() => {
      for (let i = 0; i <= len; i++) {
        const half = tall * (1 - 0.4 * (i / len));
        const y0 = at.y + 1 + i * 0.18;
        const notch = i > len - 4 ? (i - (len - 4)) * 0.7 : -1;
        for (let y = Math.round(y0); y <= Math.round(y0 + half); y++) {
          if (Math.abs(y - (y0 + half / 2)) < notch) continue;
          this.put(at.x - 1 - i, y, col(c, y < y0 + 2 ? 0.85 : Math.sin(i / 3) > 0.4 ? 0.4 : 0.6));
        }
      }
    }));
  }

  /** A fender hung from the rail at `t` on its rope: a fat sausage, lit on its left. */
  fender(t: number, c: readonly number[], drop = 3, len = 9, tilt = 0): void {
    const [x] = this.gunwale(t);
    const g = this.top(x);
    this.as(() => {
      stroke(this.put, x, g, x + tilt * 0.3, g + drop, col(this.r.dry, 0.4));
      for (let k = 0; k < len; k++) {
        const y = g + drop + 1 + k, cx = x + (tilt * (drop + k)) / 10;
        const half = k === 0 || k === len - 1 ? 1 : 2;
        for (let dx = -half; dx <= half; dx++) this.put(cx + dx, y, col(c, dx < 0 ? 0.95 : dx === 0 ? 0.75 : 0.45));
      }
    });
  }

  /** A ring buoy: red and white quarters, lit at its top left; its hole shows what is behind. */
  buoy(cx: number, cy: number, ro = 5.6, ri = 2.4): void {
    const { r } = this;
    this.as(() => {
      for (let dy = -6; dy <= 6; dy++) for (let dx = -6; dx <= 6; dx++) {
        const d = Math.hypot(dx, dy);
        if (d > ro || d <= ri) continue;
        const red = Math.floor((Math.atan2(dy, dx) + Math.PI * 1.25) / (Math.PI / 2)) % 2 === 0;
        const lit = dx + dy < -2 ? 0.95 : dx + dy > 3 ? 0.5 : 0.75;
        this.put(cx + dx, cy + dy, red ? col(r.red, lit - 0.15) : col(r.hull, lit));
      }
    });
  }

  /** A coil of rope lying on a deck: rings of light and dark. */
  coil(cx: number, cy: number, rx = 6, ry = 2.6): void {
    this.as(() => {
      for (let dy = -Math.ceil(ry); dy <= Math.ceil(ry); dy++) for (let dx = -rx; dx <= rx; dx++) {
        const d = Math.hypot(dx / rx, dy / ry);
        if (d <= 1.05) this.put(cx + dx, cy + dy, Math.floor(d * 3.4) % 2 ? col(this.r.dry, 0.25) : col(this.r.dry, dy < 0 ? 0.95 : 0.65));
      }
    });
  }

  /** A rail on stanchions (a pulpit or pushpit) from `t0` to `t1`, `tall` pixels over the deck: thin, so it is all ink line. */
  pulpit(t0: number, t1: number, tall: number, posts: number): void {
    const c = col(this.r.stone, 0.75);
    this.as(() => {
      const pts: [number, number][] = [];
      for (let i = 0; i < posts; i++) {
        const [x, y] = this.gunwale(t0 + ((t1 - t0) * i) / (posts - 1));
        stroke(this.put, x, y, x + (i - posts / 2) * 0.6, y - tall, c);
        pts.push([x + (i - posts / 2) * 0.6, y - tall]);
      }
      trace(this.put, pts, () => c);
    });
  }

  /** The mooring lines: from the bow and the stern, sagging down behind the quay's parapet to the bollards on its far side. */
  moor(ties?: BoatTies): void {
    const s = this.s;
    this.as(() => {
      for (const [t, reach] of [[0.98, 30], [0.02, -26]] as const) {
        const [x0, y0] = this.gunwale(t);
        const to = ties?.[t > 0.5 ? 'bow' : 'stern'];
        const x1 = to ? this.stern + to.x : x0 + reach + (t < 0.5 ? -s.aft * SCALE * 0.3 : 0), y1 = to ? this.water + to.y : this.water + 2;
        const n = Math.max(40, Math.ceil(2 * Math.hypot(x1 - x0, y1 - y0))); // dense enough to stay one unbroken line
        for (let i = 0; i <= n; i++) {
          const u = i / n, x = x0 + (x1 - x0) * u, y = y0 + (y1 - y0) * u + 6 * Math.sin(Math.PI * u);
          this.put(x, y, this.r.dry[1]!);
        }
      }
    });
  }

  /** The ink line round each thing where it lies over another or over nothing. */
  outline(): void {
    const { w, h, owner } = this;
    const px = this.bitmap.pixels;
    const edge: number[] = [];
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const i = y * w + x, a = owner[i]!;
      if (a === 0) continue;
      const near = [x > 0 ? owner[i - 1]! : 0, x < w - 1 ? owner[i + 1]! : 0, y > 0 ? owner[i - w]! : 0, y < h - 1 ? owner[i + w]! : 0];
      if (near.some((b) => b < a)) edge.push(i);
    }
    for (const i of edge) px[i] = this.darkest.get(px[i]!) ?? this.r.ink;
  }

  /**
   * The boat's dark reflection in a strip of the sea under its waterline, broken into level dashes, and a fleck of foam
   * at its ends; what lies lower is cleared (the quay hides it).
   */
  reflect(): void {
    const { w, h } = this;
    const px = this.bitmap.pixels;
    let l = w, r = -1;
    for (let x = 0; x < w; x++) if (px[this.water * w + x]) { l = Math.min(l, x); r = Math.max(r, x); }
    for (let y = this.water + 1; y < h; y++) for (let x = 0; x < w; x++) {
      const i = y * w + x, d = y - this.water;
      px[i] = 0;
      if (d > 5 || r < 0) continue;
      if (x < l || x > r) {
        if (d === 1 && x >= l - 4 && x <= r + 4 && hash2(x, 0, 42) > 0.4) px[i] = this.r.sea[this.r.sea.length - 1]!;
        continue;
      }
      if (hash2(x >> 2, y, 41) > 0.2 + d * 0.1) px[i] = this.r.sea[d < 3 ? 0 : 1]!;
    }
  }

  paint(): void {
    const { r } = this;
    switch (this.kind) {
      case 'launch': return this.launch(r);
      case 'row': return this.rowing(r);
      case 'rib': return this.patrol(r);
      case 'sail': return this.sailing(r);
      case 'motor': return this.motor(r);
      case 'houseboat': return this.houseboat(r);
      case 'galleon': return this.galleon(r);
    }
  }

  /**
   * A launch: a white wooden boat with a sagging varnished cabin, brass portholes, a ring buoy, a red funnel
   * bent back with its black top, a cowl vent, a coil of rope on the foredeck, fenders over the side and an ensign aft.
   */
  private launch(r: BoatRuns): void {
    this.inside(r.wood);
    const staff = this.mast(0.03, 2.9, -4, r.wood);
    this.pennant(staff, r.red, 18, 8);
    const [ax, ay] = this.gunwale(0.28), [bx, by] = this.gunwale(0.7);
    const base = Math.max(ay, by) + 4, roofL = ay - 27, roofR = roofL - 2;
    // the cabin: its walls bulge and sag a little, its front leans back toward the bow
    this.as(() => fill(this.put, wonky([[ax, base], [ax + 3, roofL], [(ax + bx) / 2, roofL + 1], [bx - 10, roofR], [bx, by - 8], [bx + 1, base]], 1.2, 31), (x, y) => {
      if (y >= this.top(x) - 4) return col(r.wood, y === this.top(x) - 4 ? 0.85 : 0.55);
      if (x > bx - 9 + ((y - roofR) * 10) / (by - 8 - roofR) - 3) return tone(r.hull, 0.55, x, y);
      return tone(r.hull, 0.88 + 0.2 * (fbm(x / 6, y / 4, 2, 11) - 0.5), x, y);
    }));
    // the door aft, the portholes, the ring buoy, the front's window
    this.as(() => fill(this.put, wonky([[ax + 4, ay - 3], [ax + 4, roofL + 6], [ax + 13, roofL + 5], [ax + 13, ay - 3]], 0.6, 32), (x, y) => (x === Math.round(ax + 5) || y === Math.round(roofL + 7) ? col(r.wood, 0.85) : x === Math.round(ax + 11) && y === Math.round(roofL + 15) ? col(r.dry, 0.9) : col(r.wood, 0.45))));
    this.as(() => {
      for (const [k, px] of [[0, ax + 23], [1, ax + 39]] as const) {
        const cy = roofL + 11 + k;
        for (let dy = -5; dy <= 5; dy++) for (let dx = -5; dx <= 5; dx++) {
          const d = Math.hypot(dx, dy);
          if (d > 4.6) continue;
          const glass = r.lit ?? (dx + dy < -1 ? col(r.sea, 1) : dx + dy > 2 ? col(r.sea, 0.25) : col(r.sea, 0.6));
          this.put(px + dx, cy + dy, d > 3.1 ? col(r.dry, dx + dy < 0 ? 1 : 0.55) : glass);
        }
      }
    });
    this.buoy(ax + 55, roofL + 13);
    this.as(() => fill(this.put, [[bx - 8, roofR + 4], [bx - 2, by - 12], [bx - 3, by - 7], [bx - 9, roofR + 10]], () => r.lit ?? col(r.sea, 0.85)));
    // the roof: an overhanging varnished slab, crowned and a bit crooked
    this.as(() => fill(this.put, wonky([[ax - 4, roofL + 2], [ax - 4, roofL - 3], [(ax + bx) / 2, roofL - 5], [bx - 6, roofR - 3], [bx - 4, roofR + 1]], 0.5, 33), (x, y) => col(r.wood, y < roofL - 2 - ((x - ax) / (bx - ax)) * 2 ? 0.95 : 0.6)));
    // the funnel, bent back halfway up, its white band and black top flared
    const fx = ax + 30;
    this.as(() => {
      for (let k = 0; k <= 19; k++) {
        const off = k > 8 ? -((k - 8) ** 1.3) * 0.35 : 0;
        const half = k >= 17 ? 5 : 4;
        for (let dx = -half; dx < half; dx++) {
          const c = k >= 16 ? (dx < -1 ? col(r.stone, 0.3) : r.ink) : k === 11 || k === 12 ? col(r.hull, dx < 0 ? 1 : 0.7) : col(r.red, dx < -2 ? 0.85 : dx < 2 ? 0.6 : 0.4);
          this.put(fx + dx + off, roofL - 3 - k, c);
        }
      }
    });
    // a cowl vent on the foredeck turned to the wind, a coil of rope by the stem
    const [vx, vy] = this.gunwale(0.8);
    this.as(() => {
      stroke(this.put, vx - 1, vy + 2, vx - 1, vy - 7, col(r.hull, 0.8), 3);
      for (let dy = -4; dy <= 4; dy++) for (let dx = -4; dx <= 4; dx++) {
        const d = Math.hypot(dx, dy);
        if (d <= 4.4) this.put(vx + dx - 2, vy - 11 + dy, Math.hypot(dx + 1, dy) < 2.6 ? col(r.red, 0.45) : col(r.hull, dx + dy < 0 ? 1 : 0.7));
      }
    });
    const [cx, cy] = this.gunwale(0.9);
    this.coil(cx - 2, cy - 3, 6, 2.6);
    this.hull((x, y, d, up) => {
      if (up < 6) return col(r.red, up < 3 ? 0.3 : 0.55);
      if (up < 8) return col(r.hull, 0.45);
      if (d === 3) return col(r.hull, 0.5);
      if (d === 5 || d === 6) return col(r.red, d === 5 ? 0.75 : 0.55);
      if ((d - 6) % 5 === 0) return col(r.hull, 0.55);
      return tone(r.hull, 0.86 + 0.25 * (fbm(x / 9, y / 3, 2, 7) - 0.5), x, y);
    });
    this.rail(r.wood);
    this.pulpit(0.9, 1, 8, 3);
    this.fender(0.38, r.hull, 3, 9, 1);
    this.fender(0.6, r.hull, 4, 9, -1);
  }

  /**
   * The Prangli fisherman's rowing boat: tarred and clinker-built, high and round at both ends, a patch nailed on, an old
   * tyre for a fender; a net heaped in it and hanging over the side with its corks, a bucket, a fish crate with a tail
   * sticking out, two oars stood up crossed, and a short leaning mast with its brown sail brailed up to it.
   */
  private rowing(r: BoatRuns): void {
    this.inside(r.wood, 7);
    // two oars stood up crossed against the stern, their blades' tips painted red
    for (const [t, lean, tall] of [[0.1, -15, 66], [0.2, 9, 60]] as const) {
      const [ox, oy] = this.gunwale(t);
      const tx = ox + lean, ty = oy - tall;
      this.as(() => {
        stroke(this.put, ox - 1, oy + 4, tx - 1, ty + 8, col(r.wood, 0.85), 3);
        for (let k = 0; k <= 17; k++) {
          const half = k < 12 ? 3 : k < 15 ? 2 : 1;
          const cx = tx - (lean / tall) * (10 - k);
          for (let dx = -Math.round(half); dx <= Math.round(half); dx++) this.put(cx + dx, ty - 10 + k, k < 3 ? col(r.red, dx < 0 ? 0.75 : 0.55) : col(r.wood, dx < 0 ? 1 : 0.8));
        }
      });
    }
    // the bucket on the stern thwart, its handle up
    const [kx, ky] = this.gunwale(0.25);
    this.as(() => {
      fill(this.put, wonky([[kx - 5, ky - 9], [kx + 5, ky - 10], [kx + 4, ky + 2], [kx - 4, ky + 2]], 0.5, 41), (x, y) => (y <= ky - 9 ? col(r.stone, 0.95) : col(r.stone, x < kx - 1 ? 0.85 : x < kx + 2 ? 0.65 : 0.45)));
      trace(this.put, quad([kx - 4, ky - 10], [kx + 1, ky - 19], [kx + 5, ky - 11]), () => col(r.stone, 0.3));
    });
    // the mast, leaning forward, with the brown sail brailed to it in lumps under rope ties, its sprit standing up aft
    const top = this.mast(0.66, 3.0, 5, r.wood);
    const [mx, my] = this.gunwale(0.66);
    this.as(() => {
      for (let y = Math.round(top.y + 14); y <= my - 2; y++) {
        const u = (y - top.y) / (my - top.y);
        const cx = mx + (top.x - mx) * (1 - u);
        const half = 1.5 + 1.6 * Math.sin(Math.PI * Math.min(1, (u - 0.15) * 1.25)) + 0.6 * Math.sin(y / 2.7);
        for (let dx = -Math.round(half) - 1; dx <= Math.round(half); dx++) {
          const tie = (y + 3) % 7 === 0;
          this.put(cx + dx, y, tie ? col(r.dry, dx < 0 ? 0.9 : 0.6) : col(r.tar, dx < -half / 2 ? 0.6 : dx < 1 ? 0.42 : 0.28));
        }
      }
    });
    this.as(() => stroke(this.put, mx + 2, my - 4, top.x - 22, top.y + 6, col(r.wood, 0.75), 2));
    // the net heaped amidships: a dark mesh, its holes letting the boat through, a line of corks along its top
    const [nx, ny] = this.gunwale(0.45);
    const heap = (x: number, y: number): boolean => (x + y) % 3 === 0 || (x - y) % 3 === 0 || hash2(x, y, 43) > 0.85;
    this.as(() => {
      fill(this.put, wonky([[nx - 26, ny + 2], [nx - 20, ny - 8], [nx - 8, ny - 13], [nx + 6, ny - 11], [nx + 16, ny - 4], [nx + 20, ny + 2]], 1.5, 44), (x, y) => (heap(x, y) || y > ny - 2 ? col(r.tar, 0.15) : -1));
    });
    this.as(() => {
      const line = quad([nx - 24, ny - 3], [nx - 4, ny - 18], [nx + 18, ny - 3], 6);
      for (const [i, [fx, fy]] of line.entries()) for (let dy = -1; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) if (Math.abs(dx) + Math.abs(dy - 0.5) < 3.4) this.put(fx + dx, fy + dy, i === 3 ? col(r.red, dy <= 0 ? 0.85 : 0.6) : col(r.sponge, dy <= 0 && dx < 1 ? 1 : 0.8));
    });
    // the fish crate up forward, a tail and a head sticking out of it
    const [cx, cy] = this.gunwale(0.82);
    this.as(() => {
      for (let dy = -3; dy <= 3; dy++) for (let dx = -10; dx <= 10; dx++) {
        const yy = dy + dx * 0.15;
        if (Math.hypot(dx / 10, yy / 3.2) > 1) continue;
        this.put(cx + 2 + dx, cy - 13 + dy, dx === 7 && dy === -1 ? r.ink : col(yy < -1 ? r.stone : r.hull, yy < -1 ? 0.7 : yy < 1 ? 1 : 0.6));
      }
      fill(this.put, [[cx - 7, cy - 13], [cx - 13, cy - 19], [cx - 11, cy - 13], [cx - 14, cy - 8]], () => col(r.stone, 0.75));
    });
    this.as(() => fill(this.put, wonky([[cx - 8, cy + 2], [cx - 9, cy - 8], [cx + 9, cy - 9], [cx + 8, cy + 2]], 0.6, 45), (x, y) => (Math.round(y - cy) === -5 ? col(r.wood, 0.4) : col(r.wood, x < cx - 5 ? 0.95 : 0.75))));
    // the clinker hull: tarred planks overlapping, each lit at its lower edge and shaded under the one above
    this.hull((x, y, d, up) => {
      if (up < 5) return col(r.tar, 0.05);
      if (d < 3) return col(r.tar, 0.3);
      const p = Math.floor((d - 3) / 5), k = (d - 3) % 5;
      if (k === 4) return col(r.tar, 0);
      if (k === 3) return col(r.tar, 0.6 - p * 0.06);
      return tone(r.tar, 0.3 - p * 0.04 + 0.2 * (fbm(x / 11, p, 2, 9) - 0.5), x, y);
    });
    this.rail(r.shingle);
    // a patch of new wood nailed over a split plank
    const [px] = this.gunwale(0.58), pg = this.top(px);
    this.as(() => fill(this.put, [[px - 6, pg + 6], [px + 6, pg + 5], [px + 7, pg + 13], [px - 5, pg + 14]], (x, y) => ((x === Math.round(px - 4) || x === Math.round(px + 5)) && (y === pg + 7 || y === pg + 12) ? col(r.stone, 0.95) : col(r.wood, y < pg + 8 ? 0.85 : 0.65))));
    // the net's end hanging out over the rail, a cork at its foot
    this.as(() => fill(this.put, wonky([[nx - 14, pg - 1], [nx - 2, pg - 2], [nx - 4, pg + 6], [nx - 9, pg + 12], [nx - 12, pg + 5]], 0.8, 46), (x, y) => (heap(x, y) ? col(r.tar, 0.2) : -1)));
    this.as(() => { for (let dy = 0; dy <= 2; dy++) for (let dx = -1; dx <= 2; dx++) this.put(nx - 9 + dx, pg + 12 + dy, col(r.sponge, dy === 0 ? 1 : 0.7)); });
    // an old tyre on a rope for a fender
    const [tx] = this.gunwale(0.3), tg = this.top(tx);
    this.as(() => {
      stroke(this.put, tx, tg, tx + 1, tg + 4, col(r.dry, 0.5));
      for (let dy = -5; dy <= 5; dy++) for (let dx = -5; dx <= 5; dx++) {
        const d = Math.hypot(dx, dy);
        if (d <= 4.8 && d > 2) this.put(tx + 1 + dx, tg + 9 + dy, col(r.stone, dx + dy < -3 ? 0.45 : 0.15));
      }
    });
  }

  /**
   * The border guard's boat: a plain grey patrol boat (no marks), its fat tube with a grab line, a console with a
   * slanted windscreen and a jockey seat, a mast with a blue lamp and a bent whip aerial, two outboards on the stern.
   */
  private patrol(r: BoatRuns): void {
    this.inside(r.stone, 0);
    const [cx, cy] = this.gunwale(0.5);
    // the aerial, bent by the wind, and the mast on the console with its lamp
    this.as(() => trace(this.put, quad([cx + 8, cy - 30], [cx + 6, cy - 70], [cx - 8, cy - 92]), () => col(r.stone, 0.3)));
    const top = this.mast(0.47, 3.7, -3, r.stone, -30);
    this.as(() => {
      for (let dy = -4; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) this.put(top.x + dx, top.y + dy - 2, r.lit ?? (dx + dy < -2 ? col(r.sea, 1) : col(r.sea, 0.6)));
      stroke(this.put, top.x - 9, top.y + 14, top.x + 9, top.y + 13, col(r.stone, 0.6), 2);
    });
    // the jockey seat behind the console, the console, its windscreen
    this.as(() => fill(this.put, wonky([[cx - 26, cy + 2], [cx - 25, cy - 13], [cx - 17, cy - 14], [cx - 17, cy + 2]], 0.6, 51), (x, y) => (y < cy - 10 ? col(r.stone, 0.2) : col(r.stone, 0.45))));
    this.as(() => fill(this.put, wonky([[cx - 14, cy + 2], [cx - 13, cy - 24], [cx + 11, cy - 25], [cx + 16, cy + 2]], 0.8, 52), (x, y) => (y < cy - 21 ? col(r.stone, 0.95) : col(r.stone, x > cx + 6 ? 0.5 : 0.75))));
    this.as(() => fill(this.put, wonky([[cx - 10, cy - 24], [cx - 4, cy - 37], [cx + 13, cy - 38], [cx + 10, cy - 24]], 0.5, 53), (x, y) => (x + y < cx + cy - 52 ? col(r.sea, 1) : col(r.sea, 0.7))));
    // two outboards on the transom, hoods tipped a little
    const [ox, oy] = this.gunwale(0);
    for (const dx of [0, 9]) {
      this.as(() => fill(this.put, wonky([[ox - 4 + dx, oy + 12], [ox - 6 + dx, oy - 17], [ox + 6 + dx, oy - 19], [ox + 8 + dx, oy - 8], [ox + 4 + dx, oy + 12]], 0.6, 54 + dx), (x, y) => (y < oy - 15 ? col(r.stone, 0.85) : y < oy - 6 ? col(r.stone, x < ox + dx ? 0.55 : 0.35) : col(r.stone, 0.15))));
    }
    this.hull((x, y, d, up) => (up < 6 ? col(r.stone, 0.15) : d === 14 ? col(r.stone, 0.7) : col(r.stone, d < 14 ? 0.45 : 0.3)));
    // the fat tube along the top, its nose rounded at the bow, its ends past the transom; a grab line sagging along it
    const x0 = Math.round(this.X(-this.s.aft)) - 9, x1 = Math.round(this.X(this.s.long)) + 3;
    this.as(() => {
      for (let x = x0; x <= x1; x++) {
        const end = Math.min(x - x0, x1 - x) + 1;
        const rad = Math.min(6, 2 + end * 0.9);
        const mid = this.top(x) + 4 - (x1 - x < 6 ? (6 - (x1 - x)) * 0.5 : 0);
        for (let y = Math.round(mid - rad); y <= Math.round(mid + rad); y++) {
          const u = (y - mid) / rad;
          this.put(x, y, col(r.stone, u < -0.55 ? 0.95 : u < 0.05 ? 0.75 : u < 0.6 ? 0.55 : 0.3));
        }
        this.put(x, mid + rad + 1, col(r.sponge, 0.55));
        const loop = ((x - x0) % 16) / 16;
        if (x < x1 - 8) this.put(x, mid - 3 + Math.round(2.2 * Math.sin(Math.PI * loop)), col(r.stone, 0.2));
      }
    });
    const [lx, ly] = this.gunwale(0.86);
    this.coil(lx, ly - 4, 5, 2.2);
  }

  /**
   * A visitor's sailing boat: white with a blue stripe, a low cabin with slot windows and a handrail, a leaning mast with
   * its spreaders, its lamp and a pennant, the sail furled on the boom in lumps under red ties, a tiller, a pulpit and a
   * pushpit with a ring buoy, fenders over the side.
   */
  private sailing(r: BoatRuns): void {
    this.inside(r.wood);
    const top = this.mast(0.45, 4.2, 3, r.stone);
    const [sx, sy] = this.gunwale(0.03), [bx, by] = this.gunwale(0.99), [mx, my] = this.gunwale(0.45);
    const along = (u: number): [number, number] => [mx + (top.x - mx) * u, my + (top.y - my) * u];
    const spread = along(0.62), gooseneck = along(0.2);
    const boomEnd: [number, number] = [this.gunwale(0.06)[0], gooseneck[1] - 3];
    this.as(() => {
      // the stays fore and aft, the topping lift to the boom's end, the spreaders and the shrouds
      stroke(this.put, top.x, top.y, bx, by - 2, col(r.stone, 0.3));
      stroke(this.put, top.x, top.y, sx, sy - 2, col(r.stone, 0.3));
      stroke(this.put, top.x, top.y, boomEnd[0], boomEnd[1], col(r.stone, 0.3));
      stroke(this.put, spread[0] - 7, spread[1] + 1, spread[0] + 7, spread[1] - 1, col(r.stone, 0.4));
    });
    this.as(() => { for (let dy = -2; dy <= 1; dy++) for (let dx = 1; dx <= 4; dx++) this.put(top.x + dx, top.y - 2 + dy, r.lit ?? col(r.hull, 1)); });
    this.pennant({ x: top.x - 1, y: top.y - 5 }, r.red, 15, 6);
    // the boom with the sail furled on it: a lumpy white sausage fattest at the mast, red ties round it
    this.as(() => {
      stroke(this.put, boomEnd[0], boomEnd[1] + 4, gooseneck[0], gooseneck[1] + 4, col(r.stone, 0.4), 2);
      for (let x = Math.round(boomEnd[0]); x <= gooseneck[0] + 2; x++) {
        const u = (x - boomEnd[0]) / (gooseneck[0] - boomEnd[0]);
        const base = boomEnd[1] + (gooseneck[1] - boomEnd[1]) * u + 3;
        const fat = 3 + 5 * u ** 0.7 + 1.3 * Math.sin(x / 4.5) ** 2;
        const tie = Math.round(x - boomEnd[0]) % 11 === 5;
        for (let y = Math.round(base - fat); y <= base; y++) this.put(x, y, tie ? col(r.red, y < base - fat + 2 ? 0.8 : 0.55) : col(r.hull, y < base - fat + 2 ? 1 : y < base - 1 ? 0.75 : 0.5));
      }
    });
    // the cabin: low, its front sloped, slot windows and a wooden handrail on its roof
    const [ax, ay] = this.gunwale(0.28), [fx, fy] = this.gunwale(0.64);
    this.as(() => fill(this.put, wonky([[ax, ay + 3], [ax + 2, ay - 11], [fx - 12, fy - 11], [fx, fy + 1]], 0.8, 61), (x, y) => {
      const wy = Math.round(ay - 6 + ((x - ax) / (fx - ax)) * (fy - ay) * 0.6);
      if ((y === wy || y === wy + 1) && x > ax + 6 && x < fx - 12 && (x - ax) % 18 < 13) return r.lit ?? (y === wy && (x - ax) % 18 === 2 ? col(r.sea, 0.9) : col(r.sea, 0.1));
      return y < Math.min(ay, fy) - 9 ? col(r.hull, 1) : col(r.hull, 0.78);
    }));
    this.as(() => stroke(this.put, ax + 6, ay - 14, fx - 16, fy - 14, col(r.wood, 0.7), 2));
    // the tiller rising from the stern
    this.as(() => stroke(this.put, sx + 4, sy - 1, sx + 26, sy - 10, col(r.wood, 0.85), 2));
    this.hull((x, y, d, up) => {
      if (up < 5) return col(r.red, 0.35);
      if (up < 9) return col(r.sea, up === 8 ? 0.85 : 0.55);
      if (d === 3) return col(r.hull, 0.5);
      if (d === 5) return col(r.red, 0.6);
      return tone(r.hull, 0.86 + 0.2 * (fbm(x / 9, y / 3, 2, 17) - 0.5), x, y);
    });
    this.rail(r.wood);
    this.pulpit(0.92, 1, 9, 3);
    this.pulpit(0, 0.08, 10, 3);
    const [px, py] = this.gunwale(0.05);
    this.buoy(px, py - 4, 5, 2.2);
    this.fender(0.3, r.sea, 3, 8, 1);
    this.fender(0.52, r.sea, 2, 8, 0);
    this.fender(0.72, r.sea, 4, 8, -2);
  }

  /**
   * An islander's or a visitor's open motorboat: riveted aluminium with a dent, a crooked windscreen, a red fuel can, a
   * little yellow flag on a whip at the bow, a fender askew, an outboard tipped on the transom with its red hood.
   */
  private motor(r: BoatRuns): void {
    this.inside(r.shingle, 0);
    // the flag on its whip at the bow
    const [bx, by] = this.gunwale(0.95);
    this.as(() => trace(this.put, quad([bx, by], [bx + 1, by - 16], [bx - 3, by - 30]), () => col(r.stone, 0.3)));
    this.pennant({ x: bx - 3, y: by - 31 }, r.sponge, 10, 5);
    // the windscreen, its frame and the seat behind it
    const [cx, cy] = this.gunwale(0.58);
    this.as(() => fill(this.put, wonky([[cx - 16, cy + 2], [cx - 16, cy - 8], [cx - 8, cy - 9], [cx - 8, cy + 2]], 0.5, 71), () => col(r.wood, 0.5)));
    this.as(() => fill(this.put, wonky([[cx - 5, cy + 1], [cx, cy - 15], [cx + 14, cy - 17], [cx + 13, cy + 1]], 0.7, 72), (x, y) => (x + y < cx + cy - 12 ? col(r.sea, 1) : col(r.sea, 0.75))));
    // the fuel can by the stern
    const [fx, fy] = this.gunwale(0.16);
    this.as(() => fill(this.put, wonky([[fx - 6, fy + 2], [fx - 6, fy - 8], [fx + 2, fy - 9], [fx + 5, fy - 6], [fx + 5, fy + 2]], 0.4, 73), (x, y) => (y < fy - 7 ? col(r.red, 0.9) : col(r.red, x < fx - 3 ? 0.75 : 0.55))));
    this.hull((x, y, d, up) => {
      if (up < 5) return col(r.shingle, 0);
      if (d === 3) return col(r.shingle, 0.3);
      const seam = (d - 3) % 7 === 0;
      if (seam) return x % 4 === 0 ? col(r.shingle, 1) : col(r.shingle, 0.15);
      return tone(r.shingle, 0.62 + 0.2 * (fbm(x / 10, y / 4, 2, 27) - 0.5), x, y);
    });
    this.rail(r.shingle);
    // a dent in the side, its lit lower lip
    const [dx0] = this.gunwale(0.42), dg = this.top(dx0);
    this.as(() => {
      for (let dy = -3; dy <= 3; dy++) for (let dx = -6; dx <= 6; dx++) {
        if (Math.hypot(dx / 6, dy / 3) > 1) continue;
        this.put(dx0 + dx, dg + 11 + dy, dy > 1 ? col(r.shingle, 0.95) : col(r.shingle, 0.4));
      }
    });
    this.fender(0.7, r.red, 2, 8, 3);
    // the outboard, tipped back on the transom: its leg down past the stern, its red hood, the tiller arm
    const [ox, oy] = this.gunwale(0);
    this.as(() => fill(this.put, [[ox - 1, oy - 2], [ox + 3, oy - 2], [ox + 1, oy + 16], [ox - 3, oy + 16]], (x) => col(r.stone, x < ox ? 0.45 : 0.25)));
    this.as(() => stroke(this.put, ox + 6, oy - 8, ox + 18, oy - 12, col(r.stone, 0.3), 2));
    this.as(() => fill(this.put, wonky([[ox - 6, oy - 2], [ox - 8, oy - 13], [ox - 2, oy - 18], [ox + 8, oy - 16], [ox + 9, oy - 4]], 0.6, 74), (x, y) => (y < oy - 14 ? col(r.red, 0.95) : y > oy - 5 ? col(r.stone, 0.4) : col(r.red, x < ox - 2 ? 0.7 : 0.5))));
  }

  /**
   * A railing from column `x0` to `x1`, standing on `foot` (the near gunwale unless told): fat posts of uneven height,
   * each leaning its own way, one snapped short, the top rail sagging from post to post.
   */
  private fence(x0: number, x1: number, c: readonly number[], seed: number, foot: (x: number) => number = (x) => this.top(x)): void {
    this.as(() => {
      const n = Math.max(2, Math.round((x1 - x0) / 10));
      const tops: [number, number][] = [];
      for (let i = 0; i <= n; i++) {
        const x = Math.round(x0 + ((x1 - x0) * i) / n + (hash2(i, seed, 85) - 0.5) * 3);
        const g = Math.round(foot(x));
        const snapped = i > 0 && i < n && hash2(i, seed, 86) > 0.78;
        const tall = snapped ? 6 : 11 + Math.round(hash2(i, seed, 87) * 3);
        const lean = Math.round((hash2(i, seed, 88) - 0.5) * 5);
        for (let k = 0; k <= tall; k++) {
          const cx = x + Math.round((lean * k) / tall);
          for (let dx = -1; dx <= 2; dx++) this.put(cx + dx, g - k, col(c, dx < 1 ? 0.95 : 0.6));
        }
        if (!snapped) tops.push([x + lean, g - tall]);
      }
      const first = tops[0]!, last = tops[tops.length - 1]!;
      const along: [number, number][] = [[first[0] - 4, first[1] + 1], ...tops, [last[0] + 5, last[1] + 1]];
      for (let i = 0; i + 1 < along.length; i++) {
        const a = along[i]!, b = along[i + 1]!;
        for (const [x, y] of quad(a, [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2 + 2.5], b, 16)) for (let k = -1; k <= 2; k++) for (let dx = 0; dx <= 1; dx++) this.put(x + dx, y + k, col(c, k <= 0 ? 1 : 0.6));
      }
    });
  }

  /** A disc of radius `rad`, each pixel's colour from `colour` (its place from the middle). */
  private disc(cx: number, cy: number, rad: number, colour: (dx: number, dy: number) => number): void {
    for (let dy = -Math.ceil(rad); dy <= Math.ceil(rad); dy++) for (let dx = -Math.ceil(rad); dx <= Math.ceil(rad); dx++) if (Math.hypot(dx, dy) <= rad) this.put(cx + dx, cy + dy, colour(dx, dy));
  }

  /**
   * A houseboat (a boat in the 1991 game's manner; ours, not theirs): a tubby old tub with a
   * crooked red cottage on its deck, white boards at its corners, a sagging tarred roof with patches nailed on and a
   * lean-to galley whose stovepipe is bent and capped and smoking; a door, three windows no two alike (lit at night), a
   * shutter hanging by one hinge, a flower box; the washing on a line to a pole with a bird's house on it, a barrel, an
   * anchor, railings of uneven posts, and at the bow a grey seal's head carved in wood, a red scarf round its neck.
   */
  private houseboat(r: BoatRuns): void {
    const W = this.water;
    this.inside(r.wood, 11);
    // the rudder hung on the stern, a barn door of a thing
    const [qx, qy] = this.gunwale(0);
    this.as(() => fill(this.put, wonky([[qx + 3, qy + 3], [qx - 6, qy + 8], [qx - 7, W + 3], [qx + 14, W + 3]], 0.8, 81), (x) => col(r.wood, x < qx - 3 ? 0.5 : 0.3)));
    // the pole at the stern with a bird's house on its top: the cottage again, very small
    const pole = this.mast(0.07, 3.35, -4, r.wood);
    this.as(() => {
      const bx = Math.round(pole.x), by = Math.round(pole.y) - 2;
      for (let dy = 0; dy <= 9; dy++) for (let dx = -5; dx <= 4; dx++) {
        const hole = Math.hypot(dx + 0.5, dy - 4.5) < 1.6;
        this.put(bx + dx, by - dy, hole ? r.ink : dy === 0 ? col(r.wood, 0.7) : col(r.red, dx < 0 ? 0.55 : 0.4));
      }
      for (let k = 0; k <= 6; k++) for (let dx = -8 + k; dx <= 7 - k; dx++) this.put(bx + dx + (k > 3 ? 1 : 0), by - 10 - k, col(r.stone, k === 0 ? 0.05 : dx < -1 ? 0.45 : 0.2));
      // its perch
      for (let dx = 0; dx <= 4; dx++) for (let dy = 0; dy <= 2; dy++) this.put(bx + 4 + dx, by - 2 + dy, col(r.wood, 0.8));
    });

    // the cottage's corners and lines: it leans aft, its walls of uneven height, its eave sagging between
    const a0 = Math.round(this.X(2.0)), a1 = Math.round(this.X(4.9)), b1 = Math.round(this.X(5.8));
    const d0 = this.top(a0), d1 = this.top(a1), d2 = this.top(b1);
    const base = Math.max(d0, d1, d2) + 4, lean = -4;
    const eL = d0 - 41, eR = d1 - 37;
    const eave = (x: number): number => eL + ((eR - eL) * (x - a0)) / (a1 - a0) + 2.5 * Math.sin((Math.PI * (x - a0)) / (a1 - a0));
    const shift = (y: number): number => (lean * (base - y)) / (base - eL);
    const glass = (x: number, y: number, cx: number, cy: number): number => r.lit ?? (x - cx + (y - cy) < -1 ? col(r.sea, 1) : x - cx + (y - cy) > 2 ? col(r.sea, 0.2) : col(r.sea, 0.6));
    const red = (x: number, y: number, seed: number): number => tone(r.red, 0.53 + 0.3 * (fbm(x / 9, y / 6, 2, seed) - 0.5), x, y);

    // the washing on its line from the pole to the eave: a sock, a shirt, long johns, another sock (not its pair); each
    // painted hanging straight down, since the game swings it on the wind (`blown`)
    const line = quad([pole.x + 1, pole.y + 10], [(pole.x + a0) / 2, pole.y + 19], [a0 - 6 + lean, eL + 3], 44);
    this.as(() => trace(this.put, line, () => col(r.dry, 0.2)));
    const hang = (u: number, rows: readonly (readonly [number, number])[], colour: (dx: number, k: number) => number): void => {
      const [hx, hy] = line[Math.round(u * 44)]!;
      this.as(() => {
        for (const [k, [l, rr]] of rows.entries()) {
          for (let dx = l; dx <= rr; dx++) this.put(Math.round(hx) + dx, Math.round(hy) + k, colour(dx, k));
        }
      });
    };
    this.blown('hang', () => hang(0.13, [[0, 4], [0, 4], [0, 4], [0, 4], [0, 4], [0, 4], [0, 4], [0, 7], [0, 8], [0, 8], [1, 7]], (dx, k) => (k < 3 ? col(r.hull, 1) : dx > 5 ? col(r.red, 0.6) : col(r.sponge, dx < 2 ? 0.8 : 0.62))));
    this.blown('hang', () => hang(0.36, [[-3, 11], [-4, 12], [-4, 12], [-4, 12], [0, 8], [0, 8], [0, 8], [0, 8], [0, 8], [0, 8], [0, 9], [0, 9], [1, 8]], (dx, k) => (k === 0 && (dx === 4 || dx === 5) ? -1 : dx === 4 && k > 1 && k % 3 === 0 ? col(r.red, 0.6) : col(r.hull, dx > 6 || k > 10 ? 0.72 : 1))));
    // the long johns: both legs are one thing on the wind
    this.blown('hang', () => {
      hang(0.62, [[0, 9], [0, 9], [0, 9], [0, 9], [0, 9], [0, 4], [0, 3], [0, 3], [0, 3], [0, 3], [0, 3], [0, 3], [0, 3], [0, 3]], (dx, k) => (k % 4 > 1 ? col(r.hull, 1) : col(r.red, dx < 2 ? 0.7 : 0.5)));
      hang(0.62, [[0, -1], [0, -1], [0, -1], [0, -1], [0, -1], [6, 9], [6, 9], [6, 9], [6, 9], [6, 9], [6, 9], [6, 9], [6, 9]], (dx, k) => (k % 4 > 1 ? col(r.hull, 1) : col(r.red, dx < 8 ? 0.7 : 0.5)));
    });
    this.blown('hang', () => hang(0.85, [[0, 4], [0, 4], [0, 4], [0, 4], [0, 4], [0, 4], [-3, 4], [-4, 4], [-3, 4]], (dx, k) => (k < 2 ? col(r.red, 0.6) : col(r.stone, dx < 1 ? 0.8 : 0.6))));

    // a barrel on the foredeck
    const kx = Math.round(this.X(6.3)), kg = this.top(kx);
    this.as(() => fill(this.put, wonky([[kx - 6, kg + 2], [kx - 8, kg - 7], [kx - 6, kg - 16], [kx + 5, kg - 17], [kx + 8, kg - 8], [kx + 6, kg + 2]], 0.5, 82), (x, y) => {
      if (y <= kg - 14) return col(r.wood, 0.95);
      if (y === kg - 11 || y === kg - 3) return col(r.stone, 0.25);
      return col(r.wood, x < kx - 3 ? 0.8 : x < kx + 3 ? (x % 4 === 0 ? 0.4 : 0.62) : 0.42);
    }));

    // the stove pipe's place on the roof (drawn later); no smoke from it (remove the boats' smoke)
    const px0 = a1 + 13, roofAt = (x: number): number => d1 - 33 + ((d2 - 21 - (d1 - 33)) * (x - a1)) / (b1 + 6 - a1);
    const pBase = Math.round(roofAt(px0)), pTop = pBase - 43;
    const bend = (k: number): number => (k < 22 ? (k * 3) / 22 : 3 - ((k - 22) * 7) / 21);

    // the cottage's wall: red boards upright, the white boards at its corners, the eave's shade
    this.as(() => fill(this.put, wonky([[a0, base], [a0 + lean, eL], [(a0 + a1) / 2 + lean, (eL + eR) / 2 + 2], [a1 + lean + 2, eR], [a1 + 1, base]], 0.9, 83), (x, y) => {
      const xs = x - shift(y);
      if (xs < a0 + 4) return col(r.hull, 1);
      if (xs > a1 - 3) return col(r.hull, 0.72);
      if (y < eave(x) + 6) return col(r.red, 0.2);
      if (Math.round(xs - a0) % 6 === 0) return col(r.red, y % 9 === 3 ? 0.5 : 0.25);
      return red(x, y, 84);
    }));
    // the door: a white frame, a blue-grey leaf of three boards with a little window cut in it, a knob
    const dx0 = a0 + 7 + Math.round(shift(d0 - 12));
    this.as(() => fill(this.put, wonky([[dx0 - 1, d0 + 2], [dx0 - 2, d0 - 28], [dx0 + 15, d0 - 30], [dx0 + 15, d0 + 2]], 0.4, 85), (x) => col(r.hull, x < dx0 + 8 ? 1 : 0.8)));
    this.as(() => fill(this.put, [[dx0 + 2, d0 + 2], [dx0 + 1, d0 - 25], [dx0 + 12, d0 - 26], [dx0 + 12, d0 + 2]], (x, y) => {
      if (Math.abs(x - dx0 - 6.5) + Math.abs(y - (d0 - 19)) < 3) return glass(x, y, dx0 + 6, d0 - 19);
      if (x === dx0 + 10 && (y === d0 - 11 || y === d0 - 12)) return col(r.dry, 1);
      if (x === dx0 + 5 || x === dx0 + 8) return col(r.hull, 0.12);
      return col(r.hull, x < dx0 + 5 ? 0.42 : 0.32);
    }));
    // the wide window: its frame askew, two panes, a sill, a box of flowers under it
    const w0 = a0 + 28 + Math.round(shift(d0 - 20)), wy = d0 - 30;
    this.as(() => {
      fill(this.put, wonky([[w0, wy + 1], [w0 + 18, wy - 1], [w0 + 18, wy + 13], [w0, wy + 14]], 0.4, 86), (x, y) => col(r.hull, y < wy + 3 || x < w0 + 3 ? 1 : 0.8));
      fill(this.put, [[w0 - 2, wy + 13], [w0 + 20, wy + 12], [w0 + 20, wy + 16], [w0 - 2, wy + 17]], (x, y) => col(r.hull, y < wy + 15 ? 1 : 0.7));
    });
    this.as(() => fill(this.put, [[w0 + 3, wy + 3], [w0 + 15, wy + 2], [w0 + 15, wy + 10], [w0 + 3, wy + 11]], (x, y) => (x === w0 + 9 ? col(r.hull, 0.9) : glass(x, y, x < w0 + 9 ? w0 + 6 : w0 + 12, wy + 6))));
    this.as(() => {
      // the flowers: round blooms, white and yellow, crowded over dark leaves
      for (let x = w0 - 1; x <= w0 + 19; x++) {
        const tall = 4 + (hash2(x >> 1, 3, 87) > 0.5 ? 1 : 0);
        for (let k = 0; k <= tall; k++) {
          const bloom = hash2(x >> 1, k >> 1, 88);
          this.put(x, wy + 18 - k, k > 0 && bloom > 0.36 ? (bloom > 0.7 ? col(r.sponge, 0.8) : col(r.hull, 1)) : col(r.dry, 0));
        }
      }
      fill(this.put, [[w0 - 2, wy + 19], [w0 + 20, wy + 18], [w0 + 19, wy + 24], [w0 - 1, wy + 24]], (x, y) => col(r.wood, y < wy + 21 ? 0.85 : 0.55));
    });
    // its shutter, hanging by one hinge
    this.as(() => fill(this.put, [[w0 + 21, wy], [w0 + 28, wy + 3], [w0 + 25, wy + 17], [w0 + 18, wy + 14]], (x, y) => ((y - Math.round((x - w0) * 0.4)) % 3 === 0 ? col(r.hull, 0.12) : col(r.hull, 0.4))));
    // the tall window, narrow and crooked, a bar across it
    const t0 = a0 + 59 + Math.round(shift(d0 - 22)), ty = d1 - 33;
    this.as(() => fill(this.put, wonky([[t0, ty + 2], [t0 + 11, ty], [t0 + 12, ty + 22], [t0 + 1, ty + 23]], 0.4, 89), (x, y) => col(r.hull, y < ty + 4 || x < t0 + 3 ? 1 : 0.8)));
    this.as(() => fill(this.put, [[t0 + 3, ty + 4], [t0 + 9, ty + 3], [t0 + 9, ty + 19], [t0 + 4, ty + 20]], (x, y) => (y === ty + 9 ? col(r.hull, 0.9) : glass(x, y, t0 + 6, y < ty + 9 ? ty + 6 : ty + 14))));

    // the lean-to galley at the cottage's fore end, its round window
    const gT = d1 - 30, gB = d2 - 20;
    this.as(() => fill(this.put, wonky([[a1 + 1, base], [a1 + 1, gT], [b1 - 1, gB], [b1, base]], 0.7, 90), (x, y) => {
      if (x > b1 - 4) return col(r.hull, 0.72);
      if (y < roofAt(x) + 8) return col(r.red, 0.2);
      if ((x - a1) % 6 === 3) return col(r.red, 0.25);
      return red(x, y, 91);
    }));
    const gx = Math.round((a1 + b1) / 2), gy = Math.round((d1 + d2) / 2) - 11;
    this.as(() => this.disc(gx, gy, 5.7, (dx, dy) => col(r.hull, dx + dy < 0 ? 1 : 0.8)));
    this.as(() => this.disc(gx, gy, 3.3, (dx, dy) => glass(gx + dx, gy + dy, gx, gy)));
    // its roof, a tarred slab sloping to the bow
    this.as(() => fill(this.put, wonky([[a1 - 2, d1 - 33], [b1 + 6, d2 - 21], [b1 + 7, d2 - 16], [a1 - 2, d1 - 27]], 0.6, 92), (x, y) => {
      const k = y - roofAt(x);
      return col(r.stone, k < 2 ? 0.5 : (x - a1) % 9 === 4 ? 0.05 : 0.22);
    }));
    // the cottage's roof: tarred felt in strips, its ridge sagging like an old horse's back, its ends kicked up
    const mid = (a0 + a1) / 2 + lean;
    const ridge = (x: number): number => eL - 17 + ((eR - 17 - (eL - 17)) * (x - a0)) / (a1 - a0) + 6 * Math.sin((Math.PI * (x - a0 + 6)) / (a1 - a0 + 12)) ** 0.8;
    const roof: Pt[] = [[a0 - 10 + lean, eL + 5], [a0 - 5 + lean, eL - 17], ...Array.from({ length: 9 }, (_, i): Pt => { const x = a0 + lean + ((a1 - a0) * (i + 1)) / 10; return [x, ridge(x - lean)]; }), [a1 + 4 + lean, eR - 18], [a1 + 9 + lean, eR + 5], [mid + 10, (eL + eR) / 2 + 8], [mid - 14, (eL + eR) / 2 + 9]];
    this.as(() => fill(this.put, wonky(roof, 0.8, 93), (x, y) => {
      const top = ridge(Math.max(a0, Math.min(a1, x - lean))), v = (y - top) / (eave(Math.max(a0, Math.min(a1, x))) + 6 - top);
      if (v > 0.86) return col(r.stone, 0.05);
      const strip = Math.round(x + (y - eL) * 0.22 - a0);
      if (((strip % 12) + 12) % 12 === 0) return col(r.stone, 0.02);
      if (((strip % 12) + 12) % 12 === 1) return col(r.stone, v < 0.3 ? 0.6 : 0.42);
      return tone(r.stone, v < 0.28 ? 0.5 : 0.25 + 0.12 * (fbm(x / 8, y / 5, 2, 94) - 0.5), x, y);
    }));
    // the patches on the roof: a square of new board, a sheet of tin, nailed at their corners
    const patch = (cx: number, cy: number, w: number, h: number, run: readonly number[], hi: number, seed: number): void => {
      this.as(() => fill(this.put, wonky([[cx, cy], [cx + w, cy - 2], [cx + w + 1, cy + h - 1], [cx + 1, cy + h]], 0.5, seed), (x, y) => {
        const nail = (Math.round(x - cx) === 2 || Math.round(x - cx) === w - 2) && (Math.round(y - cy) === 2 || Math.round(y - cy) === h - 3);
        return nail ? r.ink : col(run, y < cy + h / 2 ? hi : hi - 0.2);
      }));
    };
    patch(a0 + 16 + lean, eL - 9, 11, 9, r.wood, 0.85, 95);
    patch(a0 + 46 + lean, Math.round((eL + eR) / 2) - 6, 9, 8, r.shingle, 0.8, 96);

    // the stovepipe out of the galley's roof: tin, rusty, kinked at its joint, a wire to the ridge, a pointed cap on legs
    this.as(() => stroke(this.put, px0 + bend(30), pBase - 30, a1 + 2 + lean, eR - 17, col(r.stone, 0.2)));
    this.as(() => {
      for (let k = -2; k <= 43; k++) {
        const cx = Math.round(px0 + bend(Math.max(0, k)));
        const joint = k === 21 || k === 22 || k === 23, foot = k < 2;
        const half = joint || foot ? 4 : 3;
        for (let dx = -half; dx <= half - 1; dx++) {
          const rust = (k > 7 && k < 12) || hash2(dx, k, 97) > 0.9;
          this.put(cx + dx, pBase - k, joint || foot ? col(r.stone, dx < 0 ? 0.55 : 0.3) : rust ? col(r.sponge, dx < 0 ? 0.35 : 0.2) : col(r.shingle, dx < -1 ? 1 : dx < 1 ? 0.6 : 0.2));
        }
      }
      const cx = Math.round(px0 + bend(43));
      for (const dx of [-3, 2]) for (let k = 1; k <= 3; k++) this.put(cx + dx, pTop - k, col(r.stone, 0.2));
      for (let k = 0; k <= 6; k++) for (let dx = -8 + k; dx <= 7 - k; dx++) this.put(cx + dx - (k > 3 ? 1 : 0), pTop - 4 - k, col(r.shingle, k === 0 ? 0.1 : dx < -1 ? 0.95 : 0.5));
    });

    // the tiller, rising over the afterdeck from the rudder's head
    this.as(() => stroke(this.put, qx + 1, qy, qx + 24, qy - 9, col(r.wood, 0.9), 3));

    // the hull: tarred at the water, old planks nailed butt to butt, a rubbing strake, the top strake's blue-grey paint
    // peeling to the wood
    this.hull((x, y, d, up) => {
      if (up < 6) return col(r.tar, 0.03);
      if (d < 3) return col(r.hull, 0.3);
      if (d < 12) return fbm(x / 6, y / 2.5, 2, 98) > 0.67 ? col(r.wood, d < 7 ? 0.6 : 0.45) : tone(r.hull, 0.38 + 0.14 * (fbm(x / 15, y / 4, 2, 99) - 0.5), x, y);
      if (d < 16) return col(r.wood, d === 12 ? 0.05 : d === 13 ? 0.95 : d === 14 ? 0.7 : 0.1);
      const p = Math.floor((d - 16) / 6), k = (d - 16) % 6, butt = (((x + p * 19) % 43) + 43) % 43;
      if (k === 5) return col(r.wood, 0.05);
      if (butt === 0) return col(r.wood, 0.1);
      if ((butt === 2 || butt === 41) && (k === 1 || k === 3)) return col(r.shingle, 0.9);
      return tone(r.wood, 0.42 - p * 0.05 + 0.16 * (fbm(x / 14, p * 3, 2, 100) - 0.5), x, y);
    });
    this.rail(r.wood);
    // a sheet of tin and a new board nailed over the old planks
    const [tx] = this.gunwale(0.4), tg = this.top(tx);
    this.as(() => fill(this.put, wonky([[tx - 7, tg + 5], [tx + 6, tg + 4], [tx + 7, tg + 14], [tx - 6, tg + 15]], 0.5, 101), (x, y) => ((x === Math.round(tx - 4) || x === Math.round(tx + 4)) && (y === tg + 7 || y === tg + 12) ? r.ink : col(r.shingle, y < tg + 9 ? 0.85 : 0.55))));
    const [nx] = this.gunwale(0.63), ng = this.top(nx);
    this.as(() => fill(this.put, wonky([[nx - 9, ng + 9], [nx + 8, ng + 7], [nx + 9, ng + 14], [nx - 8, ng + 16]], 0.5, 102), (x, y) => ((x === Math.round(nx - 6) || x === Math.round(nx + 6)) && y === ng + 11 ? r.ink : col(r.wood, y < ng + 11 ? 0.9 : 0.7))));
    // the anchor hung under the bow
    const [ax] = this.gunwale(0.86), ag = this.top(ax);
    this.as(() => {
      for (let k = 0; k <= 15; k++) for (let dx = -1; dx <= 1; dx++) this.put(ax + dx, ag + 5 + k, col(r.stone, dx === 0 ? 0.7 : 0.3));
      for (let dx = -4; dx <= 4; dx++) for (let dy = 0; dy <= 2; dy++) this.put(ax + dx, ag + 7 + dy, col(r.stone, dy === 1 ? 0.7 : 0.3));
      for (let dx = -7; dx <= 7; dx++) {
        const rise = Math.round((dx * dx) / 9);
        for (let dy = 0; dy <= 3; dy++) this.put(ax + dx, ag + 20 - rise - dy + 1, col(r.stone, dy === 2 ? 0.7 : 0.3));
      }
    });
    this.fender(0.5, r.dry, 3, 9, 2);
    // the railings fore and aft
    this.fence(this.X(0.35), this.X(1.6), r.hull, 1);
    this.fence(this.X(6.0), this.X(7.05), r.hull, 2);

    // the figurehead: a grey seal's head on its thick neck, carved from one log and stood on the stem, looking out
    // over the bow; its long nose, its round dark eye, its whiskers, spots on its back, a red kerchief round its neck
    const [fx, fy] = this.gunwale(1).map(Math.round) as [number, number];
    const seal: Pt[] = [[-13, 6], [-13, -4], [-11, -14], [-8, -22], [-4, -28], [2, -31], [9, -30], [15, -27], [20, -23], [22, -20], [22, -17], [19, -14], [12, -12], [8, -9], [7, -3], [8, 4], [5, 10], [-5, 11]];
    // the eye with its glint, the nose, the mouth's line turned up at its end; the pale muzzle with its whisker dots
    const face = (dx: number, dy: number): number | null => {
      if (Math.hypot(dx - 8.5, dy + 23.5) < 2.1) return dx < 8.5 && dy < -23.5 ? col(r.hull, 1) : r.ink;
      if (dx >= 19 && dy <= -19 && dy >= -22) return r.ink;
      if ((dy === -16 && dx >= 12 && dx < 20) || (dy === -17 && dx === 11) || (dy === -18 && dx === 10)) return col(r.stone, 0);
      if (dx > 12 && dy > -23 && dy < -16) return (dx === 15 || dx === 17) && (dy === -19 || dy === -21) ? col(r.stone, 0.2) : col(r.stone, 0.92);
      return null;
    };
    // the kerchief: a band round the neck, its end down the back; under it the log's foot, left as wood
    const kerchief = (dx: number, dy: number): number | null => {
      const band = dy - dx * 0.2;
      if (band > -9.5 && band < -4.5) return col(r.red, band < -7.5 ? 0.75 : 0.55);
      if (dx < -8 && dy >= -7 && dy < 2) return col(r.red, dx < -11 ? 0.7 : 0.5);
      if (dy > 4) return col(r.wood, dy === 5 ? 0.9 : 0.55);
      return null;
    };
    this.as(() => {
      fill(this.put, seal.map(([x, y]) => [fx + x, fy + y] as const), (x, y) => {
        const dx = x - fx, dy = y - fy;
        const marked = face(dx, dy) ?? kerchief(dx, dy);
        if (marked !== null) return marked;
        // the jaw's shade and the pale throat
        if (dx > 9 && dy >= -16) return col(r.stone, 0.4);
        if (dx > 1 + (dy + 12) * -0.2 && dy > -13) return col(r.stone, 0.85);
        // the back: lit along its top, shaded behind, spotted
        if (hash2(x >> 1, (y + (x >> 1)) >> 1, 103) > 0.74 && dx < 6 + (dy + 28) * 0.4) return col(r.stone, 0.28);
        return col(r.stone, dy < -25 + Math.abs(dx - 3) * 0.45 ? 0.8 : dx < -7 ? 0.45 : 0.62);
      });
      for (const [wx, wy2] of [[15, -9], [20, -9], [24, -13]] as const) stroke(this.put, fx + 17, fy - 17, fx + wx, fy + wy2, col(r.hull, 1));
    });
  }

  /**
   * A stubby galleon (ours, in the 1991 game's manner): short and fat and tarred, one blue-grey
   * band and white rails along it, a tall stern castle leaning back with a carved sun's face between two little lattice
   * windows (lit at night), a balustrade and a wheel on its top and a lantern hung over the stern; a fat mast bound
   * with rope, a tub of a crow's nest, a pennant, a patched sail furled on a slanting yard, rope shrouds made fast to
   * big wooden deadeyes, a ladder to the castle, a bowsprit with a knob on its end. No letter, no arms.
   * The teacher's boat for now (for now the galley is the one the teacher uses).
   */
  private galleon(r: BoatRuns): void {
    const W = this.water;
    const s = this.s;
    this.inside(r.wood, 9);
    const [qx, qy] = this.gunwale(0);
    // the rudder
    this.as(() => fill(this.put, wonky([[qx + 3, qy + 6], [qx - 4, qy + 10], [qx - 5, W + 3], [qx + 12, W + 3]], 0.7, 111), (x) => col(r.stone, x < qx ? 0.3 : 0.15)));

    // the mast: fat, leaning aft a little, bound with rope every so often; above the crow's nest a thin topmast
    const [mx, my] = this.gunwale(0.6);
    const nest = W - 101, mastAt = (y: number): number => mx - ((my - y) * 4) / (my - nest);
    const top = { x: Math.round(mastAt(4)), y: 4 };
    const [bx, by] = this.gunwale(1);
    const sprit: Pt = [bx + 22, by - 27];
    // the castle's lines: its top's row at a column (sloping up to the stern), its aft and fore ends
    const cL = Math.round(this.X(-0.7)), cR = Math.round(this.X(2.25));
    const deck = (x: number): number => this.top(Math.max(x, qx)) - 46 + ((x - cL) * 7) / (cR - cL);
    // the stays: to the bowsprit's end and to the castle's rail
    this.as(() => {
      stroke(this.put, mastAt(nest), nest + 2, sprit[0], sprit[1], col(r.dry, 0.2));
      stroke(this.put, mastAt(nest), nest + 2, cL + 12, deck(cL + 12) - 10, col(r.dry, 0.2));
    });
    this.as(() => {
      stroke(this.put, mastAt(nest - 3) - 1, nest - 3, top.x - 1, top.y, col(r.wood, 0.4), 3);
      stroke(this.put, mastAt(nest - 3), nest - 3, top.x, top.y, col(r.wood, 0.85), 1);
      for (let dx = -2; dx <= 2; dx++) for (let dy = -2; dy <= 0; dy++) this.put(top.x + dx, top.y + dy, col(r.sponge, dy === -1 && dx < 1 ? 0.85 : 0.5));
    });
    this.pennant({ x: top.x - 1, y: top.y + 1 }, r.red, 20, 8);
    this.as(() => {
      for (let y = nest; y <= my + 3; y++) {
        const cx = Math.round(mastAt(y) + 0.8 * Math.sin(y / 9)), rope = (y - nest) % 17 >= 10 && (y - nest) % 17 <= 13;
        const half = rope ? 6 : 5;
        for (let dx = -half; dx < half; dx++) this.put(cx + dx, y, rope ? col(r.dry, dx < -2 ? 1 : dx < 2 ? ((y + dx) % 2 ? 0.75 : 0.5) : 0.15) : col(r.wood, dx < -2 ? 0.92 : dx < 2 ? 0.7 : 0.42));
      }
    });
    // the shrouds, each a fan of three ropes with ratlines across, down to the rail on either side of the mast
    const feet = (side: number): Pt[] => [13, 23, 33].map((dx): Pt => { const x = Math.round(mx + side * dx + (side < 0 ? -2 : 0)); return [x, this.top(x) + 1]; });
    for (const side of [-1, 1]) {
      this.as(() => {
        const head: Pt = [mastAt(nest + 6) + side * 4, nest + 6];
        const f = feet(side);
        for (const p of f) stroke(this.put, head[0], head[1], p[0], p[1], col(r.dry, 0.2));
        for (let y = Math.round(head[1]) + 16; y < f[0]![1] - 3; y += 7) {
          const at = (p: Pt): number => head[0] + ((p[0] - head[0]) * (y - head[1])) / (p[1] - head[1]);
          stroke(this.put, at(f[0]!), y, at(f[2]!), y + (side < 0 ? 1 : 0), col(r.dry, 0.2));
        }
      });
    }
    // the yard, slanting up to the stern, and the sail furled under it in lumps, tied, patched; its fore corner hangs loose
    const y0: Pt = [mx - 46, nest - 5], y1: Pt = [mx + 44, nest + 25];
    const yardAt = (x: number): number => y0[1] + ((y1[1] - y0[1]) * (x - y0[0])) / (y1[0] - y0[0]);
    this.as(() => {
      for (let x = Math.round(y0[0]) + 5; x <= y1[0] - 4; x++) {
        const u = (x - y0[0]) / (y1[0] - y0[0]), base = yardAt(x) + 2;
        const fat = 5 + 4 * Math.sin(Math.PI * u) ** 0.6 + 1.6 * Math.sin(x / 3.7) ** 2;
        const tie = Math.round(x - y0[0]) % 14 === 9;
        for (let k = 0; k <= fat; k++) {
          const fold = Math.sin(x / 3.7 + k / 2) > 0.55;
          this.put(x, base + k, tie ? col(r.dry, k < 2 ? 0.9 : 0.4) : col(r.hull, k > fat - 2 ? 0.55 : fold ? 0.72 : 0.95));
        }
      }
      // the loose corner
      fill(this.put, wonky([[y1[0] - 16, y1[1] + 6], [y1[0] - 3, y1[1] + 5], [y1[0] - 5, y1[1] + 22], [y1[0] - 12, y1[1] + 15]], 0.6, 112), (x, y) => col(r.hull, x + y * 0.5 > y1[0] - 8 + (y1[1] + 12) * 0.5 ? 0.6 : 0.9));
    });
    // the patches on the sail: one red, one blue-grey
    for (const [dx, run, hi, seed] of [[-28, r.red, 0.6, 113], [16, r.hull, 0.35, 114]] as const) {
      const cx = mx + dx, cy = Math.round(yardAt(cx)) + 4;
      this.as(() => fill(this.put, wonky([[cx - 4, cy], [cx + 4, cy + 1], [cx + 4, cy + 8], [cx - 4, cy + 7]], 0.5, seed), (x, y) => col(run, y < cy + 3 ? hi + 0.15 : hi)));
    }
    this.as(() => {
      stroke(this.put, y0[0], y0[1] - 1, y1[0], y1[1] - 1, col(r.wood, 0.85), 4);
      for (let dy = -2; dy <= 4; dy++) for (let dx = -2; dx <= 2; dx++) { this.put(y0[0] + dx, y0[1] + dy, col(r.wood, 0.6)); this.put(y1[0] + dx, y1[1] + dy, col(r.wood, 0.6)); }
    });
    // the crow's nest: a tub flaring upward, hooped
    this.as(() => {
      for (let k = 0; k <= 12; k++) {
        const cx = Math.round(mastAt(nest - k)), half = 8 + Math.round(k / 4);
        for (let dx = -half; dx <= half; dx++) this.put(cx + dx, nest - k + 4, k === 12 ? col(r.wood, 1) : k === 3 || k === 8 ? col(r.dry, dx < 0 ? 0.9 : 0.5) : col(r.wood, dx < -3 ? 0.8 : (dx + 20) % 4 === 0 ? 0.3 : dx < 3 ? 0.6 : 0.4));
      }
    });

    // the lantern hung over the stern from an iron crook
    const lx = cL - 4, ly = Math.round(deck(cL)) - 24;
    this.as(() => {
      trace(this.put, quad([cL + 6, deck(cL + 6) - 2], [cL + 7, ly - 14], [lx, ly - 5]), () => col(r.stone, 0.2));
      trace(this.put, quad([cL + 7, deck(cL + 6) - 2], [cL + 8, ly - 13], [lx, ly - 4]), () => col(r.stone, 0.2));
    });
    this.as(() => {
      // a cap, the glass in its cage, a foot
      for (let k = 0; k <= 12; k++) {
        const half = k < 2 ? 1 + k : k < 4 ? 4 : k < 10 ? 3 : k < 12 ? 4 : 2;
        for (let dx = -half; dx <= half; dx++) this.put(lx + dx, ly - 4 + k, k < 4 || k >= 10 ? col(r.sponge, dx < 0 ? 0.55 : 0.3) : dx === 0 && !r.lit ? col(r.sponge, 0.3) : r.lit ?? col(r.sponge, dx < 0 ? 1 : 0.85));
      }
    });

    // the stern castle, leaning back over the stern, two storeys: tarred planks below, above them a blue-grey panel
    // between white mouldings, jutting a little, white posts carved at its corners
    const cB = (x: number): number => this.top(Math.max(x, qx)) + 2;
    const lean = (y: number): number => ((cB(qx) - y) * (cL - qx)) / (cB(qx) - deck(cL));
    const SPLIT = 29;
    this.as(() => fill(this.put, wonky([[qx + 1, cB(qx) + 2], [qx + 1 + lean(deck(cL) + SPLIT), deck(cL) + SPLIT], [cL - 1, deck(cL) + SPLIT - 1], [cL, deck(cL)], [(cL + cR) / 2, deck((cL + cR) / 2) + 1.5], [cR + 4, deck(cR + 4)], [cR + 4, deck(cR) + SPLIT], [cR, deck(cR) + SPLIT + 1], [cR, cB(cR) + 2]], 0.7, 115), (x, y) => {
      const k = Math.round(y - deck(x)), xs = x - lean(y);
      if (k < 4) return col(r.hull, k < 2 ? 1 : k === 2 ? 0.75 : 0.1);
      if (k >= SPLIT - 3 && k <= SPLIT) return k === SPLIT ? col(r.hull, 0.08) : (x + (k === SPLIT - 1 ? 3 : 0)) % 6 < 3 && k > SPLIT - 3 ? col(r.hull, 0.7) : col(r.hull, 1);
      if (k < SPLIT) {
        if (xs < qx + 4 || x > cR) return col(r.hull, x > cR ? 0.75 : 1);
        if (k < 7) return col(r.hull, 0.12);
        if (Math.round(xs - qx) % 8 === 0) return col(r.hull, 0.2);
        return tone(r.hull, 0.36 + 0.12 * (fbm(x / 10, y / 5, 2, 116) - 0.5), x, y);
      }
      if (k < SPLIT + 3) return col(r.stone, 0);
      return (k - SPLIT) % 5 === 0 ? col(r.stone, 0) : (k - SPLIT) % 5 === 1 ? col(r.stone, 0.3) : tone(r.stone, 0.1 + 0.08 * (fbm(x / 12, k, 2, 117) - 0.5), x, y);
    }));
    // the sun's face carved on it, its rays all round, and a lattice window on either side
    const sx = Math.round((cL + cR) / 2) + 3, sy = Math.round(deck(sx)) + 15;
    this.as(() => {
      for (let dy = -12; dy <= 12; dy++) for (let dx = -12; dx <= 12; dx++) {
        const d = Math.hypot(dx, dy), a = Math.atan2(dy, dx);
        const ray = 7.5 + 4 * Math.abs(Math.cos(a * 5 + 0.4)) ** 3;
        if (d <= 7.6) {
          const eye = (dx === -3 || dx === 2) && (dy === -2 || dy === -1);
          const smile = (dy === 3 && Math.abs(dx) <= 2) || (dy === 2 && Math.abs(dx) === 3) || (dy === 1 && Math.abs(dx) === 4);
          const cheek = Math.abs(dx) === 5 && dy === 0;
          this.put(sx + dx, sy + dy, eye ? r.ink : smile ? col(r.sponge, 0.1) : cheek ? col(r.red, 0.8) : col(r.sponge, dx + dy < -4 ? 0.92 : dx + dy > 5 ? 0.62 : 0.78));
        } else if (d <= ray) this.put(sx + dx, sy + dy, col(r.sponge, dx + dy < 0 ? 0.7 : 0.5));
      }
    });
    for (const [i, off] of [-23, 22].entries()) {
      const lx0 = sx + off - 5, ly0 = Math.round(deck(sx + off)) + 10 + i;
      this.as(() => fill(this.put, wonky([[lx0 - 3, ly0 - 3], [lx0 + 12, ly0 - 4], [lx0 + 13, ly0 + 13], [lx0 - 2, ly0 + 14]], 0.4, 118 + i), (x, y) => col(r.hull, x - lx0 + (y - ly0) < 6 ? 1 : 0.78)));
      this.as(() => fill(this.put, [[lx0, ly0], [lx0 + 10, ly0 - 1], [lx0 + 10, ly0 + 10], [lx0, ly0 + 11]], (x, y) => ((x + y) % 4 === 0 || (((x - y) % 4) + 4) % 4 === 0 ? col(r.wood, 0.1) : r.lit ?? col(r.sea, x - lx0 + (y - ly0) < 8 ? 0.95 : 0.55))));
    }
    // a little round window in the lower storey
    const ox = cR - 16, oy = Math.round(deck(ox)) + SPLIT + 9;
    this.as(() => this.disc(ox, oy, 4.6, (dx, dy) => col(r.dry, dx + dy < 0 ? 1 : 0.6)));
    this.as(() => this.disc(ox, oy, 2.4, (dx, dy) => r.lit ?? col(r.sea, dx + dy < 0 ? 0.95 : 0.4)));
    // the ladder from the deck up to the castle's top
    const sx0 = cR + 20;
    this.as(() => {
      const foot: Pt = [sx0, this.top(sx0) + 2], head: Pt = [cR + 4, deck(cR) + 2];
      for (const dx of [0, 8]) stroke(this.put, foot[0] + dx, foot[1], head[0] + dx, head[1], col(r.wood, 0.85), 3);
      for (let u = 0.1; u < 1; u += 0.155) { const [px, py] = lerp2(foot, head, u); stroke(this.put, px + 2, py, px + 9, py, col(r.wood, 0.6), 3); }
    });
    this.fence(cL + 3, cR, r.hull, 3, (x) => deck(x));

    // the hull: tarred black, each plank lit along its top; one blue-grey band between white strakes; a white rail
    this.hull((x, y, d, up) => {
      if (up < 6) return col(r.stone, 0);
      if (d < 3) return col(r.hull, 0.9);
      if (d < 5) return col(r.stone, d === 3 ? 0 : 0.1);
      if (d < 7) return col(r.hull, d === 5 ? 1 : 0.75);
      if (d < 13) return tone(r.hull, 0.36 + 0.12 * (fbm(x / 12, y / 4, 2, 121) - 0.5), x, y);
      if (d < 16) return col(r.hull, d === 13 ? 1 : d === 14 ? 0.75 : 0.08);
      const p = Math.floor((d - 16) / 6), k = (d - 16) % 6;
      if (k === 5) return col(r.stone, 0);
      if (k === 0) return col(r.stone, 0.3 - p * 0.03);
      return tone(r.stone, 0.1 - p * 0.01 + 0.08 * (fbm(x / 12, p * 3, 2, 122) - 0.5), x, y);
    });
    this.rail(r.hull);
    // the deadeyes the shrouds are made fast to: big wooden discs, three holes in each
    for (const side of [-1, 1]) for (const [x] of feet(side)) {
      const y = this.top(x) + 9;
      this.as(() => this.disc(x, y, 4.6, (dx, dy) => ((dx === -1 && dy === -1) || (dx === 1 && dy === -1) || (dx === 0 && dy === 1) ? r.ink : col(r.wood, dx + dy < 0 ? 0.9 : 0.66))));
    }
    // the bowsprit, fat, bound with rope, a knob on its end
    const root: Pt = [bx - 16, by - 1];
    this.as(() => {
      stroke(this.put, root[0], root[1] - 1, sprit[0], sprit[1] - 1, col(r.wood, 0.92), 3);
      stroke(this.put, root[0], root[1] + 2, sprit[0], sprit[1] + 2, col(r.wood, 0.55), 3);
      for (const u of [0.42, 0.72]) { const [px, py] = lerp2(root, sprit, u); for (let k = -2; k <= 5; k++) for (let dx = 0; dx <= 1; dx++) this.put(px + dx, py + k, col(r.dry, k < 2 ? 0.95 : 0.5)); }
      this.disc(sprit[0] + 1, sprit[1] + 1, 3.6, (dx, dy) => col(r.sponge, dx + dy < 0 ? 0.85 : 0.55));
    });
    this.fence(this.X(s.long - 1.8), this.X(s.long - 0.6), r.hull, 4);
  }
}

/**
 * Where a boat's two lines are made fast, from its berth's point (the stern at the water), fine pixels: a boat before the
 * quay ties to the ladder and a ring in the quay's face. Without them both lines run down to the water behind the parapet.
 */
export interface BoatTies {
  readonly bow: { readonly x: number; readonly y: number };
  readonly stern: { readonly x: number; readonly y: number };
}

/** A moored boat's picture: the boat without what the wind moves on it, and those things (`sway.ts`), in the frame's pixels. */
export interface BoatPicture extends Overlay {
  readonly blown: readonly Blown[];
}

/**
 * A boat of `kind`, as an overlay whose (x, y) is from the berth's point (the stern at the water). One look: the game
 * rides it on the swell (`bobAt`) and flies its pennant and washing on the wind (`blownAt`), which are cut out of a
 * second painting of the whole boat so each keeps its contour.
 */
export function paintBoat(kind: BoatKind, runs: BoatRuns, ties?: BoatTies): BoatPicture {
  const [bare, whole] = (['without', 'with'] as const).map((wind) => {
    const p = new BoatPainter(kind, runs, wind, ties);
    p.moor(ties);
    p.paint();
    p.outline();
    p.reflect();
    return p;
  }) as [BoatPainter, BoatPainter];
  return { x: -bare.stern, y: -REACH, frames: [bare.bitmap], blown: whole.blownParts() };
}

/** A boat as it stands in still air: its picture with what the wind moves laid on it unbent (for a still, and a figure a script moves). */
export function boatStill(boat: BoatPicture): Bitmap {
  const frame = boat.frames[0]!;
  const out = createBitmap(frame.width, frame.height);
  out.pixels.set(frame.pixels);
  for (const part of boat.blown) blit(out, part.bitmap, part.x, part.y);
  return out;
}
