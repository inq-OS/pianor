/**
 * Cleaning a photo of a sheet before Audiveris reads it (ft_Y_04 slice 3, AC15). A phone photo of a school sheet fails
 * Audiveris in three ways: taken at an angle, the staff lines are further apart at one edge than at the other (its
 * SCALE step finds no evenly spaced lines) and the bar lines lean (the two staves of a system are not joined, so the
 * left hand is lost); the light falls off towards the corners; and the teacher's pencil (finger numbers, circles,
 * slashes) is read as notes and bar lines. The cleaning evens the light, keeps only what is as dark as printed ink
 * (pencil is lighter), finds the staves, follows their outer lines to their ends and maps those corners back to a
 * rectangle (a homography), at a size where a staff space is about 24 pixels, which Audiveris reads best.
 * Pure functions on grey pictures; the decoders are small FOSS libraries (jpeg-js, fast-png).
 */
import { convertIndexedToRgb, decode as decodePng, encode as encodePng } from 'fast-png';
import { decode as decodeJpeg } from 'jpeg-js';
import type { PhotoLayout, PhotoSystem } from '../../src/core/editor/photoOverlay';

/** A grey picture, one byte a pixel, 0 black to 255 white, row by row. */
export interface Gray {
  readonly width: number;
  readonly height: number;
  readonly data: Uint8Array;
}

export interface Point {
  readonly x: number;
  readonly y: number;
}

/** The staff space Audiveris reads best (it read 17 to 23 here, and failed at 36 to 49). */
export const TARGET_INTERLINE = 24;
/** Normalised to the paper around it, printed ink is near 0 and pencil 40 to 55 percent grey: keep what is darker. */
export const INK_LEVEL = 0.38;

export function blank(width: number, height: number, value = 255): Gray {
  return { width, height, data: new Uint8Array(width * height).fill(value) };
}

/** Grey from interleaved samples (1 or 2 channels: grey and alpha; 3 or 4: red, green, blue and alpha), see-through parts on white. */
export function grayOf(width: number, height: number, samples: ArrayLike<number>, channels: number, maxValue = 255): Gray {
  const data = new Uint8Array(width * height);
  const k = 255 / maxValue;
  for (let i = 0; i < data.length; i++) {
    const s = i * channels;
    const v = channels >= 3 ? 0.299 * (samples[s] ?? 0) + 0.587 * (samples[s + 1] ?? 0) + 0.114 * (samples[s + 2] ?? 0) : (samples[s] ?? 0);
    const alpha = channels === 2 || channels === 4 ? (samples[s + channels - 1] ?? maxValue) / maxValue : 1;
    data[i] = Math.round((v * alpha + maxValue * (1 - alpha)) * k);
  }
  return { width, height, data };
}

/** Samples of fewer than 8 bits packed in bytes, each row starting on a byte, spread to one number each. */
function unpack(width: number, height: number, packed: ArrayLike<number>, bits: number, channels: number): number[] {
  const perRow = Math.ceil((width * channels * bits) / 8);
  const out: number[] = [];
  const mask = (1 << bits) - 1;
  for (let y = 0; y < height; y++) {
    for (let i = 0; i < width * channels; i++) {
      const bit = i * bits;
      const byte = packed[y * perRow + (bit >> 3)] ?? 0;
      out.push((byte >> (8 - bits - (bit & 7))) & mask);
    }
  }
  return out;
}

export function decodePngGray(bytes: Uint8Array): Gray {
  const png = decodePng(bytes);
  if (png.palette) return grayOf(png.width, png.height, convertIndexedToRgb(png), png.palette[0]?.length ?? 3);
  const samples = png.depth < 8 ? unpack(png.width, png.height, png.data, png.depth, png.channels) : png.data;
  return grayOf(png.width, png.height, samples, png.channels, 2 ** png.depth - 1);
}

/** The EXIF orientation of a JPEG (1 upright, 3 upside down, 6 and 8 turned a quarter), 1 when it says none. */
export function exifOrientation(bytes: Uint8Array): number {
  let at = 2;
  while (at + 4 <= bytes.length && bytes[at] === 0xff) {
    const marker = bytes[at + 1];
    const size = ((bytes[at + 2] ?? 0) << 8) | (bytes[at + 3] ?? 0);
    if (marker === 0xe1 && String.fromCharCode(...bytes.subarray(at + 4, at + 8)) === 'Exif') return orientationIn(bytes.subarray(at + 10, at + 2 + size));
    if (marker === 0xda) break;
    at += 2 + size;
  }
  return 1;
}

