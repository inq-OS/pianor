import { createBitmap, type Bitmap } from '../bitmap';
import { C } from '../palette';

/**
 * Kiur, drawn after the real bird (metskiur, the tree pipit *Anthus trivialis*; d114): one small model looked at from any
 * side, so every view shows the same bird. A few rounded parts (body, head, tail, folded wings, bill) are cast to the
 * picture; each material is three flat tones in bands, as a character of the early 1990s adventure games is drawn, never
 * a smooth light. Every streak, breast drop, wing bar and crown mark is a point placed on the bird and shown when that
 * side is seen; the eyes and the bill seen from the front are small hand-drawn stamps. A pose is a few numbers.
 *
 * Pure TypeScript (no Phaser, no DOM): the game makes textures from the result and the build paints the room with it.
 * The picture is on the fine grid (d110) in the game palette's indexes. The numbers below were set by eye over several
 * review rounds (projects/painter/notes/kiur.md); change one and look at every frame at `?demo=art`.
 */

type V = readonly [number, number, number];
type Run = readonly number[];
type Canvas = ReturnType<typeof createBitmap>;
interface Spot {
  u: number;
  v: number;
  t: number;
}

export interface KiurPose {
  /** Which way the body faces, in degrees: 0 the viewer, 90 the screen's right, 180 away. */
  yaw: number;
  /** The head turned on the body (degrees, the same sense). */
  headYaw?: number;
  /** The head raised, in fine pixels. */
  headLift?: number;
  /** The head moved from its place (sideways, up, forward), for sleep and flight. */
  headDrop?: V;
  /** The body tipped forward, in degrees: 0 standing; above 30 he is drawn flying, slim and stretched. */
  pitch?: number;
  legs?: 'stand' | 'sit' | 'tucked';
  bill?: 'shut' | 'sing' | 'hidden';
  eyes?: 'open' | 'up' | 'shut';
  /** The body made rounder (asleep, singing), about 0 to 1.5. */
  fluff?: number;
  /** `up`, `mid` and `down` are the beats of flight; `point` holds a wing out flat to the viewer, as a hand shows the way. */
  wings?: 'folded' | 'up' | 'mid' | 'down' | 'point';
  /** Open only this wing (-1 his right, 1 his left; seen from the front, 1 is the screen's right); the other stays folded. */
  openSide?: -1 | 1;
  /** The picture's size and where the middle of the body is in it; 48 x 40 with the body at (24, 22.2) when not given. */
  w?: number;
  h?: number;
  ox?: number;
  oy?: number;
  /** No line round him: for a painted picture, where nothing has an outline (the room). */
  bare?: boolean;
}

/** The size of a standing Kiur's picture on the fine grid. */
export const KIUR_SIZE = { w: 48, h: 40 } as const;

const rad = (degrees: number): number => (degrees * Math.PI) / 180;

