import { PORT } from '../../../../core/layout/port';
import { hash2, noise2 } from '../paint/noise';

/**
 * The wonders under the southern port's quay (ft_1_19, `portPicture.ts`): what no real sea has: the 1991
 * game's quirk, most of all underwater, a locked treasure chest, coral creatures that exist in no real sea. Painted over the reef, in the tall picture's own rows.
 *
 * The cast, back to front: the shy one behind a pier, the organ-pipe coral that blows bubbles in turn, the candy canes,
 * the locked chest with its chain and padlock (the star), the horn sponges, the amphora an octopus lives in, the
 * lantern corals that give the night its light, the spotted mushrooms, the driftwood arrow that shows the way up, the
 * clam with its pearl, the hermit crab in a teapot, the fish that walks, and the crab that has the chest's key.
 * No letters, digits or notation anywhere. The two patches of sand where visitors stand stay empty.
 */

/** What a wonder is painted with: the port's painter lends it its pixel, its runs of colour and its loop. */
export interface WonderBrush {
  /** A pixel at a column and a row of the tall picture (`core/layout/port.ts`: the water at `PORT.water`, the bed at `PORT.bed`). */
  put(x: number, y: number, c: number): void;
  /** Paints one thing: what `draw` puts is its own, and gets the ink line of the 1991 game round it. */
  thing(draw: () => void): void;
  /** The port's runs, each dark to light: wood, coral, sponge, violet, hull, red, sea, dry, shingle, stone, bush, ember. */
  fine: Readonly<Record<string, readonly number[]>>;
  ink: number;
  foam: number;
  /** This look of the loop (0 to `looks` - 1), and a swing of -1 to 1 at a phase (0 to 1) that goes once round the loop. */
  look: number;
  looks: number;
  sway(phase: number): number;
  /** Whether lamps burn (dusk and night): what glows, glows brighter. */
  lit: boolean;
}

type Run = readonly number[];
type Put = (x: number, y: number, c: number) => void;
type At = (s: number) => readonly [number, number];

const RUNS = ['wood', 'coral', 'sponge', 'violet', 'hull', 'red', 'sea', 'dry', 'shingle', 'stone', 'bush', 'ember'] as const;

/** No wonder reaches over the water: nothing is painted above this row. */
const TOP = PORT.water + 2;

/** The brush with the runs by name, and light that takes no ink line. */
interface Sea {
  put: Put;
  thing(draw: () => void): void;
  /**
   * Paints light (a halo, a glint, a bubble): no ink line goes round it. The ink is laid on a thing's pixel that has
   * its own kind on the far side, so the light is laid as two things woven like a chessboard, and neither has an edge.
   */
  light(draw: (put: Put) => void): void;
  r: Record<(typeof RUNS)[number], Run>;
  ink: number;
  foam: number;
  look: number;
  looks: number;
  sway(phase: number): number;
  lit: boolean;
}

const clamp01 = (t: number): number => Math.max(0, Math.min(1, t));

/** One flat tone of a run at lightness `t` (0 its dark end, 1 its light end): a band, never past the run's end. */
function flat(run: Run, t: number): number {
  return run[Math.round(clamp01(t) * (run.length - 1))]!;
}

/** A leaf's lit green from the bush's run, which ends darker than a grass would: `t` as a grass run would take it. */
function leaf(bush: Run, t: number): number {
  return flat(bush, t * 1.25 + 0.06);
}

/** The step of a four-look walk: 0, 1, 0, -1 and round again, whatever the number of looks. */
function pace(c: Sea, from = 0): number {
  return [0, 1, 0, -1][(((c.look + from) % 4) + 4) % 4]!;
}

/** A lump with a wobbly edge: `colour` gets the place in it (-1 to 1 across and down). */
function blob(put: Put, cx: number, cy: number, rx: number, ry: number, colour: (u: number, v: number, x: number, y: number) => number | undefined, seed = 0, wobble = 0.1): void {
  for (let y = Math.floor(cy - ry - 1); y <= cy + ry + 1; y++) for (let x = Math.floor(cx - rx - 1); x <= cx + rx + 1; x++) {
    const u = (x - cx) / rx, v = (y - cy) / ry;
    if (u * u + v * v + wobble * (noise2(x / 3, y / 3, seed) - 0.5) * 2 > 1) continue;
    const col = colour(u, v, x, y);
    if (col !== undefined) put(x, y, col);
  }
}

/** A stalk, an arm, a leg: dabs along a path, as wide as `wide` says; `colour` gets how far along and where across and down the dab (-1 to 1). */
function limb(put: Put, steps: number, at: At, wide: (s: number) => number, colour: (s: number, k: number, j: number) => number): void {
  for (let i = 0; i <= steps; i++) {
    const s = i / steps, [x, y] = at(s), r = wide(s) / 2, m = Math.ceil(r);
    for (let dy = -m; dy <= m; dy++) for (let dx = -m; dx <= m; dx++) {
      if (dx * dx + dy * dy > r * r + 0.3) continue;
      put(Math.round(x) + dx, Math.round(y) + dy, colour(s, dx / Math.max(1, r), dy / Math.max(1, r)));
    }
  }
}

/** A barnacle: a pale ring with a dark mouth, as the reef's rock has them. */
function barnacle(c: Sea, x: number, y: number, size: number): void {
  for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) {
    const d = Math.hypot(dx, dy * 1.2);
    if (d <= size + 0.6) c.put(x + dx, y + dy, d < size - 0.8 ? flat(c.r.stone, 0) : flat(c.r.shingle, dy < 0 ? 0.95 : 0.4));
  }
}

/** A lamp's light in the water: a warm ring round it in two flat steps, its edge ragged; it stops at the sand. */
function halo(c: Sea, cx: number, cy: number, r: number, seed: number): void {
  const { ember } = c.r;
  c.light((put) => {
    for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
      const far = Math.hypot(dx, dy * 1.06) / r + 0.12 * hash2(Math.round(Math.atan2(dy, dx) * 4), seed, 801);
      if (far < 1 && cy + dy < PORT.bed + 4) put(cx + dx, cy + dy, flat(ember, far < 0.8 ? 0.5 : 0.28));
    }
  });
}

