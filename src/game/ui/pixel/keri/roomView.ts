import type { Rect } from '../../../../core/layout/rect';
import type { SkyPhase } from '../../../../core/sky/skyPhase';
import { blit, createBitmap, type Bitmap } from '../bitmap';
import { clamp01 } from '../paint/ease';
import { fbm, hash2, noise2 } from '../paint/noise';
import { tintedCloud, type CurlSpec } from './curlCloud';
import { KERI_HOURS, scenePalette, tone } from './keriPalette';

/**
 * What the room's three windows show: Keri as every outdoor scene paints it (d111), flat pixel art from the
 * island's shared palette, laid behind the wall like a painted backdrop behind a stage set's windows. The room itself is
 * a lit set; the island outside it is never one (art-direction rule 12), and its night is the outdoor night: navy, with
 * stars and a moon, and the lighthouse's lantern lit (consistency review 2 of the room).
 *
 * The two windows of the back wall look south over the sea; the window in the left wall looks at the lighthouse
 * (docs/keri.md section 5). In every scene the lighthouse is drawn grand: the tower
 * fills its window, its foot sunk behind the dog roses, as at the crossroads.
 */

/** The island's shared runs the view paints with, and the lighthouse's two (the crossroads' limestone and iron). */
export const VIEW = scenePalette({
  lime: [0x36325c, 0x5e4e74, 0x9a7a7c, 0xd0a684, 0xeedaac],
  iron: [0x481816, 0x802c20, 0xac4e32],
}, ['grass', 'bush']);
const R = VIEW.run;
const F = VIEW.fine;

/** The openings of the three windows on the picture, in fine pixels. */
export interface RoomPanes { side: Rect; left: Rect; right: Rect }

/** Which side the light comes from at each hour as the lighthouse's window sees it (1 from the right, the south), and where the sun or moon stands in the sea windows. */
const LIGHT: Record<SkyPhase, { side: number; disc: 'none' | 'sun' | 'moon' }> = {
  day: { side: 1, disc: 'none' }, dawn: { side: -1, disc: 'none' }, dusk: { side: 1, disc: 'sun' }, night: { side: 1, disc: 'moon' },
};

/** The clouds, by the window they drift in and where in it (shares of its width and height): no two alike, heads leading left. */
const CLOUDS: readonly { pane: keyof RoomPanes; at: readonly [number, number]; spec: CurlSpec }[] = [
  { pane: 'left', at: [0.2, 0.12], spec: { length: 30, girth: 8, belly: 0.6, neck: 0.9, taper: 0.9, bend: 3, wave: 1.2, phase: 0.3, rise: 1, head: { size: 7, turns: 1.25 } } },
  { pane: 'right', at: [0.02, 0.2], spec: { length: 26, girth: 5, belly: 0.5, neck: 1, taper: 0.7, bend: 1, wave: 1, phase: 1.2 } },
  { pane: 'right', at: [0.4, 0.06], spec: { length: 22, girth: 10, belly: 0.66, neck: 0.9, taper: 1.1, bend: 3, wave: 0.8, phase: 0, rise: 2, head: { size: 7, turns: 1.2 }, curls: [{ at: 0.5, size: 5, turns: 1.1 }] } },
  { pane: 'side', at: [0.05, 0.3], spec: { length: 24, girth: 3, belly: 0.5, neck: 1, taper: 0.6, bend: 1, wave: 1, phase: 0.6 } },
];

/** The lighthouse as it is being painted: its foot's row, its height, the drum's top and radii, its middle at a row (it leans and bows a little), and the pixels it has covered. */
interface Tower {
  footY: number;
  tall: number;
  drumTop: number;
  r0: number;
  r1: number;
  mid(y: number): number;
  body: Set<number>;
}
/** Half the lantern's width. */
const LANTERN_R = 5;

class View {
  readonly bitmap: Bitmap;
  private readonly hour;
  private readonly light;

