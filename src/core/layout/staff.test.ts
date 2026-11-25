// Covers core_09.AC1, ft_0_02.AC2, ft_0_05.AC1, ft_0_05.AC2, ft_0_05.AC3.
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import littleSteps from '../../../tests/fixtures/charts/little-steps.v2.json';
import { chartSchema, type Chart } from '../chart';
import { chartWith } from '../../../tests/helpers/charts';
import { compilePiece } from '../piece/compile';
import { ACCIDENTAL_BOX, UnsupportedNotationError, accidentalColumns, accidentalRoomAt, layoutStaff, noteShapeOf, noteValueOf, type StaffLayout } from './staff';

type Json = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

const base = (): Json => structuredClone(littleSteps);
const parse = (c: Json): Chart => chartSchema.parse(c);

const VIEWPORTS = [
  { width: 1366, height: 768 },
  { width: 1280, height: 720 },
  { width: 1024, height: 600 },
  { width: 800, height: 1280 },
];

/** Build a chart from [midi-less spec] quickly: all natural notes in one bar sequence. */
function chartOf(opts: {
  clef?: 'treble' | 'bass';
  bars: number;
  num?: number;
  den?: number;
  fifths?: number;
  events: { tick: number; dur: number; step: string; octave: number; alter?: number; rest?: boolean; bar?: number }[];
}): Chart {
  const num = opts.num ?? 4;
  const den = opts.den ?? 4;
  const barTicks = (480 * 4 * num) / den;
  const steps: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
  const notes = opts.events.filter((e) => !e.rest).map((e) => ({
    tick: e.tick, dur: e.dur, midi: 12 * (e.octave + 1) + steps[e.step]! + (e.alter ?? 0),
    spelling: { step: e.step, alter: e.alter ?? 0, octave: e.octave }, track: 't', voice: 1, bar: Math.floor(e.tick / barTicks),
  }));
  const rests = opts.events.filter((e) => e.rest).map((e) => ({
    tick: e.tick, dur: e.dur, track: 't', voice: 1, bar: Math.floor(e.tick / barTicks),
  }));
  const midis = notes.map((n) => n.midi);
  return chartSchema.parse({
    schemaVersion: 2, id: 'x', contentVersion: 1, title: 'x', level: 1, ppq: 480,
    tempoMap: [{ tick: 0, bpm: 80 }], meterMap: [{ tick: 0, num, den }], keyMap: [{ tick: 0, fifths: opts.fifths ?? 0, mode: 'major' }],
    tracks: [{ id: 't', role: 'play', hand: opts.clef === 'bass' ? 'LH' : 'RH', clef: opts.clef ?? 'treble' }],
    notes, rests,
    bars: Array.from({ length: opts.bars }, (_, i) => ({ index: i, startTick: i * barTicks, endTick: (i + 1) * barTicks })),
    phrases: [], range: { low: Math.min(...midis, 60), high: Math.max(...midis, 60) },
  });
}

const lay = (chart: Chart, width = 1366, height = 768, staffSpace: number | 'auto' = 'auto'): StaffLayout =>
  layoutStaff(chart, { viewport: { width, height }, staffSpace });


describe('dynamic marks (core_09.AC15)', () => {
  it('draws a dynamic mark under the hint labels of the note it starts at, and no other note', () => {
    const c = base();
    c.notes[0].dynamic = 'p';
    const layout = layoutStaff(parse(c), { viewport: { width: 1366, height: 768 }, staffSpace: SPACE });
    const marked = layout.notes.filter((n) => n.dynamic !== null);
    expect(marked).toHaveLength(1);
    const [n] = marked;
    expect(n!.index).toBe(0);
    expect(n!.dynamic).toEqual({ text: 'p', x: n!.column, y: expect.any(Number) });
    expect(n!.dynamic!.y).toBeGreaterThan(n!.labelY);
  });

  it('leaves dynamic null on a piece without marks', () => {
    const layout = layoutStaff(parse(base()), { viewport: { width: 1366, height: 768 }, staffSpace: SPACE });
    expect(layout.notes.every((n) => n.dynamic === null)).toBe(true);
  });
});

describe('noteValueOf', () => {
  it('maps whole, half and quarter and rejects the rest', () => {
    expect(noteValueOf(1920)).toBe('whole');
    expect(noteValueOf(960)).toBe('half');
    expect(noteValueOf(480)).toBe('quarter');
    expect(() => noteValueOf(60)).toThrow(UnsupportedNotationError); // a thirty-second is not drawn
    expect(() => noteValueOf(1440)).toThrow(/dotted|unsupported/i);
  });
});

describe('layoutStaff geometry', () => {
  const layout = lay(parse(base()));

  it('names the hint labels from the spelling, with the naming setting (core_09.AC6)', () => {
    const named = layoutStaff(chartOf({ bars: 1, events: [
      { tick: 0, dur: 480, step: 'C', octave: 4, alter: 1 },
      { tick: 480, dur: 480, step: 'B', octave: 3, alter: -1 },
      { tick: 960, dur: 480, step: 'B', octave: 3 },
    ] }), { viewport: { width: 1366, height: 768 }, staffSpace: SPACE, noteNaming: 'H' });
    expect(named.notes.map((n) => n.label)).toEqual(['C#', 'B', 'H']);
    const plain = lay(chartOf({ bars: 1, events: [{ tick: 0, dur: 480, step: 'C', octave: 4, alter: 1 }] }));
    expect(plain.notes[0]!.label).toBe('C#');
  });

  it('creates one glyph per note, in chart order', () => {
    expect(layout.notes).toHaveLength(11);
    expect(layout.notes.map((n) => n.index)).toEqual(layout.notes.map((_, i) => i));
  });

  it('draws five staff lines per system, evenly spaced by the staff space', () => {
    for (let s = 0; s < layout.systems.length; s++) {
      const lines = layout.staffLines.filter((l) => l.system === s).map((l) => l.y);
      expect(lines).toHaveLength(5);
      for (let i = 1; i < 5; i++) expect(lines[i - 1]! - lines[i]!).toBeCloseTo(layout.staffSpace);
    }
  });

  it('puts E4 on the bottom line and G4 on the second line (treble)', () => {
    // fixture notes: C D E F, G(half) F(half), F E D C, C(whole)
    const e4 = layout.notes[2]!;
    const g4 = layout.notes[4]!;
    const bottomLine = Math.max(...layout.staffLines.filter((l) => l.system === e4.system).map((l) => l.y));
    expect(e4.position).toBe(0);
    expect(e4.y).toBeCloseTo(bottomLine);
    expect(g4.position).toBe(2);
    expect(g4.y).toBeCloseTo(bottomLine - layout.staffSpace);
  });

  it('gives middle C exactly one ledger line, centred on the note, below the staff', () => {
    const c4 = layout.notes[0]!;
    expect(c4.position).toBe(-2);
    expect(c4.ledgerLines).toHaveLength(1);
    expect(c4.ledgerLines[0]!.y).toBeCloseTo(c4.y);
    expect(c4.ledgerLines[0]!.x1).toBeLessThan(c4.x);
    expect(c4.ledgerLines[0]!.x2).toBeGreaterThan(c4.x);
    expect(layout.notes[2]!.ledgerLines).toHaveLength(0);
  });

  it('uses filled heads with stems for quarters, hollow with stems for halves, hollow without stem for wholes', () => {
    expect(layout.notes[0]).toMatchObject({ value: 'quarter', filled: true });
    expect(layout.notes[0]!.stem).not.toBeNull();
    expect(layout.notes[4]).toMatchObject({ value: 'half', filled: false });
    expect(layout.notes[4]!.stem).not.toBeNull();
    expect(layout.notes[10]).toMatchObject({ value: 'whole', filled: false });
    expect(layout.notes[10]!.stem).toBeNull();
  });

  it('points stems up below the middle line and down from the middle line up', () => {
    expect(layout.notes[0]!.stem!.up).toBe(true); // C4, position -2
    expect(layout.notes[4]!.stem!.up).toBe(true); // G4, position 2
    const high = lay(chartOf({ bars: 1, events: [
      { tick: 0, dur: 480, step: 'B', octave: 4 }, { tick: 480, dur: 480, step: 'C', octave: 5 },
      { tick: 960, dur: 480, step: 'D', octave: 5 }, { tick: 1440, dur: 480, step: 'A', octave: 4 },
    ] }));
    expect(high.notes.map((n) => n.position)).toEqual([4, 5, 6, 3]);
    expect(high.notes.map((n) => n.stem!.up)).toEqual([false, false, false, true]);
  });

  it('extends stems to the middle line for far-away notes', () => {
    const far = lay(chartOf({ bars: 1, events: [
      { tick: 0, dur: 480, step: 'C', octave: 3 }, { tick: 480, dur: 480, step: 'C', octave: 6 },
    ] }));
    const [low, high] = far.notes;
    const middleY = (n: typeof low) => n!.y - (4 - n!.position) * (far.staffSpace / 2);
    expect(low!.stem!.y2).toBeLessThanOrEqual(middleY(low) + 0.001);
    expect(high!.stem!.y2).toBeGreaterThanOrEqual(middleY(high) - 0.001);
  });

  it('adds labels and finger numbers for optional hints', () => {
    expect(layout.notes[0]).toMatchObject({ label: 'C', finger: 1 });
    expect(layout.notes[3]).toMatchObject({ label: 'F', finger: 4 });
    const noFinger = base();
    delete noFinger.notes[0].finger;
    expect(lay(parse(noFinger)).notes[0]!.finger).toBeNull();
  });

  it('reports the cursor anchor per note inside its bar', () => {
    for (const n of layout.notes) {
      const bar = layout.bars[n.bar]!;
      expect(n.x).toBeGreaterThan(bar.x);
      expect(n.x).toBeLessThan(bar.x + bar.width);
    }
  });

  it('draws a time signature once, the clef on every system and a final barline at the end', () => {
    expect(layout.timeSignature).toMatchObject({ num: 4, den: 4, system: 0 });
    expect(layout.clefs).toHaveLength(layout.systems.length);
    expect(layout.clefs[0]!.clef).toBe('treble');
    const finals = layout.barlines.filter((b) => b.kind === 'final');
    expect(finals).toHaveLength(1);
    expect(finals[0]!.system).toBe(layout.systems.length - 1);
  });

  it('is deterministic', () => {
    expect(lay(parse(base()))).toEqual(layout);
  });
});

