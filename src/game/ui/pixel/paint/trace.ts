/**
 * A small ray caster for painted scenes (the warden's room, ft_1_18): shapes in metres, a ray per pixel, the nearest
 * shape wins. It only finds what a ray meets; colour and light are the painter's (`painter.ts`). Pure numbers, no Phaser.
 */

/** What a shape tells about a point on it: the way its skin faces, and where on the skin the point is, in metres. */
export interface Skin {
  nx: number;
  ny: number;
  nz: number;
  u: number;
  v: number;
  /** Which side of the shape: a box's six faces are 0 to 5 (-x, +x, -y, +y, -z, +z in its own turn), a cone's side 0, its ends 1 and 2 and a face where it was split 3. */
  face: number;
}

export interface Bounds {
  x0: number; y0: number; z0: number;
  x1: number; y1: number; z1: number;
}

/** The colour of a point of a shape before light falls on it; `emit` above 0 makes it shine by itself. */
export interface Paint {
  r: number;
  g: number;
  b: number;
  emit: number;
}

/** What a material is asked about: the point, the skin there, and the answer to fill in. */
export interface Dab extends Skin, Paint {
  x: number;
  y: number;
  z: number;
  /** How many metres one pixel of the picture covers here: a painted line is never thinner than this, or it would break up. */
  fine: number;
}

export type Material = (dab: Dab) => void;

export abstract class Shape {
  /** Its number in the scene (set by `Scene`), from 1. */
  id = 0;
  /** Shapes of one thing share a group: between them the painter draws a soft line, not the dark outline. */
  group = 0;
  /** False for cloth and glass-like things that should not throw a hard shadow. */
  shadow = true;
  /** True for things outside the windows: daylight falls on them, not the room's lamps. */
  outdoor = false;
  abstract bounds(): Bounds;
  /** Where along the ray (`o + t d`) the shape is met, the first place past `tMin`; -1 when it is not. */
  abstract hit(ox: number, oy: number, oz: number, dx: number, dy: number, dz: number, tMin: number, tMax: number): number;
  abstract skin(x: number, y: number, z: number, out: Skin): void;
  constructor(readonly material: Material) {}
}

type V3 = readonly [number, number, number];

function sub(a: V3, b: V3): [number, number, number] {
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
}
function cross(a: V3, b: V3): [number, number, number] {
  return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
}
function unit(a: V3): [number, number, number] {
  const l = Math.hypot(a[0], a[1], a[2]) || 1;
  return [a[0] / l, a[1] / l, a[2] / l];
}

/** A hole in a flat shape: from `u0` to `u1` and `v0` to `v1` on its skin; with `lean` its sides lean by that much of `u` for each unit of `v` above `v0` (a window whose frame is not plumb). */
export interface Hole { u0: number; u1: number; v0: number; v1: number; lean?: number }

/**
 * A flat rectangle from corner `o` along the edges `eu` and `ev` (at right angles). `holes` are cut out of it (a window in
 * a wall), and `mask` may cut any outline: it says whether the skin is there at (u, v).
 */
export class Flat extends Shape {
  private readonly n: V3;
  private readonly uh: V3;
  private readonly vh: V3;
  private readonly lu: number;
  private readonly lv: number;
  holes: Hole[] = [];
  mask: ((u: number, v: number) => boolean) | null = null;

  constructor(private readonly o: V3, eu: V3, ev: V3, material: Material) {
    super(material);
    this.lu = Math.hypot(...eu);
    this.lv = Math.hypot(...ev);
    this.uh = unit(eu);
    this.vh = unit(ev);
    this.n = unit(cross(eu, ev));
  }

  bounds(): Bounds {
    const { o, uh, vh, lu, lv } = this;
    const b = { x0: Infinity, y0: Infinity, z0: Infinity, x1: -Infinity, y1: -Infinity, z1: -Infinity };
    for (const [a, c] of [[0, 0], [lu, 0], [0, lv], [lu, lv]] as const) {
      const p = [o[0] + uh[0] * a + vh[0] * c, o[1] + uh[1] * a + vh[1] * c, o[2] + uh[2] * a + vh[2] * c] as const;
      b.x0 = Math.min(b.x0, p[0] - 0.01); b.x1 = Math.max(b.x1, p[0] + 0.01);
      b.y0 = Math.min(b.y0, p[1] - 0.01); b.y1 = Math.max(b.y1, p[1] + 0.01);
      b.z0 = Math.min(b.z0, p[2] - 0.01); b.z1 = Math.max(b.z1, p[2] + 0.01);
    }
    return b;
  }