/** A repeatable number in 0 to 1 for two whole numbers: scattered marks stay where they are between pictures. */
function scatter(a: number, b: number): number {
  let h = (a * 374761393 + b * 668265263) ^ 0x5bf03635;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

// Tone runs, shade to light. The light comes from the upper left, a little toward the viewer.
const BACK: Run = [C.umberDark, C.umber, C.umberLight];
const WING: Run = [C.umberDeep, C.umberDark, C.umber];
const BUFF: Run = [C.buffDark, C.buff, C.buffLight];
const WHITE: Run = [C.downShade, C.down, C.downLight];
const FACE: Run = [C.buffDark, C.buff, C.buff];
const CHEEK: Run = [C.buffDeep, C.buffDark, C.buffDark];
const THROAT: Run = [C.buffLight, C.buffLight, C.down];
const TAIL: Run = [C.umberDeep, C.umberDeep, C.umberDark];
const PALE: Run = [C.cream];
const DARK_LINE: Run = [C.umberDark];
const BILL: Run = [C.leg, C.leg, C.legLight];
const LIGHT: V = [-0.46, 0.72, 0.52];
const STREAK = C.featherStreak;

function tone(run: Run, light: number): number {
  if (run.length === 1) return run[0]!;
  if (light < -0.12) return run[0]!;
  return light < 0.42 || run.length < 3 ? run[1]! : run[2]!;
}

/**
 * How high the brown cap comes down on the head (degrees above the eye line) at an angle round the head from the bill.
 * It falls away toward the back, so the pale eyebrow under it arches kindly: Kiur never frowns.
 */
export function kiurCapEdge(azimuth: number): number {
  return 30 - 9 * Math.min(1, Math.abs(azimuth) / 110) ** 2;
}

function headRegion(az: number, el: number): Run {
  const a = Math.abs(az);
  const cap = kiurCapEdge(az);
  if (el > cap || a > 120) return BACK; // the cap and the nape
  if (el > cap - 6.5 && a > 13 && a < 108) return PALE; // the pale eyebrow, arched over the eye
  if (el > 3 && el < 8 && a > 84 && a < 106) return DARK_LINE; // the thin line behind the eye
  if (((a - 90) / 30) ** 2 + ((el + 5) / 19) ** 2 < 1) return CHEEK; // a soft round patch
  if (a < 17 && el < -22) return THROAT;
  return FACE;
}

function bodyRegion(az: number, el: number, x: number, y: number): Run {
  const a = Math.abs(az);
  if (a > 108) return BACK;
  if (el < -14 + 16 * (a / 108) ** 2 + 5 * (scatter(x, y) - 0.5)) return WHITE;
  return BUFF;
}

const BODY = 1, HEAD = 2, TAIL_PART = 3, WING_RIGHT = 4, WING_LEFT = 5, BILL_UPPER = 6, BILL_LOWER = 7, MOUTH = 8;

interface Part {
  id: number;
  c: V;
  r: V;
  yaw: number;
  region: (az: number, el: number, x: number, y: number) => Run;
}

/** The bill seen from the front: a small pointed diamond, pink with a dark ridge; and open, singing. */
const BILL_FRONT = ['.dd.', 'PddP', 'pPPp', '.pp.'];
const BILL_SINGING = ['..ddd..', '.dPPPd.', 'dmmmmmd', 'dmmtmmd', '.dmttd.', '..pPp..'];
const BILL_LEGEND: Readonly<Record<string, number>> = { d: C.umberDark, P: C.leg, p: C.legLight, m: C.red, t: C.pink };

/** Where an open wing's tip is from its shoulder (out to the side, up, forward), for each way of holding it. */
const WING_SPAN: Readonly<Record<'up' | 'mid' | 'down' | 'point', V>> = { up: [8, 18, -4], mid: [19, 3, -4], down: [7, -16, -2], point: [21, 1.5, 0] };

/** Breast drops in rows fanning out from the throat: height on the body, the angles each side, and the drop's length. */
const BREAST_ROWS: readonly (readonly [number, readonly number[], number])[] = [
  [30, [14, 36, 58], 3],
  [16, [0, 24, 48, 70], 3],
  [3, [13, 37, 60], 2],
  [-9, [30, 54, 74], 2],
  [-20, [48, 70], 1],
];

class KiurPainter {
  private readonly w: number;
  private readonly h: number;
  private readonly ox: number;
  private readonly oy: number;
  private readonly yaw: number;
  private readonly pitch: number;
  private readonly fluff: number;
  private readonly headTurn: number;
  private readonly headYaw: number;
  private readonly flying: boolean;
  private readonly sitting: boolean;
  private readonly headC: V;
  private readonly bodyR: V;
  private readonly out: Canvas;
  /** For each pixel: how near the viewer the part drawn there is, which part it is, and whether it is a leg (no outline). */
  private readonly depth: Float32Array;
  private readonly owner: Uint8Array;
  private readonly thin: Uint8Array;
  private readonly parts: Part[] = [];

  constructor(private readonly pose: KiurPose) {
    this.w = pose.w ?? KIUR_SIZE.w;
    this.h = pose.h ?? KIUR_SIZE.h;
    this.ox = pose.ox ?? 24;
    this.oy = pose.oy ?? 22.2;
    this.yaw = rad(pose.yaw);
    this.pitch = rad(pose.pitch ?? 0);
    this.fluff = pose.fluff ?? 0;
    this.headTurn = rad(pose.headYaw ?? 0);
    this.headYaw = this.yaw + this.headTurn;
    this.flying = (pose.pitch ?? 0) > 30;
    this.sitting = pose.legs === 'sit';
    const neck = this.tip([0, 12.2 + (pose.headLift ?? 0), 2]);
    const drop = pose.headDrop ?? [0, 0, 0];
    this.headC = [neck[0] + drop[0], neck[1] + drop[1], neck[2] + drop[2]];
    this.bodyR = this.flying ? [7.6, 7, 12] : [10.4 + this.fluff, 9.6 + this.fluff * 0.6, 9.4 + this.fluff];
    this.out = createBitmap(this.w, this.h);
    this.depth = new Float32Array(this.w * this.h).fill(-1e9);
    this.owner = new Uint8Array(this.w * this.h);
    this.thin = new Uint8Array(this.w * this.h);
  }

  paint(): Bitmap {
    this.build();
    for (const side of this.sidesFarFirst(4)) this.leg(side);
    for (const side of [-1, 1]) if (this.isOpen(side) && !this.near(side)) this.openWing(side);
    for (const part of this.parts) this.cast(part);
    this.bodyMarks();
    this.headMarks();
    for (const side of [-1, 1]) if (!this.isOpen(side)) this.wingMarks(side);
    for (const side of [-1, 1]) this.eye(side);
    for (const side of [-1, 1]) if (this.isOpen(side) && this.near(side)) this.openWing(side);
    this.frontBill();
    if (!this.pose.bare) this.outline();
    return this.out;
  }

  // The bird's own frame: x to its side, y up, z the way it faces. Pitch tips the whole bird forward about its middle.
  private tip(p: V): V {
    const c = Math.cos(this.pitch), s = Math.sin(this.pitch);
    return [p[0], p[1] * c - p[2] * s, p[1] * s + p[2] * c];
  }

  private untip(p: V): V {
    const c = Math.cos(this.pitch), s = Math.sin(this.pitch);
    return [p[0], p[1] * c + p[2] * s, -p[1] * s + p[2] * c];
  }

  /** To the picture: `u` right, `v` down, `t` toward the viewer. */
  private view(p: V): Spot {
    const c = Math.cos(this.yaw), s = Math.sin(this.yaw);
    return { u: this.ox + p[0] * c + p[2] * s, v: this.oy - p[1], t: -p[0] * s + p[2] * c };
  }

  /** A point given in the head's own frame, in the bird's. */
  private onHead(p: V): V {
    const c = Math.cos(this.headTurn), s = Math.sin(this.headTurn);
    return [this.headC[0] + p[0] * c + p[2] * s, this.headC[1] + p[1], this.headC[2] - p[0] * s + p[2] * c];
  }

  private near(side: number): boolean {
    return this.view([side * 5, 0, 0]).t >= 0;
  }

  private sidesFarFirst(x: number): number[] {
    return [-1, 1].sort((p, q) => this.view([p * x, 0, 0]).t - this.view([q * x, 0, 0]).t);
  }

  private isOpen(side: number): boolean {
    const wings = this.pose.wings ?? 'folded';
    return wings !== 'folded' && (this.pose.openSide === undefined || this.pose.openSide === side);
  }

  private get(x: number, y: number): number {
    return x < 0 || y < 0 || x >= this.w || y >= this.h ? 0 : this.out.pixels[y * this.w + x]!;
  }

  private set(x: number, y: number, ink: number, thin = false): void {
    x = Math.round(x);
    y = Math.round(y);
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return;
    this.out.pixels[y * this.w + x] = ink;
    this.thin[y * this.w + x] = thin ? 1 : 0;
  }

  private line(x0: number, y0: number, x1: number, y1: number, ink: number, thin = false): void {
    const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1);
    for (let i = 0; i <= n; i++) this.set(x0 + ((x1 - x0) * i) / n, y0 + ((y1 - y0) * i) / n, ink, thin);
  }

  private stamp(x: number, y: number, rows: readonly string[], legend: Readonly<Record<string, number>>): void {
    rows.forEach((row, j) =>
      [...row].forEach((ch, i) => {
        if (ch !== '.') this.set(x + i, y + j, legend[ch]!);
      }),
    );
  }

  private build(): void {
    const { parts, yaw, fluff, flying } = this;
    parts.push({ id: BODY, c: [0, 0, 0], r: this.bodyR, yaw, region: bodyRegion });
    if (!flying) parts.push({ id: BODY, c: this.tip([0, -2.4, -0.8]), r: [11.5 + fluff, 7.8 + fluff * 0.5, 10.2 + fluff], yaw, region: bodyRegion });
    parts.push({ id: HEAD, c: this.headC, r: [8.7, 8.5, 8.6], yaw: this.headYaw, region: headRegion });
    // the tail: a flat chain, back and down (straight back when flying), with a pale edge along the outer feathers
    for (let k = 0; k < 7; k++) {
      const f = k / 6;
      const region = (az: number, el: number): Run => (Math.abs(az) > 78 && Math.abs(az) < 102 && Math.abs(el) < 30 && k > 2 ? PALE : TAIL);
      parts.push({ id: TAIL_PART, c: flying ? [0, 0.5 - 1.5 * f, -9 - 14 * f] : [0, -3.2 - 5.5 * f, -8.5 - 14.5 * f], r: [2.7 - 0.8 * f, 1.3, 2.6], yaw, region });
    }
    // folded wings lie on the body's sides
    for (const side of [-1, 1]) {
      if (this.isOpen(side)) continue;
      const id = side < 0 ? WING_RIGHT : WING_LEFT;
      const region = (): Run => WING;
      parts.push({ id, c: this.tip([side * (9.1 + fluff), 2.4, -0.8]), r: [1.9, 5.3, 6.6], yaw, region });
      parts.push({ id, c: this.tip([side * (7.9 + fluff), -0.6, -7.6]), r: [1.8, 3.5, 6.2], yaw, region });
      parts.push({ id, c: this.tip([side * (5.2 + fluff * 0.5), -3, -12.6]), r: [1.5, 2, 4.2], yaw, region });
    }
    this.buildBill();
  }

  /** The bill: a fine cone, dark above and pink below; open to sing, with the mouth between. */
  private buildBill(): void {
    const chain = (to: V, id: number, region: (el: number) => Run): void => {
      for (let k = 0; k < 5; k++) {
        const f = k / 4;
        this.parts.push({ id, c: this.onHead([0, -0.8 + (to[1] + 0.8) * f, 8 + (to[2] - 8) * f]), r: [1.9 - 1.3 * f, 1.5 - 0.9 * f, 1.4], yaw: this.headYaw, region: (_az, el) => region(el) });
      }
    };
    const bill = this.pose.bill ?? 'shut';
    if (bill === 'shut') chain([0, -1.6, 13.6], BILL_UPPER, (el) => (el > 5 ? DARK_LINE : BILL));
    if (bill === 'sing') {
      chain([0, 3.2, 12.4], BILL_UPPER, (el) => (el > 0 ? DARK_LINE : [C.leg]));
      chain([0, -5.2, 11.2], BILL_LOWER, () => BILL);
      this.parts.push({ id: MOUTH, c: this.onHead([0, -1.2, 8.3]), r: [2.3, 2.4, 1.6], yaw: this.headYaw, region: (_az, el) => (el < -20 ? [C.pink] : [C.red]) });
    }
  }

  /** A leg and its foot (three toes forward, one back). They go down first; the body is painted over their tops. */
  private leg(side: number): void {
    if (this.pose.legs === 'tucked') return;
    const near = this.view([side * 4.3, 0, 0]).t >= 0;
    const footY = this.sitting ? -10.6 : -15.4, footZ = this.sitting ? 2.5 : 0.4;
    const hip = this.view(this.tip([side * 4.2, -8, 0])), heel = this.view([side * 4.5, -12.4, -0.9]), foot = this.view([side * 4.6, footY, footZ]);
    if (!this.sitting) {
      this.line(hip.u, hip.v, heel.u, heel.v, near ? C.leg : C.legDark, true);
      this.line(heel.u, heel.v, foot.u, foot.v, near ? C.legLight : C.leg, true);
      this.line(hip.u + 1, hip.v, heel.u + 1, heel.v, near ? C.legLight : C.leg, true);
    }
    for (const [dx, dz] of [[-3, 4.4], [0, 5.4], [3, 4.4], [0, -3]] as const) {
      const toe = this.view([side * 4.6 + dx, footY, footZ + dz]);
      this.line(foot.u, foot.v + 0.4, toe.u, foot.v + 0.4 + Math.max(0, (toe.t - foot.t) * 0.3), dz < 0 || !near ? C.legDark : C.leg, true);
    }
  }

  private triangle(a: Spot, b: Spot, c: Spot, ink: number): void {
    const edge = (p: Spot, q: Spot, x: number, y: number): number => (q.u - p.u) * (y - p.v) - (q.v - p.v) * (x - p.u);
    const x0 = Math.floor(Math.min(a.u, b.u, c.u)), x1 = Math.ceil(Math.max(a.u, b.u, c.u));
    const y0 = Math.floor(Math.min(a.v, b.v, c.v)), y1 = Math.ceil(Math.max(a.v, b.v, c.v));
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        const w0 = edge(a, b, x, y), w1 = edge(b, c, x, y), w2 = edge(c, a, x, y);
        if ((w0 >= -0.4 && w1 >= -0.4 && w2 >= -0.4) || (w0 <= 0.4 && w1 <= 0.4 && w2 <= 0.4)) this.set(x, y, ink);
      }
    }
  }

  /** An open wing: a flat tapering blade from the shoulder, with a pale leading edge, a wing bar and a few feather lines. */
  private openWing(side: number): void {
    const wings = this.pose.wings === 'folded' ? undefined : this.pose.wings;
    const near = this.near(side);
    const shoulder: V = [side * 5, 3.5, 4.5];
    const span = WING_SPAN[wings ?? 'mid'];
    const sag = wings === 'mid' ? 0.2 : 0;
    const at = (f: number, across: number): Spot => {
      const chord = 10 - 7.5 * f * f;
      // a pointing wing is held out flat to the viewer, its feathers hanging down; a flying one trails them behind
      if (wings === 'point') return this.view([shoulder[0] + side * span[0] * f, shoulder[1] + span[1] * f - chord * across * 0.8, shoulder[2] + span[2] * f]);
      return this.view([shoulder[0] + side * span[0] * f, shoulder[1] + span[1] * f - across * 0.8 * sag, shoulder[2] + span[2] * f - chord * across - 2.5 * f * across]);
    };
    const base = near ? C.umberDark : C.umberDeep;
    const steps = 10;
    for (let k = 0; k < steps; k++) {
      const f0 = k / steps, f1 = (k + 1) / steps;
      this.triangle(at(f0, 0), at(f1, 0), at(f1, 1), base);
      this.triangle(at(f0, 0), at(f1, 1), at(f0, 1), base);
    }
    for (let k = 0; k <= steps; k++) {
      const f = k / steps;
      const from = at(f, 0.42), to = at(Math.min(1, f + 0.06), 1.06);
      if (k % 3 === 1) this.line(from.u, from.v, to.u, to.v, near ? C.umberDeep : C.umberDark);
      if (near) {
        const bar = at(f, 0.36);
        this.set(bar.u, bar.v, C.cream);
      }
    }
    for (let k = 0; k < steps; k++) {
      const from = at(k / steps, 0), to = at((k + 1) / steps, 0);
      this.line(from.u, from.v, to.u, to.v, near ? C.umberLight : C.umberDark);
    }
  }

  /** Cast one rounded part: for every pixel the nearest part wins, toned in flat bands by how its surface faces the light. */
  private cast(part: Part): void {
    const { w, h } = this;
    const centre = this.view(part.c);
    const cs = Math.cos(part.yaw), sn = Math.sin(part.yaw);
    const [rx, ry, rz] = part.r;
    const reach = Math.ceil(Math.max(rx, ry, rz)) + 1;
    for (let py = Math.max(0, Math.floor(centre.v - reach)); py <= Math.min(h - 1, Math.ceil(centre.v + reach)); py++) {
      for (let px = Math.max(0, Math.floor(centre.u - reach)); px <= Math.min(w - 1, Math.ceil(centre.u + reach)); px++) {
        // the ray through this pixel, in the part's own frame: (a0 + a1 d, dv, b0 + b1 d)
        const du = px - centre.u, dv = -(py - centre.v);
        const a0 = du * cs, a1 = -sn, b0 = du * sn, b1 = cs;
        const qa = (a1 / rx) ** 2 + (b1 / rz) ** 2, qb = 2 * ((a0 * a1) / rx ** 2 + (b0 * b1) / rz ** 2), qc = (a0 / rx) ** 2 + (b0 / rz) ** 2 + (dv / ry) ** 2 - 1;
        const disc = qb * qb - 4 * qa * qc;
        if (disc < 0) continue;
        const d = (-qb + Math.sqrt(disc)) / (2 * qa);
        const t = centre.t + d;
        const i = py * w + px;
        if (t <= this.depth[i]!) continue;
        const local: V = [a0 + a1 * d, dv, b0 + b1 * d];
        this.depth[i] = t;
        this.owner[i] = part.id;
        this.thin[i] = 0;
        this.out.pixels[i] = tone(this.regionAt(part, local, px, py), facing(local, part.r, cs, sn));
      }
    }
  }

  /** Which colours a point of a part's surface has: by its angle round the part and its height on it. */
  private regionAt(part: Part, local: V, px: number, py: number): Run {
    const [rx, ry, rz] = part.r;
    const p = part.id === BODY ? this.untip(local) : local;
    const length = Math.hypot(p[0] / rx, p[1] / ry, p[2] / rz) || 1;
    const az = (Math.atan2(p[0] / rx, p[2] / rz) * 180) / Math.PI;
    const el = (Math.asin(Math.max(-1, Math.min(1, p[1] / ry / length))) * 180) / Math.PI;
    return part.region(az, el, px, py);
  }

  /** The point of a rounded part's surface at an angle round it (`az`) and a height (`el`), in the bird's frame. */
  private surface(centre: V, r: V, az: number, el: number, tipped: boolean): V {
    const q: V = [Math.sin(rad(az)) * Math.cos(rad(el)) * r[0], Math.sin(rad(el)) * r[1], Math.cos(rad(az)) * Math.cos(rad(el)) * r[2]];
    const p = tipped ? this.tip(q) : q;
    return [centre[0] + p[0], centre[1] + p[1], centre[2] + p[2]];
  }

  /** A mark at a point of a part's surface, `length` pixels down, shown only where that part is what the viewer sees. */
  private mark(p: V, turn: number, centre: V, id: number, ink: number, length = 1): void {
    const rel: V = [p[0] - centre[0], p[1] - centre[1], p[2] - centre[2]];
    const c = this.view(centre);
    const u = c.u + rel[0] * Math.cos(turn) + rel[2] * Math.sin(turn);
    const v = c.v - rel[1];
    const t = c.t - rel[0] * Math.sin(turn) + rel[2] * Math.cos(turn);
    for (let j = 0; j < length; j++) {
      const x = Math.round(u), y = Math.round(v) + j;
      if (x < 0 || y < 0 || x >= this.w || y >= this.h) continue;
      if (this.owner[y * this.w + x] === id && t > this.depth[y * this.w + x]! - 2.2) this.set(x, y, ink);
    }
  }

  private bodyMarks(): void {
    const middle: V = [0, 0, 0];
    const on = (az: number, el: number, length: number): void => this.mark(this.surface(middle, this.bodyR, az, el, true), this.yaw, middle, BODY, STREAK, length);
    for (const [el, angles, length] of BREAST_ROWS) {
      for (const az of angles) for (const side of az === 0 ? [1] : [-1, 1]) on(side * az, el, length);
    }
    // the patch at the side of the neck that the moustache line runs into
    for (const side of [-1, 1]) for (const [az, el] of [[40, 44], [46, 40], [44, 36]] as const) on(side * az, el, 2);
    // the back: broad soft streaks in lines along the body
    for (const az of [126, 148, 170, -126, -148, -170]) {
      for (let el = 46; el > -18; el -= 14) {
        const j = scatter(az + 400, el + 90);
        on(az + 10 * (j - 0.5), el + 8 * (scatter(el + 7, az + 300) - 0.5), j > 0.4 ? 3 : 2);
      }
    }
  }

  private headMarks(): void {
    const r: V = [9, 8, 8.6];
    const on = (az: number, el: number, length: number): void => this.mark(this.surface(this.headC, r, az, el, false), this.headYaw, this.headC, HEAD, STREAK, length);
    for (let k = 0; k < 26; k++) on(-180 + 360 * scatter(k, 21), 36 + 40 * scatter(k, 23), scatter(k, 5) > 0.5 ? 2 : 1); // crown
    for (const az of [140, 165, -165, -140]) for (const el of [14, -2]) on(az, el, 2); // nape
    for (const side of [-1, 1]) for (let k = 0; k < 4; k++) on(side * (25 + k * 3.5), -22 - k * 7, 1); // the moustache line
  }

  /** A folded wing's marks: two bars of pale feather tips and a line of pale edge along the long feathers. */
  private wingMarks(side: number): void {
    const centre = this.tip([side * (9.1 + this.fluff), 2.4, -0.8]);
    const r: V = [1.9, 5.3, 6.6];
    const id = side < 0 ? WING_RIGHT : WING_LEFT;
    const on = (y: number, z: number): V => {
      const x = Math.sqrt(Math.max(0, 1 - (y / r[1]) ** 2 - (z / r[2]) ** 2));
      const q = this.tip([side * x * r[0], y, z]);
      return [centre[0] + q[0], centre[1] + q[1], centre[2] + q[2]];
    };
    for (let k = 0; k < 4; k++) {
      this.mark(on(3 - 0.55 * k, 3.6 - 2.2 * k), this.yaw, centre, id, C.cream);
      this.mark(on(-0.2 - 0.6 * k, 3 - 2.3 * k), this.yaw, centre, id, C.cream);
    }
    for (let z = 2; z > -6; z -= 1) this.mark(on(-3.2 - (2 - z) * 0.12, z), this.yaw, centre, id, C.umberLight);
  }

  /** An eye: dark with a glint at its upper left and a pale lower lid; wider the more it faces the viewer. */
  private eye(side: number): void {
    const turn = this.headYaw;
    const d: V = [Math.sin(rad(side * 44)) * Math.cos(rad(5)), Math.sin(rad(5)), Math.cos(rad(44)) * Math.cos(rad(5))];
    const toViewer = -d[0] * Math.sin(turn) + d[2] * Math.cos(turn);
    if (toViewer < 0.12) return;
    const head = this.view(this.headC);
    const u = Math.round(head.u + d[0] * 8.7 * Math.cos(turn) + d[2] * 8.6 * Math.sin(turn));
    const v = Math.round(head.v - d[1] * 8.5);
    const wide = toViewer > 0.6 ? 3 : toViewer > 0.35 ? 2 : 1;
    const x0 = u - (wide >> 1);
    if (this.pose.eyes === 'shut') {
      for (let i = 0; i < Math.max(2, wide + 1); i++) this.set(x0 + i, v + (i === 0 || i === wide ? 0 : 1), STREAK);
      return;
    }
    for (let j = -1; j <= 1; j++) for (let i = 0; i < wide; i++) this.set(x0 + i, v + j, C.ink);
    if (this.pose.eyes === 'up') {
      this.set(x0 + (wide > 1 ? 1 : 0), v - 1, C.white);
      for (let i = 0; i < wide; i++) this.set(x0 + i, v + 1, C.cream);
      return;
    }
    this.set(x0, v - 1, C.white);
    const lid = side * Math.cos(turn) > 0 ? x0 + wide - 1 : x0;
    if (this.get(lid, v + 2) !== 0) this.set(lid, v + 2, C.cream);
  }

  private frontBill(): void {
    const turn = this.headYaw;
    if (Math.abs(Math.sin(turn)) >= 0.5 || Math.cos(turn) <= 0 || this.pose.bill === 'hidden') return;
    const at = this.view(this.onHead([0, -1.2, 9]));
    const u = Math.round(at.u), v = Math.round(at.v);
    if (this.pose.bill === 'sing') this.stamp(u - 3, v - 3, BILL_SINGING, BILL_LEGEND);
    else this.stamp(u - 2, v - 1, BILL_FRONT, BILL_LEGEND);
  }

  /** A line round him: dark below and to the right (the shade side), a softer brown above and left. Thin legs get none. */
  private outline(): void {
    const { w, h } = this;
    const source = this.out.pixels.slice();
    const solid = (x: number, y: number): boolean => x >= 0 && y >= 0 && x < w && y < h && source[y * w + x] !== 0 && this.thin[y * w + x] === 0;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        if (source[y * w + x] !== 0) continue;
        if (solid(x, y - 1) || solid(x - 1, y)) this.out.pixels[y * w + x] = C.featherInk;
        else if (solid(x, y + 1) || solid(x + 1, y)) this.out.pixels[y * w + x] = C.umberDeep;
      }
    }
  }
}

/** How much a point of a rounded part's surface faces the light, about -1 to 1. `local` is in the part's own frame. */
function facing(local: V, r: V, cs: number, sn: number): number {
  const n: V = [local[0] / r[0] ** 2, local[1] / r[1] ** 2, local[2] / r[2] ** 2];
  const length = Math.hypot(n[0], n[1], n[2]);
  const x = (n[0] * cs + n[2] * sn) / length, y = n[1] / length, z = (-n[0] * sn + n[2] * cs) / length;
  return x * LIGHT[0] + y * LIGHT[1] + z * LIGHT[2];
}

/** Kiur in a pose, on the fine grid, in the game palette's indexes. */
export function paintKiur(pose: KiurPose): Bitmap {
  return new KiurPainter(pose).paint();
}
