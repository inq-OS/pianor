// Two voices in one hand (core_09.AC52, d164): the ABC overlay `&` and what it compiles to.
import { describe, expect, it } from 'vitest';
import { parseAbc, type AbcItem } from './abc';
import { compilePiece } from './compile';

const HEADER = 'X:1\nT:Two\nM:4/4\nL:1/4\nQ:1/4=100\nK:C\n';
const META = JSON.stringify({ id: 'two', title: 'Two', level: 5, status: 'draft', hands: ['RH'], phrases: [], source: 'test', license: 'CC0-1.0', generator: { kind: 'hand' } });

const parse = (body: string) => parseAbc(HEADER + body);
const errors = (body: string) => parse(body).diagnostics.filter((d) => d.severity === 'error');
const clean = (body: string): AbcItem[] => {
  const parsed = parse(body);
  const list = parsed.diagnostics.filter((d) => d.severity === 'error');
  expect(list, JSON.stringify(list)).toEqual([]);
  return parsed.voices[0]!.items;
};
const compile = (body: string) => compilePiece({ abc: HEADER + body, meta: META });
const brief = (items: AbcItem[]) => items.map((i) => [i.voice ?? 1, i.kind === 'notes' ? i.notes.map((n) => n.midi).join('+') : 'z', i.tick, i.dur]);

