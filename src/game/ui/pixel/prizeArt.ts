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

/**
 * Paints a long thing lying aslant from `base` to `tip`: `reach(u, side)` is how far out from its middle line it reaches
 * at `u` (0 at the base, 1 at the tip; `side` -1 toward the upper left, 1 toward the lower right), in fine pixels; `fill`
 * picks the ink inside, or 0 to leave a hole. Its edge, and the rim of a hole, are drawn in `line`.
 */
function aslant(
  out: Bitmap, base: { x: number; y: number }, tip: { x: number; y: number }, line: number,
  reach: (u: number, side: -1 | 1) => number, fill: (u: number, v: number, out01: number) => number,
): void {
  const ax = tip.x - base.x, ay = tip.y - base.y;
  const length = Math.hypot(ax, ay);
  const along = { x: ax / length, y: ay / length };
  const across = { x: -along.y, y: along.x };
  const at = (x: number, y: number) => {
    const dx = x + 0.5 - base.x, dy = y + 0.5 - base.y;
    const u = (dx * along.x + dy * along.y) / length, v = dx * across.x + dy * across.y;
    const r = u <= 0 || u >= 1 ? 0 : reach(u, v < 0 ? -1 : 1);
    return r > 0 && Math.abs(v) <= r ? { u, v, out01: Math.abs(v) / r } : null;
  };
  const solid = (x: number, y: number) => { const p = at(x, y); return p !== null && fill(p.u, p.v, p.out01) !== 0; };
  for (let y = 0; y < out.height; y++) {
    for (let x = 0; x < out.width; x++) {
      const p = at(x, y);
      if (!p) continue;
      const c = fill(p.u, p.v, p.out01);
      if (c === 0) continue;
      const edge = [[-1, 0], [1, 0], [0, -1], [0, 1]].some(([ex, ey]) => !solid(x + ex!, y + ey!));
      out.pixels[y * out.width + x] = edge ? line : c;
    }
  }
}

/** A rope's twist along a list of points: every other pixel the light strand, lined above and below where it is bare. */
function rope(out: Bitmap, points: readonly (readonly [number, number])[], ink: { light: number; dark: number; line: number }, keep = false): void {
  const free = (x: number, y: number) => x >= 0 && y >= 0 && x < out.width && y < out.height && out.pixels[y * out.width + x] === 0;
  points.forEach(([x, y], i) => {
    if (keep && !free(x, y)) return;
    if (x < 0 || y < 0 || x >= out.width || y >= out.height) return;
    out.pixels[y * out.width + x] = i % 3 === 0 ? ink.dark : ink.light;
    if (free(x, y - 1)) out.pixels[(y - 1) * out.width + x] = ink.line;
    if (free(x, y + 1)) out.pixels[(y + 1) * out.width + x] = ink.line;
  });
}

/** The points of a straight run from `a` to `b`, one per column (or per row when it is steeper). */
function run(a: readonly [number, number], b: readonly [number, number]): [number, number][] {
  const n = Math.max(Math.abs(b[0] - a[0]), Math.abs(b[1] - a[1]));
  return Array.from({ length: n + 1 }, (_, i) => [Math.round(a[0] + ((b[0] - a[0]) * i) / Math.max(1, n)), Math.round(a[1] + ((b[1] - a[1]) * i) / Math.max(1, n))] as [number, number]);
}

/** The tarred twine of the fisherman's net and his rope: a hemp brown, lined in the deepest umber. */
const TWINE = { light: C.honey, dark: C.honeyDark, line: C.umberDeep } as const;

/** The cork float's inks: the cork dark to light, its pores, its line, and the headrope's twine. */
export const FLOAT_INK = { cork: [C.buffDeep, C.buffDark, C.buff], pore: C.umber, line: C.umberDark, twine: TWINE } as const;

/**
 * The fisherman's cork net float (`net-float`, the first rung, *võrguujuk*): a plain thing from his boat. A fat roll of
 * cork threaded on the net's headrope, lit from the upper left, pitted with pores; a few meshes of the net hang under
 * the rope on either side. No glint: the first rung is plain (ft_1_21.AC18).
 */
