import { createBitmap, inkBounds, type Bitmap } from './bitmap';
import type { LiveWater } from './paint/live';

/**
 * Packs a picture's palette indexes into a short text and back. The painted room (ft_1_18) is made when the game is built
 * and travels inside the game's code as text; ordered dither repeats every few pixels and every row, which a simple
 * "copy what was `distance` bytes back" packer (the LZ77 family) shrinks well.
 *
 * The packed bytes: a byte below 128 is "the next `byte + 1` bytes as they are"; a byte from 128 is "copy `byte - 125`
 * bytes from `distance` back", the distance in the two bytes after it, low byte first. The text is the bytes in base64.
 */

const MIN_COPY = 3;
const MAX_COPY = 130;
const MAX_RAW = 128;
const MAX_DISTANCE = 65535;
/** How many earlier places with the same three bytes the packer tries. */
const TRIES = 24;

function packBytes(data: Uint8Array): Uint8Array {
  const out: number[] = [];
  const last = new Map<number, number>();
  const before = new Int32Array(data.length).fill(-1);
  let rawStart = 0;
  const flushRaw = (end: number): void => {
    for (let at = rawStart; at < end; at += MAX_RAW) {
      const n = Math.min(MAX_RAW, end - at);
      out.push(n - 1);
      for (let k = 0; k < n; k++) out.push(data[at + k]!);
    }
  };
  const remember = (i: number): void => {
    if (i + MIN_COPY > data.length) return;
    const key = (data[i]! << 16) | (data[i + 1]! << 8) | data[i + 2]!;
    before[i] = last.get(key) ?? -1;
    last.set(key, i);
  };
  let i = 0;
  while (i < data.length) {
    let best = 0, bestAt = -1;
    if (i + MIN_COPY <= data.length) {
      const key = (data[i]! << 16) | (data[i + 1]! << 8) | data[i + 2]!;
      let at = last.get(key) ?? -1;
      for (let tries = 0; at >= 0 && i - at <= MAX_DISTANCE && tries < TRIES; tries++, at = before[at]!) {
        let n = 0;
        while (n < MAX_COPY && i + n < data.length && data[at + n] === data[i + n]) n++;
        if (n > best) { best = n; bestAt = at; }
      }
    }
    if (best >= MIN_COPY) {
      flushRaw(i);
      const distance = i - bestAt;
      out.push(128 + best - MIN_COPY, distance & 255, distance >> 8);
      for (let k = 0; k < best; k++) remember(i + k);
      i += best;
      rawStart = i;
    } else {
      remember(i);
      i++;
    }
  }
  flushRaw(data.length);
  return Uint8Array.from(out);
}

function unpackBytes(packed: Uint8Array, length: number): Uint8Array {
  const out = new Uint8Array(length);
  let o = 0;
  for (let i = 0; i < packed.length;) {
    const head = packed[i++]!;
    if (head < 128) {
      out.set(packed.subarray(i, i + head + 1), o);
      i += head + 1;
      o += head + 1;
    } else {
      const from = o - (packed[i]! | (packed[i + 1]! << 8));
      i += 2;
      // one byte at a time: a copy may run into the bytes it is writing
      for (let k = 0; k < head - 128 + MIN_COPY; k++) out[o++] = out[from + k]!;
    }
  }
  if (o !== length) throw new Error(`a packed picture of ${o} pixels, not the ${length} asked for`);
  return out;
}

/** The pixels of a picture as text. */
export function packPixels(pixels: Uint8Array): string {
  const bytes = packBytes(pixels);
  let text = '';
  for (let i = 0; i < bytes.length; i += 8192) text += String.fromCharCode(...bytes.subarray(i, i + 8192));
  return btoa(text);
}

/** A picture of `width` x `height` from the text `packPixels` gave. */
export function unpackBitmap(text: string, width: number, height: number): Bitmap {
  const raw = atob(text);
  const bytes = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
  return { width, height, pixels: unpackBytes(bytes, width * height) };
}

/** A small picture with its place in a larger one (fine pixels), in one or more frames of one size. */
export interface Overlay {
  x: number;
  y: number;
  frames: Bitmap[];
}

