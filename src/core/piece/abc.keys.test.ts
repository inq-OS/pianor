// A key change inside a piece (core_09.AC56): a K: line in the music, at a bar line, written by every hand.
import { describe, expect, it } from 'vitest';
import { parseAbc } from './abc';
import { compilePiece } from './compile';

const HEADER = 'X:1\nT:Keys\nM:4/4\nL:1/4\nQ:1/4=100\nK:Cm\n';
const META = (hands: string[]) => JSON.stringify({ id: 'keys', title: 'Keys', level: 5, status: 'draft', hands, phrases: [], source: 'test', license: 'CC0-1.0', generator: { kind: 'hand' } });

const errors = (body: string) => parseAbc(HEADER + body).diagnostics.filter((d) => d.severity === 'error');
const compile = (body: string, hands = ['RH']) => {
  const out = compilePiece({ abc: HEADER + body, meta: META(hands) });
  expect(out.diagnostics.filter((d) => d.severity === 'error'), JSON.stringify(out.diagnostics)).toEqual([]);
  return out.chart!;
};

describe('a key change inside a piece (core_09.AC56)', () => {
  it('core_09.AC56 a K: line at a bar line changes the key from that bar on', () => {
    const chart = compile('c d e f | g4 |\nK:Ab\nc d e f | a4 |]');
    expect(chart.keyMap).toEqual([{ tick: 0, fifths: -3, mode: 'minor' }, { tick: 3840, fifths: -4, mode: 'major' }]);
  });

  it('core_09.AC56 the notes after it are spelled in the new key, an accidental still holds to the bar line', () => {
    // C minor: E and A are flat, D is not; A-flat major flats D too
    const chart = compile('d e a2 | z4 |\nK:Ab\nd e =d d | a4 |]');
    const alters = chart.notes.map((n) => `${n.spelling.step}${n.spelling.alter}`);
    expect(alters).toEqual(['D0', 'E-1', 'A-1', 'D-1', 'E-1', 'D0', 'D0', 'A-1']);
  });

  it('core_09.AC56 every hand writes the change at the same bar', () => {
    const two = (lh: string) => `V:RH clef=treble\nc4 |\nK:G\nB4 |]\nV:LH clef=bass\n${lh}\n`;
    const chart = compile(two('C,4 |\nK:G\nF,4 |]'), ['RH', 'LH']);
    expect(chart.keyMap.map((k) => k.fifths)).toEqual([-3, 1]);
    expect(chart.notes.find((n) => n.track === 'lh' && n.bar === 1)!.spelling.alter).toBe(1);
    const missing = parseAbc(HEADER + two('C,4 | F,4 |]')).diagnostics.filter((d) => d.severity === 'error');
    expect(missing.map((d) => d.message)).toEqual([expect.stringMatching(/every voice changes key at the same bar: voice LH has no K:G at bar 2/)]);
  });

  it('core_09.AC56 refuses a change inside a bar, before the music, with no music after it, or with a clef', () => {
    expect(errors('c d\nK:G\ne f |]').map((d) => d.message)).toEqual([expect.stringMatching(/key change must stand at a bar line/)]);
    expect(errors('K:G\nc4 |]').map((d) => d.message)).toEqual([expect.stringMatching(/the first key goes in the header/)]);
    expect(errors('c4 |]\nK:G\n').map((d) => d.message)).toEqual([expect.stringMatching(/needs music after it/)]);
    expect(errors('c4 |\nK:G clef=bass\nc4 |]').map((d) => d.message)).toEqual([expect.stringMatching(/clef.*not supported in a key change/)]);
  });

  it('core_09.AC56 a change to the key already in force adds nothing', () => {
    expect(compile('c4 |\nK:Cm\nc4 |]').keyMap).toHaveLength(1);
  });
});
