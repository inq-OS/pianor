import { HARBOUR, HARBOUR_BEACON, HARBOUR_QUAY, QUAY, harbourAt, harbourWaterAt, type HarbourPlan } from '../../../../core/layout/harbour';
import type { SkyPhase } from '../../../../core/sky/skyPhase';
import { createBitmap, type Bitmap } from '../bitmap';
import { cropTogether, type Overlay } from '../pack';
import { clamp01 } from '../paint/ease';
import { grain } from '../paint/grain';
import { LiveRecorder, type LiveWater } from '../paint/live';
import { paintLooks, SkyMask, swing } from '../paint/motion';
import { fbm, hash2 } from '../paint/noise';
import { tintedCloud, type CurlSpec } from './curlCloud';
import { KERI_HOURS, tone, type Hour } from './keriPalette';
import { optionsOf, type KitBrush } from './kit/kit';
import { lamp, lampLit } from './kit/lights';
import { sea, type SeaGround } from './kit/water';
import { paintBoat, type BoatPicture } from './portBoats';
import { PORT_TONES, PORT_WAY, portPalette, portRuns } from './portPicture';

/**
 * The southern port seen from a raised eye (`core/layout/harbour.ts`), in the port's own colours: the eye stands a
 * storey up on the quay's root, so the quay is a shape on the water that curls out to sea, its top a long pale road of
 * slabs and its face in courses of big blocks where it turns toward the eye; the beacon stands small and far at its
 * head, and the parapet the eye stands on is dark along the foot. Uprights fan out from a point under the picture
 * (`SPLAY`), so a wall leans away from the middle as it rises. Laid back to front: the bare sky (its clouds drift over
 * it), the sea, the quay from its head to its root, the parapet.
 *
 * Semi-sketch: shapes and tones placed for the maintainer's marks; the finish (slime, rings, props, the moored boat's
 * place) follows their word.
 */
const R = PORT_TONES.run;
const F = PORT_TONES.fine;

export const harbourPalette = portPalette;
export const harbourRuns = portRuns;

export const HARBOUR_FRAMES = 8;
export const HARBOUR_LAMP_LOOKS = 3;
/** The wind blows the same way as in the side view: away and to the left. */
export const HARBOUR_WAY = PORT_WAY;

const MOON = { x: 560, y: 30, r: 7 } as const;

/** Where the light lies on the water and how the quay's sides take it, by the hour (as the side view's `LIGHT`). */
const LIGHT: Record<SkyPhase, { side: number; glint: number; face: number; top: number }> = {
  day: { side: 0.7, glint: 470, face: 0.5, top: 0.78 },
  dawn: { side: 0.2, glint: 300, face: 0.32, top: 0.6 },
  dusk: { side: -0.1, glint: -999, face: 0.62, top: 0.62 },
  night: { side: 0.5, glint: MOON.x, face: 0.36, top: 0.5 },
};

/** The sky's clouds: a few long thin ones and one fat one, all leading left with the wind. */
export const HARBOUR_CLOUDS: readonly { at: readonly [number, number]; spec: CurlSpec }[] = [
  { at: [120, 8], spec: { length: 140, girth: 6, belly: 0.45, neck: 1, taper: 0.6, bend: 3, wave: 1.5, phase: 0.3 } },
  { at: [330, 14], spec: { length: 110, girth: 26, belly: 0.8, neck: 0.9, taper: 1.15, bend: 8, wave: 0.75, phase: 0.4, rise: 7, head: { size: 17, turns: 1.2 } } },
  { at: [20, 40], spec: { length: 70, girth: 9, belly: 0.7, neck: 0.85, taper: 1.2, bend: 2, wave: 1, phase: 1.1, head: { size: 7, turns: 1.15 } } },
];

/** The quay's middle line at `s` (0 its root, 1 its head), metres: a smooth curve through `HARBOUR_QUAY`. */
function quayAt(s: number): [number, number] {
  const n = HARBOUR_QUAY.length - 1, f = Math.min(n - 1e-9, Math.max(0, s * n)), i = Math.floor(f), t = f - i;
  const p = (k: number): readonly [number, number] => HARBOUR_QUAY[Math.max(0, Math.min(n, k))]!;
  const [a, b, c, d] = [p(i - 1), p(i), p(i + 1), p(i + 2)];
  const cr = (k: 0 | 1): number => 0.5 * (2 * b[k] + (-a[k] + c[k]) * t + (2 * a[k] - 5 * b[k] + 4 * c[k] - d[k]) * t * t + (-a[k] + 3 * b[k] - 3 * c[k] + d[k]) * t * t * t);
  return [cr(0), cr(1)];
}

