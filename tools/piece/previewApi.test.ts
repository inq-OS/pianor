// Covers ft_0_11.AC1.
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { changePieceStatus, previewHandler, readPreviewData } from './previewApi';

const root = join(__dirname, '../..');
const LEVELS = join(root, 'content/curriculum/levels.json');

let dir: string;
const meta = (id: string) => join(dir, id, 'piece.meta.json');
const statusOf = (id: string) => (JSON.parse(readFileSync(meta(id), 'utf-8')) as { status: string }).status;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'pianor-preview-'));
  cpSync(join(root, 'tests/fixtures/pieces/little-steps'), join(dir, 'little-steps'), { recursive: true });
  cpSync(join(root, 'tests/fixtures/pieces/hands-together'), join(dir, 'hands-together'), { recursive: true });
});
afterEach(() => rmSync(dir, { recursive: true, force: true }));

describe('readPreviewData', () => {
  it('gives the text of every piece and the level table, so the page can compile and lint them itself', () => {
    const data = readPreviewData(dir, LEVELS);
    expect(data.pieces.map((p) => p.folder)).toEqual(['hands-together', 'little-steps']);
    const little = data.pieces.find((p) => p.folder === 'little-steps')!;
    expect(little.abc).toContain('K:C');
    expect(JSON.parse(little.meta)).toMatchObject({ id: 'little-steps', status: 'draft' });
    expect(JSON.parse(data.levels)).toMatchObject({ schemaVersion: 1 });
  });

  it('core_08.AC11 gives the text of the learned models it finds, private first, and none when a folder is missing', () => {
    const priv = join(dir, 'private-models');
    mkdirSync(priv);
    writeFileSync(join(priv, 'b.json'), '{"b":1}');
    writeFileSync(join(priv, 'a.json'), '{"a":1}');
    writeFileSync(join(priv, 'notes.txt'), 'x');
    const data = readPreviewData(dir, LEVELS, [priv, join(dir, 'nowhere')]);
    expect(data.models).toEqual([{ file: join(priv, 'a.json'), text: '{"a":1}' }, { file: join(priv, 'b.json'), text: '{"b":1}' }]);
    expect(readPreviewData(dir, LEVELS).models).toEqual([]);
  });

  it('still lists a piece whose meta file is missing, with empty meta, so the page can say what is wrong', () => {
    rmSync(meta('little-steps'));
    expect(readPreviewData(dir, LEVELS).pieces.find((p) => p.folder === 'little-steps')).toMatchObject({ meta: '' });
  });
});

describe('changePieceStatus', () => {
  it('approves a clean draft and changes nothing else in the file', () => {
    const before = readFileSync(meta('little-steps'), 'utf-8');
    expect(changePieceStatus(dir, LEVELS, 'little-steps', 'approved')).toEqual({ ok: true, id: 'little-steps', status: 'approved', changed: true, warnings: 0 });
    expect(statusOf('little-steps')).toBe('approved');
    expect(readFileSync(meta('little-steps'), 'utf-8')).toBe(before.replace('"draft"', '"approved"'));
  });

  it('can send an approved piece back to draft', () => {
    changePieceStatus(dir, LEVELS, 'little-steps', 'approved');
    expect(changePieceStatus(dir, LEVELS, 'little-steps', 'draft')).toMatchObject({ ok: true, status: 'draft', changed: true });
    expect(statusOf('little-steps')).toBe('draft');
  });

  it('says when nothing changed', () => {
    expect(changePieceStatus(dir, LEVELS, 'little-steps', 'draft')).toMatchObject({ ok: true, changed: false });
  });

  it('refuses to approve a piece with lint errors, and leaves the file alone', () => {
    // the right hand plays a note below its level range
    writeFileSync(join(dir, 'little-steps', 'piece.abc'), 'X:1\nT:Little Steps\nM:4/4\nL:1/4\nQ:1/4=80\nK:C\nC, D, E, F, | G,2 F,2 | F, E, D, C, | C,4 |]\n');
    const before = readFileSync(meta('little-steps'), 'utf-8');
    const result = changePieceStatus(dir, LEVELS, 'little-steps', 'approved');
    expect(result).toMatchObject({ ok: false, code: 422 });
    expect(!result.ok && result.message).toMatch(/error/);
    expect(readFileSync(meta('little-steps'), 'utf-8')).toBe(before);
  });

  it('refuses a piece that does not compile', () => {
    writeFileSync(join(dir, 'little-steps', 'piece.abc'), 'X:1\nK:C\nC D E $ |]\n');
    expect(changePieceStatus(dir, LEVELS, 'little-steps', 'approved')).toMatchObject({ ok: false, code: 422 });
  });

  it('counts the warnings a human should have looked at', () => {
    // ends on D, not on the tonic: a no-cadence warning, not an error
    writeFileSync(join(dir, 'little-steps', 'piece.abc'), 'X:1\nT:Little Steps\nM:4/4\nL:1/4\nQ:1/4=80\nK:C\nC D E F | G2 F2 | F E D C | D E D2 |]\n');
    const result = changePieceStatus(dir, LEVELS, 'little-steps', 'approved');
    expect(result).toMatchObject({ ok: true, status: 'approved' });
    expect(result.ok && result.warnings).toBeGreaterThan(0);
  });

  it('refuses unknown pieces and ids that are not plain piece ids (no way out of the pieces folder)', () => {
    expect(changePieceStatus(dir, LEVELS, 'nope', 'approved')).toMatchObject({ ok: false, code: 404 });
    for (const id of ['../little-steps', 'little-steps/..', '..\\x', '', 'Little-Steps', 'a b']) {
      expect(changePieceStatus(dir, LEVELS, id, 'approved'), id).toMatchObject({ ok: false, code: 400 });
    }
  });

  it('refuses when the level table is broken, since the piece cannot be checked', () => {
    const broken = join(dir, 'levels.json');
    writeFileSync(broken, '{ nope');
    expect(changePieceStatus(dir, broken, 'little-steps', 'approved')).toMatchObject({ ok: false, code: 422 });
    expect(statusOf('little-steps')).toBe('draft');
  });

  it('refuses a meta file without a valid status instead of guessing', () => {
    writeFileSync(meta('little-steps'), readFileSync(meta('little-steps'), 'utf-8').replace('"draft"', '"maybe"'));
    expect(changePieceStatus(dir, LEVELS, 'little-steps', 'approved')).toMatchObject({ ok: false });
  });
});

