import { deflateRawSync } from 'node:zlib';

const enc = new TextEncoder();

/** synthetic: a minimal zip writer for the tests, stored or deflated entries. */
export function makeZip(files: { name: string; text: string; method?: 0 | 8 }[]): Uint8Array {
  const locals: number[] = [];
  const central: number[] = [];
  const u16 = (v: number) => [v & 0xff, (v >> 8) & 0xff];
  const u32 = (v: number) => [v & 0xff, (v >> 8) & 0xff, (v >> 16) & 0xff, (v >>> 24) & 0xff];
  for (const f of files) {
    const method = f.method ?? 8;
    const raw = enc.encode(f.text);
    const data = method === 8 ? new Uint8Array(deflateRawSync(raw)) : raw;
    const name = enc.encode(f.name);
    const offset = locals.length;
    locals.push(...u32(0x04034b50), ...u16(20), ...u16(0), ...u16(method), ...u16(0), ...u16(0), ...u32(0), ...u32(data.length), ...u32(raw.length), ...u16(name.length), ...u16(0), ...name, ...data);
    central.push(...u32(0x02014b50), ...u16(20), ...u16(20), ...u16(0), ...u16(method), ...u16(0), ...u16(0), ...u32(0), ...u32(data.length), ...u32(raw.length), ...u16(name.length), ...u16(0), ...u16(0), ...u16(0), ...u16(0), ...u32(0), ...u32(offset), ...name);
  }
  const end = [...u32(0x06054b50), ...u16(0), ...u16(0), ...u16(files.length), ...u16(files.length), ...u32(central.length), ...u32(locals.length), ...u16(0)];
  return new Uint8Array([...locals, ...central, ...end]);
}