export function netFloat(): Bitmap {
  const out = createBitmap(ITEM_SIZE.width, ITEM_SIZE.height);
  const [corkDark, cork, corkLight] = FLOAT_INK.cork;
  // a few meshes of the net hanging from the headrope at both ends: diamonds of twine
  const mesh = (x0: number, count: number, y0: number, slope: number) => {
    for (let i = 0; i < count; i++) {
      const x = x0 + i * 7, y = Math.round(y0 - i * 7 * slope);
      const diamond = [...run([x, y], [x + 3, y + 5]), ...run([x + 3, y + 5], [x, y + 10]), ...run([x, y + 10], [x - 3, y + 5]), ...run([x - 3, y + 5], [x, y])];
      for (const [px, py] of diamond) if (px >= 0 && px < out.width && py < out.height) out.pixels[py * out.width + px] = py > y + 6 ? TWINE.dark : TWINE.light;
    }
  };
  mesh(4, 2, 26, 7 / 55); mesh(46, 2, 20, 7 / 55);
  // the cork roll: a barrel aslant along the rope, its ends rounded off
  aslant(out, { x: 11, y: 25 }, { x: 45, y: 16 }, FLOAT_INK.line, (u) => 11 * Math.pow(Math.sin(Math.PI * u), 0.35), (u, v, o) => {
    if (hash(Math.round(u * 40), Math.round(v)) % 9 === 0 && o < 0.85) return FLOAT_INK.pore;
    if (v < 0) return o > 0.5 ? corkLight : cork;
    return o > 0.55 ? corkDark : cork;
  });
  // the headrope, two strands thick, across the slot and through the roll: seen only outside it
  for (const dy of [0, 1]) rope(out, run([0, 25 + dy], [55, 18 + dy]), TWINE, true);
  return out;
}

/** A fixed scatter for pores and speckles: the same picture every time. */
function hash(x: number, y: number): number {
  return Math.abs(((x * 73856093) ^ (y * 19349663)) >>> 0) % 997;
}

/** The net needle's inks: its wood dark to light, its line, and the twine wound on it. */
export const NEEDLE_INK = { wood: [C.brown, C.brownLight, C.buff], line: C.umberDeep, twine: TWINE } as const;

/**
 * The fisherman's net needle (`net-needle`, the second rung, *võrgunõel*): the flat wooden shuttle a net is knotted and
 * mended with. Long and aslant, pointed at the upper right, with the open eye and its tongue near the point, a notch at
 * the heel, and tarred twine wound on it between them.
 */
export function netNeedle(): Bitmap {
  const out = createBitmap(ITEM_SIZE.width, ITEM_SIZE.height);
  const [woodDark, wood, woodLight] = NEEDLE_INK.wood;
  const half = 7;
  aslant(out, { x: 3, y: 36 }, { x: 54, y: 4 }, NEEDLE_INK.line, (u) => (u > 0.8 ? half * Math.pow((1 - u) / 0.2, 0.7) : half), (u, v, o) => {
    // the heel's notch, the eye round the tongue
    if (u < 0.07 && Math.abs(v) < 3) return 0;
    const inEye = u > 0.52 && u < 0.8 && Math.abs(v) < 3.6;
    const tongue = u > 0.55 && Math.abs(v) < 1.5 * Math.min(1, (0.8 - u) / 0.1);
    if (inEye && !tongue) return 0;
    // the twine wound between the heel and the eye, in turns across it
    if (u > 0.12 && u < 0.48 && o < 0.7) return Math.floor(u * 64) % 2 === 0 ? TWINE.light : TWINE.dark;
    if (v < 0) return o > 0.45 ? woodLight : wood;
    return o > 0.5 ? woodDark : wood;
  });
  // a short end of twine left hanging from the eye
  rope(out, [[33, 18], [33, 19], [32, 20], [32, 21], [31, 22], [31, 23], [30, 24]], TWINE, true);
  return out;
}

/** The gull's feather's inks: the vane from shade to white, its line, the black of the tip, its white spot, the quill. */
export const FEATHER_INK = { vane: [C.silver, C.downShade, C.down], line: C.silverDark, tip: [C.ink, C.duskDark], spot: C.downLight, quill: C.downLight } as const;

/**
 * A gull's feather (`gull-feather`, the third rung, *kajakasulg*): a long flight feather of the gulls over the docks,
 * aslant, its quill at the lower left. The vane is narrow on the leading side and wide on the trailing one, grey white
 * with the barbs drawn in, the tip black with the white spot a herring gull has there.
 */
