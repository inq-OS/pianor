import { cpSync, existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { pieceMetaSchema } from '../../src/core/chart';
import { loadLevelsFile } from '../piece/levels';
import { lintPieces } from '../piece/lintFiles';
import { loadAvoid, runCli, writeGenerated } from './run';
import { generatePiece, pieceId } from './index';

const root = join(__dirname, '../..');
const LEVELS = join(root, 'content/curriculum/levels.json');
const { levels } = loadLevelsFile(LEVELS);

let dir: string;
let out: string[];
let err: string[];
const io = { out: (line: string) => out.push(line), err: (line: string) => err.push(line) };
const run = (...args: string[]) => runCli([...args, '--out', dir, '--levels', LEVELS], io);

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'pianor-generate-'));
  out = [];
  err = [];
});
afterEach(() => rmSync(dir, { recursive: true, force: true }));

describe('writeGenerated', () => {
  it('writes the two files of the piece into a folder named after its id, and refuses to overwrite', () => {
    const piece = generatePiece({ kind: 'scale', level: 1, seed: 1 }, { levels });
    const result = writeGenerated(dir, piece, {});
    expect(result.folder).toBe(join(dir, piece.id));
    expect(readFileSync(join(dir, piece.id, 'piece.abc'), 'utf-8')).toBe(piece.abc);
    expect(readFileSync(join(dir, piece.id, 'piece.meta.json'), 'utf-8')).toBe(piece.metaJson);
    expect(() => writeGenerated(dir, piece, {})).toThrow(/already exists/);
    writeFileSync(join(dir, piece.id, 'piece.abc'), 'changed');
    writeGenerated(dir, piece, { force: true });
    expect(readFileSync(join(dir, piece.id, 'piece.abc'), 'utf-8')).toBe(piece.abc);
  });
});

describe('loadAvoid', () => {
  it('collects the runs of eight notes of the pieces people wrote, and skips a piece a generator made', () => {
    cpSync(join(root, 'content/pieces/ode-to-joy'), join(dir, 'ode-to-joy'), { recursive: true });
    const withTune = loadAvoid(dir, levels);
    expect(withTune.size).toBeGreaterThan(10);
    writeGenerated(dir, generatePiece({ kind: 'reading-drill', level: 1, seed: 2 }, { levels }), {});
    expect(loadAvoid(dir, levels).size).toBe(withTune.size);
  });

  it('is empty for a folder that does not exist', () => {
    expect(loadAvoid(join(dir, 'nope'), levels).size).toBe(0);
  });
});

