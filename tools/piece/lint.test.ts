// Covers ft_0_04.AC1, ft_0_04.AC2.
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import type { Chart, LevelDefinition } from '../../src/core/chart';
import { compilePiece } from '../../src/core/piece/compile';
import { difficultyOf } from '../../src/core/piece/difficulty';
import { formatDiagnostic, type Diagnostic } from '../../src/core/piece/diagnostics';
import { lintPieces } from './lintFiles';
import { lintPiece } from '../../src/core/piece/lintRules';
import { loadLevelsFile, parseLevels } from './levels';
import { contentStyles } from './styles';

const root = join(__dirname, '../..');
const LEVELS_PATH = join(root, 'content/curriculum/levels.json');
const { levels } = loadLevelsFile(LEVELS_PATH);
const level = (n: number): LevelDefinition => levels.find((l) => l.level === n)!;

const META = {
  id: 'test-piece', title: 'Test Piece', level: 1, status: 'draft', hands: ['RH'], phrases: [{ name: 'All', bars: [1, 4] }],
  styles: ['original'], tags: [], source: 'original', license: 'CC0-1.0', generator: { kind: 'manual' },
};

interface Options {
  level?: number | LevelDefinition;
  meta?: Record<string, unknown>;
  meter?: string;
  header?: string;
  /** The ABC key, C if left out. */
  key?: string;
  privatePiece?: boolean;
}

/** Compile an ABC body (right hand unless the meta says otherwise) and lint it. */
function lint(body: string, options: Options = {}): { diagnostics: Diagnostic[]; chart: Chart } {
  const meta = { ...META, ...options.meta };
  const abc = `X:1\nT:Test Piece\nM:${options.meter ?? '4/4'}\nL:1/4\nQ:1/4=80\nK:${options.key ?? 'C'}\n${options.header ?? ''}${body}\n`;
  const compiled = compilePiece({ abc, meta: JSON.stringify(meta) });
  expect(compiled.diagnostics.filter((d) => d.severity === 'error').map(formatDiagnostic), 'the test piece must compile').toEqual([]);
  const lv = typeof options.level === 'object' ? options.level : level(options.level ?? (meta.level));
  return { diagnostics: lintPiece({ styles: contentStyles, chart: compiled.chart!, meta: compiled.meta!, level: lv, sources: compiled.sources, ...(options.privatePiece ? { privatePiece: true } : {}) }), chart: compiled.chart! };
}

const errors = (d: Diagnostic[]) => d.filter((x) => x.severity === 'error');
const rules = (d: Diagnostic[], severity: Diagnostic['severity'] = 'error') => d.filter((x) => x.severity === severity).map((x) => x.rule);

/** A clean level-1 piece to start from. */
const GOOD = 'C D E F | G2 F2 | F E D C | C4 |]';

describe('levels.json', () => {
  it('loads the provisional starter table without problems, in order', () => {
    const loaded = loadLevelsFile(LEVELS_PATH);
    expect(loaded.diagnostics).toEqual([]);
    expect(loaded.levels.map((l) => l.level)).toEqual([1, 2, 3, 4, 5, 6]);
    expect(JSON.parse(readFileSync(LEVELS_PATH, 'utf-8')).note).toMatch(/PROVISIONAL/);
  });

  it('switches all notation on at every level: chords, rests, ties, triplets, ornaments, two voices a hand and hands together', () => {
    for (const l of loadLevelsFile(LEVELS_PATH).levels) {
      expect({ chords: l.chords, rests: l.rests, ties: l.ties, tuplets: l.tuplets, ornaments: l.ornaments, voices: l.voices, handsTogether: l.handsTogether }, `level ${l.level}`).toEqual({ chords: true, rests: true, ties: true, tuplets: true, ornaments: true, voices: 2, handsTogether: true });
    }
  });

  it('matches the starter table in docs/authoring/au04-levels.md', () => {
    expect(level(1)).toMatchObject({ hands: ['RH'], clefs: ['treble'], range: { low: 60, high: 67 }, rests: true, maxLeapSteps: 1 });
    expect(level(2)).toMatchObject({ hands: ['LH'], clefs: ['bass'], range: { low: 48, high: 55 } });
    expect(level(3)).toMatchObject({ rests: true, maxLeapSteps: 2, meters: [{ num: 4, den: 4 }, { num: 3, den: 4 }] });
    expect(level(4)).toMatchObject({ hands: ['RH', 'LH'], handsTogether: true });
    expect(level(5)).toMatchObject({ handsTogether: true, noteValues: ['whole', 'dottedHalf', 'half', 'dottedQuarter', 'quarter', 'dottedEighth', 'eighth', 'sixteenth'] });
  });

  const base = () => JSON.parse(readFileSync(LEVELS_PATH, 'utf-8'));
  const problems = (mutate: (t: ReturnType<typeof base>) => void) => {
    const table = base();
    mutate(table);
    return parseLevels(JSON.stringify(table)).diagnostics.map((d) => d.message);
  };

  it('refuses a broken table: JSON, schema, duplicates, order, ranges, bars and fingerings', () => {
    expect(parseLevels('{ nope').diagnostics[0]!.message).toContain('not valid JSON');
    expect(problems((t) => { t.levels[0].range = 'x'; })[0]).toContain('levels.0.range');
    expect(problems((t) => { t.levels[1].level = 1; })).toEqual(expect.arrayContaining(['level 1 appears twice', 'levels must be listed in increasing order']));
    expect(problems((t) => { t.levels[0].range = { low: 67, high: 60 }; })).toContain('level 1: range low is above high');
    expect(problems((t) => { t.levels[0].range = { low: 20, high: 67 }; })[0]).toContain('outside the keys a piece may use');
    expect(problems((t) => { t.levels[0].bars = { min: 9, max: 4 }; })).toContain('level 1: bars min is above max');
    expect(problems((t) => { t.levels[0].fingerings.LH = { C3: 5 }; })).toContain("level 1: fingerings for LH, which is not one of the level's hands");
    expect(problems((t) => { t.levels[0].fingerings.RH.H9 = 1; })).toContain('level 1: "H9" in the RH fingerings is not a note name like C4');
  });
});

