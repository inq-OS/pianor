// Covers ft_Y_04.AC6, ft_Y_04.AC8.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ownIdFor } from '../../src/core/editor/pieceFile';
import { describe, expect, it } from 'vitest';
import { musicXmlToChart, type MusicXmlResult } from '../../src/core/import/musicxml';
import { importPieceFile } from '../../src/core/editor/pieceFile';
import { toChart } from '../../src/core/editor/chart';
import { fromChart } from '../../src/core/editor/fromChart';
import { pieceProblem } from '../../src/core/editor/model';
import type { Chart } from '../../src/core/chart/schema';
import {
  PHOTO_IN, PHOTO_MAP, PHOTO_OUT, readSheet, type PhotoMap, audiverisArgs, audiverisHint, pickAudiveris, staleScores, audiverisCandidates, exportOf, importScore, photoMenu, reportLines, sheetKind, sheetsIn, titleOf, type MenuIo,
} from './photo';

const FIXTURE = 'tests/fixtures/musicxml/hands-together.musicxml';
const fixture = (): MusicXmlResult => musicXmlToChart(readFileSync(FIXTURE, 'utf8'), 'hands-together');
/** synthetic: one bar with a dotted quarter, which the piece maker cannot write. */
const doubleDotted = (): MusicXmlResult => musicXmlToChart(`<?xml version="1.0"?><score-partwise version="4.0"><part-list/><part id="P1"><measure number="1"><attributes><divisions>2</divisions><key><fifths>1</fifths></key><time><beats>4</beats><beat-type>4</beat-type></time></attributes><note><pitch><step>G</step><octave>4</octave></pitch><duration>7</duration></note><note><pitch><step>A</step><octave>4</octave></pitch><duration>1</duration></note></measure></part></score-partwise>`, 'x');

describe('the fixture through the converter (ft_Y_04.AC6)', () => {
  it('ft_Y_04.AC6 the two-hand fixture comes in note for note: its chart equals the score\'s', () => {
    const read = fixture();
    if (!read.ok) throw new Error(read.reason);
    const r = fromChart(read.chart);
    if (!r.ok) throw new Error(r.reason);
    expect(r.problems).toEqual([]);
    expect(pieceProblem(r.piece)).toBeNull();
    const back = toChart(r.piece, { id: 'test' });
    const notes = (c: Chart) => c.notes.map((x) => [x.tick, x.dur, x.midi, x.spelling, x.track, x.finger ?? null]).map((x) => JSON.stringify(x)).sort();
    expect(notes(back)).toEqual(notes(read.chart));
    expect([back.meterMap, back.keyMap, back.tempoMap]).toEqual([read.chart.meterMap, read.chart.keyMap, read.chart.tempoMap]);
    expect([r.piece.hands, r.piece.title]).toEqual(['both', 'Hands Together']);
  });
});

