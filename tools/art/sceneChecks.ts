import { MAX_STEP } from '../../src/game/ui/pixel/keri/keriPalette.ts';
import { lchOf } from '../../src/game/ui/pixel/paint/lab.ts';
import { runStats } from './colourRuns';

/**
 * The measurable rules of a painted scene (docs/art-direction.md), taken from measuring the backgrounds of Monkey
 * Island 2 (1991) and the skies of The Curse of Monkey Island (1997); the study is kept locally,
 * never in git. They are warnings for whoever paints: the eye and the maintainer decide, not this file.
 */
export const SCENE_RULES = {
  /** Largest lightness step (L*) between neighbours of a run; Monkey Island 2 keeps 2 to 4.5. */
  maxStep: MAX_STEP,
  /** Rounding room over `maxStep`, as the palette's own test allows. */
  stepSlack: 0.5,
  /** A highlight is judged only in a run this saturated somewhere (chroma); a near-grey run like shingle is left alone. */
  paleChroma: 15,
  /** A run's hue turns at least this much (degrees for each 10 L*) from its dark end to its light end; MI2: 3 to 6. */
  minTurn: 1,
  /** A light end above this L* is greyer than the run's most saturated colour (MI2: highlights pale towards white). */
  paleLight: 70,
  /** Hues light leans towards: yellow (warm and green things) and cyan (sky and sea), in Lab hue degrees. */
  lightHues: [95, 230],
  /** A cloud with a head: length 2 to 5 times its height (MI3 measured 1.9 to 5.3). */
  headedAspect: [1.8, 5.5],
  /** A streak, a cloud with no head: length 7 to 17 times its height (MI2 measured). */
  streakAspect: [7, 17],
  /** The head's thickness over the tail's (MI3 measured 2 to 9). */
  headOverTail: [2, 9],
  /** The head sits in the first or the last quarter of the cloud's length. */
  headEnd: 0.25,
  /** Below this length:height a cloud is a fat heap: MI3's carry their bulk at 0.3 to 0.45 of the length, so where its head sits is not checked. */
  heapAspect: 3,
  /** Two clouds of one sky closer than this on both measures share their proportions. */
  twinShare: 0.15,
  /** At least this share of a picture's pixels is painted with colours of its runs; the rest are accents and sprites. */
  runShare: 0.85,
  /**
   * At most this share of a picture's 2 x 2 blocks is a checkerboard of two colours further apart than `maxStep`:
   * coarse dither, the mark of a run that is too short (before the runs were made long the room had 0.012 to 0.015).
   */
  coarseDither: 0.01,
  /** A run a picture has for itself is used: at least this share of its colours, at some hour. */
  ownRunUse: 0.5,
  /**
   * A banded picture (a lit set, whose light is computed) keeps its runs short on purpose: few flat tones this far
   * apart at most, so the light lands in bands. With long runs the room shaded off smoothly and looked too 3D,
   * not in the MI2 style (d111).
   */
  bandedStep: 18,
  /** The dither between a banded picture's tones is its brushwork: this share of it may be a checkerboard of two far tones. */
  bandedDither: 0.03,
} as const;

/** The limits a picture is held to: a banded one (a lit set) has few flat tones and strong dither, the others long runs. */
export function limitsFor(banded: boolean | undefined): { step: number; dither: number } {
  return banded ? { step: SCENE_RULES.bandedStep, dither: SCENE_RULES.bandedDither } : { step: SCENE_RULES.maxStep, dither: SCENE_RULES.coarseDither };
}

/** What kind of run: a material lights like a thing; a sky or a light source (fire, lamp) is only checked for steps. */
export type RunKind = 'material' | 'sky' | 'light';

const angle = (a: number, b: number): number => Math.abs(((a - b + 540) % 360) - 180);
const nearestLight = (hue: number): number => Math.min(...SCENE_RULES.lightHues.map((h) => angle(hue, h)));

