/**
 * The piece maker's photo import (ft_Y_04 slice 4): the game's own server on the computer it runs on (the dev server and the
 * `start:local` preview server, both Vite) takes a photo the piece maker sends, cleans it, runs Audiveris (installed
 * separately, AGPL-3.0, never bundled) and answers with the own piece file and its report, as `npm run piece:photo`
 * does. It also serves the cleaned picture and its bar map, which the piece maker lays behind the staff. Everything stays
 * under the gitignored `private/photo/`. The release zip has no such server: there the piece maker offers no photo import.
 */
import type { IncomingMessage, ServerResponse } from 'node:http';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';
import type { Plugin } from 'vite';
import { readMusicXmlFile } from './analysis/scoreFile.ts';
import { audiverisFound, recognise } from './import/audiveris.ts';
import { PHOTO_IN, PHOTO_MAP, PHOTO_OUT, readSheet, sheetKind, titleOf, type PhotoMap, type SheetResult } from './import/photo.ts';

/** Where the piece maker asks. */
export const PHOTO_API = '/__pianor/photo';
/** A phone photo is a few megabytes; anything far bigger is not a photo of a sheet. */
const MAX_BYTES = 60 * 1024 * 1024;

export interface PhotoServer {
  inDir: string;
  outDir: string;
  /** Audiveris is there, or why not. */
  available(): { ok: true } | { ok: false; reason: string };
  /** Reads one sheet (`readSheet` with the real Audiveris). */
  read(path: string, title: string, outDir: string): Promise<SheetResult>;
  readFile(path: string): Buffer | null;
  writeFile(path: string, bytes: Uint8Array): void;
}

/** A file name that stays inside the folder: its last part, with anything but letters (õ, ä, ö, ü too), digits, dot, dash and underscore made a dash. */
export function safeName(name: string): string {
  const base = basename(name.replace(/\\/g, '/')).replace(/[^\p{L}\p{N}._-]+/gu, '-').replace(/^\.+/, '');
  return base || 'photo.jpg';
}

/** The folder of an own piece's photo: its id, or for an id the piece maker numbered on import (`own-x-2`), the id it came as. */
export function photoDirOf(outDir: string, id: string, exists: (path: string) => boolean): string | null {
  if (!/^own-[a-z0-9-]+$/.test(id)) return null;
  for (const candidate of [id, id.replace(/-\d+$/, '')]) {
    const dir = join(outDir, candidate);
    if (exists(join(dir, PHOTO_MAP))) return dir;
  }
  return null;
}

function send(res: ServerResponse, status: number, body: unknown, type = 'application/json'): void {
  res.statusCode = status;
  res.setHeader('Content-Type', type);
  res.setHeader('Cache-Control', 'no-store');
  res.end(type === 'application/json' ? JSON.stringify(body) : (body as Buffer));
}

function bodyOf(req: IncomingMessage): Promise<Buffer | null> {
  return new Promise((resolve) => {
    const chunks: Buffer[] = [];
    let size = 0;
    req.on('data', (chunk: Buffer) => {
      size += chunk.length;
      if (size <= MAX_BYTES) chunks.push(chunk);
    });
    req.on('end', () => resolve(size > MAX_BYTES ? null : Buffer.concat(chunks)));
    req.on('error', () => resolve(null));
  });
}

/** A bar map file read, or null when there is none or it is damaged. */
function mapIn(bytes: Buffer | null): PhotoMap | null {
  if (!bytes) return null;
  try {
    const map = JSON.parse(bytes.toString('utf8')) as Partial<PhotoMap>;
    return typeof map.image === 'string' && map.layout ? (map as PhotoMap) : null;
  } catch {
    return null;
  }
}

/**
 * A photo may come only from the game's own page: a request from a page of another site carries its own `Origin`. The
 * server runs on the player's machine (d068), possibly on a local network, and a web page open in the same browser could
 * otherwise send it work.
 */
export function sameOrigin(req: IncomingMessage): boolean {
  const origin = req.headers.origin;
  if (!origin) return true;
  try {
    return new URL(origin).host === req.headers.host;
  } catch {
    return false;
  }
}

