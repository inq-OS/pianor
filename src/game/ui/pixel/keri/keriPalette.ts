import { SKY_PHASES, type SkyPhase } from '../../../../core/sky/skyPhase';
import { PALETTE } from '../palette';
import { between, hexOf, lchOf } from '../paint/lab';
import { bayer } from '../paint/noise';
import { clamp01 } from '../paint/ease';

/**
 * The one palette of Keri's outdoor scenes (d111). A scene is painted in the names of this file (a run of
 * grass, of stone, of sea), never in colours of its own choosing, so every scene of the island is of one hand and a
 * change here changes them all. Two tables make it:
 *
 * - `MATERIALS`: what the island is made of, each a run of named tones from dark to light, as the day shows them;
 * - `KERI_HOURS`: what each hour of the day does: its own sky, clouds and sea, and how it moves the materials'
 *   lightness and tints them (d123).
 *
 * `scenePalette` gives a scene the places of the runs (the same at every hour) and the colours at an hour. Because the
 * places do not move, a picture painted once can be shown at any hour by changing its palette alone. A scene that
 * needs a thing no other has (a red boat, a painted door) adds a run of its own; the hour lights it like the rest.
 *
 * The colours written here are a run's named tones (`run.grass[3]`). Between each two of them the palette puts as
 * many colours as it takes for no step of lightness to be over `MAX_STEP` (`fine.grass`: the whole run), because the
 * pictures this manner comes from have long runs of small steps, and a run of a few far-apart tones looks cut out of
 * paper (d111).
 */

type Hex = number;
/** A shift of colour in CIE Lab: [a*, b*]. */
type Tint = readonly [number, number];

/** How an hour moves lightness; see `Hour.value`. */
export interface Value {
  floor: number;
  top: number;
  curve: number;
}

/** The day's own light: every colour as the materials list it. */
const DAYLIGHT: Value = { floor: 0, top: 100, curve: 1 };

/** What an hour does to a picture: its own sky, clouds and sea, and the light it lays on the materials. */
export interface Hour {
  /** The sky from its top to the horizon. */
  sky: readonly [Hex, Hex, Hex, Hex, Hex];
  /** A cloud: its lit top, its body, its shaded underside, and the soft line of a curl where it lies in shade. */
  cloud: readonly [Hex, Hex, Hex, Hex];
  /** The sea from the dark line under the horizon to the pale shallows, then its foam. */
  sea: readonly [Hex, Hex, Hex, Hex, Hex];
  foam: Hex;
  /** The moon (lit and shaded) and a star (bright and faint); only the night shows them. */
  lights: readonly [Hex, Hex, Hex, Hex];
  /**
   * What the hour does to a material's lightness: a day tone of lightness L (L*, 0 black to 100 white) is shown at
   * `floor + (top - floor) * (L / 100) ** curve`. The hour moves the whole run but keeps it long, as a painter does:
   * the 1991 nights are dark yet reach from near black to a moonlit plane (60 to 77 L*), never a flat murk.
   */
  value: Value;
  /** How much of a material's own colour the hour keeps (0 grey, 1 all of it). */
  keep: number;
  /**
   * The colour the hour lays into a material, as a shift of a* (green to red) and b* (blue to yellow): `shade` into
   * its dark tones, `sun` into its light ones, mixed by the tone's lightness. Cool shadows and warm lights at dusk,
   * blue shadows and pale moonlight at night.
   */
  shade: Tint;
  sun: Tint;
  /** How strongly a fire or a lamp lights the things round it (0 to 1): hardly by day, most at night. */
  glow: number;
  night: boolean;
}