  hit(ox: number, oy: number, oz: number, dx: number, dy: number, dz: number, tMin: number, tMax: number): number {
    const { o, n, uh, vh } = this;
    const denom = n[0] * dx + n[1] * dy + n[2] * dz;
    if (denom > -1e-9 && denom < 1e-9) return -1;
    const t = (n[0] * (o[0] - ox) + n[1] * (o[1] - oy) + n[2] * (o[2] - oz)) / denom;
    if (t <= tMin || t >= tMax) return -1;
    const px = ox + dx * t - o[0], py = oy + dy * t - o[1], pz = oz + dz * t - o[2];
    const u = px * uh[0] + py * uh[1] + pz * uh[2];
    if (u < 0 || u > this.lu) return -1;
    const v = px * vh[0] + py * vh[1] + pz * vh[2];
    if (v < 0 || v > this.lv) return -1;
    for (const h of this.holes) {
      const lu = u - (h.lean ?? 0) * (v - h.v0);
      if (lu > h.u0 && lu < h.u1 && v > h.v0 && v < h.v1) return -1;
    }
    if (this.mask && !this.mask(u, v)) return -1;
    return t;
  }

  skin(x: number, y: number, z: number, out: Skin): void {
    const { o, n, uh, vh } = this;
    const px = x - o[0], py = y - o[1], pz = z - o[2];
    out.nx = n[0]; out.ny = n[1]; out.nz = n[2];
    out.u = px * uh[0] + py * uh[1] + pz * uh[2];
    out.v = px * vh[0] + py * vh[1] + pz * vh[2];
    out.face = 0;
  }
}

/** A box round `c` with half sizes `h`, turned by `turn` radians about the upright axis. */
export class Box extends Shape {
  private readonly cos: number;
  private readonly sin: number;

  constructor(private readonly c: V3, private readonly h: V3, turn: number, material: Material) {
    super(material);
    this.cos = Math.cos(turn);
    this.sin = Math.sin(turn);
  }

  bounds(): Bounds {
    const { c, h } = this;
    const reach = Math.hypot(h[0], h[2]);
    return { x0: c[0] - reach, x1: c[0] + reach, y0: c[1] - h[1], y1: c[1] + h[1], z0: c[2] - reach, z1: c[2] + reach };
  }

  hit(ox: number, oy: number, oz: number, dx: number, dy: number, dz: number, tMin: number, tMax: number): number {
    const { c, h, cos, sin } = this;
    const rx = ox - c[0], rz = oz - c[2];
    const lx = rx * cos + rz * sin, lz = -rx * sin + rz * cos, ly = oy - c[1];
    const ex = dx * cos + dz * sin, ez = -dx * sin + dz * cos;
    let t0 = -Infinity, t1 = Infinity;
    // the three pairs of faces, one after the other
    if (ex > -1e-12 && ex < 1e-12) { if (lx < -h[0] || lx > h[0]) return -1; } else {
      let a = (-h[0] - lx) / ex, b = (h[0] - lx) / ex;
      if (a > b) { const s = a; a = b; b = s; }
      if (a > t0) t0 = a;
      if (b < t1) t1 = b;
    }
    if (dy > -1e-12 && dy < 1e-12) { if (ly < -h[1] || ly > h[1]) return -1; } else {
      let a = (-h[1] - ly) / dy, b = (h[1] - ly) / dy;
      if (a > b) { const s = a; a = b; b = s; }
      if (a > t0) t0 = a;
      if (b < t1) t1 = b;
    }
    if (ez > -1e-12 && ez < 1e-12) { if (lz < -h[2] || lz > h[2]) return -1; } else {
      let a = (-h[2] - lz) / ez, b = (h[2] - lz) / ez;
      if (a > b) { const s = a; a = b; b = s; }
      if (a > t0) t0 = a;
      if (b < t1) t1 = b;
    }
    if (t0 > t1) return -1;
    const t = t0 > tMin ? t0 : t1;
    return t > tMin && t < tMax ? t : -1;
  }

  skin(x: number, y: number, z: number, out: Skin): void {
    const { c, h, cos, sin } = this;
    const rx = x - c[0], rz = z - c[2];
    const lx = rx * cos + rz * sin, lz = -rx * sin + rz * cos, ly = y - c[1];
    const ax = Math.abs(lx) / h[0], ay = Math.abs(ly) / h[1], az = Math.abs(lz) / h[2];
    if (ax >= ay && ax >= az) {
      const s = lx < 0 ? -1 : 1;
      out.nx = s * cos; out.ny = 0; out.nz = s * sin; out.u = lz; out.v = ly; out.face = lx < 0 ? 0 : 1;
    } else if (ay >= az) {
      out.nx = 0; out.ny = ly < 0 ? -1 : 1; out.nz = 0; out.u = lx; out.v = lz; out.face = ly < 0 ? 2 : 3;
    } else {
      const s = lz < 0 ? -1 : 1;
      out.nx = -s * sin; out.ny = 0; out.nz = s * cos; out.u = lx; out.v = ly; out.face = lz < 0 ? 4 : 5;
    }
  }
}

