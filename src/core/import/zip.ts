/**
 * Reading a zip archive's files (a compressed MusicXML `.mxl` is one, ft_Y_04). Pure: the central directory is read here,
 * and deflate is the caller's (`zlib.inflateRawSync` in Node, `DecompressionStream('deflate-raw')` in the browser).
 * Stored and deflated entries only; no zip64, encryption or multi-disk archives, which score files never use.
 */

export interface ZipEntry {
  name: string;
  /** 0 stored, 8 deflate. */
  method: number;
  /** The bytes as stored in the archive. */
  data: Uint8Array;
  size: number;
}

export type Inflate = (raw: Uint8Array) => Uint8Array | Promise<Uint8Array>;

const EOCD = 0x06054b50;
const CENTRAL = 0x02014b50;
const LOCAL = 0x04034b50;

/** The entries listed in the central directory, or an error saying what is wrong with the archive. */
export function zipEntries(bytes: Uint8Array): ZipEntry[] {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const u16 = (at: number) => view.getUint16(at, true);
  const u32 = (at: number) => view.getUint32(at, true);
  let end = -1;
  for (let at = bytes.length - 22; at >= Math.max(0, bytes.length - 22 - 0xffff); at--) {
    if (u32(at) === EOCD) {
      end = at;
      break;
    }
  }
  if (end < 0) throw new Error('not a zip archive (no end of central directory)');
  const count = u16(end + 10);
  let at = u32(end + 16);
  const decoder = new TextDecoder();
  const entries: ZipEntry[] = [];
  for (let k = 0; k < count; k++) {
    if (at + 46 > bytes.length || u32(at) !== CENTRAL) throw new Error('the zip archive\'s directory is damaged');
    const method = u16(at + 10);
    const compressed = u32(at + 20);
    const size = u32(at + 24);
    const nameLength = u16(at + 28);
    const extra = u16(at + 30);
    const comment = u16(at + 32);
    const local = u32(at + 42);
    const name = decoder.decode(bytes.subarray(at + 46, at + 46 + nameLength));
    if (local + 30 > bytes.length || u32(local) !== LOCAL) throw new Error(`the zip archive's entry ${name} is damaged`);
    const start = local + 30 + u16(local + 26) + u16(local + 28);
    if (start + compressed > bytes.length) throw new Error(`the zip archive's entry ${name} is cut short`);
    entries.push({ name, method, data: bytes.subarray(start, start + compressed), size });
    at += 46 + nameLength + extra + comment;
  }
  return entries;
}

/** No score file is near this; a bigger entry is a broken or hostile archive. */
export const MAX_ENTRY_BYTES = 64 * 1024 * 1024;

/** One entry's content; an entry that says it unpacks to more than `MAX_ENTRY_BYTES` is refused. */
export async function readEntry(entry: ZipEntry, inflate: Inflate): Promise<Uint8Array> {
  if (entry.size > MAX_ENTRY_BYTES) throw new Error(`${entry.name} unpacks to ${entry.size} bytes, more than a score file holds`);
  if (entry.method === 0) return entry.data;
  if (entry.method === 8) return inflate(entry.data);
  throw new Error(`${entry.name} is compressed with method ${entry.method}, which this reader does not know`);
}