describe('ties (core_09.AC10)', () => {
  // two half notes C4 tied across the bar line into the next C4 half note
  const tied = (): Chart => {
    const c = chartOf({ bars: 2, events: [{ tick: 0, dur: 1920, step: 'C', octave: 4 }, { tick: 1920, dur: 1920, step: 'C', octave: 4 }] });
    c.notes[0]!.tieNext = true;
    return c;
  };

  it('draws one curve from the head to the tied-to head, across the bar line', () => {
    const layout = lay(tied());
    expect(layout.ties).toHaveLength(1);
    const [tie] = layout.ties;
    expect(tie).toMatchObject({ from: 0, to: 1, system: 0 });
    expect(tie!.x1).toBeLessThan(tie!.x2);
  });

  it('bows the curve away from the stem: below a note with its stem up', () => {
    // C4 is below the middle line, so its stem points up and the curve goes under the heads
    expect(lay(tied()).ties[0]!.up).toBe(false);
  });

  it('gives the tied-to note no name hint and no finger', () => {
    const c = tied();
    c.notes[0]!.finger = 1;
    c.notes[1]!.finger = 2;
    const layout = lay(c);
    expect(layout.notes[1]!.label).toBe('');
    expect(layout.notes[1]!.finger).toBeNull();
    expect(layout.notes[0]!.finger).toBe(1);
  });

  it('splits a tie across a line break into two half curves', () => {
    const layout = layoutStaff(tied(), { viewport: { width: 1366, height: 768 }, staffSpace: 'auto', barsPerLine: 1 });
    expect(layout.systems).toHaveLength(2);
    expect(layout.ties).toHaveLength(2);
    expect(layout.ties[0]).toMatchObject({ from: 0, to: null, system: 0 });
    expect(layout.ties[1]).toMatchObject({ from: null, to: 1, system: 1 });
  });

  it('draws one curve per head of a tied chord', () => {
    const c = chartOf({ bars: 2, events: [
      { tick: 0, dur: 1920, step: 'C', octave: 4 }, { tick: 0, dur: 1920, step: 'E', octave: 4 },
      { tick: 1920, dur: 1920, step: 'C', octave: 4 }, { tick: 1920, dur: 1920, step: 'E', octave: 4 },
    ] });
    c.notes[0]!.tieNext = true;
    c.notes[1]!.tieNext = true;
    expect(lay(c).ties).toHaveLength(2);
  });

  it('draws no curve for a piece without ties', () => {
    expect(lay(parse(base())).ties).toEqual([]);
  });
});

describe('slurs (core_09.AC27)', () => {
  // quarter notes on one bar; a slur over the first `last + 1` of them
  const quarters = (steps: [string, number][]): Chart =>
    chartOf({ bars: 1, events: steps.map(([step, octave], i) => ({ tick: i * 480, dur: 480, step, octave })) });
  const slurred = (steps: [string, number][], last = steps.length - 1): Chart => {
    const c = quarters(steps);
    c.slurs = [{ track: 't', voice: 1, startTick: 0, endTick: last * 480 }];
    return c;
  };
  type SlurLayout = StaffLayout['slurs'][number];
  /** The curve's height at x (its control point sits midway, so x runs linearly along t). */
  const curveY = (s: SlurLayout, x: number): number => {
    const t = (x - s.x1) / (s.x2 - s.x1);
    return (1 - t) * (1 - t) * s.y1 + 2 * (1 - t) * t * s.controlY + t * t * s.y2;
  };

  it('draws the slur below the notes when every stem points up (C4 D4 E4 F4) (core_09.AC27)', () => {
    const layout = lay(slurred([['C', 4], ['D', 4], ['E', 4], ['F', 4]]));
    expect(layout.slurs).toHaveLength(1);
    expect(layout.slurs[0]).toMatchObject({ from: 0, to: 3, system: 0, up: false });
    expect(layout.slurs[0]!.controlY).toBeGreaterThan(layout.slurs[0]!.y1);
  });

  it('draws the slur above the notes when every stem points down (E5 D5 C5 B4) (core_09.AC27)', () => {
    const layout = lay(slurred([['E', 5], ['D', 5], ['C', 5], ['B', 4]]));
    expect(layout.slurs[0]).toMatchObject({ from: 0, to: 3, up: true });
    expect(layout.slurs[0]!.controlY).toBeLessThan(layout.slurs[0]!.y1);
  });

  it('draws the slur above the notes when the stems point both ways (C4 then E5) (core_09.AC27)', () => {
    expect(lay(slurred([['C', 4], ['E', 5]])).slurs[0]!.up).toBe(true);
  });

  it('draws the slur above the notes when the notes have no stems (two whole notes above the middle line) (core_09.AC27)', () => {
    const c = chartOf({ bars: 2, events: [{ tick: 0, dur: 1920, step: 'C', octave: 5 }, { tick: 1920, dur: 1920, step: 'E', octave: 5 }] });
    c.slurs = [{ track: 't', voice: 1, startTick: 0, endTick: 1920 }];
    expect(lay(c).slurs[0]!.up).toBe(true);
  });

  it('clears a head between its ends: the curve passes above a higher note (E5 A5 C5) (core_09.AC27)', () => {
    const layout = lay(slurred([['E', 5], ['A', 5], ['C', 5]]));
    const s = layout.slurs[0]!;
    expect(s.up).toBe(true);
    const between = layout.notes[1]!;
    expect(curveY(s, between.x)).toBeLessThanOrEqual(between.y - between.headRy);
  });

  it('clears a head between its ends when the slur is below (E4 C4 D4) (core_09.AC27)', () => {
    const layout = lay(slurred([['E', 4], ['C', 4], ['D', 4]]));
    const s = layout.slurs[0]!;
    expect(s.up).toBe(false);
    const between = layout.notes[1]!;
    expect(curveY(s, between.x)).toBeGreaterThanOrEqual(between.y + between.headRy);
  });

  it('splits a slur across a line break into two halves, as a tie is (core_09.AC27)', () => {
    const c = chartOf({ bars: 2, events: [{ tick: 0, dur: 1920, step: 'C', octave: 4 }, { tick: 1920, dur: 1920, step: 'D', octave: 4 }] });
    c.slurs = [{ track: 't', voice: 1, startTick: 0, endTick: 1920 }];
    const layout = layoutStaff(c, { viewport: { width: 1366, height: 768 }, staffSpace: 'auto', barsPerLine: 1 });
    expect(layout.systems).toHaveLength(2);
    expect(layout.slurs).toHaveLength(2);
    expect(layout.slurs[0]).toMatchObject({ from: 0, to: null, system: 0 });
    expect(layout.slurs[1]).toMatchObject({ from: null, to: 1, system: 1 });
    expect(layout.slurs[0]!.x1).toBeLessThan(layout.slurs[0]!.x2);
    expect(layout.slurs[1]!.x1).toBeLessThan(layout.slurs[1]!.x2);
  });

  it('puts the word anchor above an upper slur, at its midpoint (core_09.AC27)', () => {
    const s = lay(slurred([['E', 5], ['D', 5], ['C', 5]])).slurs[0]!;
    expect(s.label.x).toBeCloseTo((s.x1 + s.x2) / 2);
    expect(s.label.y).toBeLessThan(curveY(s, s.label.x));
  });

  it('puts the word anchor above a lower slur, above its heads (core_09.AC27)', () => {
    const layout = lay(slurred([['C', 4], ['D', 4], ['E', 4], ['F', 4]]));
    expect(layout.slurs[0]!.label.y).toBeLessThan(Math.min(...layout.notes.map((n) => n.y - n.headRy)));
  });

  it('draws no slur for a piece without slurs (core_09.AC27)', () => {
    expect(lay(parse(base())).slurs).toEqual([]);
  });
});

describe('bass clef', () => {
  it('puts middle C on one ledger line above the staff and G2 on the bottom line', () => {
    const chart = chartOf({ clef: 'bass', bars: 1, events: [
      { tick: 0, dur: 480, step: 'G', octave: 2 }, { tick: 480, dur: 480, step: 'C', octave: 4 },
      { tick: 960, dur: 960, step: 'E', octave: 3 },
    ] });
    const l = lay(chart);
    expect(l.clefs[0]!.clef).toBe('bass');
    expect(l.notes.map((n) => n.position)).toEqual([0, 10, 5]);
    expect(l.notes[1]!.ledgerLines).toHaveLength(1);
    expect(l.notes[1]!.ledgerLines[0]!.y).toBeCloseTo(l.notes[1]!.y);
    expect(l.notes[1]!.y).toBeLessThan(l.staffLines[0]!.y); // above the top line
  });
});

describe('rests and meters', () => {
  const chart = chartOf({ num: 3, den: 4, bars: 2, events: [
    { tick: 0, dur: 480, step: 'C', octave: 4 }, { tick: 480, dur: 480, step: 'D', octave: 4, rest: true },
    { tick: 960, dur: 480, step: 'E', octave: 4 },
    { tick: 1440, dur: 1440, step: 'E', octave: 4, rest: true },
  ] });

  it('lays out rests with their value and a whole rest for a full bar in any meter', () => {
    const l = lay(chart);
    expect(l.rests.map((r) => r.value)).toEqual(['quarter', 'whole']);
    expect(l.timeSignature).toMatchObject({ num: 3, den: 4 });
  });

  it('keeps notes and rests inside their bar and in time order', () => {
    const l = lay(chart);
    const items = [...l.notes.map((n) => ({ x: n.x, tick: chart.notes[n.index]!.tick })),
      ...l.rests.map((r) => ({ x: r.x, tick: chart.rests[r.index]!.tick }))].sort((a, b) => a.tick - b.tick);
    for (let i = 1; i < items.length; i++) expect(items[i]!.x).toBeGreaterThan(items[i - 1]!.x);
  });
});

