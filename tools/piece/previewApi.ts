import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { join } from 'node:path';
import { hasErrors, formatDiagnostic } from '../../src/core/piece/diagnostics.ts';
import { checkPieceFolder, listPieceFolders } from './folder.ts';
import { loadLevelsFile } from './levels.ts';
import { readStatus, withStatus, type PieceStatus } from '../../src/core/piece/status.ts';

/** What the preview page needs of one piece folder: the text of both files. */
export interface PieceSource {
  folder: string;
  abc: string;
  /** Empty when the meta file is missing. */
  meta: string;
}

export interface PreviewData {
  /** Text of `levels.json`. */
  levels: string;
  pieces: PieceSource[];
  /** Learned difficulty models (core_08.AC11) as their files' text: the page checks them. Dev server only, so a private model never reaches a build. */
  models: { file: string; text: string }[];
}

export interface PreviewPaths {
  piecesDir: string;
  levelsPath: string;
  /** Folders of learned models, private first (`private/models`, then `content/models`). */
  modelsDirs?: string[];
}

const readOrEmpty = (path: string): string => {
  try {
    return readFileSync(path, 'utf-8');
  } catch {
    return '';
  }
};

/** Everything the preview page compiles and lints in the browser: the files as they are on disk now. */
export function readPreviewData(piecesDir: string, levelsPath: string, modelsDirs: readonly string[] = []): PreviewData {
  return {
    models: modelsDirs.flatMap((dir) =>
      existsSync(dir)
        ? readdirSync(dir)
            .filter((f) => f.endsWith('.json'))
            .sort()
            .map((f) => ({ file: join(dir, f), text: readOrEmpty(join(dir, f)) }))
        : [],
    ),
    levels: readOrEmpty(levelsPath),
    pieces: listPieceFolders(piecesDir).map((folder) => ({
      folder,
      abc: readOrEmpty(join(piecesDir, folder, 'piece.abc')),
      meta: readOrEmpty(join(piecesDir, folder, 'piece.meta.json')),
    })),
  };
}

export type StatusResult =
  | { ok: true; id: string; status: PieceStatus; changed: boolean; warnings: number }
  | { ok: false; code: 400 | 404 | 422; message: string };

const PIECE_ID = /^[a-z0-9]+(-[a-z0-9]+)*$/;

/**
 * Set the status of a piece in its `piece.meta.json`. Only a human may approve a piece (the page asks first): this is the
 * one place that writes the status, and it checks the piece itself. Approving needs a piece that compiles and passes the
 * linter for its level with no error (warnings are for the human to have read); sending a piece back to draft always works.
 */
export function changePieceStatus(piecesDir: string, levelsPath: string, id: string, status: PieceStatus): StatusResult {
  if (!PIECE_ID.test(id)) return { ok: false, code: 400, message: `"${id}" is not a piece id (lowercase words joined by dashes)` };
  if (!listPieceFolders(piecesDir).includes(id)) return { ok: false, code: 404, message: `there is no piece "${id}"` };

  let warnings = 0;
  if (status === 'approved') {
    const loaded = loadLevelsFile(levelsPath);
    const problems = loaded.diagnostics;
    if (hasErrors(problems)) return { ok: false, code: 422, message: `the level table has errors, so the piece cannot be checked: ${problems.map(formatDiagnostic).join('; ')}` };
    const check = checkPieceFolder(piecesDir, id, loaded.levels);
    if (!check.ok) {
      const errors = check.diagnostics.filter((d) => d.severity === 'error');
      return { ok: false, code: 422, message: `${errors.length} error(s), so it cannot be approved: ${errors.slice(0, 3).map(formatDiagnostic).join('; ')}` };
    }
    warnings = check.diagnostics.filter((d) => d.severity === 'warning').length;
  }

  const metaPath = join(piecesDir, id, 'piece.meta.json');
  const text = readOrEmpty(metaPath);
  if (readStatus(text) === null) return { ok: false, code: 422, message: 'the meta file has no valid "status", so it cannot be changed' };
  const edit = withStatus(text, status);
  if (!edit.ok) return { ok: false, code: 422, message: edit.message };
  if (!edit.unchanged) writeFileSync(metaPath, edit.text);
  return { ok: true, id, status, changed: !edit.unchanged, warnings };
}

const MAX_BODY = 10_000;

function send(res: ServerResponse, code: number, body: unknown): void {
  res.statusCode = code;
  res.setHeader('content-type', 'application/json');
  res.end(JSON.stringify(body));
}

/** Reads a request body up to `MAX_BODY` bytes; null when it is longer. */
function readBody(req: IncomingMessage): Promise<string | null> {
  return new Promise((resolve) => {
    let body = '';
    let tooLong = false;
    req.on('data', (chunk: Buffer) => {
      if (tooLong) return;
      body += chunk.toString('utf-8');
      if (body.length > MAX_BODY) tooLong = true;
    });
    req.on('end', () => resolve(tooLong ? null : body));
    req.on('error', () => resolve(null));
  });
}

/**
 * The preview tool's two requests, for the Vite dev server (never the production build): `GET /__pianor/pieces` and
 * `POST /__pianor/status`, mounted at the root of the server. The write needs a JSON body and, when the browser names an origin, the same host as the
 * page, so another website open in the same browser cannot approve pieces. Anything else goes on to the next handler.
 */
export function previewHandler(paths: PreviewPaths): (req: IncomingMessage, res: ServerResponse, next: () => void) => void {
  return (req, res, next) => {
    const route = (req.url ?? '').split('?')[0];
    const isPieces = route === '/__pianor/pieces';
    const isStatus = route === '/__pianor/status';
    if (!isPieces && !isStatus) return next();

    if (isPieces) {
      if (req.method !== 'GET') return send(res, 405, { ok: false, message: 'use GET' });
      return send(res, 200, readPreviewData(paths.piecesDir, paths.levelsPath, paths.modelsDirs));
    }

    if (req.method !== 'POST') return send(res, 405, { ok: false, message: 'use POST' });
    const origin = req.headers.origin;
    if (origin !== undefined) {
      let sameHost: boolean;
      try {
        sameHost = new URL(origin).host === req.headers.host;
      } catch {
        sameHost = false;
      }
      if (!sameHost) return send(res, 403, { ok: false, message: 'this request comes from another site' });
    }
    if (!(req.headers['content-type'] ?? '').startsWith('application/json')) return send(res, 415, { ok: false, message: 'send JSON' });
    void readBody(req).then((body) => {
      if (body === null) return send(res, 413, { ok: false, message: 'the request is too long' });
      let parsed: { id?: unknown; status?: unknown };
      try {
        parsed = JSON.parse(body) as typeof parsed;
      } catch {
        return send(res, 400, { ok: false, message: 'the body is not valid JSON' });
      }
      if (typeof parsed.id !== 'string' || (parsed.status !== 'draft' && parsed.status !== 'approved')) {
        return send(res, 400, { ok: false, message: 'send { "id": string, "status": "draft" | "approved" }' });
      }
      const result = changePieceStatus(paths.piecesDir, paths.levelsPath, parsed.id, parsed.status);
      return send(res, result.ok ? 200 : result.code, result);
    });
  };
}
