// Covers ft_0_03.AC1, ft_0_03.AC2.
import { existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import fc from 'fast-check';
import { afterAll, describe, expect, it } from 'vitest';
import { parseChart } from '../../src/core/chart';
import { WaitMode } from '../../src/core/judge';
import { compilePiece } from '../../src/core/piece/compile';
import { formatDiagnostic } from '../../src/core/piece/diagnostics';
import { buildPieces } from './files';

const root = join(__dirname, '../..');
const read = (path: string) => readFileSync(join(root, path), 'utf-8');
const piece = (name: string) => ({ abc: read(`tests/fixtures/pieces/${name}/piece.abc`), meta: read(`tests/fixtures/pieces/${name}/piece.meta.json`) });

const META = {
  id: 'test-piece', title: 'Test Piece', level: 1, status: 'draft', hands: ['RH'], phrases: [{ name: 'All', bars: [1, 1] }],
  tags: [], source: 'original', license: 'CC0-1.0', generator: { kind: 'manual' },
};
const abc = (body: string, extra = '') => `X:1\nT:Test Piece\nM:4/4\nL:1/4\nQ:1/4=80\nK:C\n${extra}${body}\n`;
const compile = (body: string, metaPatch: Record<string, unknown> = {}, extra = '') =>
  compilePiece({ abc: abc(body, extra), meta: JSON.stringify({ ...META, ...metaPatch }) });

describe('golden files', () => {
  /** Run with UPDATE_GOLDEN=1 to rewrite the golden files after an intended change, then review the diff. */
  function golden(name: string): void {
    const result = compilePiece(piece(name));
    expect(result.diagnostics).toEqual([]);
    const text = `${JSON.stringify(result.chart, null, 2)}\n`;
    const path = join(root, `tests/golden/${name}.chart.json`);
    if (process.env.UPDATE_GOLDEN === '1') writeFileSync(path, text);
    expect(text).toBe(readFileSync(path, 'utf-8'));
  }

  it('the docs/authoring/au01-piece-files.md example compiles to the golden chart', () => golden('little-steps'));
  it('a two-hand piece compiles to the golden chart', () => golden('hands-together'));

  it('the compiled example is exactly the independently hand-written chart fixture', () => {
    const compiled = compilePiece(piece('little-steps')).chart;
    expect(compiled).toEqual(JSON.parse(read('tests/fixtures/charts/little-steps.v2.json')));
  });

  it('golden charts pass the chart schema', () => {
    for (const name of ['little-steps', 'hands-together']) {
      expect(parseChart(JSON.parse(read(`tests/golden/${name}.chart.json`))).ok).toBe(true);
    }
  });
});

describe('what the compiler produces', () => {
  it('two hands become a play track each, with their clefs, fingerings and the notes of both hands in time order', () => {
    const { chart } = compilePiece(piece('hands-together'));
    expect(chart!.tracks).toEqual([
      { id: 'rh', role: 'play', hand: 'RH', clef: 'treble' },
      { id: 'lh', role: 'play', hand: 'LH', clef: 'bass' },
    ]);
    expect(chart!.notes.map((n) => [n.tick, n.track, n.midi, n.finger])).toEqual([
      [0, 'rh', 60, 1], [0, 'lh', 48, 5], [960, 'rh', 64, 3], [1920, 'rh', 67, 5], [1920, 'lh', 52, 3], [2880, 'lh', 55, 1],
      [3840, 'rh', 65, 4], [3840, 'lh', 55, 1], [4800, 'rh', 62, 2], [5760, 'rh', 60, 1], [5760, 'lh', 48, 5],
    ]);
    expect(chart!.range).toEqual({ low: 48, high: 67 });
  });

  it('the judge reads a compiled two-hand piece as chords across the hands', () => {
    const { chart } = compilePiece(piece('hands-together'));
    const mode = new WaitMode(chart!);
    expect(mode.getState().awaiting).toHaveLength(2); // C4 with the right hand and C3 with the left, together
  });

  it('phrases from the meta file become 0-based bar ranges', () => {
    const { chart } = compile('C D E F | G4 |]', { phrases: [{ name: 'A', bars: [1, 1] }, { name: 'B', bars: [2, 2] }] });
    expect(chart!.phrases).toEqual([{ name: 'A', startBar: 0, endBar: 0 }, { name: 'B', startBar: 1, endBar: 1 }]);
  });

  it('rests, whole-bar rests, ties and chords land in the chart', () => {
    const { chart } = compile('[CE]2 z2 | Z | G2- G2 |]');
    expect(chart!.rests.map((r) => [r.tick, r.dur, r.bar])).toEqual([[960, 960, 0], [1920, 1920, 1]]);
    expect(chart!.notes.filter((n) => n.tieNext).map((n) => n.midi)).toEqual([67]);
    expect(chart!.notes.filter((n) => n.tick === 0).map((n) => n.midi)).toEqual([60, 64]);
  });

  it('takes the content version, level and title from the meta file; the meta title wins over T:', () => {
    const result = compile('C4 |]', { contentVersion: 3, level: 2, title: 'From Meta' });
    expect(result.chart).toMatchObject({ contentVersion: 3, level: 2, title: 'From Meta' });
    expect(result.diagnostics).toEqual([expect.objectContaining({ severity: 'warning', message: expect.stringContaining('differs from the title') })]);
  });

  it('defaults the tempo with a warning when Q: is missing', () => {
    const result = compilePiece({ abc: 'X:1\nM:4/4\nL:1/4\nK:C\nC4 |]\n', meta: JSON.stringify(META) });
    expect(result.chart!.tempoMap).toEqual([{ tick: 0, bpm: 80 }]);
    expect(result.diagnostics).toEqual([expect.objectContaining({ severity: 'warning', message: expect.stringContaining('assuming 80') })]);
  });

  it('a hand not listed in the meta file is accompaniment: the computer plays it', () => {
    const real = compilePiece({
      abc: abc('V:RH\nC4 |]\nV:LH\nC,4 |]', 'V:RH clef=treble\nV:LH clef=bass\n'),
      meta: JSON.stringify({ ...META, hands: ['RH'] }),
    });
    expect(real.diagnostics).toEqual([]);
    expect(real.chart!.tracks.map((t) => [t.id, t.role, t.hand])).toEqual([['rh', 'play', 'RH'], ['lh', 'accompaniment', 'LH']]);
    const mode = new WaitMode(real.chart!);
    expect(mode.getState().awaiting).toHaveLength(1); // the student only plays the right hand
  });

  it('a piece without V: lines is the one hand the meta names; a left-hand piece gets the bass clef', () => {
    const { chart } = compile("C, D, E, F, |]", { hands: ['LH'] });
    expect(chart!.tracks).toEqual([{ id: 'lh', role: 'play', hand: 'LH', clef: 'bass' }]);
  });

  it('a clef on the K: line or the V: line wins over the hand default', () => {
    expect(compile('C4 |]', { hands: ['LH'] }, '').chart!.tracks[0]!.clef).toBe('bass');
    const { chart } = compilePiece({ abc: abc('c4 |]').replace('K:C', 'K:C clef=treble'), meta: JSON.stringify({ ...META, hands: ['LH'] }) });
    expect(chart!.tracks[0]!.clef).toBe('treble');
  });
});

describe('errors', () => {
  const errorsOf = (r: ReturnType<typeof compile>) => r.diagnostics.filter((d) => d.severity === 'error').map(formatDiagnostic);

  it('reports ABC problems with the file, line and column, and returns no chart', () => {
    const result = compile('C D E F | ^ |]');
    expect(result.chart).toBeNull();
    expect(errorsOf(result)).toEqual(['piece.abc:7:11 error: an accidental must be followed by a note']);
  });

  it('reports invalid meta JSON and schema problems against the meta file', () => {
    expect(compilePiece({ abc: abc('C4 |]'), meta: '{ nope' }).diagnostics[0]).toMatchObject({ file: 'piece.meta.json', severity: 'error', message: expect.stringContaining('not valid JSON') });
    const bad = compile('C4 |]', { source: '', id: 'Bad Id', status: 'published' });
    expect(bad.chart).toBeNull();
    const text = errorsOf(bad).join('\n');
    expect(text).toContain('piece.meta.json error: source');
    expect(text).toContain('id: use lowercase words');
    expect(text).toContain('status');
  });

  it('checks voices against the meta file', () => {
    expect(errorsOf(compile('C4 |]', { hands: ['RH', 'LH'] }))).toEqual([expect.stringContaining('a piece without V: lines is for one hand')]);
    const twoVoices = abc('V:RH\nC4 |]', 'V:RH\n');
    expect(compilePiece({ abc: twoVoices, meta: JSON.stringify({ ...META, hands: ['RH', 'LH'] }) }).diagnostics.map((d) => d.message)).toContain('hands lists LH, but the piece has no V:LH voice');
    const odd = compilePiece({ abc: abc('V:SOP\nC4 |]', 'V:SOP\n'), meta: JSON.stringify(META) });
    expect(odd.diagnostics[0]).toMatchObject({ severity: 'error', line: 7, message: expect.stringContaining('voice "SOP" is not supported') });
  });

  it('requires the voices to have the same number of bars', () => {
    const result = compilePiece({
      abc: abc('V:RH\nC4 | D4 |]\nV:LH\nC,4 |]', 'V:RH\nV:LH\n'),
      meta: JSON.stringify({ ...META, hands: ['RH', 'LH'], phrases: [] }),
    });
    expect(result.diagnostics.map((d) => d.message)).toEqual([expect.stringContaining('different numbers of bars (RH has 2, LH has 1)')]);
  });

  it('checks phrases fit the piece', () => {
    expect(errorsOf(compile('C4 |]', { phrases: [{ name: 'Long', bars: [1, 3] }] }))).toEqual([expect.stringContaining('phrase "Long": bars 1 to 3 do not fit a piece of 1 bars')]);
    expect(errorsOf(compile('C4 |]', { phrases: [{ name: 'Backwards', bars: [2, 1] }] }))[0]).toContain('Backwards');
  });

  it('refuses a piece with no notes', () => {
    expect(errorsOf(compile('Z |]'))).toEqual(['piece.abc error: the piece has no notes']);
    expect(errorsOf(compile(''))).toEqual(['piece.abc error: the piece has no music']);
  });

  it('formats diagnostics the way editors jump to them', () => {
    expect(formatDiagnostic({ severity: 'error', file: 'a.abc', line: 3, column: 4, message: 'm' })).toBe('a.abc:3:4 error: m');
    expect(formatDiagnostic({ severity: 'warning', file: 'a.abc', line: 3, message: 'm' })).toBe('a.abc:3 warning: m');
    expect(formatDiagnostic({ severity: 'error', file: 'a.json', message: 'm' })).toBe('a.json error: m');
  });
});

describe('any valid piece compiles to a valid chart (property)', () => {
  const noteArb = fc.tuple(fc.constantFrom('C', 'D', 'E', 'F', 'G', 'A', 'B', 'c', 'd', 'e'), fc.constantFrom('', ',', "'"));
  const barArb = fc.constantFrom([4], [2, 2], [2, 1, 1], [1, 1, 2], [1, 1, 1, 1], [1, 2, 1]).chain((lengths) =>
    fc.tuple(...lengths.map((len) => fc.tuple(noteArb, fc.option(fc.integer({ min: 1, max: 5 }), { nil: undefined }), fc.constant(len)))),
  );

  it('keeps durations, bars, ticks and the judge consistent', () => {
    fc.assert(
      fc.property(fc.array(barArb, { minLength: 1, maxLength: 6 }), (bars) => {
        const body = bars.map((bar) => bar.map(([[letter, mark], finger, len]) => `${finger ? `!${finger}!` : ''}${letter}${mark}${len === 1 ? '' : len}`).join(' ')).join(' | ');
        const result = compile(`${body} |]`, { phrases: [{ name: 'All', bars: [1, bars.length] }] });
        expect(result.diagnostics.filter((d) => d.severity === 'error')).toEqual([]);
        const chart = result.chart!;
        expect(chart.bars).toHaveLength(bars.length);
        for (const bar of chart.bars) {
          const total = chart.notes.filter((n) => n.bar === bar.index).reduce((sum, n) => sum + n.dur, 0);
          expect(total).toBe(1920);
        }
        const ticks = chart.notes.map((n) => n.tick);
        expect(ticks).toEqual([...ticks].sort((a, b) => a - b));
        // the judge can play any compiled piece to the end, note by note
        const mode = new WaitMode(chart);
        chart.notes.forEach((n, i) => mode.handle({ kind: 'on', midi: n.midi, velocity: 80, timeMs: i * 100, source: 'test' }));
        expect(mode.getState().done).toBe(true);
      }),
    );
  });
});

describe('building folders of pieces', () => {
  const dirs: string[] = [];
  const temp = () => {
    const dir = mkdtempSync(join(tmpdir(), 'pianor-'));
    dirs.push(dir);
    return dir;
  };
  afterAll(() => dirs.forEach((d) => rmSync(d, { recursive: true, force: true })));

  it('builds every piece into <id>.chart.json that the game can load', () => {
    const out = temp();
    const report = buildPieces(join(root, 'tests/fixtures/pieces'), out);
    expect(report).toMatchObject({ pieces: 2, diagnostics: [] });
    expect(report.built.map((b) => b.id)).toEqual(['hands-together', 'little-steps']);
    for (const { file } of report.built) expect(parseChart(JSON.parse(readFileSync(file, 'utf-8'))).ok).toBe(true);
  });

  it('writes nothing for a piece with errors, still builds the others, and prefixes diagnostics with the folder', () => {
    const src = temp();
    const out = join(temp(), 'charts');
    mkdirSync(join(src, 'good'));
    writeFileSync(join(src, 'good', 'piece.abc'), abc('C4 |]'));
    writeFileSync(join(src, 'good', 'piece.meta.json'), JSON.stringify({ ...META, id: 'good' }));
    mkdirSync(join(src, 'broken'));
    writeFileSync(join(src, 'broken', 'piece.abc'), abc('^ C4 |]'));
    writeFileSync(join(src, 'broken', 'piece.meta.json'), JSON.stringify({ ...META, id: 'broken' }));
    const report = buildPieces(src, out);
    expect(report.built.map((b) => b.id)).toEqual(['good']);
    expect(existsSync(join(out, 'broken.chart.json'))).toBe(false);
    expect(report.diagnostics.map(formatDiagnostic)).toEqual(['broken/piece.abc:7:1 error: an accidental must be followed by a note']);
  });

  it('requires the folder name to equal the piece id, and a meta file next to the music', () => {
    const src = temp();
    const out = join(temp(), 'charts');
    mkdirSync(join(src, 'folder-name'));
    writeFileSync(join(src, 'folder-name', 'piece.abc'), abc('C4 |]'));
    writeFileSync(join(src, 'folder-name', 'piece.meta.json'), JSON.stringify({ ...META, id: 'other-id' }));
    mkdirSync(join(src, 'no-meta'));
    writeFileSync(join(src, 'no-meta', 'piece.abc'), abc('C4 |]'));
    const report = buildPieces(src, out);
    expect(report.built).toEqual([]);
    expect(report.diagnostics.map((d) => d.message)).toEqual([
      'id "other-id" must match the folder name "folder-name"',
      'missing: every piece needs a piece.meta.json next to piece.abc',
    ]);
  });

  it('does nothing for a missing or empty folder, and ignores folders without piece.abc', () => {
    expect(buildPieces(join(temp(), 'nope'), temp())).toEqual({ pieces: 0, built: [], diagnostics: [] });
    const src = temp();
    mkdirSync(join(src, 'notes'));
    writeFileSync(join(src, 'readme.txt'), 'x');
    expect(buildPieces(src, temp()).pieces).toBe(0);
  });
});

describe('phrases (checkPhrases)', () => {
  const threeBars = 'C D E F | G A B c | C D E F |';
  const messages = (result: ReturnType<typeof compile>) => result.diagnostics.map((d) => d.message);

  it('a phrase must fit the piece: bars 1 to 3 in a one-bar piece are refused', () => {
    const result = compile('C D E F |', { phrases: [{ name: 'All', bars: [1, 3] }] });
    expect(messages(result)).toContain('phrase "All": bars 1 to 3 do not fit a piece of 1 bars');
  });

  it('phrases may nest: a phrase inside another compiles without a phrase error', () => {
    const result = compile(threeBars, { phrases: [{ name: 'Whole', bars: [1, 3] }, { name: 'Inner', bars: [2, 2] }] });
    expect(messages(result).filter((m) => m.includes('phrase'))).toEqual([]);
    expect(result.chart).not.toBeNull();
  });

  it('phrases may not cross: bars 1 to 2 and 2 to 3 are refused, naming both', () => {
    const result = compile(threeBars, { phrases: [{ name: 'A', bars: [1, 2] }, { name: 'B', bars: [2, 3] }] });
    expect(messages(result)).toContain('phrases "A" and "B" cross; parts may nest but not cross');
    expect(result.chart).toBeNull();
  });
});