/** A glint: a small star of light, `long` its arms. */
function glint(c: Sea, x: number, y: number, long: number): void {
  if (long <= 0) return;
  c.light((put) => {
    for (let k = -long; k <= long; k++) {
      const col = k === 0 ? c.foam : flat(c.r.ember, Math.abs(k) === long ? 0.75 : 0.95);
      put(x + k, y, col);
      put(x, y + k, col);
    }
  });
}

/** A bubble: a dot, then a ring that grows as it rises. */
function bubble(c: Sea, x: number, y: number, size: number): void {
  const { sea } = c.r;
  c.light((put) => {
    if (size <= 1) {
      put(x, y, c.foam); put(x + 1, y, flat(sea, 1)); put(x, y + 1, flat(sea, 1));
      return;
    }
    for (let dy = -size; dy <= size; dy++) for (let dx = -size; dx <= size; dx++) {
      if (Math.abs(Math.hypot(dx, dy) - size + 0.3) < 0.6) put(x + dx, y + dy, dx < 0 && dy < 0 ? c.foam : flat(sea, 1));
    }
  });
}

// ---- the corals no sea has

/**
 * The shy one: something round and dark that hides behind a pier of the quay and looks out into the arch, its eyes
 * going left and right, shut on one look. `edge` is the pier's edge and `side` the way the open water lies (1 right).
 */
function shyOne(c: Sea, edge: number, y: number, side: number): void {
  const { sea, hull } = c.r;
  c.thing(() => blob(c.put, edge, y, 16, 13, (u, v, x) => ((x - edge) * side < 0 ? undefined : flat(sea, v < -0.45 && u * side < 0.7 ? 0.14 : 0)), 805, 0.16));
  const shut = c.look % 4 === 3, glance = [-1, 0, 1, 0][c.look % 4]!;
  for (const ex of [edge + side * 4 - 2, edge + side * 10 - 2]) {
    for (let dy = -2; dy <= 2; dy++) for (let dx = 0; dx < 4; dx++) {
      if ((dx === 0 || dx === 3) && Math.abs(dy) === 2) continue;
      if (shut) { if (dy === 1) c.put(ex + dx, y - 2 + dy, flat(sea, 0.4)); continue; }
      const pupil = (dx === 1 + glance || dx === 2 + glance) && dy >= -1 && dy <= 1;
      c.put(ex + dx, y - 2 + dy, pupil ? c.ink : dy === 2 ? flat(hull, 0.7) : c.foam);
    }
  }
}

/** The organ-pipe coral: a rank of tin pipes in a lump of rock, each with its mouth and its gold band, blowing a bubble each in turn. */
function organ(c: Sea, x: number, foot: number): void {
  const { hull, sponge, coral } = c.r;
  c.thing(() => blob(c.put, x + 22, foot + 1, 27, 7, (_u, v) => flat(coral, v < -0.3 ? 0.4 : 0.2), 821, 0.22));
  const pipes = [[0, 26, -0.07], [9, 40, -0.03], [18, 52, 0.012], [28, 34, 0.05], [37, 21, 0.11]] as const;
  pipes.forEach(([off, tall, lean], k) => {
    const wide = k === 2 ? 8 : 7;
    const left = (i: number): number => x + off + Math.round(lean * i + 0.8 * Math.sin(i / 9 + k * 2));
    c.thing(() => {
      for (let i = 0; i < tall; i++) {
        const w = i < 8 ? Math.max(2, Math.round(2 + (wide - 2) * (i / 8))) : wide, x0 = left(i) + ((wide - w) >> 1);
        for (let d = 0; d < w; d++) {
          const inner = d > 0 && d < w - 1, fromMid = Math.abs(d - (w - 1) / 2);
          let col = flat(hull, d === 0 ? 0.28 : d === 1 ? 0.52 : d === w - 3 ? 0.98 : d === w - 1 ? 0.42 : 0.72);
          if (i === 8 || i === 9) col = flat(sponge, d === 0 ? 0.4 : d === w - 3 ? 0.96 : 0.72);
          else if ((i === 12 || i === 13) && inner) col = c.ink;
          else if (i > 13 && i <= 17 && fromMid <= (17 - i) * 0.8) col = flat(hull, 0.4);
          else if ((i === tall - 2 || i === tall - 3) && inner) col = flat(hull, i === tall - 2 ? 0 : 0.12);
          c.put(x0 + d, foot - 2 - i, col);
        }
      }
    });
    // its bubble: none on its own look, then a dot, a ring, a bigger ring further up
    const blown = (((c.look - k) % c.looks) + c.looks) % c.looks;
    if (blown > 0) bubble(c, left(tall) + (wide >> 1) + blown - 1, foot - 2 - tall - 5 - Math.round(((blown - 1) * 36) / c.looks), blown);
  });
}

/** A candy cane coral: a striped stalk with a crook at its top, red and white. */
function candy(c: Sea, x: number, foot: number, tall: number, way: number, seed: number): void {
  const { red, hull } = c.r;
  const crook = 5, round = 15, long = tall + round, swing = c.sway(seed / 5) * 1.5;
  const stalk = (t: number): readonly [number, number] => [x + 2.4 * Math.sin(t * 4 + seed) * t + swing * t, foot - t * tall];
  const [tx, ty] = stalk(1);
  const at: At = (s) => {
    const l = s * long;
    if (l <= tall) return stalk(l / tall);
    const turn = ((l - tall) / round) * Math.PI * 1.08;
    return [tx + way * crook * (1 - Math.cos(turn)), ty - crook * Math.sin(turn)];
  };
  c.thing(() => limb(c.put, long, at, (s) => 5.8 - s * 1.6, (s, k) => {
    const stripe = Math.floor((s * long + k * 2.4 * way + 40) / 3.6) % 2 === 0, shade = k < -0.35;
    return stripe ? flat(red, shade ? 0.42 : 0.68) : flat(hull, shade ? 0.6 : 0.98);
  }));
}

