import { inflateSync } from 'node:zlib';
import { rgbPng } from './png.ts';

/**
 * What a change to a picture did, small enough for a painter to look at cheaply (`npm run art:diff`, the `paint-a-scene`
 * skill): the pixels that changed, boxed, and one sheet of before, after and the changed pixels cropped round them. A
 * picture an agent opens costs tokens by its size on the screen it is shown on; pixel art loses nothing at 1x, so the
 * sheets are never zoomed past what shows single pixels.
 */

/** A picture as 24-bit colour, row by row: what the art tools write as PNG. */
export interface RgbPicture {
  width: number;
  height: number;
  rgb: Uint8Array;
}

export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

const SIGNATURE = [137, 80, 78, 71, 13, 10, 26, 10];
const GAP = 4;
const BACKDROP = 0x282220;
const MARK = 0xff00ff;
/** Wider than this a sheet is not shown side by side: the model would shrink it. */
const MAX_WIDTH = 1280;
/** Margin of unchanged pixels round a change, so it is seen in its place. */
const MARGIN = 8;

/** The picture as the bytes of a 24-bit PNG file. */
export function rgbPngBytes(p: RgbPicture): Uint8Array {
  const raw = new Uint8Array(p.height * (1 + p.width * 3));
  for (let y = 0; y < p.height; y++) raw.set(p.rgb.subarray(y * p.width * 3, (y + 1) * p.width * 3), y * (1 + p.width * 3) + 1);
  return rgbPng(p.width, p.height, raw);
}

/**
 * Reads a PNG file as the art tools write it (`pngBytes`, `rgbPngBytes`): 24-bit colour, no interlace, every row
 * unfiltered. Anything else is refused rather than read wrong.
 */
export function readPng(bytes: Uint8Array): RgbPicture {
  if (SIGNATURE.some((b, i) => bytes[i] !== b)) throw new Error('not a PNG file');
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let width = 0, height = 0;
  const data: Uint8Array[] = [];
  for (let at = 8; at < bytes.length;) {
    const length = view.getUint32(at);
    const type = String.fromCharCode(...bytes.subarray(at + 4, at + 8));
    const body = bytes.subarray(at + 8, at + 8 + length);
    if (type === 'IHDR') {
      width = view.getUint32(at + 8);
      height = view.getUint32(at + 12);
      if (body[8] !== 8 || body[9] !== 2 || body[12] !== 0) throw new Error('only 24-bit, non-interlaced PNG files from the art tools are read');
    } else if (type === 'IDAT') data.push(body);
    at += 12 + length;
  }
  const raw = inflateSync(Buffer.concat(data));
  const rgb = new Uint8Array(width * height * 3);
  for (let y = 0; y < height; y++) {
    const row = y * (1 + width * 3);
    if (raw[row] !== 0) throw new Error(`row ${y} is filtered; only the art tools' unfiltered PNG files are read`);
    rgb.set(raw.subarray(row + 1, row + 1 + width * 3), y * width * 3);
  }
  return { width, height, rgb };
}

/** How many pixels changed, their share of the picture and the box round them. A changed size changes everything. */
export function changeOf(before: RgbPicture, after: RgbPicture): { changed: number; share: number; box: Box | undefined } {
  if (before.width !== after.width || before.height !== after.height) {
    return { changed: after.width * after.height, share: 1, box: { x: 0, y: 0, w: after.width, h: after.height } };
  }
  let changed = 0, x0 = Infinity, y0 = Infinity, x1 = -1, y1 = -1;
  for (let y = 0; y < after.height; y++) {
    for (let x = 0; x < after.width; x++) {
      const i = (y * after.width + x) * 3;
      if (before.rgb[i] === after.rgb[i] && before.rgb[i + 1] === after.rgb[i + 1] && before.rgb[i + 2] === after.rgb[i + 2]) continue;
      changed++;
      x0 = Math.min(x0, x);
      y0 = Math.min(y0, y);
      x1 = Math.max(x1, x);
      y1 = Math.max(y1, y);
    }
  }
  const box = changed ? { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 } : undefined;
  return { changed, share: changed / (after.width * after.height), box };
}

function blank(width: number, height: number): RgbPicture {
  const p = { width, height, rgb: new Uint8Array(width * height * 3) };
  for (let i = 0; i < width * height; i++) p.rgb.set([BACKDROP >> 16, (BACKDROP >> 8) & 255, BACKDROP & 255], i * 3);
  return p;
}

