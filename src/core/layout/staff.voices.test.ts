// Two voices in one hand on the staff (core_09.AC53, d164).
import { describe, expect, it } from 'vitest';
import { compilePiece } from '../piece/compile';
import type { Chart } from '../chart';
import { layoutStaff } from './staff';

const META = JSON.stringify({ id: 'two', title: 'Two', level: 5, status: 'draft', hands: ['RH'], phrases: [], source: 'test', license: 'CC0-1.0', generator: { kind: 'hand' } });
const chartOf = (body: string): Chart => {
  const out = compilePiece({ abc: `X:1\nT:Two\nM:4/4\nL:1/4\nQ:1/4=100\nK:C\n${body}`, meta: META });
  expect(out.diagnostics.filter((d) => d.severity === 'error')).toEqual([]);
  return out.chart!;
};
const S = 16;
const lay = (chart: Chart) => layoutStaff(chart, { viewport: { width: 1366, height: 768 }, staffSpace: S });
const glyphsOf = (chart: Chart, voice: number) => {
  const layout = lay(chart);
  return layout.notes.filter((g) => chart.notes[g.index]!.voice === voice);
};

describe('two voices on one staff (core_09.AC53)', () => {
  it('core_09.AC53 voice 1 has its stems up and voice 2 down, whatever the pitch; a bar of one voice keeps the pitch rule', () => {
    // voice 1 high (alone its stems would point down), voice 2 low (alone up)
    const chart = chartOf("a b c' d' & C2 C2 | a b c' d' |]");
    const layout = lay(chart);
    const stem = (i: number) => layout.notes.find((g) => g.index === i)!.stem;
    const one = chart.notes.flatMap((n, i) => (n.voice === 1 && n.bar === 0 ? [i] : []));
    const two = chart.notes.flatMap((n, i) => (n.voice === 2 ? [i] : []));
    expect(one.map((i) => stem(i)!.up)).toEqual([true, true, true, true]);
    expect(two.map((i) => stem(i)!.up)).toEqual([false, false]);
    const alone = chart.notes.flatMap((n, i) => (n.bar === 1 ? [i] : []));
    expect(alone.map((i) => stem(i)!.up)).toEqual([false, false, false, false]);
  });

  it('core_09.AC53 a rest of voice 1 is raised and a rest of voice 2 lowered; a bar of one voice keeps them on the middle line', () => {
    const chart = chartOf('z2 c2 & E2 z2 | z2 c2 |]');
    const layout = lay(chart);
    const staff = layout.systems[0]!.staves[0]!;
    const yAt = (position: number) => staff.bottomLineY - (position * S) / 2;
    const restY = (voice: number, bar: number) => layout.rests.find((r) => chart.rests[r.index]!.voice === voice && r.bar === bar)!.y;
    expect(restY(1, 0)).toBe(yAt(8));
    expect(restY(2, 0)).toBe(yAt(0));
    expect(restY(1, 1)).toBe(yAt(4));
  });

  it('core_09.AC53 heads of the two voices a second apart stand side by side, the lower one on the right, so the stems meet in one line', () => {
    const chart = chartOf('d2 d2 & c2 e2 | e4 & c4 |]');
    const layout = lay(chart);
    const at = (bar: number, voice: number, nth = 0) => layout.notes.filter((g) => g.bar === bar && chart.notes[g.index]!.voice === voice)[nth]!;
    // voice 1 above: voice 2's head goes right, its down stem on voice 1's up stem
    expect(at(0, 2).x - at(0, 1).x).toBeCloseTo(2 * at(0, 1).headRx);
    expect(at(0, 2).stem!.x).toBeCloseTo(at(0, 1).stem!.x);
    // crossed voices (voice 1 under voice 2): the stem-up head of voice 1 goes right
    expect(at(0, 1, 1).x - at(0, 2, 1).x).toBeCloseTo(2 * at(0, 1, 1).headRx);
    // a third apart: one column
    expect(at(1, 1).x).toBe(at(1, 2).x);
  });

  it('core_09.AC53 a dot of the head that stays goes past the moved head', () => {
    const chart = chartOf('d3 z & c3 z |]');
    const layout = lay(chart);
    const one = layout.notes.find((g) => chart.notes[g.index]!.voice === 1)!;
    const two = layout.notes.find((g) => chart.notes[g.index]!.voice === 2)!;
    expect(one.dot!.x).toBeGreaterThan(two.x + two.headRx);
  });

  it('core_09.AC53 a sign holds on its line for both voices: a note that sounds otherwise prints its own', () => {
    const chart = chartOf('^f2 g2 & z2 f2 |]');
    const layout = lay(chart);
    const printed = layout.notes.flatMap((g) => (g.accidental ? [[chart.notes[g.index]!.voice, chart.notes[g.index]!.midi, g.accidental.alter]] : []));
    expect(printed).toEqual([[1, 78, 1], [2, 77, 0]]);
    // a voice that sounds as the other voice's sign says prints none
    const same = chartOf('^f2 g2 & z2 ^f2 |]');
    expect(lay(same).notes.filter((g) => g.accidental).map((g) => same.notes[g.index]!.voice)).toEqual([1]);
  });

  it('core_09.AC53 the accidentals of both voices on one tick stand in columns left of all their heads', () => {
    const chart = chartOf('^f4 & ^d4 |]');
    const layout = lay(chart);
    const signs = layout.notes.flatMap((g) => (g.accidental ? [g.accidental.x] : []));
    expect(signs).toHaveLength(2);
    expect(new Set(signs).size).toBe(2);
    const leftmost = Math.min(...layout.notes.map((g) => g.x - g.headRx));
    for (const x of signs) expect(x).toBeLessThan(leftmost);
  });

  it('core_09.AC53 note names, fingers and scores of a two-voice tick are placed over both voices, never on a head', () => {
    const chart = chartOf('!3!E F G F & !1!C4 |]');
    const layout = layoutStaff(chart, { viewport: { width: 1366, height: 768 }, staffSpace: S, scoreRoom: true });
    const tick0 = layout.notes.filter((g) => chart.notes[g.index]!.tick === 0);
    expect(tick0.map((g) => g.label).filter((l) => l !== '')).toEqual(['C E']);
    expect(tick0.filter((g) => g.finger !== null).map((g) => g.finger)).toEqual([3]);
    for (const g of tick0) {
      for (const other of tick0) {
        const onHead = (y: number) => y > other.y - other.headRy && y < other.y + other.headRy;
        expect(onHead(g.labelY)).toBe(false);
        expect(onHead(g.fingerY)).toBe(false);
        expect(onHead(g.scoreY)).toBe(false);
      }
    }
  });

  it('core_09.AC53 each voice is beamed on its own, in its own stem direction', () => {
    const chart = chartOf('c/d/e/f/ g2 & E/F/G/A/ C2 |]');
    const layout = lay(chart);
    expect(layout.beams).toHaveLength(4);
    for (const beam of layout.beams) {
      const voices = new Set(beam.notes.map((i) => chart.notes[i]!.voice));
      expect(voices.size).toBe(1);
      expect(beam.up).toBe(voices.has(1));
    }
  });

  it('core_09.AC53 accidentals, ties and slurs go per voice, ties and slurs on the stem side', () => {
    const chart = chartOf('^f2 f2- & F2 G2 | f4 & F4 |]');
    const layout = lay(chart);
    const glyph = (i: number) => layout.notes.find((g) => g.index === i)!;
    const sharps = chart.notes.flatMap((n, i) => (glyph(i).accidental ? [[n.voice, n.midi]] : []));
    // the sharp holds in voice 1 for the bar; voice 2's F is natural and prints nothing
    expect(sharps).toEqual([[1, 78]]);
    const tie = layout.ties[0]!;
    expect(chart.notes[tie.from!]!.voice).toBe(1);
    expect(tie.up).toBe(true); // with two voices, ties and slurs go on the stem side: voice 1 above, voice 2 below
    const slurred = chartOf('c2 d2 & (E2 G2) |]');
    const slur = lay(slurred).slurs[0]!;
    expect(slurred.notes[slur.from!]!.voice).toBe(2);
    expect(slur.up).toBe(false);
    expect(glyphsOf(slurred, 2)).toHaveLength(2);
  });

  it('core_09.AC40 one voice: a beamed chord with a second takes its accidentals past the head its run moves aside', () => {
    // alone the chord F#4-G4 would point up; the run with G5 points down, so F#4 moves left of the stem
    const chart = chartOf("[^FG]/ g'/ z3 |]");
    const layout = lay(chart);
    const chord = layout.notes.filter((g) => chart.notes[g.index]!.tick === 0);
    expect(chord.every((g) => g.beamed)).toBe(true);
    const stem = chord.find((g) => g.stem)!.stem!;
    expect(stem.up).toBe(false);
    const sharp = chord.find((g) => g.accidental)!.accidental!;
    const leftmostHead = Math.min(...chord.map((g) => g.x - g.headRx));
    expect(sharp.x).toBeLessThan(leftmostHead - (0.5 * S));
  });

  it('core_09.AC53 a note name stays clear of the lowered voice-2 rest under it', () => {
    const chart = chartOf('G2 E2 & z2 C2 |]');
    const layout = lay(chart);
    const rest = layout.rests[0]!;
    const g = layout.notes.find((n) => chart.notes[n.index]!.tick === 0)!;
    expect(g.labelY).toBeGreaterThan(rest.y + 1.5 * S);
  });

  it('core_09.AC53 a rest moves clear of the other voice\'s heads on its tick', () => {
    const inkOf = (value: string) => (value === 'whole' ? [-1, 0] : value === 'half' ? [0, 1] : [-3, 3]);
    const clear = (body: string) => {
      const chart = chartOf(body);
      const layout = lay(chart);
      const staff = layout.systems[0]!.staves[0]!;
      const positionOf = (y: number) => ((staff.bottomLineY - y) * 2) / S;
      for (const r of layout.rests) {
        const rest = chart.rests[r.index]!;
        const [low, high] = inkOf(r.value).map((d) => positionOf(r.y) + d);
        for (const g of layout.notes.filter((n) => chart.notes[n.index]!.tick === rest.tick)) {
          expect(high! <= g.position - 1 || low! >= g.position + 1, `${body}: rest at ${positionOf(r.y)} on head ${g.position}`).toBe(true);
        }
      }
    };
    clear('E F G F & z C3 |]');
    clear('F/ z/ G F2 & z/ C/ C C2 |]');
    clear('G2 E2 & z2 C2 |]');
    clear("z c3 & a b c'2 |]");
    clear("Z & a4 |]");
  });

  it('core_09.AC53 the joined names of a tick go on the lowest head that has a name', () => {
    const chart = chartOf('E F G F & C4- | D2 E2 & C4 |]');
    const layout = lay(chart);
    const bar1 = layout.notes.filter((g) => g.bar === 1 && chart.notes[g.index]!.tick === 1920);
    const named = bar1.filter((g) => g.label !== '');
    expect(named.map((g) => [chart.notes[g.index]!.midi, g.label])).toEqual([[62, 'D']]);
  });

  it('core_09.AC53 a whole or half rest moved out of the staff touches a ledger line; inside it, none', () => {
    const chart = chartOf('G2 E2 & z2 C2 | Z & a4 | z2 c2 & z2 E2 |]');
    const layout = lay(chart);
    const staff = layout.systems[0]!.staves[0]!;
    const positionOf = (y: number) => Math.round(((staff.bottomLineY - y) * 2) / S);
    const rest = (bar: number, voice: number) => layout.rests.find((r) => r.bar === bar && chart.rests[r.index]!.voice === voice)!;
    expect(positionOf(rest(0, 2).y)).toBeLessThan(0);
    expect(rest(0, 2).ledgerLines!.map((l) => positionOf(l.y))).toEqual([positionOf(rest(0, 2).y)]);
    expect(positionOf(rest(1, 1).y)).toBeGreaterThan(8);
    expect(rest(1, 1).ledgerLines).toHaveLength(1);
    expect(rest(2, 1).ledgerLines).toBeUndefined();
  });

  it('core_09.AC53 a rest moved out of the staff keeps room on the paper: the system grows for it', () => {
    // the same notes, with and without the raised voice-1 rest over a high voice-2 note
    const raised = lay(chartOf("z c3 & a b c'2 |]"));
    const plain = lay(chartOf("c4 & a b c'2 |]"));
    expect(raised.systems[0]!.staves[0]!.topLineY).toBeGreaterThan(plain.systems[0]!.staves[0]!.topLineY);
    const top = raised.systems[0]!.staves[0]!.topLineY;
    const r = raised.rests[0]!;
    // the rest's ink (3 positions above its centre) stays below the top of the paper
    expect(r.y - 1.5 * S).toBeGreaterThan(0);
    expect(top).toBeGreaterThan(0);
  });

  it('core_09.AC53 a triplet in voice 2 is drawn at its written value with its 3 below, on the stem side (d163)', () => {
    const chart = chartOf('c4 & (3C/D/E/ F3 | c4 |]');
    const layout = lay(chart);
    expect(layout.tuplets).toHaveLength(1);
    expect(layout.tuplets[0]!.above).toBe(false);
    expect(glyphsOf(chart, 2).slice(0, 3).map((g) => g.stem?.up)).toEqual([false, false, false]);
  });
});