/** A horn sponge: a stem that bends into a fluted horn, its scalloped mouth pale round a dark throat, as a gramophone's. */
function horn(c: Sea, fx: number, foot: number, mx: number, my: number, ax: number, ay: number, big: number, run: Run, seed: number): void {
  const al = Math.hypot(ax, ay), dx = ax / al, dy = ay / al, nx = -dy, ny = dx;
  const long = big * 1.7, neckX = mx - dx * long, neckY = my - dy * long;
  const bendX = neckX - dx * 9, bendY = neckY - dy * 9;
  c.thing(() => {
    limb(c.put, 26, (s) => [(1 - s) ** 2 * fx + 2 * s * (1 - s) * bendX + s * s * neckX, (1 - s) ** 2 * foot + 2 * s * (1 - s) * bendY + s * s * neckY], (s) => 4.4 - s, (_s, k) => flat(run, k < 0 ? 0.28 : 0.5));
    const reach = Math.ceil(long + big + 3);
    for (let y = Math.floor(my) - reach; y <= my + reach; y++) for (let x = Math.floor(mx) - reach; x <= mx + reach; x++) {
      // the horn: it flares toward its mouth, in flutes
      const qx = x - neckX, qy = y - neckY, s = (qx * dx + qy * dy) / long, p = qx * nx + qy * ny;
      const wide = 1.8 + (big - 1.8) * clamp01(s) ** 1.7;
      if (s >= 0 && s <= 1.02 && Math.abs(p) <= wide) c.put(x, y, flat(run, [0.3, 0.52, 0.4, 0.66, 0.5][Math.min(4, Math.floor((p / wide + 1) * 2.5))]!));
      // its mouth: a scalloped rim round the dark
      const a = ((x - mx) * nx + (y - my) * ny) / (big + 1.5), b = ((x - mx) * dx + (y - my) * dy) / (big * 0.52);
      const rim = Math.hypot(a, b) / (1 + 0.1 * Math.cos(Math.atan2(b, a) * 7 + seed));
      if (rim <= 1) c.put(x, y, rim > 0.6 ? flat(run, b < 0 ? 0.76 : 0.97) : flat(run, rim > 0.3 ? 0.12 : 0));
    }
  });
}

/** A mushroom coral: a fat pale stem and a spotted cap. */
function mushroom(c: Sea, x: number, foot: number, r: number, run: Run, tilt: number, seed: number): void {
  const { hull } = c.r;
  const high = Math.round(r * 0.9), cx = x + Math.round(tilt * high), cy = foot - high;
  c.thing(() => {
    for (let i = 0; i <= high; i++) {
      const w = Math.round(r * (0.34 + 0.16 * (1 - i / high) ** 2)), mid = x + Math.round((tilt * i));
      for (let d = -w; d <= w; d++) c.put(mid + d, foot - i, flat(hull, d < -w * 0.3 ? 0.55 : i > high - 2 ? 0.45 : 0.86));
    }
  });
  c.thing(() => {
    blob(c.put, cx, cy, r, r * 0.78, (u, v, px, py) => {
      if (py > cy + (Math.abs(u) > 0.55 ? 2 : 1)) return undefined;
      if (py >= cy && Math.abs(u) < 0.8) return flat(run, 0.12);
      for (const [su, sv, sr] of [[-0.45, -0.35, 0.2], [0.2, -0.62, 0.17], [0.55, -0.12, 0.2], [-0.05, -0.1, 0.13], [-0.75, 0.02, 0.12]] as const) {
        if (Math.hypot(u - su, (v - sv) * 0.78) < sr + 0.6 / r) return flat(hull, 1);
      }
      return flat(run, v < -0.6 ? 0.8 : u < -0.6 || py >= cy ? 0.42 : 0.6);
    }, seed, 0.08);
  });
}

/**
 * A lantern coral: a stalk with a crook, and a bulb hanging from it that glows. At dusk and night the bulb burns and
 * has its light round it: these are the lamps of the bed.
 */
function lantern(c: Sea, x: number, foot: number, tall: number, way: number, seed: number): void {
  const { bush, sponge, ember } = c.r;
  const swing = c.sway(seed / 7) * 2.2;
  const stem: At = (s) => [x + way * 5 * s * s + swing * s * s + 1.6 * Math.sin(s * 5 + seed), foot - s * tall];
  const [tx, ty] = stem(1);
  const crook: At = (s) => [tx + way * 4.5 * (1 - Math.cos(s * Math.PI * 0.95)), ty - 5 * Math.sin(s * Math.PI * 0.95)];
  const [ex, ey] = crook(1);
  const bx = Math.round(ex), by = Math.round(ey) + 8;
  if (c.lit) halo(c, bx, by, 10, seed);
  c.thing(() => {
    limb(c.put, tall, stem, (s) => 4 - s * 1.4, (_s, k) => (k < 0 ? flat(bush, 0.4) : leaf(bush, 0.55)));
    // a bud at each joint, now left, now right
    for (let i = 8; i < tall - 6; i += 9) {
      const [jx, jy] = stem(i / tall), side = (i / 9) % 2 < 1 ? -1 : 1;
      c.put(jx + side * 2, jy, leaf(bush, 0.7)); c.put(jx + side * 3, jy - 1, leaf(bush, 0.85)); c.put(jx + side * 3, jy, flat(bush, 0.4));
    }
    limb(c.put, 12, crook, () => 2, (_s, _k, j) => (j > 0 ? flat(bush, 0.4) : leaf(bush, 0.6)));
    for (let d = 0; d < 3; d++) c.put(bx, Math.round(ey) + d, flat(bush, 0.5));
    for (let d = -3; d <= 3; d++) { c.put(bx + d, by - 6, leaf(bush, d < 0 ? 0.45 : 0.7)); if (Math.abs(d) >= 2) c.put(bx + d, by - 5, flat(bush, 0.45)); }
  });
  c.thing(() => blob(c.put, bx, by, 5.2, 5.8, (u, v) => {
    const d = u * u + v * v;
    if (c.lit) return flat(ember, d < 0.22 ? 1 : d < 0.68 ? 0.84 : 0.66);
    return flat(sponge, d < 0.5 && u < 0.05 && v < -0.1 ? 0.98 : d > 0.6 && (u > 0.2 || v > 0.3) ? 0.52 : 0.76);
  }, seed, 0.04));
}

// ---- the chest

