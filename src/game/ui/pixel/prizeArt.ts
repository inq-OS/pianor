/**
 * The characters' prizes in the band's inventory (ft_1_21.AC15, WP-13; ft_1_20 item model): each a painted thing, as
 * MI2's inventory shows things, not a sign on a scrap (the scraps are the piece maker's music signs, `itemArt.ts`). A
 * prize is the student's to keep and stands for one won tug, so it is drawn to look worth having: bold flat bands, a
 * dark line round it in the darkest tone of its own colour (the house rule, `docs/art-direction.md` section 1), a glint.
 *
 * On the fine grid (d110), the size of a piece maker item (`ITEM_SIZE`), so a slot shows one with `fineIcon`. A picture
 * key in `content/items/items.json` names one here; an item without one shows its name. Palette indices only.
 */
import { createBitmap, type Bitmap } from './bitmap';
import { ITEM_SIZE } from './itemArt';
import { C } from './palette';

/** A leaf's inks: its blade dark to light, its line, its veins, its stalk and its glint (none on a plain leaf). */
interface LeafInk {
  readonly gold: readonly [number, number, number];
  readonly line: number;
  readonly vein: number;
  readonly veinShade: number;
  readonly stalk: number;
  readonly glint?: number;
}

/** The golden leaf's gold, dark to light, its line, its stalk and its glint. */
export const LEAF_INK = { gold: [C.goldDark, C.gold, C.goldLight], line: C.orangeDark, vein: C.goldDark, veinShade: C.orangeDark, stalk: C.brownLight, glint: C.downLight } as const satisfies LeafInk;

/** The plain oak leaf's green (Puuvaim's first rung, ft_1_21.AC18): the same leaf, green, lined in deep green, no glint. */
export const OAK_LEAF_INK = { gold: [C.leafDark, C.leaf, C.leafLight], line: C.halo, vein: C.leafDark, veinShade: C.halo, stalk: C.brownLight } as const satisfies LeafInk;

/** The leaf's axis in the picture: from where the stalk meets the blade to the tip. */
const LEAF = { base: { x: 13, y: 31 }, tip: { x: 48, y: 6 }, halfWidth: 14 } as const;

/**
 * How far out from the midrib the blade reaches at `u` (0 at the stalk, 1 at the tip) on one side (`side` -1 or 1), as a
 * share of the leaf's half width: an oak's leaf, round lobes with deep bays between them, the two sides a little out of
 * step (the oak is Estonian folk belief's holy tree; Puuvaim's own tree is no kind in particular).
 */
export function leafReach(u: number, side: -1 | 1): number {
  if (u <= 0 || u >= 1) return 0;
  const body = Math.pow(Math.sin(Math.PI * Math.pow(u, 0.85)), 0.8);
  const lobes = 0.5 + 0.5 * Math.pow(Math.abs(Math.cos(Math.PI * (u * 3.6 + (side > 0 ? 0.3 : 0.05)))), 0.45);
  return body * lobes;
}

/**
 * Puuvaim's golden leaf (`golden-leaf`): an oak leaf of gold lying aslant, its stalk curled at the lower left. The half
 * toward the light (upper left) is pale gold, the far half deeper, folded along a midrib; veins run out to the lobes, and
 * a glint sits on the lit edge.
 */
export function goldenLeaf(): Bitmap {
  return leaf(LEAF_INK);
}

/** Puuvaim's plain oak leaf (`oak-leaf`, the first rung of his ladder): the golden leaf's shape, green and with no glint. */
export function oakLeaf(): Bitmap {
  return leaf(OAK_LEAF_INK);
}

