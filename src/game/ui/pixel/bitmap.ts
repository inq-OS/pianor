import { PALETTE } from './palette';

/** A picture made of palette indexes, row by row. Index 0 is transparent. */
export interface Bitmap {
  readonly width: number;
  readonly height: number;
  readonly pixels: Uint8Array;
}

export function createBitmap(width: number, height: number): { width: number; height: number; pixels: Uint8Array } {
  return { width, height, pixels: new Uint8Array(width * height) };
}

/**
 * A bitmap from rows of text. `legend` maps each character to a palette index; `.` is transparent unless the legend
 * says otherwise. Every row must be as long as the first and every character must be in the legend.
 */
export function fromAscii(rows: readonly string[], legend: Readonly<Record<string, number>>): Bitmap {
  if (rows.length === 0) throw new Error('a bitmap needs at least one row');
  const width = rows[0]!.length;
  const bitmap = createBitmap(width, rows.length);
  rows.forEach((row, y) => {
    if (row.length !== width) throw new Error(`row ${y} is ${row.length} wide, the first row is ${width}`);
    [...row].forEach((ch, x) => {
      const index = ch === '.' && legend['.'] === undefined ? 0 : legend[ch];
      if (index === undefined) throw new Error(`"${ch}" in row ${y} is not in the legend`);
      bitmap.pixels[y * width + x] = index;
    });
  });
  return bitmap;
}

/** Draw `source` onto `target` with its top-left at (x, y); transparent pixels leave the target alone, and anything outside is cut. */
export function blit(target: { width: number; height: number; pixels: Uint8Array }, source: Bitmap, x: number, y: number): void {
  for (let sy = 0; sy < source.height; sy++) {
    for (let sx = 0; sx < source.width; sx++) {
      const index = source.pixels[sy * source.width + sx]!;
      const tx = x + sx;
      const ty = y + sy;
      if (index !== 0 && tx >= 0 && ty >= 0 && tx < target.width && ty < target.height) target.pixels[ty * target.width + tx] = index;
    }
  }
}

/** The same picture mirrored left to right. */
export function flipX(source: Bitmap): Bitmap {
  const out = createBitmap(source.width, source.height);
  for (let y = 0; y < source.height; y++) {
    for (let x = 0; x < source.width; x++) out.pixels[y * source.width + x] = source.pixels[y * source.width + (source.width - 1 - x)]!;
  }
  return out;
}

/** The same picture mirrored top to bottom. */
export function flipY(source: Bitmap): Bitmap {
  const out = createBitmap(source.width, source.height);
  for (let y = 0; y < source.height; y++) out.pixels.set(source.pixels.subarray((source.height - 1 - y) * source.width, (source.height - y) * source.width), y * source.width);
  return out;
}

/**
 * The same picture at twice the size with its stairs smoothed (the Scale2x rule): how art drawn on the layout cells comes
 * onto the fine grid (d110) inside a picture painted there, without looking twice as coarse as its surroundings.
 */
export function scale2x(source: Bitmap): Bitmap {
  const { width: w, height: h, pixels } = source;
  const out = createBitmap(w * 2, h * 2);
  const at = (x: number, y: number): number => (x < 0 || y < 0 || x >= w || y >= h ? 0 : pixels[y * w + x]!);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const p = at(x, y), up = at(x, y - 1), right = at(x + 1, y), left = at(x - 1, y), down = at(x, y + 1);
      const o = y * 2 * out.width + x * 2;
      out.pixels[o] = left === up && left !== down && up !== right ? up : p;
      out.pixels[o + 1] = up === right && up !== left && right !== down ? right : p;
      out.pixels[o + out.width] = down === left && down !== right && left !== up ? left : p;
      out.pixels[o + out.width + 1] = right === down && right !== up && down !== left ? down : p;
    }
  }
  return out;
}

/** The same picture with every colour index `from` replaced by `to`. */
export function recolor(source: Bitmap, map: Readonly<Record<number, number>>): Bitmap {
  const out = createBitmap(source.width, source.height);
  source.pixels.forEach((index, i) => {
    out.pixels[i] = map[index] ?? index;
  });
  return out;
}

/** An index the palette does not have shows in magenta, so a bad bitmap is easy to spot. */
const MISSING_COLOUR = 0xff00ff;

/** RGBA bytes (4 per pixel) for a canvas or a texture. Transparent pixels have alpha 0. */
export function toRgba(bitmap: Bitmap, palette: readonly number[] = PALETTE): Uint8ClampedArray {
  const out = new Uint8ClampedArray(bitmap.width * bitmap.height * 4);
  bitmap.pixels.forEach((index, i) => {
    if (index === 0) return;
    const rgb = palette[index] ?? MISSING_COLOUR;
    out[i * 4] = (rgb >> 16) & 0xff;
    out[i * 4 + 1] = (rgb >> 8) & 0xff;
    out[i * 4 + 2] = rgb & 0xff;
    out[i * 4 + 3] = 255;
  });
  return out;
}

/** The smallest box around the drawn pixels (left and top inclusive, right and bottom exclusive), or null when nothing is drawn. */
export function inkBounds(bitmap: Bitmap): { left: number; top: number; right: number; bottom: number } | null {
  let left = bitmap.width;
  let top = bitmap.height;
  let right = 0;
  let bottom = 0;
  for (let y = 0; y < bitmap.height; y++) {
    for (let x = 0; x < bitmap.width; x++) {
      if (bitmap.pixels[y * bitmap.width + x] === 0) continue;
      left = Math.min(left, x);
      top = Math.min(top, y);
      right = Math.max(right, x + 1);
      bottom = Math.max(bottom, y + 1);
    }
  }
  return right === 0 ? null : { left, top, right, bottom };
}

/** How many pixels are drawn (not transparent). */
export function inkCount(bitmap: Bitmap): number {
  return bitmap.pixels.reduce((sum, index) => sum + (index === 0 ? 0 : 1), 0);
}