/**
 * The locked chest, the star of the bed: fat and bellied, half sunk in the sand and tilted, iron straps with gold
 * rivets, a chain slung over it and an oversized padlock, barnacles and a tuft of weed; gold light leaks out of the
 * seam under its lid, more of it at dusk and night.
 */
function chest(c: Sea, cx: number, base: number): void {
  const { wood, stone, sponge, ember, dry, bush } = c.r;
  const big = 1.16, lean = 0.12, cos = Math.cos(lean), sin = Math.sin(lean);
  const sand = (x: number): number => base - 3 + Math.round(1.5 * Math.sin(x / 6) + 2 * noise2(x / 9, 1, 811));
  const lidTop = (u: number): number => 19 + 17 * Math.sqrt(Math.max(0, 1 - Math.abs(u / 26) ** 2.4));
  const half = (v: number): number => 22 + 2.6 * Math.sin(Math.PI * clamp01(v / 19));
  /** Where a place on the chest (across from its middle, up from its bottom) is in the picture. */
  const place = (u: number, v: number): [number, number] => [Math.round(cx + (u * cos - v * sin) * big), Math.round(base - (u * sin + v * cos) * big)];
  const iron = (t: number): number => flat(stone, t);
  const seam = c.lit ? 16.4 : 17.3;

  /** The colour of the chest's lid at a place on it: its iron rim, its bowed planks, the light along its top. */
  const lidColour = (v: number, top: number, shift: number): number => {
    const f = (v - 19) / Math.max(1, top - 19);
    if (v < 21.6) return iron(v > 20.7 ? 0.5 : 0.28);
    if (top - v < 1.8) return flat(wood, 0.92);
    if (Math.abs(f - 0.4) < 0.04 || Math.abs(f - 0.72) < 0.04) return flat(wood, 0.14);
    return flat(wood, (f < 0.4 ? 0.56 : f < 0.72 ? 0.64 : 0.74) + shift);
  };
  /** The colour of its body: an iron rim under the seam, iron corners at its foot, three planks. */
  const bodyColour = (u: number, v: number, shift: number): number => {
    if (v >= 15.3) return iron(v > 16.4 ? 0.48 : 0.28);
    if (Math.abs(u) > half(v) - 5 && v < 5.5) return iron(Math.abs(u) > half(v) - 1.5 || v > 4.3 ? 0.22 : 0.42);
    const plank = (v + 20) % 6.3;
    return plank < 0.9 ? flat(wood, 0.1) : flat(wood, [0.62, 0.54, 0.66][Math.floor((v + 20) / 6.3) % 3]! + (plank > 5.2 ? 0.14 : 0) + shift);
  };
  c.thing(() => {
    for (let y = base - 52; y <= base + 6; y++) for (let x = cx - 42; x <= cx + 42; x++) {
      if (y > sand(x)) continue;
      const dx = (x - cx) / big, dy = (base - y) / big, u = dx * cos + dy * sin, v = -dx * sin + dy * cos;
      const top = lidTop(u) + 1.2 * (noise2(x / 5, 3, 812) - 0.5);
      const inLid = v >= 19 && Math.abs(u) <= 25.6 && v <= top;
      const inBody = v >= -8 && v < 19 && Math.abs(u) <= half(v) + 1.2 * (noise2(y / 4, 2, 813) - 0.5);
      if (!inLid && !inBody) continue;
      const strap = Math.abs(Math.abs(u) - 15), rivet = strap < 0.9 && ((Math.floor(v) % 6) + 6) % 6 === 2;
      // the wood's grain, and the shade on its sunk end
      const shift = (hash2(Math.floor(u / 4), Math.floor(v), 815) > 0.86 ? -0.1 : 0) + (u < -17 ? -0.12 : 0);
      if (v >= seam && v < 19.2) c.put(x, y, flat(ember, hash2(Math.floor(u / 2), c.look, 814) > 0.35 ? 1 : 0.82));
      else if (strap < 2.6) c.put(x, y, rivet ? flat(sponge, 0.85) : iron(strap < 0.9 ? 0.5 : 0.24));
      else c.put(x, y, inLid ? lidColour(v, top, shift) : bodyColour(u, v, shift));
    }
    for (const [u, v, size] of [[-20, 27, 2.4], [-10, 33, 1.8], [20, 10, 2.6], [8, 3, 1.8], [-21, 9, 1.6]] as const) barnacle(c, ...place(u, v), size);
  });
  // weed grown on its lid
  c.thing(() => {
    for (let k = 0; k < 5; k++) {
      const [wx, wy] = place(13 + k * 2, lidTop(13 + k * 2) - 1), tall = 5 + ((k * 3) % 5), bend = c.sway(0.4 + k / 9) * 0.3 + (k - 2) * 0.12;
      for (let i = 0; i < tall; i++) c.put(wx + bend * i, wy - i, i > tall - 3 ? leaf(bush, 0.75) : flat(bush, 0.5));
    }
  });
  // the chain: slung over its lid and down its front, then lying off over the sand
  const link = (i: number, x: number, y: number): void => {
    const part = i % 6;
    for (let k = -1; k <= 1; k++) {
      if (part >= 4 && k !== 0) continue;
      c.put(x, y + k, part >= 4 ? iron(0.95) : (part === 1 || part === 2) && k === 0 ? iron(0.05) : iron(k < 0 ? 0.85 : 0.58));
    }
  };
  c.thing(() => {
    const [x0, y0] = place(-22, lidTop(-22) + 1), [x1, y1] = place(24.5, 5);
    const n = Math.round(Math.hypot(x1 - x0, y1 - y0));
    for (let i = 0; i <= n; i++) {
      const s = i / n, x = x0 + (x1 - x0) * s, y = y0 + (y1 - y0) * s + 3 * Math.sin(Math.PI * s);
      if (y <= sand(Math.round(x)) + 1) link(i, x, y);
    }
    for (let i = 0; i < 30; i++) link(i + 2, x1 + i, y1 + (base + 1 - y1) * (1 - (1 - Math.min(1, i / 12)) ** 2) + Math.round(1.2 * Math.sin(i / 3.2)));
  });
  // the padlock, far too big, hanging plumb from the chain
  const [hx, hy] = place(1, 21);
  const lx = hx + Math.round(c.sway(0.15) * 1.2), ly = hy + 6;
  c.thing(() => {
    for (let dy = -9; dy <= 0; dy++) for (let dx = -6; dx <= 6; dx++) {
      const d = Math.hypot(dx / 5.6, dy / 8.6);
      if (d <= 1 && d > 0.58) c.put(lx + dx, ly + dy, iron(dx < -2 ? 0.5 : dy < -6 ? 1 : 0.8));
    }
  });
  c.thing(() => {
    for (let dy = 0; dy <= 13; dy++) for (let dx = -8; dx <= 8; dx++) {
      const inset = dy === 0 || dy === 13 ? 2 : dy === 1 || dy === 12 ? 1 : 0;
      if (Math.abs(dx) > 8 - inset) continue;
      const hole = Math.hypot(dx, dy - 5) < 2.1 || (Math.abs(dx) < 1 && dy > 5 && dy < 10);
      c.put(lx + dx + (dy > 8 ? 1 : 0), ly + dy, hole ? c.ink : flat(sponge, dy <= 1 ? 0.95 : dx <= -6 ? 0.42 : dy >= 12 ? 0.32 : dx >= 6 ? 0.55 : 0.72));
    }
  });
  if (c.look % 4 === 3) glint(c, lx + 5, ly + 2, 2);
  // sand drifted against it
  c.thing(() => blob(c.put, cx - 31, base + 1, 12, 5, (_u, v) => flat(dry, v < -0.35 ? 0.72 : 0.5), 816, 0.2));
  c.thing(() => blob(c.put, cx + 25, base + 2, 9, 3.4, (_u, v) => flat(dry, v < -0.35 ? 0.72 : 0.5), 817, 0.2));
  // the gold's light leaking out at the ends of the seam: three thin rays each side, and glints that take turns
  const ray = c.lit ? 10 : 6;
  for (const side of [-1, 1]) {
    const [sx, sy] = place(side * 25, 18.2);
    c.light((put) => {
      for (const [rise, long] of [[0, ray], [-0.55, ray * 0.7], [0.5, ray * 0.6]] as const) {
        for (let i = 1; i <= long; i++) put(sx + side * i, sy + Math.round(i * rise), flat(ember, i < long * 0.55 ? 1 : 0.72));
      }
    });
    glint(c, sx + side * (ray + 4), sy - 2 - side, [3, 1, 0, 1][(((c.look + (side > 0 ? 2 : 0)) % 4) + 4) % 4]! + (c.lit ? 1 : 0));
  }
}