describe('sizing', () => {
  it('fits and never overlaps at the supported viewports (property over sizes)', () => {
    const chart = parse(base());
    for (const viewport of VIEWPORTS) {
      const l = lay(chart, viewport.width, viewport.height);
      expect(l.fits, `${viewport.width}x${viewport.height}`).toBe(true);
      const xs = l.notes.map((n) => n.x);
      for (let i = 1; i < xs.length; i++) {
        const gap = xs[i]! - xs[i - 1]!;
        if (l.notes[i]!.system === l.notes[i - 1]!.system) {
          expect(gap).toBeGreaterThanOrEqual(l.notes[i]!.headRx + l.notes[i - 1]!.headRx);
        }
      }
      const S = l.staffSpace;
      for (const n of l.notes) {
        expect(n.x - n.headRx).toBeGreaterThanOrEqual(0);
        expect(n.x + n.headRx).toBeLessThanOrEqual(viewport.width);
        // everything a note brings (stem, finger number above, note name below) stays on the screen
        const top = Math.min(n.y - n.headRy, n.stem && n.stem.up ? n.stem.y2 : Infinity, n.fingerY - 0.55 * S);
        const bottom = Math.max(n.y + n.headRy, n.stem && !n.stem.up ? n.stem.y2 : -Infinity, n.labelY + 0.55 * S);
        expect(top).toBeGreaterThanOrEqual(0);
        expect(bottom).toBeLessThanOrEqual(viewport.height);
      }
      // systems do not run into each other: the arrow and labels of one end above the clef and fingers of the next
      for (let k = 0; k + 1 < l.systems.length; k++) {
        const here = l.notes.filter((n) => n.system === k);
        const next = l.notes.filter((n) => n.system === k + 1);
        const lowest = Math.max(l.systems[k]!.cursorTipY, ...here.map((n) => n.labelY + 0.55 * S));
        const highest = Math.min(l.systems[k + 1]!.topLineY - 1.2 * S, ...next.map((n) => n.fingerY - 0.55 * S));
        expect(lowest).toBeLessThan(highest);
      }
    }
  });

  it('draws notes big enough for a small student on the 1366x768 laptop: staff space of 24 px or more', () => {
    expect(lay(parse(base()), 1366, 768).staffSpace).toBeGreaterThanOrEqual(24);
  });

  it('puts the cursor arrow below every note name of its system, and keeps the staff from moving when hints change', () => {
    const l = lay(parse(base()));
    for (const system of l.systems) {
      const names = l.notes.filter((n) => n.system === system.index).map((n) => n.labelY + 0.55 * l.staffSpace);
      expect(system.cursorTipY - 0.9 * l.staffSpace).toBeGreaterThanOrEqual(Math.max(...names) - 1e-9);
    }
  });

  it('chooses a bigger staff on a bigger screen', () => {
    const chart = parse(base());
    expect(lay(chart, 1920, 1080).staffSpace).toBeGreaterThan(lay(chart, 800, 600).staffSpace);
  });

  it('honours an explicit staff space and reports when it does not fit', () => {
    const chart = parse(base());
    const small = lay(chart, 1366, 768, 12);
    expect(small.staffSpace).toBe(12);
    expect(small.fits).toBe(true);
    expect(lay(chart, 600, 200, 40).fits).toBe(false);
  });

  it('spreads bars evenly over systems', () => {
    const chart = chartOf({ bars: 5, events: Array.from({ length: 5 }, (_, b) => (
      { tick: b * 1920, dur: 1920, step: 'C', octave: 4 }
    )) });
    const l = lay(chart, 700, 900);
    const perSystem = l.systems.map((s) => s.barCount);
    expect(perSystem.reduce((a, b) => a + b, 0)).toBe(5);
    expect(Math.max(...perSystem) - Math.min(...perSystem)).toBeLessThanOrEqual(1 + (5 % l.systems.length === 0 ? 0 : 1));
    expect(l.bars.every((b) => b.width === l.bars[0]!.width)).toBe(true);
  });

  it('never fails to lay out any C-position melody at any supported viewport (property)', () => {
    const stepsArb = fc.array(fc.constantFrom('C', 'D', 'E', 'F', 'G'), { minLength: 4, maxLength: 16 });
    fc.assert(
      fc.property(stepsArb, fc.constantFrom(...VIEWPORTS), (steps, viewport) => {
        const events: { tick: number; dur: number; step: string; octave: number; rest?: boolean }[] =
          steps.map((step, i) => ({ tick: i * 480, dur: 480, step, octave: 4 }));
        const bars = Math.ceil(steps.length / 4);
        // pad the last bar with quarter rests so durations fill it
        for (let i = steps.length; i < bars * 4; i++) events.push({ tick: i * 480, dur: 480, step: 'C', octave: 4, rest: true });
        const l = lay(chartOf({ bars, events }), viewport.width, viewport.height);
        expect(l.notes).toHaveLength(steps.length);
        for (const n of l.notes) {
          expect(Number.isFinite(n.x) && Number.isFinite(n.y)).toBe(true);
        }
      }),
    );
  });
});

describe('several play tracks', () => {
  const twoHands = () => chartWith([
    { tick: 0, dur: 960, midi: 60 }, { tick: 0, dur: 960, midi: 48, track: 'lh' }, { tick: 960, dur: 960, midi: 62 },
  ]);

  it('draws a grand staff when two tracks are played, so no hand is left off the screen (details in grandStaff.test.ts)', () => {
    const l = lay(twoHands());
    expect(l.systems[0]!.staves.map((st) => st.clef)).toEqual(['treble', 'bass']);
    expect(l.notes.map((n) => n.staff)).toEqual([0, 1, 0]);
  });

  it('draws the chosen track alone when one is named', () => {
    const l = layoutStaff(twoHands(), { viewport: { width: 1280, height: 720 }, trackId: 'lh' });
    expect(l.notes).toHaveLength(1);
    expect(l.clef).toBe('bass');
    expect(l.systems[0]!.staves).toHaveLength(1);
  });

  it('accompaniment tracks do not count as played tracks', () => {
    const chart = chartWith([{ tick: 0, dur: 960, midi: 60 }, { tick: 0, dur: 960, midi: 48, track: 'bk' }]);
    expect(lay(chart).notes).toHaveLength(1);
    expect(lay(chart).systems[0]!.staves).toHaveLength(1);
  });
});

describe('unsupported notation', () => {
  const rejects = (mutate: (c: Json) => void, message: RegExp) => {
    const c = base();
    mutate(c);
    expect(() => lay(parse(c))).toThrow(UnsupportedNotationError);
    expect(() => lay(parse(c))).toThrow(message);
  };

  it('rejects double sharps, chords of different lengths, ties, extra voices, meter changes and a key change inside a bar with a clear message', () => {
    rejects((c) => { c.notes[0].midi = 62; c.notes[0].spelling.alter = 2; }, /double/i);
    rejects((c) => { c.notes[1].tick = 0; c.notes[1].bar = 0; c.notes[1].dur = 960; }, /different lengths/i);
    rejects((c) => { c.notes[1].tick = 0; c.notes[1].bar = 0; c.notes[1].dur = c.notes[0].dur; c.notes[1].spelling = { ...c.notes[0].spelling }; c.notes[1].midi = c.notes[0].midi; }, /same pitch/i);
    rejects((c) => { c.notes[0].voice = 3; }, /voice/i);
    rejects((c) => { c.meterMap.push({ tick: 1920, num: 3, den: 4 }); }, /meter/i);
    rejects((c) => { c.keyMap.push({ tick: 480, fifths: 1, mode: 'major' }); }, /key change inside a bar/i); // core_09.AC57: at a bar line it is drawn
  });

  it('rejects an unknown track', () => {
    expect(() => layoutStaff(parse(base()), { viewport: { width: 1280, height: 720 }, trackId: 'nope' })).toThrow(/track/);
  });

  it('rejects a chart without a play track', () => {
    const c = base();
    c.tracks[0].role = 'accompaniment';
    expect(() => lay(parse(c))).toThrow(/play track/);
  });
});

describe('the dotted half (ft_1_02d.AC1)', () => {
  it('is a half note with a dot, and only the dotted half', () => {
    expect(noteShapeOf(1440)).toEqual({ value: 'half', dotted: true });
    expect(noteShapeOf(960)).toEqual({ value: 'half', dotted: false });
    expect(() => noteShapeOf(180)).toThrow(UnsupportedNotationError); // a dotted sixteenth is not drawn
  });

  it('is drawn in 3/4 as an open head with a stem and a dot to the right, in a space', () => {
    const layout = lay(chartOf({ bars: 1, num: 3, events: [{ tick: 0, dur: 1440, step: 'C', octave: 4 }, ] }));
    const n = layout.notes[0]!;
    expect(n.value).toBe('half');
    expect(n.filled).toBe(false);
    expect(n.stem).not.toBeNull();
    expect(n.dot).not.toBeNull();
    expect(n.dot!.x).toBeGreaterThan(n.x + n.headRx);
    expect(n.dot!.y).toBeLessThan(n.y); // middle C sits on a ledger line, so the dot rises into the space above
    expect(lay(chartOf({ bars: 1, num: 3, events: [{ tick: 0, dur: 480, step: 'C', octave: 4 }, { tick: 480, dur: 960, step: 'D', octave: 4 }] })).notes.every((g) => g.dot === null)).toBe(true);
  });
});

describe('the dotted quarter and dotted rests (core_09.AC37)', () => {
  it('is a quarter note with a dot', () => {
    expect(noteShapeOf(720)).toEqual({ value: 'quarter', dotted: true });
    expect(noteShapeOf(480)).toEqual({ value: 'quarter', dotted: false });
  });

  it('draws a dotted quarter and its eighth as a filled head with a stem and a dot, then a flagged eighth clear of the dot', () => {
    const layout = lay(chartOf({ bars: 1, events: [
      { tick: 0, dur: 720, step: 'G', octave: 4 }, { tick: 720, dur: 240, step: 'A', octave: 4 },
      { tick: 960, dur: 960, step: 'G', octave: 4 },
    ] }));
    const [dotted, eighth] = layout.notes;
    expect(dotted).toMatchObject({ value: 'quarter', filled: true });
    expect(dotted!.stem).not.toBeNull();
    expect(dotted!.dot).not.toBeNull();
    expect(dotted!.dot!.x).toBeGreaterThan(dotted!.x + dotted!.headRx);
    expect(dotted!.dot!.y).toBeLessThan(dotted!.y); // G4 sits on a line, so its dot rises into the space above
    // the eighth after a dotted quarter starts off the beat: a flag, never a beam, and its head is right of the dot
    expect(eighth).toMatchObject({ value: 'eighth', flag: true, beamed: false, dot: null });
    expect(layout.beams).toHaveLength(0);
    expect(eighth!.x - eighth!.headRx).toBeGreaterThan(dotted!.dot!.x);
  });

  it('puts the dot of a dotted quarter in a space level with a head that sits in a space', () => {
    const n = lay(chartOf({ bars: 1, events: [{ tick: 0, dur: 720, step: 'A', octave: 4 }, { tick: 720, dur: 240, step: 'B', octave: 4 }, { tick: 960, dur: 960, step: 'C', octave: 5 }] })).notes[0]!;
    expect(n.dot!.y).toBe(n.y);
  });

  it('draws a dotted quarter rest and a dotted half rest with a dot right of the rest, and plain rests without one', () => {
    const layout = lay(chartOf({ bars: 2, events: [
      { tick: 0, dur: 720, step: 'C', octave: 4, rest: true }, { tick: 720, dur: 240, step: 'D', octave: 4 }, { tick: 960, dur: 960, step: 'E', octave: 4 },
      { tick: 1920, dur: 1440, step: 'C', octave: 4, rest: true }, { tick: 3360, dur: 480, step: 'F', octave: 4 },
    ] }));
    const [quarter, half] = layout.rests;
    expect(quarter).toMatchObject({ value: 'quarter' });
    expect(half).toMatchObject({ value: 'half' });
    for (const r of [quarter!, half!]) {
      expect(r.dot).not.toBeNull();
      expect(r.dot!.x).toBeGreaterThan(r.x);
    }
    const plain = lay(chartOf({ bars: 1, events: [{ tick: 0, dur: 480, step: 'C', octave: 4, rest: true }, { tick: 480, dur: 1440, step: 'D', octave: 4 }] }));
    expect(plain.rests[0]!.dot).toBeNull();
  });

  it('still refuses a dotted whole, a dotted sixteenth and a dotted sixteenth rest', () => {
    expect(() => noteShapeOf(2880)).toThrow(UnsupportedNotationError);
    const fill = [{ tick: 180, dur: 60, step: 'E', octave: 4 }, { tick: 240, dur: 240, step: 'E', octave: 4 }, { tick: 480, dur: 1440, step: 'D', octave: 4 }];
    expect(() => lay(chartOf({ bars: 1, events: [{ tick: 0, dur: 180, step: 'C', octave: 4 }, ...fill] }))).toThrow(UnsupportedNotationError);
    expect(() => lay(chartOf({ bars: 1, events: [{ tick: 0, dur: 180, step: 'C', octave: 4, rest: true }, ...fill] }))).toThrow(UnsupportedNotationError);
  });
});