/**
 * Where a post was split along its length: what lies past `at` metres from its axis, in the direction `angle`
 * (radians round the axis), is gone, and a flat face is left there.
 */
export interface Split { angle: number; at: number }

/**
 * A round post from `a` to `b`, `ra` wide at `a` and `rb` at `b` (radii): a pipe, a leg, a lampshade, a tower. Closed
 * at both ends. With `splits` it is a split log: a half, a quarter, a round with a slab off its side.
 */
export class Cone extends Shape {
  private readonly ax: V3;
  private readonly e1: V3;
  private readonly e2: V3;
  private readonly len: number;
  private readonly k: number;
  /** Each split as the plane `x cos + z sin = at` in the post's own frame. */
  private readonly cuts: readonly { cos: number; sin: number; at: number }[];

  constructor(private readonly a: V3, private readonly b: V3, private readonly ra: number, private readonly rb: number, material: Material, splits: readonly Split[] = []) {
    super(material);
    this.cuts = splits.map((c) => ({ cos: Math.cos(c.angle), sin: Math.sin(c.angle), at: c.at }));
    const d = sub(b, a);
    this.len = Math.hypot(...d);
    this.ax = unit(d);
    const side: V3 = Math.abs(this.ax[1]) > 0.9 ? [1, 0, 0] : [0, 1, 0];
    this.e1 = unit(cross(side, this.ax));
    this.e2 = cross(this.ax, this.e1);
    this.k = (rb - ra) / this.len;
  }

  bounds(): Bounds {
    const { a, b } = this;
    const r = Math.max(this.ra, this.rb);
    return {
      x0: Math.min(a[0], b[0]) - r, x1: Math.max(a[0], b[0]) + r,
      y0: Math.min(a[1], b[1]) - r, y1: Math.max(a[1], b[1]) + r,
      z0: Math.min(a[2], b[2]) - r, z1: Math.max(a[2], b[2]) + r,
    };
  }

  /** True where the post's wood is left: on the kept side of every split but `skip` (a point in its own frame). */
  private kept(x: number, z: number, skip: number): boolean {
    const { cuts } = this;
    for (let j = 0; j < cuts.length; j++) {
      const c = cuts[j]!;
      if (j !== skip && x * c.cos + z * c.sin > c.at + 1e-9) return false;
    }
    return true;
  }

  hit(ox: number, oy: number, oz: number, dx: number, dy: number, dz: number, tMin: number, tMax: number): number {
    const { a, ax, e1, e2, len, k, ra, rb, cuts } = this;
    const px = ox - a[0], py = oy - a[1], pz = oz - a[2];
    const lx = px * e1[0] + py * e1[1] + pz * e1[2], ly = px * ax[0] + py * ax[1] + pz * ax[2], lz = px * e2[0] + py * e2[1] + pz * e2[2];
    const ex = dx * e1[0] + dy * e1[1] + dz * e1[2], ey = dx * ax[0] + dy * ax[1] + dz * ax[2], ez = dx * e2[0] + dy * e2[1] + dz * e2[2];
    let best = tMax;
    // the side
    const r0 = ra + k * ly;
    const qa = ex * ex + ez * ez - k * k * ey * ey;
    const qb = 2 * (lx * ex + lz * ez - k * ey * r0);
    const qc = lx * lx + lz * lz - r0 * r0;
    if (qa > 1e-12 || qa < -1e-12) {
      const disc = qb * qb - 4 * qa * qc;
      if (disc >= 0) {
        const root = Math.sqrt(disc);
        for (const t of [(-qb - root) / (2 * qa), (-qb + root) / (2 * qa)]) {
          if (t <= tMin || t >= best) continue;
          const y = ly + ey * t;
          if (y >= 0 && y <= len && ra + k * y >= 0 && this.kept(lx + ex * t, lz + ez * t, -1)) best = t;
        }
      }
    }
    // the two ends
    if (ey > 1e-12 || ey < -1e-12) {
      for (const [y, r] of [[0, ra], [len, rb]] as const) {
        const t = (y - ly) / ey;
        if (t <= tMin || t >= best) continue;
        const hx = lx + ex * t, hz = lz + ez * t;
        if (hx * hx + hz * hz <= r * r && this.kept(hx, hz, -1)) best = t;
      }
    }
    // the flat faces where it was split
    for (let j = 0; j < cuts.length; j++) {
      const c = cuts[j]!;
      const toward = ex * c.cos + ez * c.sin;
      if (toward < 1e-12 && toward > -1e-12) continue;
      const t = (c.at - lx * c.cos - lz * c.sin) / toward;
      if (t <= tMin || t >= best) continue;
      const y = ly + ey * t, r = ra + k * y;
      const hx = lx + ex * t, hz = lz + ez * t;
      if (y >= 0 && y <= len && r >= 0 && hx * hx + hz * hz <= r * r && this.kept(hx, hz, j)) best = t;
    }
    return best < tMax ? best : -1;
  }