// ---- the creatures

/**
 * The amphora an octopus lives in: an old jar lying over in the sand, a painted band round its belly; out of its mouth
 * a head with two eyes that look about, and arms that wave.
 */
function amphora(c: Sea, fx: number, fy: number, tilt: number): void {
  const { sponge, coral } = c.r;
  const big = 1.25, dx = Math.sin(tilt), dy = -Math.cos(tilt), nx = Math.cos(tilt), ny = Math.sin(tilt);
  const half = (v: number): number => (v < 2 ? 3.5 : v < 24 ? 4 + 8.5 * Math.sin(Math.PI * ((v - 2) / 22) ** 0.85) ** 0.8 : v < 30 ? 4 : 4 + (v - 30) * 0.9);
  const sand = (x: number): number => fy + 3 + Math.round(1.5 * Math.sin(x / 5));
  const mouthX = fx + dx * 33.5 * big, mouthY = fy + dy * 33.5 * big;
  c.thing(() => {
    for (let y = Math.floor(fy - 54); y <= fy + 12; y++) for (let x = Math.floor(fx - 20); x <= fx + 54; x++) {
      if (y > sand(x)) continue;
      const qx = (x - fx) / big, qy = (y - fy) / big, v = qx * dx + qy * dy, u = qx * nx + qy * ny;
      const lip = Math.hypot(u / 6.4, (v - 33.5) / 2.6);
      if (lip <= 1) { c.put(x, y, lip > 0.66 ? flat(sponge, 0.7) : c.ink); continue; }
      if (v < 0 || v > 33.5) continue;
      const h = half(v), side = u / h;
      if (Math.abs(u) <= h) {
        const band = Math.abs(v + 0.9 * Math.sin(u * 1.1) - 13.5) < 1.4 || Math.abs(v - 19.5) < 0.6;
        c.put(x, y, flat(sponge, (side > 0.45 ? 0.26 : side < -0.4 ? 0.6 : 0.42) - (band ? 0.2 : 0) + (v > 30.5 ? 0.12 : 0)));
      } else if (Math.abs(Math.hypot((Math.abs(u) - 7) / 4.6, (v - 25.5) / 4.6) - 1) < 0.27) c.put(x, y, flat(sponge, u > 0 ? 0.3 : 0.52));
    }
    for (const [v, u, size] of [[8, -6, 2.4], [17, 5, 2]] as const) barnacle(c, Math.round(fx + (dx * v + nx * u) * big), Math.round(fy + (dy * v + ny * u) * big), size);
  });
  // its arms, curling out of the jar's mouth
  const way = Math.atan2(dy, dx);
  ([[-1.3, 23, -1.5, -4], [-0.5, 28, -1.0, -2], [0.3, 25, 1.1, 2], [1.15, 21, 1.7, 4]] as const).forEach(([turn, long, curl, off], k) => {
    const pts: [number, number, number][] = [];
    let px = mouthX + nx * off, py = mouthY + ny * off;
    for (let i = 0; i <= long; i++) {
      const s = i / long, a = way + turn + curl * s * s + c.sway(k / 4 + 0.1) * 0.45 * s;
      pts.push([px, py, a]);
      px += Math.cos(a); py += Math.sin(a);
    }
    const wide = (s: number): number => 5.6 - s * 3.6;
    c.thing(() => {
      limb(c.put, long, (s) => { const p = pts[Math.round(s * long)]!; return [p[0], p[1]]; }, wide, (_s, kk, j) => flat(coral, kk < -0.2 || j > 0.4 ? 0.42 : 0.66));
      // suckers on the inside of the curl
      for (let i = 2; i < long * 0.8; i += 4) {
        const [sx, sy, a] = pts[i]!, r = wide(i / long) / 2 - 0.5, inner = Math.sign(curl);
        c.put(sx - Math.sin(a) * inner * r, sy + Math.cos(a) * inner * r, flat(coral, 1));
      }
    });
  });
  // its head in the mouth, and two eyes
  const hx = Math.round(mouthX + dx * 3), hy = Math.round(mouthY + dy * 3);
  c.thing(() => {
    blob(c.put, hx, hy, 7.5, 6, (u, v) => flat(coral, v < -0.4 ? 0.78 : u < -0.5 ? 0.45 : 0.62), 831, 0.05);
    const shut = c.look % 4 === 3, glance = [-1, 0, 1, 0][c.look % 4]!;
    for (const ex of [hx - 5, hx + 1]) for (let ey = 0; ey < 4; ey++) for (let d = 0; d < 4; d++) {
      if (shut) { if (ey === 2) c.put(ex + d, hy - 3 + ey, flat(coral, 0.2)); continue; }
      c.put(ex + d, hy - 3 + ey, (d === 1 + glance || d === 2 + glance) && ey > 0 && ey < 3 ? c.ink : c.foam);
    }
  });
}