describe('sixteenths and beams of a beat (core_09.AC40, core_09.AC41)', () => {
  const sixteenths = (steps: [string, number][], durs: number[]) => {
    let tick = 0;
    const events = steps.map(([step, octave], i) => {
      const e = { tick, dur: durs[i]!, step, octave };
      tick += durs[i]!;
      return e;
    });
    return lay(chartOf({ bars: 1, events }));
  };

  it('core_09.AC41 draws a sixteenth as a filled head; alone it gets two flags, and a dotted eighth gets a dot', () => {
    expect(noteShapeOf(120)).toEqual({ value: 'sixteenth', dotted: false });
    expect(noteShapeOf(360)).toEqual({ value: 'eighth', dotted: true });
    // a sixteenth, a dotted eighth rest, then a dotted half: the sixteenth has no neighbour in its beat
    const lone = lay(chartOf({ bars: 1, events: [{ tick: 0, dur: 120, step: 'G', octave: 4 }, { tick: 120, dur: 360, step: 'C', octave: 4, rest: true }, { tick: 480, dur: 1440, step: 'A', octave: 4 }] }));
    expect(lone.notes[0]).toMatchObject({ value: 'sixteenth', filled: true, flag: true, flags: 2, beamed: false });
    expect(lone.beams).toEqual([]);
  });

  it('core_09.AC40 joins four sixteenths with one beam and a second beam inside it, every stem ending on the beam', () => {
    const layout = sixteenths([['C', 5], ['D', 5], ['E', 5], ['F', 5], ['G', 4]], [120, 120, 120, 120, 1440]);
    expect(layout.beams).toHaveLength(1);
    const beam = layout.beams[0]!;
    expect(beam.notes).toEqual([0, 1, 2, 3]);
    expect(beam.up).toBe(false); // the heads sit above the middle line
    const run = layout.notes.slice(0, 4);
    for (const n of run) {
      expect(n).toMatchObject({ flags: 0, beamed: true });
      expect(n.stem!.y2).toBe(beam.y);
    }
    expect(beam.secondary).toHaveLength(3);
    expect(beam.secondary[0]!.x1).toBe(run[0]!.stem!.x);
    expect(beam.secondary[2]!.x2).toBe(run[3]!.stem!.x);
    // stems down: the second beam lies above the first, and both stay clear of every head
    for (const sb of beam.secondary) expect(sb.y).toBeLessThan(beam.y);
    const S = layout.staffSpace;
    const innerEdge = beam.secondary[0]!.y - beam.thickness;
    for (const n of run) expect(innerEdge - (n.y + n.headRy)).toBeGreaterThan(S);
  });

  it('core_09.AC40 beams a dotted eighth and its sixteenth with a partial second beam pointing back to the dotted eighth', () => {
    const layout = sixteenths([['E', 4], ['F', 4], ['G', 4]], [360, 120, 1440]);
    const [dotted, sixteenth] = layout.notes;
    expect(dotted).toMatchObject({ value: 'eighth', beamed: true, flags: 0 });
    expect(dotted!.dot).not.toBeNull();
    const beam = layout.beams[0]!;
    expect(beam.up).toBe(true);
    expect(beam.secondary).toHaveLength(1);
    const partial = beam.secondary[0]!;
    expect(partial.x2).toBe(sixteenth!.stem!.x);
    expect(partial.x1).toBeLessThan(partial.x2);
    expect(partial.x1).toBeGreaterThan(dotted!.stem!.x);
    expect(partial.y).toBeGreaterThan(beam.y); // stems up: the second beam hangs under the first
  });

  it('core_09.AC40 beams four eighths in 4/4 as two pairs of a beat each, and leaves the eighth after a dotted quarter flagged', () => {
    const pairs = sixteenths([['C', 5], ['D', 5], ['E', 5], ['F', 5], ['G', 4]], [240, 240, 240, 240, 960]);
    expect(pairs.beams.map((b) => b.notes)).toEqual([[0, 1], [2, 3]]);
    expect(pairs.beams.every((b) => b.secondary.length === 0)).toBe(true);
    const dotted = sixteenths([['C', 5], ['D', 5], ['E', 5]], [720, 240, 960]);
    expect(dotted.beams).toEqual([]);
    expect(dotted.notes[1]).toMatchObject({ flags: 1 });
  });

  it('core_09.AC41 draws a sixteenth rest and a dotted eighth rest', () => {
    // a sixteenth, then a dotted eighth rest from tick 120 to 480, then a dotted half
    const layout = lay(chartOf({ bars: 1, events: [{ tick: 0, dur: 120, step: 'C', octave: 5 }, { tick: 120, dur: 360, step: 'C', octave: 4, rest: true }, { tick: 480, dur: 1440, step: 'D', octave: 5 }] }));
    expect(layout.rests[0]).toMatchObject({ value: 'eighth' });
    expect(layout.rests[0]!.dot).not.toBeNull();
    const withRest = lay(chartOf({ bars: 1, events: [{ tick: 0, dur: 120, step: 'C', octave: 4, rest: true }, { tick: 120, dur: 120, step: 'D', octave: 4 }, { tick: 240, dur: 240, step: 'E', octave: 4 }, { tick: 480, dur: 1440, step: 'F', octave: 4 }] }));
    expect(withRest.rests[0]).toMatchObject({ value: 'sixteenth', dot: null });
  });
});

describe('chords on one staff (core_09.AC1)', () => {
  const chord = (steps: [string, number][], dur = 480, extra: { tick: number; dur: number; step: string; octave: number }[] = []) =>
    chartOf({ bars: 2, events: [...steps.map(([step, octave]) => ({ tick: 0, dur, step, octave })), ...extra] });
  const heads = (layout: StaffLayout) => [...layout.notes].sort((a, b) => a.position - b.position);

  it('puts a same-tick, same-length group on one x with a single stem (core_09.AC1)', () => {
    const layout = lay(chord([['C', 4], ['E', 4], ['G', 4]]));
    const [c, e, g] = heads(layout);
    expect(layout.notes).toHaveLength(3);
    expect(new Set([c!.x, e!.x, g!.x]).size).toBe(1);
    expect(layout.notes.filter((n) => n.stem !== null)).toHaveLength(1);
    expect(layout.notes.map((n) => n.column)).toEqual(layout.notes.map(() => c!.x));
  });

  it('stem direction follows the note farthest from the middle line: up, from the lowest head to above the highest (core_09.AC1)', () => {
    const S = 20;
    const layout = lay(chord([['C', 4], ['E', 4], ['G', 4]]), 1366, 768, S);
    const [c, , g] = heads(layout);
    expect(c!.stem).toMatchObject({ up: true, y1: c!.y, x: c!.x + c!.headRx });
    expect(c!.stem!.y2).toBeCloseTo(g!.y - 7 * (S / 2), 6); // the tip is an octave above the highest head
    expect(c!.stem!.y2).toBeCloseTo(c!.y - 11 * (S / 2), 6);
  });

  it('a chord whose highest note is farthest goes stem down from the highest head (core_09.AC1)', () => {
    const S = 20;
    const layout = lay(chord([['B', 4], ['D', 5], ['F', 5]]), 1366, 768, S);
    const [, , f] = heads(layout);
    expect(f!.stem).toMatchObject({ up: false, y1: f!.y, x: f!.x - f!.headRx });
    expect(layout.notes.filter((n) => n.stem)).toHaveLength(1);
    expect(f!.stem!.y2).toBeCloseTo(heads(layout)[0]!.y + 7 * (S / 2), 6);
  });

  it('draws a second with the upper head on the other side of an up stem, and the lower head of a down-stem second on the left (core_09.AC1)', () => {
    const up = lay(chord([['C', 4], ['D', 4]]));
    const [low, high] = heads(up);
    expect(high!.x).toBeCloseTo(low!.x + 2 * low!.headRx, 6);
    expect(high!.column).toBe(low!.x);
    const down = lay(chord([['A', 5], ['B', 5]]));
    const [lower, upper] = heads(down);
    expect(upper!.stem!.up).toBe(false);
    expect(lower!.x).toBeCloseTo(upper!.x - 2 * upper!.headRx, 6);
    // a third is not a second: no head moves
    const third = heads(lay(chord([['C', 4], ['E', 4]])));
    expect(third[0]!.x).toBe(third[1]!.x);
    // a stack of three seconds alternates: normal, displaced, normal
    const stack = heads(lay(chord([['C', 4], ['D', 4], ['E', 4]])));
    expect([stack[1]!.x > stack[0]!.x, stack[2]!.x === stack[0]!.x]).toEqual([true, true]);
  });

  it('gives every head its own ledger lines, and the staff rooms hold every head and the stem (core_09.AC1)', () => {
    const layout = lay(chord([['A', 3], ['C', 4], ['A', 5], ['C', 6]]), 800, 400);
    expect(heads(layout).map((n) => n.ledgerLines.length)).toEqual([2, 1, 1, 2]);
    const info = layout.systems[0]!.staves[0]!;
    for (const n of layout.notes) {
      expect(n.y - n.headRy).toBeGreaterThanOrEqual(0);
      expect(n.y + n.headRy).toBeLessThanOrEqual(layout.height);
      if (n.stem) expect(Math.min(n.stem.y1, n.stem.y2)).toBeGreaterThanOrEqual(0);
      expect(n.labelY).toBeLessThanOrEqual(layout.height);
      expect(n.fingerY).toBeGreaterThanOrEqual(0);
    }
    expect(info.topLineY).toBeGreaterThan(0);
  });

  it('shows one name label under the chord (low to high) and the top finger above it (core_09.AC1)', () => {
    const chart = parse({ ...chord([['C', 4], ['E', 4], ['G', 4]]), notes: chord([['C', 4], ['E', 4], ['G', 4]]).notes.map((n, i) => ({ ...n, finger: [1, 3, 5][i] })) });
    const [c, e, g] = heads(lay(chart));
    expect([c!.label, e!.label, g!.label]).toEqual(['C/E/G', '', '']);
    expect([c!.finger, e!.finger, g!.finger]).toEqual([null, null, 5]);
    expect(c!.labelY).toBeGreaterThan(c!.y);
    expect(g!.fingerY).toBeLessThan(c!.stem!.y2 + 1);
  });

  it('puts every dot of a dotted chord with a second right of all its heads, on one x, stem up or down (core_09.AC1)', () => {
    const S = 20;
    for (const notes of [[['A', 5], ['B', 5]], [['C', 4], ['D', 4]]] as [string, number][][]) {
      const layout = lay(chord(notes, 1440), 1366, 768, S); // a dotted half, the only dotted value drawn so far
      const sorted = heads(layout);
      const rightEdge = Math.max(...sorted.map((n) => n.x + n.headRx));
      for (const n of sorted) expect(n.dot!.x - rightEdge).toBeGreaterThanOrEqual(0.3 * S);
      expect(new Set(sorted.map((n) => n.dot!.x)).size).toBe(1);
    }
  });

  it('keeps every dot of a dotted chord clear of every head, for every pair and triad of natural notes (core_09.AC1)', () => {
    const S = 20;
    const names = ['C', 'D', 'E', 'F', 'G', 'A', 'B'] as const;
    let checked = 0;
    for (let a = 0; a < 7; a++) {
      for (let b = a + 1; b < 7; b++) {
        for (const triad of [false, true]) {
          const steps = triad ? [a, b, 0] : [a, b];
          const pitches = triad ? [names[a]!, names[b]!, names[0]] : [names[a]!, names[b]!];
          const octaves = triad ? [4, 4, 5] : [4, 4];
          const events = pitches.map((step, i) => ({ tick: 0, dur: 1440, step, octave: octaves[i]! }));
          if (triad && (steps[2] === a || steps[2] === b)) continue; // same pitch twice is not drawn
          const layout = lay(chartOf({ bars: 1, events }), 1366, 768, S);
          const sorted = heads(layout);
          const rightEdge = Math.max(...sorted.map((n) => n.x + n.headRx));
          for (const n of sorted) expect(n.dot!.x - rightEdge).toBeGreaterThanOrEqual(0.3 * S);
          checked++;
        }
      }
    }
    expect(checked).toBe(36); // 21 pairs plus 15 triads that add a C without repeating one
  });

  it('gives each note of a chord its own tempo-score position, stacked above the chord; a single note keeps its finger spot (core_09.AC1)', () => {
    const S = 20;
    const [c, e, g] = heads(lay(chord([['C', 4], ['E', 4], ['G', 4]]), 1366, 768, S));
    expect(new Set([c!.scoreY, e!.scoreY, g!.scoreY]).size).toBe(3);
    expect(g!.scoreY).toBe(g!.fingerY);
    expect(g!.scoreY - e!.scoreY).toBeGreaterThanOrEqual(S);
    expect(e!.scoreY - c!.scoreY).toBeGreaterThanOrEqual(S);
    const [lone] = heads(lay(chord([['C', 4]])));
    expect(lone!.scoreY).toBe(lone!.fingerY);
    // a four-note chord on the 1366x768 laptop: the lowest of the stacked numbers still has room above the top line
    const four = heads(lay(chord([['A', 3], ['C', 4], ['A', 5], ['C', 6]]), 1366, 768, S));
    expect(Math.min(...four.map((n) => n.scoreY))).toBeGreaterThanOrEqual(S);
  });

  it('with room for scores, every stacked tempo score of a chord stays on its page, for chords of up to five notes on every screen', () => {
    const PITCHES: [string, number][] = [['A', 3], ['C', 4], ['E', 4], ['G', 4], ['B', 4], ['D', 5], ['F', 5], ['A', 5], ['C', 6]];
    fc.assert(
      fc.property(
        fc.uniqueArray(fc.integer({ min: 0, max: PITCHES.length - 1 }), { minLength: 1, maxLength: 5 }),
        fc.constantFrom([800, 400], [960, 540], [1024, 600], [1366, 768], [1280, 720]),
        fc.constantFrom(1, 2, undefined),
        (picked, [width, height], linesPerPage) => {
          const chart = chord(picked.map((i) => PITCHES[i]!));
          const layout = layoutStaff(chart, { viewport: { width: width, height: height }, scoreRoom: true, ...(linesPerPage ? { linesPerPage } : {}) });
          if (!layout.fits) return;
          for (const n of layout.notes) expect(n.scoreY - 0.55 * layout.staffSpace).toBeGreaterThanOrEqual(-1e-9);
        },
      ),
    );
  });

  it('the issue\'s chord A3 C4 A5 C6 at 800x400 kept its scores below the top only with room for them', () => {
    const four = chord([['A', 3], ['C', 4], ['A', 5], ['C', 6]]);
    const without = layoutStaff(four, { viewport: { width: 800, height: 400 } });
    const room = layoutStaff(four, { viewport: { width: 800, height: 400 }, scoreRoom: true });
    expect(Math.min(...without.notes.map((n) => n.scoreY))).toBeLessThan(0);
    expect(Math.min(...room.notes.map((n) => n.scoreY)) - 0.55 * room.staffSpace).toBeGreaterThanOrEqual(0);
    // the room costs size only where scores can show: without it the staff is at least as big
    expect(without.staffSpace).toBeGreaterThanOrEqual(room.staffSpace);
  });

  it('a chord of eighths is beamed with the rest of its beat like a single note, one stem per chord (core_09.AC1, core_09.AC40)', () => {
    const chart = chartOf({ bars: 1, events: [
      { tick: 0, dur: 240, step: 'C', octave: 4 }, { tick: 0, dur: 240, step: 'E', octave: 4 }, { tick: 240, dur: 240, step: 'G', octave: 4 },
      { tick: 480, dur: 240, step: 'C', octave: 4 }, { tick: 720, dur: 240, step: 'D', octave: 4 },
    ] });
    const layout = lay(chart);
    expect(layout.notes.filter((n) => n.flag)).toHaveLength(0);
    expect(layout.beams.map((b) => b.notes)).toEqual([[0, 1, 2], [3, 4]]);
    expect(layout.notes.filter((n) => n.stem !== null)).toHaveLength(4);
  });

  it('a whole-note chord has no stem, and chart order of the glyphs is kept (core_09.AC1)', () => {
    const layout = lay(chord([['G', 4], ['C', 4]], 1920));
    expect(layout.notes.every((n) => n.stem === null)).toBe(true);
    expect(layout.notes.map((n) => n.index)).toEqual([0, 1]);
  });

  it('two hands at one tick are different staves and need no chord handling (core_09.AC1)', () => {
    const layout = lay(littleChord());
    expect(new Set(layout.notes.map((n) => n.staff)).size).toBe(2);
  });
});

