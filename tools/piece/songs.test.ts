import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { checkSong } from '../../src/core/song/check';
import type { PieceFacts } from '../../src/core/song/resolve';
import { loadLevelsFile } from './levels';
import { lintPieces } from './lintFiles';
import { contentLabelWords, lintSongs } from './songs';

const root = join(__dirname, '../..');
const SONG = { schemaVersion: 1, id: 's', title: 'S', status: 'draft', source: 'original', license: 'CC0-1.0', bpm: 80, key: { fifths: 0, mode: 'major' }, meter: { num: 4, den: 4 } };
const facts = (bpm = 80, fifths = 0): PieceFacts => ({ title: 'P', bars: 4, bpm, key: { fifths, mode: 'major' }, meter: { num: 4, den: 4 }, phrases: [] });
const known: Record<string, PieceFacts> = { p1: facts(), slow: facts(60), gmaj: facts(80, 1) };
const check = (nodes: unknown[], extra: Record<string, unknown> = {}) =>
  checkSong({ file: 's/song.json', text: JSON.stringify({ ...SONG, ...extra, nodes }) }, (id) => known[id], contentLabelWords).diagnostics.map((d) => `${d.severity}: ${d.message}`);

const dirs: string[] = [];
afterAll(() => dirs.forEach((d) => rmSync(d, { recursive: true, force: true })));

describe('song checks in piece:lint', () => {
  it('ft_1_36.AC5 reports a missing piece, a bad link, a duplicate id and a following piece in another tempo or key, naming song and node', () => {
    expect(check([{ kind: 'piece', id: 'a', piece: 'nope' }])).toEqual(['error: song "s", node "a": piece "nope" is not found']);
    expect(check([{ kind: 'link', id: 'l', to: 'a' }, { kind: 'piece', id: 'a', piece: 'p1' }])).toEqual([expect.stringMatching(/^error: song "s": nodes: node "l": a link must point at a piece node before it/)]);
    expect(check([{ kind: 'piece', id: 'a', piece: 'p1' }, { kind: 'blank', id: 'a', name: 'B', bars: 2 }])).toEqual(['error: song "s": nodes: node "a": the id is used twice']);
    expect(check([{ kind: 'piece', id: 'a', piece: 'slow' }])).toEqual(['error: song "s", node "a": piece "slow" is written at 60 BPM and the tempo it follows is 80']);
    expect(check([{ kind: 'piece', id: 'a', piece: 'gmaj' }])).toEqual(['error: song "s", node "a": piece "gmaj" is written in 1 sharp(s) major and the key it follows is 0 sharp(s) major']);
    // A piece with its own value, or under a group with its own, is held to that value.
    expect(check([{ kind: 'piece', id: 'a', piece: 'slow', bpm: 60 }, { kind: 'group', id: 'g', name: 'G', key: { fifths: 1, mode: 'major' }, nodes: [{ kind: 'piece', id: 'b', piece: 'gmaj' }] }])).toEqual([]);
    expect(check([{ kind: 'piece', id: 'a', piece: 'p1', bpm: 70 }])).toEqual(['error: song "s", node "a": piece "p1" is written at 80 BPM and its own tempo is 70']);
    expect(check([{ kind: 'piece', id: 'a', piece: 'p1', key: { fifths: -1, mode: 'minor' } }])).toEqual(['error: song "s", node "a": piece "p1" is written in 0 sharp(s) major and its own key is 1 flat(s) minor']);
  });

  it('warns of a label word not on the ready-made list, and refuses a file that is not JSON', () => {
    expect(check([{ kind: 'piece', id: 'a', piece: 'p1', labels: ['chorus', 'my-riff'] }])).toEqual(['warning: song "s", node "a": the label "my-riff" is not on the ready-made list']);
    expect(checkSong({ file: 'x', text: '{' }, () => undefined, []).diagnostics[0]!.message).toMatch(/^not valid JSON/);
  });

  it('ft_1_36.AC5 reports a piece in two songs and a song id that is not its folder, naming song and node', () => {
    const dir = mkdtempSync(join(tmpdir(), 'songs-'));
    dirs.push(dir);
    const write = (folder: string, song: unknown) => {
      mkdirSync(join(dir, folder), { recursive: true });
      writeFileSync(join(dir, folder, 'song.json'), JSON.stringify(song));
    };
    write('one', { ...SONG, id: 'one', nodes: [{ kind: 'piece', id: 'a', piece: 'p1' }] });
    write('two', { ...SONG, id: 'two', nodes: [{ kind: 'piece', id: 'x', piece: 'p1' }] });
    write('three', { ...SONG, id: 'other', nodes: [{ kind: 'blank', id: 'b', name: 'B', bars: 4 }] });
    const { diagnostics } = lintSongs(dir, (id) => known[id]);
    expect(diagnostics.map((d) => `${d.file}: ${d.message}`)).toEqual([
      'three/song.json: song "other": the id must match the folder name "three"',
      'two/song.json: piece "p1" is in more than one song: song "one", node "a" and song "two", node "x"',
    ]);
  });

  it('the bundled songs pass with the bundled pieces', () => {
    const { levels } = loadLevelsFile(join(root, 'content/curriculum/levels.json'));
    const report = lintPieces(join(root, 'content/pieces'), levels);
    expect(report.songs).toBeGreaterThan(0);
    expect(report.diagnostics.filter((d) => d.severity === 'error' && d.file.endsWith('song.json'))).toEqual([]);
  });
});
