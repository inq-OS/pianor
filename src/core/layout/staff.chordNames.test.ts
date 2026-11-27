// Covers core_09.AC59.
import { describe, expect, it } from 'vitest';
import type { Chart } from '../chart';
import { compilePiece } from '../piece/compile';
import type { Spelling } from '../chart/pitch';
import { layoutStaff, type StaffLayoutOptions } from './staff';

const META = JSON.stringify({ id: 'ch', title: 'Ch', level: 1, status: 'draft', hands: ['RH'], phrases: [], source: 'test', license: 'CC0-1.0', generator: { kind: 'hand' } });
const compiled = (body: string): Chart => {
  const out = compilePiece({ abc: `X:1\nT:Ch\nM:4/4\nL:1/4\nQ:1/4=100\nK:C\n${body}`, meta: META });
  expect(out.diagnostics.filter((d) => d.severity === 'error')).toEqual([]);
  return out.chart!;
};

/** A stand-in for the chord namer: names C major and the half-diminished C, nothing else. */
const namer = (keys: readonly number[]): string | null => {
  const set = [...new Set(keys.map((k) => k % 12))].sort((a, b) => a - b).join(',');
  return set === '0,4,7' ? 'C' : set === '0,3,6,10' ? 'Cm7b5' : null;
};

const lay = (chart: Chart, chordNames?: StaffLayoutOptions['chordNames']) =>
  layoutStaff(chart, { viewport: { width: 1366, height: 768 }, staffSpace: 24, ...(chordNames ? { chordNames } : {}) });

const labels = (chart: Chart, chordNames?: StaffLayoutOptions['chordNames']) => lay(chart, chordNames).notes.map((n) => n.label).filter((l) => l !== '');

describe('chord names under a chord (core_09.AC59)', () => {
  const chart = compiled('[CEG]2 [CE]2 | [C_E_G_B]4 |]');

  it('core_09.AC59 by default a chord is named by its notes, low to high', () => {
    expect(labels(chart)).toEqual(['C E G', 'C E', 'C Eb Gb Bb']);
  });

  it('core_09.AC59 "name" shows the chord name where the namer knows the chord, and the notes where it does not', () => {
    expect(labels(chart, { show: 'name', name: namer })).toEqual(['C', 'C E', 'Cm7b5']);
  });

  it('core_09.AC59 "both" shows the notes, and the name on a second line under them', () => {
    const layout = lay(chart, { show: 'both', name: namer });
    const named = layout.notes.filter((n) => n.label !== '');
    expect(named.map((n) => n.label)).toEqual(['C E G\nC', 'C E', 'C Eb Gb Bb\nCm7b5']);
    expect(named.map((n) => n.labelLines)).toEqual([2, 1, 2]);
  });

  it('core_09.AC59 the namer gets each key with its spelling as written, so the name can spell its root as the notes do', () => {
    const got: { keys: number[]; spellings: Spelling[] }[] = [];
    const spy = (keys: readonly number[], spellings: readonly Spelling[]) => {
      got.push({ keys: [...keys], spellings: [...spellings] });
      return null;
    };
    lay(compiled('[^D^F^A]4 |]'), { show: 'name', name: spy });
    expect(got.at(-1)!.keys).toEqual([63, 66, 70]);
    expect(got.at(-1)!.spellings.map((s) => `${s.step}${s.alter}`)).toEqual(['D1', 'F1', 'A1']);
  });

  it('core_09.AC59 a single note is never named as a chord', () => {
    expect(labels(compiled('C D E F |]'), { show: 'name', name: () => 'X' })).toEqual(['C', 'D', 'E', 'F']);
  });

  it('core_09.AC59 with two lines the staff keeps room for both, and a dynamic mark goes under the second', () => {
    const marked = compiled('!p![CEG]4 |]');
    const one = lay(marked);
    const two = lay(marked, { show: 'both', name: namer });
    const below = (l: ReturnType<typeof lay>) => l.systems[0]!.cursorTipY - l.systems[0]!.bottomLineY;
    expect(below(two)).toBeGreaterThan(below(one));
    const chord = two.notes.find((n) => n.dynamic !== null)!;
    const plain = one.notes.find((n) => n.dynamic !== null)!;
    expect(chord.dynamic!.y - chord.labelY).toBeGreaterThan(plain.dynamic!.y - plain.labelY);
  });
});