/** The server's answers: whether it can read photos, a photo read into a piece, and a piece's cleaned picture and bar map. */
export function photoHandler(server: PhotoServer): (req: IncomingMessage, res: ServerResponse, next: () => void) => void {
  let busy = false;
  return (req, res, next) => {
    const url = new URL(req.url ?? '/', 'http://localhost');
    if (url.pathname !== PHOTO_API && !url.pathname.startsWith(`${PHOTO_API}/`)) return next();
    void (async () => {
      if (url.pathname === PHOTO_API && req.method === 'GET') return send(res, 200, server.available());
      if (url.pathname === PHOTO_API && req.method === 'POST') {
        const name = safeName(url.searchParams.get('name') ?? '');
        if (sheetKind(name) !== 'image') return send(res, 200, { ok: false, reason: `${name} is not a photo or scan` });
        if (!sameOrigin(req)) return send(res, 403, { ok: false, reason: 'only the game itself may send a photo' });
        if (busy) return send(res, 200, { ok: false, reason: 'another photo is being read: wait for it' });
        const ready = server.available();
        if (!ready.ok) return send(res, 200, ready);
        // taken before the upload is read, so two photos sent at once never run two Audiveris in one folder
        busy = true;
        try {
          const bytes = await bodyOf(req);
          if (!bytes || bytes.length === 0) return send(res, 200, { ok: false, reason: 'the photo did not arrive' });
          const path = join(server.inDir, name);
          server.writeFile(path, bytes);
          const result = await server.read(path, url.searchParams.get('title')?.trim() || titleOf(name), server.outDir);
          if (!result.ok) return send(res, 200, result);
          const { id, file, problems, piece } = result.imported;
          return send(res, 200, { ok: true, id, file, lines: result.lines, problems, hands: piece.hands, ...(result.stavesUneven ? { stavesUneven: true } : {}) });
        } catch (e) {
          return send(res, 200, { ok: false, reason: e instanceof Error ? e.message : String(e) });
        } finally {
          busy = false;
        }
      }
      // GET /__pianor/photo/<id>/map and /__pianor/photo/<id>/image
      const [, id = '', what = ''] = url.pathname.slice(PHOTO_API.length).split('/');
      const dir = photoDirOf(server.outDir, id, (p) => server.readFile(p) !== null);
      const map = dir ? mapIn(server.readFile(join(dir, PHOTO_MAP))) : null;
      if (req.method !== 'GET') return send(res, 404, { ok: false, reason: 'no such request' });
      // most pieces have no photo: the map says so plainly, so the browser logs no failed request for every piece opened
      if (!dir || !map) return send(res, what === 'map' ? 200 : 404, { ok: false, reason: 'no photo for this piece' });
      if (what === 'map') return send(res, 200, map);
      const image = what === 'image' ? server.readFile(join(dir, safeName(map.image))) : null;
      if (!image) return send(res, 404, { ok: false, reason: 'no such file' });
      return send(res, 200, image, 'image/png');
    })();
  };
}

/** The real server: files under `private/photo/`, Audiveris from `audiveris.ts`. */
export function nodePhotoServer(inDir = PHOTO_IN, outDir = PHOTO_OUT): PhotoServer {
  return {
    inDir,
    outDir,
    available: () => {
      const found = audiverisFound();
      return found.ok ? { ok: true } : found;
    },
    read: (path, title, out) =>
      readSheet(
        {
          recognise: (image, dir) => recognise(image, dir, (line) => console.log(`[photo] ${line}`), () => undefined),
          readScore: readMusicXmlFile,
          write: (file, text) => {
            mkdirSync(dirname(file), { recursive: true });
            writeFileSync(file, text);
          },
        },
        path,
        title,
        out,
      ),
    readFile: (path) => (existsSync(path) ? readFileSync(path) : null),
    writeFile: (path, bytes) => {
      mkdirSync(dirname(path), { recursive: true });
      writeFileSync(path, bytes);
    },
  };
}

/** The photo import on the dev server and the preview server (`start:local`). */
export function photoPlugin(server: PhotoServer = nodePhotoServer()): Plugin {
  const handler = photoHandler(server);
  return {
    name: 'pianor-photo',
    configureServer(dev) {
      dev.middlewares.use(handler);
    },
    configurePreviewServer(preview) {
      preview.middlewares.use(handler);
    },
  };
}
