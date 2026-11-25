import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { makeZip } from '../../tests/helpers/zip';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { parseChart } from '../../src/core/chart/migrate';
import { compilePiece } from '../../src/core/piece/compile';
import { FEATURE_NAMES, parseLearnedModel, predictLevel } from '../../src/core/piece/learnedModel';
import { difficultyOf } from '../../src/core/piece/difficulty';
import { cipiManifest, CIPI_LICENCE } from './cipi';
import { readManifest, readScore, type Manifest } from './labelledSet';
import { buildSamples, modelPath, trainModel, trainReport } from './train';
import { readFileSync } from 'node:fs';

const PIECES = 'tests/fixtures/anchors';

/** synthetic: `bars` bars of 4/4 at `bpm`, quarter notes climbing by `leap` steps of the C major scale, as MusicXML. */
function synthScore(bars: number, bpm: number, leap: number): string {
  const steps = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];
  const note = (k: number) => `<note><pitch><step>${steps[k % 7]}</step><octave>${4 + Math.floor((k % 14) / 7)}</octave></pitch><duration>1</duration><voice>1</voice></note>`;
  const measures = Array.from({ length: bars }, (_, b) => `<measure number="${b + 1}">${b === 0 ? `<attributes><divisions>1</divisions><key><fifths>0</fifths></key><time><beats>4</beats><beat-type>4</beat-type></time></attributes><sound tempo="${bpm}"/>` : ''}${[0, 1, 2, 3].map((q) => note((b * 4 + q) * leap)).join('')}</measure>`);
  return `<score-partwise><part-list/><part id="P1">${measures.join('')}</part></score-partwise>`;
}
const tmp = mkdtempSync(join(tmpdir(), 'pianor-train-'));
afterAll(() => rmSync(tmp, { recursive: true, force: true }));

/** synthetic labels: our own pieces graded by their proposed step, in three made-up "composers". */
const OWN = ['puuvaim-1', 'puuvaim-2', 'puuvaim-3', 'hot-cross-buns', 'mary-had-a-little-lamb', 'ode-to-joy', 'both-hands', 'mist-waltz', 'f-major-song', 'g-major-walk', 'low-walk', 'au-clair-de-la-lune'];
function ownSet(): Manifest {
  return {
    schemaVersion: 1,
    name: 'Own pieces (synthetic)',
    licence: 'ours',
    publishable: false,
    label: { name: 'step', min: 1, max: 10 },
    items: OWN.map((id, i) => {
      const chart = readScore(join(PIECES, id));
      if (!chart.ok) throw new Error(`${id}: ${chart.reason}`);
      return { id, group: `composer-${i % 3}`, label: difficultyOf(chart.chart).scale, files: [id] };
    }),
  };
}

describe('reading a labelled set (core_08.AC11)', () => {
  it('reads a piece folder, a piece.abc and a chart file', () => {
    expect(readScore(join(PIECES, 'puuvaim-1')).ok).toBe(true);
    expect(readScore(join(PIECES, 'puuvaim-1', 'piece.abc')).ok).toBe(true);
    const compiled = compilePiece({ abc: readFileSync(join(PIECES, 'puuvaim-1', 'piece.abc'), 'utf-8'), meta: readFileSync(join(PIECES, 'puuvaim-1', 'piece.meta.json'), 'utf-8') });
    const chartFile = join(tmp, 'p.chart.json');
    writeFileSync(chartFile, JSON.stringify(compiled.chart));
    const read = readScore(chartFile);
    expect(read.ok && parseChart(JSON.parse(readFileSync(chartFile, 'utf-8'))).ok).toBe(true);
  });

  it('says why a score is not read', () => {
    expect(readScore(join(tmp, 'missing.abc'))).toEqual({ ok: false, reason: expect.stringContaining('no such file') });
    const xml = join(tmp, 'a.musicxml');
    writeFileSync(xml, '<score-partwise/>');
    expect(readScore(xml)).toEqual({ ok: false, reason: expect.stringContaining('no measures') });
    const bad = join(tmp, 'bad.chart.json');
    writeFileSync(bad, '{"schemaVersion": 1}');
    expect(readScore(bad).ok).toBe(false);
    const txt = join(tmp, 'notes.txt');
    writeFileSync(txt, 'x');
    expect(readScore(txt)).toEqual({ ok: false, reason: expect.stringContaining('not a score this reader knows') });
    const broken = join(tmp, 'broken');
    rmSync(broken, { recursive: true, force: true });
    writeFileSync(join(tmp, 'piece.abc'), 'X:1\nK:C\n|]');
    writeFileSync(join(tmp, 'piece.meta.json'), '{}');
    expect(readScore(join(tmp, 'piece.abc')).ok).toBe(false);
  });

  it('validates a manifest file', () => {
    const file = join(tmp, 'set.json');
    writeFileSync(file, JSON.stringify(ownSet()));
    expect(readManifest(file).items).toHaveLength(OWN.length);
    writeFileSync(file, JSON.stringify({ ...ownSet(), publishable: 'yes' }));
    expect(() => readManifest(file)).toThrow();
  });
});