  skin(x: number, y: number, z: number, out: Skin): void {
    const { a, ax, e1, e2, len, k, ra } = this;
    const px = x - a[0], py = y - a[1], pz = z - a[2];
    const lx = px * e1[0] + py * e1[1] + pz * e1[2], ly = px * ax[0] + py * ax[1] + pz * ax[2], lz = px * e2[0] + py * e2[1] + pz * e2[2];
    const r = ra + k * ly;
    const off = Math.hypot(lx, lz);
    if (ly < 1e-4 && off < ra - 1e-5) {
      out.nx = -ax[0]; out.ny = -ax[1]; out.nz = -ax[2]; out.u = lx; out.v = lz; out.face = 1;
    } else if (ly > len - 1e-4 && off < this.rb - 1e-5) {
      out.nx = ax[0]; out.ny = ax[1]; out.nz = ax[2]; out.u = lx; out.v = lz; out.face = 2;
    } else if (this.splitAt(lx, lz, off, r) >= 0) {
      const c = this.cuts[this.splitAt(lx, lz, off, r)]!;
      out.nx = c.cos * e1[0] + c.sin * e2[0]; out.ny = c.cos * e1[1] + c.sin * e2[1]; out.nz = c.cos * e1[2] + c.sin * e2[2];
      out.u = lz * c.cos - lx * c.sin; out.v = ly; out.face = 3;
    } else {
      const gx = lx, gy = -k * r, gz = lz;
      const l = Math.hypot(gx, gy, gz) || 1;
      out.nx = (gx * e1[0] + gy * ax[0] + gz * e2[0]) / l;
      out.ny = (gx * e1[1] + gy * ax[1] + gz * e2[1]) / l;
      out.nz = (gx * e1[2] + gy * ax[2] + gz * e2[2]) / l;
      out.u = Math.atan2(lz, lx) * Math.max(r, 0.01);
      out.v = ly;
      out.face = 0;
    }
  }

  /** Which split's flat face a point inside the post's round lies on; -1 for none. */
  private splitAt(x: number, z: number, off: number, r: number): number {
    if (off >= r - 1e-5) return -1;
    return this.cuts.findIndex((c) => Math.abs(x * c.cos + z * c.sin - c.at) < 1e-4);
  }
}

/** A ball squashed to the radii `r` round `c`, turned by `turn` about the upright axis: a pillow, a sleeping animal, a bump in a blanket. */
export class Blob extends Shape {
  private readonly cos: number;
  private readonly sin: number;

  constructor(private readonly c: V3, private readonly r: V3, turn: number, material: Material) {
    super(material);
    this.cos = Math.cos(turn);
    this.sin = Math.sin(turn);
  }

  bounds(): Bounds {
    const { c, r } = this;
    const reach = Math.max(r[0], r[2]);
    return { x0: c[0] - reach, x1: c[0] + reach, y0: c[1] - r[1], y1: c[1] + r[1], z0: c[2] - reach, z1: c[2] + reach };
  }

  hit(ox: number, oy: number, oz: number, dx: number, dy: number, dz: number, tMin: number, tMax: number): number {
    const { c, r, cos, sin } = this;
    const rx = ox - c[0], rz = oz - c[2];
    const lx = (rx * cos + rz * sin) / r[0], ly = (oy - c[1]) / r[1], lz = (-rx * sin + rz * cos) / r[2];
    const ex = (dx * cos + dz * sin) / r[0], ey = dy / r[1], ez = (-dx * sin + dz * cos) / r[2];
    const qa = ex * ex + ey * ey + ez * ez;
    const qb = 2 * (lx * ex + ly * ey + lz * ez);
    const qc = lx * lx + ly * ly + lz * lz - 1;
    const disc = qb * qb - 4 * qa * qc;
    if (disc < 0) return -1;
    const root = Math.sqrt(disc);
    const near = (-qb - root) / (2 * qa);
    if (near > tMin) return near < tMax ? near : -1;
    const far = (-qb + root) / (2 * qa);
    return far > tMin && far < tMax ? far : -1;
  }