function littleChord(): Chart {
  const c = chartOf({ bars: 1, events: [{ tick: 0, dur: 960, step: 'C', octave: 4 }] });
  const json = JSON.parse(JSON.stringify(c));
  json.range.low = 48;
  json.tracks.push({ id: 'l', role: 'play', hand: 'LH', clef: 'bass' });
  json.notes.push({ ...json.notes[0], track: 'l', midi: 48, spelling: { step: 'C', alter: 0, octave: 3 } });
  return parse(json);
}

// core_09.AC5: key signatures and accidentals (docs/notation.md sections 4 and 5).
const SPACE = 24;
const BIG = { width: 1600, height: 900 };
/** The key signature positions on the treble staff: F5 C5 G5 D5 A4 E5 B4 (sharps) and B4 E5 A4 D5 G4 C5 F4 (flats). */
const TREBLE_SHARP_POSITIONS = [8, 5, 9, 6, 3, 7, 4];
const TREBLE_FLAT_POSITIONS = [4, 7, 3, 6, 2, 5, 1];

/** The staff positions a key of `fifths` puts its accidentals on, in order; the bass staff is two positions lower. */
function expectedKeyPositions(fifths: number, clef: 'treble' | 'bass'): number[] {
  const list = fifths > 0 ? TREBLE_SHARP_POSITIONS : TREBLE_FLAT_POSITIONS;
  return list.slice(0, Math.abs(fifths)).map((p) => (clef === 'bass' ? p - 2 : p));
}

/** A short piece in one key on one staff, two bars long unless told otherwise. */
const keyChart = (fifths: number, clef: 'treble' | 'bass' = 'treble', bars = 2): Chart =>
  chartOf({ bars, clef, fifths, events: [{ tick: 0, dur: 960, step: 'E', octave: clef === 'bass' ? 3 : 4 }] });

const keyMarks = (layout: StaffLayout, staff = 0, system = 0) => layout.keySignature.filter((k) => k.staff === staff && k.system === system);

describe('key signatures (core_09.AC5)', () => {
  for (const clef of ['treble', 'bass'] as const) {
    for (let fifths = -7; fifths <= 7; fifths++) {
      it(`draws the key of ${fifths} on the ${clef} staff at the standard positions, in order (core_09.AC5)`, () => {
        const layout = layoutStaff(keyChart(fifths, clef), { viewport: BIG, staffSpace: SPACE });
        const marks = keyMarks(layout);
        const bottom = layout.systems[0]!.staves[0]!.bottomLineY;
        expect(marks.map((m) => m.alter)).toEqual(Array(Math.abs(fifths)).fill(Math.sign(fifths)));
        expect(marks.map((m) => Math.round((bottom - m.y) / (layout.staffSpace / 2)))).toEqual(expectedKeyPositions(fifths, clef));
        const xs = marks.map((m) => m.x);
        expect(xs).toEqual([...xs].sort((a, b) => a - b));
        expect(new Set(xs).size).toBe(xs.length);
      });
    }
  }

  it('draws the key signature at the start of every system (core_09.AC5)', () => {
    const layout = layoutStaff(keyChart(3, 'treble', 6), { viewport: BIG, staffSpace: SPACE, barsPerLine: 2 });
    expect(layout.systems).toHaveLength(3);
    layout.systems.forEach((_, s) => expect(keyMarks(layout, 0, s)).toHaveLength(3));
  });

  it('draws the key signature on both staves of a grand staff (core_09.AC5)', () => {
    const json = JSON.parse(JSON.stringify(keyChart(-2))) as Json;
    json.tracks.push({ id: 'l', role: 'play', hand: 'LH', clef: 'bass' });
    json.range.low = 48;
    json.notes.push({ ...json.notes[0], track: 'l', midi: 48, spelling: { step: 'C', alter: 0, octave: 3 } });
    const grand = layoutStaff(parse(json), { viewport: BIG, staffSpace: SPACE });
    expect(grand.systems[0]!.staves).toHaveLength(2);
    expect(keyMarks(grand, 0)).toHaveLength(2);
    expect(keyMarks(grand, 1)).toHaveLength(2);
  });

  it('moves the time signature and the first note right by the width of the key (core_09.AC5)', () => {
    const none = layoutStaff(keyChart(0), { viewport: BIG, staffSpace: SPACE });
    const seven = layoutStaff(keyChart(7), { viewport: BIG, staffSpace: SPACE });
    expect(seven.timeSignature.x).toBeGreaterThan(none.timeSignature.x + 7 * SPACE);
    expect(seven.notes[0]!.x - none.notes[0]!.x).toBeGreaterThanOrEqual(7 * SPACE);
  });

  it('keeps the last sharp of a seven-sharp key clear of the time signature (core_09.AC5)', () => {
    const layout = layoutStaff(keyChart(7), { viewport: BIG, staffSpace: SPACE });
    const last = keyMarks(layout).at(-1)!;
    expect(last.x + (ACCIDENTAL_BOX.sharp.width / 2) * SPACE).toBeLessThan(layout.timeSignature.x);
  });

  it('keeps every key accidental on the page, above the top staff and below the bottom one (core_09.AC5)', () => {
    for (const [fifths, clef] of [[7, 'treble'], [-7, 'bass']] as const) {
      const layout = layoutStaff(keyChart(fifths, clef), { viewport: BIG, staffSpace: SPACE });
      const S = layout.staffSpace;
      for (const m of keyMarks(layout)) {
        const box = ACCIDENTAL_BOX[m.alter > 0 ? 'sharp' : 'flat'];
        expect(m.y - box.up * S).toBeGreaterThan(0);
        expect(m.y + box.down * S).toBeLessThan(layout.height);
      }
    }
  });
});