/** What a run, given dark to light, does against the rules: one line per finding, empty when it keeps them. */
export function runFindings(name: string, run: readonly number[], kind: RunKind, maxStep: number = SCENE_RULES.maxStep): string[] {
  if (run.length < 2) return [];
  const s = runStats(run);
  const out: string[] = [];
  if (s.maxStep > maxStep + SCENE_RULES.stepSlack) {
    const at = s.steps.indexOf(s.maxStep);
    out.push(`${name}: step of ${s.maxStep.toFixed(1)} L* (colours ${at + 1} to ${at + 2}); at most ${maxStep}`);
  }
  if (kind !== 'material' || s.hueTurnPer10L === null || s.hueFrom === null || s.hueTo === null) return out;
  if (Math.abs(s.hueTurnPer10L) < SCENE_RULES.minTurn) {
    out.push(`${name}: the hue hardly turns (${s.hueTurnPer10L.toFixed(1)} degrees for each 10 L*); turn it towards yellow or cyan as it lightens`);
  } else if (nearestLight(s.hueTo) > nearestLight(s.hueFrom)) {
    out.push(`${name}: the hue turns away from yellow and cyan as it lightens (${s.hueFrom.toFixed(0)} to ${s.hueTo.toFixed(0)} degrees)`);
  }
  if (run.length >= 4 && s.chromaPeakAt === 1 && s.light.L > SCENE_RULES.paleLight && s.light.chroma >= SCENE_RULES.paleChroma) {
    out.push(`${name}: the lightest colour (L* ${s.light.L.toFixed(0)}) is the most saturated; let a pale highlight be greyer than the middle`);
  }
  return out;
}

/** The measures of one cloud as painted. */
export interface CloudShape {
  width: number;
  height: number;
  /** Length over height. */
  aspect: number;
  /** The thickest column over a typical one of the tail (the 25th percentile). */
  headOverTail: number;
  /** Where the head sits along the cloud: 0 its left end, 1 its right. */
  headAt: number;
}

/** Measures a cloud bitmap (any pixel not 0 is cloud). */
export function cloudShape(bitmap: { width: number; height: number; pixels: Uint8Array }): CloudShape {
  let x0 = Infinity, x1 = -1, y0 = Infinity, y1 = -1;
  for (let y = 0; y < bitmap.height; y++) {
    for (let x = 0; x < bitmap.width; x++) {
      if (bitmap.pixels[y * bitmap.width + x] === 0) continue;
      x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y);
    }
  }
  if (x1 < 0) throw new Error('cloudShape: the bitmap holds no cloud');
  const width = x1 - x0 + 1, height = y1 - y0 + 1;
  const columns: number[] = [];
  for (let x = x0; x <= x1; x++) {
    let n = 0;
    for (let y = y0; y <= y1; y++) if (bitmap.pixels[y * bitmap.width + x] !== 0) n++;
    columns.push(n);
  }
  const max = Math.max(...columns);
  const filled = columns.filter((n) => n > 0).sort((a, b) => a - b);
  const tail = filled[Math.floor((filled.length - 1) * 0.25)]!;
  const heads = columns.map((n, i) => (n >= 0.9 * max ? i : -1)).filter((i) => i >= 0);
  const mid = heads.reduce((a, b) => a + b, 0) / heads.length;
  return { width, height, aspect: width / height, headOverTail: max / tail, headAt: width > 1 ? mid / (width - 1) : 0.5 };
}

const near = (a: number, b: number): boolean => Math.abs(a - b) / Math.max(a, b) < SCENE_RULES.twinShare;
const inRange = (v: number, [lo, hi]: readonly [number, number]): boolean => v >= lo && v <= hi;

/** What the clouds of one sky do against the rules, numbered from 1 in the order given. */
export function cloudFindings(clouds: readonly CloudShape[]): string[] {
  const R = SCENE_RULES;
  const out: string[] = [];
  clouds.forEach((c, i) => {
    const n = `cloud ${i + 1} (${c.width} x ${c.height})`;
    const ratio = `${c.aspect.toFixed(1)}:1`;
    if (c.aspect >= R.streakAspect[0]) {
      if (!inRange(c.aspect, R.streakAspect)) out.push(`${n}: a streak of ${ratio}; streaks are ${R.streakAspect[0]}:1 to ${R.streakAspect[1]}:1`);
      return;
    }
    if (!inRange(c.aspect, R.headedAspect)) {
      out.push(`${n}: ${ratio}; a cloud with a head is ${R.headedAspect[0]}:1 to ${R.headedAspect[1]}:1, a streak ${R.streakAspect[0]}:1 or more`);
    }
    if (!inRange(c.headOverTail, R.headOverTail)) {
      out.push(`${n}: the head is ${c.headOverTail.toFixed(1)} times the tail; ${R.headOverTail[0]} to ${R.headOverTail[1]}`);
    }
    if (c.aspect >= R.heapAspect && c.headAt > R.headEnd && c.headAt < 1 - R.headEnd) {
      out.push(`${n}: the head sits at ${c.headAt.toFixed(2)} of the length; keep it in the first or last quarter`);
    }
  });
  clouds.forEach((a, i) => clouds.slice(i + 1).forEach((b, k) => {
    if (near(a.aspect, b.aspect) && near(a.headOverTail, b.headOverTail)) {
      out.push(`clouds ${i + 1} and ${i + k + 2} share their proportions (${a.aspect.toFixed(1)}:1 and ${b.aspect.toFixed(1)}:1); no two alike`);
    }
  }));
  return out;
}

