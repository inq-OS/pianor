import { hash2 } from '../../paint/noise';
import { runOf, type KitBrush, type KitFill, type KitItem } from './kit';
import { beside } from './shape';

/**
 * Wood: the planks of a deck and the posts and legs that carry it. The look is the picked one, both
 * following the Phatt dock (mi2-bg-2-028): warm, chunky and crooked. The docks were painted to it first and
 * these are lifted from them pixel for pixel, and `picked` once that pass was approved. The recipe in
 * words: `projects/painter/artists-notes/wood.md`.
 *
 * The wood has its own run of colours, `KIT_WOOD`: no shared material is wood, so a scene that places a wood type
 * names it as its own run, `scenePalette({ wood: KIT_WOOD }, ...)`. A deck's ground is the scene's answer about where
 * its planks lie, each as points on the picture; the scene keeps where its deck runs, the kit keeps how it looks.
 */

const MODEL = 'the docks (docksPicture.ts), painted to the picked look (both follow the Phatt dock); the docks\' pass 10 was approved';

/**
 * The warm wood after the Phatt dock: red and orange browns, from a near-black gap toward violet up to a pale worn top
 * edge toward straw (rule 20 of the art direction: the hue turns as the run lightens). The day's colours; the hour
 * lights them as it lights a material.
 */
export const KIT_WOOD = [0x1c0a10, 0x48180f, 0x772d14, 0xa2481c, 0xc8702e, 0xe6ae6a] as const;

/** A point on the picture, in fine pixels. */
export interface Pt {
  x: number;
  y: number;
}

/** Fills a four-sided shape on the picture row by row, a colour for each pixel, inside `width` by `height`. */
export function fillQuad(put: KitBrush['put'], pts: readonly Pt[], width: number, height: number, colour: (x: number, y: number) => number): void {
  const y0 = Math.max(0, Math.floor(Math.min(...pts.map((q) => q.y)))), y1 = Math.min(height - 1, Math.ceil(Math.max(...pts.map((q) => q.y))));
  for (let y = y0; y <= y1; y++) {
    const xs: number[] = [];
    for (let i = 0; i < pts.length; i++) {
      const a = pts[i]!, b = pts[(i + 1) % pts.length]!;
      if ((a.y <= y + 0.5 && b.y > y + 0.5) || (b.y <= y + 0.5 && a.y > y + 0.5)) xs.push(a.x + ((y + 0.5 - a.y) / (b.y - a.y)) * (b.x - a.x));
    }
    xs.sort((m, n) => m - n);
    for (let k = 0; k + 1 < xs.length; k += 2) for (let x = Math.max(0, Math.round(xs[k]!)); x <= Math.min(width - 1, Math.round(xs[k + 1]!) - 1); x++) put(x, y, colour(x, y));
  }
}

// ---- posts

/** One step of a post's spine, from its foot up: a run of rows at a column, how wide it is there, and how high over the water. */
export interface PostStep {
  /** The left edge's column is `x - wide / 2`; the rows `top` to `bottom`. */
  x: number;
  top: number;
  bottom: number;
  wide: number;
  /** How high over the water this step stands, in metres: under 0.3 or so it is wet and darker; under 0 in the water it is not drawn. */
  up: number;
}

export interface PostOptions {
  /** How tall it stands over its foot and how far its top stands off to the side (when the scene gives no `spine`), and its thickness at the foot (the water laps round it 2.4 times as wide), in fine pixels. */
  high: number;
  thick: number;
  lean: number;
  /** Whether its cut top shows (a pile that ends over the deck, a bollard), and whether it stands in the water, lapped by it. */
  cap: boolean;
  water: boolean;
  /**
   * The scene's own spine, seen through its own lens, foot to top, and its top (the point and width the cap sits on).
   * Left out, the post is a crooked pole `high` tall leaning `lean`.
   */
  spine?: { steps: readonly PostStep[]; top: Pt & { wide: number } };
}

/** A crooked pole of its own: the spine when a scene gives none. */
function ownSpine(x: number, foot: number, o: PostOptions, seed: number): NonNullable<PostOptions['spine']> {
  const steps: PostStep[] = [], n = Math.max(8, Math.round(o.high));
  const bend = (hash2(seed, 3, 242) - 0.5) * Math.min(o.thick * 1.5, o.high * 0.15);
  const at = (t: number): Pt => ({ x: x + o.lean * t + bend * Math.sin(t * Math.PI), y: foot - o.high * t });
  let top = { ...at(1), wide: o.thick };
  for (let k = 0; k < n; k++) {
    const a = at(k / n), b = at((k + 1) / n), wide = Math.max(1, o.thick * (1 - 0.15 * (k / n)));
    steps.push({ x: a.x, top: Math.min(a.y, b.y), bottom: Math.max(a.y, b.y), wide, up: o.water ? (2 * k) / n : 1 });
    top = { ...b, wide };
  }
  return { steps, top };
}