  constructor(private readonly size: { w: number; h: number }, private readonly panes: RoomPanes, private readonly hz: number, private readonly phase: SkyPhase, private readonly shimmer: number) {
    this.bitmap = createBitmap(size.w, size.h);
    this.hour = KERI_HOURS[phase];
    this.light = LIGHT[phase];
  }

  private put(x: number, y: number, c: number): void {
    x = Math.round(x); y = Math.round(y);
    if (x >= 0 && y >= 0 && x < this.size.w && y < this.size.h) this.bitmap.pixels[y * this.size.w + x] = c;
  }

  /** The sky from above the windows' tops down to the horizon, in bands with short level dashes between two of them. */
  private sky(): void {
    const { w } = this.size, top = this.panes.left.y - 6;
    for (let y = 0; y <= this.hz; y++) for (let x = 0; x < w; x++) {
      let t = Math.pow(clamp01((y - top) / (this.hz - top)), 0.9);
      // a low sun warms the sky near the horizon on its side: at dusk over the right sea window, at dawn behind the lighthouse
      if (this.phase === 'dusk') t += 0.22 * Math.exp(-(((x - this.panes.right.x - 30) / 140) ** 2)) * t - 0.12;
      if (this.phase === 'dawn') t += 0.2 * Math.exp(-(((x - this.panes.side.x) / 160) ** 2)) * t - 0.08;
      const dash = hash2(Math.floor((x + hash2(y, 0, 16) * 9) / (3 + Math.floor(hash2(y, 1, 17) * 5))), y, 15);
      this.put(x, y, tone(F.sky, clamp01(t + ((dash - 0.5) * 0.9) / (F.sky.length - 1)), x, y, 0));
    }
  }

  private stars(): void {
    const { w } = this.size;
    for (let gy = 0; gy < this.hz - 6; gy += 6) for (let gx = 0; gx < w; gx += 7) {
      const pick = hash2(gx, gy, 21);
      if (pick > 0.4) continue;
      this.put(gx + Math.floor(hash2(gx, gy, 22) * 7), gy + Math.floor(hash2(gx, gy, 23) * 6), pick < 0.14 ? R.star[0]! : R.star[1]!);
    }
  }

  /** The moon high in the right sea window, or the setting sun on its horizon; a ragged ring of the sky's palest tone round it. */
  private disc(): { x: number; y: number } | null {
    if (this.light.disc === 'none') return null;
    const p = this.panes.right, moon = this.light.disc === 'moon';
    const r = moon ? 6 : 7, cx = p.x + p.w * (moon ? 0.68 : 0.6), cy = moon ? p.y + 15 : this.hz - 2;
    for (let dy = -r - 7; dy <= r + 7; dy++) for (let dx = -r - 7; dx <= r + 7; dx++) {
      const far = Math.hypot(dx, dy), x = Math.round(cx + dx), y = Math.round(cy + dy);
      if (y > this.hz) continue;
      if (far <= r) this.put(x, y, moon ? (Math.hypot(dx + 2, dy + 2) < r * 0.55 || hash2(x >> 1, y >> 1, 24) > 0.86 ? R.moon[1]! : R.moon[0]!) : far < r * 0.6 ? R.moon[0]! : R.ember[4]!);
      else if (far < r + 2 || (far < r + 7 && hash2(Math.floor(x / 3), y, 25) < 0.8 * (1 - (far - r) / 7))) this.put(x, y, moon ? R.sky[4]! : R.ember[3]!);
    }
    return { x: cx, y: cy };
  }

  private clouds(): void {
    for (const cloud of CLOUDS) {
      const p = this.panes[cloud.pane];
      blit(this.bitmap, tintedCloud(cloud.spec, true, R.cloud), Math.round(p.x + cloud.at[0] * p.w), Math.round(p.y + cloud.at[1] * p.h));
    }
  }