describe('the CIPI index (core_08.AC11)', () => {
  /** synthetic: the shape of CIPI's index.json, made-up entries. */
  const index = {
    'w-2': { composer: 'Bach', henle: '3', path: { '1': 'scores/b/1.musicxml', '2': 'scores/b/2.musicxml' }, work_name: 'Suite' },
    'w-1': { composer: 'Czerny', henle: 2, path: { '1': 'scores/c/1.musicxml' } },
    'w-3': { composer: 'Liszt', henle: 12, path: { '1': 'scores/l/1.musicxml' } },
    'w-4': { henle: 5, path: { '1': 'x.musicxml' } },
    'w-5': { composer: 'Satie', henle: 1, path: {} },
  };

  it('becomes a private Henle 1-9 manifest grouped by composer, movements as files', () => {
    const { manifest, skipped } = cipiManifest(index);
    expect(manifest).toMatchObject({ name: 'CIPI', licence: CIPI_LICENCE, publishable: false, label: { name: 'Henle', min: 1, max: 9 } });
    expect(manifest.items).toEqual([
      { id: 'w-1', group: 'Czerny', label: 2, files: ['scores/c/1.musicxml'] },
      { id: 'w-2', group: 'Bach', label: 3, files: ['scores/b/1.musicxml', 'scores/b/2.musicxml'] },
    ]);
    expect(skipped.map((s) => s.id)).toEqual(['w-3', 'w-4', 'w-5']);
    expect(skipped[1]!.reason).toContain('composer');
    expect(skipped[2]!.reason).toBe('no score file');
  });

  it('refuses what is not an index', () => {
    expect(() => cipiManifest([])).toThrow('object of works');
    expect(() => cipiManifest(null)).toThrow();
  });

  it('core_08.AC11 an index whose scores are missing lists every work as not read, with why', () => {
    const { skipped, samples } = buildSamples(cipiManifest(index).manifest, tmp);
    expect(samples).toEqual([]);
    expect(skipped.every((s) => s.reason.includes('no such file'))).toBe(true);
  });

  it('core_08.AC11 ft_Y_04.AC3 a CIPI-shaped folder of MusicXML and .mxl scores trains end to end', () => {
    const dir = join(tmp, 'cipi');
    mkdirSync(join(dir, 'scores'), { recursive: true });
    const works: Record<string, unknown> = {};
    const composers = ['Czerny', 'Bach', 'Burgmüller'];
    for (let i = 0; i < 9; i++) {
      const henle = 1 + (i % 9);
      const text = synthScore(4 + 2 * henle, 60 + 15 * henle, henle);
      const file = i % 3 === 0 ? `scores/w${i}.mxl` : `scores/w${i}.musicxml`;
      writeFileSync(join(dir, file), i % 3 === 0 ? makeZip([{ name: 'META-INF/container.xml', text: '<container><rootfiles><rootfile full-path="s.xml"/></rootfiles></container>' }, { name: 's.xml', text }]) : text);
      works[`w${i}`] = { composer: composers[i % 3], henle, path: { '1': file } };
    }
    writeFileSync(join(dir, 'index.json'), JSON.stringify(works));
    const { manifest } = cipiManifest(JSON.parse(readFileSync(join(dir, 'index.json'), 'utf-8')));
    const { samples, skipped } = buildSamples(manifest, dir);
    expect(skipped).toEqual([]);
    expect(samples).toHaveLength(9);
    const model = trainModel(manifest, samples, { trainedAt: 'now' });
    expect(model.source).toMatchObject({ dataset: 'CIPI', publishable: false, items: 9 });
    expect(model.metrics.folds).toBe(3);
    expect(modelPath(model)).toBe(join('.', 'private/models', 'cipi.json'));
  });
});

describe('training (core_08.AC11)', () => {
  it('core_08.AC11 fits a model on a labelled set that the game reads back and applies', () => {
    const set = ownSet();
    const { samples, skipped } = buildSamples(set, PIECES);
    expect(skipped).toEqual([]);
    expect(samples[0]!.x).toHaveLength(FEATURE_NAMES.length);
    const model = trainModel(set, samples, { trainedAt: '1998-11-21T00:00:00Z' });
    const parsed = parseLearnedModel(JSON.parse(JSON.stringify(model)));
    expect('model' in parsed).toBe(true);
    expect(model.metrics.folds).toBe(3);
    expect(model.source).toMatchObject({ items: OWN.length, publishable: false });
    const level = predictLevel(model, difficultyOf((readScore(join(PIECES, 'puuvaim-1')) as { ok: true; chart: never }).chart));
    expect(level).toBeGreaterThanOrEqual(1);
    expect(level).toBeLessThanOrEqual(10);
  });

  it('a work in movements is graded by its hardest movement', () => {
    const set: Manifest = { ...ownSet(), items: [{ id: 'suite', group: 'a', label: 3, files: ['puuvaim-1', 'ode-to-joy'] }] };
    const [suite] = buildSamples(set, PIECES).samples;
    const [easy] = buildSamples({ ...set, items: [{ ...set.items[0]!, files: ['puuvaim-1'] }] }, PIECES).samples;
    expect(suite!.x.every((v, j) => v >= easy!.x[j]!)).toBe(true);
  });

  it('a private set writes to private/models, a publishable one to content/models', () => {
    const set = ownSet();
    const model = trainModel(set, buildSamples(set, PIECES).samples, { trainedAt: 'now', lambda: 2, folds: 2 });
    expect(modelPath(model)).toBe(join('.', 'private/models', 'own-pieces-synthetic.json'));
    expect(modelPath({ ...model, source: { ...model.source, dataset: '!!', publishable: true } }, '/r')).toBe(join('/r', 'content/models', 'model.json'));
    const lines = trainReport(model, [{ id: 'x', reason: 'MusicXML needs the importer' }], 'p.json');
    expect(lines.join('\n')).toContain('private');
    expect(lines.join('\n')).toContain('x: MusicXML');
    expect(trainReport({ ...model, source: { ...model.source, publishable: true } }, [], 'p.json')).toHaveLength(3);
  });
});
