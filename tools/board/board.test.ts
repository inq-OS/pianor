// Covers ft_0_11.AC3.
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { loadLevelsFile } from '../piece/levels';
import { ABCJS_URL, applyPicks, boardPieces, parsePicks, pieceHash, renderBoard, scriptJson } from './board';

const root = join(__dirname, '../..');
const LEVELS = join(root, 'content/curriculum/levels.json');
const { levels } = loadLevelsFile(LEVELS);

let dir: string;
const metaPath = (id: string) => join(dir, id, 'piece.meta.json');
const statusOf = (id: string) => (JSON.parse(readFileSync(metaPath(id), 'utf-8')) as { status: string }).status;
const hashOf = (id: string) => pieceHash(readFileSync(join(dir, id, 'piece.abc'), 'utf-8'), readFileSync(metaPath(id), 'utf-8'));
const setStatus = (id: string, status: string) => writeFileSync(metaPath(id), readFileSync(metaPath(id), 'utf-8').replace('"draft"', `"${status}"`));

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'pianor-board-'));
  cpSync(join(root, 'tests/fixtures/pieces/little-steps'), join(dir, 'little-steps'), { recursive: true });
  cpSync(join(root, 'tests/fixtures/pieces/hands-together'), join(dir, 'hands-together'), { recursive: true });
});
afterEach(() => rmSync(dir, { recursive: true, force: true }));

describe('boardPieces', () => {
  it('ft_0_11.AC3 puts every draft on the board with its sheet, its sounding notes in seconds and a fingerprint', () => {
    setStatus('hands-together', 'approved');
    const { pieces, refused } = boardPieces(dir, levels);
    expect(refused).toEqual([]);
    expect(pieces.map((p) => p.id)).toEqual(['little-steps']);
    const little = pieces[0]!;
    expect(little).toMatchObject({ title: 'Little Steps', bpm: 70, hands: ['RH'], hash: hashOf('little-steps') });
    expect(little.abc).toContain('!1!C !2!D');
    // a quarter note at 70 bpm lasts 60 / 70 seconds
    expect(little.notes.slice(0, 2)).toEqual([
      { t: 0, d: 0.857, midi: 60, play: true },
      { t: 0.857, d: 0.857, midi: 62, play: true },
    ]);
  });

  it('shows the warnings the maintainer should read before approving', () => {
    writeFileSync(join(dir, 'little-steps', 'piece.abc'), readFileSync(join(dir, 'little-steps', 'piece.abc'), 'utf-8').replace('Q:1/4=70\n', ''));
    const little = boardPieces(dir, levels).pieces.find((p) => p.id === 'little-steps')!;
    expect(little.warnings.join(' ')).toMatch(/Q:|tempo/);
  });

  it('plays both hands of a two-hand piece', () => {
    const together = boardPieces(dir, levels).pieces.find((p) => p.id === 'hands-together')!;
    expect(together.notes.filter((n) => n.t === 0).map((n) => n.midi).sort()).toEqual([48, 60]);
  });

  it('leaves out a draft with an error or without a meta file, and says why', () => {
    writeFileSync(join(dir, 'little-steps', 'piece.abc'), 'X:1\nT:Little Steps\nM:4/4\nL:1/4\nK:C\nC D E F G |]\n');
    mkdirSync(join(dir, 'lonely'));
    writeFileSync(join(dir, 'lonely', 'piece.abc'), 'X:1\nK:C\nC4 |]\n');
    const { pieces, refused } = boardPieces(dir, levels);
    expect(pieces.map((p) => p.id)).toEqual(['hands-together']);
    expect(refused.map((r) => r.id)).toEqual(['little-steps', 'lonely']);
    expect(refused[1]!.reason).toContain('piece.meta.json');
  });
});