export const KERI_HOURS: Record<SkyPhase, Hour> = {
  day: {
    sky: [0x3a78c8, 0x5294dc, 0x74b0ea, 0x9ccaf4, 0xc8e4fa], cloud: [0xffffff, 0xe4eefa, 0xb4c8e4, 0x8aa2c8],
    sea: [0x143a78, 0x1c5298, 0x2a70b8, 0x4494cc, 0x7cc4dc], foam: 0xf4fbff, lights: [0xfff8d0, 0xd8e4c0, 0xe0ecff, 0x8098c0],
    value: DAYLIGHT, keep: 1, shade: [0, 0], sun: [0, 0], glow: 0.2, night: false,
  },
  dawn: {
    sky: [0x54508c, 0x7c6aa4, 0xb08ab4, 0xe4a8a8, 0xf8d0a8], cloud: [0xfff0e0, 0xf4c8c0, 0xb890b0, 0x7c6898],
    sea: [0x2a2a60, 0x40468a, 0x6a6aa8, 0xa48ab4, 0xdcb0bc], foam: 0xfde8d8, lights: [0xfff8d0, 0xd8e4c0, 0xe0ecff, 0x8098c0],
    value: { floor: 3, top: 94, curve: 1.08 }, keep: 0.82, shade: [10, -14], sun: [8, 8], glow: 0.45, night: false,
  },
  dusk: {
    sky: [0x2c2658, 0x5a3a7a, 0xa04e80, 0xe07a5c, 0xfbb858], cloud: [0xfdd890, 0xf09a68, 0xa85a80, 0x5a3a70],
    sea: [0x1c1a4a, 0x322a68, 0x5a3c80, 0x9a5880, 0xe08a68], foam: 0xfde0b0, lights: [0xfff8d0, 0xd8e4c0, 0xe0ecff, 0x8098c0],
    value: { floor: 2, top: 90, curve: 1.15 }, keep: 0.85, shade: [14, -20], sun: [12, 20], glow: 0.5, night: false,
  },
  night: {
    sky: [0x060a1c, 0x0a1430, 0x101e44, 0x182c58, 0x24406c], cloud: [0x5c7eb0, 0x34507e, 0x1c3058, 0x101e40],
    sea: [0x040818, 0x0a1430, 0x12244c, 0x1c3868, 0x3a6090], foam: 0x9cc0e0, lights: [0xfff8d0, 0xcfd8b0, 0xe0ecff, 0x7088b8],
    value: { floor: 2, top: 86, curve: 1.8 }, keep: 0.6, shade: [14, -40], sun: [-6, -18], glow: 0.62, night: true,
  },
};

/** What Keri is made of, by day; each run dark to light. The hour's light is laid on them when a palette is made. */
const MATERIALS = {
  /** The one dark outline colour. */
  ink: [0x100c16],
  grass: [0x123a22, 0x1e5a2c, 0x2f7a36, 0x4e9a3e, 0x86c050, 0xc0e070],
  /** Grass gone dry and gold: its shadows lean to red-brown, its lights to yellow, as every run's hue turns (d111). */
  dry: [0x765529, 0xa38037, 0xc8ac4c, 0xe3d57d],
  /** Meadow seen far off, paler. */
  far: [0x5a7a40, 0x7e9a4e, 0xa6b462, 0xcac880],
  shingle: [0x6e6a68, 0x9a948c, 0xc2bcae, 0xe2dccc],
  stone: [0x2e2a32, 0x55525c, 0x807c84, 0xaaa6a6, 0xd6d2c8],
  earth: [0x2a1c16, 0x4a3222, 0x6a4a30, 0x8a6a48],
  ash: [0x1a161a, 0x3a363c, 0x6a666a, 0xa09a98],
  /** A bush's leaves; its pale highlight is greyer than the leaf under it, as highlights are. */
  bush: [0x0a2218, 0x143c22, 0x24602e, 0x449044, 0x86bc69],
  /** Leaves near the viewer, dark against the picture: what closes a corner. */
  near: [0x0a1216, 0x12261e, 0x1e3e28, 0x346034],
  /** A dry stalk and its seed head. */
  stem: [0x2a1e16, 0x5c4a26, 0xb8a44a, 0xf0e09a],
  /** Flowers: white, yellow, rust, dark red. */
  bloom: [0xf6f2e6, 0xffd24a, 0x9a4226, 0x5a2418],
  /** The dog rose (kibuvits): its flower's shade, the red hip, the flower and its pale edge. */
  rose: [0x7a2450, 0xd8421e, 0xc8508e, 0xf0a6cc],
  smoke: [0x8e8a8c, 0xcec8ba, 0xf2f6f8],
} as const;

/**
 * No two neighbours of a whole run are further apart in lightness than this (L*, where 100 is white and about 2 is the
 * least step the eye sees). The 1991 pictures measured 2 to 4.5; a palette of one byte shared by all materials has
 * room for 8 (d111).
 */
export const MAX_STEP = 8;

/** Handfuls of separate colours, not runs of one: nothing is put between them, and the rules of a run are not asked of them. */
export const APART: ReadonlySet<string> = new Set(['bloom', 'stem', 'rose']);