/** A picture's runs of colours: the places in its palette of each. */
export type Runs = Readonly<Record<string, readonly number[]>>;

/** What is wrong with the runs a picture names, before any colour is judged: empty when they are sound. */
export function runsDeclared(runs: Runs, palette: readonly number[]): string[] {
  const out: string[] = [];
  const owner = new Map<number, string>();
  for (const [name, places] of Object.entries(runs)) {
    if (places.length < 2) out.push(`${name}: a run has two colours or more`);
    if (places.some((p) => !Number.isInteger(p) || p < 1 || p >= palette.length)) out.push(`${name}: a place outside the palette`);
    if (new Set(places.map((p) => palette[p])).size < places.length) out.push(`${name}: the same colour twice`);
    for (const p of places) {
      const other = owner.get(p);
      if (other !== undefined && other !== name) out.push(`${name}: shares a place with ${other}`);
      owner.set(p, name);
    }
  }
  return out;
}

/** The share of a picture's pixels painted with colours of its runs (clear pixels, place 0, do not count). */
export function runShare(pixels: Uint8Array, runs: Runs): number {
  const inRun = new Set(Object.values(runs).flat());
  let painted = 0, n = 0;
  for (const p of pixels) {
    if (p === 0) continue;
    painted++;
    if (inRun.has(p)) n++;
  }
  return painted ? n / painted : 0;
}

/**
 * The share of a picture's 2 x 2 blocks that are a checkerboard of two colours further apart in lightness than
 * `maxStep`: dither between far tones, which a long run does not need.
 */
export function coarseDither(bitmap: { width: number; height: number; pixels: Uint8Array }, palette: readonly number[]): number {
  const { width: w, height: h, pixels } = bitmap;
  if (w < 2 || h < 2) return 0;
  const light = palette.map((c) => lchOf(c).l);
  let n = 0;
  for (let y = 0; y + 1 < h; y++) {
    for (let x = 0; x + 1 < w; x++) {
      const a = pixels[y * w + x]!, b = pixels[y * w + x + 1]!;
      if (a === b || a !== pixels[(y + 1) * w + x + 1] || b !== pixels[(y + 1) * w + x]) continue;
      if (Math.abs(light[a]! - light[b]!) > SCENE_RULES.maxStep) n++;
    }
  }
  return n / ((w - 1) * (h - 1));
}

/** What one painted picture does against the rules of how a picture uses its palette. */
export function useFindings(bitmap: { width: number; height: number; pixels: Uint8Array }, palette: readonly number[], runs: Runs, dither: number = SCENE_RULES.coarseDither): string[] {
  const out: string[] = [];
  if (palette.length > 256) out.push(`the palette has ${palette.length} colours; a picture has 256 at most`);
  if (bitmap.pixels.some((p) => p >= palette.length)) out.push('a pixel has a colour outside the palette');
  const share = runShare(bitmap.pixels, runs);
  if (share < SCENE_RULES.runShare) out.push(`${(100 * share).toFixed(0)}% of the picture is painted from its runs; at least ${100 * SCENE_RULES.runShare}%`);
  const coarse = coarseDither(bitmap, palette);
  if (coarse > dither) out.push(`${(100 * coarse).toFixed(1)}% of the picture is a checkerboard of two far tones; at most ${100 * dither}% (make the run longer)`);
  return out;
}

/** The runs of which fewer than a `least` share of the colours are among `used` (the places a picture paints with at any hour). */
export function idleRuns(runs: Runs, used: ReadonlySet<number>, least: number): string[] {
  return Object.entries(runs)
    .map(([name, places]) => ({ name, n: places.filter((p) => used.has(p)).length, of: places.length }))
    .filter((r) => r.n === 0 || r.n < least * r.of)
    .map((r) => `${r.name}: ${r.n} of its ${r.of} colours are used`);
}

/**
 * A banded picture whose runs are all long has lost its bands: the finding, or nothing. `runs` are its runs as
 * colours, each dark to light.
 */
export function bandedFindings(runs: readonly (readonly number[])[]): string[] {
  const coarsest = Math.max(0, ...runs.filter((run) => run.length > 1).map((run) => runStats(run).maxStep));
  return coarsest > SCENE_RULES.maxStep + SCENE_RULES.stepSlack ? [] : [`a banded picture keeps short runs (tones over ${SCENE_RULES.maxStep} L* apart), or its computed light shades off smoothly and looks 3D; its coarsest step is ${coarsest.toFixed(1)}`];
}
