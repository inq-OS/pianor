// Covers core_09.AC47: first and second endings drawn as brackets over their bars, "1." and "2." at the left.
import { describe, expect, it } from 'vitest';
import { compilePiece } from '../piece/compile';
import type { Chart } from '../chart';
import { layoutStaff, type StaffLayout } from './staff';

const META = JSON.stringify({ id: 'end', title: 'End', level: 1, status: 'draft', hands: ['RH'], phrases: [], source: 'test', license: 'CC0-1.0', generator: { kind: 'hand' } });
const chartOf = (body: string): Chart => {
  const out = compilePiece({ abc: `X:1\nT:End\nM:4/4\nL:1/4\nQ:1/4=100\nK:C\n${body}`, meta: META });
  expect(out.diagnostics.filter((d) => d.severity === 'error')).toEqual([]);
  return out.chart!;
};
const lay = (chart: Chart, barsPerSystem?: number): StaffLayout =>
  layoutStaff(chart, { viewport: { width: 1366, height: 768 }, ...(barsPerSystem ? { barsPerLine: barsPerSystem } : {}) });

describe('first and second endings on the staff (core_09.AC47)', () => {
  it('core_09.AC47 a bracket over each ending\'s bars, 1. and 2. at its left; the first is closed at its right end, the second open', () => {
    const layout = lay(chartOf('|: C4 | D4 |1 E4 | F4 :|2 G4 || A4 |]'));
    const bars = layout.bars;
    const top = layout.systems[0]!.topLineY;
    expect(layout.endings).toEqual([
      { number: 1, system: 0, x1: bars[2]!.x, x2: bars[3]!.x + bars[3]!.width, y: expect.any(Number), hookLeft: true, hookRight: true, label: true },
      { number: 2, system: 0, x1: bars[4]!.x, x2: bars[4]!.x + bars[4]!.width, y: expect.any(Number), hookLeft: true, hookRight: false, label: true },
    ]);
    // above the staff and above every note of its bars
    for (const e of layout.endings!) {
      expect(e.y).toBeLessThan(top);
      const inside = layout.notes.filter((n) => n.x >= e.x1 && n.x <= e.x2);
      for (const n of inside) expect(e.y).toBeLessThan(Math.min(n.y - n.headRy, n.stem ? Math.min(n.stem.y1, n.stem.y2) : Infinity));
    }
  });

  it('core_09.AC47 an ending across a line break is two pieces: the label and the left hook on the first, the right hook on the last', () => {
    const layout = lay(chartOf('|: C4 | D4 |1 E4 | F4 :|2 G4 |]'), 3);
    const first = layout.endings!.filter((e) => e.number === 1);
    expect(first.map((e) => [e.system, e.label, e.hookLeft, e.hookRight])).toEqual([[0, true, true, false], [1, false, false, true]]);
  });

  it('core_09.AC47 a chart without endings draws none', () => {
    expect(lay(chartOf('|: C4 | D4 :| E4 |]')).endings).toBeUndefined();
  });
});

describe('room for the endings (core_09.AC47)', () => {
  it('core_09.AC47 a piece with endings keeps more room above the top staff, so the bracket never reaches the line above', () => {
    const plain = lay(chartOf('|: C4 | D4 | E4 | F4 :| G4 | A4 | B4 | c4 |]'), 2);
    const ended = lay(chartOf('|: C4 | D4 | E4 |1 F4 :|2 G4 | A4 | B4 | c4 |]'), 2);
    expect(ended.systems[1]!.topLineY - ended.systems[0]!.bottomLineY).toBeGreaterThan(plain.systems[1]!.topLineY - plain.systems[0]!.bottomLineY - 0.01);
    const second = ended.endings!.find((e) => e.system === 1);
    if (second) expect(second.y - ended.staffSpace).toBeGreaterThan(ended.systems[0]!.bottomLineY);
  });
});