  skin(x: number, y: number, z: number, out: Skin): void {
    const { c, r, cos, sin } = this;
    const rx = x - c[0], rz = z - c[2];
    const lx = rx * cos + rz * sin, ly = y - c[1], lz = -rx * sin + rz * cos;
    const gx = lx / (r[0] * r[0]), gy = ly / (r[1] * r[1]), gz = lz / (r[2] * r[2]);
    const l = Math.hypot(gx, gy, gz) || 1;
    out.nx = (gx * cos - gz * sin) / l; out.ny = gy / l; out.nz = (gx * sin + gz * cos) / l;
    out.u = lx; out.v = lz; out.face = 0;
  }
}

/** Nine numbers of a 3 x 3 matrix, row by row. */
export type Mat3 = readonly [number, number, number, number, number, number, number, number, number];

function inverse(m: Mat3): Mat3 {
  const [a, b, c, d, e, f, g, h, i] = m;
  const det = a * (e * i - f * h) - b * (d * i - f * g) + c * (d * h - e * g);
  return [(e * i - f * h) / det, (c * h - b * i) / det, (b * f - c * e) / det, (f * g - d * i) / det, (a * i - c * g) / det, (c * d - a * f) / det, (d * h - e * g) / det, (b * g - a * h) / det, (a * e - b * d) / det];
}

/**
 * A sheet that is not flat: a slab `thick` deep whose top rises and falls over a rectangle on the plan, `lift(lx, lz)`
 * metres above `c[1]` at a place measured from the rectangle's middle in its own turn. A sheet of paper that droops
 * over the edge of its pile or curls up at a corner, a sheaf that sags at its edges. Its faces are numbered as a box's:
 * the top is 3 (`u` across, `v` along its depth), the under side 2, the cut edges 0, 1, 4 and 5 (`v` up through the
 * sheet, from its middle). With `edge` its outline is not the rectangle's: `edge(lx, lz)` is how far inside the
 * rectangle the sheet ends near that place (a worn, wavering edge, a corner torn off).
 */
export class Bent extends Shape {
  private readonly cos: number;
  private readonly sin: number;
  private readonly lo: number;
  private readonly hi: number;

  constructor(private readonly c: V3, private readonly half: readonly [number, number], turn: number, private readonly thick: number, private readonly lift: (lx: number, lz: number) => number, material: Material, private readonly edge?: (lx: number, lz: number) => number) {
    super(material);
    this.cos = Math.cos(turn);
    this.sin = Math.sin(turn);
    // how low and how high the sheet reaches, looked for on a grid; a smooth sheet does not hide a peak between two places of it
    let lo = Infinity, hi = -Infinity;
    for (let i = 0; i <= 16; i++) for (let j = 0; j <= 16; j++) {
      const y = lift(half[0] * (i / 8 - 1), half[1] * (j / 8 - 1));
      lo = Math.min(lo, y); hi = Math.max(hi, y);
    }
    const slack = 0.1 * (hi - lo) + 0.002;
    this.lo = lo - slack; this.hi = hi + slack;
  }

  bounds(): Bounds {
    const { c, half } = this;
    // the turned rectangle's own reach along the room's x and z
    const rx = Math.abs(half[0] * this.cos) + Math.abs(half[1] * this.sin), rz = Math.abs(half[0] * this.sin) + Math.abs(half[1] * this.cos);
    return { x0: c[0] - rx, x1: c[0] + rx, y0: c[1] + this.lo - this.thick, y1: c[1] + this.hi, z0: c[2] - rz, z1: c[2] + rz };
  }