describe('accidentals (core_09.AC5)', () => {
  it('prints nothing for an accidental the key already has, a natural to cancel one and a sharp again after it (core_09.AC5)', () => {
    // key of G: F sharp is in the key; F natural cancels it; F sharp again is printed once more
    const chart = chartOf({ bars: 1, fifths: 1, events: [
      { tick: 0, dur: 480, step: 'F', octave: 4, alter: 1 },
      { tick: 480, dur: 480, step: 'F', octave: 4 },
      { tick: 960, dur: 480, step: 'F', octave: 4, alter: 1 },
    ] });
    expect(lay(chart).notes.map((n) => n.accidental?.alter ?? null)).toEqual([null, 0, 1]);
  });

  it('keeps a sharp on a ledger-line note clear of the ledger line (core_09.AC5)', () => {
    // C#4 sits on the ledger line below the treble staff
    const layout = lay(chartOf({ bars: 1, events: [{ tick: 0, dur: 480, step: 'C', octave: 4, alter: 1 }] }), 1366, 768, SPACE);
    const note = layout.notes[0]!;
    expect(note.accidental).not.toBeNull();
    expect(note.accidental!.x + (ACCIDENTAL_BOX.sharp.width / 2) * SPACE).toBeLessThan(note.x - 1.05 * SPACE);
  });

  it('draws a sharp left of its head, and the note after it keeps clear of the sharp (core_09.AC5)', () => {
    const layout = lay(chartOf({ bars: 1, events: [
      { tick: 0, dur: 480, step: 'D', octave: 4 },
      { tick: 480, dur: 480, step: 'C', octave: 4, alter: 1 },
      { tick: 960, dur: 480, step: 'D', octave: 4 },
    ] }), 1366, 768, SPACE);
    const [first, sharp, last] = layout.notes;
    const w = (ACCIDENTAL_BOX.sharp.width / 2) * SPACE;
    expect(sharp!.accidental).not.toBeNull();
    expect(sharp!.accidental!.x + w).toBeLessThan(sharp!.x - sharp!.headRx);
    expect(sharp!.accidental!.x - w).toBeGreaterThan(first!.x + first!.headRx);
    expect(sharp!.accidental!.y).toBe(sharp!.y);
    expect(last!.accidental).toBeNull();
  });

  it('gives the bar the room its accidentals need, from the previous note to each accidental (core_09.AC5)', () => {
    const layout = lay(chartOf({ bars: 1, events: [
      { tick: 0, dur: 480, step: 'D', octave: 4 },
      { tick: 480, dur: 480, step: 'C', octave: 4, alter: 1 },
    ] }), 1366, 768, SPACE);
    const bar = layout.bars[0]!;
    expect(bar.roomTotal).toBeGreaterThan(0);
    expect(accidentalRoomAt(bar, 0)).toBe(0);
    expect(accidentalRoomAt(bar, 480)).toBeCloseTo(bar.roomTotal, 9);
    expect(accidentalRoomAt(bar, 1920)).toBeCloseTo(bar.roomTotal, 9);
  });

  it('stacks the accidentals of a chord in columns, the highest nearest the head, with none overlapping (core_09.AC5)', () => {
    // C#4 (low) and D#4 (high): a second apart, so the sharps would overlap in one column
    const layout = lay(chartOf({ bars: 1, events: [
      { tick: 0, dur: 960, step: 'C', octave: 4, alter: 1 },
      { tick: 0, dur: 960, step: 'D', octave: 4, alter: 1 },
    ] }), 1366, 768, SPACE);
    const [low, high] = layout.notes as [typeof layout.notes[number], typeof layout.notes[number]];
    const box = (n: typeof low) => {
      const w = (ACCIDENTAL_BOX.sharp.width / 2) * SPACE;
      return { left: n.accidental!.x - w, right: n.accidental!.x + w, top: n.accidental!.y - 1.4 * SPACE, bottom: n.accidental!.y + 1.4 * SPACE };
    };
    const a = box(low);
    const b = box(high);
    const overlap = a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;
    expect(overlap).toBe(false);
    expect(high.accidental!.x).toBeGreaterThan(low.accidental!.x);
    for (const n of [low, high]) expect(box(n).right).toBeLessThan(low.x - low.headRx);
  });

  it('sorts the accidentals of a chord: highest first, then lowest, then inwards, each in the nearest column where it overlaps none (core_09.AC5)', () => {
    const sharp = (position: number) => ({ position, alter: 1 as number | null });
    expect(accidentalColumns([sharp(-2), sharp(-1)])).toEqual([1, 0]);
    expect(accidentalColumns([sharp(0), sharp(2), sharp(4)])).toEqual([1, 2, 0]);
    expect(accidentalColumns([sharp(0), sharp(12)])).toEqual([0, 0]);
    expect(accidentalColumns([{ position: 0, alter: null }, sharp(2)])).toEqual([-1, 0]);
    expect(accidentalColumns([{ position: 4, alter: -1 }])).toEqual([0]);
  });
});

describe('bars as wide as their columns (the piece editor)', () => {
  const chart = () => parse(base());
  const spacingFor = (c: Chart, columns: { tick: number; width: number }[]) => c.bars.map(() => ({ columns }));

  it('a bar is its padding plus its columns wide; a note sits on its column, a tick between columns in proportion', () => {
    const c = chart();
    const layout = layoutStaff(c, { viewport: { width: 4000, height: 2000 }, staffSpace: 10, spacing: spacingFor(c, [{ tick: 0, width: 4 }, { tick: 960, width: 6 }]) });
    const S = 10;
    const bar = layout.bars[0]!;
    expect(bar.width).toBeCloseTo((1.6 + 4 + 6 + 0.8 + bar.roomTotal) * S);
    expect(bar.columns!.map((col) => col.tick)).toEqual([0, 960]);
    expect(bar.columns![1]!.x - bar.columns![0]!.x).toBeGreaterThanOrEqual(4 * S);
    // a note at tick 480 (between the columns) sits half way between them
    const note = layout.notes.find((n) => n.bar === 0 && c.notes[n.index]!.tick - c.bars[0]!.startTick === 480);
    if (note) expect(note.column).toBeGreaterThan(bar.columns![0]!.x);
    expect(layout.systems).toHaveLength(1);
  });

  it('lines hold as many bars as fit and are not stretched; the page keeps the places of all its lines', () => {
    const c = chart();
    const wide = spacingFor(c, Array.from({ length: 8 }, (_, i) => ({ tick: i * 240, width: 10 })));
    const layout = layoutStaff(c, { viewport: { width: 1000, height: 2000 }, staffSpace: 10, spacing: wide, linesPerPage: 3 });
    expect(layout.systems.length).toBe(c.bars.length);
    for (const s of layout.systems) expect(s.right).toBeLessThan(1000);
    const one = layoutStaff(c, { viewport: { width: 100000, height: 2000 }, staffSpace: 10, spacing: wide, linesPerPage: 3 });
    expect(one.systems).toHaveLength(1);
    // one line or several: the first line is in the same place
    expect(one.systems[0]!.topLineY).toBe(layout.systems[0]!.topLineY);
    expect(layoutStaff(c, { viewport: { width: 300, height: 2000 }, staffSpace: 10, spacing: wide }).fits).toBe(false);
  });

  it('without a staff space number the smallest one is used, and a bar with no columns is just its padding', () => {
    const c = chart();
    const layout = layoutStaff(c, { viewport: { width: 4000, height: 2000 }, spacing: c.bars.map(() => ({ columns: [] })) });
    expect(layout.staffSpace).toBe(8);
    expect(layout.bars[0]!.width).toBeCloseTo((1.6 + 0.8 + layout.bars[0]!.roomTotal) * 8);
  });
});

// Finger numbers sit beside their head, level with it, clear of stems, ledger lines and dots.
describe('finger numbers beside their note (ft_1_02d.AC4)', () => {
  it('a finger goes to the right of its head, level with it, and clears a ledger line (stem up and stem down)', () => {
    const c = chartOf({ bars: 2, events: [{ tick: 0, dur: 960, step: 'C', octave: 4 }, { tick: 1920, dur: 960, step: 'B', octave: 5 }] });
    c.notes[0]!.finger = 1;
    c.notes[1]!.finger = 2;
    const [low, high] = lay(c).notes;
    expect(low!.stem?.up).toBe(true);
    expect(high!.stem?.up).toBe(false);
    for (const n of [low!, high!]) {
      expect(n.fingerX).toBeGreaterThan(n.x + n.headRx);
      expect(n.fingerX).toBeGreaterThan(Math.max(n.x, ...n.ledgerLines.map((l) => l.x2)));
    }
    // the finger is level with its head (not above the chord, where it was before)
    expect(low!.headFinger).toBe(1);
    expect(high!.headFinger).toBe(2);
    expect(high!.finger).toBe(2);
  });

  it('a dotted note has its finger right of the dot', () => {
    const c = chartOf({ bars: 1, num: 3, events: [{ tick: 0, dur: 1440, step: 'G', octave: 4 }] });
    c.notes[0]!.finger = 4;
    const n = lay(c).notes[0]!;
    expect(n.dot).not.toBeNull();
    expect(n.fingerX).toBeGreaterThan(n.dot!.x);
  });

  it('in a stem-up chord with a second, the finger of the lower head goes past the displaced head beside it', () => {
    // C4 and D4: a second, so the upper head is displaced right of the stem (stem up)
    const c = chartOf({ bars: 1, events: [{ tick: 0, dur: 960, step: 'C', octave: 4 }, { tick: 0, dur: 960, step: 'D', octave: 4 }] });
    c.notes[0]!.finger = 1;
    c.notes[1]!.finger = 2;
    const members = lay(c).notes;
    const lower = members.reduce((a, b) => (b.y > a.y ? b : a));
    const upper = members.find((n) => n !== lower)!;
    expect(lower.stem?.up).toBe(true);
    expect(upper.x).toBeGreaterThan(lower.x);
    expect(lower.fingerX).toBeGreaterThan(upper.x + upper.headRx);
    expect(upper.fingerX).toBeGreaterThan(upper.x + upper.headRx);
  });

  it('a chord keeps the finger of every head beside it, while only the top head is the default finger', () => {
    const c = chartOf({ bars: 1, events: [{ tick: 0, dur: 960, step: 'C', octave: 4 }, { tick: 0, dur: 960, step: 'E', octave: 4 }] });
    c.notes[0]!.finger = 1;
    c.notes[1]!.finger = 3;
    const members = lay(c).notes;
    expect(members.map((n) => n.headFinger).sort()).toEqual([1, 3]);
    for (const n of members) expect(n.fingerX).toBeGreaterThan(n.x + n.headRx);
    expect(members.filter((n) => n.finger !== null)).toHaveLength(1);
  });
});