describe('every hard rule has a failing and a passing piece', () => {
  /** The level is passed explicitly, so one piece can fail at one level and pass at another. */
  const cases: { rule: string; fail: [string, Options]; pass: [string, Options] }[] = [
    { rule: 'meter', fail: ['C2 D | E2 F | G F E | D C D |]', { level: 1, meter: '3/4' }], pass: ['C2 D | E2 F | G F E | D C D |]', { level: 3, meter: '3/4' }] },
    { rule: 'hand', fail: ['C, D, E, F, | G,2 F,2 | F, E, D, C, | C,4 |]', { level: 1, meta: { hands: ['LH'] } }], pass: ['C, D, E, F, | G,2 F,2 | F, E, D, C, | C,4 |]', { level: 2, meta: { hands: ['LH'], level: 2 } }] },
    { rule: 'range', fail: ['C D E F | G A G F | F E D C | C4 |]', { level: 1 }], pass: [GOOD, { level: 1 }] },
    { rule: 'note-value', fail: ['C/2 D/2 E F G | G2 F2 | F E D C | C4 |]', { level: 1 }], pass: ['C/2 D/2 E F G | G2 F2 | F E D C | C4 |]', { level: 5 }] },
    { rule: 'rest', fail: ['z D E F | G2 F2 | F E D C | C4 |]', { level: { ...level(1), rests: false } }], pass: ['z D E F | G2 F2 | F E D C | C4 |]', { level: 3 }] },
    { rule: 'rest-value', fail: ['C D E z/2 z/2 | G2 F2 | F E D C | C4 |]', { level: 3 }], pass: ['C D E z/2 z/2 | G2 F2 | F E D C | C4 |]', { level: 5 }] },
    { rule: 'chord', fail: ['[CE]4 | G2 F2 | F E D C | C4 |]', { level: { ...level(1), chords: false } }], pass: ['[CE]4 | G2 F2 | F E D C | C4 |]', { level: { ...level(1), chords: true } }] },
    { rule: 'voices', fail: ['E2 F2 & C4 | G2 F2 | F E D C | C4 |]', { level: { ...level(4), voices: 1 } }], pass: ['E2 F2 & C4 | G2 F2 | F E D C | C4 |]', { level: 5 }] },
    { rule: 'tie', fail: ['C D E F- | F2 E2 | F E D C | C4 |]', { level: { ...level(1), ties: false } }], pass: ['C D E F- | F2 E2 | F E D C | C4 |]', { level: { ...level(1), ties: true } }] },
    { rule: 'leap', fail: ['C E G E | G2 F2 | F E D C | C4 |]', { level: 1 }], pass: ['C E D F | G2 F2 | F E D C | C4 |]', { level: 3 }] },
    { rule: 'piece-length', fail: ['C D E F | G2 F2 | C4 |]', { level: 1, meta: { phrases: [{ name: 'All', bars: [1, 3] }] } }], pass: [GOOD, { level: 1 }] },
    { rule: 'phrase-length', fail: [GOOD, { level: 1, meta: { phrases: [{ name: 'Short', bars: [1, 1] }] } }], pass: [GOOD, { level: 1 }] },
    { rule: 'fingering', fail: ['!2!C D E F | G2 F2 | F E D C | C4 |]', { level: 1 }], pass: ['!1!C D E F | G2 F2 | F E D C | C4 |]', { level: 1 }] },
  ];

  it('core_09.AC38 a dotted quarter and its eighth pass where the level has both, and fail with note-value before it', () => {
    const piece = 'C3/2 D/2 E2 | E3/2 F/2 G2 | G3/2 F/2 E D | C4 |]';
    expect(errors(lint(piece, { level: 5 }).diagnostics).map(formatDiagnostic)).toEqual([]);
    const early = lint(piece, { level: 3 });
    expect(rules(early.diagnostics)).toContain('note-value');
    expect(early.diagnostics.map((d) => d.message).join('\n')).toMatch(/dottedQuarter notes are not allowed at level 3/);
  });

  it('core_09.AC38 a dotted quarter rest passes where the level has dotted quarters, and a dotted sixteenth is refused', () => {
    expect(errors(lint('z3/2 D/2 E2 | E3/2 F/2 G2 | G3/2 F/2 E D | C4 |]', { level: 5 }).diagnostics).map(formatDiagnostic)).toEqual([]);
    const dottedSixteenth = lint('C3/8 D/8 D/4 D/4 E3 | E3/2 F/2 G2 | G3/2 F/2 E D | C4 |]', { level: 5 });
    expect(rules(dottedSixteenth.diagnostics)).toContain('note-value');
  });

  it('core_09.AC42 sixteenths and a dotted eighth with its sixteenth pass at level 5 and fail with note-value before it', () => {
    const piece = 'C/4 D/4 E/4 F/4 G G2 | E3/4 F/4 G E/2 F/4 G/4 C | C/4 D/4 E/2 z/4 E/4 F/2 E D | C4 |]';
    expect(errors(lint(piece, { level: 5 }).diagnostics).map(formatDiagnostic)).toEqual([]);
    const early = lint(piece, { level: 4 });
    expect(rules(early.diagnostics)).toContain('note-value');
    expect(early.diagnostics.map((d) => d.message).join('\n')).toMatch(/sixteenth notes are not allowed at level 4/);
  });

  it('core_09.AC51 eighth and quarter triplets pass at a level with the tuplets switch, and fail with note-value at one without it', () => {
    const piece = 'C (3D/E/F/ G E | (3zGF E2 | (3E/D/C/ D E D | C4 |]';
    expect(level(5).tuplets).toBe(true);
    expect(errors(lint(piece, { level: 5 }).diagnostics).map(formatDiagnostic)).toEqual([]);
    const early = lint(piece, { level: { ...level(4), tuplets: false } });
    expect(rules(early.diagnostics)).toContain('note-value');
    expect(early.diagnostics.map((d) => d.message).join('\n')).toMatch(/triplets are not allowed at level 4/);
    expect(errors(early.diagnostics).filter((d) => d.rule === 'note-value')).toHaveLength(9); // eight notes and a rest
  });

  it('core_09.AC64 an ornament sign passes where the level switch is on (every level) and fails with ornament where a teacher turns it off; a grace group passes', () => {
    expect(errors(lint('!trill!C D E F | G4 | F E D D | C4 |]', { level: 1 }).diagnostics).map(formatDiagnostic)).toEqual([]);
    const off = lint('!trill!C D E F | G4 | F E D D | C4 |]', { level: { ...level(1), ornaments: false } });
    expect(rules(off.diagnostics)).toContain('ornament');
    expect(off.diagnostics.map((d) => d.message).join('\n')).toMatch(/ornaments \(a trill, mordent or turn\) are not allowed at level 1/);
    expect(errors(lint('{/ed}C D E F | G4 | F E D D | C4 |]', { level: 1 }).diagnostics).map(formatDiagnostic)).toEqual([]);
  });

  it('core_09.AC51 a triplet length outside a triplet fails note-value at every level, and an eighth triplet needs eighths in the level', () => {
    const { chart } = lint('C (3D/E/F/ G E | G2 F2 | F E D C | C4 |]', { level: 5 });
    const bare = { ...chart, tuplets: undefined };
    const meta = { ...META, level: 5 } as never;
    const out = lintPiece({ chart: bare, meta, level: level(5), styles: contentStyles });
    expect(out.filter((d) => d.rule === 'note-value').map((d) => d.message)[0]).toMatch(/160 ticks is not/);
    const noEighths = { ...level(5), noteValues: level(5).noteValues.filter((v) => v !== 'eighth') };
    const lintedNoEighths = lintPiece({ chart, meta, level: noEighths, styles: contentStyles });
    expect(lintedNoEighths.map((d) => d.message).join('\n')).toMatch(/eighth notes are not allowed at level 5/);
  });

  it('core_09.AC12 a tie across a bar line draws no tie error at any level', () => {
    const piece = '[CE]2 [CE]2- | [CE]2 [DF]2- | [DF]2 [CE]2 | [CE]4 |]';
    for (const lv of [1, 2, 3, 4, 5]) {
      const r = lint(piece, { level: lv });
      expect(rules(r.diagnostics), `level ${lv}`).not.toContain('tie');
    }
  });

  it.each(cases)('$rule', ({ rule, fail, pass }) => {
    const failing = lint(fail[0], fail[1]);
    expect(rules(failing.diagnostics), JSON.stringify(failing.diagnostics.map(formatDiagnostic))).toContain(rule);
    const passing = lint(pass[0], pass[1]);
    expect(errors(passing.diagnostics).map(formatDiagnostic)).toEqual([]);
  });

  it('clef: a bass-clef piece fails at a treble level and passes at a bass level', () => {
    const bass = 'C, D, E, F, | G,2 F,2 | F, E, D, C, | C,4 |]';
    const withBass = compilePiece({
      abc: `X:1\nT:t\nM:4/4\nL:1/4\nQ:1/4=80\nK:C clef=bass\n${bass}\n`,
      meta: JSON.stringify({ ...META, hands: ['RH'], title: 't' }),
    });
    const diagnostics = lintPiece({ styles: contentStyles, chart: withBass.chart!, meta: withBass.meta!, level: level(1) });
    expect(rules(diagnostics)).toEqual(expect.arrayContaining(['clef', 'range']));
    expect(rules(lintPiece({ styles: contentStyles, chart: withBass.chart!, meta: withBass.meta!, level: { ...level(1), clefs: ['treble', 'bass'], range: { low: 48, high: 55 } } }))).not.toContain('clef');
  });

  // Covers core_09.AC4.
  it('key: a key signature the level allows passes, and one it does not allow fails; a sharp that is in the key is not an accidental', () => {
    const g = compilePiece({ abc: 'X:1\nT:Test Piece\nM:4/4\nL:1/4\nQ:1/4=80\nK:G\nF G A B | F G A B | F G A B | F G A B |]\n', meta: JSON.stringify(META) });
    const withKeys = (keys: number[]) => ({ ...level(1), keys, accidentals: false, range: { low: 60, high: 75 } });
    expect(rules(lintPiece({ styles: contentStyles, chart: g.chart!, meta: g.meta!, level: withKeys([1]) }))).not.toContain('key');
    expect(rules(lintPiece({ styles: contentStyles, chart: g.chart!, meta: g.meta!, level: withKeys([1]) }))).not.toContain('accidental');
    expect(rules(lintPiece({ styles: contentStyles, chart: g.chart!, meta: g.meta!, level: withKeys([0]) }))).toContain('key');
  });

  // Covers core_09.AC4.
  it('accidental: in G major a C sharp is out of the key and fails where accidentals are off', () => {
    const g = compilePiece({ abc: 'X:1\nT:Test Piece\nM:4/4\nL:1/4\nQ:1/4=80\nK:G\nF G A ^C | F G A B | F G A B | F G A B |]\n', meta: JSON.stringify(META) });
    expect(rules(lintPiece({ styles: contentStyles, chart: g.chart!, meta: g.meta!, level: { ...level(1), keys: [1], accidentals: false, range: { low: 60, high: 75 } } }))).toContain('accidental');
  });

  it('accidental: a sharp fails where accidentals are off and passes where they are on (the compiler cannot write one yet, so the chart is edited)', () => {
    const { chart } = lint(GOOD, { level: 1 });
    const sharp = structuredClone(chart);
    sharp.notes[0] = { ...sharp.notes[0]!, midi: 61, spelling: { step: 'C', alter: 1, octave: 4 } };
    const meta = compilePiece({ abc: `X:1\nM:4/4\nL:1/4\nK:C\n${GOOD}\n`, meta: JSON.stringify(META) }).meta!;
    expect(rules(lintPiece({ styles: contentStyles, chart: sharp, meta, level: { ...level(1), accidentals: false } }))).toContain('accidental');
    expect(rules(lintPiece({ styles: contentStyles, chart: sharp, meta, level: { ...level(1), accidentals: true, range: { low: 60, high: 67 } } }))).not.toContain('accidental');
  });

  // Covers core_09.AC9.
  describe('core_09.AC9: accidentals and key signatures are always available', () => {
    const G_MAJOR_WALK = 'X:1\nT:Test Piece\nM:4/4\nL:1/4\nQ:1/4=80\nK:G\n!5!G !5!G !4!^F !3!E | !2!D !1!C !2!D2 | !3!E !3!E !4!^F !5!G | !5!G4 | !4!=F !3!E !2!D !1!C | !2!D2 !3!E2 | !4!^F !3!E !2!D !1!C | !5!G4 |]\n';
    const F_MAJOR_SONG = 'X:1\nT:Test Piece\nM:4/4\nL:1/4\nQ:1/4=80\nK:F clef=bass\n!2!F,2 !1!G,2 | A,2 B,2 | !5!C,2 !4!D,2 | !2!F,2 !3!E,2 | !1!G,2 !2!F,2 | !3!E,2 !2!F,2 | !4!D,2 !5!C,2 | !2!F,4 |]\n';
    const piece = (abc: string, hands: string[]) => compilePiece({ abc, meta: JSON.stringify({ ...META, hands }) });

    it('every level allows accidentals and all fifteen key signatures', () => {
      for (const l of levels) {
        expect(l.accidentals, `level ${l.level}`).toBe(true);
        expect(l.keys, `level ${l.level}`).toEqual([-7, -6, -5, -4, -3, -2, -1, 0, 1, 2, 3, 4, 5, 6, 7]);
      }
    });

    it.each(levels.map((l) => [l.level]))('a G-major piece (F sharp, a natural F) has no key or accidental error at level %i', (n) => {
      const g = piece(G_MAJOR_WALK, ['RH']);
      expect(g.diagnostics.filter((d) => d.severity === 'error')).toEqual([]);
      const found = rules(lintPiece({ styles: contentStyles, chart: g.chart!, meta: g.meta!, level: level(n) }));
      expect(found.filter((r) => r === 'key' || r === 'accidental')).toEqual([]);
    });

    it('the bundled draft pieces in G and F major lint with no key or accidental error, and their key signatures are one sharp and one flat', () => {
      const report = lintPieces(join(root, 'content/pieces'), levels);
      for (const id of ['g-major-walk', 'f-major-song']) {
        const piece = report.linted.find((p) => p.id === id);
        expect(piece, id).toBeDefined();
        expect(piece!.diagnostics.filter((d) => d.severity === 'error' && (d.rule === 'key' || d.rule === 'accidental')).map(formatDiagnostic)).toEqual([]);
      }
      const keyOf = (id: string) => compilePiece({ abc: readFileSync(join(root, `content/pieces/${id}/piece.abc`), 'utf-8'), meta: readFileSync(join(root, `content/pieces/${id}/piece.meta.json`), 'utf-8') }).chart!.keyMap[0]!.fifths;
      expect(keyOf('g-major-walk')).toBe(1);
      expect(keyOf('f-major-song')).toBe(-1);
    });

    it.each(levels.map((l) => [l.level]))('an F-major piece (B flat) has no key or accidental error at level %i', (n) => {
      const f = piece(F_MAJOR_SONG, ['LH']);
      expect(f.diagnostics.filter((d) => d.severity === 'error')).toEqual([]);
      const found = rules(lintPiece({ styles: contentStyles, chart: f.chart!, meta: f.meta!, level: level(n) }));
      expect(found.filter((r) => r === 'key' || r === 'accidental')).toEqual([]);
    });
  });

  it('bar-length: a bar that is not filled exactly fails (the compiler never produces one, so the chart is edited)', () => {
    const { chart, diagnostics } = lint(GOOD, { level: 1 });
    expect(rules(diagnostics)).not.toContain('bar-length');
    const short = structuredClone(chart);
    short.notes.splice(1, 1); // drop D from bar 1
    const meta = compilePiece({ abc: `X:1\nM:4/4\nL:1/4\nK:C\n${GOOD}\n`, meta: JSON.stringify(META) }).meta!;
    const found = lintPiece({ styles: contentStyles, chart: short, meta, level: level(1) }).filter((d) => d.rule === 'bar-length');
    expect(found).toHaveLength(1);
    expect(found[0]!.message).toContain('bar 1');
  });

  it('core_09.AC21 bar-length: a pick-up and a short last bar pass; a short bar anywhere else fails', () => {
    const up = lint('G | C D E F | G3 |]', { level: 1, meta: { phrases: [{ name: 'All', bars: [0, 2] }] } });
    expect(rules(up.diagnostics)).not.toContain('bar-length');
    // the pick-up and the last bar count as one bar of the piece's length
    expect(up.diagnostics.find((d) => d.rule === 'piece-length')?.message ?? '').not.toContain('3 bars');
    expect(lint('G | C D E F | G3 |]', { level: { ...level(1), bars: { min: 3, max: 32 } }, meta: { phrases: [{ name: 'All', bars: [0, 2] }] } }).diagnostics.find((d) => d.rule === 'piece-length')?.message).toContain('the piece has 2 bars');
    expect(up.chart.bars[0]).toMatchObject({ startTick: 0, endTick: 480 });
    // a chart edited by hand so that its second bar is short (the compiler refuses that)
    const plain = lint('C D E F | G4 | A4 |]', { level: 1, meta: { phrases: [{ name: 'All', bars: [1, 3] }] } }).chart;
    const edited = structuredClone(plain);
    edited.bars = [{ index: 0, startTick: 0, endTick: 1920 }, { index: 1, startTick: 1920, endTick: 2880 }, { index: 2, startTick: 2880, endTick: 4800 }];
    edited.notes = edited.notes.map((n) => (n.tick === 1920 ? { ...n, dur: 960 } : n.tick === 3840 ? { ...n, tick: 2880, bar: 2 } : n));
    const meta = compilePiece({ abc: `X:1\nM:4/4\nL:1/4\nK:C\nC D E F | G4 | A4 |]\n`, meta: JSON.stringify({ ...META, phrases: [{ name: 'All', bars: [1, 3] }] }) }).meta!;
    const found = lintPiece({ styles: contentStyles, chart: edited, meta, level: level(1) }).filter((d) => d.rule === 'bar-length');
    expect(found.map((d) => d.message)).toEqual([expect.stringContaining('bar 2: this bar is 2 beats long but 4/4 needs 4')]);
    // a pick-up whose last bar is whole: the two do not make one bar
    const whole = structuredClone(up.chart);
    whole.bars = [...whole.bars.slice(0, -1), { index: 2, startTick: 2400, endTick: 4320 }];
    const lastBar = lintPiece({ styles: contentStyles, chart: whole, meta: compilePiece({ abc: `X:1\nM:4/4\nL:1/4\nK:C\nG | C D E F | G3 |]\n`, meta: JSON.stringify({ ...META, phrases: [{ name: 'All', bars: [0, 2] }] }) }).meta!, level: level(1) }).filter((d) => d.rule === 'bar-length');
    expect(lastBar.map((d) => d.message)).toEqual(expect.arrayContaining([expect.stringContaining('with a pick-up of 1 beats the last bar needs 3, so the two make one 4/4 bar')]));
  });

  it('hands-together: the two-hand piece fails where hands play one at a time and passes where they may play together', () => {
    const compiled = compilePiece({
      abc: readFileSync(join(root, 'tests/fixtures/pieces/hands-together/piece.abc'), 'utf-8'),
      meta: readFileSync(join(root, 'tests/fixtures/pieces/hands-together/piece.meta.json'), 'utf-8'),
    });
    const at = (l: LevelDefinition) => lintPiece({ styles: contentStyles, chart: compiled.chart!, meta: compiled.meta!, level: l, sources: compiled.sources });
    expect(rules(at({ ...level(4), handsTogether: false }))).toContain('hands-together');
    expect(errors(at(level(5))).map(formatDiagnostic)).toEqual([]);
  });

  it('fingering: fingers must follow the hand position, differ inside a hand chord and lie in the order of the hand', () => {
    const chords = { ...level(1), chords: true };
    const lintChord = (body: string, l: LevelDefinition = chords, hands = ['RH']) => lint(body, { level: l, meta: { hands } }).diagnostics;
    expect(errors(lintChord('[!1!C !3!E]4 | G2 F2 | F E D C | C4 |]'))).toEqual([]);
    expect(errors(lintChord('[!1!C !1!E]4 | G2 F2 | F E D C | C4 |]')).map((d) => d.message).join()).toContain('cannot play C4 and E4 together');
    expect(errors(lintChord('[!3!C !1!E]4 | G2 F2 | F E D C | C4 |]')).map((d) => d.rule)).toContain('fingering');
    // the left hand lies the other way round: the higher key takes the lower finger
    const leftHand = { ...level(2), chords: true };
    expect(errors(lintChord('[!5!C, !3!E,]4 | G,2 F,2 | F, E, D, C, | C,4 |]', leftHand, ['LH']))).toEqual([]);
    expect(errors(lintChord('[!3!C, !5!E,]4 | G,2 F,2 | F, E, D, C, | C,4 |]', leftHand, ['LH'])).map((d) => d.rule)).toContain('fingering');
  });

  it('fingering: gives the finger the hand position expects, and warns once per note outside the position', () => {
    const wrong = lint('!2!C D E F | G2 F2 | F E D C | C4 |]', { level: 1 }).diagnostics.find((d) => d.rule === 'fingering')!;
    expect(wrong.message).toContain('finger 2 on C4');
    expect(wrong.message).toContain('this note uses finger 1');
    const wide = { ...level(1), range: { low: 60, high: 72 } };
    const warned = lint('C D E F | G A G F | F E D C | !5!c4 |]', { level: wide }).diagnostics;
    expect(warned.filter((d) => d.rule === 'fingering-unchecked')).toHaveLength(1); // only the C5 has a finger written; A4 has none
    const withFingers = lint('C D E F | G !2!A !3!A F | F E D C | !5!c4 |]', { level: { ...wide, maxLeapSteps: 5 } }).diagnostics;
    expect(withFingers.filter((d) => d.rule === 'fingering-unchecked')).toHaveLength(2); // A4 once, C5 once
  });
});

