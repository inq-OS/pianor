import { inflateSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';
import { pngBytes, type IndexedPicture } from './png';

/** A 2 x 2 picture: clear, red / green, an index the palette lacks. */
const PICTURE: IndexedPicture = { width: 2, height: 2, pixels: new Uint8Array([0, 1, 2, 9]), palette: [0x123456, 0xff0000, 0x00ff00] };

/** The chunks of a PNG file: type and data. */
function chunks(bytes: Uint8Array): { type: string; data: Uint8Array }[] {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const out: { type: string; data: Uint8Array }[] = [];
  for (let at = 8; at < bytes.length;) {
    const length = view.getUint32(at);
    out.push({ type: String.fromCharCode(...bytes.subarray(at + 4, at + 8)), data: bytes.subarray(at + 8, at + 8 + length) });
    at += 12 + length;
  }
  return out;
}

/** The colours of a PNG made by `pngBytes`, row by row. */
function colours(bytes: Uint8Array): number[][] {
  const [head, data] = chunks(bytes);
  const view = new DataView(head!.data.buffer, head!.data.byteOffset, head!.data.byteLength);
  const w = view.getUint32(0), h = view.getUint32(4);
  const raw = inflateSync(data!.data);
  return Array.from({ length: h }, (_, y) => Array.from({ length: w }, (_, x) => {
    const at = y * (1 + w * 3) + 1 + x * 3;
    return (raw[at]! << 16) | (raw[at + 1]! << 8) | raw[at + 2]!;
  }));
}

describe('a painted picture as a PNG file, to look at outside the game (docs/art-direction.md)', () => {
  it('is a PNG: the signature, a header with its size in 24-bit colour, the data and the end', () => {
    const bytes = pngBytes(PICTURE);
    expect([...bytes.subarray(0, 8)]).toEqual([137, 80, 78, 71, 13, 10, 26, 10]);
    const parts = chunks(bytes);
    expect(parts.map((part) => part.type)).toEqual(['IHDR', 'IDAT', 'IEND']);
    expect([...parts[0]!.data]).toEqual([0, 0, 0, 2, 0, 0, 0, 2, 8, 2, 0, 0, 0]);
    // the check sum of a chunk with no data is a known number
    expect([...bytes.subarray(-4)]).toEqual([0xae, 0x42, 0x60, 0x82]);
  });

  it('shows each index in its palette colour; index 0 and an index the palette lacks show as the backdrop', () => {
    expect(colours(pngBytes(PICTURE))).toEqual([[0x000000, 0xff0000], [0x00ff00, 0x000000]]);
    expect(colours(pngBytes(PICTURE, 1, 0x74b0ea))).toEqual([[0x74b0ea, 0xff0000], [0x00ff00, 0x74b0ea]]);
  });

  it('zooms by whole numbers: each pixel becomes a square of that side', () => {
    const big = colours(pngBytes(PICTURE, 3));
    expect(big).toHaveLength(6);
    expect(big[0]).toEqual([0, 0, 0, 0xff0000, 0xff0000, 0xff0000]);
    expect(big[2]).toEqual(big[0]);
    expect(big[3]).toEqual([0x00ff00, 0x00ff00, 0x00ff00, 0, 0, 0]);
  });

  it('refuses a zoom that is not a whole number from 1, and a picture whose pixels do not fit its size', () => {
    expect(() => pngBytes(PICTURE, 0)).toThrow(/zoom/);
    expect(() => pngBytes(PICTURE, 1.5)).toThrow(/zoom/);
    expect(() => pngBytes({ ...PICTURE, width: 3 })).toThrow(/6 pixels, got 4/);
  });

  it('takes 16-bit indexes, for a sheet of more than 256 colours', () => {
    const wide: IndexedPicture = { width: 2, height: 1, pixels: new Uint16Array([300, 1]), palette: Array.from({ length: 301 }, (_, i) => (i === 300 ? 0x0000ff : 0xff0000)) };
    expect(colours(pngBytes(wide))).toEqual([[0x0000ff, 0xff0000]]);
  });
});
