import { createBitmap, type Bitmap } from './bitmap';
import { hash2, noise2 } from './paint/noise';

/**
 * Birds and fish that move as a flock does: each one only keeps clear of its
 * neighbours, goes the way they go and stays near them (Reynolds' boids), wanders a little on its own, and is carried by
 * the wind; the flock's shape is never drawn, it comes out of that. Unlike the pure courses of `swimMotion.ts`, a flock
 * carries on from where it was: it is stepped forward in small fixed steps from the moment the scene opens. Its dice are
 * the day's seed, so the same steps from the same start always give the same flight. Places are fine pixels of the
 * picture, speeds fine pixels a second.
 */
export interface Boid {
  x: number;
  y: number;
  vx: number;
  vy: number;
}

export interface FlockRules {
  /** The box it keeps to: a bird near its edge turns back in. */
  box: { x: number; y: number; w: number; h: number };
  /** Its slowest and fastest pace. */
  speed: [number, number];
  /** How far a bird sees its neighbours, and how near it lets one come. */
  sight: number;
  room: number;
  /** How hard a bird turns: to keep clear, to go the neighbours' way, to stay near them, and to its own wandering. */
  part: number;
  align: number;
  gather: number;
  wander: number;
  /** How much of its pace it may climb or sink at (gulls glide nearly level). */
  climb: number;
  /** Where each one wants to be at a time (a fish's place in its school), or nothing: it is pulled there. */
  follow?: (k: number, t: number) => { x: number; y: number } | null;
  /** How hard it is pulled to its place. */
  pull?: number;
}

/** One step of a flock, in milliseconds: about 30 a second, as the screen. */
export const FLOCK_STEP_MS = 33;

export class Flock {
  readonly boids: Boid[];
  /** The flock's own time (ms), from when it started. */
  time = 0;
  /** Which boids are away (their place is nothing just now). */
  readonly away: boolean[];

  constructor(n: number, private readonly rules: FlockRules, private readonly seed = 0, start = 0) {
    const { box, speed } = rules;
    this.time = start;
    // they start near each other somewhere in the box, all going much the same way
    const cx = box.x + box.w * (0.2 + 0.6 * hash2(1, seed, 981)), cy = box.y + box.h * (0.3 + 0.4 * hash2(2, seed, 982));
    const heading = hash2(3, seed, 983) < 0.5 ? 0 : Math.PI;
    this.boids = Array.from({ length: n }, (_, k) => {
      const a = heading + (hash2(k, seed, 984) - 0.5) * 0.6, v = speed[0] + (speed[1] - speed[0]) * hash2(k, seed, 985);
      return { x: cx + (hash2(k, seed, 986) - 0.5) * 30, y: cy + (hash2(k, seed, 987) - 0.5) * 12, vx: Math.cos(a) * v, vy: Math.sin(a) * v * rules.climb };
    });
    this.away = this.boids.map(() => false);
    if (rules.follow) this.boids.forEach((b, k) => this.snap(b, k));
  }

  /** A boid that has just come back: at its place, going its way. */
  private snap(b: Boid, k: number): void {
    const at = this.rules.follow?.(k, this.time);
    this.away[k] = !at;
    if (!at) return;
    const ahead = this.rules.follow?.(k, this.time + 200);
    b.x = at.x;
    b.y = at.y;
    b.vx = ahead ? (ahead.x - at.x) * 5 : 0;
    b.vy = ahead ? (ahead.y - at.y) * 5 : 0;
  }

