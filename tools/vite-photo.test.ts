// Covers ft_Y_04.AC17 (the piece maker's photo import, the server's side).
import { EventEmitter } from 'node:events';
import { copyFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { PHOTO_API, nodePhotoServer, photoDirOf, photoHandler, photoPlugin, safeName, type PhotoServer } from './vite-photo';
import type { SheetResult } from './import/photo';

/** A request with a body, as Node gives it to a middleware. */
function request(method: string, url: string, body?: Buffer, headers: Record<string, string> = {}): IncomingMessage {
  const req = new EventEmitter() as IncomingMessage;
  Object.assign(req, { method, url, headers });
  setTimeout(() => {
    if (body) req.emit('data', body);
    req.emit('end');
  }, 0);
  return req;
}

/** Runs one request through the handler: the status, type and body it answered, or 'next'. */
function ask(handler: ReturnType<typeof photoHandler>, req: IncomingMessage): Promise<{ status: number; type: string; body: unknown } | 'next'> {
  return new Promise((resolve) => {
    const headers: Record<string, string> = {};
    const res = {
      statusCode: 0,
      setHeader: (k: string, v: string) => { headers[k] = v; },
      end: (data: string | Buffer) => {
        const type = headers['Content-Type'] ?? '';
        resolve({ status: res.statusCode, type, body: type === 'application/json' ? (JSON.parse(String(data)) as unknown) : data });
      },
    };
    handler(req, res as unknown as ServerResponse, () => resolve('next'));
  });
}

function fakeServer(over: Partial<PhotoServer> = {}) {
  const files = new Map<string, Buffer>();
  const reads: string[] = [];
  const server: PhotoServer = {
    inDir: 'in',
    outDir: 'out',
    available: () => ({ ok: true }),
    read: (path, title): Promise<SheetResult> => {
      reads.push(`${path} ${title}`);
      return Promise.resolve({ ok: true, imported: { id: 'own-sheet', piece: { hands: 'both' } as never, file: '{"kind":"pianor-piece"}', fileName: 'f', problems: [{ bar: 1, beat: 1, hand: 'RH', what: 'x' }], warnings: [] }, lines: ['report'], saved: 's' });
    },
    readFile: (path) => files.get(path) ?? null,
    writeFile: (path, bytes) => files.set(path, Buffer.from(bytes)),
    ...over,
  };
  return { server, files, reads };
}

describe('the photo import server (ft_Y_04.AC17)', () => {
  it('ft_Y_04.AC17 says whether it reads photos, and leaves other requests alone', async () => {
    const { server } = fakeServer();
    expect(await ask(photoHandler(server), request('GET', PHOTO_API))).toMatchObject({ status: 200, body: { ok: true } });
    expect(await ask(photoHandler(server), request('GET', '/index.html'))).toBe('next');
    const none = fakeServer({ available: () => ({ ok: false, reason: 'no Audiveris' }) }).server;
    expect(await ask(photoHandler(none), request('GET', PHOTO_API))).toMatchObject({ body: { ok: false, reason: 'no Audiveris' } });
    expect(await ask(photoHandler(none), request('POST', `${PHOTO_API}?name=a.jpg`, Buffer.from([1])))).toMatchObject({ body: { ok: false, reason: 'no Audiveris' } });
  });

  it('ft_Y_04.AC17 keeps a photo sent in the input folder and answers with the piece file and what to fill by hand', async () => {
    const { server, files, reads } = fakeServer();
    const answer = await ask(photoHandler(server), request('POST', `${PHOTO_API}?name=${encodeURIComponent('../Väike täht.JPG')}`, Buffer.from([1, 2, 3])));
    expect(answer).toMatchObject({ status: 200, body: { ok: true, id: 'own-sheet', file: '{"kind":"pianor-piece"}', lines: ['report'], hands: 'both', problems: [{ bar: 1 }] } });
    expect([...files.keys()]).toEqual([join('in', 'Väike-täht.JPG')]);
    expect(reads).toEqual([`${join('in', 'Väike-täht.JPG')} Väike täht`]);
  });

  it('ft_Y_04.AC17 refuses what is not a photo, an empty upload, a second photo at once, and says why reading failed', async () => {
    const { server } = fakeServer();
    expect(await ask(photoHandler(server), request('POST', `${PHOTO_API}?name=a.txt`, Buffer.from([1])))).toMatchObject({ body: { ok: false, reason: 'a.txt is not a photo or scan' } });
    expect(await ask(photoHandler(server), request('POST', `${PHOTO_API}?name=a.jpg`))).toMatchObject({ body: { ok: false, reason: 'the photo did not arrive' } });
    let finish: (r: SheetResult) => void = () => undefined;
    const slow = fakeServer({ read: () => new Promise((resolve) => (finish = resolve)) }).server;
    const handler = photoHandler(slow);
    const first = ask(handler, request('POST', `${PHOTO_API}?name=a.jpg&title=Mine`, Buffer.from([1])));
    await new Promise((r) => setTimeout(r, 5));
    expect(await ask(handler, request('POST', `${PHOTO_API}?name=b.jpg`, Buffer.from([1])))).toMatchObject({ body: { ok: false, reason: expect.stringContaining('another photo') as unknown } });
    finish({ ok: false, reason: 'Audiveris could not read it' });
    expect(await first).toMatchObject({ body: { ok: false, reason: 'Audiveris could not read it' } });
    const broken = fakeServer({ read: () => Promise.reject(new Error('disk full')) }).server;
    expect(await ask(photoHandler(broken), request('POST', `${PHOTO_API}?name=a.jpg`, Buffer.from([1])))).toMatchObject({ body: { ok: false, reason: 'disk full' } });
  });

  it('ft_Y_04.AC17 serves a piece\'s bar map and cleaned picture, also for the number an import added to its id', async () => {
    const { server, files } = fakeServer();
    files.set(join('out', 'own-sheet', 'photo.json'), Buffer.from(JSON.stringify({ image: 'sheet-cleaned.png', layout: { width: 1, height: 1, systems: [] } })));
    files.set(join('out', 'own-sheet', 'sheet-cleaned.png'), Buffer.from([137, 80]));
    const handler = photoHandler(server);
    expect(await ask(handler, request('GET', `${PHOTO_API}/own-sheet-2/map`))).toMatchObject({ status: 200, body: { image: 'sheet-cleaned.png' } });
    expect(await ask(handler, request('GET', `${PHOTO_API}/own-sheet/image`))).toMatchObject({ status: 200, type: 'image/png', body: Buffer.from([137, 80]) });
    expect(await ask(handler, request('GET', `${PHOTO_API}/own-sheet/other`))).toMatchObject({ status: 404 });
    expect(await ask(handler, request('GET', `${PHOTO_API}/own-none/map`))).toMatchObject({ status: 200, body: { ok: false } });
    expect(await ask(handler, request('GET', `${PHOTO_API}/own-none/image`))).toMatchObject({ status: 404 });
    expect(await ask(handler, request('GET', `${PHOTO_API}/..%2F..%2Fsecret/map`))).toMatchObject({ status: 200, body: { ok: false } });
    expect(await ask(handler, request('DELETE', `${PHOTO_API}/own-sheet/map`))).toMatchObject({ status: 404 });
  });

  it('ft_Y_04.AC17 takes a photo only from the game\'s own page, and says when a map is damaged', async () => {
    const { server, files } = fakeServer();
    const handler = photoHandler(server);
    const from = (origin: string) => request('POST', `${PHOTO_API}?name=a.jpg`, Buffer.from([1]), { host: '127.0.0.1:4173', origin });
    expect(await ask(handler, from('https://evil.example'))).toMatchObject({ status: 403 });
    expect(await ask(handler, from('not a url'))).toMatchObject({ status: 403 });
    expect(await ask(handler, from('http://127.0.0.1:4173'))).toMatchObject({ status: 200, body: { ok: true } });
    files.set(join('out', 'own-sheet', 'photo.json'), Buffer.from('{ broken'));
    expect(await ask(handler, request('GET', `${PHOTO_API}/own-sheet/map`))).toMatchObject({ body: { ok: false } });
    files.set(join('out', 'own-sheet', 'photo.json'), Buffer.from('{"image":1}'));
    expect(await ask(handler, request('GET', `${PHOTO_API}/own-sheet/map`))).toMatchObject({ body: { ok: false } });
  });

  it('ft_Y_04.AC17 says when the staves do not split evenly into systems', async () => {
    const { server } = fakeServer({ read: () => Promise.resolve({ ok: true, imported: { id: 'own-s', piece: { hands: 'both' } as never, file: '{}', fileName: 'f', problems: [], warnings: [] }, lines: [], saved: 's', stavesUneven: true }) });
    expect(await ask(photoHandler(server), request('POST', `${PHOTO_API}?name=a.jpg`, Buffer.from([1])))).toMatchObject({ body: { ok: true, stavesUneven: true } });
  });

  it('ft_Y_04.AC17 keeps names and ids inside their folders', () => {
    expect(safeName('C:\\Users\\x\\sheet 1.jpg')).toBe('sheet-1.jpg');
    expect(safeName('../..')).toBe('photo.jpg');
    expect(photoDirOf('out', '../x', () => true)).toBeNull();
    expect(photoDirOf('out', 'own-a-3', (p) => p === join('out', 'own-a', 'photo.json'))).toBe(join('out', 'own-a'));
  });

  it('ft_Y_04.AC17 answers on the dev server and the preview server', () => {
    const plugin = photoPlugin(fakeServer().server);
    const used: unknown[] = [];
    const server = { middlewares: { use: (h: unknown) => used.push(h) } };
    (plugin.configureServer as (s: unknown) => void)(server);
    (plugin.configurePreviewServer as (s: unknown) => void)(server);
    expect(used).toHaveLength(2);
  });
});

describe('the photo server on this machine (ft_Y_04.AC17)', () => {
  it('ft_Y_04.AC17 writes and reads its files and reads a MusicXML sheet without Audiveris', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'pianor-photo-'));
    try {
      const server = nodePhotoServer(join(dir, 'in'), join(dir, 'out'));
      server.writeFile(join(dir, 'in', 'x', 'a.bin'), new Uint8Array([7]));
      expect([...(server.readFile(join(dir, 'in', 'x', 'a.bin')) ?? [])]).toEqual([7]);
      expect(server.readFile(join(dir, 'nothing'))).toBeNull();
      expect(typeof server.available().ok).toBe('boolean');
      const score = join(dir, 'in', 'hands.musicxml');
      copyFileSync('tests/fixtures/musicxml/hands-together.musicxml', score);
      const read = await server.read(score, 'Hands', server.outDir);
      expect(read).toMatchObject({ ok: true, imported: { id: 'own-hands' } });
      expect(server.readFile(join(dir, 'out', 'own-hands.pianor-piece.json'))).not.toBeNull();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