export function gullFeather(): Bitmap {
  const out = createBitmap(ITEM_SIZE.width, ITEM_SIZE.height);
  const [vaneDark, vane, vaneLight] = FEATHER_INK.vane;
  const [tipDark, tip] = FEATHER_INK.tip;
  aslant(out, { x: 4, y: 37 }, { x: 54, y: 5 }, FEATHER_INK.line, (u, side) => {
    if (u < 0.2) return u > 0.02 ? 1.6 : 0; // the bare quill
    const t = (u - 0.2) / 0.8;
    const rise = Math.min(1, t / 0.22), round = t > 0.78 ? Math.sqrt(Math.max(0, 1 - ((t - 0.78) / 0.22) ** 2)) : 1;
    return Math.max(1.6, (side < 0 ? 3.8 : 8.5) * Math.sqrt(rise) * round);
  }, (u, v, o) => {
    const t = (u - 0.2) / 0.8;
    if (Math.abs(v) < 0.8 || u < 0.2) return t > 0.86 ? tip : FEATHER_INK.quill;
    // the barbs: thin lines slanting out from the shaft toward the tip
    const barb = ((Math.floor(u * 70 - Math.abs(v) * 0.8) % 3) + 3) % 3 === 0 && o < 0.92;
    if (t > 0.72) {
      if ((t - 0.86) ** 2 / 0.003 + (v - 3.6) ** 2 / 3.2 < 1) return FEATHER_INK.spot;
      return barb ? tipDark : tip;
    }
    if (barb) return vaneDark;
    if (v < 0) return vaneLight;
    return o > 0.6 ? vaneDark : vane;
  });
  return out;
}

/** The holed stone's inks: the stone dark to light, its speckles, its line and the glint. */
export const STONE_INK = { stone: [C.silverDark, C.silver, C.downShade], speck: C.duskLight, line: C.duskDeep, glint: C.downLight } as const;

/**
 * A sea stone with a hole worn through it (`holed-stone`, the fourth rung, *näkikivi*): a smooth grey beach stone that
 * the sea bored, the kind kept for luck. Lit from the upper left with a glint; the hole's upper rim
 * in shade, its lower rim catching the light.
 */
export function holedStone(): Bitmap {
  const out = createBitmap(ITEM_SIZE.width, ITEM_SIZE.height);
  const [stoneDark, stone, stoneLight] = STONE_INK.stone;
  const hole = { x: 33, y: 20, rx: 5.6, ry: 4.4 };
  const inHole = (x: number, y: number) => ((x + 0.5 - hole.x) / hole.rx) ** 2 + ((y + 0.5 - hole.y) / hole.ry) ** 2 <= 1;
  blob(out, { x: 28, y: 23 }, { x: 19, y: 13 }, STONE_INK.line, (u, v) => {
    if (hash(Math.round(u * 19), Math.round(v * 13)) % 13 === 0) return STONE_INK.speck;
    if (u + v * 1.2 < -0.75) return stoneLight;
    if (u + v * 1.2 > 0.7) return stoneDark;
    return stone;
  });
  // the hole: through to the slot behind; its rim shaded above and lit below
  for (let y = 0; y < out.height; y++) {
    for (let x = 0; x < out.width; x++) {
      if (inHole(x, y)) { out.pixels[y * out.width + x] = 0; continue; }
      const near = [[-1, 0], [1, 0], [0, -1], [0, 1]].some(([ex, ey]) => inHole(x + ex!, y + ey!));
      if (!near || out.pixels[y * out.width + x] === 0) continue;
      out.pixels[y * out.width + x] = y + 0.5 < hole.y ? STONE_INK.line : y + 0.5 < hole.y + 2 ? stoneDark : stoneLight;
    }
  }
  for (const [x, y] of [[17, 16], [16, 16], [18, 16], [17, 15], [17, 17], [19, 15]] as const) out.pixels[y * out.width + x] = STONE_INK.glint;
  return out;
}

/** The ship's bell's inks: the brass dark to light, its line, the mouth's dark, the bell rope, and the light round it. */
export const BELL_INK = { brass: [C.goldDark, C.gold, C.goldLight], line: C.orangeDark, mouth: C.umberDeep, rope: { light: C.cream, dark: C.buffDark, line: C.umberDark }, light: [C.goldLight, C.downLight] } as const;