  /**
   * The sea, after the artist's notes (water): a pale line on the horizon, a broad dark band under it, a lighter body
   * toward the shore, all in short level dashes; the moon's or the sun's light as short streaks under it.
   */
  private sea(disc: { x: number; y: number } | null): void {
    const { w, h } = this.size, deep = this.panes.left.y + this.panes.left.h - this.hz;
    for (let y = this.hz; y < h; y++) for (let x = 0; x < w; x++) {
      if (y === this.hz) { this.put(x, y, hash2(x >> 2, 3, 14) > 0.3 ? R.sky[4]! : R.sea[3]!); continue; }
      const s = clamp01((y - this.hz) / deep);
      // the dark band holds for two fifths of the way, then the sea steps up
      let t = s < 0.4 ? 0.08 + 0.2 * s : 0.16 + 0.75 * ((s - 0.4) / 0.6) ** 0.8;
      const dash = hash2(Math.floor((x + hash2(y, 2, 31) * 11 + this.shimmer * 3) / (3 + Math.floor(hash2(y, 3, 32) * 6))), y, 33);
      t += (dash - 0.5) * 0.3;
      // a pale crest now and then, more of them toward the shore
      if (hash2(Math.floor((x + this.shimmer * 5) / 5), y, 34) > 0.93 - 0.1 * s && noise2(x / 23, y / 3, 35) > 0.55) t += 0.3;
      let c = tone(F.sea, clamp01(t), x, y, 0);
      if (disc) {
        const off = Math.abs(x - disc.x), reach = 3 + 9 * s;
        if (off < reach && hash2(Math.floor(x / 2) + this.shimmer * 7, y, 36) > 0.42 + 0.5 * (off / reach)) c = this.light.disc === 'moon' ? R.moon[1]! : R.ember[4]!;
      }
      this.put(x, y, c);
    }
  }

  /** A meadow's ragged upper edge across a window's foot, `rise` rows at its highest: broken marks in many tones of the grass (rule 23). */
  private meadow(pane: Rect, rise: number, seed: number): void {
    const foot = pane.y + pane.h + 4;
    for (let x = pane.x - 8; x < pane.x + pane.w + 8; x++) {
      const top = foot - 4 - rise * (0.45 + 0.55 * fbm(x / 17, seed, 2, seed + 1)) - (hash2(x, seed, 41) > 0.72 ? 1 + Math.floor(hash2(x, seed, 42) * 4) : 0);
      for (let y = Math.round(top); y <= foot; y++) {
        const down = clamp01((y - top) / (rise + 4));
        const t = 0.62 - 0.4 * down + (hash2(x, y, seed + 43) - 0.5) * 0.34 + (hash2(x >> 1, y >> 1, seed + 44) - 0.5) * 0.2 + 0.12 * this.light.side * (noise2(x / 5, y / 4, seed + 45) - 0.5);
        this.put(x, y, tone(F.grass, clamp01(t), x, y, 0));
      }
    }
  }

  /** The dog roses before the lighthouse's foot: leaf lumps, dark below, lit along their tops on the light's side. */
  private roses(pane: Rect): void {
    const foot = pane.y + pane.h + 4;
    const lumps: readonly (readonly [number, number, number])[] = [[0.08, 11, 12], [0.34, 15, 15], [0.62, 12, 13], [0.9, 16, 14], [0.5, 8, 18]];
    for (const [at, r, tall] of lumps) {
      const cx = pane.x + at * pane.w, cy = foot - tall + r * 0.6;
      for (let dy = -r; dy <= foot - cy; dy++) for (let dx = -r - 2; dx <= r + 2; dx++) {
        const edge = r * (0.86 + 0.28 * noise2((cx + dx) / 4, (cy + dy) / 4, 51));
        const far = Math.hypot(dx, dy * 1.25);
        if (far > edge && dy < r * 0.5) continue;
        const up = clamp01(0.5 - dy / (2 * r)), lit = clamp01(0.5 + (dx / r) * 0.5 * this.light.side);
        const t = 0.12 + 0.62 * up * (0.45 + 0.55 * lit) + (hash2(cx + dx, cy + dy, 52) - 0.5) * 0.26;
        this.put(cx + dx, cy + dy, far > edge - 1.2 && dy < 0 && lit < 0.5 ? F.bush[0]! : tone(F.bush, clamp01(t), 0, 0, 0));
      }
    }
  }