describe('a written finger far from the best (ft_1_30.AC8)', () => {
  const free = { ...level(1), fingerings: {} };
  it('warns when a written finger costs the hand far more than the finger the search finds, and names the better one', () => {
    const costly = lint('!4!C D E F | G2 F2 | F E D C | C4 |]', { level: free }).diagnostics.filter((d) => d.rule === 'fingering-cost');
    expect(costly).toHaveLength(1);
    expect(costly[0]!.severity).toBe('warning');
    expect(costly[0]!.message).toContain('finger 4 on C4');
    expect(costly[0]!.message).toContain('finger 1 is');
  });

  it('a part that leaves the hand position may turn the thumb under on a position note: a warning, not an error (ft_1_30.AC8)', () => {
    const wide = { ...level(5) };
    const scale = lint('!1!C !2!D !3!E !1!F | !2!G !3!A !4!B !5!c | c B A G | F E D C | C4 |]', { level: wide }).diagnostics;
    const fingering = scale.filter((d) => d.rule === 'fingering');
    expect(fingering.length).toBeGreaterThan(0);
    expect(fingering.every((d) => d.severity === 'warning')).toBe(true);
    // a plainly wrong finger on a position note stays an error, even in a part that leaves the position
    const wrong = lint('!5!C !2!D !3!E !1!F | !2!G !3!A !4!B !5!c | c B A G | F E D C | C4 |]', { level: wide }).diagnostics;
    expect(wrong.filter((d) => d.rule === 'fingering' && d.severity === 'error').map((d) => d.message).join()).toContain('finger 5 on C4');
  });

  it('says nothing for a fingering a teacher would write', () => {
    const fine = lint('!1!C !2!D !3!E !4!F | !5!G2 F2 | F E D C | C4 |]', { level: free }).diagnostics;
    expect(fine.filter((d) => d.rule === 'fingering-cost')).toEqual([]);
    expect(lint('!1!C D E F | G2 F2 | F E D C | C4 |]', { level: 1 }).diagnostics.filter((d) => d.rule === 'fingering-cost')).toEqual([]);
  });
});