describe('renderBoard', () => {
  it('writes one page that loads the pinned renderer and carries the pieces as data', () => {
    const html = renderBoard(boardPieces(dir, levels), 'today');
    expect(html).toContain(`<script src="${ABCJS_URL}"></script>`);
    expect(html).toContain('"id":"little-steps"');
    expect(html).not.toContain('__DATA__');
  });

  it('keeps any text in a piece from ending the page script', () => {
    expect(scriptJson({ abc: '% </script><!-- & \u2028' })).toBe('{"abc":"% \\u003c/script\\u003e\\u003c!-- \\u0026 \\u2028"}');
    const content = boardPieces(dir, levels);
    content.pieces[0]!.abc += '\n% </script><script>alert(1)</script>';
    expect(renderBoard(content, 'today').match(/<\/script>/g)).toHaveLength(2);
  });
});

describe('parsePicks', () => {
  it('reads a list of picks or an object holding one, and drops an empty note', () => {
    const one = { id: 'a', pick: 'approve', hash: 'h', note: '  ' };
    expect(parsePicks(JSON.stringify([one]))).toEqual([{ id: 'a', pick: 'approve', hash: 'h' }]);
    expect(parsePicks(JSON.stringify({ picks: [{ ...one, pick: 'draft', note: ' slower ' }] }))).toEqual([{ id: 'a', pick: 'draft', hash: 'h', note: 'slower' }]);
  });

  it('refuses anything that is not a pick', () => {
    expect(() => parsePicks('{}')).toThrow(/list of picks/);
    expect(() => parsePicks('null')).toThrow(/list of picks/);
    expect(() => parsePicks('[{"id":"a","pick":"yes","hash":"h"}]')).toThrow(/pick 1/);
    expect(() => parsePicks('[null]')).toThrow(/pick 1/);
  });
});

describe('applyPicks', () => {
  it('ft_0_11.AC3 approves a piece the maintainer picked on the board and keeps a "not yet" piece a draft with its note', () => {
    const results = applyPicks(dir, LEVELS, [
      { id: 'little-steps', pick: 'approve', hash: hashOf('little-steps') },
      { id: 'hands-together', pick: 'draft', hash: hashOf('hands-together'), note: 'left hand too low' },
      { id: 'hands-together-2', pick: 'draft', hash: 'x' },
    ]);
    expect(results).toEqual([
      { id: 'little-steps', outcome: 'approved', warnings: expect.any(Number) },
      { id: 'hands-together', outcome: 'kept-draft', note: 'left hand too low' },
      { id: 'hands-together-2', outcome: 'refused', reason: 'there is no such piece' },
    ]);
    expect(statusOf('little-steps')).toBe('approved');
    expect(statusOf('hands-together')).toBe('draft');
  });

  it('ft_0_11.AC3 never approves a piece whose files changed after the board showed it', () => {
    const seen = hashOf('little-steps');
    writeFileSync(join(dir, 'little-steps', 'piece.abc'), readFileSync(join(dir, 'little-steps', 'piece.abc'), 'utf-8').replace('!5!G2', '!5!G2 '));
    const [result] = applyPicks(dir, LEVELS, [{ id: 'little-steps', pick: 'approve', hash: seen }]);
    expect(result).toMatchObject({ outcome: 'refused', reason: expect.stringContaining('changed') });
    expect(statusOf('little-steps')).toBe('draft');
  });

  it('refuses a picked piece that does not pass its check, and takes an approved piece as done', () => {
    writeFileSync(join(dir, 'little-steps', 'piece.abc'), 'X:1\nT:Little Steps\nM:4/4\nL:1/4\nK:C\nC D E F G |]\n');
    setStatus('hands-together', 'approved');
    const results = applyPicks(dir, LEVELS, [
      { id: 'little-steps', pick: 'approve', hash: hashOf('little-steps') },
      { id: 'hands-together', pick: 'approve', hash: 'old' },
    ]);
    expect(results[0]).toMatchObject({ outcome: 'refused', reason: expect.stringContaining('cannot be approved') });
    expect(results[1]).toEqual({ id: 'hands-together', outcome: 'approved', warnings: 0 });
    expect(statusOf('little-steps')).toBe('draft');
  });
});