  /**
   * Keri lighthouse in its window, the crossroads' tower in small: the fat limestone drum, lit in a few bands whose
   * border curves round it, with its hoops and courses; the rim and railing of its flat top; the rust-red iron column
   * flared at its foot, the gallery on brackets, the lantern, the dome, the ball and the rod. A dark line round the
   * whole. At night the lantern is lit: a pale halo scattered into the sky, and warm light on the planes that face it.
   */
  private lighthouse(pane: Rect): void {
    const T = 92, footY = pane.y + pane.h + 26, cx0 = pane.x + pane.w * 0.52;
    const t: Tower = {
      footY, tall: T, drumTop: footY - T * 0.54, r0: 15, r1: 13, body: new Set<number>(),
      mid: (y) => cx0 + ((footY - y) / T) * 2 + Math.sin(((footY - y) / T) * Math.PI),
    };
    this.drum(t);
    const galleryAt = Math.round(t.drumTop - T * 0.26);
    this.column(t, galleryAt);
    const lb = galleryAt - 4, lTop = lb - 10;
    this.gallery(t, galleryAt, lb);
    this.dome(t, lTop);
    // a dark line round the whole, in the limestone's darkest tone
    const { w } = this.size;
    for (const i of [...t.body]) for (const d of [-1, 1, -w, w]) {
      const j = i + d;
      if (!t.body.has(j) && j >= 0 && j < this.bitmap.pixels.length && Math.abs((j % w) - (i % w)) <= 1) this.bitmap.pixels[j] = R.lime[0]!;
    }
    if (this.hour.night) this.halo(t, lb - 5);
    this.lantern(t, lTop, lb);
  }

  /** A pixel of the tower: painted, and remembered as the tower's, for its line and its halo. */
  private stone(t: Tower, x: number, y: number, c: number): void {
    this.put(x, y, c);
    t.body.add(Math.round(y) * this.size.w + Math.round(x));
  }

  /** How lit the tower is `u` across it (-1 its left edge, 1 its right): in five flat steps with a ragged border. */
  private towerLight(u: number, x = 0, y = 0): number {
    return clamp01(Math.round((0.48 + u * this.light.side * 0.5 + (noise2(x / 3, y / 5, 154) - 0.5) * 0.16) * 4) / 4);
  }

  /** A railing of dark posts under a rail, `tall` pixels high, round the tower at row `y`. */
  private railing(t: Tower, y: number, r: number, tall: number): void {
    for (let x = Math.floor(t.mid(y) - r); x <= t.mid(y) + r; x++) {
      this.stone(t, x, y - tall, R.ink);
      if (Math.round(x - t.mid(y)) % 3 === 0) for (let k = 1; k < tall; k++) this.stone(t, x, y - k, R.ink);
    }
  }