describe('messages say where and why', () => {
  it('points at the note in the ABC file with line and column, and names bar and beat', () => {
    const { diagnostics } = lint('C D E F | G2 F2 | F E D C | C4 |]\n'.replace('G2 F2', 'G2 A2'), { level: 1 });
    const range = diagnostics.find((d) => d.rule === 'range')!;
    expect(formatDiagnostic(range)).toBe('piece.abc:7:14 error: bar 2, beat 3: A4 is outside the notes of level 1 (C4 to G4) [range]');
  });

  it('describes a leap with its interval, the notes, and what the level allows', () => {
    const { diagnostics } = lint('C E D F | G2 F2 | F E D C | C4 |]', { level: 1 });
    expect(diagnostics.find((d) => d.rule === 'leap')!.message).toBe('bar 1, beat 2: a jump of a third (C4 to E4); level 1 allows at most a step');
    expect(lint('C G D F | G2 F2 | F E D C | C4 |]', { level: 3 }).diagnostics.find((d) => d.rule === 'leap')!.message).toContain('a jump of a fifth (C4 to G4); level 3 allows at most a third');
    const octave = lint('C c C c | c2 B2 | B A G F | E4 |]', { level: { ...level(1), range: { low: 60, high: 76 }, maxLeapSteps: 2 } }).diagnostics;
    expect(octave.find((d) => d.rule === 'leap')!.message).toContain('a jump of an octave');
  });

  it('caps repeated reports of one rule and says how many were left out', () => {
    const { diagnostics } = lint('c d e f | g a b c | c d e f | g a b c |]', { level: 1 });
    expect(diagnostics.filter((d) => d.rule === 'range' && d.severity === 'error')).toHaveLength(9); // 8 shown + 1 summary
    expect(diagnostics.find((d) => d.message.startsWith('and '))!.message).toBe('and 8 more range problem(s) not shown');
  });

  it('keeps hard errors and review warnings apart', () => {
    const { diagnostics } = lint('C D E F | G2 F2 | F E D C | D4 |]', { level: 1 });
    expect(errors(diagnostics)).toEqual([]);
    expect(rules(diagnostics, 'warning')).toEqual(['no-cadence']);
  });
});

