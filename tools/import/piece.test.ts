// Covers ft_Y_04.AC12, ft_Y_04.AC13.
import { describe, expect, it } from 'vitest';
import { join } from 'node:path';
import { musicXmlToChart } from '../../src/core/import/musicxml';
import type { Chart } from '../../src/core/chart';
import { compilePiece } from '../../src/core/piece/compile';
import { readMusicXmlFile } from '../analysis/scoreFile';
import { loadLevelsFile } from '../piece/levels';
import { IMPORT_USAGE, PRIVATE_PIECES, importPiece, parseImportArgs, pieceIdOf, type ImportArgs } from './piece';

const { levels } = loadLevelsFile('content/curriculum/levels.json');
const FIXTURE = 'tests/fixtures/musicxml/hands-together.musicxml';

/** synthetic MusicXML of one part in 4/4, one division to the quarter. */
const xml = (measures: string[], title = 'Wish Song') =>
  `<?xml version="1.0"?><score-partwise version="4.0"><work><work-title>${title}</work-title></work><part-list/><part id="P1">${measures
    .map((m, i) => `<measure number="${i + 1}">${i === 0 ? '<attributes><divisions>3</divisions><key><fifths>0</fifths></key><time><beats>4</beats><beat-type>4</beat-type></time></attributes>' : ''}${m}</measure>`)
    .join('')}</part></score-partwise>`;
const note = (step: string, octave: number, dur: number, extra = '') => `<note>${extra}<pitch><step>${step}</step><octave>${octave}</octave></pitch><duration>${dur}</duration></note>`;
const SCORES: Record<string, string> = {
  'chords.musicxml': xml([`${note('C', 4, 6)}${note('E', 4, 6, '<chord/>')}${note('D', 4, 6)}`, note('C', 4, 12)]),
  'triplet.musicxml': xml([`${note('C', 4, 2)}${note('D', 4, 2)}${note('E', 4, 2)}${note('F', 4, 6)}`, note('C', 4, 12)]),
};

function run(args: Partial<ImportArgs> & { file: string }, existing: string[] = []) {
  const lines: string[] = [];
  const files = new Map<string, string>();
  const ok = importPiece({ out: PRIVATE_PIECES, force: false, ...args }, {
    readScore: (path) => (path === FIXTURE ? readMusicXmlFile(path) : SCORES[path] ? musicXmlToChart(SCORES[path], 'x') : { ok: false, reason: 'no such file' }),
    exists: (path) => existing.includes(path),
    write: (path, text) => void files.set(path, text),
    levels,
    say: (line) => void lines.push(line),
  });
  return { ok, lines, files, text: lines.join('\n') };
}

describe('piece:import arguments', () => {
  it('reads the score and options, with the private folder as the default', () => {
    expect(parseImportArgs(['a.mxl'])).toEqual({ kind: 'ok', file: 'a.mxl', out: PRIVATE_PIECES, force: false });
    expect(parseImportArgs(['a.mxl', '--id', 'x', '--out', 'content/pieces', '--license', 'CC0-1.0', '--source', 'own', '--rh', 'p1s1', '--force']))
      .toEqual({ kind: 'ok', file: 'a.mxl', out: 'content/pieces', id: 'x', license: 'CC0-1.0', source: 'own', rh: 'p1s1', force: true });
    expect(parseImportArgs(['--help'])).toEqual({ kind: 'help' });
    expect(parseImportArgs([])).toEqual({ kind: 'error', message: 'name the score file to import' });
    expect(parseImportArgs(['a', 'b'])).toEqual({ kind: 'error', message: 'one score at a time: a b' });
    expect(parseImportArgs(['a', '--nope'])).toMatchObject({ kind: 'error' });
    expect(IMPORT_USAGE).toContain('--license');
  });

  it('makes a piece id from a title', () => {
    expect(pieceIdOf('Für Elise (easy)!')).toBe('fur-elise-easy');
    expect(pieceIdOf('???')).toBe('imported-piece');
    expect(pieceIdOf('a'.repeat(39) + ' b c')).toBe('a'.repeat(39));
  });
});