/** A fire's embers and flames, dark to light. They glow by their own light: no hour changes them. */
const EMBER: readonly Hex[] = [0x5a160a, 0xa8300c, 0xe85a10, 0xfb9a24, 0xffd04a, 0xfff2a8];

/** A material of the island: a name of `MATERIALS`. */
export type Material = keyof typeof MATERIALS;
const MATERIAL_NAMES = Object.keys(MATERIALS) as Material[];

/** A picture's pixel is one byte: a palette can hold no more colours than this. */
export const PALETTE_ROOM = 256;

/** Where each run of colours sits in a scene's palette: palette places, dark to light. */
export type SceneRuns<Own extends string = never, Use extends Material = Material> = Record<Exclude<Use, 'ink'> | Own, readonly number[]> & {
  sky: readonly number[];
  cloud: readonly number[];
  sea: readonly number[];
  foam: number;
  /** The moon, lit and shaded. */
  moon: readonly number[];
  /** A star, bright and faint. */
  star: readonly number[];
  ink: number;
  ember: readonly number[];
};

/** Every run that has tones: each whole, with the colours between its named tones, dark to light as `run` lists it. */
export type FineRuns<Own extends string = never, Use extends Material = Material> = Record<Exclude<Use, 'ink'> | Own | 'sky' | 'cloud' | 'sea' | 'ember', readonly number[]>;

export interface ScenePalette<Own extends string = never, Use extends Material = Material> {
  /** The places of the runs' named tones: the same at every hour. */
  run: SceneRuns<Own, Use>;
  /** The places of the whole runs, the named tones among them: for a tone that shades off (`tone(fine.sky, t, x, y)`). */
  fine: FineRuns<Own, Use>;
  /** How many colours the palette holds. */
  count: number;
  /** The colours at an hour: the game's own palette first, then the runs. */
  at(phase: SkyPhase): readonly number[];
}

/** How many colours must stand between two for no step of lightness to be over `step`. */
const needed = (a: Hex, b: Hex, step = MAX_STEP): number => Math.max(0, Math.ceil(Math.abs(lchOf(b).l - lchOf(a).l) / step - 1e-9) - 1);

/** A run with `gaps[i]` colours put between its tones `i` and `i + 1`, evenly. */
function filled(run: readonly Hex[], gaps: readonly number[]): Hex[] {
  return run.flatMap((hex, i) => (i === 0 ? [hex] : [...Array.from({ length: gaps[i - 1]! }, (_, k) => between(run[i - 1]!, hex, (k + 1) / (gaps[i - 1]! + 1))), hex]));
}


/** A colour of the day under an hour's light (see `Hour.value`, `keep`, `shade`, `sun`). The day leaves it as it is. */
export function lit(hex: Hex, hour: Hour): Hex {
  const { value, keep, shade, sun } = hour;
  if (value.floor === 0 && value.top === 100 && value.curve === 1 && keep === 1 && !shade[0] && !shade[1] && !sun[0] && !sun[1]) return hex;
  const { l, chroma, hue } = lchOf(hex);
  const t = clamp01(l / 100);
  const turn = (hue * Math.PI) / 180;
  const a = chroma * Math.cos(turn) * keep + shade[0] * (1 - t) + sun[0] * t;
  const b = chroma * Math.sin(turn) * keep + shade[1] * (1 - t) + sun[1] * t;
  return hexOf({ l: value.floor + (value.top - value.floor) * t ** value.curve, chroma: Math.hypot(a, b), hue: (Math.atan2(b, a) * 180) / Math.PI });
}

/**
 * The palette of one outdoor scene: Keri's shared runs, then the scene's `own` runs (each dark to light, in the day's
 * colours; the hour lights them like the materials). A name may not be one the shared palette has, and the whole must
 * fit a byte. `use` names the materials the scene paints with (all, if left out; the ink always): a material it leaves
 * out takes no places, so the room goes to the runs it has, and to the hours that stretch them (a night that keeps its
 * light range needs more colours between its tones than the day does). `smooth.sky` is the sky's largest step of
 * lightness where a scene lays its sky without dither or grain (the sky and background should
 * be butter smooth): a run of `MAX_STEP` steps shows its bands then, a run of steps of 3 does not.
 */