describe('warnings for a human to review', () => {
  const warnings = (body: string, options: Options = { level: 1 }) => rules(lint(body, options).diagnostics, 'warning');

  it('a clean piece has none', () => {
    expect(warnings(GOOD)).toEqual([]);
  });

  it('no cadence on the tonic', () => {
    expect(warnings('C D E F | G2 F2 | F E D C | D4 |]')).toContain('no-cadence');
  });

  it("the tonic is the key's own: D in D minor, A in A minor", () => {
    expect(warnings('C D E F | G2 F2 | F E D C | D4 |]', { level: 1, key: 'Dm' })).not.toContain('no-cadence');
    const inA = lint('C D E F | G2 F2 | F E D C | C4 |]', { level: 1, key: 'Am' }).diagnostics.find((d) => d.rule === 'no-cadence');
    expect(inA?.message).toContain('not on the tonic A');
  });

  it('a bar repeated three or more times in a row', () => {
    expect(warnings('C D E F | C D E F | C D E F | C4 |]')).toContain('identical-bars');
    expect(warnings('C D E F | C D E F | G2 F2 | C4 |]')).not.toContain('identical-bars');
  });

  it('mostly repeated bars', () => {
    expect(warnings('C D E F | G2 F2 | C D E F | G2 F2 | C D E F | C4 |]', { level: 1, meta: { phrases: [{ name: 'A', bars: [1, 4] }] } })).toContain('repeated-bars');
  });

  it('every note the same length', () => {
    expect(warnings('C D E F | G F E D | C D E F | G F E C |]')).toContain('monotone-rhythm');
  });

  it('no phrases defined', () => {
    expect(warnings(GOOD, { level: 1, meta: { phrases: [] } })).toContain('no-phrases');
  });

  it('refuses parts that cross and lets parts nest (core_06.AC3)', () => {
    const abc = `X:1\nT:Test Piece\nM:4/4\nL:1/4\nQ:1/4=80\nK:C\n${GOOD}\n`;
    const messages = (phrases: { name: string; bars: number[] }[]) =>
      compilePiece({ abc, meta: JSON.stringify({ ...META, phrases }) }).diagnostics.filter((d) => d.severity === 'error').map((d) => d.message).join(' ');
    expect(messages([{ name: 'A', bars: [1, 3] }, { name: 'B', bars: [2, 4] }])).toMatch(/"A" and "B" cross/);
    expect(messages([{ name: 'A', bars: [1, 4] }, { name: 'tricky', bars: [2, 3] }])).toBe('');
  });

  it('a licence that is not on the known list', () => {
    expect(warnings(GOOD, { level: 1, meta: { license: 'All rights reserved' } })).toContain('license');
  });

  it('a committed piece with no style; an own piece in private/pieces needs none', () => {
    expect(warnings(GOOD, { level: 1, meta: { styles: [] } })).toContain('style');
    expect(warnings(GOOD, { level: 1, meta: { styles: [] }, privatePiece: true })).not.toContain('style');
  });
});

