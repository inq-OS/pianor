import { hash2 } from '../../paint/noise';
import { runOf, type KitBrush, type KitItem } from './kit';

/**
 * Lights: what glows by its own light at dusk and night and warms what is round it. The model is the docks' lantern
 * and its glow, after Woodtick's lamps in the atlas (mi2-bg-0-007, mi2-bg-0-014; the docks are the model for light and
 * heat, checked against Woodtick in the atlas). The recipe in words: `projects/painter/artists-notes/light-and-heat.md`.
 */

/** Whether a lamp burns at the brush's hour: at dusk and at night, as the hour's `glow` says. */
export function lampLit(b: KitBrush): boolean {
  return b.hour.night || b.hour.glow >= 0.5;
}

export interface LanternOptions {
  /** Whether its glass shows the flame: `auto` by the hour (`lampLit`), or always lit, or always dark. */
  glass: 'auto' | 'lit' | 'dark';
}

/**
 * A small hanging lantern: an ink frame of seven by eight fine pixels on a hook, its glass pale by day and a flame's
 * yellow at dusk and night. Placed by its hook: `foot` is the row it hangs from, and it hangs below it.
 */
export const lantern: KitItem<LanternOptions> = {
  id: 'lights/lantern',
  family: 'lights',
  about: 'a small hanging lantern on a hook: an ink frame, its glass pale by day and lit at dusk and night',
  state: 'picked',
  model: 'the docks (docksPicture.ts `lantern`); picked for light and heat',
  note: 'light-and-heat.md',
  atlas: 'woodtick,light, lamp',
  uses: ['ember', 'shingle'],
  options: { glass: 'auto' },
  variants: { hanging: {}, lit: { glass: 'lit' }, dark: { glass: 'dark' } },
  skyline: () => 12,
  box: () => ({ left: 3, right: 3, up: 1, down: 9 }),
  paint(b, x, foot, o, seed) {
    const lit = o.glass === 'lit' || (o.glass === 'auto' && lampLit(b));
    const ember = runOf(b.run, 'ember', lantern.id), shingle = runOf(b.run, 'shingle', lantern.id);
    // no two alike: the docks' own (seed 0) has one upright bar; others a bar across too, or a peaked cap
    const kind = ((seed % 3) + 3) % 3;
    const y = foot + 1;
    b.put(x, y - (kind === 2 ? 1 : 0), b.run.ink);
    for (let dx = kind === 2 ? -2 : -3; dx <= (kind === 2 ? 2 : 3); dx++) b.put(x + dx, y + 1, b.run.ink);
    if (kind === 2) b.put(x, y, b.run.ink);
    for (let dy = 2; dy <= 8; dy++) for (let dx = -3; dx <= 3; dx++) {
      const frame = Math.abs(dx) === 3 || dx === 0 || dy === 8 || (kind === 1 && dy === 5);
      b.put(x + dx, y + dy, frame ? b.run.ink : lit ? (dy > 5 ? ember[4]! : ember[5]!) : dy < 4 ? shingle[3]! : shingle[2]!);
    }
  },
};

export interface LampOptions {
  /** How far its light reaches at the strongest hour, in fine pixels; the hour's `glow` takes some of it away. */
  reach: number;
  /** The rows from the lantern's hook down to where the water begins under it, for its streaks on the water; 0 for none. */
  water: number;
  /** Whether to paint the lantern itself too (`lights/lantern`); a scene that lays the glow on its own layer leaves it out. */
  lantern: boolean;
}

/**
 * A lamp's light round a lantern, at dusk and night (nothing by day): a round halo in two flat steps over the bare
 * sky; on the things round it warmth laid only on tones already lit, falling off fast, seams and shade keeping the
 * night's colour; a broken column of warm dashes on the water under it. No dither. It reads what is painted under it
 * through the brush's `under`; with none it lays only the halo. Placed by the lantern's hook, as the lantern.
 */