describe('photo import (ft_Y_04.AC8)', () => {
  it('ft_Y_04.AC8 tells images, scores and other files apart', () => {
    expect(['a.JPG', 'b.pdf', 'c.mxl', 'd.musicxml', 'e.txt', 'f.png'].map(sheetKind)).toEqual(['image', 'image', 'score', 'score', null, 'image']);
    expect(sheetsIn(['z.png', 'notes.txt', 'a.mxl'])).toEqual(['a.mxl', 'z.png']);
  });

  it('ft_Y_04.AC8 looks for Audiveris where its installers put it, the AUDIVERIS variable first', () => {
    expect(audiverisCandidates('win32', { AUDIVERIS: 'D:\\A\\Audiveris.exe', ProgramFiles: 'C:\\Program Files', LOCALAPPDATA: 'C:\\Users\\x\\AppData\\Local', Path: 'C:\\bin' })).toEqual([
      'D:\\A\\Audiveris.exe', 'C:\\Program Files\\Audiveris\\Audiveris.exe', 'C:\\Users\\x\\AppData\\Local\\Programs\\Audiveris\\Audiveris.exe', 'C:\\bin\\Audiveris.exe',
    ]);
    expect(audiverisCandidates('win32', {})[0]).toBe('C:\\Program Files\\Audiveris\\Audiveris.exe');
    expect(audiverisCandidates('linux', { PATH: '/usr/bin:/home/x/bin' })).toEqual([
      '/opt/audiveris/bin/Audiveris', '/Applications/Audiveris.app/Contents/MacOS/Audiveris', '/usr/bin/audiveris', '/usr/bin/Audiveris', '/home/x/bin/audiveris', '/home/x/bin/Audiveris',
    ]);
    expect(audiverisArgs('in/s.jpg', 'out/x')).toEqual(['-batch', '-export', '-output', 'out/x', '--', 'in/s.jpg']);
  });

  it('ft_Y_04.AC8 finds the MusicXML Audiveris wrote, the first movement of a book', () => {
    expect(exportOf('in/Sheet 1.jpg', ['out/Sheet 1/Sheet 1.omr', 'out/Sheet 1/Sheet 1.mvt2.mxl', 'out/Sheet 1/Sheet 1.mvt1.mxl', 'out/other.mxl'])).toBe('out/Sheet 1/Sheet 1.mvt1.mxl');
    expect(exportOf('in/s.png', ['out/s/s.omr', 'out/s/s.mxl'])).toBe('out/s/s.mxl');
    expect(exportOf('in/s.png', ['out/s/s.omr'])).toBeUndefined();
  });

  it('ft_Y_04.AC8 an earlier run\'s scores are cleared first, so a failed run never reports an old result', () => {
    expect(staleScores(['o/s/s.mxl', 'o/s/s.omr', 'o/s/audiveris.log', 'o/s/s.mvt1.mxl'])).toEqual(['o/s/s.mxl', 'o/s/s.mvt1.mxl']);
  });

  it('ft_Y_04.AC8 a set AUDIVERIS that does not exist, or names a .bat, is said; else the first candidate there', () => {
    const has = (p: string) => p.startsWith('C:');
    expect(pickAudiveris(['D:\\x.exe', 'C:\\A.exe', 'audiveris'], has, { AUDIVERIS: 'D:\\x.exe' })).toEqual({ ok: false, reason: expect.stringContaining('does not exist') });
    expect(pickAudiveris(['C:\\a.bat'], has, { AUDIVERIS: 'C:\\a.bat' })).toEqual({ ok: false, reason: expect.stringContaining('Audiveris.exe') });
    expect(pickAudiveris(['D:\\y.exe', 'C:\\A.exe', 'audiveris'], has, {})).toEqual({ ok: true, exe: 'C:\\A.exe' });
  });

  it('ft_Y_04.AC27 Audiveris on no candidate path and not on the PATH is not found, and the answer says where to get it', () => {
    expect(pickAudiveris(['D:\\y.exe', '/usr/bin/audiveris'], () => false, {})).toEqual({ ok: false, reason: expect.stringContaining('audiveris.github.io') });
  });

  it('ft_Y_04.AC8 a photo taken at an angle gets the advice to scan it flat (the first test photo)', () => {
    const log = 'INFO SCALE\nWARN Error processing stub org.audiveris.omr.step.StepException: No regularly spaced lines found';
    expect(audiverisHint(log)).toContain('Scan the page flat');
    expect(audiverisHint('INFO Running in batch mode')).toBeUndefined();
  });

  it('ft_Y_04.AC8 names the piece from its title, Estonian letters included', () => {
    expect(ownIdFor('Väike jänes, õuel!')).toBe('own-vaike-janes-ouel');
    expect(ownIdFor('***')).toBe('own-piece');
    // the piece maker saves a piece under the same id, so it finds the photo's folder (ft_Y_04.AC16)
    expect(ownIdFor('Väike täht')).toBe('own-vaike-taht');
    expect(titleOf('in/kevad_laul-2.jpg')).toBe('kevad laul 2');
  });

  it('ft_Y_04.AC8 writes an own piece file the piece maker imports unchanged, licence NaN', () => {
    const r = importScore(fixture(), 'Käed koos');
    if (!r.ok) throw new Error(r.reason);
    const back = importPieceFile(r.imported.file);
    expect(back.ok && back.file.piece).toEqual(r.imported.piece);
    expect(back.ok && JSON.parse(back.file.meta).license).toBe('NaN');
    expect(r.imported.fileName).toBe('own-kaed-koos.pianor-piece.json');
    expect(reportLines(r.imported, 'out/f.json')[0]).toBe('"Käed koos": 4 bars, both hands, 4/4, C major, 60 a minute, 11 notes taken.');
  });

  it('ft_Y_04.AC8 the report lists every place to fill by hand, with bar and beat', () => {
    const r = importScore(doubleDotted(), 'Kevad');
    if (!r.ok) throw new Error(r.reason);
    const lines = reportLines(r.imported, 'out/own-kevad.pianor-piece.json');
    expect(lines[0]).toContain('1 bars, right hand, 4/4, G major');
    expect(lines).toContain('To fill by hand (1):');
    expect(lines).toContain('  bar 1, beat 1 (right hand): a double-dotted half, which the piece maker has no button for');
    expect(lines.join('\n')).toContain('no tempo in the score');
  });

  it('ft_Y_04.AC8 what is not a score, or not a piece maker piece, is not taken, with the reason', () => {
    expect(importScore({ ok: false, reason: 'not readable XML' }, 't')).toEqual({ ok: false, reason: 'not readable XML' });
    const six = musicXmlToChart(`<?xml version="1.0"?><score-partwise version="4.0"><part-list/><part id="P1"><measure number="1"><attributes><divisions>2</divisions><time><beats>6</beats><beat-type>8</beat-type></time></attributes><note><pitch><step>C</step><octave>4</octave></pitch><duration>6</duration></note></measure></part></score-partwise>`, 'x');
    expect(importScore(six, 't')).toEqual({ ok: false, reason: expect.stringContaining('6/8') });
  });
});