/** How long the quay is along its middle line (metres), for spacing its slabs and blocks. */
const QUAY_STEPS = 240;

type Pt = { x: number; y: number };

class HarbourPainter {
  readonly palette: readonly number[];
  readonly sky: SkyMask;
  private readonly hour: Hour & (typeof LIGHT)[SkyPhase];
  private readonly w: number;
  private readonly h: number;
  private px: Uint8Array = new Uint8Array(0);
  private owner: Uint16Array = new Uint16Array(0);
  private thing = 0;
  private things = 0;
  private readonly live: LiveRecorder;
  private readonly darkest = new Map<number, number>();
  liveWater: LiveWater | null = null;

  constructor(private readonly plan: HarbourPlan, phase: SkyPhase) {
    this.w = plan.fine.w;
    this.h = plan.fine.h;
    this.hour = { ...KERI_HOURS[phase], ...LIGHT[phase] };
    this.palette = harbourPalette(phase);
    this.sky = new SkyMask(this.w, this.h);
    this.live = new LiveRecorder(this.w, this.h, () => this.px, HARBOUR.horizon, HARBOUR_WAY, R.foam);
    for (const run of Object.values(F)) for (const c of run) if (!this.darkest.has(c)) this.darkest.set(c, run[0]!);
  }

  gullTone(): number {
    return R.stone[1]!;
  }

  cloud(spec: CurlSpec): Bitmap {
    return tintedCloud(spec, false, R.cloud);
  }

  private as(draw: () => void): void {
    const was = this.thing;
    this.thing = ++this.things;
    draw();
    this.thing = was;
  }

  private put(x: number, y: number, c: number): void {
    x = Math.round(x); y = Math.round(y);
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return;
    this.px[y * this.w + x] = c;
    this.owner[y * this.w + x] = this.thing;
    this.sky.put(y * this.w + x);
  }

  private brush(look: number, looks: number): KitBrush {
    return {
      put: (x, y, c) => this.put(x, y, c), run: R, fine: F, hour: this.hour, side: this.hour.side,
      sway: (phase) => swing(look, looks, phase), beat: look / looks, live: this.live,
      under: (x, y) => {
        const px = Math.round(x), py = Math.round(y);
        if (px < 0 || py < 0 || px >= this.w || py >= this.h) return undefined;
        const i = py * this.w + px;
        return { colour: this.px[i]!, thing: this.owner[i] !== 0 };
      },
    };
  }

  /** Fills a polygon (fine pixels), each pixel's colour from `colour`. */
  private fill(pts: readonly Pt[], colour: (x: number, y: number) => number | null): void {
    const top = Math.max(0, Math.floor(Math.min(...pts.map((p) => p.y)))), bottom = Math.min(this.h - 1, Math.ceil(Math.max(...pts.map((p) => p.y))));
    for (let y = top; y <= bottom; y++) {
      const cy = y + 0.5, xs: number[] = [];
      for (let k = 0; k < pts.length; k++) {
        const a = pts[k]!, b = pts[(k + 1) % pts.length]!;
        if ((a.y <= cy) !== (b.y <= cy)) xs.push(a.x + ((cy - a.y) / (b.y - a.y)) * (b.x - a.x));
      }
      xs.sort((p, q) => p - q);
      for (let k = 0; k + 1 < xs.length; k += 2) for (let x = Math.max(0, Math.round(xs[k]!)); x < Math.min(this.w, Math.round(xs[k + 1]!)); x++) {
        const c = colour(x, y);
        if (c !== null) this.put(x, y, c);
      }
    }
  }

  private line(a: Pt, b: Pt, c: number): void {
    const n = Math.max(1, Math.ceil(Math.max(Math.abs(b.x - a.x), Math.abs(b.y - a.y))));
    for (let k = 0; k <= n; k++) this.put(a.x + ((b.x - a.x) * k) / n, a.y + ((b.y - a.y) * k) / n, c);
  }