// core_09.AC32 (d121): a grace note is drawn small before its main note, clear of the notes, accidentals and ties around it.
describe('grace notes (core_09.AC32)', () => {
  type Grace = NonNullable<Chart['graces']>[number];
  const pitch = (step: 'C' | 'D' | 'E' | 'F' | 'G' | 'A' | 'B', octave: number, alter = 0) => {
    const steps = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 } as const;
    return { midi: 12 * (octave + 1) + steps[step] + alter, spelling: { step, alter, octave } };
  };
  const grace = (tick: number, p: ReturnType<typeof pitch>, slash = true, track = 't'): Grace => ({ track, voice: 1, tick, pitch: p, slash });
  /** Chart with graces added; parsed, so the schema checks them as the compiler's output would be checked. */
  const withGraces = (chart: Chart, graces: Grace[]): Chart => chartSchema.parse({ ...chart, graces });
  /** Quarter notes on every beat (E4 unless given): note `i` at tick `i * 480`. */
  const quarters = (bars = 2, first?: { step: 'F'; alter: number }) => chartOf({
    bars,
    events: Array.from({ length: bars * 4 }, (_, i) => (i === 1 && first ? { tick: 480, dur: 480, step: first.step, octave: 4, alter: first.alter } : { tick: i * 480, dur: 480, step: 'E', octave: 4 })),
  });
  /** The ink a note takes on each side: its head, its accidentals, its ledger lines and its dot. */
  const inkOf = (n: StaffLayout['notes'][number]) => ({
    left: Math.min(n.x - n.headRx, n.accidentalLeft ?? Infinity, ...n.ledgerLines.map((l) => l.x1)),
    right: Math.max(n.x + n.headRx, ...n.ledgerLines.map((l) => l.x2), n.dot ? n.dot.x + 0.3 * n.headRx : -Infinity),
  });
  const S = 12;
  const view = { viewport: { width: 1366, height: 768 }, staffSpace: S } as const;
  const note = (layout: StaffLayout, index: number) => layout.notes.find((n) => n.index === index)!;
  /** Clear of the note before, and of its own main note's ink. */
  const expectClear = (layout: StaffLayout, prev: number, main: number) => {
    for (const g of layout.graces) {
      expect(g.left).toBeGreaterThan(inkOf(note(layout, prev)).right);
      expect(g.right).toBeLessThan(inkOf(note(layout, main)).left);
    }
  };

  it('draws a slashed grace small and left of its main note, at the room it reserves (core_09.AC32)', () => {
    const layout = layoutStaff(withGraces(quarters(), [grace(480, pitch('D', 4))]), view);
    expect(layout.graces).toHaveLength(1);
    const g = layout.graces[0]!;
    const main = note(layout, 1);
    expect(g).toMatchObject({ index: 0, main: 1, bar: 0, system: 0, staff: 0, scale: 0.6, position: -1, label: 'D' });
    expect(g.headRx).toBeCloseTo(main.headRx * 0.6);
    // D4 is stem up, so its flag sets its right reach: 0.6 * (0.65 + 0.85) spaces; then 0.4 to the main head (0.65 half width)
    expect(g.right).toBeCloseTo(main.column - (0.65 + 0.4) * S);
    expect(g.x).toBeCloseTo(main.column - (0.65 + 0.4 + 0.9) * S);
    expect(g.left).toBeCloseTo(g.x - 0.9 * S);
    expect(g.stem.x + 0.85 * 0.6 * S).toBeLessThanOrEqual(g.right + 1e-9);
    expectClear(layout, 0, 1);
  });

  it('places a grace head on the line or space of its pitch, with small ledger lines (core_09.AC32)', () => {
    const bottom = (layout: StaffLayout) => layout.systems[0]!.staves[0]!.bottomLineY;
    const at = (p: ReturnType<typeof pitch>) => layoutStaff(withGraces(quarters(), [grace(480, p, false)]), view);
    const d4 = at(pitch('D', 4));
    expect(d4.graces[0]!.y).toBeCloseTo(bottom(d4) + S / 2); // D4: the space below the bottom line (position -1)
    expect(d4.graces[0]!.ledgerLines).toEqual([]);
    const c4 = at(pitch('C', 4));
    const g = c4.graces[0]!;
    expect(g.y).toBeCloseTo(bottom(c4) + S); // C4: its own ledger line (position -2)
    expect(g.ledgerLines).toEqual([{ y: g.y, x1: g.x - 1.05 * S * 0.6, x2: g.x + 1.05 * S * 0.6 }]);
    expect(g.right).toBeCloseTo(g.ledgerLines[0]!.x2);
    const g5 = at(pitch('G', 5));
    expect(g5.graces[0]!.y).toBeCloseTo(bottom(g5) - S * 4.5); // G5 is position 9: the space above the top line
  });

  it.each([
    ['C4 below the middle line', pitch('C', 4), true],
    ['B4 on the middle line', pitch('B', 4), false],
    ['G5 above the staff', pitch('G', 5), false],
  ])('stems a grace on %s by the rule of a single head, at the small size (core_09.AC32)', (_, p, up) => {
    const g = layoutStaff(withGraces(quarters(), [grace(480, p, false)]), view).graces[0]!;
    expect(g.stem.up).toBe(up);
    expect(g.stem.x).toBeCloseTo(up ? g.x + g.headRx : g.x - g.headRx);
    expect(g.stem.y1).toBe(g.y);
    expect(Math.abs(g.stem.y2 - g.y)).toBeCloseTo(3.5 * S * 0.6); // a normal stem is 3.5 spaces
    expect(up ? g.stem.y2 < g.y : g.stem.y2 > g.y).toBe(true);
  });

  it('draws a flag and a slash only on a slashed grace, the slash across the stem (core_09.AC32)', () => {
    const at = (slash: boolean) => layoutStaff(withGraces(quarters(), [grace(480, pitch('D', 4), slash)]), view).graces[0]!;
    expect(at(false)).toMatchObject({ flag: false, slash: null });
    const g = at(true);
    expect(g.flag).toBe(true);
    const { x1, y1, x2, y2 } = g.slash!;
    expect(x1).toBeLessThan(g.stem.x);
    expect(x2).toBeGreaterThan(g.stem.x);
    expect(Math.min(y1, y2)).toBeGreaterThan(Math.min(g.stem.y1, g.stem.y2));
    expect(Math.max(y1, y2)).toBeLessThan(Math.max(g.stem.y1, g.stem.y2));
  });

  it('prints a grace accidental small and left of its head by the accidental rule, inside the grace (core_09.AC32)', () => {
    const layout = layoutStaff(withGraces(quarters(), [grace(480, pitch('F', 4, 1))]), view);
    const g = layout.graces[0]!;
    expect(g.accidental).toMatchObject({ alter: 1, y: g.y });
    expect(g.accidental!.x).toBeCloseTo(g.x - (0.65 + 0.2 + ACCIDENTAL_BOX.sharp.width / 2) * 0.6 * S);
    expect(g.left).toBeCloseTo(g.x - (0.65 + 0.2 + ACCIDENTAL_BOX.sharp.width) * 0.6 * S);
    expectClear(layout, 0, 1);
    // F4 is natural in C major: a natural grace prints nothing
    expect(layoutStaff(withGraces(quarters(), [grace(480, pitch('F', 4))]), view).graces[0]!.accidental).toBeNull();
  });

  it('carries a grace accidental through the bar, as any accidental (core_09.AC3, core_09.AC32)', () => {
    // a grace F#4 before E4, then F4 later in the bar: the F prints a natural, as it would after a written F#
    const chart = chartOf({ bars: 1, events: [
      { tick: 0, dur: 480, step: 'E', octave: 4 }, { tick: 480, dur: 480, step: 'E', octave: 4 }, { tick: 960, dur: 960, step: 'F', octave: 4 },
    ] });
    const layout = layoutStaff(withGraces(chart, [grace(480, pitch('F', 4, 1))]), view);
    expect(layout.graces[0]!.accidental?.alter).toBe(1);
    expect(note(layout, 2).accidental?.alter).toBe(0);
    expect(layoutStaff(chart, view).notes[2]!.accidental).toBeNull();
  });

  it('keeps a grace accidental clear of the grace head\'s ledger line (core_09.AC32)', () => {
    const g = layoutStaff(withGraces(quarters(), [grace(480, pitch('C', 4, 1), false)]), view).graces[0]!;
    const sharpRight = g.accidental!.x + (ACCIDENTAL_BOX.sharp.width / 2) * 0.6 * S;
    expect(sharpRight).toBeLessThan(g.ledgerLines[0]!.x1);
  });

  it('stands left of its main note\'s accidental, and the bar takes the larger room once, not the sum (core_09.AC32)', () => {
    const sharpMain = quarters(1, { step: 'F', alter: 1 });
    const naturalMain = quarters(1, { step: 'F', alter: 0 });
    const both = layoutStaff(withGraces(sharpMain, [grace(480, pitch('D', 4))]), view);
    const g = both.graces[0]!;
    expect(g.right).toBeCloseTo(note(both, 1).column - (both.bars[0]!.rooms[0]!.room - 0.9 - 0.9 - 0.5) * S);
    expect(g.right).toBeLessThan(note(both, 1).accidentalLeft!);
    expectClear(both, 0, 1);
    const roomOf = (c: Chart) => layoutStaff(c, view).bars[0]!.roomTotal;
    const graceOnly = roomOf(withGraces(naturalMain, [grace(480, pitch('D', 4))]));
    // the grace's own share (gap, grace, margin) is the same whether the main note has an accidental or not
    expect(roomOf(withGraces(sharpMain, [grace(480, pitch('D', 4))])) - roomOf(sharpMain)).toBeCloseTo(graceOnly - 0.65);
  });

  it('keeps a grace clear of the previous note and its main note at every zoom and viewport (core_09.AC32)', () => {
    const charts = [
      withGraces(quarters(), [grace(480, pitch('C', 4, 1))]),
      withGraces(quarters(1, { step: 'F', alter: 1 }), [grace(480, pitch('A', 5, -1))]),
      // a dotted half before the main note: clear of its dot too
      withGraces(chartOf({ bars: 1, events: [{ tick: 0, dur: 1440, step: 'G', octave: 4 }, { tick: 1440, dur: 480, step: 'B', octave: 4 }] }), [grace(1440, pitch('C', 5))]),
    ];
    for (const chart of charts) {
      for (const viewport of VIEWPORTS) {
        for (const staffSpace of [8, 12, 20, 32, 'auto' as const]) expectClear(layoutStaff(chart, { viewport, staffSpace }), 0, 1);
      }
    }
  });

  it('keeps a grace on the first note of a line after the clef, key and the line start, at every zoom (core_09.AC32)', () => {
    const plain = chartOf({ bars: 4, fifths: 2, events: Array.from({ length: 16 }, (_, i) => ({ tick: i * 480, dur: 480, step: 'E', octave: 4 })) });
    // the second grace is a C natural against D major's C sharp, so it prints a small natural at the line start
    const chart = withGraces(plain, [grace(0, pitch('D', 4)), grace(3840, pitch('C', 5))]);
    for (const staffSpace of [8, 12, 20, 'auto' as const]) {
      const layout = layoutStaff(chart, { ...view, staffSpace, barsPerLine: 2 });
      expect(layout.systems).toHaveLength(2);
      const [first, second] = layout.graces;
      expect(second).toMatchObject({ system: 1, bar: 2, main: 8 });
      expect(second!.accidental?.alter).toBe(0);
      for (const [g, main] of [[first!, 0], [second!, 8]] as const) {
        const bar = layout.bars.find((b) => b.index === g.bar)!;
        const keyRight = Math.max(...layout.keySignature.filter((k) => k.system === g.system).map((k) => k.x));
        expect(g.left).toBeGreaterThan(bar.x);
        expect(g.left).toBeGreaterThan(keyRight);
        expect(g.right).toBeLessThan(inkOf(note(layout, main)).left);
      }
    }
  });

  it('keeps the grace room in a spaced layout too (core_09.AC32)', () => {
    const columns = [0, 480, 960, 1440].map((tick) => ({ tick, width: 2.6 }));
    const layout = layoutStaff(withGraces(quarters(), [grace(480, pitch('D', 4))]), { ...view, spacing: [{ columns }, { columns }] });
    expectClear(layout, 0, 1);
  });

  it('draws a grace on its own track\'s staff only, by that staff\'s clef (core_09.AC32)', () => {
    // right hand C5 quarters, left hand C3 quarters; one grace on the left hand's second note
    const notes = [0, 480, 960, 1440].flatMap((tick) => [{ tick, dur: 480, midi: 72 }, { tick, dur: 480, midi: 48, track: 'lh' }]);
    const chart = chartWith(notes, { graces: [grace(480, pitch('B', 2), true, 'lh')] });
    const layout = layoutStaff(chart, view);
    expect(layout.graces).toHaveLength(1);
    const g = layout.graces[0]!;
    const main = note(layout, g.main);
    expect(main.staff).toBe(1);
    expect(chart.notes[g.main]).toMatchObject({ track: 'lh', tick: 480 });
    const bass = layout.systems[0]!.staves[1]!;
    expect(g.staff).toBe(1);
    expect(g.position).toBe(2); // B2 in the bass clef: the second line from the bottom
    expect(g.y).toBeCloseTo(bass.bottomLineY - S);
    expect(g.right).toBeLessThan(inkOf(main).left);
    const prev = chart.notes.findIndex((n) => n.track === 'lh' && n.tick === 0);
    expect(g.left).toBeGreaterThan(inkOf(note(layout, prev)).right);
  });

  it('ends a tie before the grace in front of its tied-to note (core_09.AC32)', () => {
    const chart = structuredClone(withGraces(quarters(), [grace(480, pitch('D', 4))]));
    chart.notes[0]!.tieNext = true;
    const layout = layoutStaff(chart, view);
    expect(layout.ties).toHaveLength(1);
    expect(layout.ties[0]!.x2).toBeCloseTo(layout.graces[0]!.left - 0.2 * S);
  });

  /** An eighth pair on beat 1, a quarter and a half after it: the pair's second note is chart note 1. */
  const eighthPair = (first: 'C' | 'D', octave: number) => chartOf({
    bars: 1,
    events: [
      { tick: 0, dur: 240, step: first, octave },
      { tick: 240, dur: 240, step: first === 'C' ? 'D' : 'E', octave },
      { tick: 480, dur: 480, step: 'C', octave: 4 },
      { tick: 960, dur: 960, step: 'C', octave: 4 },
    ],
  });

  it('raises a beam above the stem of a grace before the second note of its pair (core_09.AC32)', () => {
    const plain = layoutStaff(eighthPair('C', 4), view);
    const layout = layoutStaff(withGraces(eighthPair('C', 4), [grace(240, pitch('G', 4))]), view);
    const beam = layout.beams[0]!;
    const g = layout.graces[0]!;
    expect(beam.up).toBe(true);
    expect(g.stem.up).toBe(true);
    expect(g.x).toBeGreaterThan(beam.x1);
    expect(g.x).toBeLessThan(beam.x2);
    expect(beam.y + beam.thickness).toBeLessThan(Math.min(g.stem.y2, g.y - g.headRy));
    // both stems reach the raised beam, and their hints stay clear of the longer stems
    for (const i of [0, 1]) {
      expect(note(layout, i).stem!.y2).toBe(beam.y);
      expect(note(layout, i).fingerY).toBeLessThan(beam.y);
    }
    const fromTop = (l: StaffLayout) => l.beams[0]!.y - l.systems[0]!.staves[0]!.topLineY;
    expect(fromTop(layout)).toBeLessThan(fromTop(plain));
  });

  it('lowers a stem-down beam below a grace before the second note of its pair (core_09.AC32)', () => {
    const layout = layoutStaff(withGraces(eighthPair('C', 5), [grace(240, pitch('D', 4))]), view);
    const beam = layout.beams[0]!;
    const g = layout.graces[0]!;
    expect(beam.up).toBe(false);
    expect(g.x).toBeGreaterThan(beam.x1);
    expect(g.x).toBeLessThan(beam.x2);
    expect(beam.y - beam.thickness).toBeGreaterThan(Math.max(g.stem.up ? -Infinity : g.stem.y2, g.y + g.headRy));
    for (const i of [0, 1]) {
      expect(note(layout, i).stem!.y2).toBe(beam.y);
      expect(note(layout, i).labelY).toBeGreaterThan(beam.y);
    }
  });

  it('leaves a beam as it is when its grace stands before the first note of the pair (core_09.AC32)', () => {
    const plain = layoutStaff(eighthPair('C', 4), view);
    const layout = layoutStaff(withGraces(eighthPair('C', 4), [grace(0, pitch('G', 4))]), view);
    const fromTop = (l: StaffLayout) => l.beams[0]!.y - l.systems[0]!.staves[0]!.topLineY;
    expect(fromTop(layout)).toBeCloseTo(fromTop(plain));
  });

  it('ignores a grace whose tick is no note start of its track and voice, as a hand-made chart can hold one (core_09.AC32)', () => {
    const plain = quarters();
    // not parsed: the schema refuses these, but the layout must not trust that every chart it gets was parsed
    const stray = { ...plain, graces: [grace(240, pitch('D', 4)), { ...grace(480, pitch('D', 4)), voice: 2 }, grace(480, pitch('D', 4), true, 'other')] } as Chart;
    expect(layoutStaff(stray, view)).toEqual(layoutStaff(plain, view));
  });

  it('lays out notes, bars and beats as without graces: graces are not notes (core_09.AC32)', () => {
    const plain = quarters();
    const a = layoutStaff(plain, view);
    const b = layoutStaff(withGraces(plain, [grace(480, pitch('D', 4))]), view);
    expect(b.notes.map((n) => [n.index, n.bar, n.value])).toEqual(a.notes.map((n) => [n.index, n.bar, n.value]));
    expect(b.bars.map((x) => x.index)).toEqual(a.bars.map((x) => x.index));
    expect(b.timeSignature.x).toBe(a.timeSignature.x);
    expect(b.notes.map((n) => n.column)).toEqual([...b.notes.map((n) => n.column)].sort((x, y) => x - y));
  });

  it('keeps a grace before a whole note inside its bar (core_09.AC32)', () => {
    const chart = withGraces(chartOf({ bars: 1, events: [{ tick: 0, dur: 1920, step: 'C', octave: 4 }] }), [grace(0, pitch('D', 4))]);
    const layout = layoutStaff(chart, view);
    const g = layout.graces[0]!;
    expect(g.left).toBeGreaterThan(layout.bars[0]!.x);
    expect(g.right).toBeLessThan(inkOf(layout.notes[0]!).left);
  });

  it('lays out a chart with an empty grace list as one without the field (core_09.AC32)', () => {
    const chart = chartSchema.parse(structuredClone(littleSteps));
    for (const options of [view, { viewport: { width: 800, height: 1280 }, staffSpace: 'auto' as const, barsPerLine: 2 }]) {
      const without = layoutStaff(chart, options);
      expect(without.graces).toEqual([]);
      expect(layoutStaff({ ...chart, graces: [] }, options)).toEqual(without);
    }
  });
});