describe('previewHandler over HTTP', () => {
  let server: Server;
  let base: string;
  let host: string;

  beforeAll(async () => {
    server = createServer((req, res) => previewHandler({ piecesDir: dir, levelsPath: LEVELS })(req, res, () => {
      res.statusCode = 418;
      res.end('next');
    }));
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    host = `127.0.0.1:${(server.address() as AddressInfo).port}`;
    base = `http://${host}`;
  });
  afterAll(() => new Promise<void>((resolve) => server.close(() => resolve())));

  const post = (body: unknown, headers: Record<string, string> = {}) =>
    fetch(`${base}/__pianor/status`, { method: 'POST', headers: { 'content-type': 'application/json', ...headers }, body: typeof body === 'string' ? body : JSON.stringify(body) });

  it('serves the piece list as JSON', async () => {
    const res = await fetch(`${base}/__pianor/pieces`);
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('application/json');
    const data = (await res.json()) as { pieces: { folder: string }[]; levels: string };
    expect(data.pieces.map((p) => p.folder)).toEqual(['hands-together', 'little-steps']);
  });

  it('changes a status on request from the page and answers with the result', async () => {
    const res = await post({ id: 'little-steps', status: 'approved' });
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ ok: true, status: 'approved' });
    expect(statusOf('little-steps')).toBe('approved');
  });

  it('answers a refusal with its code and message', async () => {
    const res = await post({ id: 'nope', status: 'approved' });
    expect(res.status).toBe(404);
    expect(await res.json()).toMatchObject({ ok: false });
  });

  it('refuses a request from another site: a wrong Origin, or a form post that is not JSON', async () => {
    expect((await post({ id: 'little-steps', status: 'approved' }, { origin: 'http://evil.example' })).status).toBe(403);
    expect((await post({ id: 'little-steps', status: 'approved' }, { origin: `http://${host}` })).status).toBe(200);
    const form = await fetch(`${base}/__pianor/status`, { method: 'POST', headers: { 'content-type': 'text/plain' }, body: '{"id":"hands-together","status":"approved"}' });
    expect(form.status).toBe(415);
    expect(statusOf('hands-together')).toBe('draft');
  });

  it('refuses bad bodies and wrong methods', async () => {
    expect((await post('not json')).status).toBe(400);
    expect((await post({ id: 'little-steps', status: 'published' })).status).toBe(400);
    expect((await post({ id: 7, status: 'approved' })).status).toBe(400);
    expect((await post('x'.repeat(20_000))).status).toBe(413);
    expect((await fetch(`${base}/__pianor/pieces`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' })).status).toBe(405);
    expect((await fetch(`${base}/__pianor/status`)).status).toBe(405);
  });

  it('passes every other request on', async () => {
    expect((await fetch(`${base}/index.html`)).status).toBe(418);
    expect((await fetch(`${base}/__pianor/other`)).status).toBe(418);
  });
});

describe('the pieces folder is not created by asking', () => {
  it('does not make folders for ids that do not exist', () => {
    const missing = join(dir, 'new-folder');
    mkdirSync(join(dir, 'keep'));
    changePieceStatus(dir, LEVELS, 'new-folder', 'approved');
    expect(() => readFileSync(join(missing, 'piece.meta.json'))).toThrow();
  });
});
