// Covers core_09.AC50: triplets drawn at their written value, beamed with a 3 on the beam, or under a bracket.
import { describe, expect, it } from 'vitest';
import { compilePiece } from '../piece/compile';
import type { Chart } from '../chart';
import { UnsupportedNotationError, layoutStaff, type StaffLayout } from './staff';

const META = JSON.stringify({ id: 'tri', title: 'Tri', level: 1, status: 'draft', hands: ['RH'], phrases: [], source: 'test', license: 'CC0-1.0', generator: { kind: 'hand' } });
const chartOf = (body: string): Chart => {
  const out = compilePiece({ abc: `X:1\nT:Tri\nM:4/4\nL:1/8\nQ:1/4=100\nK:C\n${body}`, meta: META });
  expect(out.diagnostics.filter((d) => d.severity === 'error')).toEqual([]);
  return out.chart!;
};
const lay = (chart: Chart): StaffLayout => layoutStaff(chart, { viewport: { width: 1366, height: 768 } });

describe('triplets on the staff (core_09.AC50)', () => {
  // beat 1: an eighth triplet low (stems up); beat 2: one high (stems down); beats 3-4: a quarter triplet
  const chart = chartOf("(3CDE (3c'ba (3G2A2B2 |]");
  const layout = lay(chart);

  it('core_09.AC50 triplet notes are drawn at their written value: eighths and quarters, never from their 160 or 320 ticks', () => {
    expect(layout.notes.map((n) => n.value)).toEqual(['eighth', 'eighth', 'eighth', 'eighth', 'eighth', 'eighth', 'quarter', 'quarter', 'quarter']);
    expect(layout.notes.every((n) => n.dot === null)).toBe(true);
  });

  it('core_09.AC50 an eighth triplet in one beat is one beamed run, with no flags', () => {
    expect(layout.beams.map((b) => b.notes)).toEqual([[0, 1, 2], [3, 4, 5]]);
    expect(layout.notes.slice(0, 6).every((n) => n.beamed && n.flags === 0)).toBe(true);
  });

  it('core_09.AC50 a beamed triplet has a small 3 centred on the outer side of its beam and no bracket', () => {
    const [low, high] = layout.tuplets;
    const [up, down] = layout.beams;
    expect(low).toMatchObject({ index: 0, notes: [0, 1, 2], above: true, bracket: null });
    expect(low!.number.x).toBeCloseTo((up!.x1 + up!.x2) / 2, 6);
    expect(low!.bottom).toBeLessThan(up!.y); // above the beam, clear of it
    expect(high).toMatchObject({ index: 1, notes: [3, 4, 5], above: false, bracket: null });
    expect(high!.top).toBeGreaterThan(down!.y);
  });

  it('core_09.AC50 a quarter triplet gets a bracket with the 3, beyond its stems, hooked toward the notes', () => {
    const t = layout.tuplets[2]!;
    expect(t.bracket).not.toBeNull();
    const quarters = layout.notes.slice(6);
    expect(t.bracket!.x1).toBeLessThan(quarters[0]!.x);
    expect(t.bracket!.x2).toBeGreaterThan(quarters[2]!.x);
    expect(t.number.x).toBeCloseTo((t.bracket!.x1 + t.bracket!.x2) / 2, 6);
    const ink = Math.min(...quarters.map((n) => Math.min(n.y - n.headRy, n.stem!.y2)));
    expect(t.bottom).toBeLessThan(ink);
    expect(t.bracket!.hook).toBeGreaterThan(0); // a bracket above hooks down
  });

  it('core_09.AC50 the finger and score hints of a triplet note stand beyond its 3, inside the staff room', () => {
    for (const t of layout.tuplets) {
      for (const index of t.notes) {
        const n = layout.notes.find((g) => g.index === index)!;
        if (t.above) expect(n.fingerY).toBeLessThan(t.top);
        else expect(n.labelY).toBeGreaterThan(t.bottom);
      }
    }
    // the rooms keep the number and the hints beyond it on the paper: a small viewport fits it all
    const small = layoutStaff(chart, { viewport: { width: 640, height: 200 } });
    const S = small.staffSpace;
    for (const n of small.notes) expect(n.fingerY - 0.55 * S).toBeGreaterThanOrEqual(0);
    for (const n of small.notes) expect(n.labelY + 0.55 * S).toBeLessThanOrEqual(small.height);
  });

  it('core_09.AC50 a triplet holding a rest gets a bracket over its notes and the rest, and the rest is drawn as an eighth', () => {
    const withRest = lay(chartOf('(3CzE G2 A2 B2 |]'));
    expect(withRest.rests[0]!.value).toBe('eighth');
    expect(withRest.beams).toEqual([]);
    const t = withRest.tuplets[0]!;
    expect(t).toMatchObject({ notes: [0, 1], rests: [0] });
    expect(t.bracket).not.toBeNull();
    expect(withRest.notes[0]!.flags).toBe(1);
  });

  it('core_09.AC50 a piece without triplets draws none, and a tuplet other than 3:2 is refused, never drawn wrong', () => {
    expect(lay(chartOf('C2 D2 E2 F2 |]')).tuplets).toEqual([]);
    const odd = { ...chart, tuplets: chart.tuplets!.map((t) => ({ ...t, actual: 5, normal: 4 })) };
    expect(() => lay(odd)).toThrow(UnsupportedNotationError);
  });
});