function orientationIn(tiff: Uint8Array): number {
  const little = tiff[0] === 0x49;
  const u16 = (i: number): number => (little ? (tiff[i] ?? 0) | ((tiff[i + 1] ?? 0) << 8) : ((tiff[i] ?? 0) << 8) | (tiff[i + 1] ?? 0));
  const u32 = (i: number): number => (little ? u16(i) + u16(i + 2) * 65536 : u16(i) * 65536 + u16(i + 2));
  const ifd = u32(4);
  for (let n = 0; n < u16(ifd); n++) {
    const entry = ifd + 2 + n * 12;
    if (u16(entry) === 0x0112) return u16(entry + 8);
  }
  return 1;
}

/** Turns a picture upright by its EXIF orientation (mirrored ones, which cameras do not write, are left as they are). */
export function upright(img: Gray, orientation: number): Gray {
  if (orientation !== 3 && orientation !== 6 && orientation !== 8) return img;
  const { width: w, height: h } = img;
  const turned = orientation !== 3;
  const out = blank(turned ? h : w, turned ? w : h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const v = img.data[y * w + x] ?? 255;
      if (orientation === 3) out.data[(h - 1 - y) * w + (w - 1 - x)] = v;
      else if (orientation === 6) out.data[x * h + (h - 1 - y)] = v;
      else out.data[(w - 1 - x) * h + y] = v;
    }
  }
  return out;
}

export function decodeJpegGray(bytes: Uint8Array): Gray {
  const jpeg = decodeJpeg(bytes, { useTArray: true, formatAsRGBA: true, maxMemoryUsageInMB: 2048, maxResolutionInMP: 200 });
  return upright(grayOf(jpeg.width, jpeg.height, jpeg.data, 4), exifOrientation(bytes));
}

export function encodePngGray(img: Gray): Uint8Array {
  return encodePng({ width: img.width, height: img.height, data: img.data, channels: 1, depth: 8 });
}

/**
 * Evens the light: each pixel divided by the paper's brightness around it (the brightest pixel of its block, the
 * blocks smoothed and blended), so paper is white everywhere and ink keeps its darkness relative to the paper.
 */
export function evenLight(img: Gray, block = Math.max(16, Math.round(Math.min(img.width, img.height) / 40))): Gray {
  const { width: w, height: h } = img;
  const bw = Math.ceil(w / block);
  const bh = Math.ceil(h / block);
  const max = new Float64Array(bw * bh);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const b = Math.floor(y / block) * bw + Math.floor(x / block);
      max[b] = Math.max(max[b] ?? 0, img.data[y * w + x] ?? 0);
    }
  }
  const paper = new Float64Array(bw * bh);
  for (let by = 0; by < bh; by++) {
    for (let bx = 0; bx < bw; bx++) {
      // the brightest neighbour, so a block that is all ink (a beam, a dark title) takes the paper next to it
      let best = 0;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const x = bx + dx;
        const y = by + dy;
        if (x >= 0 && y >= 0 && x < bw && y < bh) best = Math.max(best, max[y * bw + x] ?? 0);
      }
      paper[by * bw + bx] = Math.max(best, 1);
    }
  }
  const at = (bx: number, by: number): number => paper[Math.min(bh - 1, Math.max(0, by)) * bw + Math.min(bw - 1, Math.max(0, bx))] ?? 255;
  const out = blank(w, h);
  for (let y = 0; y < h; y++) {
    const fy = (y + 0.5) / block - 0.5;
    const y0 = Math.floor(fy);
    const ty = fy - y0;
    for (let x = 0; x < w; x++) {
      const fx = (x + 0.5) / block - 0.5;
      const x0 = Math.floor(fx);
      const tx = fx - x0;
      const p = (at(x0, y0) * (1 - tx) + at(x0 + 1, y0) * tx) * (1 - ty) + (at(x0, y0 + 1) * (1 - tx) + at(x0 + 1, y0 + 1) * tx) * ty;
      out.data[y * w + x] = Math.min(255, Math.round((255 * (img.data[y * w + x] ?? 255)) / p));
    }
  }
  return out;
}

/**
 * The level that parts ink from paper in an evened picture: `INK_LEVEL` when the darkest ink is near black (print
 * against pencil), else halfway between the darkest ink and the paper, so a faint print or a light scan is kept whole.
 */