describe('a score imported as a game piece (ft_Y_04.AC12)', () => {
  it('ft_Y_04.AC12 writes a draft into the private folder that compiles to the same notes, licence NaN, open from level 1', () => {
    const r = run({ file: FIXTURE });
    expect(r.ok).toBe(true);
    const dir = join(PRIVATE_PIECES, 'hands-together');
    const abc = r.files.get(join(dir, 'piece.abc'))!;
    const meta = JSON.parse(r.files.get(join(dir, 'piece.meta.json'))!);
    expect(meta).toMatchObject({ id: 'hands-together', title: 'Hands Together', status: 'draft', unlockLevel: 1, license: 'NaN', hands: ['RH', 'LH'], tags: ['imported'], source: 'imported from hands-together.musicxml' });
    expect(meta.generator).toEqual({ kind: 'import', params: { format: 'musicxml', file: 'hands-together.musicxml' } });
    const notes = (c: Chart) => c.notes.map((n) => [n.tick, n.midi, n.dur, n.finger]).sort((a, b) => a[0]! - b[0]! || a[1]! - b[1]!);
    const read = readMusicXmlFile(FIXTURE);
    expect(read.ok && notes(compilePiece({ abc, meta: JSON.stringify(meta) }).chart!)).toEqual(read.ok && notes(read.chart));
    expect(r.text).toContain('Imported Hands Together into');
    expect(r.text).toContain(`"status": "approved" in ${join(dir, 'piece.meta.json')}`);
  });

  it('ft_Y_04.AC12 a piece outside every level still goes to the private folder, its level limits counted', () => {
    const r = run({ file: 'chords.musicxml', id: 'wish' });
    expect(r.ok).toBe(true);
    expect(r.text).toMatch(/past the limits of level \d+: /);
    expect(JSON.parse(r.files.get(join(PRIVATE_PIECES, 'wish', 'piece.meta.json'))!).title).toBe('Wish Song');
  });

  it('ft_Y_04.AC12 into content/pieces only with an open licence, a source and a level it passes', () => {
    expect(run({ file: FIXTURE, out: 'content/pieces' }).text).toContain('needs --license');
    expect(run({ file: FIXTURE, out: 'content/pieces', license: 'NaN' }).ok).toBe(false);
    expect(run({ file: FIXTURE, out: 'content/pieces', license: 'CC0-1.0' }).text).toContain('needs --source');
    const shared = run({ file: FIXTURE, out: 'content/pieces', license: 'CC0-1.0', source: 'synthetic test score', id: 'shared-test' });
    expect(shared.ok).toBe(true);
    const meta = JSON.parse(shared.files.get(join('content/pieces', 'shared-test', 'piece.meta.json'))!);
    expect(meta).toMatchObject({ license: 'CC0-1.0', source: 'synthetic test score', status: 'draft' });
    expect(meta.unlockLevel).toBeUndefined();
    const chords = run({ file: 'chords.musicxml', out: 'content/pieces', license: 'CC0-1.0', source: 'synthetic' });
    expect(chords.ok).toBe(false);
    expect(chords.text).toContain('it fits no level of the curriculum');
  });
});

describe('what piece:import refuses (ft_Y_04.AC13)', () => {
  it('ft_Y_04.AC13 lists every place to fix in the score and writes nothing', () => {
    const r = run({ file: 'triplet.musicxml' });
    expect(r.ok).toBe(false);
    expect(r.files.size).toBe(0);
    expect(r.lines[0]).toBe('Not imported: 3 places the game cannot write yet.');
    expect(r.lines[1]).toBe('  bar 1, beat 1 (right hand): a triplet or another tuplet');
    expect(r.text).toContain('Fix these in the score');
  });

  it('ft_Y_04.AC13 refuses an unreadable score, a taken folder or id, a bad id, and says how to choose parts', () => {
    expect(run({ file: 'missing.mxl' }).text).toBe('Not imported: missing.mxl could not be read: no such file');
    expect(run({ file: FIXTURE }, [join(PRIVATE_PIECES, 'hands-together')]).text).toContain('is already there');
    expect(run({ file: FIXTURE, force: true }, [join(PRIVATE_PIECES, 'hands-together')]).ok).toBe(true);
    expect(run({ file: FIXTURE }, [join('content', 'pieces', 'hands-together')]).text).toContain('the game already has a piece "hands-together"');
    expect(run({ file: FIXTURE, id: 'Bad Id' }).text).toContain('must be lowercase words joined by dashes');
    const parts = run({ file: FIXTURE, rh: 'p9s9' });
    expect(parts.text).toContain('there is no part "p9s9"');
  });
});