/**
 * The ship's bell (`ships-bell`, the top rung, *laevakell*: the whole song): the fisherman's treasure. A brass bell on
 * its crown loop, a raised band round its waist, flaring to a thick lip, the dark of its mouth and the clapper showing
 * under it, a white bell rope hanging from the clapper; a glint up its lit side and points of light round it, as the
 * other characters' treasures have.
 */
export function shipsBell(): Bitmap {
  const out = createBitmap(ITEM_SIZE.width, ITEM_SIZE.height);
  const [brassDark, brass, brassLight] = BELL_INK.brass;
  const cx = 26, top = 8, lip = 28;
  const halfAt = (y: number) => {
    const t = (y - top) / (lip - top);
    return 6.5 + 7 * t * t + (y >= lip - 2 ? 2 : 0);
  };
  const inside = (x: number, y: number) => y >= top && y <= lip && Math.abs(x + 0.5 - cx) <= halfAt(y) && !(y === top && Math.abs(x + 0.5 - cx) > 5);
  // the mouth under the lip: a dark half ellipse, and the clapper's ball in it
  blob(out, { x: cx, y: lip + 1 }, { x: 13, y: 3.5 }, BELL_INK.line, () => BELL_INK.mouth);
  // the bell rope: from the clapper down and away to the lower right, a knot near its end
  for (const dx of [0, 1]) rope(out, [...run([cx + dx, lip + 4], [cx + 6 + dx, 36]), ...run([cx + 7 + dx, 36], [cx + 18, 37])], BELL_INK.rope);
  blob(out, { x: cx + 18, y: 37 }, { x: 2.4, y: 2.2 }, BELL_INK.rope.line, () => BELL_INK.rope.light);
  blob(out, { x: cx + 1, y: lip + 3 }, { x: 2.6, y: 2.4 }, BELL_INK.line, () => brassDark);
  for (let y = top; y <= lip; y++) {
    for (let x = 0; x < out.width; x++) {
      if (!inside(x, y)) continue;
      const edge = [[-1, 0], [1, 0], [0, -1], [0, 1]].some(([ex, ey]) => !inside(x + ex!, y + ey!));
      const s = (x + 0.5 - cx) / halfAt(y); // -1 at the lit side, 1 at the shaded one
      let c: number = s < -0.55 ? brassLight : s > 0.35 ? brassDark : brass;
      if (s > -0.48 && s < -0.3 && y > top + 2 && y < lip - 3) c = C.downLight; // the glint running down its lit side
      if (y === top + 13 || y === top + 14) c = y === top + 13 ? (s < -0.4 ? C.downLight : brassLight) : brassDark; // the raised band
      if (y >= lip - 1) c = s < -0.3 ? brassLight : brassDark; // the lip's thick rim
      out.pixels[y * out.width + x] = edge ? BELL_INK.line : c;
    }
  }
  // the crown: a loop of brass on top
  blob(out, { x: cx, y: top - 3 }, { x: 4, y: 4 }, BELL_INK.line, (u, v) => (u * u + v * v < 0.3 ? 0 : u < 0 ? brassLight : brass));
  for (let y = 0; y < out.height; y++) for (let x = 0; x < out.width; x++) {
    const d = ((x + 0.5 - cx) / 4) ** 2 + ((y + 0.5 - (top - 3)) / 4) ** 2;
    if (d < 0.3 && out.pixels[y * out.width + x] === brass) out.pixels[y * out.width + x] = 0;
  }
  // points of light round the treasure
  const [glow, spark] = BELL_INK.light;
  for (const at of [{ x: 8, y: 12 }, { x: 46, y: 9 }, { x: 47, y: 26 }] as const) {
    for (const [x, y] of [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]] as const) out.pixels[(at.y + y) * out.width + at.x + x] = x === 0 && y === 0 ? spark : glow;
  }
  for (const [x, y] of [[6, 27], [41, 4], [52, 17], [13, 35]] as const) out.pixels[y * out.width + x] = glow;
  return out;
}

/** The prizes' pictures by their picture key in `content/items/items.json`. */
export const PRIZE_PICTURES: Readonly<Record<string, () => Bitmap>> = {
  'oak-leaf': oakLeaf,
  acorn,
  'golden-leaf': goldenLeaf,
  'singing-branch': singingBranch,
  'seed-of-life': seedOfLife,
  'net-float': netFloat,
  'net-needle': netNeedle,
  'gull-feather': gullFeather,
  'holed-stone': holedStone,
  'ships-bell': shipsBell,
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