/**
 * A post, a pile or a leg (rules 5 and 6): a thick crooked pole, warm brown, lit on the light's side and near-black on
 * its shade side, darker where it is wet, with paint grain along it; its cut top the palest thing on it, cream with a
 * pale grey worn spot toward the light. In the water only what stands above it is drawn (its reflection is
 * `water/reflection`), and the water laps round its foot, coming and going with the loop. Placed by its foot.
 */
export const post: KitItem<PostOptions> = {
  id: 'wood/post',
  family: 'wood',
  about: 'a thick leaning post or pile: warm brown, near-black shade side, darker where wet, a cream cut top',
  state: 'picked',
  model: MODEL,
  note: 'wood.md',
  atlas: 'dock, woodtick, wood,outdoor',
  uses: ['wood', 'shingle', 'dry'],
  options: { high: 40, thick: 7, lean: 3, cap: true, water: false },
  variants: { pile: {}, 'in-water': { water: true }, thin: { thick: 3, high: 26, lean: -2 }, stump: { high: 14, thick: 9, lean: 1 } },
  ground: (o) => (o.water ? 'sea' : 'shingle'),
  box: (o) => ({ left: Math.ceil(o.thick * 1.6 + Math.max(0, -o.lean) + 3), right: Math.ceil(o.thick * 1.6 + Math.max(0, o.lean) + 3), up: Math.ceil(o.high + o.thick), down: 2 }),
  paint(b, x, foot, o, seed) {
    const wood = runOf(b.run, 'wood', post.id), shingle = runOf(b.run, 'shingle', post.id), dry = runOf(b.run, 'dry', post.id);
    const side = b.side;
    const { steps, top } = o.spine ?? ownSpine(x, foot, o, seed);
    for (const step of steps) {
      if (o.water && step.up < 0) continue;
      const { wide } = step;
      for (let y = Math.round(step.top); y <= Math.round(step.bottom); y++) for (let s = 0; s < wide; s++) {
        const u = ((s + 0.5) / wide - 0.5) * side;
        const wet = step.up < 0.3 + 0.1 * hash2(seed, Math.round(s), 244);
        const run = wet ? [wood[0]!, wood[0]!, wood[1]!, wood[2]!] : [wood[0]!, wood[1]!, wood[2]!, wood[3]!];
        // the lit side a band of its own, the shade side near-black, and paint grain along its length
        const k4 = u > 0.28 ? 3 : u > -0.05 ? 2 : u > -0.32 ? 1 : 0;
        b.put(step.x - wide / 2 + s, y, hash2(Math.round(s), y >> 1, seed) > 0.88 ? run[Math.max(0, k4 - 1)]! : run[k4]!);
      }
    }
    // the cut top: a flat lid of the palest wood, a pale grey worn spot on the light's side
    if (o.cap && top.wide >= 2) {
      const half = top.wide / 2, lid = Math.max(1, half * 0.4);
      for (let dy = -lid; dy <= lid; dy++) for (let dx = -half; dx <= half; dx++) {
        const e = (dx / half) ** 2 + (dy / lid) ** 2;
        if (e > 1) continue;
        b.put(top.x + dx, top.y + dy, e > 0.6 ? wood[5]! : dx * side > 0 && dy < 0 ? shingle[3]! : dry[3]!);
      }
    }
    if (!o.water) return;
    const wide = Math.max(2, o.thick * 2.4);
    const lap = b.sway?.(seed * 0.07) ?? 0;
    for (let s = -wide / 2; s <= wide / 2; s++) if (hash2(Math.round(x + s), seed, 243) > 0.25 - 0.2 * lap) b.put(x + s, foot + (lap > 0.4 ? 1 : 0), b.run.foam);
  },
};

// ---- planks

/** One plank of a deck as the picture shows it. */
export interface Plank {
  /** Its four corners: near left, far left, far right, near right. */
  corners: readonly [Pt, Pt, Pt, Pt];
  /** Its near edge's two ends' columns, for its light along it. */
  ends: readonly [number, number];
  /** Its far edge, where its pale top edge runs and the gap behind it, and how many rows it stands tall. */
  edge: readonly [Pt, Pt];
  tall: number;
  /** The near-black under it, a little wider and reaching toward the viewer: the gap to the next plank in. */
  gap?: readonly [Pt, Pt, Pt, Pt];
  /** The beams under the deck where it lies, each four points. */
  beams?: readonly (readonly [Pt, Pt, Pt, Pt])[];
  /** Where its nails are, near enough to show them. */
  nails?: readonly Pt[];
  /** A whole number of its own, for its tone and grain. */
  i: number;
}

/** The ground of a deck: its planks, far to near. */
export interface DeckGround {
  width: number;
  height: number;
  planks: readonly Plank[];
}

export interface PlanksOptions {
  /** How many planks in a hundred are clearly lighter and redder, and how many dark. */
  light: number;
  dark: number;
}