  hit(ox: number, oy: number, oz: number, dx: number, dy: number, dz: number, tMin: number, tMax: number): number {
    const { c, half, cos, sin, thick, lift } = this;
    const rx = ox - c[0], rz = oz - c[2];
    const lx = rx * cos + rz * sin, lz = -rx * sin + rz * cos, ly = oy - c[1];
    const ex = dx * cos + dz * sin, ez = -dx * sin + dz * cos;
    // the stretch of the ray over the rectangle and between the sheet's lowest and highest place
    let t0 = tMin, t1 = tMax;
    for (const [at, way, min, max] of [[lx, ex, -half[0], half[0]], [ly, dy, this.lo - thick, this.hi], [lz, ez, -half[1], half[1]]] as const) {
      if (way > -1e-12 && way < 1e-12) { if (at < min || at > max) return -1; continue; }
      let a = (min - at) / way, b = (max - at) / way;
      if (a > b) { const s = a; a = b; b = s; }
      if (a > t0) t0 = a;
      if (b < t1) t1 = b;
    }
    if (t0 >= t1) return -1;
    /** Where the ray is at `t`: 1 over the sheet, 0 in it, -1 under it. */
    const where = (t: number): number => {
      const g = ly + dy * t - lift(lx + ex * t, lz + ez * t);
      return g > 0 ? 1 : g < -thick ? -1 : 0;
    };
    // a step for each 2 centimetres the ray goes across the plan or up and down, 20 at most: a sheet's bends are wider than that
    const STEPS = Math.min(20, Math.max(2, Math.ceil((t1 - t0) * (Math.hypot(ex, ez) + Math.abs(dy)) / 0.02)));
    let a = t0, wa = where(a);
    // it comes in through a cut edge: that is where it meets the sheet (a ray that starts inside the sheet goes on to leave it)
    if (wa === 0 && t0 > tMin) {
      const met = this.past(t0, t1, lx, lz, ex, ez, where);
      if (met >= 0) return met;
      a = -met - 1; wa = where(a);
    }
    const from = a;
    for (let i = 1; i <= STEPS; i++) {
      const b = from + (t1 - from) * i / STEPS;
      if (b <= a) continue;
      const wb = where(b);
      if (wb !== wa && wa !== 0) {
        let near = a, far = b;
        for (let k = 0; k < 12; k++) {
          const m = (near + far) / 2;
          if (where(m) === wa) near = m; else far = m;
        }
        const met = this.past(far, t1, lx, lz, ex, ez, where);
        if (met >= 0) return met;
        // it went through where the sheet's edge is worn away: on from where it left the sheet's thickness
        a = -met - 1; wa = where(a);
        continue;
      }
      a = b; wa = wb;
    }
    return -1;
  }

  /** Whether the sheet is there at a place of its rectangle (its outline may lie inside the rectangle). */
  private there(lx: number, lz: number): boolean {
    return !this.edge || Math.min(this.half[0] - Math.abs(lx), this.half[1] - Math.abs(lz)) >= this.edge(lx, lz);
  }

  /**
   * A ray is within the sheet's thickness at `t`: where it meets the sheet from there on, which is `t` itself unless
   * the sheet's edge is worn away at that place; then the ray goes on within the thickness until the sheet is there.
   * When it leaves the thickness (or the rectangle) first, the answer is below 0: `-(t + 1)` of where it left.
   */
  private past(t: number, t1: number, lx: number, lz: number, ex: number, ez: number, where: (t: number) => number): number {
    if (this.there(lx + ex * t, lz + ez * t)) return t;
    // in steps of about 3 millimetres across the plan
    const step = 0.003 / Math.max(1e-6, Math.hypot(ex, ez));
    for (let k = 1; k <= 24; k++) {
      const at = t + k * step;
      if (at >= t1 || where(at) !== 0) return -(Math.min(at, t1) + 1);
      if (this.there(lx + ex * at, lz + ez * at)) return at;
    }
    return -(Math.min(t + 25 * step, t1) + 1);
  }

  skin(x: number, y: number, z: number, out: Skin): void {
    const { c, half, cos, sin, thick, lift } = this;
    const rx = x - c[0], rz = z - c[2];
    const lx = rx * cos + rz * sin, lz = -rx * sin + rz * cos;
    const g = y - c[1] - lift(lx, lz);
    const inner = g < -2e-4 && g > -thick + 2e-4;
    if (inner && half[0] - Math.abs(lx) < 1e-4) {
      const s = lx < 0 ? -1 : 1;
      out.nx = s * cos; out.ny = 0; out.nz = s * sin; out.u = lz; out.v = g + thick / 2; out.face = lx < 0 ? 0 : 1;
      return;
    }
    if (inner && half[1] - Math.abs(lz) < 1e-4) {
      const s = lz < 0 ? -1 : 1;
      out.nx = -s * sin; out.ny = 0; out.nz = s * cos; out.u = lx; out.v = g + thick / 2; out.face = lz < 0 ? 4 : 5;
      return;
    }
    if (inner && this.edge) {
      // a worn edge inside the rectangle: it faces as the nearest side of the rectangle does
      if (half[0] - Math.abs(lx) < half[1] - Math.abs(lz)) {
        const s = lx < 0 ? -1 : 1;
        out.nx = s * cos; out.ny = 0; out.nz = s * sin; out.u = lz; out.v = g + thick / 2; out.face = lx < 0 ? 0 : 1;
      } else {
        const s = lz < 0 ? -1 : 1;
        out.nx = -s * sin; out.ny = 0; out.nz = s * cos; out.u = lx; out.v = g + thick / 2; out.face = lz < 0 ? 4 : 5;
      }
      return;
    }
    // the top or the under side: it faces as the sheet slopes there
    const e = 0.002, top = g > -thick / 2 ? 1 : -1;
    const sx = (lift(lx + e, lz) - lift(lx - e, lz)) / (2 * e), sz = (lift(lx, lz + e) - lift(lx, lz - e)) / (2 * e);
    const l = top / Math.hypot(sx, 1, sz);
    out.nx = (-sx * cos + sz * sin) * l; out.ny = l; out.nz = (-sx * sin - sz * cos) * l;
    out.u = lx; out.v = lz; out.face = top > 0 ? 3 : 2;
  }
}