export function inkLevel(img: Gray): number {
  const counts = new Array<number>(256).fill(0);
  for (const v of img.data) counts[v] = (counts[v] ?? 0) + 1;
  let seen = 0;
  let darkest = 255;
  for (let v = 0; v < 256; v++) {
    seen += counts[v] ?? 0;
    if (seen >= img.data.length * 0.005) { darkest = v; break; }
  }
  return darkest < INK_LEVEL * 255 * 0.5 ? INK_LEVEL : (darkest + 255) / 2 / 255;
}

/** Black where the picture is darker than `level` of white, white elsewhere: drops pencil from an evened picture. */
export function inkOnly(img: Gray, level = INK_LEVEL): Gray {
  const cut = level * 255;
  return { width: img.width, height: img.height, data: img.data.map((v) => (v < cut ? 0 : 255)) };
}

function dark(img: Gray, x: number, y: number): boolean {
  return x >= 0 && y >= 0 && x < img.width && y < img.height && (img.data[y * img.width + x] ?? 255) < 128;
}

/** A staff found in a narrow upright band: the centres of its five lines, top first, and its staff space. */
export interface Staff {
  readonly x: number;
  /** How the lines fall to the right, rows a column (a page turned in the photo). */
  readonly slope: number;
  readonly lines: readonly number[];
  readonly interline: number;
}

interface Run {
  readonly centre: number;
  readonly thickness: number;
}

/** The dark rows of a band, joined into runs, each row falling by `slope` across it. A row is dark when much of the band is dark along it. */
function runsIn(img: Gray, x0: number, x1: number, slope: number): Run[] {
  const xc = (x0 + x1) / 2;
  const runs: Run[] = [];
  let start = -1;
  for (let y = 0; y <= img.height; y++) {
    let n = 0;
    if (y < img.height) for (let x = x0; x < x1; x++) if (dark(img, x, Math.round(y + slope * (x - xc)))) n++;
    const on = y < img.height && n >= 0.4 * (x1 - x0);
    if (on && start < 0) start = y;
    if (!on && start >= 0) {
      runs.push({ centre: (start + y - 1) / 2, thickness: y - start });
      start = -1;
    }
  }
  return runs;
}

/** Five evenly spaced thin runs starting at run `i`, or none. */
function staffFrom(runs: readonly Run[], i: number, maxSpace: number): number[] | undefined {
  const first = runs[i];
  if (!first) return undefined;
  for (let k = i + 1; k <= i + 4 && k < runs.length; k++) {
    const space = (runs[k]?.centre ?? 0) - first.centre;
    if (space < 6) continue;
    if (space > maxSpace) break;
    const lines = [first.centre];
    for (let m = 1; m <= 4; m++) {
      const want = first.centre + m * space;
      const hit = runs.find((r) => Math.abs(r.centre - want) <= Math.max(1.5, space * 0.15) && r.thickness <= space * 0.5);
      if (!hit) break;
      lines.push(hit.centre);
    }
    if (lines.length === 5 && first.thickness <= space * 0.5) return lines;
  }
  return undefined;
}

/** The staves crossing an upright band around column `x`, along rows falling by `slope`. */
export function stavesAt(img: Gray, x: number, slope = 0, half = Math.max(8, Math.round(img.width / 200))): Staff[] {
  const runs = runsIn(img, Math.max(0, x - half), Math.min(img.width, x + half), slope);
  const staves: Staff[] = [];
  for (let i = 0; i < runs.length; i++) {
    const lines = staffFrom(runs, i, img.height / 25);
    if (!lines) continue;
    staves.push({ x, slope, lines, interline: ((lines[4] ?? 0) - (lines[0] ?? 0)) / 4 });
    const last = lines[4] ?? 0;
    while (i + 1 < runs.length && (runs[i + 1]?.centre ?? 0) <= last) i++;
  }
  return staves;
}

/**
 * Follows a staff line from (x, y) to the left (`step` -1) or right (+1) until it ends (no ink for more than two staff
 * spaces), and gives the points on it. Where something thick covers the line (a note head, a bar line) the line is
 * carried on along its slope.
 */