/** A giant clam, seen from the front: two fluted shells with wavy lips, the upper lifting and falling over the looks, and in it a pearl. */
function clam(c: Sea, x: number, foot: number): void {
  const { violet, coral, hull } = c.r;
  const gap = [0, 5, 10, 5][c.look % 4]!, lip = foot - 8, wide = 18;
  const wave = (px: number): number => Math.round(1.7 * Math.sin((px - x) * 0.7));
  const flute = (px: number, py: number, cy: number): boolean => Math.floor(Math.atan2(py - cy, px - x) * 5 + 60) % 2 === 0;
  if (gap > 0) {
    // the dark in it, and its flesh along both lips
    c.thing(() => {
      for (let px = x - wide + 3; px <= x + wide - 3; px++) for (let py = lip - gap + wave(px) - 1; py <= lip + wave(px); py++) {
        const flesh = py >= lip + wave(px) - 2 || py <= lip - gap + wave(px) + 1;
        c.put(px, py, flat(coral, flesh ? 0.7 : 0.06));
      }
    });
    c.thing(() => blob(c.put, x + 1, lip - 4, 4.2, 4.2, (u, v) => (u < 0 && v < 0 && u * u + v * v < 0.5 ? c.foam : flat(hull, u > 0.3 || v > 0.3 ? 0.7 : 0.95)), 841, 0));
    if (gap > 6) glint(c, x - 1, lip - 6, c.lit ? 3 : 2);
  }
  // the upper shell
  c.thing(() => {
    const cy = lip - gap;
    for (let py = cy - 14; py <= cy + 3; py++) for (let px = x - wide; px <= x + wide; px++) {
      const u = (px - x) / wide, v = (py - cy) / 12.5;
      if (u * u + v * v > 1 + 0.06 * Math.sin(px * 1.4) || py > cy + wave(px) - 2) continue;
      c.put(px, py, py > cy + wave(px) - 4 ? flat(violet, 0.96) : flute(px, py, cy + 6) ? flat(violet, v < -0.62 ? 0.84 : 0.68) : flat(violet, 0.46));
    }
  });
  // the lower shell: a bowl in the sand
  c.thing(() => {
    for (let py = lip - 2; py <= foot + 2; py++) for (let px = x - wide; px <= x + wide; px++) {
      const u = (px - x) / wide, v = (py - lip) / 9.5;
      if (u * u + v * v > 1 || py < lip + wave(px) + 1) continue;
      c.put(px, py, py < lip + wave(px) + 3 ? flat(violet, 0.92) : flute(px, py, lip - 7) ? flat(violet, 0.6) : flat(violet, 0.38));
    }
  });
}

/** A hermit crab at home in a teapot: its legs under it, a claw out of the spout, and its eyes lifting the lid to look. */
function teapot(c: Sea, x: number, foot: number): void {
  const { hull, violet, red, sponge } = c.r;
  const lift = [0, 5, 5, 2][c.look % 4]!, glance = c.look % 4 === 2 ? 1 : -1, snap = c.look % 2;
  const top = foot - 21;
  // its legs, and the claw in the spout
  c.thing(() => {
    for (const s of [-1, 1]) for (let k = 0; k < 3; k++) {
      const lx = x + s * (3 + k * 4), step = (k + c.look) % 2;
      for (let i = 0; i < 4; i++) { c.put(lx + s * Math.round(i * 0.7), foot - 3 + i - step, flat(red, 0.55)); c.put(lx + s * Math.round(i * 0.7) + 1, foot - 3 + i - step, flat(red, 0.35)); }
    }
    const tx = x + 21, ty = foot - 22;
    for (let i = 0; i < 6; i++) for (let w = 0; w < 2; w++) {
      c.put(tx + i, ty - i - w - snap * Math.round(i * 0.4), flat(red, 0.72));
      c.put(tx + i + w, ty - Math.round(i * 0.3) + 1 + snap * Math.round(i * 0.3), flat(red, 0.5));
    }
    for (let d = 0; d < 3; d++) for (let e = 0; e < 3; e++) c.put(tx - 1 + d, ty - 1 + e, flat(red, 0.6));
  });
  // its eyes on their stalks, when the lid is up
  if (lift >= 4) c.thing(() => {
    for (const ex of [x - 5, x + 2]) {
      for (let e = 0; e < 3; e++) { c.put(ex + 1, top + 1 - e, flat(red, 0.55)); c.put(ex + 2, top + 1 - e, flat(red, 0.4)); }
      for (let d = 0; d < 4; d++) for (let e = 0; e < 4; e++) c.put(ex + d, top - 5 + e, (d === 1 + glance || d === 2 + glance) && e > 0 && e < 3 ? c.ink : c.foam);
    }
  });
  // the pot: a round belly, a spout, a handle, a band of blue
  c.thing(() => {
    limb(c.put, 14, (s) => [x + 10 + s * 10, foot - 9 - s * 11 - 2.5 * Math.sin(s * Math.PI)], (s) => 5.6 - s * 2, (_s, _k, j) => flat(hull, j > 0.3 ? 0.6 : 0.92));
    for (let a = 0; a <= 26; a++) {
      const t = (a / 26) * Math.PI, hx = x - 11 - Math.sin(t) * 7, hy = foot - 11 - Math.cos(t) * 6;
      c.put(hx, hy, flat(hull, 0.92)); c.put(hx - 1, hy, flat(hull, 0.62)); c.put(hx, hy + 1, flat(hull, 0.62));
    }
    blob(c.put, x, foot - 11, 12.5, 9.5, (u, v, px) => {
      if (Math.abs(v + 0.05 + 0.08 * Math.sin(px * 1.3)) < 0.13) return flat(violet, 0.45);
      if (Math.abs(v - 0.42) < 0.1 && (px + 400) % 4 < 2) return flat(violet, 0.6);
      return flat(hull, u < -0.55 || v > 0.62 ? 0.62 : u > 0.1 && u < 0.5 && v < -0.3 && v > -0.7 ? 1 : 0.9);
    }, 851, 0.05);
  });
  // the lid, lifted and tipped
  c.thing(() => {
    for (let d = -8; d <= 8; d++) {
      const ly = top - lift - (lift ? Math.round(d * 0.15) : 0);
      c.put(x + d, ly, flat(hull, 0.62));
      if (Math.abs(d) < 8) c.put(x + d, ly - 1, flat(hull, d > 1 ? 1 : 0.9));
      if (Math.abs(d) < 6) c.put(x + d, ly - 2, flat(violet, 0.45));
      if (Math.abs(d) < 4) c.put(x + d, ly - 3, flat(hull, 0.9));
      if (Math.abs(d) < 2) { c.put(x + d, ly - 4, flat(sponge, 0.6)); c.put(x + d, ly - 5, flat(sponge, 0.85)); }
    }
  });
}