  /** Moves every boid one step (`FLOCK_STEP_MS`), the wind pushing each `push(x)` fine pixels a second along where it is. */
  step(push: (x: number) => number = () => 0): void {
    const r = this.rules, dt = FLOCK_STEP_MS / 1000;
    this.time += FLOCK_STEP_MS;
    const turns = this.boids.map((b, k) => {
      if (this.away[k]) return { ax: 0, ay: 0 };
      let ax = 0, ay = 0, n = 0, cx = 0, cy = 0, vx = 0, vy = 0;
      this.boids.forEach((o, j) => {
        if (j === k || this.away[j]) return;
        const dx = o.x - b.x, dy = o.y - b.y, d = Math.hypot(dx, dy);
        if (d > r.sight) return;
        n++;
        cx += o.x; cy += o.y; vx += o.vx; vy += o.vy;
        // keep clear: the nearer, the harder
        if (d < r.room && d > 0) { ax -= (dx / d) * r.part * (r.room / d); ay -= (dy / d) * r.part * (r.room / d); }
      });
      if (n > 0) {
        ax += (vx / n - b.vx) * r.align + (cx / n - b.x) * r.gather;
        ay += (vy / n - b.vy) * r.align + (cy / n - b.y) * r.gather;
      }
      // its own wandering: a heading that turns slowly
      const heading = 2 * Math.PI * noise2(this.time / 6000 + k * 3.7, k, 988 + this.seed);
      ax += Math.cos(heading) * r.wander;
      ay += Math.sin(heading) * r.wander * r.climb;
      // back into the box, harder the further out
      const { box } = r;
      const edge = 40;
      if (b.x < box.x + edge) ax += (box.x + edge - b.x) * 1.5;
      if (b.x > box.x + box.w - edge) ax -= (b.x - box.x - box.w + edge) * 1.5;
      if (b.y < box.y + edge / 3) ay += (box.y + edge / 3 - b.y) * 1.2;
      if (b.y > box.y + box.h - edge / 3) ay -= (b.y - box.y - box.h + edge / 3) * 1.2;
      // to its place, where it has one
      const at = r.follow?.(k, this.time);
      if (at) { ax += (at.x - b.x) * (r.pull ?? 1); ay += (at.y - b.y) * (r.pull ?? 1); }
      return { ax, ay };
    });
    this.boids.forEach((b, k) => {
      if (r.follow) {
        const was = this.away[k];
        const at = r.follow(k, this.time);
        if (!at) { this.away[k] = true; return; }
        if (was) { this.snap(b, k); return; }
      }
      const turn = turns[k]!;
      b.vx += turn.ax * dt;
      b.vy += turn.ay * dt;
      // no faster or slower than its pace allows, and climbing or sinking only so steeply
      b.vy = Math.max(-Math.abs(b.vx) * r.climb - 2, Math.min(Math.abs(b.vx) * r.climb + 2, b.vy));
      const v = Math.hypot(b.vx, b.vy);
      const want = Math.max(r.speed[0], Math.min(r.speed[1], v));
      if (v > 0) { b.vx *= want / v; b.vy *= want / v; }
      b.x += (b.vx + push(b.x)) * dt;
      b.y += b.vy * dt;
    });
  }

  /** Steps the flock on to `time` ms (at most a second's worth at once: after a pause it carries on, it does not race). */
  advance(time: number, push: (t: number, x: number) => number = () => 0): void {
    if (time - this.time > 1000) this.time = time - 1000;
    while (this.time + FLOCK_STEP_MS <= time) {
      const at = this.time;
      this.step((x) => push(at, x));
    }
  }
}

/**
 * A gull far off, `span` pixels each wing, in palette place `tone`: its looks with the wings up, level and down, a
 * flap going through them (as the painters drew them). Its body is at (`span`, `lift`) of each look. With
 * `edge` (a dark place of the palette) a line of it lies under the bird, for a gull over ground as pale as itself (the
 * map's, over the lighthouse: art review 2); over a sky it needs none.
 */
export function gullLooks(span: number, tone: number, edge?: number): { looks: Bitmap[]; body: { x: number; y: number } } {
  const lift = Math.round(span * 0.6), sink = Math.max(1, Math.round(span * 0.4));
  const w = 2 * span + 1, h = lift + sink + 1 + (edge === undefined ? 0 : 1);
  const wings: ((k: number) => number)[] = [(k) => Math.round(k * 0.6), (k) => (k === span ? 1 : 0), (k) => -Math.min(sink, Math.round(k * 0.4))];
  const looks = wings.map((up) => {
    const b = createBitmap(w, h);
    b.pixels[lift * w + span] = tone;
    for (let k = 1; k <= span; k++) {
      const y = lift - up(k);
      b.pixels[y * w + span - k] = tone;
      b.pixels[y * w + span + k] = tone;
    }
    if (edge !== undefined) {
      for (let i = w * (h - 1) - 1; i >= 0; i--) if (b.pixels[i] === tone && b.pixels[i + w] === 0) b.pixels[i + w] = edge;
    }
    return b;
  });
  return { looks, body: { x: span, y: lift } };
}

/** Which of a gull's three looks shows at `t` ms: mostly gliding (level), now and then a few beats of its wings. */
export function gullLook(k: number, t: number, climbing: boolean, seed = 0): number {
  const bout = Math.floor(t / 2200);
  const flapping = climbing || hash2(k, bout + seed, 991) < 0.35;
  if (!flapping) return 1;
  // up, level, down, level: about three beats a second
  return [0, 1, 2, 1][Math.floor(t / 85 + k) % 4]!;
}