describe('voice overlay & (core_09.AC52)', () => {
  it('core_09.AC52 the music after & is voice 2 of the same bar, from its bar line', () => {
    expect(brief(clean('e d c2 & C4 | e4 |]'))).toEqual([
      [1, '76', 0, 480], [1, '74', 480, 480], [1, '72', 960, 960], [2, '60', 0, 1920], [1, '76', 1920, 1920],
    ]);
  });

  it('core_09.AC52 voice 2 writes its own rests; bars without an overlay have no voice-2 notes', () => {
    const items = clean('e2 d2 & z C3 | c4 | e4 & z2 C2 |]');
    expect(items.filter((i) => i.voice === 2).map((i) => [i.kind, i.tick])).toEqual([['rest', 0], ['notes', 480], ['rest', 3840], ['notes', 4800]]);
    expect(items.filter((i) => i.tick >= 1920 && i.tick < 3840).every((i) => i.voice === undefined)).toBe(true);
  });

  it('core_09.AC52 the overlay can go on over a line break up to the bar line', () => {
    expect(brief(clean('c4 &\nE2 G2 | c4 |]')).filter((b) => b[0] === 2)).toEqual([[2, '64', 0, 960], [2, '67', 960, 960]]);
  });

  it('core_09.AC52 voice 2 must fill exactly as much as voice 1 in its bar', () => {
    expect(errors('c4 & E2 | c4 |]').map((e) => e.message)).toEqual([expect.stringMatching(/voice 2 of bar 1 has 2 beats but voice 1 has 4/)]);
    expect(errors('c4 & |]').map((e) => e.message)).toEqual([expect.stringMatching(/voice 2 of bar 1 has 0 beats/)]);
  });

  it('core_09.AC52 a pick-up bar overlays its own length', () => {
    const out = compile('c & E | c4 | c3 & E3 |]');
    expect(out.diagnostics.filter((d) => d.severity === 'error')).toEqual([]);
    expect(out.chart!.notes.filter((n) => n.voice === 2).map((n) => [n.tick, n.bar])).toEqual([[0, 0], [2400, 2]]);
  });

  it('core_09.AC52 a third voice, an overlay across a bar line and (& &) are refused with their position', () => {
    const third = errors('c4 & E4 & C4 | c4 |]');
    expect(third).toEqual([expect.objectContaining({ line: 7, column: 9, message: expect.stringMatching(/more than two voices/) })]);
    const across = errors('c4 & E2 G4 | c4 |]');
    expect(across).toEqual([expect.objectContaining({ line: 7, column: 9, message: expect.stringMatching(/voice 2.*past the end of bar 1/) })]);
    expect(errors('c4 (& E4 &) | c4 |]').map((e) => [e.column, e.message])).toEqual(expect.arrayContaining([[4, expect.stringMatching(/\(& and &\)/)]]));
  });

  it('core_09.AC52 voice 2 keeps its own ties, slurs and accidentals', () => {
    // voice 2's sharp does not sharpen voice 1, and voice 1's tie goes on over the overlay
    const items = clean('c2 f2- & ^F4 | f4 |]');
    expect(items.map((i) => (i.kind === 'notes' ? i.notes[0]!.midi : 0))).toEqual([72, 77, 66, 77]);
    // a voice-2 tie goes into the next bar's voice 2
    const tied = clean('c4 & C4- | c4 & C4 |]');
    expect(tied.filter((i) => i.voice === 2).map((i) => i.kind === 'notes' && (i.notes[0]!.tieNext ?? false))).toEqual([true, false]);
    expect(errors('c4 & C4- | c4 |]').map((e) => e.message)).toEqual([expect.stringMatching(/tie in voice 2/)]);
    const slurred = compile('(c2 d2) & (E2 F2) | c4 |]');
    expect(slurred.chart!.slurs).toEqual([
      { track: 'rh', voice: 1, startTick: 0, endTick: 960 },
      { track: 'rh', voice: 2, startTick: 0, endTick: 960 },
    ]);
  });

  it('core_09.AC52 AX-3 provisional: the same pitch on one tick in both voices is refused', () => {
    expect(errors('c4 & c2 E2 | c4 |]')).toEqual([expect.objectContaining({ line: 7, column: 6, message: expect.stringMatching(/same pitch.*both voices/) })]);
  });

  it('core_09.AC52 compiles to voice 2 of the same track, no chart format change', () => {
    const out = compile('e d c2 & C4 | e4 |]');
    expect(out.diagnostics.filter((d) => d.severity === 'error')).toEqual([]);
    const chart = out.chart!;
    expect(chart.schemaVersion).toBe(2);
    expect(chart.tracks.map((t) => t.id)).toEqual(['rh']);
    expect(chart.notes.map((n) => [n.tick, n.midi, n.voice])).toEqual([[0, 60, 2], [0, 76, 1], [480, 74, 1], [960, 72, 1], [1920, 76, 1]]);
  });

  it('core_09.AC52 AX-3 provisional: a pitch struck in one voice while the other still holds it is refused', () => {
    expect(errors('c4 & z2 c2 | c4 |]')).toEqual([expect.objectContaining({ line: 7, column: 9, message: expect.stringMatching(/still held in the other voice/) })]);
    expect(errors('z2 c2 & c4 | c4 |]')).toEqual([expect.objectContaining({ line: 7, column: 4, message: expect.stringMatching(/still held in the other voice/) })]);
    // one voice letting go before the other strikes the key is fine
    expect(errors('c2 z2 & z2 c2 | c4 |]')).toEqual([]);
  });

  it('core_09.AC52 a whole-bar rest Z in voice 1 can be overlaid, and Z fills voice 2 for one bar', () => {
    expect(brief(clean('Z & C4 | c4 |]'))).toEqual([[1, 'z', 0, 1920], [2, '60', 0, 1920], [1, '72', 1920, 1920]]);
    expect(brief(clean('c4 & Z | c4 |]'))).toEqual([[1, '72', 0, 1920], [2, 'z', 0, 1920], [1, '72', 1920, 1920]]);
    expect(errors('c4 & Z2 | c4 |]').map((e) => e.message)).toEqual(expect.arrayContaining([expect.stringMatching(/voice 2.*fills one bar/)]));
    // a Z with its & on the next line: one message that says what to do, no stray errors after it
    expect(errors('Z\n& C4 | c4 |]').map((e) => e.message)).toEqual([expect.stringMatching(/same line/)]);
  });

  it('core_09.AC52 a voice-2 tie or slur cannot cross a repeat sign, and voice 2 must end at a bar line before a V: switch', () => {
    expect(errors('|: c4 & C4- :| c4 & C4 |]').map((e) => e.message)).toEqual([expect.stringMatching(/voice 2 cannot cross a repeat sign/)]);
    const header = 'V:RH clef=treble\nV:LH clef=bass\n';
    const switched = parseAbc(`${HEADER}${header}V:RH\nc4 & C2\nV:LH\nC,4 |]\nV:RH\nC2 | c4 |]\nV:LH\nC,4 |]`);
    expect(switched.diagnostics.filter((d) => d.severity === 'error').map((e) => e.message)).toEqual(expect.arrayContaining([expect.stringMatching(/bar line before.*V:/)]));
  });

  it('core_09.AC52 notes on one line of the staff with different signs starting together in both voices are refused', () => {
    expect(errors('^F2 G2 & F4 | c4 |]')).toEqual([expect.objectContaining({ column: 10, message: expect.stringMatching(/same line of the staff/) })]);
  });

  it('core_09.AC52 a triplet in voice 2 is voice 2\'s, and one open at the & is refused (d163, d164)', () => {
    const out = compile('c4 & (3C/D/E/ F3 | c4 |]');
    expect(out.diagnostics.filter((d) => d.severity === 'error')).toEqual([]);
    expect(out.chart!.tuplets).toEqual([{ track: 'rh', voice: 2, startTick: 0, endTick: 320, actual: 3, normal: 2 }]);
    expect(out.chart!.notes.filter((n) => n.voice === 2).map((n) => [n.tick, n.dur])).toEqual([[0, 160], [160, 160], [320, 160], [480, 1440]]);
    expect(errors('(3c/d/ & C4 | c4 |]').map((e) => e.message)).toEqual(expect.arrayContaining([expect.stringMatching(/triplet needs its three notes before the &/)]));
  });
});