export function traceLine(img: Gray, x: number, y: number, step: 1 | -1, interline: number, startSlope = 0): Point[] {
  const reach = Math.max(2, Math.round(interline * 0.15));
  const points: Point[] = [{ x, y }];
  let at = y;
  let slope = startSlope;
  let gap = 0;
  for (let cx = x + step; cx >= 0 && cx < img.width; cx += step) {
    const want = at + slope * step;
    const near = nearestDark(img, cx, want, reach);
    if (near === undefined) {
      if (++gap > 2 * interline) break;
      // one point a column, also across a break in the line, so a point is found by its column
      at = want;
      points.push({ x: cx, y: at });
      continue;
    }
    gap = 0;
    const [top, bottom] = runAround(img, cx, near);
    const next = bottom - top + 1 <= 2 * reach + 1 ? want * 0.7 + ((top + bottom) / 2) * 0.3 : want;
    slope = slope * 0.98 + (next - at) * step * 0.02;
    at = next;
    points.push({ x: cx, y: at });
  }
  // the line ends at its last ink, not where the search gave up
  return points.slice(0, points.length - Math.min(gap, points.length - 1));
}

function nearestDark(img: Gray, x: number, y: number, reach: number): number | undefined {
  const c = Math.round(y);
  for (let d = 0; d <= reach; d++) {
    if (dark(img, x, c - d)) return c - d;
    if (dark(img, x, c + d)) return c + d;
  }
  return undefined;
}

function runAround(img: Gray, x: number, y: number): [number, number] {
  let top = y;
  let bottom = y;
  while (dark(img, x, top - 1)) top--;
  while (dark(img, x, bottom + 1)) bottom++;
  return [top, bottom];
}

/** The homography taking each `from` point to the same `to` point, as 9 numbers row by row (the last 1). */
export function solveHomography(from: readonly Point[], to: readonly Point[]): number[] {
  const a: number[][] = [];
  for (let i = 0; i < 4; i++) {
    const { x, y } = from[i] ?? { x: 0, y: 0 };
    const { x: u, y: v } = to[i] ?? { x: 0, y: 0 };
    a.push([x, y, 1, 0, 0, 0, -u * x, -u * y, u]);
    a.push([0, 0, 0, x, y, 1, -v * x, -v * y, v]);
  }
  for (let c = 0; c < 8; c++) {
    let p = c;
    for (let r = c + 1; r < 8; r++) if (Math.abs(a[r]?.[c] ?? 0) > Math.abs(a[p]?.[c] ?? 0)) p = r;
    [a[c], a[p]] = [a[p] ?? [], a[c] ?? []];
    const row = a[c] ?? [];
    const lead = row[c] ?? 0;
    if (Math.abs(lead) < 1e-12) throw new Error('the four points do not make a quadrilateral');
    for (let r = 0; r < 8; r++) {
      if (r === c) continue;
      const other = a[r] ?? [];
      const k = (other[c] ?? 0) / lead;
      for (let j = c; j < 9; j++) other[j] = (other[j] ?? 0) - k * (row[j] ?? 0);
    }
  }
  return [...a.map((row, i) => (row[8] ?? 0) / (row[i] ?? 1)), 1];
}

export function mapPoint(h: readonly number[], p: Point): Point {
  const [a = 0, b = 0, c = 0, d = 0, e = 0, f = 0, g = 0, k = 0, l = 1] = h;
  const w = g * p.x + k * p.y + l;
  return { x: (a * p.x + b * p.y + c) / w, y: (d * p.x + e * p.y + f) / w };
}

function sample(img: Gray, x: number, y: number): number {
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const tx = x - x0;
  const ty = y - y0;
  const at = (xx: number, yy: number): number => (xx >= 0 && yy >= 0 && xx < img.width && yy < img.height ? (img.data[yy * img.width + xx] ?? 255) : 255);
  return (at(x0, y0) * (1 - tx) + at(x0 + 1, y0) * tx) * (1 - ty) + (at(x0, y0 + 1) * (1 - tx) + at(x0 + 1, y0 + 1) * tx) * ty;
}

/** A picture `width` by `height` whose pixel (x, y) is taken from `img` at `mapPoint(toSource, (x, y))`, four samples a pixel. */
export function warp(img: Gray, toSource: readonly number[], width: number, height: number): Gray {
  const out = blank(width, height);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let sum = 0;
      for (const [dx, dy] of [[0.25, 0.25], [0.75, 0.25], [0.25, 0.75], [0.75, 0.75]] as const) {
        const s = mapPoint(toSource, { x: x + dx, y: y + dy });
        sum += sample(img, s.x - 0.5, s.y - 0.5);
      }
      out.data[y * width + x] = Math.round(sum / 4);
    }
  }
  return out;
}