/**
 * A shape as a hand draws it, not as a carpenter builds it: leant, sheared, fatter or thinner than it was made. Every
 * point of `inner` is moved by the matrix `m` round `pivot` (a point that stays where it is, as a thing's foot on the
 * floor). Nothing in the painted rooms this follows is plumb or square (art-direction rule 3).
 */
export class Leant extends Shape {
  private readonly inv: Mat3;

  constructor(readonly inner: Shape, private readonly pivot: V3, private readonly m: Mat3) {
    super(inner.material);
    this.inv = inverse(m);
  }

  /** The point of the thing as it was made that stands at (x, y, z) now. */
  private made(x: number, y: number, z: number): [number, number, number] {
    const { inv: n, pivot: p } = this;
    const px = x - p[0], py = y - p[1], pz = z - p[2];
    return [p[0] + n[0] * px + n[1] * py + n[2] * pz, p[1] + n[3] * px + n[4] * py + n[5] * pz, p[2] + n[6] * px + n[7] * py + n[8] * pz];
  }

  /** Where a point of the thing as it was made stands now. */
  moved(x: number, y: number, z: number): [number, number, number] {
    const { m, pivot: p } = this;
    const px = x - p[0], py = y - p[1], pz = z - p[2];
    return [p[0] + m[0] * px + m[1] * py + m[2] * pz, p[1] + m[3] * px + m[4] * py + m[5] * pz, p[2] + m[6] * px + m[7] * py + m[8] * pz];
  }

  bounds(): Bounds {
    const b = this.inner.bounds();
    const out = { x0: Infinity, y0: Infinity, z0: Infinity, x1: -Infinity, y1: -Infinity, z1: -Infinity };
    for (const x of [b.x0, b.x1]) for (const y of [b.y0, b.y1]) for (const z of [b.z0, b.z1]) {
      const p = this.moved(x, y, z);
      out.x0 = Math.min(out.x0, p[0]); out.x1 = Math.max(out.x1, p[0]);
      out.y0 = Math.min(out.y0, p[1]); out.y1 = Math.max(out.y1, p[1]);
      out.z0 = Math.min(out.z0, p[2]); out.z1 = Math.max(out.z1, p[2]);
    }
    return out;
  }

  hit(ox: number, oy: number, oz: number, dx: number, dy: number, dz: number, tMin: number, tMax: number): number {
    const n = this.inv;
    const o = this.made(ox, oy, oz);
    // the ray's way goes through the same matrix and is not made a unit again, so a place along it keeps its `t`
    return this.inner.hit(o[0], o[1], o[2], n[0] * dx + n[1] * dy + n[2] * dz, n[3] * dx + n[4] * dy + n[5] * dz, n[6] * dx + n[7] * dy + n[8] * dz, tMin, tMax);
  }

  skin(x: number, y: number, z: number, out: Skin): void {
    const n = this.inv;
    const p = this.made(x, y, z);
    this.inner.skin(p[0], p[1], p[2], out);
    // a skin's facing goes through the inverse matrix turned over
    const fx = n[0] * out.nx + n[3] * out.ny + n[6] * out.nz, fy = n[1] * out.nx + n[4] * out.ny + n[7] * out.nz, fz = n[2] * out.nx + n[5] * out.ny + n[8] * out.nz;
    const l = Math.hypot(fx, fy, fz) || 1;
    out.nx = fx / l; out.ny = fy / l; out.nz = fz / l;
  }
}

interface Node {
  b: Bounds;
  left: Node | null;
  right: Node | null;
  shapes: Shape[];
}

