import { clamp01 } from '../../paint/ease';
import { fbm, hash2 } from '../../paint/noise';
import { tone } from '../keriPalette';
import { runOf, type KitBrush, type KitItem } from './kit';
import { lump } from './shape';

/**
 * Stones: the family's types. The model is the docks (picked for stones);
 * `boulder` and `pebble` are that scene's painters, lifted here pixel for pixel. The recipe in words:
 * `projects/painter/artists-notes/stones.md`.
 */

export interface BoulderOptions {
  /** Its half width and its height, in fine pixels. A big one is a heap of more lumps than a small one. */
  wide: number;
  high: number;
  /** Standing in the water: wet and weedy along its foot, a broken ring of foam round it that comes and goes. */
  wet: boolean;
  /** 0 for a rock in the light; 0.3 to 0.45 for one near the viewer, painted from the dark end of the stone: a dark wing of the picture. */
  dark: number;
}

/**
 * A boulder of heaped round lumps: lit in flat bands from the top and the light's side, with a hard shade side and a
 * dark seam where two lumps meet, a pale rim where a lump's top meets the light, a pixel of lichen here and there.
 */
export const boulder: KitItem<BoulderOptions> = {
  id: 'stones/boulder',
  family: 'stones',
  about: 'a boulder of heaped round lumps, lit in flat bands; on the shore, in the water, or dark in a near corner',
  state: 'picked',
  model: 'the docks (docksPicture.ts `boulder`); picked for stones',
  note: 'stones.md',
  atlas: 'stones, beach, cliff, stones,keri',
  uses: ['stone', 'far', 'bush', 'near'],
  options: { wide: 34, high: 30, wet: false, dark: 0 },
  variants: {
    middle: {},
    small: { wide: 14, high: 12 },
    big: { wide: 56, high: 62 },
    'in-water': { wet: true },
    foreground: { wide: 48, high: 44, dark: 0.42 },
  },
  box: (o) => ({ left: Math.ceil(o.wide * 1.6), right: Math.ceil(o.wide * 1.6), up: Math.ceil(o.high + o.wide * 0.2), down: o.wet ? 2 : 0 }),
  ground: (o) => (o.wet ? 'sea' : 'shingle'),
  paint(b, cx, foot, o, seed) {
    const { wide, high, wet, dark } = o;
    const stone = runOf(b.fine, 'stone', boulder.id);
    // a big boulder is a heap of more lumps than a small one, the middle ones higher, no two the same
    const n = wide > 50 ? 5 : wide > 28 ? 4 : 3;
    const squash = Math.max(0.62, Math.min(1, high / wide));
    const lumps = Array.from({ length: n }, (_, i) => {
      const u = (i + 0.5) / n - 0.5;
      const r = wide * (n > 3 ? 0.42 : 0.6) * (0.8 + 0.4 * hash2(seed, i, 230)) * (1 - Math.abs(u) * 0.5);
      // the middle ones reach the boulder's top, those at the sides sit lower
      const top = foot - high * (1 - Math.abs(u) * (0.5 + 0.5 * hash2(seed, i, 236)));
      return { x: cx + u * wide * 1.3 + (hash2(seed, i, 231) - 0.5) * wide * 0.2, y: top + r * squash, r };
    });
    // and a broad low one under them all, so the heap stands on its foot
    lumps.push({ x: cx + (hash2(seed, 9, 237) - 0.5) * wide * 0.2, y: foot - high * 0.22, r: wide * 0.72 });
    const side = b.side;
    const x0 = Math.floor(cx - wide * 1.6), x1 = Math.ceil(cx + wide * 1.6), y0 = Math.floor(Math.min(...lumps.map((l) => l.y - l.r * squash * 1.4)));
    for (let y = y0; y <= foot; y++) for (let x = x0; x <= x1; x++) {
      let best = -1, second = -1, k = 0;
      lumps.forEach((l, i) => {
        const v = lump(x, y, l.x, l.y, l.r, l.r * squash, seed + i);
        if (v > best) { second = best; best = v; k = i; } else if (v > second) second = v;
      });
      if (best < 0) continue;
      const l = lumps[k]!;
      const nx = (x - l.x) / l.r, ny = (y - l.y) / (l.r * squash);
      // flat cartoon bands (the 1991 game's rocks): the whole heap is lit as one mass first (a shade side, a lit top),
      // each lump only a little on its own
      const mass = ((x - cx) / (wide * 1.3)) * side * 0.45 - ((foot - y) / Math.max(1, high) - 0.5) * -0.3;
      let t = 0.5 - ny * 0.3 + nx * side * 0.18 + mass + (fbm(x / 9 + seed, y / 6, 2, seed + 232) - 0.5) * 0.12 - dark;
      // a hard shade on the far side
      if (nx * side < -0.4 && ny > -0.7) t = Math.min(t, 0.22 - dark);
      if (best < 0.1 && ny > -0.4) t = 0.02;
      // a dark seam where two lumps meet
      if (second > 0 && best - second < 0.035 * (wide > 28 ? 1 : 0.6)) t = 0.02;
      const band = Math.round(clamp01(t) * 3) / 3;
      // a rock near the viewer (`dark`) is painted from the dark end of the stone only; a pale rim where a lump's top meets the light
      let c = tone(stone, band * (dark > 0.25 ? 0.85 - dark : 0.85) + (best < 0.12 && ny < -0.55 && nx * side >= 0 ? 0.15 : 0), x, y, 0);
      if (hash2(x, y, seed + 233) > 0.992 && band > 0.5) c = runOf(b.run, 'far', boulder.id)[1]!; // lichen, a pixel here and there
      if (wet && foot - y < 2 + high * 0.08) c = hash2(x, y, 234) > 0.45 ? runOf(b.run, 'bush', boulder.id)[0]! : runOf(b.run, 'near', boulder.id)[1]!;
      b.put(x, y, c);
    }
    if (!wet) return;
    const ring = b.sway?.(seed * 0.13) ?? 0;
    for (let dx = -Math.ceil(wide * 1.3); dx <= Math.ceil(wide * 1.3); dx++) {
      if (hash2(cx + dx, seed, 235) < 0.35 + 0.15 * ring) continue;
      const u = dx / (wide * 1.3);
      b.put(cx + dx, foot + 1 + Math.round((1 - u * u) * (0.5 + 0.5 * ring)), b.run.foam);
    }
  },
};

