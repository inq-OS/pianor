import { createBitmap, type Bitmap } from '../bitmap';

/**
 * The clouds of Keri's pictures (d111), drawn from a clean sheet after the skies of The Curse of Monkey Island
 * (1997), whose painter, Bill Tiller, wrote that he "exaggerated the wispy quality of the clouds by making them into wavy curly-Q's". What
 * those skies show, and what this file keeps to:
 *
 * - a cloud is one stroke of a full brush: a fine point where the brush touched down, a long bent streamer that
 *   fattens as it goes, and a round head where the stroke rolls up into itself;
 * - the head is solid. Its curl is a soft line drawn inside it, never a coil with sky between its turns;
 * - no dark outline: the cloud's rim is where it meets the sky. It is pale on top and shaded underneath, in flat tones;
 * - more curls may rise from a cloud's back like waves about to break, and a fat cloud is a heap of them;
 * - every cloud of a picture is its own spec, a few big fat ones behind long thin ones, and all lead one way: the wind's.
 *
 * It is the approach that is taken, never the art: each cloud here is computed from its spec.
 */

/** A curl on a cloud's back: where along the stroke it rises (0 tail, 1 head), its radius and how far its line winds. */
export interface Curl {
  at: number;
  size: number;
  /** Turns of the stroke that rolls up (1.2 to 2); the more, the longer the line inside. */
  turns?: number;
  /** It breaks forward, with the wind, instead of rolling back over the tail. */
  forward?: boolean;
}

export interface CurlSpec {
  /** The stroke's length from its tail's point to where the head begins, in pixels. */
  length: number;
  /** Its greatest thickness, and where along it that is (0 tail, 1 head). */
  girth: number;
  belly: number;
  /** Its thickness where the head begins, as a share of the girth. */
  neck: number;
  /** How the tail fattens: 1 an even point, above 1 a long whip, below 1 a blunt end. */
  taper?: number;
  /** The stroke's wave: its height in pixels, how many half waves it makes, and where in the wave it starts (0 to 2). */
  bend: number;
  wave: number;
  phase: number;
  /** How many pixels the head's end lies above the tail's. */
  rise?: number;
  /** The head the stroke rolls up into: its radius and turns; `down` rolls it under. Without one both ends are points. */
  head?: { size: number; turns: number; down?: boolean };
  curls?: readonly Curl[];
}

/** A cloud's tones: its lit top, its body, its shaded underside, and the soft line of a curl where it lies in shade. 0 is clear. */
export const CLOUD_TONES = { pale: 1, light: 2, shade: 3, line: 4 } as const;

/** Spacing of the brush's stamps along a stroke, in pixels. */
const STEP = 0.4;
/** The share of a roll's radius where its stroke ends. */
const ROLL_END = 0.12;
/** How far a stroke leans into its roll before it winds, in the roll's radii. */
const LEAD = 1.2;
/** A roll is flattened across its stroke's way to this share: clouds lie along the wind. */
const FLAT = 0.8;
/** The shares of a part's height that are lit and shaded. */
const LIT = 0.2, SHADED = 0.3;

/** A stamp of the brush: a filled disc. */
interface Dot { x: number; y: number; d: number }
type Point = readonly [number, number];
/** A part of the cloud that is lit on its own: its stamps, and the line of its curl. */
interface Part { dots: Dot[]; seam: Point[] }

const smooth = (u: number): number => (u <= 0 ? 0 : u >= 1 ? 1 : u * u * (3 - 2 * u));

/**
 * A stroke that rolls up: from (`x`, `y`), heading along the angle `heading`, it first leans into its turn (its bend
 * tightens over `LEAD` radii, so a head grows out of its streamer and does not sit on it like a ball on a string) and
 * then winds `turns` round a middle on its `side` (-1 the left of its way, which is up for a stroke going right). It
 * begins `thick` wide and comes to the width at which its turns close on one another, so the roll is solid; `seam` is
 * where one turn lies on the last, the curl's line.
 */
