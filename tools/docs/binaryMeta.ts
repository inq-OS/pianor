/**
 * Text that a picture or a sound can carry beside its pixels or samples (d165). Such text is never read by the word
 * checks, so an allowed binary file must carry none of it, and a file this reader cannot follow to its end fails:
 *   - PNG: only the chunks that describe pixels and colour, ending at IEND with nothing after it
 *   - WebP: a RIFF file without EXIF or XMP chunks
 *   - MP3: ID3v2.3 or v2.4 at the start with only the encoder's own frames, no extended header, no tag at the end
 * Returns what was found, or null when the file is clean.
 */
const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
/** PNG chunks that hold pixels and colour, never text. */
const PNG_PIXELS = new Set(['IHDR', 'PLTE', 'IDAT', 'IEND', 'tRNS', 'gAMA', 'sRGB', 'pHYs', 'cHRM', 'sBIT', 'iCCP', 'bKGD']);
/** ID3 frames an encoder writes about the file itself (the encoder's name, the length); anything else is a tag someone set. */
const ID3_TECHNICAL = new Set(['TSSE', 'TLEN', 'TENC']);

const ascii = (b: Uint8Array, at: number, n: number): string => String.fromCharCode(...b.subarray(at, at + n));
const u32 = (b: Uint8Array, at: number): number => (((b[at] ?? 0) << 24) | ((b[at + 1] ?? 0) << 16) | ((b[at + 2] ?? 0) << 8) | (b[at + 3] ?? 0)) >>> 0;
const u32le = (b: Uint8Array, at: number): number => ((b[at] ?? 0) | ((b[at + 1] ?? 0) << 8) | ((b[at + 2] ?? 0) << 16) | ((b[at + 3] ?? 0) << 24)) >>> 0;
const syncsafe = (b: Uint8Array, at: number): number => (((b[at] ?? 0) & 0x7f) << 21) | (((b[at + 1] ?? 0) & 0x7f) << 14) | (((b[at + 2] ?? 0) & 0x7f) << 7) | ((b[at + 3] ?? 0) & 0x7f);

function png(bytes: Uint8Array): string | null {
  if (!PNG_SIGNATURE.every((v, i) => bytes[i] === v)) return 'not a PNG file';
  for (let at = 8; at + 12 <= bytes.length; ) {
    const length = u32(bytes, at);
    const type = ascii(bytes, at + 4, 4);
    if (!PNG_PIXELS.has(type)) return `the PNG chunk ${type.replace(/[^\x20-\x7e]/g, '?')}`;
    at += 12 + length;
    if (type === 'IEND') return at === bytes.length ? null : 'bytes after the end of the PNG';
  }
  return 'a PNG without its end';
}

function webp(bytes: Uint8Array): string | null {
  if (ascii(bytes, 0, 4) !== 'RIFF' || ascii(bytes, 8, 4) !== 'WEBP') return 'not a WebP file';
  for (let at = 12; at < bytes.length; ) {
    if (at + 8 > bytes.length) return 'a WebP that ends inside a chunk';
    const type = ascii(bytes, at, 4);
    if (type === 'EXIF' || type === 'XMP ') return `the WebP chunk ${type.trim()}`;
    const length = u32le(bytes, at + 4);
    if (at + 8 + length > bytes.length) return 'a WebP that ends inside a chunk';
    at += 8 + length + (length % 2);
  }
  return null;
}

function mp3(bytes: Uint8Array): string | null {
  if (bytes.length >= 128 && ascii(bytes, bytes.length - 128, 3) === 'TAG') return 'an ID3v1 tag';
  if (bytes.length >= 10 && ascii(bytes, bytes.length - 10, 3) === '3DI') return 'an ID3 tag at the end';
  if (ascii(bytes, 0, 3) !== 'ID3') return null;
  const version = bytes[3];
  if (version !== 3 && version !== 4) return `an ID3v2.${version ?? '?'} tag`;
  if (((bytes[5] ?? 0) & 0x40) !== 0) return 'an ID3 extended header';
  const end = Math.min(bytes.length, 10 + syncsafe(bytes, 6));
  for (let at = 10; at + 10 <= end; ) {
    if (bytes[at] === 0) {
      // padding: zeros to the end of the tag
      return bytes.subarray(at, end).every((b) => b === 0) ? null : 'text in the ID3 padding';
    }
    const id = ascii(bytes, at, 4);
    if (!ID3_TECHNICAL.has(id)) return `the ID3 frame ${id.replace(/[^\x20-\x7e]/g, '?')}`;
    // ID3v2.4 stores frame sizes as syncsafe integers (7 bits a byte), v2.3 as plain ones
    at += 10 + (version === 4 ? syncsafe(bytes, at + 4) : u32(bytes, at + 4));
  }
  return null;
}

export function binaryMetadata(file: string, bytes: Uint8Array): string | null {
  if (/\.png$/i.test(file)) return png(bytes);
  if (/\.webp$/i.test(file)) return webp(bytes);
  if (/\.mp3$/i.test(file)) return mp3(bytes);
  return `a ${file.split('.').pop() ?? ''} file, which the check cannot read`;
}