  /** The ink line of the 1991 game round every thing laid over what was there before it. */
  private outline(): void {
    const { w, h, px, owner } = this;
    const edge: number[] = [];
    for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) {
      const i = y * w + x, a = owner[i]!;
      if (a === 0) continue;
      for (const [d, o] of [[-w, w], [1, -1], [-1, 1], [w, -w]] as const) if (owner[i + d]! < a && owner[i + o] === a) { edge.push(i); break; }
    }
    for (const i of edge) px[i] = this.darkest.get(px[i]!) ?? px[i]!;
  }

  // ---- the sky and the sea

  private paintSky(): void {
    const hz = HARBOUR.horizon;
    this.sky.sky = true;
    for (let x = 0; x < this.w; x++) for (let y = 0; y <= hz; y++) this.put(x, y, tone(F.sky, clamp01(Math.pow(y / hz, 0.85)), x, y));
    if (this.hour.night) {
      for (let gy = 0; gy < hz - 8; gy += 8) for (let gx = 0; gx < this.w; gx += 9) {
        const pick = hash2(gx, gy, 31);
        if (pick > 0.42) continue;
        this.put(gx + Math.floor(hash2(gx, gy, 32) * 9), gy + Math.floor(hash2(gx, gy, 33) * 8), pick < 0.14 ? R.star[0]! : R.star[1]!);
      }
      for (let dy = -MOON.r; dy <= MOON.r; dy++) for (let dx = -MOON.r; dx <= MOON.r; dx++) {
        if (Math.hypot(dx, dy) <= MOON.r) this.put(MOON.x + dx, MOON.y + dy, Math.hypot(dx + 2, dy + 2) < MOON.r * 0.55 ? R.moon[1]! : R.moon[0]!);
      }
    }
    this.sky.sky = false;
    for (let x = 0; x < this.w; x++) this.put(x, hz - 1, R.sky[4]!);
  }

  private seaGround(): SeaGround {
    return {
      width: this.w, height: this.h, horizon: HARBOUR.horizon, glint: this.hour.glint, stands: [],
      place: (x, y) => {
        if (y <= HARBOUR.horizon) return null;
        const z = harbourWaterAt(y);
        return { shore: 40 + z, gx: ((x - this.w / 2) * z) / HARBOUR.lens, gz: z };
      },
      moon: (x, y) => {
        const depth = y - HARBOUR.horizon, wobble = 10 * (fbm(x / 30, depth / 5, 2, 315) - 0.5);
        return clamp01(1 - Math.abs(x + wobble * 2 - MOON.x) / 60) * clamp01((depth + wobble) / 8);
      },
    };
  }

  private paintSea(look: number): void {
    sea.paint(this.brush(look, HARBOUR_FRAMES), this.seaGround(), optionsOf(sea, undefined, { band: 24, way: HARBOUR_WAY }), 0);
    this.live.settle();
    const { glint } = this.hour;
    if (glint < 0) return;
    for (let gy = HARBOUR.horizon + 2; gy < this.h; gy += 3) for (let gx = Math.max(0, glint - 80); gx < Math.min(this.w, glint + 80); gx++) {
      const near = Math.exp(-(((gx - glint) / (12 + (gy - HARBOUR.horizon) * 0.8)) ** 2));
      if (hash2(gx >> 2, gy, 357) > 1 - (this.hour.night ? 0.3 : 0.15) * near) this.live.glint(gx, gy, this.hour.night ? R.moon[0]! : R.foam, hash2(gx >> 2, gy, 363));
    }
  }

  // ---- the quay

  /** A quay's stone at a lightness 0 to 1, each block a little its own. */
  private stone(light: number, seed: number, x: number, y: number): number {
    return tone(F.stone, clamp01(light + 0.16 * (hash2(seed, 5, 401) - 0.5)), x, y);
  }

  /**
   * The quay from its head to its root, so what is nearer lies over what is further: in each step along it, the side
   * that faces the eye in courses of blocks, then its top of slabs. The beacon's platform stands at its head.
   */
  private quay(): void {
    const half = QUAY.wide / 2;
    const at = (s: number, side: number, h: number): Pt => {
      const [x, z] = quayAt(s), [x2, z2] = quayAt(s + 0.002);
      const dx = x2 - x, dz = z2 - z, len = Math.hypot(dx, dz);
      // `side` -1 the left edge, 1 the right; the normal points to the right of the way out
      return harbourAt(x + (side * half * dz) / len, z - (side * half * dx) / len, h);
    };
    const seen = (s: number, side: number): boolean => {
      const [x, z] = quayAt(s), [x2, z2] = quayAt(s + 0.002);
      const dx = x2 - x, dz = z2 - z, nx = side * dz, nz = -side * dx;
      return -(x * nx + z * nz) > 0;
    };
    const course = QUAY.high / 3, slab = 1.8, flag = 3.2;
    const metres = (s: number): number => {
      let m = 0;
      for (let k = 0; k < Math.round(s * QUAY_STEPS); k++) {
        const [a, b] = [quayAt(k / QUAY_STEPS), quayAt((k + 1) / QUAY_STEPS)];
        m += Math.hypot(b[0] - a[0], b[1] - a[1]);
      }
      return m;
    };
    const along = Array.from({ length: QUAY_STEPS + 1 }, (_, k) => metres(k / QUAY_STEPS));
    this.beacon();
    // the quay is one thing, so the ink line goes round it and not round each step of it
    this.as(() => { for (let k = QUAY_STEPS - 1; k >= 0; k--) {
      const s0 = k / QUAY_STEPS, s1 = (k + 1) / QUAY_STEPS, m0 = along[k]!, m1 = along[k + 1]!;
      {
        for (const side of [-1, 1]) {
          if (!seen(s0, side)) continue;
          const lit = this.hour.face + (side > 0 ? -0.1 : 0.08);
          for (let c = 0; c < 3; c++) {
            const lo = c * course, hi = (c + 1) * course;
            const shift = c % 2 ? slab / 2 : 0, block = Math.floor((m0 + shift) / slab);
            const slime = c === 0 ? 0.55 : 1;
            this.fill([at(s0, side, lo), at(s1, side, lo), at(s1, side, hi), at(s0, side, hi)], (x, y) => this.stone((lit - 0.12 * (2 - c)) * slime, block * 7 + c, x, y));
            // the seam over the course, and a joint where a block ends
            this.line(at(s0, side, hi), at(s1, side, hi), R.stone[0]!);
            if (Math.floor((m1 + shift) / slab) !== block) this.line(at(s1, side, lo), at(s1, side, hi), R.stone[0]!);
          }
          // the wet foot over the water, dark with weed
          this.line(at(s0, side, 0.05), at(s1, side, 0.05), R.bush[1]!);
        }
        // the top: pale slabs, a joint across where one ends
        // the top: big pale flags in two rows, a joint across where one ends and one down the middle
        const row = Math.floor(m0 / flag), row2 = Math.floor((m0 + flag / 2) / flag);
        const mid = (s: number): Pt => { const a = at(s, -1, QUAY.high), b = at(s, 1, QUAY.high); return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }; };
        this.fill([at(s0, -1, QUAY.high), at(s1, -1, QUAY.high), mid(s1), mid(s0)], (x, y) => this.stone(this.hour.top, row * 3, x, y));
        this.fill([mid(s0), mid(s1), at(s1, 1, QUAY.high), at(s0, 1, QUAY.high)], (x, y) => this.stone(this.hour.top - 0.05, row2 * 3 + 1, x, y));
        if (Math.floor(m1 / flag) !== row) this.line(at(s1, -1, QUAY.high), mid(s1), R.stone[1]!);
        if (Math.floor((m1 + flag / 2) / flag) !== row2) this.line(mid(s1), at(s1, 1, QUAY.high), R.stone[1]!);
        this.line(mid(s0), mid(s1), R.stone[1]!);
        // the coping along both edges catches the light
        for (const side of [-1, 1]) this.line(at(s0, side, QUAY.high), at(s1, side, QUAY.high), side < 0 ? R.stone[4]! : R.stone[3]!);
      }
    } });
    // bollards along the quay's open edge, each a short dark post
    for (const s of [0.16, 0.34, 0.52, 0.7]) this.as(() => {
      const foot = at(s, -1, QUAY.high), cap = at(s, -1, QUAY.high + 0.7), r = Math.max(1, Math.round((foot.y - cap.y) * 0.3));
      this.fill([{ x: foot.x + 2, y: foot.y }, { x: foot.x + 2 + 2 * r, y: foot.y }, { x: cap.x + 2 + 2 * r, y: cap.y }, { x: cap.x + 2, y: cap.y }], () => R.wood[0]!);
    });
  }

  /** The beacon at the quay's head: a platform of the same blocks, a storey over the top, its iron pan on it. */
  private beacon(): void {
    const [x, z] = quayAt(1), s = HARBOUR_BEACON.side / 2, top = QUAY.high + HARBOUR_BEACON.high;
    this.as(() => {
      const corners = (h: number): Pt[] => [harbourAt(x - s, z - s, h), harbourAt(x + s, z - s, h), harbourAt(x + s, z + s, h), harbourAt(x - s, z + s, h)];
      const lo = corners(0), hi = corners(top);
      this.fill([lo[0]!, lo[1]!, hi[1]!, hi[0]!], (px, py) => this.stone(this.hour.face, Math.floor(py / 4), px, py));
      this.fill([lo[3]!, lo[0]!, hi[0]!, hi[3]!], (px, py) => this.stone(this.hour.face - 0.15, Math.floor(py / 4) + 3, px, py));
      this.fill(hi, () => R.stone[3]!);
    });
    this.as(() => {
      const pan = harbourAt(x, z, top + 1.2), rim = Math.round((HARBOUR.lens * 1.9) / z);
      this.fill([{ x: pan.x - rim, y: pan.y }, { x: pan.x + rim, y: pan.y }, { x: pan.x + rim * 0.6, y: pan.y + 4 }, { x: pan.x - rim * 0.6, y: pan.y + 4 }], () => R.sponge[1]!);
      this.line({ x: pan.x - rim, y: pan.y }, { x: pan.x + rim, y: pan.y }, R.sponge[3]!);
      for (const dx of [-0.5, 0.5]) this.line({ x: pan.x + dx * rim, y: pan.y + 4 }, { x: pan.x + dx * rim * 0.8, y: harbourAt(x, z, top).y }, R.ink);
    });
  }

  /** The parapet the eye stands on: dark along the picture's foot, its coping catching a little light, and a ball-topped post. */
  private parapet(): void {
    const edge = (x: number): number => 318 + 14 * Math.sin((x / this.w) * Math.PI * 0.9 + 0.3) - 10 * (x / this.w);
    this.as(() => this.fill([{ x: 0, y: edge(0) }, ...Array.from({ length: 33 }, (_, k) => ({ x: k * 20, y: edge(k * 20) })), { x: this.w, y: this.h }, { x: 0, y: this.h }], (x, y) => {
      if (y < edge(x) + 3) return R.stone[1]!;
      const block = Math.floor((x + (y > edge(x) + 16 ? 18 : 0)) / 36);
      return (x + (y > edge(x) + 16 ? 18 : 0)) % 36 === 0 || Math.round(y - edge(x)) === 16 ? R.ink : hash2(block, y > edge(x) + 16 ? 1 : 0, 61) > 0.5 ? R.stone[0]! : tone(F.stone, 0.06, x, y);
    }));
    this.as(() => {
      const cx = 548, foot = edge(cx) + 4, top = 252, r = 16;
      this.fill([{ x: cx - 12, y: foot + 30 }, { x: cx + 12, y: foot + 30 }, { x: cx + 10, y: top + r }, { x: cx - 10, y: top + r }], (x) => (x > cx + 6 ? R.stone[1]! : R.stone[0]!));
      this.fill(Array.from({ length: 24 }, (_, k) => ({ x: cx + r * Math.cos((k / 24) * Math.PI * 2), y: top + r * Math.sin((k / 24) * Math.PI * 2) })), (x, y) => (Math.hypot(x - cx - 6, y - top + 6) < r * 0.5 ? R.stone[1]! : R.stone[0]!));
    });
  }

  private surface(look: number): Bitmap {
    const bitmap = createBitmap(this.w, this.h);
    this.px = bitmap.pixels;
    this.owner = new Uint16Array(this.w * this.h);
    this.things = 0;
    this.live.on = look === 0;
    this.paintSky();
    this.paintSea(look);
    this.quay();
    this.parapet();
    if (look === 0) this.liveWater = this.live.seal(bitmap);
    this.live.on = false;
    grain(this.px, this.w, PORT_TONES.grain, { seed: 600 });
    this.outline();
    return bitmap;
  }

  frames(band: number): { frames: Bitmap[]; fore: Overlay } {
    return paintLooks(HARBOUR_FRAMES, this.sky, Math.min(band, HARBOUR.horizon + 1), (look) => this.surface(look));
  }

  /** The beacon's fire, small and far, and its glow, flickering at dusk and night; nothing by day. */
  lamp(base: Bitmap): Overlay {
    const { w, h, plan } = this;
    return cropTogether(Array.from({ length: HARBOUR_LAMP_LOOKS }, (_, look) => {
      const bitmap = createBitmap(w, h);
      const brush: KitBrush = {
        ...this.brush(look, HARBOUR_LAMP_LOOKS),
        put: (x, y, c) => {
          const px = Math.round(x), py = Math.round(y);
          if (px >= 0 && py >= 0 && px < w && py < h) bitmap.pixels[py * w + px] = c;
        },
        under: (x, y) => {
          const px = Math.round(x), py = Math.round(y);
          if (px < 0 || py < 0 || px >= w || py >= h) return undefined;
          const c = base.pixels[py * w + px]!;
          return { colour: c, thing: !F.sky.includes(c) && !F.sea.includes(c) };
        },
      };
      if (!lampLit(brush)) {
        bitmap.pixels[0] = R.ink;
        return bitmap;
      }
      lamp.paint(brush, plan.lamp.x, plan.lamp.y - 4, optionsOf(lamp, undefined, { reach: 22 + look * 2, water: 30, lantern: false }), look);
      // tongues of flame leaning downwind, as the side view's fire, at this distance a few pixels tall
      for (let k = -4; k <= 4; k++) {
        const tall = Math.round((7 - Math.abs(k)) * (0.7 + 0.5 * hash2(k, look, 487)));
        for (let up = 0; up < tall; up++) brush.put(plan.lamp.x + k + HARBOUR_WAY * Math.round(up * 0.4), plan.lamp.y - up, up < tall / 3 ? R.ember[5]! : up < (2 * tall) / 3 ? R.ember[4]! : R.ember[3]!);
      }
      return bitmap;
    }));
  }

  /** The houseboat moored on the quay's open side, as the side view paints it. */
  houseboat(): BoatPicture {
    const lit = lampLit(this.brush(0, HARBOUR_FRAMES)) ? R.ember[4]! : null;
    return paintBoat('houseboat', { ink: R.ink, hull: F.hull, red: F.red, wood: F.wood, stone: F.stone, shingle: F.shingle, sponge: F.sponge, dry: F.dry, sea: F.sea, tar: F.wood, lit });
  }
}