function leaf(ink: LeafInk): Bitmap {
  const { width, height } = ITEM_SIZE;
  const out = createBitmap(width, height);
  const put = (x: number, y: number, c: number) => { if (x >= 0 && y >= 0 && x < width && y < height) out.pixels[y * width + x] = c; };
  const ax = LEAF.tip.x - LEAF.base.x, ay = LEAF.tip.y - LEAF.base.y;
  const length = Math.hypot(ax, ay);
  const along = { x: ax / length, y: ay / length };
  const across = { x: -along.y, y: along.x }; // toward the lower right: the far, shaded half
  const inside = (x: number, y: number): { u: number; v: number; reach: number } | null => {
    const dx = x + 0.5 - LEAF.base.x, dy = y + 0.5 - LEAF.base.y;
    const u = (dx * along.x + dy * along.y) / length;
    const v = dx * across.x + dy * across.y;
    const reach = LEAF.halfWidth * leafReach(u, v < 0 ? -1 : 1);
    return reach > 0 && Math.abs(v) <= reach ? { u, v, reach } : null;
  };
  // where each vein leaves the midrib: they run out toward the lobes, slanting toward the tip
  const veins = [0.16, 0.36, 0.56, 0.74];
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const at = inside(x, y);
      if (!at) continue;
      const edge = [[-1, 0], [1, 0], [0, -1], [0, 1]].some(([ex, ey]) => !inside(x + ex!, y + ey!));
      if (edge) { put(x, y, ink.line); continue; }
      const lit = at.v < 0;
      const out01 = Math.abs(at.v) / Math.max(1, at.reach);
      let c: number = lit ? (out01 > 0.45 ? ink.gold[2] : ink.gold[1]) : (out01 > 0.55 ? ink.gold[1] : ink.gold[0]);
      // the midrib, and the veins leaving it toward the tip, out to the lobes
      if (Math.abs(at.v) < 0.7 && at.u < 0.93) c = lit ? ink.vein : ink.veinShade;
      for (const start of veins) {
        const onVein = Math.abs(at.u * length - (start * length + Math.abs(at.v) * 0.8)) < 0.6;
        if (onVein && out01 < 0.75 && Math.abs(at.v) > 0.7) c = lit ? ink.vein : ink.veinShade;
      }
      put(x, y, c);
    }
  }
  // the stalk: a short curl down and to the left from the blade's foot
  const stalk: readonly (readonly [number, number])[] = [[12, 32], [11, 33], [10, 34], [9, 34], [8, 35], [7, 35], [6, 34], [5, 33]];
  for (const [x, y] of stalk) {
    put(x, y, ink.stalk);
    if (out.pixels[(y + 1) * width + x] === 0) put(x, y + 1, ink.line);
    if (out.pixels[(y - 1) * width + x] === 0) put(x, y - 1, ink.line);
  }
  put(4, 33, ink.line);
  // a glint on the lit edge: a small cross of light
  const g = { x: 26, y: 13 };
  if (ink.glint !== undefined) for (const [x, y] of [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]] as const) put(g.x + x, g.y + y, ink.glint);
  return out;
}

/** Paints an ellipse-like blob: `fill(u, v)` picks the ink at a point inside (u, v from -1 to 1), its edge in `line`. */
function blob(out: Bitmap, centre: { x: number; y: number }, r: { x: number; y: number }, line: number, fill: (u: number, v: number) => number, keep = false): void {
  const inside = (x: number, y: number) => ((x + 0.5 - centre.x) / r.x) ** 2 + ((y + 0.5 - centre.y) / r.y) ** 2 <= 1;
  for (let y = Math.floor(centre.y - r.y); y <= Math.ceil(centre.y + r.y); y++) {
    for (let x = Math.floor(centre.x - r.x); x <= Math.ceil(centre.x + r.x); x++) {
      if (x < 0 || y < 0 || x >= out.width || y >= out.height || !inside(x, y)) continue;
      if (keep && out.pixels[y * out.width + x] !== 0) continue;
      const edge = [[-1, 0], [1, 0], [0, -1], [0, 1]].some(([ex, ey]) => !inside(x + ex!, y + ey!));
      out.pixels[y * out.width + x] = edge ? line : fill((x + 0.5 - centre.x) / r.x, (y + 0.5 - centre.y) / r.y);
    }
  }
}

/** The acorn's inks: the nut dark to light, the cup dark to light, the line, the stalk, the glint. */
export const ACORN_INK = { nut: [C.orangeDark, C.buffDark, C.buff], cup: [C.umberDark, C.umber, C.umberLight], line: C.umberDeep, stalk: C.brownDark, glint: C.downLight } as const;

/**
 * Puuvaim's acorn (`acorn`, the second rung): an oak's nut, the next thing an oak gives after its leaf. A round nut lit
 * from the upper left with a glint, in a scaly cup (rows of darker dots), its short stalk up and to the right.
 */
export function acorn(): Bitmap {
  const out = createBitmap(ITEM_SIZE.width, ITEM_SIZE.height);
  const [nutDark, nut, nutLight] = ACORN_INK.nut, [cupDark, cup, cupLight] = ACORN_INK.cup;
  blob(out, { x: 28, y: 24 }, { x: 11, y: 13 }, ACORN_INK.line, (u, v) => (u + v < -0.6 ? nutLight : u + v > 0.9 ? nutDark : nut));
  // the cup over the nut's top third, scaled: every other cell a shade darker, its lit side lighter
  blob(out, { x: 28, y: 13 }, { x: 13, y: 7 }, ACORN_INK.line, (u, v) => {
    const x = Math.round(u * 13), y = Math.round(v * 7);
    if ((x + y) % 3 === 0) return cupDark;
    return u < -0.4 && v < 0.3 ? cupLight : cup;
  });
  for (const [x, y] of [[29, 5], [30, 4], [31, 3], [32, 3]] as const) out.pixels[y * out.width + x] = ACORN_INK.stalk;
  for (const [x, y] of [[22, 25], [22, 26], [23, 24]] as const) out.pixels[y * out.width + x] = ACORN_INK.glint;
  return out;
}

/** The singing branch's inks: the bark dark to light, its line, its leaves, and the notes it hums. */
export const BRANCH_INK = { bark: [C.brownDark, C.brown, C.brownLight], line: C.umberDeep, leaf: [C.leafDark, C.leaf, C.leafLight], note: C.goldLight } as const;