/** Frames cut to the one box that holds what is drawn in any of them, so they lie on each other; all clear gives 1 x 1 frames. */
export function cropTogether(frames: readonly Bitmap[]): Overlay {
  const { width: w, height: h } = frames[0]!;
  const all = createBitmap(w, h);
  for (const f of frames) f.pixels.forEach((p, i) => { if (p) all.pixels[i] = 1; });
  const b = inkBounds(all);
  if (!b) return { x: 0, y: 0, frames: frames.map(() => createBitmap(1, 1)) };
  return {
    x: b.left, y: b.top,
    frames: frames.map((f) => {
      const out = createBitmap(b.right - b.left, b.bottom - b.top);
      for (let y = 0; y < out.height; y++) out.pixels.set(f.pixels.subarray((b.top + y) * w + b.left, (b.top + y) * w + b.right), y * out.width);
      return out;
    }),
  };
}

export interface PackedOverlay {
  x: number;
  y: number;
  w: number;
  h: number;
  frames: string[];
}

export function packOverlay(o: Overlay): PackedOverlay {
  const first = o.frames[0]!;
  return { x: o.x, y: o.y, w: first.width, h: first.height, frames: o.frames.map((f) => packPixels(f.pixels)) };
}

export function unpackOverlay(o: PackedOverlay): Overlay {
  return { x: o.x, y: o.y, frames: o.frames.map((f) => unpackBitmap(f, o.w, o.h)) };
}

/**
 * Looks of one picture that differ in places (the room in three strengths of the fire, the map with its sea in two
 * states): the look numbered `whole` as it is, every other as only the pixels that differ from it (0 elsewhere, so a
 * look must have no clear pixel), which packs far smaller.
 */
export function packLooks(looks: readonly Bitmap[], whole: number): string[] {
  const base = looks[whole]!;
  return looks.map((look, i) => packPixels(i === whole ? look.pixels : look.pixels.map((p, at) => (p === base.pixels[at] ? 0 : p))));
}

export function unpackLooks(texts: readonly string[], width: number, height: number, whole: number): Bitmap[] {
  const base = unpackBitmap(texts[whole]!, width, height);
  return texts.map((text, i) => {
    if (i === whole) return base;
    const look = unpackBitmap(text, width, height);
    look.pixels.forEach((p, at) => { if (p === 0) look.pixels[at] = base.pixels[at]!; });
    return look;
  });
}

/** A picture's palette and its frames of one size (the first kept whole, the others as their difference from it), packed. */
export interface PackedFrames {
  palette: readonly number[];
  w: number;
  h: number;
  frames: string[];
}

export function packFrames(palette: readonly number[], frames: readonly Bitmap[]): PackedFrames {
  const first = frames[0]!;
  return { palette, w: first.width, h: first.height, frames: packLooks(frames, 0) };
}

export function unpackFrames(packed: PackedFrames): { palette: readonly number[]; frames: Bitmap[] } {
  return { palette: packed.palette, frames: unpackLooks(packed.frames, packed.w, packed.h, 0) };
}

/** A picture's packed form as a loader gives it: one module per picture and hour (`virtual:keri-pictures`, d143). */
export type PictureLoader<P> = () => Promise<{ default: P }>;

/** Pictures by key (an hour of the day) that are loaded when first asked for, unpacked once and kept (ft_1_24.AC7). */
export interface LoadedPictures<K extends string, T> {
  /** The picture if it is loaded, else null. */
  ready(key: K): T | null;
  /** Loads and unpacks the picture once; a failed load is tried again on the next call. */
  load(key: K): Promise<T>;
}

export function loadedOnce<K extends string, P, T>(loaders: Readonly<Record<K, PictureLoader<P>>>, unpack: (packed: P) => T): LoadedPictures<K, T> {
  const unpacked = new Map<K, T>();
  const loading = new Map<K, Promise<T>>();
  return {
    ready: (key) => unpacked.get(key) ?? null,
    load(key) {
      const done = unpacked.get(key);
      if (done !== undefined) return Promise.resolve(done);
      let pending = loading.get(key);
      if (!pending) {
        pending = loaders[key]().then((module) => {
          const picture = unpack(module.default);
          unpacked.set(key, picture);
          return picture;
        }).finally(() => loading.delete(key));
        loading.set(key, pending);
      }
      return pending;
    },
  };
}

/** Live water (`paint/live.ts`) as it travels: its layers as one overlay, and its horizon, drift and foam. */
export interface PackedLiveWater {
  layers: PackedOverlay;
  horizon: number;
  way: 1 | -1;
  foam: number;
  cover: number;
}

export function packLiveWater(water: LiveWater): PackedLiveWater {
  return { layers: packOverlay(water.layers), horizon: water.horizon, way: water.way, foam: water.foam, cover: water.cover };
}

export function unpackLiveWater(packed: PackedLiveWater): LiveWater {
  return { layers: unpackOverlay(packed.layers), horizon: packed.horizon, way: packed.way, foam: packed.foam, cover: packed.cover };
}