describe('styles come from the closed list in content/pieces/styles.json', () => {
  it('a style the list does not have is an error that names the list', () => {
    const { diagnostics } = lint(GOOD, { level: 1, meta: { styles: ['folk', 'jazz'] } });
    expect(rules(diagnostics)).toEqual(['style']);
    expect(errors(diagnostics)[0]!.message).toMatch(/"jazz".*styles\.json.*folk, classical, exercise, original/);
  });

  it('every style of the list passes, and more than one style is fine', () => {
    for (const style of ['folk', 'classical', 'exercise', 'original']) expect(rules(lint(GOOD, { level: 1, meta: { styles: [style] } }).diagnostics)).toEqual([]);
    expect(rules(lint(GOOD, { level: 1, meta: { styles: ['folk', 'classical'] } }).diagnostics, 'warning')).not.toContain('style');
  });
});

describe('difficulty', () => {
  const d = (body: string, options: Options = { level: 1 }) => difficultyOf(lint(body, options).chart);

  it('scores the starter example on the 1 to 10 scale, bar by bar', () => {
    const good = d(GOOD);
    expect(good.scale).toBe(1);
    expect(good.bars.map((b) => b.printed)).toEqual([1, 2, 3, 4]);
    expect(good.bars.every((b) => b.features.leapPoints === 0 && b.features.shifts === 0)).toBe(true);
  });

  it('rises with leaps, eighth notes and two hands', () => {
    const steps = d(GOOD, { level: 5 }).score;
    const thirds = d('C E D F | G2 F2 | F E D C | C4 |]', { level: 5 }).score;
    const eighths = d('C/2 D/2 E F G | G2 F2 | F E D C | C4 |]', { level: 5 }).score;
    expect(thirds).toBeGreaterThan(steps);
    expect(eighths).toBeGreaterThan(steps);
    const compiled = compilePiece({
      abc: readFileSync(join(root, 'tests/fixtures/pieces/hands-together/piece.abc'), 'utf-8'),
      meta: readFileSync(join(root, 'tests/fixtures/pieces/hands-together/piece.meta.json'), 'utf-8'),
    });
    const two = difficultyOf(compiled.chart!);
    expect(Math.max(...two.bars.map((b) => b.features.handsTogether))).toBe(1);
    expect(two.score).toBeGreaterThan(steps);
  });

  it('counts only the notes the student plays, not accompaniment', () => {
    const accompanied = compilePiece({
      abc: 'X:1\nT:Test Piece\nM:4/4\nL:1/4\nK:C\nV:RH\nV:LH\nV:RH\nC D E F | G2 F2 | F E D C | C4 |]\nV:LH\nC, D, E, F, | G,2 F,2 | F, E, D, C, | C,4 |]\n',
      meta: JSON.stringify(META),
    });
    expect(difficultyOf(accompanied.chart!)).toEqual(difficultyOf(lint(GOOD).chart));
  });
});

