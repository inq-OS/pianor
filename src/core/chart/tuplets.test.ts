// Covers core_09.AC49: triplets in the chart, the schema, repeats and sections.
import { describe, expect, it } from 'vitest';
import { compilePiece } from '../piece/compile';
import { chartSchema, type Chart } from './schema';
import { sliceChart } from './section';
import { unrollRepeats } from './repeats';
import { tupletOf, writtenDurOf } from './tuplets';

const META = JSON.stringify({ id: 'tri', title: 'Tri', level: 1, status: 'draft', hands: ['RH'], phrases: [], source: 'test', license: 'CC0-1.0', generator: { kind: 'hand' } });
const chartOf = (body: string): Chart => {
  const out = compilePiece({ abc: `X:1\nT:Tri\nM:4/4\nL:1/8\nQ:1/4=100\nK:C\n${body}`, meta: META });
  expect(out.diagnostics.filter((d) => d.severity === 'error')).toEqual([]);
  return out.chart!;
};

describe('triplets in the chart (core_09.AC49)', () => {
  const chart = chartOf('(3CDE F2 G2 A2 | (3zGF E4 D2 |]');

  it('core_09.AC49 the compiler writes each triplet in the chart, the notes at 160 ticks, no schema version change', () => {
    expect(chart.schemaVersion).toBe(2);
    expect(chart.tuplets).toEqual([
      { track: 'rh', voice: 1, startTick: 0, endTick: 320, actual: 3, normal: 2 },
      { track: 'rh', voice: 1, startTick: 1920, endTick: 2240, actual: 3, normal: 2 },
    ]);
    expect(chart.notes.slice(0, 3).map((n) => [n.tick, n.dur])).toEqual([[0, 160], [160, 160], [320, 160]]);
    expect(chart.rests).toEqual([{ tick: 1920, dur: 160, track: 'rh', voice: 1, bar: 1 }]);
  });

  it('core_09.AC49 a piece without triplets has no tuplets field', () => {
    expect(chartOf('C2 D2 E2 F2 |]').tuplets).toBeUndefined();
  });

  it('core_09.AC50 the written length of a triplet note is its played length times 3/2', () => {
    expect(tupletOf(chart, chart.notes[1]!)).toBe(chart.tuplets![0]);
    expect(writtenDurOf(chart, chart.notes[1]!)).toBe(240);
    expect(writtenDurOf(chart, chart.rests[0]!)).toBe(240);
    expect(writtenDurOf(chart, chart.notes[3]!)).toBe(480);
    expect(tupletOf(chart, chart.notes[3]!)).toBeUndefined();
  });

  it('core_09.AC49 the schema refuses a tuplet whose ends are not note or rest starts of its voice, or that overlaps another', () => {
    const bad = (tuplets: unknown[]) => chartSchema.safeParse({ ...chart, tuplets }).error?.issues.map((i) => i.message) ?? [];
    expect(bad([{ track: 'rh', voice: 1, startTick: 0, endTick: 300, actual: 3, normal: 2 }])).toContain('a tuplet must start and end on notes or rests of its own track and voice');
    expect(bad([{ track: 'rh', voice: 2, startTick: 0, endTick: 320, actual: 3, normal: 2 }])).toContain('a tuplet must start and end on notes or rests of its own track and voice');
    expect(bad([{ track: 'rh', voice: 1, startTick: 320, endTick: 320, actual: 3, normal: 2 }])).toContain('a tuplet must span two or more onsets');
    expect(bad([{ track: 'xx', voice: 1, startTick: 0, endTick: 320, actual: 3, normal: 2 }])).toContain('unknown track "xx"');
    expect(bad([
      { track: 'rh', voice: 1, startTick: 0, endTick: 320, actual: 3, normal: 2 },
      { track: 'rh', voice: 1, startTick: 320, endTick: 480, actual: 3, normal: 2 },
    ])).toContain('tuplets of one voice must not overlap');
    expect(bad(chart.tuplets!)).toEqual([]);
  });

  it('core_09.AC49 a repeat plays its triplets on each pass, and a section keeps the triplets of its bars', () => {
    const repeated = chartOf('|: (3CDE F2 G2 A2 :| B8 |]');
    expect(unrollRepeats(repeated).chart.tuplets).toEqual([
      { track: 'rh', voice: 1, startTick: 0, endTick: 320, actual: 3, normal: 2 },
      { track: 'rh', voice: 1, startTick: 1920, endTick: 2240, actual: 3, normal: 2 },
    ]);
    expect(sliceChart(chart, 1, 1).tuplets).toEqual([{ track: 'rh', voice: 1, startTick: 0, endTick: 320, actual: 3, normal: 2 }]);
  });
});