export interface TracedStaff {
  readonly staff: Staff;
  readonly top: Point[];
  readonly bottom: Point[];
  readonly left: number;
  readonly right: number;
}

function traceStaff(img: Gray, staff: Staff): TracedStaff {
  const line = (y: number): Point[] => [...traceLine(img, staff.x, y, -1, staff.interline, staff.slope).reverse(), ...traceLine(img, staff.x, y, 1, staff.interline, staff.slope).slice(1)];
  const top = line(staff.lines[0] ?? 0);
  const bottom = line(staff.lines[4] ?? 0);
  const left = Math.max(top[0]?.x ?? 0, bottom[0]?.x ?? 0);
  const right = Math.min(top.at(-1)?.x ?? 0, bottom.at(-1)?.x ?? 0);
  return { staff, top, bottom, left, right };
}

/**
 * Every staff in the picture, traced, top first. Narrow bands across the page each find the staves they cross
 * cleanly (a band through note heads misses some); a staff found again in another band is kept once.
 */
export function findStaves(img: Gray): TracedStaff[] {
  const turn = pageTurn(img);
  const found: Staff[] = [];
  for (let f = 0.5, n = 0; n < 15; n++, f = 0.5 + (n % 2 ? 1 : -1) * Math.ceil(n / 2) * 0.05) {
    // the bands try turns near the page's, as a photo's perspective turns the lines a little more at one side
    found.push(...mostStavesAt(img, Math.round(img.width * f), turns(turn - 2, turn + 2)));
  }
  // five evenly spaced runs that are no staff (a band along a bar line, lyrics) are seldom spaced like the real staves
  const usual = median(found.map((s) => s.interline));
  const topAt = (s: Staff, x: number): number => (s.lines[0] ?? 0) + s.slope * (x - s.x);
  const clusters: Staff[][] = [];
  for (const staff of found.filter((s) => Math.abs(s.interline - usual) <= 0.2 * usual)) {
    const near = clusters.find((c) => c[0] && Math.abs(topAt(c[0], staff.x) - (staff.lines[0] ?? 0)) < 3 * usual);
    if (near) near.push(staff);
    else clusters.push([staff]);
  }
  // a band can take a row of lyrics or a ledger line for a staff line, one line off: the bands vote for each staff
  const agree = (m: Staff, c: readonly Staff[]): number => c.filter((n) => Math.abs(topAt(n, m.x) - (m.lines[0] ?? 0)) < usual / 2).length;
  const kept = clusters.map((c) => traceStaff(img, settled(img, c.reduce((best, m) => (agree(m, c) > agree(best, c) ? m : best)))));
  const middle = (t: TracedStaff): number => t.top.reduce((sum, p) => sum + p.y, 0) / Math.max(1, t.top.length);
  return kept.sort((a, b) => middle(a) - middle(b));
}

/** How much of a long stretch of row `y` (falling by `slope`) around column `x` has ink within `reach` rows. */
function lineEvidence(img: Gray, x: number, y: number, slope: number, half: number, reach: number): number {
  let n = 0;
  let all = 0;
  for (let cx = Math.max(0, Math.round(x - half)); cx < Math.min(img.width, Math.round(x + half)); cx++) {
    all++;
    const cy = Math.round(y + slope * (cx - x));
    for (let d = -reach; d <= reach; d++) if (dark(img, cx, cy + d)) { n++; break; }
  }
  return all === 0 ? 0 : n / all;
}

/**
 * A staff moved a line up or down when that fits the picture better: a band may see a row of lyrics or a ledger line
 * as the top or bottom line. Real staff lines run long, so the five rows with the most ink along a stretch of ten staff
 * spaces either way win.
 */
function settled(img: Gray, staff: Staff): Staff {
  const space = staff.interline;
  const reach = Math.max(1, Math.round(space * 0.12));
  const score = (shift: number): number => {
    let sum = 0;
    for (let k = 0; k < 5; k++) sum += lineEvidence(img, staff.x, (staff.lines[0] ?? 0) + (k + shift) * space, staff.slope, 10 * space, reach);
    return sum;
  };
  const best = [0, -1, 1].reduce((a, b) => (score(b) > score(a) ? b : a));
  return best === 0 ? staff : { ...staff, lines: staff.lines.map((_, k) => (staff.lines[0] ?? 0) + (k + best) * space) };
}

