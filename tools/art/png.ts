import { deflateSync } from 'node:zlib';

/** A PNG file's check sum (CRC-32) of `bytes`. */
function crc32(bytes: Uint8Array): number {
  let c = ~0;
  for (const b of bytes) {
    c ^= b;
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
  }
  return ~c >>> 0;
}

/** One chunk of a PNG file: its length, its four-letter type, its data and the check sum of type and data. */
function chunk(type: string, data: Uint8Array): Uint8Array {
  const out = new Uint8Array(12 + data.length);
  const view = new DataView(out.buffer);
  view.setUint32(0, data.length);
  out.set([...type].map((ch) => ch.charCodeAt(0)), 4);
  out.set(data, 8);
  view.setUint32(8 + data.length, crc32(out.subarray(4, 8 + data.length)));
  return out;
}

/**
 * A picture of palette indexes with its colours (0xRRGGBB each): what a painter hands over. Index 0 shows as `backdrop`.
 * A sheet of many sprites may hold more than 256 colours, so its indexes are 16-bit.
 */
export interface IndexedPicture {
  width: number;
  height: number;
  pixels: Uint8Array | Uint16Array;
  palette: readonly number[];
}

/**
 * The picture as the bytes of a PNG file (24-bit colour, no transparency), each of its pixels `zoom` by `zoom` large, so
 * a person or an agent can look at a painted picture without starting the game. Index 0 and any index the palette does
 * not hold show as `backdrop`.
 */
export function pngBytes(picture: IndexedPicture, zoom = 1, backdrop = 0x000000): Uint8Array {
  if (!Number.isInteger(zoom) || zoom < 1) throw new Error(`zoom must be a whole number from 1, got ${zoom}`);
  if (picture.pixels.length !== picture.width * picture.height) throw new Error(`a ${picture.width} x ${picture.height} picture needs ${picture.width * picture.height} pixels, got ${picture.pixels.length}`);
  const w = picture.width * zoom, h = picture.height * zoom;
  const raw = new Uint8Array(h * (1 + w * 3));
  for (let y = 0; y < h; y++) {
    const row = y * (1 + w * 3);
    for (let x = 0; x < w; x++) {
      const index = picture.pixels[Math.floor(y / zoom) * picture.width + Math.floor(x / zoom)]!;
      const colour = index === 0 ? backdrop : picture.palette[index] ?? backdrop;
      raw[row + 1 + x * 3] = (colour >> 16) & 255;
      raw[row + 2 + x * 3] = (colour >> 8) & 255;
      raw[row + 3 + x * 3] = colour & 255;
    }
  }
  return rgbPng(w, h, raw);
}

/** A PNG file (24-bit colour, no transparency) of `raw`: `height` rows, each a filter byte 0 and `width` RGB triples. */
export function rgbPng(width: number, height: number, raw: Uint8Array): Uint8Array {
  const head = new Uint8Array(13);
  const view = new DataView(head.buffer);
  view.setUint32(0, width);
  view.setUint32(4, height);
  head[8] = 8; // bits for each of red, green and blue
  head[9] = 2; // colour type: RGB
  const parts = [new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', head), chunk('IDAT', deflateSync(raw)), chunk('IEND', new Uint8Array())];
  const out = new Uint8Array(parts.reduce((sum, part) => sum + part.length, 0));
  let at = 0;
  for (const part of parts) {
    out.set(part, at);
    at += part.length;
  }
  return out;
}