/** The fish that walks: a fat striped fish on two legs in red boots, stepping along the sand toward the chest. */
function walker(c: Sea, x: number, foot: number): void {
  const { sponge, violet, red, coral } = c.r;
  const stride = pace(c), bob = c.look % 2 ? -1 : 0, cy = foot - 14 + bob;
  c.thing(() => {
    for (const [lx, fwd] of [[x - 4, stride], [x + 3, -stride]] as const) {
      for (let i = 0; i < 7; i++) for (let w = 0; w < 2; w++) c.put(lx + w + Math.round((fwd * 3 * i) / 6), foot - 8 + i + (i < 2 ? bob : 0), flat(coral, w ? 0.9 : 0.7));
      const bx = lx + fwd * 3;
      for (let d = -1; d <= 4; d++) { c.put(bx + d, foot, flat(red, 0.35)); c.put(bx + d, foot - 1, flat(red, d > 2 ? 0.75 : 0.55)); if (d < 2) c.put(bx + d, foot - 2, flat(red, 0.65)); }
    }
  });
  c.thing(() => {
    // its tail and its fin
    for (let k = 0; k < 8; k++) for (let j = -k; j <= k; j++) c.put(x - 10 - k, cy + Math.round(j * 0.8), flat(sponge, Math.abs(j) > k - 1 ? 0.5 : 0.66));
    for (let k = 0; k < 6; k++) for (let j = 0; j <= k; j++) c.put(x - 5 + k + j, cy - 7 - (5 - k) + j - 1, flat(sponge, 0.55));
    blob(c.put, x, cy, 11.5, 7.4, (u, v) => {
      if (Math.abs(u + 0.3) < 0.13 || Math.abs(u - 0.1) < 0.1) return flat(violet, v < -0.3 ? 0.6 : 0.42);
      return flat(sponge, v < -0.45 ? 0.92 : v > 0.45 ? 0.5 : 0.74);
    }, 861, 0.04);
    // its eye and its mouth
    for (let dy = 0; dy < 4; dy++) for (let dx = 0; dx < 4; dx++) c.put(x + 4 + dx, cy - 4 + dy, dx >= 2 && dy >= 1 && dy <= 2 ? c.ink : c.foam);
    for (const [mx, my] of [[10, 1], [9, 2], [8, 2], [7, 2]] as const) c.put(x + mx, cy + my, c.ink);
  });
}

/** The crab that has the key: it walks to and fro with the chest's big gold key held over its head. */
function keyCrab(c: Sea, at: number, foot: number): void {
  const { red, sponge } = c.r;
  const x = at + pace(c) * 2, step = c.look % 2, ky = foot - 20 - step;
  c.thing(() => {
    blob(c.put, x, foot - 6, 10.5, 5.6, (u, v) => flat(red, v < -0.35 ? 0.72 : u < -0.6 ? 0.4 : 0.55), 871, 0.04);
    for (const s of [-1, 1]) {
      for (let k = 0; k < 3; k++) for (let i = 0; i < 4; i++) c.put(x + s * (8 + k * 3 + Math.round(i * 0.6)), foot - 4 + i + ((k + step) % 2) - 1, flat(red, i < 2 ? 0.45 : 0.3));
      // an arm up to the key, and its claw round the shaft
      for (let i = 0; i < 8; i++) { c.put(x + s * (9 + Math.round(i * 0.3)), foot - 8 - i, flat(red, 0.55)); c.put(x + s * (10 + Math.round(i * 0.3)), foot - 8 - i, flat(red, 0.4)); }
      for (let d = -1; d <= 3; d++) for (let e = 0; e < 4; e++) if (!((d === 1 || d === 0) && e === 0)) c.put(x + s * (10 + d), ky + 2 + e, flat(red, e <= 1 ? 0.8 : 0.62));
    }
    // its eyes on stalks, looking up at the key
    for (const ex of [x - 4, x + 2]) {
      for (let d = 0; d < 2; d++) { c.put(ex + d, foot - 11, flat(red, 0.55)); c.put(ex + d, foot - 12, flat(red, 0.55)); }
      for (let d = 0; d < 3; d++) for (let e = 0; e < 3; e++) c.put(ex + d, foot - 15 + e, d === 1 && e === 0 ? c.ink : c.foam);
    }
  });
  c.thing(() => {
    const gold = (t: number): number => flat(sponge, t);
    // the bow, the shaft, the bit with its two teeth
    for (let dy = -6; dy <= 6; dy++) for (let dx = -6; dx <= 6; dx++) {
      const d = Math.hypot(dx, dy);
      if (d <= 6.2 && d > 2.6) c.put(x - 14 + dx, ky + dy, gold(dy < -3 ? 0.98 : dy > 2 ? 0.55 : 0.8));
    }
    for (let d = -8; d <= 16; d++) { c.put(x + d, ky - 1, gold(0.96)); c.put(x + d, ky, gold(0.76)); c.put(x + d, ky + 1, gold(0.5)); }
    for (const tooth of [10, 14]) for (let e = 2; e <= 6; e++) for (let d = 0; d < 3; d++) c.put(x + tooth + d, ky - e, gold(e === 6 ? 0.98 : d === 0 ? 0.6 : 0.8));
    for (let d = 2; d <= 3; d++) { c.put(x + d, ky - 2, gold(0.98)); c.put(x + d, ky + 2, gold(0.5)); }
  });
  if (c.look % 4 === 1) glint(c, x - 16, ky - 4, 2);
}