function median(values: readonly number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)] ?? 0;
}

/** How far a page may be turned in the photo, in degrees, and still be found and straightened. */
export const MAX_TURN = 15;

/**
 * How far the page is turned in the picture, in whole degrees up to MAX_TURN: the turn along which the rows of the
 * middle of the picture are most unequal in ink (staff lines lie along the rows then, the classic deskew measure).
 */
export function pageTurn(img: Gray): number {
  let best = 0;
  let bestScore = -1;
  const x0 = Math.round(img.width * 0.25);
  const x1 = Math.round(img.width * 0.75);
  const xc = img.width / 2;
  const every = Math.max(1, Math.round(img.width / 1000));
  for (const d of turns(-MAX_TURN, MAX_TURN)) {
    const slope = Math.tan((d * Math.PI) / 180);
    let score = 0;
    for (let y = 0; y < img.height; y++) {
      let n = 0;
      for (let x = x0; x < x1; x += every) if (dark(img, x, Math.round(y + slope * (x - xc)))) n++;
      score += n * n;
    }
    if (score > bestScore) { best = d; bestScore = score; }
  }
  return best;
}

/** Whole degrees from `from` to `to`, the smallest turn first. */
function turns(from: number, to: number): number[] {
  const out: number[] = [];
  for (let d = from; d <= to; d++) out.push(d);
  return out.sort((a, b) => Math.abs(a) - Math.abs(b));
}

function mostStavesAt(img: Gray, x: number, degrees: readonly number[]): Staff[] {
  let best: Staff[] = [];
  for (const d of degrees) {
    const found = stavesAt(img, x, Math.tan((d * Math.PI) / 180));
    if (found.length > best.length) best = found;
  }
  return best;
}

/** Least squares a and b of a = slope, b = offset for v = a * u + b. */
function fit(points: readonly (readonly [number, number])[]): [number, number] {
  const n = points.length;
  let su = 0, sv = 0, suu = 0, suv = 0;
  for (const [u, v] of points) { su += u; sv += v; suu += u * u; suv += u * v; }
  const den = n * suu - su * su;
  const a = Math.abs(den) < 1e-9 ? 0 : (n * suv - su * sv) / den;
  return [a, (sv - a * su) / n];
}

/** Where x = a*y + b meets y = m*x + c. */
function meet([a, b]: [number, number], [m, c]: [number, number]): Point {
  const y = (m * b + c) / (1 - m * a);
  return { x: a * y + b, y };
}

const dist = (p: Point, q: Point): number => Math.hypot(p.x - q.x, p.y - q.y);

/**
 * The four corners of the block of full-length staves (an indented first staff or a short last one is left out):
 * the left and right edges fitted through the ends of their outer lines, the top edge along the first staff's top
 * line, the bottom edge along the last staff's bottom line. Undefined when no staff is found.
 */
export function staffCorners(traced: readonly TracedStaff[]): [Point, Point, Point, Point] | undefined {
  const longest = Math.max(0, ...traced.map((t) => t.right - t.left));
  const full = traced.filter((t) => t.right - t.left >= 0.9 * longest && longest > 8 * t.staff.interline);
  const first = full[0];
  const last = full.at(-1);
  if (!first || !last) return undefined;
  const ends = (pick: (line: Point[]) => Point | undefined): [number, number][] =>
    full.flatMap((t) => [pick(t.top), pick(t.bottom)]).filter((p): p is Point => p !== undefined).map((p) => [p.y, p.x]);
  const leftEdge = fit(ends((line) => line[0]));
  const rightEdge = fit(ends((line) => line.at(-1)));
  const topEdge = fit(first.top.map((p) => [p.x, p.y]));
  const bottomEdge = fit(last.bottom.map((p) => [p.x, p.y]));
  return [meet(leftEdge, topEdge), meet(rightEdge, topEdge), meet(rightEdge, bottomEdge), meet(leftEdge, bottomEdge)];
}