describe('linting folders of pieces', () => {
  const dirs: string[] = [];
  const temp = () => {
    const dir = mkdtempSync(join(tmpdir(), 'pianor-lint-'));
    dirs.push(dir);
    return dir;
  };
  afterAll(() => dirs.forEach((d) => rmSync(d, { recursive: true, force: true })));
  const add = (src: string, folder: string, abc: string, meta: object | null) => {
    mkdirSync(join(src, folder));
    writeFileSync(join(src, folder, 'piece.abc'), abc);
    if (meta) writeFileSync(join(src, folder, 'piece.meta.json'), JSON.stringify(meta));
  };
  const abcOf = (body: string) => `X:1\nT:Test Piece\nM:4/4\nL:1/4\nQ:1/4=80\nK:C\n${body}\n`;

  it('lints against the meta level, scores difficulty and lists the levels the piece fits', () => {
    const report = lintPieces(join(root, 'tests/fixtures/pieces'), levels);
    const little = report.linted.find((p) => p.id === 'little-steps')!;
    expect(little).toMatchObject({ level: 1, fitsLevels: [1, 3, 4, 5, 6], diagnostics: [] });
    expect(little.difficulty.scale).toBe(1);
    const hands = report.linted.find((p) => p.id === 'hands-together')!;
    expect(hands.fitsLevels).toEqual([5, 6]);
    expect(report.diagnostics).toEqual([]);
  });

  it('reports a missing level, compile errors, a folder that does not match the id and a missing meta file', () => {
    const src = temp();
    add(src, 'no-level', abcOf(GOOD), { ...META, id: 'no-level', level: 9 });
    add(src, 'broken', abcOf('^ C D E F |]'), { ...META, id: 'broken' });
    add(src, 'mismatch', abcOf(GOOD), { ...META, id: 'other' });
    add(src, 'no-meta', abcOf(GOOD), null);
    const report = lintPieces(src, levels);
    expect(report.linted).toEqual([]);
    expect(report.diagnostics.map((d) => d.message)).toEqual([
      expect.stringContaining('must be followed by a note'),
      'id "other" must match the folder name "mismatch"',
      'level 9 is not defined in levels.json',
      'missing: every piece needs a piece.meta.json next to piece.abc',
    ]);
  });

  it('does nothing for a missing folder', () => {
    expect(lintPieces(join(temp(), 'nope'), levels)).toEqual({ pieces: 0, linted: [], songs: 0, diagnostics: [] });
  });
});

