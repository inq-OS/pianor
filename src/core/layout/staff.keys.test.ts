// A key change on the staff (core_09.AC57) and a song whose part sets its own key (ft_1_36.AC9).
import { describe, expect, it } from 'vitest';
import type { Chart } from '../chart/schema.ts';
import { compilePiece } from '../piece/compile.ts';
import { songSchema } from '../song/schema.ts';
import { songChart } from '../song/songChart.ts';
import { layoutStaff, type StaffLayout } from './staff.ts';

function chartOf(body: string, key = 'C', hands = ['RH'], id = 'keys'): Chart {
  const abc = `X:1\nT:${id}\nM:4/4\nL:1/4\nQ:1/4=80\nK:${key}\n${body}`;
  const meta = { id, title: id, level: 5, status: 'draft', hands, phrases: [], source: 'test', license: 'CC0-1.0', generator: { kind: 'hand' } };
  const out = compilePiece({ abc, meta: JSON.stringify(meta) });
  if (!out.chart) throw new Error(out.diagnostics.map((d) => d.message).join('\n'));
  return out.chart;
}

const lay = (chart: Chart, barsPerLine?: number): StaffLayout =>
  layoutStaff(chart, { viewport: { width: 1366, height: 768 }, ...(barsPerLine === undefined ? {} : { barsPerLine }) });

/** The signs drawn inside a bar for its key change, left to right, as `n` (natural), `b` (flat) or `#` (sharp). */
const changeSigns = (layout: StaffLayout, bar: number, staff = 0) =>
  layout.keySignature.filter((k) => k.bar === bar && k.staff === staff).sort((a, b) => a.x - b.x).map((k) => (k.alter === 0 ? 'n' : k.alter < 0 ? 'b' : '#')).join('');

describe('a key change on the staff (core_09.AC57)', () => {
  it('core_09.AC57 draws a double bar line and the new signature at the start of the bar, before its first note', () => {
    const layout = lay(chartOf('c4 | c4 |\nK:Ab\nc4 | c4 |]', 'Cm'), 4);
    const bar = layout.bars[2]!;
    expect(layout.barlines.find((b) => Math.abs(b.x - bar.x) < 0.01)!.kind).toBe('double');
    expect(changeSigns(layout, 2)).toBe('bbbb');
    const signs = layout.keySignature.filter((k) => k.bar === 2);
    const first = layout.notes.find((n) => n.bar === 2)!;
    for (const k of signs) {
      expect(k.x).toBeGreaterThan(bar.x);
      expect(k.x + layout.staffSpace).toBeLessThan(first.x - first.headRx);
    }
    // the line start keeps C minor's three flats
    expect(layout.keySignature.filter((k) => k.bar === undefined && k.system === 0)).toHaveLength(3);
  });

  it('core_09.AC57 cancels with naturals the signs the new key drops, then draws its own', () => {
    expect(changeSigns(lay(chartOf('c4 |\nK:F\nc4 |]', 'G')), 1)).toBe('nb');
    expect(changeSigns(lay(chartOf('c4 |\nK:C\nc4 |]', 'D')), 1)).toBe('nn');
    expect(changeSigns(lay(chartOf('c4 |\nK:G\nc4 |]', 'D')), 1)).toBe('n#');
    expect(changeSigns(lay(chartOf('c4 |\nK:A\nc4 |]', 'D')), 1)).toBe('###');
  });

  it('core_09.AC57 a line that starts in the new key shows it after the clef and nothing in its first bar', () => {
    const layout = lay(chartOf('c4 | c4 |\nK:D\nc4 | c4 |]'), 2);
    expect(layout.bars[2]!.system).toBe(1);
    expect(changeSigns(layout, 2)).toBe('');
    expect(layout.keySignature.filter((k) => k.system === 1).map((k) => k.alter)).toEqual([1, 1]);
    expect(layout.keySignature.filter((k) => k.system === 0)).toEqual([]);
    // each line's bars start after its own key: the line in D starts later than the line in C
    expect(layout.bars[2]!.x).toBeGreaterThan(layout.bars[0]!.x);
  });

  it('core_09.AC57 the new key decides which accidentals print', () => {
    const layout = lay(chartOf('d4 |\nK:Ab\nd2 =d2 |]', 'Cm'));
    const accidentals = layout.notes.map((n) => n.accidental?.alter ?? null);
    expect(accidentals).toEqual([null, null, 0]);
  });

  it('core_09.AC57 a change of mode alone draws no signature and no double bar line', () => {
    const layout = lay(chartOf('c4 |\nK:Am\nc4 |]'));
    expect(layout.keySignature).toEqual([]);
    expect(layout.barlines.some((b) => b.kind === 'double')).toBe(false);
  });

  it('core_09.AC57 both staves of the grand staff change', () => {
    const layout = lay(chartOf('V:RH clef=treble\nc4 |\nK:Bb\nc4 |]\nV:LH clef=bass\nC,4 |\nK:Bb\nC,4 |]\n', 'C', ['RH', 'LH']));
    expect(changeSigns(layout, 1, 0)).toBe('bb');
    expect(changeSigns(layout, 1, 1)).toBe('bb');
  });
});

describe('a song whose part sets its own key (ft_1_36.AC9)', () => {
  it('ft_1_36.AC9 the joined song draws, with the part key signature where it starts', () => {
    const intro = chartOf('c4 | c4 |]', 'C', ['RH'], 'intro');
    const verse = chartOf('c4 | c4 |]', 'G', ['RH'], 'verse');
    const song = songSchema.parse({
      schemaVersion: 1, id: 's', title: 'S', status: 'draft', source: 'original', license: 'CC0-1.0', bpm: 80, key: { fifths: 0, mode: 'major' }, meter: { num: 4, den: 4 },
      nodes: [{ kind: 'piece', id: 'a', piece: 'intro' }, { kind: 'piece', id: 'b', piece: 'verse', key: { fifths: 1, mode: 'major' } }],
    });
    const joined = songChart(song, (id) => [intro, verse].find((c) => c.id === id))!;
    expect(joined.chart.keyMap.map((k) => k.fifths)).toEqual([0, 1]);
    expect(changeSigns(lay(joined.chart), 2)).toBe('#');
  });
});