/** A scripted terminal: answers in order, everything said kept. */
function fakeIo(answers: string[], over: Partial<MenuIo> = {}) {
  const said: string[] = [];
  const written = new Map<string, string>();
  const recognised: string[] = [];
  const io: MenuIo = {
    ask: (q) => { said.push(`? ${q}`); return Promise.resolve(answers.shift() ?? 'q'); },
    say: (line) => said.push(line),
    list: () => ['hands.jpg', 'notes.txt', 'ready.musicxml'],
    recognise: (image, outDir) => { recognised.push(`${image} -> ${outDir}`); return Promise.resolve({ ok: true, score: 'audiveris.mxl' }); },
    readScore: (path) => (path.endsWith('ready.musicxml') ? doubleDotted() : fixture()),
    write: (path, text) => written.set(path, text),
    ...over,
  };
  return { io, said, written, recognised };
}

describe('the photo import menu (ft_Y_04.AC8)', () => {
  it('ft_Y_04.AC8 lists the sheets, reads an image through Audiveris and saves the piece file and its report', async () => {
    const t = fakeIo(['1', 'Käed koos', 'q']);
    await photoMenu(t.io);
    expect(t.said).toContain('  1  hands.jpg');
    expect(t.said).toContain('  2  ready.musicxml');
    expect(t.said.some((l) => l.includes('notes.txt'))).toBe(false);
    expect(t.recognised).toEqual([`${join(PHOTO_IN, 'hands.jpg')} -> ${join(PHOTO_OUT, 'own-kaed-koos')}`]);
    expect([...t.written.keys()]).toEqual([join(PHOTO_OUT, 'own-kaed-koos.pianor-piece.json'), join(PHOTO_OUT, 'own-kaed-koos.report.txt')]);
    expect(t.said).toContain(`Saved: ${join(PHOTO_OUT, 'own-kaed-koos.pianor-piece.json')}`);
  });

  it('ft_Y_04.AC8 a MusicXML file skips Audiveris; the title defaults to the file name; reading again and the next sheet', async () => {
    const t = fakeIo(['2', '', 'a', 'n', '9', 'r', '', 'q']);
    await photoMenu(t.io);
    expect(t.recognised).toEqual([]);
    expect(t.written.has(join(PHOTO_OUT, 'own-ready.pianor-piece.json'))).toBe(true);
    expect(t.said.filter((l) => l.startsWith('To fill by hand'))).toHaveLength(2);
    expect(t.said).toContain('No sheet 9.');
  });

  it('ft_Y_04.AC8 says why when Audiveris fails or the score is not taken, and can change folder', async () => {
    const t = fakeIo(['f', 'D:\\sheets', '1', 'x', 'n', '2', '', 'q'], {
      list: (dir) => (dir === 'D:\\sheets' ? ['a.png', 'b.mxl'] : []),
      recognise: () => Promise.resolve({ ok: false, reason: 'Audiveris did not start' }),
      readScore: () => ({ ok: false, reason: 'the score has no notes to play' }),
    });
    await photoMenu(t.io);
    expect(t.said).toContain('  (none yet: put scans, photos, PDFs or MusicXML files there)');
    expect(t.said).toContain('Sheets in D:\\sheets:');
    expect(t.said).toContain('Audiveris could not read it: Audiveris did not start');
    expect(t.said).toContain('Not taken: the score has no notes to play');
    expect(t.written.size).toBe(0);
  });
});

describe('reading one sheet for the piece maker (ft_Y_04.AC16)', () => {
  it('ft_Y_04.AC16 writes the bar map beside a straightened photo, and none when the photo was not straightened', async () => {
    const image = { width: 600, height: 300, data: new Uint8Array(600 * 300).fill(255) };
    const staves = [{ top: 60, bottom: 100, left: 40, right: 560, interline: 10 }, { top: 160, bottom: 200, left: 40, right: 560, interline: 10 }];
    const written = new Map<string, string>();
    const io = {
      recognise: () => Promise.resolve({ ok: true as const, score: 's.mxl', cleaned: { file: join('out', 'own-a', 'a-jpg-cleaned.png'), result: { image, note: '', straightened: true, staves } } }),
      readScore: () => fixture(),
      write: (path: string, text: string) => written.set(path, text),
    };
    const read = await readSheet(io, join('in', 'a.jpg'), 'A', 'out');
    expect(read.ok).toBe(true);
    const map = JSON.parse(written.get(join('out', 'own-a', PHOTO_MAP)) ?? '{}') as PhotoMap;
    expect(map.image).toBe('a-jpg-cleaned.png');
    expect(map.layout.systems).toEqual([{ staves: [{ top: 60, bottom: 100 }, { top: 160, bottom: 200 }], bars: [{ x1: 40, x2: 560 }] }]);
    written.clear();
    const flat = { ...io, recognise: () => Promise.resolve({ ok: true as const, score: 's.mxl', cleaned: { file: 'x.png', result: { image, note: '', straightened: false, staves: [] } } }) };
    await readSheet(flat, join('in', 'a.jpg'), 'A', 'out');
    expect([...written.keys()].some((k) => k.endsWith(PHOTO_MAP))).toBe(false);
  });
});