/** The four tones a pebble is painted from, dark to light. */
const PEBBLE_TONES = {
  /** Pale shingle: most of a beach. */
  shingle: (b: KitBrush, id: string) => runOf(b.run, 'shingle', id).slice(0, 4),
  /** Grey stone: about one in four. */
  stone: (b: KitBrush, id: string) => runOf(b.run, 'stone', id).slice(1, 5),
  /** Red-brown granite: about one in seven. */
  brown: (b: KitBrush, id: string) => [runOf(b.run, 'earth', id)[2]!, runOf(b.run, 'earth', id)[3]!, runOf(b.run, 'dry', id)[1]!, runOf(b.run, 'shingle', id)[2]!],
  /** In the dark band along the picture's foot. */
  dark: (b: KitBrush, id: string) => [runOf(b.run, 'near', id)[0]!, ...runOf(b.run, 'stone', id).slice(0, 3)],
} as const;

export interface PebbleOptions {
  /** Its half width in fine pixels; a pebble 1 to 4, a cobble 5 to 9. */
  r: number;
  /** Its height over its width: a beach stone lies flat. */
  flat: number;
  tones: keyof typeof PEBBLE_TONES;
}

/** A pebble or a cobble: one lump of a few flat tones, light on top and toward the light, dark under. */
export const pebble: KitItem<PebbleOptions> = {
  id: 'stones/pebble',
  family: 'stones',
  about: 'a pebble or a cobble of the shingle: one flat lump of four tones, light on top, dark under; laid by the hundred, far to near',
  state: 'picked',
  model: 'the docks (docksPicture.ts `pebble`, `pebbles`); picked for stones',
  note: 'stones.md',
  atlas: 'shingle, beach, stones,keri',
  uses: ['shingle', 'stone', 'earth', 'dry', 'near'],
  options: { r: 3, flat: 0.62, tones: 'shingle' },
  variants: {
    pebble: {},
    grey: { tones: 'stone' },
    brown: { r: 4, tones: 'brown' },
    cobble: { r: 8, tones: 'stone' },
    foreground: { r: 9, tones: 'dark' },
  },
  box: (o) => ({ left: Math.ceil(o.r * 1.4), right: Math.ceil(o.r * 1.4), up: Math.ceil(o.r * o.flat * 2.4), down: Math.ceil(o.r * o.flat * 0.5) }),
  paint(b, cx, foot, o, seed) {
    const rx = o.r, ry = o.r * o.flat, cy = foot - ry;
    const run = PEBBLE_TONES[o.tones](b, pebble.id);
    for (let y = Math.floor(cy - ry * 1.4); y <= Math.ceil(cy + ry * 1.4); y++) for (let x = Math.floor(cx - rx * 1.4); x <= Math.ceil(cx + rx * 1.4); x++) {
      const v = lump(x, y, cx, cy, rx, ry, seed);
      if (v < 0) continue;
      const nx = (x - cx) / rx, ny = (y - cy) / ry;
      const t = v < 0.9 / ry && ny > 0 ? 0 : 0.62 - ny * 0.5 + nx * b.side * 0.22;
      b.put(x, y, run[Math.max(0, Math.min(run.length - 1, Math.round(clamp01(t) * (run.length - 1))))]!);
    }
  },
};