/**
 * The planks of a deck (rules 1 to 5, 7 and 8): broad and few, each its own warm brown and lighter toward its lit
 * end, lone grain strokes along it, a pale top edge along its far side and a near-black gap beyond it; dark beams
 * under the deck. The ends' raggedness, the skew and a missing plank are the scene's (they are where the planks lie);
 * a deck painted plank by plank between other things (legs, a barrel) paints a ground of one plank at a time.
 */
export const planks: KitFill<PlanksOptions, DeckGround> = {
  id: 'wood/planks',
  family: 'wood',
  about: 'a deck of broad warm planks, each its own tone, a pale top edge and a near-black gap, dark beams under it',
  state: 'picked',
  model: MODEL,
  note: 'wood.md',
  atlas: 'dock, woodtick, wood,outdoor',
  uses: ['wood'],
  options: { light: 25, dark: 14 },
  variants: { deck: {}, even: { light: 8, dark: 4 }, worn: { light: 35, dark: 25 } },
  sample: (o, width, height) => deckPatch(width, height),
  paint(b, g, o, seed) {
    const run = runOf(b.run, 'wood', planks.id), all = runOf(b.fine, 'wood', planks.id);
    const put = (x: number, y: number, c: number): void => b.put(x, y, c);
    for (const p of g.planks) {
      const own0 = p.i * 17 + 3 + seed * 7919;
      for (const beam of p.beams ?? []) fillQuad(put, beam, g.width, g.height, (x, y) => (hash2(x >> 1, 1, 255 + p.i + seed * 7919) > 0.82 ? run[1]! : hash2(x, y, 255) > 0.93 ? run[2]! : run[0]!));
      if (p.gap) fillQuad(put, p.gap, g.width, g.height, () => run[0]!);
      const pick = hash2(own0, 5, 254);
      // its own tone: most a middle brown, some clearly lighter and redder, now and then a dark one
      const own = pick > 1 - o.light / 100 ? 0.82 : pick < o.dark / 100 ? 0.3 : 0.44 + 0.18 * hash2(own0, 7, 260);
      const [l0, r0] = p.ends;
      fillQuad(put, p.corners, g.width, g.height, (x, y) => {
        const u = ((x - (l0 + r0) / 2) / Math.max(1, Math.abs(r0 - l0) / 2)) * b.side;
        const t = own + 0.08 * Math.max(-1, Math.min(1, u));
        // paint grain: lone strokes along the board, a step darker or lighter
        const k = hash2(x >> 2, y, own0);
        return k > 0.94 ? beside(all, t, -2) : k > 0.8 ? beside(all, t, -1) : k < 0.08 ? beside(all, t, 1) : beside(all, t, 0);
      });
      // its pale top edge along its far side, the gap's dark line just beyond it
      const [a, e] = p.edge;
      const n = Math.max(1, Math.ceil(Math.abs(e.x - a.x)));
      for (let k = 0; k <= n; k++) {
        const x = a.x + ((e.x - a.x) * k) / n, y = a.y + ((e.y - a.y) * k) / n;
        if (p.tall > 2.2) b.put(x, y - 1, run[0]!);
        if (p.tall > 3.2 && hash2(Math.round(x) >> 1, own0, 261) > 0.15) b.put(x, y, run[5]!);
      }
      for (const nail of p.nails ?? []) b.put(nail.x, nail.y, run[0]!);
    }
  },
};

/** A plain deck for the sheet and the tests: a walk of planks running away up the patch, near planks broad, crooked ends. */
function deckPatch(width: number, height: number): DeckGround {
  const out: Plank[] = [];
  const lens = 260, eye = 1.6, horizon = -40, mid = width / 2;
  const at = (x: number, z: number): Pt => ({ x: mid + (lens * x) / z, y: horizon + (lens * eye) / z });
  for (let s = 0, i = 0; s < 14; s += 0.42, i++) {
    if (i === 9) continue;
    const z = 2.6 + s, len = 0.37;
    const left = -1.1 + (hash2(i, 1, 250) - 0.5) * 0.3, right = 1.1 + (hash2(i, 2, 251) - 0.5) * 0.3, skew = (hash2(i, 3, 252) - 0.5) * 0.2;
    const corners = [at(left, z + skew), at(left, z + len - skew), at(right, z + len + skew), at(right, z - skew)] as const;
    const tall = Math.abs(at(0, z).y - at(0, z + len).y);
    out.push({
      corners, ends: [at(left, z).x, at(right, z).x], edge: [corners[1], corners[2]], tall, i,
      gap: [at(-1.1, z - 0.22), at(-1.1, z + len), at(1.1, z + len), at(1.1, z - 0.22)],
      beams: [[at(-1, z), at(-1, z + 0.42), { ...at(-1, z + 0.42), y: at(-1, z + 0.42).y + 0.36 * lens / (z + 0.42) }, { ...at(-1, z), y: at(-1, z).y + 0.36 * lens / z }]],
    });
  }
  return { width, height, planks: out.reverse() };
}
