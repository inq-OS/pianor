// Covers ft_Y_04.AC25.
import { describe, expect, it } from 'vitest';
import type { MusicXmlResult } from '../../src/core/import/musicxml';
import { musicXmlToChart } from '../../src/core/import/musicxml';
import type { BookRun } from './audiveris';
import { BookServer, type BookIo } from './bookServer';
import type { Gray } from './clean';
import { syntheticPage } from './syntheticPage';

const PDF = new TextEncoder().encode('%PDF-1.7 synthetic');
const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0]);

/** synthetic: a score of `bars` one-note bars, a new page at `pageAt`. */
function score(bars: number, pageAt: number): MusicXmlResult {
  const measures = Array.from({ length: bars }, (_, i) => `<measure number="${i + 1}">${i === pageAt ? '<print new-page="yes"/>' : ''}${i === 0 ? '<attributes><divisions>1</divisions><time><beats>4</beats><beat-type>4</beat-type></time></attributes>' : ''}<note><pitch><step>C</step><octave>5</octave></pitch><duration>4</duration></note></measure>`);
  return musicXmlToChart(`<score-partwise><part-list/><part id="P1">${measures.join('')}</part></score-partwise>`, 'book');
}

/** A fake server: files in a map, Audiveris finished by the test, pages as synthetic pictures. */
function fake(pictures: Record<string, Gray> = {}) {
  const files = new Map<string, Uint8Array>();
  let finish: (r: Awaited<BookRun['done']>) => void = () => undefined;
  let line: (text: string) => void = () => undefined;
  const runs: { pdf: string; sheets: readonly number[] }[] = [];
  let clock = 0;
  const io: BookIo = {
    inDir: 'in',
    outDir: 'out',
    available: () => ({ ok: true }),
    writeFile: (path, bytes) => files.set(path.replace(/\\/g, '/'), bytes),
    read: (pdf, sheets, _out, onLine) => {
      runs.push({ pdf, sheets });
      line = onLine;
      return { done: new Promise((resolve) => (finish = resolve)), stop: () => finish({ ok: false, reason: 'stopped' }) };
    },
    readScore: () => score(8, 4),
    decode: (path) => pictures[path.replace(/\\/g, '/').replace(/^.*\//, '')] ?? null,
    encodePng: () => new Uint8Array([0x89, 0x50]),
    now: () => clock,
  };
  return { io, files, runs, finish: (r: Awaited<BookRun['done']>) => finish(r), say: (text: string) => line(text), tick: (ms: number) => (clock += ms) };
}

const body = (a: { body: unknown }) => a.body as Record<string, unknown>;
const settle = () => new Promise((r) => setTimeout(r, 0));

describe('the PDF import on the game server (ft_Y_04.AC25)', () => {
  it('takes a PDF and its page pictures, refusing what is not one', () => {
    const f = fake();
    const server = new BookServer(f.io);
    expect(body(server.create('Waltz', new TextEncoder().encode('hello')))).toEqual({ ok: false, reason: 'the file is not a PDF' });
    const made = body(server.create('Väike valss', PDF));
    expect(made).toEqual({ ok: true, book: 'book-vaike-valss' });
    expect(body(server.create('Väike valss', PDF)).book).toBe('book-vaike-valss-2');
    expect(f.files.has('in/book-vaike-valss/book.pdf')).toBe(true);
    expect(body(server.page('book-vaike-valss', 1, new Uint8Array([1, 2, 3]))).reason).toMatch(/not a JPEG or PNG/);
    expect(body(server.page('book-vaike-valss', 0, JPEG)).reason).toBe('no such page');
    expect(server.page('nope', 1, JPEG).status).toBe(404);
    expect(body(server.page('book-vaike-valss', 2, JPEG))).toEqual({ ok: true });
    expect(f.files.has('in/book-vaike-valss/page-2.jpg')).toBe(true);
  });

  it('reads only the chosen pages, one book at a time, says which page is being read, and stops when asked', async () => {
    const f = fake();
    const server = new BookServer(f.io);
    server.create('Waltz', PDF);
    server.page('book-waltz', 1, JPEG);
    server.page('book-waltz', 3, JPEG);
    expect(body(server.read('book-waltz', [1, 2, 3], false)).reason).toMatch(/pages 2 did not arrive/);
    expect(body(server.read('book-waltz', [3, 1], true)).reason).toMatch(/another sheet/);
    expect(body(server.read('book-waltz', [3, 1], false))).toEqual({ ok: true });
    expect(f.runs).toEqual([{ pdf: 'in/book-waltz/book.pdf', sheets: [1, 3] }].map((r) => ({ ...r, pdf: expect.stringMatching(/book-waltz.book\.pdf$/) })));
    expect(server.busy()).toBe(true);
    f.tick(42_000);
    f.say('INFO  [book#3] Sheet #3 binarization');
    expect(body(server.status('book-waltz'))).toEqual({ state: 'reading', page: 3, pages: [1, 3], seconds: 42 });
    server.stop('book-waltz');
    await settle();
    expect(body(server.status('book-waltz'))).toEqual({ state: 'failed', reason: 'stopped' });
    expect(server.busy()).toBe(false);
  });

  it('answers the movements read and the pages whose bar count differs, then writes each part a strip under its piece id', async () => {
    // the reading: 8 bars, page 2 from bar 5; the pictures: 4 bars on page 1, 5 on page 2 (one bar to check)
    const f = fake({ 'page-1.jpg': syntheticPage({ systems: [4] }), 'page-2.jpg': syntheticPage({ systems: [5] }) });
    const server = new BookServer(f.io);
    server.create('Waltz', PDF);
    server.page('book-waltz', 1, JPEG);
    server.page('book-waltz', 2, JPEG);
    server.read('book-waltz', [1, 2], false);
    f.finish({ ok: true, scores: ['out/waltz.mxl'] });
    await settle();
    const done = body(server.status('book-waltz'));
    expect(done.state).toBe('done');
    expect((done.movements as { chart: { bars: unknown[] } }[]).map((m) => m.chart.bars.length)).toEqual([8]);
    expect(done.uneven).toEqual([2]);
    expect(body(server.parts('book-waltz', [{ id: 'bad id', movement: 0, firstBar: 0, lastBar: 3 }])).reason).toMatch(/not an own piece/);
    expect(body(server.parts('book-waltz', [{ id: 'own-waltz-p01', movement: 0, firstBar: 0, lastBar: 3 }, { id: 'own-waltz-p02', movement: 0, firstBar: 4, lastBar: 7 }]))).toEqual({ ok: true, written: 2 });
    const map = JSON.parse(new TextDecoder().decode(f.files.get('out/own-waltz-p02/photo.json'))) as { image: string; layout: { systems: { bars: unknown[] }[] } };
    expect(map.image).toBe('strip.png');
    expect(map.layout.systems.map((s) => s.bars.length)).toEqual([4]);
    expect(f.files.has('out/own-waltz-p02/strip.png')).toBe(true);
  });

  it('a failed reading says why', async () => {
    const f = fake();
    const server = new BookServer(f.io);
    server.create('Waltz', PDF);
    server.page('book-waltz', 1, JPEG);
    server.read('book-waltz', [1], false);
    f.finish({ ok: false, reason: 'no MusicXML was written' });
    await settle();
    expect(body(server.status('book-waltz'))).toEqual({ state: 'failed', reason: 'Audiveris could not read it: no MusicXML was written' });
  });
});