  /** The limestone drum with its hoop and courses, the rim of its flat top and the railing on it. */
  private drum(t: Tower): void {
    const side = this.light.side, { drumTop, footY, r0, r1 } = t;
    for (let y = Math.round(drumTop); y <= footY; y++) {
      const s = (y - drumTop) / (footY - drumTop), r = r1 + (r0 - r1) * s + Math.sin(s * Math.PI);
      for (let x = Math.floor(t.mid(y) - r); x <= Math.ceil(t.mid(y) + r); x++) {
        const u = (x - t.mid(y)) / r;
        if (Math.abs(u) > 1) continue;
        const bow = -(1 - u * u) * 2, row = Math.floor((y + bow) / 4);
        if (Math.abs(y + bow - (drumTop + 15)) < 0.8) { this.stone(t, x, y, u * side > 0.15 ? R.iron[1]! : R.iron[0]!); continue; }
        const course = Math.floor(y + bow) % 4 === 0 || (Math.floor(x + (row % 2) * 3) % 6 === 0 && hash2(Math.floor(x / 6), row, 153) > 0.4);
        const lit = this.towerLight(u + 0.18 * Math.sin(s * Math.PI) * side - 0.08 * side, x, y) - (fbm(x / 3, y / 12, 2, 152) > 0.72 ? 0.14 : 0) - (course ? 0.1 : 0);
        this.stone(t, x, y, tone(F.lime, clamp01(lit), x, y, 0));
      }
    }
    const rim = [R.lime[1]!, R.lime[0]!];
    for (let k = -2; k <= 1; k++) {
      const y = Math.round(drumTop) + k, r = r1 + 2;
      for (let x = Math.floor(t.mid(y) - r); x <= Math.ceil(t.mid(y) + r); x++) {
        const top = ((x - t.mid(y)) / r) * side > 0 ? R.lime[4]! : R.lime[2]!;
        this.stone(t, x, y, k < 0 ? top : rim[k]!);
      }
    }
    this.railing(t, Math.round(drumTop) - 3, r1 + 1, 3);
  }

  /** A pixel of the red iron, `u` across its piece: a dark seam either side of the middle. */
  private iron(t: Tower, x: number, y: number, u: number): void {
    this.stone(t, x, y, Math.abs(Math.abs(u) - 0.45) < 0.1 ? R.iron[0]! : tone(F.iron, this.towerLight(u), x, y, 0));
  }

  /** The iron column, flared at its foot, from the drum's top up to the gallery. */
  private column(t: Tower, galleryAt: number): void {
    for (let y = galleryAt; y < t.drumTop - 1; y++) {
      const up = (t.drumTop - y) / (t.drumTop - galleryAt), ir = 5 - up + 5 * Math.max(0, 1 - (t.drumTop - y) / 7) ** 2;
      for (let x = Math.floor(t.mid(y) - ir); x <= Math.ceil(t.mid(y) + ir); x++) if (Math.abs((x - t.mid(y)) / ir) <= 1) this.iron(t, x, y, (x - t.mid(y)) / ir);
    }
  }

  /** The gallery on its brackets with its railing, a short neck, and the lantern's floor at row `lb`. */
  private gallery(t: Tower, galleryAt: number, lb: number): void {
    const side = this.light.side, night = this.hour.night, gr = 9, at = t.mid(galleryAt);
    for (let x = Math.floor(at - gr); x <= at + gr; x++) {
      this.stone(t, x, galleryAt, ((x - at) / gr) * side > 0 ? R.iron[2]! : R.iron[1]!);
      this.stone(t, x, galleryAt + 1, night ? R.ember[1]! : R.iron[1]!);
      this.stone(t, x, galleryAt + 2, R.ink);
    }
    for (const sgn of [-1, 1]) for (let k = 0; k <= 4; k++) this.stone(t, at + sgn * (4 + (gr - 5) * (1 - k / 4)), galleryAt + 2 + k, R.ink);
    this.railing(t, galleryAt - 1, gr, 3);
    for (let y = lb; y < galleryAt - 1; y++) for (let x = Math.floor(t.mid(y) - 4); x <= t.mid(y) + 4; x++) this.iron(t, x, y, (x - t.mid(y)) / 4);
    for (let x = Math.floor(t.mid(lb) - 7); x <= t.mid(lb) + 7; x++) {
      this.stone(t, x, lb, night ? R.ember[2]! : R.iron[1]!);
      this.stone(t, x, lb + 1, R.ink);
    }
  }