function around(items: readonly { b: Bounds }[]): Bounds {
  const b = { x0: Infinity, y0: Infinity, z0: Infinity, x1: -Infinity, y1: -Infinity, z1: -Infinity };
  for (const { b: s } of items) {
    b.x0 = Math.min(b.x0, s.x0); b.y0 = Math.min(b.y0, s.y0); b.z0 = Math.min(b.z0, s.z0);
    b.x1 = Math.max(b.x1, s.x1); b.y1 = Math.max(b.y1, s.y1); b.z1 = Math.max(b.z1, s.z1);
  }
  return b;
}

const LEAF = 3;

/** A tree of boxes round the shapes, so a ray tests only the shapes near its way. */
function tree(items: { b: Bounds; shape: Shape }[]): Node {
  const b = around(items);
  if (items.length <= LEAF) return { b, left: null, right: null, shapes: items.map((i) => i.shape) };
  const size = [b.x1 - b.x0, b.y1 - b.y0, b.z1 - b.z0];
  const axis = size[0]! >= size[1]! && size[0]! >= size[2]! ? 'x' : size[1]! >= size[2]! ? 'y' : 'z';
  const mid = (i: { b: Bounds }) => i.b[`${axis}0`] + i.b[`${axis}1`];
  const sorted = [...items].sort((p, q) => mid(p) - mid(q));
  const half = sorted.length >> 1;
  return { b, left: tree(sorted.slice(0, half)), right: tree(sorted.slice(half)), shapes: [] };
}

function meets(b: Bounds, ox: number, oy: number, oz: number, ix: number, iy: number, iz: number, tMin: number, tMax: number): boolean {
  let t0 = tMin, t1 = tMax;
  let a = (b.x0 - ox) * ix, c = (b.x1 - ox) * ix;
  if (a > c) { const s = a; a = c; c = s; }
  if (a > t0) t0 = a;
  if (c < t1) t1 = c;
  if (t0 > t1) return false;
  a = (b.y0 - oy) * iy; c = (b.y1 - oy) * iy;
  if (a > c) { const s = a; a = c; c = s; }
  if (a > t0) t0 = a;
  if (c < t1) t1 = c;
  if (t0 > t1) return false;
  a = (b.z0 - oz) * iz; c = (b.z1 - oz) * iz;
  if (a > c) { const s = a; a = c; c = s; }
  if (a > t0) t0 = a;
  if (c < t1) t1 = c;
  return t0 <= t1;
}

/** The shapes of a picture, ready for rays. */
export class Scene {
  readonly shapes: Shape[] = [];
  private root: Node | null = null;
  private readonly stack: Node[] = [];
  /** Where the last `first` met its shape. */
  t = 0;

  add<T extends Shape>(shape: T, group = 0): T {
    shape.id = this.shapes.length + 1;
    shape.group = group || -shape.id;
    this.shapes.push(shape);
    this.root = null;
    return shape;
  }

  private top(): Node {
    this.root ??= tree(this.shapes.map((shape) => ({ b: shape.bounds(), shape })));
    return this.root;
  }

  /** The first shape the ray meets between `tMin` and `tMax`, or null; `this.t` says where. */
  first(ox: number, oy: number, oz: number, dx: number, dy: number, dz: number, tMin: number, tMax: number): Shape | null {
    const ix = 1 / dx, iy = 1 / dy, iz = 1 / dz;
    const stack = this.stack;
    let n = 0;
    stack[n++] = this.top();
    let best: Shape | null = null;
    let bestT = tMax;
    while (n > 0) {
      const node = stack[--n]!;
      if (!meets(node.b, ox, oy, oz, ix, iy, iz, tMin, bestT)) continue;
      if (node.left) {
        stack[n++] = node.left;
        stack[n++] = node.right!;
        continue;
      }
      for (const shape of node.shapes) {
        const t = shape.hit(ox, oy, oz, dx, dy, dz, tMin, bestT);
        if (t > 0) { bestT = t; best = shape; }
      }
    }
    this.t = bestT;
    return best;
  }

  /** Whether anything that throws a shadow stands on the ray between `tMin` and `tMax`. */
  blocked(ox: number, oy: number, oz: number, dx: number, dy: number, dz: number, tMin: number, tMax: number): boolean {
    const ix = 1 / dx, iy = 1 / dy, iz = 1 / dz;
    const stack = this.stack;
    let n = 0;
    stack[n++] = this.top();
    while (n > 0) {
      const node = stack[--n]!;
      if (!meets(node.b, ox, oy, oz, ix, iy, iz, tMin, tMax)) continue;
      if (node.left) {
        stack[n++] = node.left;
        stack[n++] = node.right!;
        continue;
      }
      for (const shape of node.shapes) if (shape.shadow && shape.hit(ox, oy, oz, dx, dy, dz, tMin, tMax) > 0) return true;
    }
    return false;
  }
}