/**
 * Puuvaim's singing branch (`singing-branch`, the fourth rung): a twig of his own tree, aslant, three oak leaves on it,
 * and two notes rising from it, for it hums the tree's tunes. The builder's simple first picture (ft_1_21's painter tag).
 */
export function singingBranch(): Bitmap {
  const out = createBitmap(ITEM_SIZE.width, ITEM_SIZE.height);
  const [barkDark, bark, barkLight] = BRANCH_INK.bark, [leafDark, leaf, leafLight] = BRANCH_INK.leaf;
  const put = (x: number, y: number, c: number) => { if (x >= 0 && y >= 0 && x < out.width && y < out.height) out.pixels[y * out.width + x] = c; };
  // the twig: from the lower left up to the right, three rows thick, lit on top, lined below
  for (let x = 4; x <= 40; x++) {
    const y = Math.round(36 - (x - 4) * 0.55), thick = x < 28 ? 1 : 0;
    put(x, y - 2, BRANCH_INK.line); put(x, y - 1, barkLight); put(x, y, bark);
    if (thick) put(x, y + 1, barkDark);
    put(x, y + 1 + thick, BRANCH_INK.line);
  }
  // three leaves along it, lying away from the twig
  for (const at of [{ x: 14, y: 23 }, { x: 27, y: 30 }, { x: 34, y: 15 }] as const) {
    blob(out, at, { x: 7.5, y: 4.5 }, leafDark, (u, v) => (u + v < 0 ? leafLight : leaf));
  }
  // two notes rising over its tip: a head and a stem each
  for (const n of [{ x: 44, y: 22 }, { x: 50, y: 15 }] as const) {
    for (const [x, y] of [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1], [1, -1], [-1, 1]] as const) put(n.x + x, n.y + y, BRANCH_INK.note);
    for (let y = 1; y <= 6; y++) put(n.x + 2, n.y - y, BRANCH_INK.note);
  }
  return out;
}

/** The seed of life's inks: the seed dark to light, its line, the sprout's green, and the light around it. */
export const SEED_INK = { seed: [C.goldDark, C.gold, C.goldLight], line: C.orangeDark, sprout: [C.leafDark, C.leaf, C.leafLight], light: [C.goldLight, C.downLight] } as const;

/**
 * Puuvaim's seed of life (`seed-of-life`, the top rung: the whole song, ft_1_32 slice 4): a golden seed with a green
 * sprout of two leaves rising from it, and points of light around it, the thing all the tree's gifts came from.
 * The builder's simple first picture; the painter's tag for the finer one is in ft_1_21.
 */
export function seedOfLife(): Bitmap {
  const out = createBitmap(ITEM_SIZE.width, ITEM_SIZE.height);
  const [seedDark, seed, seedLight] = SEED_INK.seed, [leafDark, leaf, leafLight] = SEED_INK.sprout;
  blob(out, { x: 28, y: 29 }, { x: 10, y: 8 }, SEED_INK.line, (u, v) => (u + v < -0.7 ? seedLight : u + v > 0.4 ? seedDark : seed));
  // the sprout: a stem up from the seed's top, a leaf to each side
  for (let y = 12; y <= 21; y++) out.pixels[y * out.width + 28] = leafDark;
  blob(out, { x: 22, y: 13 }, { x: 6, y: 3 }, leafDark, (u) => (u < 0 ? leafLight : leaf), true);
  blob(out, { x: 34, y: 11 }, { x: 6, y: 3 }, leafDark, (u) => (u > 0 ? leaf : leafLight), true);
  // the light around it: small crosses and dots
  const [glow, spark] = SEED_INK.light;
  for (const at of [{ x: 10, y: 20 }, { x: 46, y: 22 }, { x: 15, y: 6 }, { x: 44, y: 5 }] as const) {
    for (const [x, y] of [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]] as const) out.pixels[(at.y + y) * out.width + at.x + x] = x === 0 && y === 0 ? spark : glow;
  }
  for (const [x, y] of [[8, 32], [49, 34], [40, 16], [17, 34]] as const) out.pixels[y * out.width + x] = glow;
  return out;
}

/** The prizes' pictures by their picture key in `content/items/items.json`. */
export const PRIZE_PICTURES: Readonly<Record<string, () => Bitmap>> = {
  'oak-leaf': oakLeaf,
  acorn,
  'golden-leaf': goldenLeaf,
  'singing-branch': singingBranch,
  'seed-of-life': seedOfLife,
};

/** The picture of a prize by its key, or null when the painter has not drawn it (the band then shows its name). */
export function prizePicture(key: string | undefined): Bitmap | null {
  if (key === undefined) return null;
  const drawn = DRAWN.get(key);
  if (drawn) return drawn;
  const draw = PRIZE_PICTURES[key];
  if (!draw) return null;
  // painted once: the band asks again every time it is drawn
  const picture = draw();
  DRAWN.set(key, picture);
  return picture;
}
const DRAWN = new Map<string, Bitmap>();