export function scenePalette<Own extends string = never, Use extends Material = Material>(
  own: Readonly<Record<Own, readonly Hex[]>> = {} as Record<Own, readonly Hex[]>,
  use: readonly Use[] = MATERIAL_NAMES as Use[],
  smooth: { sky?: number } = {},
): ScenePalette<Own, Use> {
  const ownNames = Object.keys(own) as Own[];
  const laid: ((phase: SkyPhase) => readonly Hex[])[] = [];
  let next = PALETTE.length;
  /**
   * Gives a run its places. `shade` is the run's named tones at an hour; a `whole` run gets as many places between
   * each two of them as the hour with the largest step needs, so the places are the same at every hour.
   */
  const lay = (shade: (phase: SkyPhase) => readonly Hex[], whole: boolean, step = MAX_STEP): { tones: number[]; all: number[] } => {
    const count = shade('day').length;
    const gaps = Array.from({ length: Math.max(0, count - 1) }, (_, i) => (whole ? Math.max(...SKY_PHASES.map((phase) => needed(shade(phase)[i]!, shade(phase)[i + 1]!, step))) : 0));
    const tones: number[] = [], all: number[] = [];
    for (let i = 0; i < count; i++) {
      for (let k = 0; i > 0 && k < gaps[i - 1]!; k++) all.push(next++);
      tones.push(next);
      all.push(next++);
    }
    laid.push((phase) => filled(shade(phase), gaps));
    return { tones, all };
  };
  const hour = (pick: (hour: Hour) => readonly Hex[]) => (phase: SkyPhase): readonly Hex[] => pick(KERI_HOURS[phase]);
  const land = (run: readonly Hex[]) => (phase: SkyPhase): readonly Hex[] => run.map((hex) => lit(hex, KERI_HOURS[phase]));

  const sky = lay(hour((h) => h.sky), true, Math.min(MAX_STEP, smooth.sky ?? MAX_STEP)), cloud = lay(hour((h) => h.cloud), true), sea = lay(hour((h) => h.sea), true);
  const foam = lay(hour((h) => [h.foam]), false), lights = lay(hour((h) => h.lights), false);
  const material = {} as Record<Material, { tones: number[]; all: number[] }>;
  for (const name of MATERIAL_NAMES) if (name === 'ink' || use.includes(name as Use)) material[name] = lay(land(MATERIALS[name]), !APART.has(name));
  const ember = lay(() => EMBER, true);
  const shared = { sky, cloud, sea, ...material, ember };
  const mine = {} as Record<Own, { tones: number[]; all: number[] }>;
  for (const name of ownNames) {
    if (name in MATERIALS || name in shared || name === 'foam' || name === 'moon' || name === 'star') throw new Error(`scenePalette: "${name}" is a run of the shared palette; give the scene's own run another name`);
    mine[name] = lay(land(own[name]), true);
  }
  if (next > PALETTE_ROOM) throw new Error(`scenePalette: ${next} colours, a picture holds ${PALETTE_ROOM}; name only the materials the scene paints with (\`use\`)`);
  const pick = <K extends string>(runs: Record<K, { tones: number[]; all: number[] }>, part: 'tones' | 'all'): Record<K, number[]> => Object.fromEntries(Object.entries<{ tones: number[]; all: number[] }>(runs).map(([name, run]) => [name, run[part]])) as Record<K, number[]>;
  const fineLand = pick(material, 'all') as Partial<Record<Material, number[]>>;
  delete fineLand.ink;
  return {
    run: { ...pick(shared, 'tones'), ...pick(mine, 'tones'), foam: foam.tones[0]!, moon: lights.tones.slice(0, 2), star: lights.tones.slice(2), ink: material.ink.tones[0]! },
    fine: { sky: sky.all, cloud: cloud.all, sea: sea.all, ...(fineLand as Record<Exclude<Use, 'ink'>, number[]>), ember: ember.all, ...pick(mine, 'all') },
    count: next,
    at(phase) {
      return [...PALETTE, ...laid.flatMap((colours) => colours(phase))];
    },
  };
}

/** The colour of a run for a tone `t` (0 dark end, 1 light end); `spread` above 0 mixes neighbours by an ordered dither. */
export function tone(run: readonly number[], t: number, x: number, y: number, spread = 0): number {
  const v = t * (run.length - 1) + (bayer(x, y) - 0.5) * spread;
  return run[Math.max(0, Math.min(run.length - 1, Math.round(v)))]!;
}
