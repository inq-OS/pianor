import { bayer } from './noise';

/**
 * Brings a picture painted in any colours down to a palette, the way a painted background was scanned and brought down
 * to a 256-colour screen: each pixel takes the palette colour nearest to it, and where a shade lies between two colours an
 * ordered dither mixes them.
 */
export class Reducer {
  private readonly lut = new Int16Array(32768).fill(-1);
  private readonly rgb: number[][];

  /** `allowed` are the palette indexes this reducer may use. */
  constructor(palette: readonly number[], private readonly allowed: readonly number[]) {
    this.rgb = allowed.map((i) => {
      const c = palette[i]!;
      return [(c >> 16) & 255, (c >> 8) & 255, c & 255];
    });
  }

  /** The palette index nearest to a colour (each part 0 to 255). */
  nearest(r: number, g: number, b: number): number {
    const key = ((r >> 3) << 10) | ((g >> 3) << 5) | (b >> 3);
    const known = this.lut[key]!;
    if (known >= 0) return known;
    let best = 0, bestD = Infinity;
    for (let i = 0; i < this.rgb.length; i++) {
      const c = this.rgb[i]!;
      const dr = c[0]! - r, dg = c[1]! - g, db = c[2]! - b;
      // the eye is keenest for green, then red: weights of the usual quick colour distance
      const d = 3 * dr * dr + 5 * dg * dg + 2 * db * db;
      if (d < bestD) { bestD = d; best = i; }
    }
    const index = this.allowed[best]!;
    this.lut[key] = index;
    return index;
  }

  /** One pixel: a colour (parts 0 to 1) at (x, y), dithered by `spread` (0 for none). */
  pixel(r: number, g: number, b: number, x: number, y: number, spread: number): number {
    return this.shifted(r, g, b, (bayer(x, y) - 0.5) * spread);
  }

  /** One pixel: a colour (parts 0 to 1) made lighter or darker by `d` before it goes to its nearest palette colour: a brush stroke moves a tone's border as a dither pattern does. */
  shifted(r: number, g: number, b: number, d: number): number {
    const q = (v: number) => {
      const n = Math.round((v + d) * 255);
      return n < 0 ? 0 : n > 255 ? 255 : n;
    };
    return this.nearest(q(r), q(g), q(b));
  }
}