/** Why four corners cannot be a page of staves seen in a photo, or undefined when they can. */
export function implausible(corners: readonly Point[], scale: number, area: number): string | undefined {
  if (!corners.every((p) => Number.isFinite(p.x) && Number.isFinite(p.y))) return 'the edges of the staves did not meet';
  const turn = (i: number): number => {
    const [p, q, r] = [corners[i], corners[(i + 1) % 4], corners[(i + 2) % 4]].map((c) => c ?? { x: 0, y: 0 }) as [Point, Point, Point];
    return (q.x - p.x) * (r.y - q.y) - (q.y - p.y) * (r.x - q.x);
  };
  if (![0, 1, 2, 3].every((i) => turn(i) > 0)) return 'the corners of the staves are not a four-sided shape';
  const [tl, tr, , bl] = corners as [Point, Point, Point, Point];
  const level = (Math.abs(Math.atan2(tr.y - tl.y, tr.x - tl.x)) * 180) / Math.PI;
  const upright = (Math.abs(Math.atan2(bl.x - tl.x, bl.y - tl.y)) * 180) / Math.PI;
  if (level > MAX_TURN || upright > MAX_TURN) return `the staves are turned more than ${MAX_TURN} degrees`;
  if (scale < 0.25 || scale > 4) return 'the staff space is too far from what Audiveris reads';
  if (area > 40e6) return 'the straightened picture would be too big';
  return undefined;
}

export interface Cleaned {
  readonly image: Gray;
  /** What was done, for the person. */
  readonly note: string;
  /** False when no staves were found or they could not be straightened: then the picture should not replace the photo. */
  readonly straightened: boolean;
  /** The staves in the straightened picture, top first (none when it was not straightened). */
  readonly staves: readonly LevelStaff[];
}

/** A staff of the straightened picture: its top and bottom line's rows, where it starts and ends, its staff space. */
export interface LevelStaff {
  readonly top: number;
  readonly bottom: number;
  readonly left: number;
  readonly right: number;
  readonly interline: number;
}

/** Straightens an ink picture so its staves are level, of even spacing and their bar lines upright, sized for Audiveris. */
export function straighten(img: Gray): Cleaned {
  const traced = findStaves(img);
  const corners = staffCorners(traced);
  if (!corners) return { image: img, note: `no staff found (the lines too faint, or the page turned more than ${MAX_TURN} degrees)`, straightened: false, staves: [] };
  const [tl, tr, br, bl] = corners;
  const staves = traced.map((t) => t.staff);
  const interline = median(staves.map((s) => s.interline));
  const scale = TARGET_INTERLINE / interline;
  const width = ((dist(tl, tr) + dist(bl, br)) / 2) * scale;
  const height = ((dist(tl, bl) + dist(tr, br)) / 2) * scale;
  const early = implausible(corners, scale, width * height);
  if (early) return { image: img, note: `${staves.length} staves found, but ${early}`, straightened: false, staves: [] };
  const rect: Point[] = [{ x: 0, y: 0 }, { x: width, y: 0 }, { x: width, y: height }, { x: 0, y: height }];
  const toRect = solveHomography([tl, tr, br, bl], rect);
  // the output holds every staff found and some room around them for ledger lines, clefs and the brace
  const all = traced.flatMap((t) => [t.top[0], t.top.at(-1), t.bottom[0], t.bottom.at(-1)]).filter((p): p is Point => p !== undefined).map((p) => mapPoint(toRect, p));
  const room = TARGET_INTERLINE * 6;
  const x0 = Math.min(0, ...all.map((p) => p.x)) - room / 2;
  const x1 = Math.max(width, ...all.map((p) => p.x)) + room / 2;
  const y0 = Math.min(0, ...all.map((p) => p.y)) - room;
  const y1 = Math.max(height, ...all.map((p) => p.y)) + room;
  const late = implausible(corners, scale, (x1 - x0) * (y1 - y0));
  if (late) return { image: img, note: `${staves.length} staves found, but ${late}`, straightened: false, staves: [] };
  const out = rect.map((p) => ({ x: p.x - x0, y: p.y - y0 }));
  const toSource = solveHomography(out, [tl, tr, br, bl]);
  const image = warp(img, toSource, Math.round(x1 - x0), Math.round(y1 - y0));
  const toOut = (p: Point): Point => {
    const q = mapPoint(toRect, p);
    return { x: q.x - x0, y: q.y - y0 };
  };
  // a line's trace can stop short of its end (a break, a faint stretch): a staff reaches as far as its longer outer line
  const level = traced.map((t) => {
    const ends = [t.top[0], t.top.at(-1), t.bottom[0], t.bottom.at(-1)].filter((p): p is Point => p !== undefined).map(toOut);
    // the rows from where the staff was found, which is sure; a trace's end may have wandered
    const top = toOut({ x: t.staff.x, y: t.staff.lines[0] ?? 0 }).y;
    const bottom = toOut({ x: t.staff.x, y: t.staff.lines[4] ?? 0 }).y;
    return { top, bottom, left: Math.min(...ends.map((p) => p.x)), right: Math.max(...ends.map((p) => p.x)), interline: t.staff.interline * scale };
  });
  return { image, note: `${staves.length} staves found, straightened to a staff space of ${TARGET_INTERLINE} pixels (it was ${interline.toFixed(0)})`, straightened: true, staves: level };
}