describe('a piece that starts with a pick-up (d120)', () => {
  const META = JSON.stringify({ id: 'up', title: 'Up', level: 1, status: 'draft', hands: ['RH'], phrases: [], source: 'test', license: 'CC0-1.0', generator: { kind: 'hand' } });
  const compiled = (body: string, key = 'C') => {
    const out = compilePiece({ abc: `X:1\nT:Up\nM:4/4\nL:1/4\nQ:1/4=100\nK:${key}\n${body}`, meta: META });
    expect(out.diagnostics.filter((d) => d.severity === 'error')).toEqual([]);
    return out.chart!;
  };
  const chart = compiled('G | C D E F | G A B c | d3 |]', 'G');
  const layout = layoutStaff(chart, { viewport: { width: 1366, height: 600 } });

  it('core_09.AC24 prints the clef, the key and the time signature before the pick-up bar', () => {
    const pickup = layout.bars[0]!;
    expect(layout.clefs[0]!.x + layout.clefs[0]!.w).toBeLessThan(pickup.x);
    expect(layout.keySignature.length).toBeGreaterThan(0);
    for (const k of layout.keySignature.filter((g) => g.system === 0)) expect(k.x).toBeLessThan(pickup.x);
    expect(layout.timeSignature.x).toBeLessThan(pickup.x);
    expect(layout.timeSignature).toMatchObject({ num: 4, den: 4 });
  });

  it('core_09.AC24 gives the pick-up the width of its own beat, a quarter of a whole bar, and draws no rests for the beats it lacks', () => {
    const [pickup, first] = layout.bars;
    expect(pickup!.system).toBe(first!.system);
    expect(pickup!.width).toBeCloseTo(first!.width / 4, 6);
    expect(layout.rests.filter((r) => r.bar === 0)).toEqual([]);
    expect(chart.rests).toEqual([]);
    // its one note sits where a note on a bar's first beat sits
    const note = layout.notes.find((n) => n.index === 0)!;
    const firstOfBar1 = layout.notes.find((n) => n.index === 1)!;
    expect(note.x - pickup!.x).toBeCloseTo(firstOfBar1.x - first!.x, 6);
  });

  it('core_09.AC24 the line keeps its length: the whole bars take what the pick-up leaves', () => {
    const options = { viewport: { width: 1366, height: 600 }, barsPerLine: 4 };
    const withPickup = layoutStaff(chart, options);
    const plain = layoutStaff(compiled('C D E F | G A B c | d A B c | d4 |]', 'G'), options);
    const line = (l: StaffLayout) => l.bars.filter((b) => b.system === 0);
    const lineEnd = (l: StaffLayout) => Math.max(...line(l).map((b) => b.x + b.width));
    expect(line(withPickup)).toHaveLength(4);
    expect(withPickup.staffSpace).toBe(plain.staffSpace);
    expect(lineEnd(withPickup)).toBeCloseTo(lineEnd(plain), 6);
    expect(line(withPickup)[1]!.width).toBeGreaterThan(line(plain)[1]!.width);
  });

  it('core_09.AC24 with bars as wide as their columns (the piece maker) the pick-up is as wide as its own column', () => {
    const columns = (i: number) => (i === 0 ? [{ tick: 0, width: 3 }] : [0, 480, 960, 1440].map((tick) => ({ tick, width: 3 })));
    const spaced = layoutStaff(chart, { viewport: { width: 4000, height: 2000 }, staffSpace: 10, spacing: chart.bars.map((_, i) => ({ columns: columns(i) })) });
    const [pickup, first] = spaced.bars;
    expect(first!.width - pickup!.width).toBeCloseTo(9 * 10, 6);
    expect(spaced.notes.find((n) => n.index === 0)!.x - pickup!.x).toBeCloseTo(spaced.notes.find((n) => n.index === 1)!.x - first!.x, 6);
  });

  it('a piece with no pick-up keeps bars of one width', () => {
    const plain = layoutStaff(compiled('C D E F | G A B c | d4 |]'), { viewport: { width: 1366, height: 600 } });
    const widths = plain.bars.map((b) => b.width);
    for (const w of widths) expect(w).toBeCloseTo(widths[0]!, 6);
  });
});