function roll(x0: number, y0: number, heading0: number, side: number, size: number, turns: number, thick: number): Part {
  const pitch = (1 - ROLL_END) / turns;
  // the middle line's first radius, so that the roll's rim is `size` from its middle
  const radius = size / (1 + pitch / 2), band = radius * pitch + 1;
  // worked out along the stroke's own way (x along it, y across it), then flattened and turned into place
  const dots: Dot[] = [], seam: Point[] = [];
  let x = 0, y = 0, heading = 0;
  const lead = Math.ceil((LEAD * radius) / STEP);
  for (let i = 0; i < lead; i++) {
    heading += side * ((i + 0.5) / lead) * (STEP / radius);
    x += Math.cos(heading) * STEP;
    y += Math.sin(heading) * STEP;
    dots.push({ x, y, d: thick });
  }
  const cx = x + radius * Math.cos(heading + side * Math.PI / 2), cy = y + radius * Math.sin(heading + side * Math.PI / 2);
  const a0 = heading - side * Math.PI / 2, sweep = 2 * Math.PI * turns;
  const steps = Math.ceil((sweep * radius) / STEP);
  for (let i = 0; i <= steps; i++) {
    const t = i / steps, r = radius * (1 - (1 - ROLL_END) * t), a = a0 + side * sweep * t;
    const d = thick + (band - thick) * smooth((t * turns) / 0.4);
    dots.push({ x: cx + r * Math.cos(a), y: cy + r * Math.sin(a), d });
    if (t * turns > 0.5) seam.push([cx + (r + d / 2 - 0.5) * Math.cos(a), cy + (r + d / 2 - 0.5) * Math.sin(a)]);
  }
  const cos = Math.cos(heading0), sin = Math.sin(heading0);
  const place = (px: number, py: number): Point => [x0 + px * cos - py * FLAT * sin, y0 + px * sin + py * FLAT * cos];
  return {
    dots: dots.map((p) => { const [px, py] = place(p.x, p.y); return { x: px, y: py, d: p.d }; }),
    seam: seam.map(([px, py]) => place(px, py)),
  };
}

/** The cloud's parts in its own coordinates (the tail's point at 0, 0; the head to the right), back to front. */
function parts(spec: CurlSpec): Part[] {
  const taper = spec.taper ?? 1, rise = spec.rise ?? 0;
  const wave = (u: number): number => spec.bend * Math.sin(Math.PI * (spec.wave * u + spec.phase));
  const yAt = (u: number): number => wave(u) - wave(0) - rise * smooth(u);
  const end = spec.head ? spec.neck : 0;
  const thickAt = (u: number): number => {
    const swell = u < spec.belly ? Math.pow(u / spec.belly, taper) : 1 - (1 - end) * Math.pow((u - spec.belly) / (1 - spec.belly), spec.head ? 2 : 1 / taper);
    return Math.max(1, spec.girth * swell);
  };
  const headingAt = (u: number): number => Math.atan2(yAt(Math.min(1, u + 0.01)) - yAt(Math.max(0, u - 0.01)), spec.length * (Math.min(1, u + 0.01) - Math.max(0, u - 0.01)));
  const body: Part = { dots: [], seam: [] };
  const steps = Math.ceil(spec.length / STEP);
  for (let i = 0; i <= steps; i++) {
    const u = i / steps;
    body.dots.push({ x: u * spec.length, y: yAt(u), d: thickAt(u) });
  }
  if (spec.head) {
    const head = roll(spec.length, yAt(1), headingAt(1), spec.head.down ? 1 : -1, spec.head.size, spec.head.turns, thickAt(1));
    body.dots.push(...head.dots);
    body.seam.push(...head.seam);
  }
  // the curls on its back rise out of the stroke: each starts inside it, as thick as the stroke is there
  const curls = (spec.curls ?? []).map((curl) => {
    const thick = Math.min(thickAt(curl.at), curl.size * 0.8);
    const lift = (thickAt(curl.at) - thick) / 2;
    return curl.forward
      ? roll(curl.at * spec.length, yAt(curl.at) - lift, headingAt(curl.at) + Math.PI, 1, curl.size, curl.turns ?? 1.5, thick)
      : roll(curl.at * spec.length, yAt(curl.at) - lift, headingAt(curl.at), -1, curl.size, curl.turns ?? 1.5, thick);
  });
  return [body, ...curls];
}

/** One step into the shade. */
const darker = (tone: number): number => (tone === CLOUD_TONES.pale || tone === CLOUD_TONES.light ? CLOUD_TONES.shade : CLOUD_TONES.line);