/** The whole cleaning: even light, keep the ink (pencil drops out), straighten. */
export function cleanSheet(img: Gray): Cleaned {
  const even = evenLight(img);
  return straighten(inkOnly(even, inkLevel(even)));
}

/**
 * The cleaned picture of a JPEG or PNG file as PNG bytes and a line on what was done; no bytes when it could not be
 * straightened (Audiveris then reads the photo as it is, never a cleaning that may have lost the music); undefined for
 * other files (a PDF, a TIFF), which go to Audiveris as they are.
 */
export function cleanImageFile(name: string, bytes: Uint8Array): { png?: Uint8Array; note: string; result: Cleaned } | undefined {
  const ext = name.toLowerCase().slice(name.lastIndexOf('.'));
  const read = ext === '.png' ? decodePngGray : ext === '.jpg' || ext === '.jpeg' ? decodeJpegGray : undefined;
  if (!read) return undefined;
  const result = cleanSheet(read(bytes));
  return result.straightened ? { png: encodePngGray(result.image), note: result.note, result } : { note: result.note, result };
}

/** The columns where a staff has a bar line: ink (anything not near white, the picture is smoothed) over its whole height, thinner than half a staff space. */
function barLinesOf(img: Gray, staff: LevelStaff): number[] {
  const lines: number[] = [];
  const top = Math.round(staff.top) - 1;
  const bottom = Math.round(staff.bottom) + 1;
  const ink = (x: number, y: number): boolean => x >= 0 && y >= 0 && x < img.width && y < img.height && (img.data[y * img.width + x] ?? 255) < 200;
  let start = -1;
  const x0 = Math.max(0, Math.floor(staff.left));
  const x1 = Math.min(img.width - 1, Math.ceil(staff.right));
  for (let x = x0; x <= x1 + 1; x++) {
    let n = 0;
    // a column and its neighbours: a line leaning by a pixel over the staff's height still counts
    if (x <= x1) for (let y = top; y <= bottom; y++) if (ink(x - 1, y) || ink(x, y) || ink(x + 1, y)) n++;
    const full = x <= x1 && n >= 0.9 * (bottom - top + 1);
    if (full && start < 0) start = x;
    if (!full && start >= 0) {
      if (x - start <= Math.max(4, staff.interline * 0.6)) lines.push((start + x - 1) / 2);
      start = -1;
    }
  }
  return lines;
}

/**
 * The staves and bars of a straightened picture, `stavesPerSystem` staves a system (2 for a piece in both hands). A bar
 * line counts where every staff of the system has one (a stem never runs the height of two staves); lines at the ends
 * of the staves and the pair of a double bar line make no bar of their own.
 */
export function photoLayout(img: Gray, staves: readonly LevelStaff[], stavesPerSystem: number): PhotoLayout {
  const systems: PhotoSystem[] = [];
  for (let i = 0; i + stavesPerSystem <= staves.length; i += stavesPerSystem) {
    const group = staves.slice(i, i + stavesPerSystem);
    const space = median(group.map((t) => t.interline));
    const left = Math.max(...group.map((t) => t.left));
    const right = Math.min(...group.map((t) => t.right));
    const each = group.map((t) => barLinesOf(img, t));
    const shared = (each[0] ?? []).filter((x) => each.every((lines) => lines.some((other) => Math.abs(other - x) <= space / 2)));
    const edges = [left, ...shared.filter((x) => x > left + space && x < right - space), right];
    const bars: { x1: number; x2: number }[] = [];
    for (let k = 1; k < edges.length; k++) {
      const x1 = edges[k - 1] ?? 0;
      const x2 = edges[k] ?? 0;
      if (x2 - x1 >= 1.5 * space) bars.push({ x1, x2 });
    }
    systems.push({ staves: group.map((t) => ({ top: t.top, bottom: t.bottom })), bars });
  }
  return { width: img.width, height: img.height, systems };
}