export interface HarbourPicture {
  palette: readonly number[];
  frames: Bitmap[];
  fore: Overlay;
  clouds: { x: number; y: number; bitmap: Bitmap }[];
  lamp: Overlay;
  water: LiveWater;
  gull: number;
  /** The houseboat at its berth alongside the quay. */
  boat: BoatPicture;
}

/** Paints the port from the raised eye, for one hour of the sky. */
export function paintHarbour(plan: HarbourPlan, phase: SkyPhase): HarbourPicture {
  const p = new HarbourPainter(plan, phase);
  const clouds = HARBOUR_CLOUDS.map(({ at, spec }) => ({ x: at[0], y: at[1], bitmap: p.cloud(spec) }));
  const { frames, fore } = p.frames(Math.max(...clouds.map((c) => c.y + c.bitmap.height)));
  return { palette: p.palette, frames, fore, clouds, lamp: p.lamp(frames[0]!), water: p.liveWater!, gull: p.gullTone(), boat: p.houseboat() };
}

/** The harbour as it stands: the first look, the clouds, what stands before them, the boat at its berth, the beacon lit. */
export function harbourStill(picture: HarbourPicture, plan: HarbourPlan): Bitmap {
  const base = picture.frames[0]!;
  const out = createBitmap(base.width, base.height);
  out.pixels.set(base.pixels);
  const lay = (b: Bitmap, x: number, y: number): void => {
    for (let j = 0; j < b.height; j++) for (let i = 0; i < b.width; i++) {
      const c = b.pixels[j * b.width + i]!;
      if (c && x + i >= 0 && y + j >= 0 && x + i < out.width && y + j < out.height) out.pixels[(y + j) * out.width + x + i] = c;
    }
  };
  for (const c of picture.clouds) lay(c.bitmap, c.x, c.y);
  for (const f of picture.fore.frames.slice(0, 1)) lay(f, picture.fore.x, picture.fore.y);
  lay(picture.boat.frames[0]!, picture.boat.x + plan.berth.x, picture.boat.y + plan.berth.water);
  const lamp = picture.lamp.frames[1] ?? picture.lamp.frames[0];
  if (lamp) lay(lamp, picture.lamp.x, picture.lamp.y);
  return out;
}