  /** The dome over the lantern, round as a pot lid, its ball and the rod. */
  private dome(t: Tower, lTop: number): void {
    const side = this.light.side, r = LANTERN_R + 1.5, at = t.mid(lTop);
    for (let k = 0; k < 6; k++) {
      const half = r * Math.sqrt(1 - (k / 6) ** 2);
      for (let x = Math.floor(at - half); x <= at + half; x++) {
        const u = ((x - at) / r) * side;
        const c = u > 0.15 ? R.iron[2]! : u > -0.3 ? R.iron[1]! : R.iron[0]!;
        this.stone(t, x, lTop - 1 - k, k === 0 && this.hour.night ? R.ember[1]! : c);
      }
    }
    for (const [dx, dy] of [[0, -7], [1, -7], [0, -8], [1, -8]] as const) this.stone(t, at + dx, lTop + dy, dx > 0 ? R.iron[2]! : R.iron[1]!);
    for (let k = 9; k < 15; k++) this.stone(t, at, lTop - k, R.ink);
  }

  /** The halo: a pale disc round the lit lantern, its edge scattered into the night as single pixels. */
  private halo(t: Tower, hy: number): void {
    const hx = t.mid(hy), EMBERS = [[R.ember[3]!, R.ember[4]!], [R.ember[2]!, R.ember[2]!], [R.ember[1]!, R.ember[1]!]] as const;
    for (let dy = -17; dy <= 17; dy++) for (let dx = -17; dx <= 17; dx++) {
      const far = Math.hypot(dx, dy), x = Math.round(hx + dx), y = Math.round(hy + dy);
      if (far > 17 || t.body.has(y * this.size.w + x)) continue;
      const ring = far < 9 ? 0 : far < 12.5 ? 1 : 2;
      const keep = [0.92, 0.6, 0.5 * (1 - (far - 12.5) / 4.5)][ring]!;
      if (hash2(x, y, 61) < keep) this.put(x, y, EMBERS[ring][hash2(x >> 1, y, 62) > 0.5 ? 1 : 0]);
    }
  }

  /** The lantern's panes between dark bars: lit yellow at night, the sky's light in them by day. */
  private lantern(t: Tower, lTop: number, lb: number): void {
    const side = this.light.side;
    for (let y = lTop; y < lb; y++) for (let x = Math.floor(t.mid(y) - LANTERN_R); x <= t.mid(y) + LANTERN_R; x++) {
      const u = (x - t.mid(y)) / LANTERN_R, bar = Math.abs(u) > 0.84 || Math.round(x - t.mid(y)) % 3 === 0 || y === lTop;
      const lit = Math.abs(u) < 0.5 ? R.moon[0]! : R.ember[4]!, pane = u * side > 0 ? R.sky[4]! : R.sky[2]!;
      this.put(x, y, bar ? R.ink : this.hour.night ? lit : pane);
    }
  }

  paint(): Bitmap {
    this.sky();
    if (this.hour.night) this.stars();
    const disc = this.disc();
    this.clouds();
    this.sea(disc);
    // the land rises to the horizon toward the lighthouse (docs/keri.md): its window shows meadow, not sea
    const side = this.panes.side;
    this.meadow({ ...side, x: side.x - 20, w: side.w + 40 }, side.y + side.h - this.hz - 2, 7);
    this.lighthouse(side);
    this.roses(side);
    this.meadow(this.panes.left, 7, 3);
    this.meadow(this.panes.right, 5, 5);
    return this.bitmap;
  }
}

/**
 * The view behind the wall: a picture of `size` in the places of `VIEW`'s palette, of which the room shows what lies in
 * its windows' glass. `horizon` is the row of the sea's level horizon; `shimmer` (0 or 1) moves the sea's dashes and glints.
 */
export function paintView(size: { w: number; h: number }, panes: RoomPanes, horizon: number, phase: SkyPhase, shimmer = 0): Bitmap {
  return new View(size, panes, horizon, phase, shimmer).paint();
}