/** The way back up: a crooked post of driftwood, and nailed to it a board cut as an arrow that points to the surface. No words. */
function signpost(c: Sea, x: number, foot: number): void {
  const { wood, stone, dry, bush } = c.r;
  const post: At = (s) => [x + 3 * s + 1.4 * Math.sin(s * 6), foot - s * 42];
  c.thing(() => {
    limb(c.put, 42, post, (s) => 5.4 - s * 1.4, (s, k) => (hash2(Math.round(s * 13), 0, 881) > 0.8 ? flat(wood, 0.2) : flat(wood, k < -0.3 ? 0.3 : k > 0.3 ? 0.62 : 0.46)));
    barnacle(c, x + 1, foot - 9, 1.8);
  });
  // the board: an arrow, its head up, a little askew
  const [px, py] = post(0.7), bx = Math.round(px), by = Math.round(py), lean = -0.1;
  c.thing(() => {
    for (let dy = -19; dy <= 14; dy++) for (let dx = -13; dx <= 13; dx++) {
      const u = dx - dy * lean, v = dy + 19;
      const head = v < 13 && Math.abs(u) <= 1 + v * 0.85 + 0.7 * (noise2(dy / 2, 1, 882) - 0.5);
      const shaft = v >= 13 && Math.abs(u) <= 4.6 + 0.6 * (noise2(dy / 3, 2, 883) - 0.5) + (v > 31 ? -1 : 0);
      if (!head && !shaft) continue;
      const split = hash2(Math.floor(u / 3), Math.floor(v / 5), 884) > 0.82;
      c.put(bx + dx, by + dy, (v === 17 || v === 29) && Math.abs(u) < 1 ? flat(stone, 0.1) : split ? flat(wood, 0.66) : flat(wood, u < -2 ? 0.8 : v < 3 || u > 2 ? 1 : 0.92));
    }
  });
  // sand heaped at its foot, and a tuft of weed
  c.thing(() => blob(c.put, x, foot + 1, 7, 3, (_u, v) => flat(dry, v < -0.3 ? 0.72 : 0.5), 885, 0.2));
  c.thing(() => {
    for (let k = 0; k < 4; k++) for (let i = 0; i < 4 + k; i++) c.put(x + 5 + k + (c.sway(0.7) * 0.3 + 0.15 * k) * i, foot - 1 - i, i > 2 + k ? leaf(bush, 0.75) : flat(bush, 0.5));
  });
}

/** Lays every wonder in its place on the bed and the reef, back to front. */
export function paintWonders(b: WonderBrush): void {
  const put: Put = (x, y, col) => { if (Math.round(y) >= TOP) b.put(x, y, col); };
  const r = Object.fromEntries(RUNS.map((name) => [name, b.fine[name]?.length ? b.fine[name] : [b.ink]])) as Sea['r'];
  const c: Sea = {
    put, thing: (draw) => b.thing(draw), r, ink: b.ink, foam: b.foam, look: b.look, looks: b.looks, sway: (phase) => b.sway(phase), lit: b.lit,
    light: (draw) => {
      for (const odd of [0, 1]) b.thing(() => draw((x, y, col) => { const px = Math.round(x), py = Math.round(y); if (((px + py) & 1) === odd) put(px, py, col); }));
    },
  };
  const bed = PORT.bed;

  // behind the reef: the shy one looks out from behind the right arch's left pier
  shyOne(c, 392, bed - 92, 1);
  // on the reef's rock
  organ(c, 207, bed - 1);
  candy(c, 398, bed - 6, 40, 1, 1);
  candy(c, 409, bed - 2, 27, -1, 2);
  candy(c, 419, bed + 2, 19, 1, 3);
  horn(c, 549, bed + 12, 541, bed - 26, -0.5, -0.85, 12, r.coral, 1);
  horn(c, 559, bed + 14, 569, bed - 7, 0.65, -0.75, 9, r.sponge, 2);
  // the star, on the open sand before the middle arch
  chest(c, 322, bed + 28);
  // the lamps of the bed, where the picture is darkest
  lantern(c, 6, bed + 16, 52, 1, 1);
  lantern(c, 24, bed + 20, 37, 1, 2);
  lantern(c, 42, bed + 22, 25, -1, 3);
  lantern(c, 611, bed + 20, 39, 1, 4);
  lantern(c, 630, bed + 22, 57, -1, 5);
  lantern(c, 637, bed + 24, 26, -1, 6);
  // on the sand in front
  amphora(c, 58, bed + 22, 0.9);
  mushroom(c, 217, bed + 24, 11, r.coral, 0.12, 1);
  mushroom(c, 236, bed + 26, 7, r.violet, -0.2, 2);
  mushroom(c, 227, bed + 28, 5, r.red, 0.1, 3);
  signpost(c, 191, bed + 25);
  clam(c, 526, bed + 27);
  teapot(c, 582, bed + 27);
  walker(c, 259, bed + 28);
  keyCrab(c, 392, bed + 28);
}