/** The stamps of a part filled into a grid `w` wide whose corner is at (`x0`, `y0`). */
function fill(dots: readonly Dot[], w: number, h: number, x0: number, y0: number): Uint8Array {
  const mask = new Uint8Array(w * h);
  for (const { x, y, d } of dots) {
    const r = d / 2, r2 = r * r + 1e-9;
    for (let j = Math.max(0, Math.floor(y - r - y0)); j <= Math.min(h - 1, Math.ceil(y + r - y0)); j++) for (let i = Math.max(0, Math.floor(x - r - x0)); i <= Math.min(w - 1, Math.ceil(x + r - x0)); i++) {
      const dx = x0 + i + 0.5 - x, dy = y0 + j + 0.5 - y;
      if (dx * dx + dy * dy <= r2) mask[j * w + i] = 1;
    }
  }
  return mask;
}

/** The cloud so far, in tones, on a grid `w` wide whose corner is at (`x0`, `y0`). */
interface Sheet { tones: Uint8Array; w: number; h: number; x0: number; y0: number }

/** One part laid on the cloud so far: its shade on what lies behind its rim, its own light, and its curl's line. */
function lay(sheet: Sheet, part: Part): void {
  const { tones, w, h, x0, y0 } = sheet;
  const mask = fill(part.dots, w, h, x0, y0);
  const has = (x: number, y: number): boolean => x >= 0 && y >= 0 && x < w && y < h && mask[y * w + x] === 1;
  const rim = (x: number, y: number): boolean => has(x - 1, y) || has(x + 1, y) || has(x, y - 1) || has(x, y + 1);
  // a part in front leaves a line of shade on what lies behind its rim (but not on the cloud's own lit top)
  for (let y = 1; y < h; y++) for (let x = 0; x < w; x++) {
    const behind = !has(x, y) && tones[y * w + x] !== 0 && (tones[(y - 1) * w + x] !== 0 || has(x, y - 1));
    if (behind && rim(x, y)) tones[y * w + x] = darker(tones[y * w + x]!);
  }
  // lit from above, down each column: pale under its top, shaded over its foot
  for (let x = 0; x < w; x++) {
    let top = -1, foot = -1;
    for (let y = 0; y < h; y++) if (mask[y * w + x]) { if (top < 0) top = y; foot = y; }
    if (top < 0) continue;
    const tall = foot - top + 1, lit = Math.max(1, Math.round(tall * LIT)), shaded = tall < 3 ? 0 : Math.max(1, Math.round(tall * SHADED));
    for (let y = top; y <= foot; y++) if (mask[y * w + x]) tones[y * w + x] = y - top < lit ? CLOUD_TONES.pale : foot - y < shaded ? CLOUD_TONES.shade : CLOUD_TONES.light;
  }
  // the curl's line, where it lies well inside the part
  const lined = new Set<number>();
  for (const [sx, sy] of part.seam) {
    const x = Math.floor(sx - x0), y = Math.floor(sy - y0);
    if (has(x, y) && has(x - 1, y) && has(x + 1, y) && has(x, y - 1) && has(x, y + 1)) lined.add(y * w + x);
  }
  for (const at of lined) tones[at] = darker(tones[at]!);
}

/**
 * A cloud in tones (`CLOUD_TONES`), for a painter to colour. Its parts are laid on back to front, each lit from above
 * on its own (pale along its top, shaded along its underside), a part in front leaving a line of shade on the one
 * behind, and each curl's line drawn inside its roll. The head leads where the wind blows: to the right, or to the
 * left with `leadsLeft`.
 */
/** A cloud from `curlCloud` in a picture's colours: `tones` are the palette places of its tones (`CLOUD_TONES`), pale to the curl's line. */
export function tintedCloud(spec: CurlSpec, leadsLeft: boolean, tones: readonly number[]): Bitmap {
  const b = curlCloud(spec, leadsLeft);
  b.pixels.forEach((t, i) => { if (t) b.pixels[i] = tones[t - 1]!; });
  return b;
}

export function curlCloud(spec: CurlSpec, leadsLeft = false): Bitmap {
  const all = parts(spec), dots = all.flatMap((p) => p.dots);
  const x0 = Math.floor(Math.min(...dots.map((p) => p.x - p.d / 2))), y0 = Math.floor(Math.min(...dots.map((p) => p.y - p.d / 2)));
  const w = Math.ceil(Math.max(...dots.map((p) => p.x + p.d / 2))) - x0, h = Math.ceil(Math.max(...dots.map((p) => p.y + p.d / 2))) - y0;
  const sheet: Sheet = { tones: new Uint8Array(w * h), w, h, x0, y0 };
  for (const part of all) lay(sheet, part);
  const out = createBitmap(w, h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) out.pixels[y * w + (leadsLeft ? w - 1 - x : x)] = sheet.tones[y * w + x]!;
  return out;
}