/** Copies the `box` of `from` into `to` at x, y, each pixel `zoom` large, through `tint` when given. */
function lay(to: RgbPicture, from: RgbPicture, box: Box, x: number, y: number, zoom: number, tint?: (sx: number, sy: number, c: [number, number, number]) => [number, number, number]): void {
  for (let sy = 0; sy < box.h; sy++) {
    for (let sx = 0; sx < box.w; sx++) {
      const fx = box.x + sx, fy = box.y + sy;
      const inside = fx < from.width && fy < from.height;
      const i = (fy * from.width + fx) * 3;
      let c: [number, number, number] = inside ? [from.rgb[i]!, from.rgb[i + 1]!, from.rgb[i + 2]!] : [BACKDROP >> 16, (BACKDROP >> 8) & 255, BACKDROP & 255];
      if (tint && inside) c = tint(fx, fy, c);
      for (let dy = 0; dy < zoom; dy++) for (let dx = 0; dx < zoom; dx++) to.rgb.set(c, ((y + sy * zoom + dy) * to.width + x + sx * zoom + dx) * 3);
    }
  }
}

export interface DiffRow {
  before: RgbPicture;
  after: RgbPicture;
  box: Box;
}

/**
 * One sheet, one row per changed hour: the change before, after, and the after dimmed with the changed pixels in
 * magenta, cropped to the change with a margin and zoomed up to 4x while the sheet stays about a screen, so a small
 * change shows its single pixels in a few hundred tokens. Tiles that would make the sheet wider than a screen stack instead.
 */
export function diffSheet(rows: readonly DiffRow[]): RgbPicture {
  const tiles = rows.map(({ before, after, box }) => {
    const x = Math.max(0, box.x - MARGIN), y = Math.max(0, box.y - MARGIN);
    const crop = { x, y, w: Math.min(Math.max(before.width, after.width), box.x + box.w + MARGIN) - x, h: Math.min(Math.max(before.height, after.height), box.y + box.h + MARGIN) - y };
    const zoom = Math.max(1, Math.min(4, Math.floor(420 / crop.w), Math.floor(720 / (rows.length * crop.h))));
    const tw = crop.w * zoom, th = crop.h * zoom;
    const side = GAP + 3 * (tw + GAP) <= MAX_WIDTH;
    return { before, after, crop, zoom, tw, th, side, w: side ? 3 * (tw + GAP) : tw + GAP, h: side ? th + GAP : 3 * (th + GAP) };
  });
  const sheet = blank(GAP + Math.max(...tiles.map((t) => t.w)), GAP + tiles.reduce((s, t) => s + t.h, 0));
  let top = GAP;
  for (const t of tiles) {
    const step = t.side ? [t.tw + GAP, 0] : [0, t.th + GAP];
    const same = t.before.width === t.after.width && t.before.height === t.after.height;
    lay(sheet, t.before, t.crop, GAP, top, t.zoom);
    lay(sheet, t.after, t.crop, GAP + step[0]!, top + step[1]!, t.zoom);
    lay(sheet, t.after, t.crop, GAP + 2 * step[0]!, top + 2 * step[1]!, t.zoom, (fx, fy, c) => {
      const i = (fy * t.after.width + fx) * 3;
      const moved = !same || t.before.rgb[i] !== c[0] || t.before.rgb[i + 1] !== c[1] || t.before.rgb[i + 2] !== c[2];
      if (moved) return [MARK >> 16, (MARK >> 8) & 255, MARK & 255];
      const grey = Math.round((c[0] + c[1] + c[2]) / 3 * 0.35);
      return [grey, grey, grey];
    });
    top += t.h;
  }
  return sheet;
}

/** Up to four pictures (a picture's hours) on one sheet at 1x, two by two. */
export function contactSheet(hours: readonly RgbPicture[]): RgbPicture {
  const w = Math.max(...hours.map((h) => h.width)), h = Math.max(...hours.map((p) => p.height));
  const cols = Math.min(2, hours.length), rowsN = Math.ceil(hours.length / 2);
  const sheet = blank(GAP + cols * (w + GAP), GAP + rowsN * (h + GAP));
  hours.forEach((p, k) => lay(sheet, p, { x: 0, y: 0, w: p.width, h: p.height }, GAP + (k % 2) * (w + GAP), GAP + Math.floor(k / 2) * (h + GAP), 1));
  return sheet;
}

/**
 * About what a picture costs an agent to look at: the model is shown it at most 1568 pixels on its long side and
 * about 1.15 million pixels in all, one token for each 750 of them. Newer models show large pictures bigger, and
 * cost more for them, so this is a floor for a big picture.
 */
export function imageTokens(width: number, height: number): number {
  const k = Math.min(1, 1568 / Math.max(width, height), Math.sqrt(1_150_000 / (width * height)));
  return Math.ceil((Math.floor(width * k) * Math.floor(height * k)) / 750);
}
