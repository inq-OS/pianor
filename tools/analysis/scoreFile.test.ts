// Covers ft_Y_04.AC3, ft_Y_04.AC4.
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { makeZip } from '../../tests/helpers/zip';
import { musicXmlToChart, scoreText } from '../../src/core/import/musicxml';
import type { Chart } from '../../src/core/chart';
import { compilePiece } from '../../src/core/piece/compile';
import { difficultyOf } from '../../src/core/piece/difficulty';
import { mxlText, readMusicXmlFile } from './scoreFile';

const tmp = mkdtempSync(join(tmpdir(), 'pianor-score-'));
afterAll(() => rmSync(tmp, { recursive: true, force: true }));
const root = join(__dirname, '../..');
const FIXTURE = readFileSync(join(__dirname, '../../tests/fixtures/musicxml/hands-together.musicxml'), 'utf-8');

describe('MusicXML files on disk (ft_Y_04.AC4)', () => {
  it('ft_Y_04.AC3 the same piece as MusicXML and as ABC gives the same notes, fingers and difficulty', () => {
    const xml = musicXmlToChart(FIXTURE, 'hands-together');
    const dir = join(root, 'tests/fixtures/pieces/hands-together');
    const abc = compilePiece({ abc: readFileSync(join(dir, 'piece.abc'), 'utf-8'), meta: readFileSync(join(dir, 'piece.meta.json'), 'utf-8') }).chart!;
    if (!xml.ok) throw new Error(xml.reason);
    expect(xml.warnings).toEqual([]);
    const hand = (c: Chart, track: string) => c.tracks.find((t) => t.id === track)!.hand;
    const key = (c: Chart) => c.notes.map((x) => [x.tick, x.dur, x.midi, hand(c, x.track), x.finger]).sort((a, b) => Number(a[0]) - Number(b[0]) || Number(a[2]) - Number(b[2]));
    expect(key(xml.chart)).toEqual(key(abc));
    expect(xml.chart.title).toBe('Hands Together');
    expect(xml.chart.tracks.map((t) => [t.id, t.hand, t.clef])).toEqual([
      ['rh', 'RH', 'treble'],
      ['lh', 'LH', 'bass'],
    ]);
    expect(xml.chart.tempoMap).toEqual(abc.tempoMap);
    expect(xml.chart.bars).toEqual(abc.bars);
    const a = difficultyOf(abc);
    const b = difficultyOf(xml.chart);
    expect(b.score).toBe(a.score);
    expect(b.parts).toEqual(a.parts);
  });

  it('ft_Y_04.AC4 reads a .musicxml and the same score compressed as .mxl to the same chart', () => {
    const plain = join(tmp, 'hands.musicxml');
    writeFileSync(plain, FIXTURE);
    const packed = join(tmp, 'hands.mxl');
    writeFileSync(packed, makeZip([{ name: 'META-INF/container.xml', text: '<container><rootfiles><rootfile full-path="score/hands.xml"/></rootfiles></container>', method: 0 }, { name: 'score/hands.xml', text: FIXTURE }]));
    const a = readMusicXmlFile(plain);
    const b = readMusicXmlFile(packed);
    expect(a.ok && b.ok).toBe(true);
    if (a.ok && b.ok) {
      expect(b.chart).toEqual(a.chart);
      expect(a.chart.id).toBe('hands');
    }
  });

  it('decodes UTF-16 with a byte-order mark, both byte orders', () => {
    const le = new Uint8Array([0xff, 0xfe, 0x3c, 0x00, 0x61, 0x00]);
    const be = new Uint8Array([0xfe, 0xff, 0x00, 0x3c, 0x00, 0x61]);
    expect(scoreText(le)).toBe('<a');
    expect(scoreText(be)).toBe('<a');
  });

  it('says why an archive or file cannot be read', () => {
    expect(() => mxlText(makeZip([{ name: 'META-INF/container.xml', text: '<container/>' }]))).toThrow('no score file inside');
    const odd = makeZip([{ name: 'a.xml', text: 'x', method: 0 }]);
    const view = new DataView(odd.buffer);
    view.setUint16(view.getUint32(odd.length - 22 + 16, true) + 10, 12, true);
    expect(() => mxlText(odd)).toThrow('method 12');
    const junk = join(tmp, 'junk.mxl');
    writeFileSync(junk, 'not a zip, but long enough to have an end');
    expect(readMusicXmlFile(junk)).toEqual({ ok: false, reason: expect.stringContaining('not a zip archive') });
    expect(readMusicXmlFile(join(tmp, 'missing.musicxml'))).toEqual({ ok: false, reason: expect.stringContaining('ENOENT') });
  });
});