describe('piece:generate', () => {
  it('makes a piece, writes it, and says what to do next', () => {
    expect(run('phrase', '--level', '1', '--seed', '5')).toBe(0);
    expect(existsSync(join(dir, 'gen-phrase-l1-rh-s5', 'piece.abc'))).toBe(true);
    const text = out.join('\n');
    expect(text).toContain('gen-phrase-l1-rh-s5');
    expect(text).toContain('draft');
    expect(text).toContain('piece:preview');
    expect(err).toEqual([]);
  });

  it('writes pieces that piece:lint accepts with nothing to report', () => {
    for (const [kind, level, extra] of [['five-finger', '1', []], ['scale', '2', ['--hand', 'LH']], ['echo', '4', ['--hand', 'both']]] as const) {
      expect(run(kind, '--level', level, '--seed', '9', ...extra)).toBe(0);
    }
    const report = lintPieces(dir, levels);
    expect(report.pieces).toBe(3);
    expect(report.diagnostics).toEqual([]);
  });

  it('prints instead of writing with --print', () => {
    expect(run('five-finger', '--level', '1', '--seed', '2', '--print')).toBe(0);
    expect(existsSync(join(dir, 'gen-five-finger-l1-rh-s2'))).toBe(false);
    expect(out.join('\n')).toContain('K:C');
    expect(out.join('\n')).toContain('"status": "draft"');
  });

  it('will not overwrite a piece unless told to', () => {
    expect(run('scale', '--level', '1', '--seed', '3')).toBe(0);
    expect(run('scale', '--level', '1', '--seed', '3')).toBe(1);
    expect(err.join('\n')).toContain('already exists');
    expect(run('scale', '--level', '1', '--seed', '3', '--force')).toBe(0);
  });

  it('passes the options on: hand, bars, meter, pattern and motif', () => {
    expect(run('phrase', '--level', '3', '--seed', '1', '--bars', '4', '--meter', '4/4', '--motif', '0 1 2 1')).toBe(0);
    expect(run('five-finger', '--level', '3', '--seed', '1', '--pattern', 'skips', '--meter', '3/4')).toBe(0);
    const id = pieceId({ kind: 'phrase', level: 3, seed: 1, bars: 4, meter: '4/4', motif: '0 1 2 1' }, 'rh');
    const meta = pieceMetaSchema.parse(JSON.parse(readFileSync(join(dir, id, 'piece.meta.json'), 'utf-8')));
    expect(meta.generator.params).toMatchObject({ level: 3, bars: 4, meter: '4/4', motif: '0 1 2 1' });
  });

  it('chooses a seed when none is given and says which, so the piece can be made again', () => {
    expect(run('scale', '--level', '1')).toBe(0);
    expect(out.join('\n')).toMatch(/seed \d+/);
  });

  it('explains a bad request instead of failing with a stack trace', () => {
    expect(run('scale')).toBe(2);
    expect(err.join('\n')).toContain('--level');
    err.length = 0;
    expect(run('nope', '--level', '1', '--seed', '1')).toBe(2);
    expect(err.join('\n')).toContain('unknown generator');
    err.length = 0;
    expect(run('scale', '--level', '1', '--seed', '1', '--hand', 'LH')).toBe(2);
    expect(err.join('\n')).toContain('does not use the left hand');
    err.length = 0;
    expect(run('scale', '--level', 'x', '--seed', '1')).toBe(2);
    expect(run('scale', '--level', '1', '--wat')).toBe(2);
  });

  it('refuses bars that are not a whole number, a missing generator name and a broken level table', () => {
    expect(run('scale', '--level', '1', '--seed', '1', '--bars', 'four')).toBe(2);
    expect(err.join('\n')).toContain('--bars must be a whole number');
    err.length = 0;
    expect(run('--level', '1')).toBe(2);
    expect(err.join('\n')).toContain('say which generator');
    err.length = 0;
    const badLevels = join(dir, 'levels.json');
    writeFileSync(badLevels, '{"schemaVersion": 1, "levels": "nope"}');
    expect(runCli(['scale', '--level', '1', '--out', dir, '--levels', badLevels], io)).toBe(2);
    expect(err.join('\n')).toContain('level table has errors');
  });

  it('prints the help and exits with 0', () => {
    expect(runCli(['--help'], io)).toBe(0);
    expect(out.join('\n')).toContain('Usage:');
  });

  it('accepts a word as a seed, and the same word makes the same piece', () => {
    expect(run('scale', '--level', '1', '--seed', 'moon', '--print')).toBe(0);
    const first = out.join('\n');
    out.length = 0;
    expect(run('scale', '--level', '1', '--seed', 'moon', '--print')).toBe(0);
    expect(out.join('\n')).toBe(first);
  });

  it('lists the generators', () => {
    expect(runCli(['--list'], io)).toBe(0);
    expect(out.join('\n')).toContain('five-finger');
    expect(out.join('\n')).toContain('phrase');
  });
});

describe('piece:generate --regenerate', () => {
  it('says a generated piece is unchanged when the generator still makes the same files', () => {
    run('echo', '--level', '1', '--seed', '4');
    out.length = 0;
    expect(run('--regenerate', 'gen-echo-l1-rh-s4')).toBe(0);
    expect(out.join('\n')).toContain('identical');
  });

  it('says so, and exits with 1, when the files differ from what the generator makes now', () => {
    run('scale', '--level', '1', '--seed', '4');
    writeFileSync(join(dir, 'gen-scale-l1-rh-s4', 'piece.abc'), 'X:1\nK:C\nC D E F |]\n');
    out.length = 0;
    expect(run('--regenerate', 'gen-scale-l1-rh-s4')).toBe(1);
    expect(out.join('\n')).toContain('differs');
    expect(run('--regenerate', 'gen-scale-l1-rh-s4', '--force')).toBe(0);
    expect(run('--regenerate', 'gen-scale-l1-rh-s4')).toBe(0);
  });

  it('refuses a piece a generator did not make, and one that does not exist', () => {
    cpSync(join(root, 'tests/fixtures/pieces/little-steps'), join(dir, 'little-steps'), { recursive: true });
    expect(run('--regenerate', 'little-steps')).toBe(2);
    expect(err.join('\n')).toContain('not a generator');
    expect(run('--regenerate', 'nope')).toBe(2);
    expect(err.join('\n')).toContain('no piece');
  });

  it('explains a meta file that is not valid instead of failing with a stack trace', () => {
    run('scale', '--level', '1', '--seed', '4');
    writeFileSync(join(dir, 'gen-scale-l1-rh-s4', 'piece.meta.json'), '{"id": 1}');
    expect(run('--regenerate', 'gen-scale-l1-rh-s4')).toBe(2);
    expect(err.join('\n')).toContain('not valid');
    err.length = 0;
    writeFileSync(join(dir, 'gen-scale-l1-rh-s4', 'piece.meta.json'), '{ not json');
    expect(run('--regenerate', 'gen-scale-l1-rh-s4')).toBe(2);
    expect(err.join('\n')).toContain('not valid');
  });
});
