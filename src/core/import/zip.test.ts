// Covers ft_Y_04.AC2.
import { describe, expect, it } from 'vitest';
import { readEntry, zipEntries } from './zip';
import { makeZip } from '../../../tests/helpers/zip';

const enc = new TextEncoder();
const dec = new TextDecoder();

/** The platform's own deflate, as the browser page uses it. */
const inflate = async (raw: Uint8Array) => new Uint8Array(await new Response(new Blob([raw as BlobPart]).stream().pipeThrough(new DecompressionStream('deflate-raw'))).arrayBuffer());

describe('reading a zip archive (ft_Y_04.AC2)', () => {
  it('ft_Y_04.AC2 lists stored and deflated entries and reads them back', async () => {
    const zip = makeZip([
      { name: 'META-INF/container.xml', text: '<container/>', method: 0 },
      { name: 'score.xml', text: '<score-partwise>'.repeat(50) },
    ]);
    const entries = zipEntries(zip);
    expect(entries.map((e) => [e.name, e.method, e.size])).toEqual([
      ['META-INF/container.xml', 0, 12],
      ['score.xml', 8, 800],
    ]);
    expect(dec.decode(await readEntry(entries[0]!, inflate))).toBe('<container/>');
    expect(dec.decode(await readEntry(entries[1]!, inflate))).toBe('<score-partwise>'.repeat(50));
  });

  it('refuses what it cannot read, saying why', async () => {
    expect(() => zipEntries(enc.encode('not a zip at all, just text that is long enough'))).toThrow('not a zip archive');
    const zip = makeZip([{ name: 'a.xml', text: 'x' }]);
    const damaged = zip.slice();
    damaged[zip.length - 22 + 16] = 0xff; // the central directory's offset points nowhere
    expect(() => zipEntries(damaged)).toThrow('directory is damaged');
    const badLocal = zip.slice();
    badLocal[0] = 0;
    expect(() => zipEntries(badLocal)).toThrow('entry a.xml is damaged');
    const cut = makeZip([{ name: 'a.xml', text: 'x'.repeat(100), method: 0 }]);
    const view = new DataView(cut.buffer);
    const centralAt = view.getUint32(cut.length - 22 + 16, true);
    view.setUint32(centralAt + 20, 100_000, true);
    expect(() => zipEntries(cut)).toThrow('cut short');
    await expect(readEntry({ name: 'b.xml', method: 12, data: new Uint8Array(), size: 0 }, inflate)).rejects.toThrow('method 12');
    await expect(readEntry({ name: 'bomb.xml', method: 8, data: new Uint8Array(), size: 2 ** 31 }, inflate)).rejects.toThrow('more than a score file holds');
  });
});