export const lamp: KitItem<LampOptions> = {
  id: 'lights/lamp',
  family: 'lights',
  about: 'a lantern\'s warm light at dusk and night: a stepped halo, warmth on what is lit, warm dashes on the water',
  state: 'picked',
  model: 'the docks (docksPicture.ts `lamp`), after Woodtick (mi2-bg-0-007, 0-014); picked for light and heat, with the atlas to be used',
  note: 'light-and-heat.md',
  atlas: 'woodtick,light, lamp, town,night',
  uses: ['ember', 'shingle'],
  options: { reach: 40, water: 30, lantern: true },
  variants: { pool: {}, small: { reach: 26 }, 'no-water': { water: 0 } },
  ground: (o) => (o.water ? 'sea' : 'shingle'),
  skyline: (o) => (o.water ? o.water : 12),
  box: (o) => ({ left: Math.ceil(o.reach * 1.2), right: Math.ceil(o.reach * 1.2), up: Math.ceil(o.reach * 1.2) - 3, down: Math.max(Math.ceil(o.reach * 1.2) + 3, o.water ? o.water + 46 : 9) }),
  paint(b, cx, foot, o, seed) {
    if (o.lantern) lantern.paint(b, cx, foot, lantern.options, seed);
    if (!lampLit(b)) return;
    const ember = runOf(b.run, 'ember', lamp.id);
    const reach = o.reach * (0.6 + b.hour.glow * 0.6);
    // where each colour sits in its own run (0 dark to 1 light), so the warm light keeps the grain of what it falls on
    const place = new Map<number, number>();
    for (const [name, run] of Object.entries(b.fine)) if (run && !['sky', 'cloud', 'sea', 'ember'].includes(name)) run.forEach((c, k) => place.set(c, k / (run.length - 1)));
    const sea = new Set<number>(b.fine.sea ?? []), sky = new Set<number>(b.fine.sky ?? []);
    const cy = foot + 3;
    for (let dy = -Math.ceil(reach); dy <= reach; dy++) for (let dx = -Math.ceil(reach); dx <= reach; dx++) {
      const ragged = 0.06 * hash2(Math.round(Math.atan2(dy, dx) * 6), seed, 990);
      const far = Math.hypot(dx, dy * 1.1) / reach + ragged;
      if (far >= 1 || dx * dx + dy * dy < 30) continue;
      const x = cx + dx, y = cy + dy;
      const under = b.under?.(x, y);
      if (b.under && !under) continue;
      if (!under?.thing || sky.has(under.colour)) {
        if (under && sea.has(under.colour)) continue;
        if (far < 0.2) b.put(x, y, ember[3]!);
        else if (far < 0.31) b.put(x, y, ember[2]!);
        continue;
      }
      const lightness = place.get(under.colour);
      // the darkest tones (seams, gaps, the ink) stay as they are
      if (lightness === undefined || lightness < 0.3) continue;
      // a faint warmth leaves the night's colour alone: only the upper steps are laid
      const k = Math.round(lightness * (1 - far) ** 1.5 * 6);
      if (k >= 2) b.put(x, y, ember[Math.min(4, k - 1)]!);
    }
    if (o.water && b.under) streaks(b, b.under, cx, Math.round(foot + o.water), ember, sea, seed);
  },
};

/** The lantern on the water: short warm dashes under it from row `top` down, thinning and spreading as they come nearer. */
function streaks(b: KitBrush, under: NonNullable<KitBrush['under']>, cx: number, top: number, ember: readonly number[], sea: ReadonlySet<number>, seed: number): void {
  for (let y = top + 1; y < top + 46; y++) {
    const d = (y - top) / 46;
    if (hash2(y, seed, 993) > 0.75 - d * 0.35) continue;
    const len = 2 + Math.floor(hash2(y, seed, 994) * 4);
    const x0 = Math.round(cx - 3 - d * 6 + hash2(y, seed, 995) * (6 + d * 12));
    for (let x = x0; x < x0 + len; x++) {
      const at = under(x, y);
      if (at && sea.has(at.colour)) b.put(x, y, d < 0.4 ? ember[3]! : ember[2]!);
    }
  }
}