describe('the lint command', () => {
  const run = (...args: string[]) => spawnSync(process.execPath, ['--import', 'tsx', join(root, 'tools/piece/lint.ts'), ...args], { cwd: root, encoding: 'utf-8' });
  const dirs: string[] = [];
  afterAll(() => dirs.forEach((d) => rmSync(d, { recursive: true, force: true })));
  const piecesWith = (body: string, metaPatch: object = {}) => {
    const dir = mkdtempSync(join(tmpdir(), 'pianor-cli-'));
    dirs.push(dir);
    mkdirSync(join(dir, 'p'));
    writeFileSync(join(dir, 'p', 'piece.abc'), `X:1\nT:Test Piece\nM:4/4\nL:1/4\nQ:1/4=80\nK:C\n${body}\n`);
    writeFileSync(join(dir, 'p', 'piece.meta.json'), JSON.stringify({ ...META, id: 'p', ...metaPatch }));
    return dir;
  };

  it('prints the usage for --help and exits 2 on a misspelt option instead of ignoring it', () => {
    const help = run('--help');
    expect(help.status).toBe(0);
    expect(help.stdout).toContain('usage: npm run piece:lint');
    const typo = run('--stict');
    expect(typo.status).toBe(2);
    expect(typo.stderr).toContain("Unknown option '--stict'");
  });

  it('exits 0 with no pieces, and prints the piece line and exits 0 for a clean piece', () => {
    expect(run(join(tmpdir(), 'pianor-no-such-folder')).status).toBe(0);
    const clean = run(piecesWith(GOOD));
    expect(clean.status).toBe(0);
    expect(clean.stdout).toMatch(/p: level 1, difficulty \d+\/100, beginner [\d.]+ stars, proposed \(not confirmed, score /);
    expect(clean.stdout).toContain('fits levels 1, 3, 4, 5');
    expect(clean.stdout).toContain('1 piece(s), 0 error(s), 0 warning(s).');
  });

  it('exits 1 on errors and prints them as file:line:column error: message [rule], errors before warnings', () => {
    const result = run(piecesWith('C E D F | G2 F2 | F E D C | D4 |]'));
    expect(result.status).toBe(1);
    expect(result.stdout).toContain('p/piece.abc:7:3 error: bar 1, beat 2: a jump of a third (C4 to E4); level 1 allows at most a step [leap]');
    expect(result.stdout.indexOf('error:')).toBeLessThan(result.stdout.indexOf('Warnings (for a human to review):'));
  });

  it('warnings alone exit 0, and 1 with --strict', () => {
    const dir = piecesWith('C D E F | G2 F2 | F E D C | D4 |]');
    expect(run(dir).status).toBe(0);
    expect(run(dir, '--strict').status).toBe(1);
  });

  it('exits 1 when the level table is broken', () => {
    const dir = piecesWith(GOOD);
    const bad = join(dir, 'levels.json');
    writeFileSync(bad, '{ nope');
    const result = run(dir, `--levels=${bad}`);
    expect(result.status).toBe(1);
    expect(result.stdout).toContain('not valid JSON');
  });
});

describe('a chart that did not come from ABC (the seam for importers)', () => {
  // The linter judges a chart against a level and never needs the ABC text. A future importer, or a hand-written chart,
  // can therefore go through the same checks; messages then give the bar and beat instead of a line in piece.abc.
  const handWritten = (): Chart => JSON.parse(readFileSync(join(root, 'tests/golden/little-steps.chart.json'), 'utf-8')) as Chart;

  it('lints clean at the level it was written for, with no source positions at all', () => {
    const diagnostics = lintPiece({ styles: contentStyles, chart: handWritten(), meta: { ...META, id: 'little-steps' } as never, level: level(1), sources: null });
    expect(errors(diagnostics)).toEqual([]);
  });

  it('reports a broken rule by bar and beat, without a line or column', () => {
    const chart = handWritten();
    const note = chart.notes[3]!; // the fourth note, bar 1 beat 4
    note.midi = 72;
    note.spelling = { step: 'C', alter: 0, octave: 5 };
    chart.range = { low: chart.range.low, high: 72 };
    const found = errors(lintPiece({ styles: contentStyles, chart, meta: { ...META, id: 'little-steps' } as never, level: level(1), sources: null }));
    const range = found.find((d) => d.rule === 'range');
    expect(range).toBeDefined();
    expect(range!.message).toMatch(/^bar 1, beat 4: /);
    expect(range!.line).toBeUndefined();
    expect(range!.column).toBeUndefined();
  });
});
