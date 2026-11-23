// Covers ft_0_15.AC1, ft_1_32.AC18.
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import handsTogether from '../../../tests/golden/hands-together.chart.json';
import { chartWith } from '../../../tests/helpers/charts';
import { chartSchema, type Chart } from '../chart';
import { toChart } from '../editor/chart';
import { emptyPiece } from '../editor/model';
import { handChart } from '../learn/plan';
import { UnsupportedNotationError, layoutStaff, type NoteGlyph, type StaffLayout } from './staff';

const VIEWPORTS = [
  { width: 1366, height: 768 },
  { width: 1280, height: 720 },
  { width: 1024, height: 600 },
];

const together = chartSchema.parse(handsTogether);
const lay = (chart: Chart, width = 1366, height = 768): StaffLayout => layoutStaff(chart, { viewport: { width, height } });

/** Everything a note on this staff brings, top and bottom, including hint rooms and ledger lines. */
function extent(layout: StaffLayout, n: NoteGlyph): { top: number; bottom: number } {
  const S = layout.staffSpace;
  return {
    top: Math.min(n.y - n.headRy, n.stem && n.stem.up ? n.stem.y2 : Infinity, n.fingerY - 0.55 * S),
    bottom: Math.max(n.y + n.headRy, n.stem && !n.stem.up ? n.stem.y2 : -Infinity, n.labelY + 0.55 * S),
  };
}

describe('a grand staff for a piece with two played tracks', () => {
  const layout = lay(together);

  it('has a treble staff above a bass staff in every system, in that order', () => {
    expect(layout.systems.length).toBeGreaterThan(0);
    for (const system of layout.systems) {
      expect(system.staves.map((s) => [s.trackId, s.clef])).toEqual([['rh', 'treble'], ['lh', 'bass']]);
      expect(system.staves[1]!.topLineY).toBeGreaterThan(system.staves[0]!.bottomLineY);
      expect(system.topLineY).toBe(system.staves[0]!.topLineY);
      expect(system.bottomLineY).toBe(system.staves[1]!.bottomLineY);
    }
    expect(layout.clef).toBe('treble');
  });

  it('draws five lines per staff and a clef on each staff of every system', () => {
    for (const system of layout.systems) {
      for (const staff of system.staves) {
        const lines = layout.staffLines.filter((l) => l.system === system.index && l.staff === staff.index).map((l) => l.y);
        expect(lines).toHaveLength(5);
        expect(Math.max(...lines)).toBeCloseTo(staff.bottomLineY);
        expect(Math.min(...lines)).toBeCloseTo(staff.topLineY);
      }
      expect(layout.clefs.filter((c) => c.system === system.index).map((c) => c.clef)).toEqual(['treble', 'bass']);
    }
  });

  it('joins the staves with one brace per system and runs bar lines through both staves', () => {
    expect(layout.braces).toHaveLength(layout.systems.length);
    for (const system of layout.systems) {
      const brace = layout.braces.find((b) => b.system === system.index)!;
      expect(brace).toMatchObject({ y1: system.staves[0]!.topLineY, y2: system.staves[1]!.bottomLineY });
      expect(brace.x).toBeLessThan(system.left);
      for (const bar of layout.barlines.filter((b) => b.system === system.index)) {
        expect(bar).toMatchObject({ y1: system.staves[0]!.topLineY, y2: system.staves[1]!.bottomLineY });
      }
    }
  });

  it('shows the time signature on both staves of the first system', () => {
    expect(layout.timeSignatures).toHaveLength(2);
    expect(layout.timeSignatures.map((t) => [t.system, t.staff, t.num, t.den])).toEqual([[0, 0, 4, 4], [0, 1, 4, 4]]);
    expect(layout.timeSignature).toEqual(layout.timeSignatures[0]);
    expect(layout.timeSignatures[1]!.yNum).toBeGreaterThan(layout.timeSignatures[0]!.yDen);
  });

  it('puts each hand on its own staff, in chart order', () => {
    expect(layout.notes.map((n) => n.index)).toEqual(layout.notes.map((_, i) => i));
    together.notes.forEach((note, i) => expect(layout.notes[i]!.staff).toBe(note.track === 'rh' ? 0 : 1));
  });

  it('aligns notes that sound together on one time axis, one above the other', () => {
    const byTick = new Map<number, number[]>();
    together.notes.forEach((n, i) => byTick.set(n.tick, [...(byTick.get(n.tick) ?? []), layout.notes[i]!.x]));
    const both = [...byTick.values()].filter((xs) => xs.length === 2);
    expect(both.length).toBe(4);
    for (const [a, b] of both) expect(a).toBeCloseTo(b!, 6);
  });

  it('puts a whole note under two half notes below the first half note, not between them', () => {
    const l = lay(chartWith([
      { tick: 0, dur: 960, midi: 64 }, { tick: 960, dur: 960, midi: 62 }, { tick: 0, dur: 1920, midi: 48, track: 'lh' },
    ]));
    const [first, second, whole] = l.notes;
    expect(whole!.x).toBeCloseTo(first!.x);
    expect(whole!.x).toBeLessThan(second!.x);
  });

  it('centres a whole note in its bar when the other hand also holds a whole note', () => {
    const l = lay(chartWith([{ tick: 0, dur: 1920, midi: 60 }, { tick: 0, dur: 1920, midi: 48, track: 'lh' }]));
    const bar = l.bars[0]!;
    expect(l.notes[0]!.x).toBeCloseTo(l.notes[1]!.x);
    expect(l.notes[0]!.x).toBeGreaterThan(bar.x + bar.width * 0.3);
  });

  it('places middle C below the treble staff and above the bass staff, each on a ledger line of its own staff', () => {
    const middleC = lay(chartWith([
      { tick: 0, dur: 1920, midi: 60 }, { tick: 0, dur: 1920, midi: 60, track: 'lh' },
    ]));
    const [rh, lh] = middleC.notes;
    expect([rh!.staff, rh!.position]).toEqual([0, -2]);
    expect([lh!.staff, lh!.position]).toEqual([1, 10]);
    expect(rh!.y).toBeGreaterThan(middleC.systems[0]!.staves[0]!.bottomLineY);
    expect(lh!.y).toBeLessThan(middleC.systems[0]!.staves[1]!.topLineY);
    expect(rh!.ledgerLines).toHaveLength(1);
    expect(lh!.ledgerLines).toHaveLength(1);
    // the two middle Cs are different places on the page, with the gap between the staves in between
    expect(lh!.y).toBeGreaterThan(rh!.y);
  });

  it('puts the cursor arrow above the top staff and below the bottom staff, never between them', () => {
    for (const system of layout.systems) {
      const [top, bottom] = system.staves as [typeof system.staves[0], typeof system.staves[0]];
      expect(top.arrow.direction).toBe('down');
      expect(top.arrow.tipY).toBeLessThan(top.topLineY);
      expect(bottom.arrow.direction).toBe('up');
      expect(bottom.arrow.tipY).toBeGreaterThan(bottom.bottomLineY);
      expect(system.cursorTipY).toBe(bottom.arrow.tipY);
    }
  });

  it('keeps everything of the upper staff above everything of the lower staff, hints included', () => {
    for (const system of layout.systems) {
      const upper = layout.notes.filter((n) => n.system === system.index && n.staff === 0).map((n) => extent(layout, n).bottom);
      const lower = layout.notes.filter((n) => n.system === system.index && n.staff === 1).map((n) => extent(layout, n).top);
      expect(Math.max(...upper)).toBeLessThan(Math.min(...lower));
    }
  });

  it('draws a single staff when one track is named, as before', () => {
    const single = layoutStaff(together, { viewport: { width: 1366, height: 768 }, trackId: 'lh' });
    expect(single.braces).toEqual([]);
    expect(single.timeSignatures).toHaveLength(1);
    expect(single.systems[0]!.staves).toHaveLength(1);
    expect(single.notes.every((n) => n.staff === 0)).toBe(true);
  });
});

describe('sizes', () => {
  it('fits at every supported viewport with readable notes: 16 px between lines on the laptops, 12 px on the small screen', () => {
    for (const vp of VIEWPORTS) {
      const l = lay(together, vp.width, vp.height);
      expect(l.fits, `${vp.width}x${vp.height}`).toBe(true);
      expect(l.staffSpace).toBeGreaterThanOrEqual(vp.width >= 1280 ? 16 : 12);
    }
  });

  it('needs more vertical room than one staff, so on a small screen its notes are smaller than the same piece on one staff', () => {
    const viewport = { width: 1024, height: 600 };
    const grand = layoutStaff(together, { viewport }).staffSpace;
    const single = layoutStaff(together, { viewport, trackId: 'rh' }).staffSpace;
    expect(grand).toBeLessThan(single);
  });

  it('stays inside the viewport and never overlaps neighbours for random two-hand pieces (property)', () => {
    const pitch = (low: number, high: number) => fc.integer({ min: low, max: high }).filter((m) => [0, 2, 4, 5, 7, 9, 11].includes(m % 12));
    const pieceArb = fc.array(fc.tuple(pitch(60, 72), pitch(43, 60)), { minLength: 4, maxLength: 4 });
    fc.assert(
      fc.property(pieceArb, fc.constantFrom(...VIEWPORTS), (pairs, vp) => {
        const notes = pairs.flatMap(([rh, lh], i) => [
          { tick: i * 480, dur: 480, midi: rh }, { tick: i * 480, dur: 480, midi: lh, track: 'lh' },
        ]);
        const l = lay(chartWith(notes), vp.width, vp.height);
        for (const n of l.notes) {
          const e = extent(l, n);
          expect(n.x - n.headRx).toBeGreaterThanOrEqual(0);
          expect(n.x + n.headRx).toBeLessThanOrEqual(vp.width);
          expect(e.top).toBeGreaterThanOrEqual(0);
          expect(e.bottom).toBeLessThanOrEqual(vp.height);
        }
        const upper = l.notes.filter((n) => n.staff === 0).map((n) => extent(l, n).bottom);
        const lower = l.notes.filter((n) => n.staff === 1).map((n) => extent(l, n).top);
        expect(Math.max(...upper)).toBeLessThan(Math.min(...lower));
      }),
    );
  });
});

describe('longer pieces and rests', () => {
  /** Eight bars, each hand holding a whole note per bar. */
  const longPiece = () => {
    const events = Array.from({ length: 8 }, (_, bar) => [
      { tick: bar * 1920, dur: 1920, midi: 60 + (bar % 5) },
      { tick: bar * 1920, dur: 1920, midi: 48, track: 'lh' },
    ]).flat().map((e) => ({ ...e, midi: [60, 62, 64, 65, 67].includes(e.midi) || e.midi === 48 ? e.midi : 60 }));
    return chartWith(events);
  };

  it('spreads many bars over several systems that do not touch each other', () => {
    const l = lay(longPiece(), 1366, 768);
    expect(l.fits).toBe(true);
    expect(l.systems.length).toBeGreaterThan(0);
    for (let k = 0; k + 1 < l.systems.length; k++) {
      const here = l.systems[k]!;
      const next = l.systems[k + 1]!;
      expect(next.staves[0]!.arrow.tipY).toBeGreaterThan(here.cursorTipY);
    }
  });

  it('draws a whole-bar rest on the staff of the resting hand (hands taking turns)', () => {
    const turns = chartWith(
      [{ tick: 0, dur: 1920, midi: 60 }, { tick: 1920, dur: 1920, midi: 48, track: 'lh' }],
      { rests: [] },
    );
    const withRests = chartSchema.parse({
      ...turns,
      rests: [
        { tick: 1920, dur: 1920, track: 'rh', voice: 1, bar: 1 },
        { tick: 0, dur: 1920, track: 'lh', voice: 1, bar: 0 },
      ],
    });
    const l = lay(withRests);
    const system = l.systems[0]!;
    const lhRest = l.rests.find((r) => r.staff === 1)!;
    const rhRest = l.rests.find((r) => r.staff === 0)!;
    expect([lhRest.bar, lhRest.value, rhRest.bar, rhRest.value]).toEqual([0, 'whole', 1, 'whole']);
    // a whole rest hangs from the fourth line of its own staff
    expect(lhRest.y).toBeCloseTo(system.staves[1]!.bottomLineY - 3 * l.staffSpace);
    expect(rhRest.y).toBeCloseTo(system.staves[0]!.bottomLineY - 3 * l.staffSpace);
    // whole-bar rests and whole notes are centred in their bar
    const bar = l.bars[0]!;
    expect(lhRest.x).toBeCloseTo(l.notes[0]!.x);
    expect(l.notes[0]!.x).toBeGreaterThan(bar.x);
    expect(l.notes[0]!.x).toBeLessThan(bar.x + bar.width);
  });
});

describe('a hand with no notes', () => {
  const both = emptyPiece({ title: 'Two hands', hands: 'both', beats: 4, bars: 4 });
  const rhOnly = toChart({ ...both, notes: [{ hand: 'RH', bar: 0, start: 0, length: 'quarter', step: 'E', octave: 4, alter: 0 }] }, { id: 'rh-only' });
  const empty = toChart(both, { id: 'empty' });
  const staves = (l: StaffLayout) => l.systems.map((s) => s.staves.map((st) => st.clef));

  it('is left off the staff by default, so a player only sees what they play', () => {
    expect(staves(lay(rhOnly))).toEqual(lay(rhOnly).systems.map(() => ['treble']));
  });

  it('keeps its staff with allPlayTracks, so the editor shows the grand staff before a note is written', () => {
    for (const chart of [rhOnly, empty]) {
      const l = layoutStaff(chart, { viewport: { width: 1366, height: 768 }, allPlayTracks: true });
      for (const system of staves(l)) expect(system).toEqual(['treble', 'bass']);
      expect(l.braces).toHaveLength(l.systems.length);
    }
  });
});

describe('a hand that rests in a learning step', () => {
  it('ft_1_32.AC18 keeps its staff with restingTracks, marked resting, while the played hand\'s staff is not', () => {
    const right = handChart(together, 'RH');
    expect(lay(right).systems[0]!.staves.map((st) => st.clef)).toEqual(['treble']);
    const resting = right.tracks.filter((t) => t.role !== 'play').map((t) => t.id);
    const l = layoutStaff(right, { viewport: { width: 1366, height: 768 }, restingTracks: resting });
    for (const system of l.systems) expect(system.staves.map((st) => [st.clef, st.resting === true])).toEqual([['treble', false], ['bass', true]]);
    // every note of both hands is drawn, as in the whole piece
    expect(l.notes).toHaveLength(lay(together).notes.length);
  });
});

describe('what a grand staff refuses', () => {
  it('more than two played tracks', () => {
    const chart = chartWith(
      [{ tick: 0, dur: 1920, midi: 60 }, { tick: 0, dur: 1920, midi: 48, track: 'lh' }, { tick: 0, dur: 1920, midi: 64, track: 'x' }],
      {
        tracks: [
          { id: 'rh', role: 'play', hand: 'RH', clef: 'treble' },
          { id: 'lh', role: 'play', hand: 'LH', clef: 'bass' },
          { id: 'x', role: 'play', hand: null, clef: 'treble' },
        ],
      },
    );
    expect(() => lay(chart)).toThrow(UnsupportedNotationError);
    expect(() => lay(chart)).toThrow(/more than two staves/);
  });

  it('unsupported notation on either hand, with the same message as for one staff', () => {
    // a double sharp (C##3, midi 50) on the left hand: accidentals are drawn, double sharps are not (core_09.AC5)
    const chart = structuredClone(chartWith([{ tick: 0, dur: 1920, midi: 60 }, { tick: 0, dur: 1920, midi: 49, track: 'lh' }]));
    chart.notes[1]!.spelling = { step: 'C', alter: 2, octave: 3 };
    chart.notes[1]!.midi = 50;
    expect(() => lay(chart)).toThrow(/double/i);
  });
});

describe('the gap between the staves of a grand staff', () => {
  const short = layoutStaff(together, { viewport: { width: 1366, height: 768 }, staffGap: 'short' });

  it('puts middle C halfway between the staves with the short gap: two staff spaces, E D C B A', () => {
    for (const system of short.systems) {
      const [treble, bass] = system.staves;
      expect(bass!.topLineY - treble!.bottomLineY).toBeCloseTo(2 * short.staffSpace);
    }
  });

  it('draws the same middle C at one height on both staves with the short gap', () => {
    const c4 = short.notes.filter((n) => together.notes[n.index]!.midi === 60);
    expect(c4.length).toBeGreaterThan(0);
    for (const n of c4) {
      const [treble, bass] = short.systems[n.system]!.staves;
      expect(n.y).toBeCloseTo((treble!.bottomLineY + bass!.topLineY) / 2);
    }
  });

  it('keeps the staves further apart with the wide gap, which is what a layout gets by default', () => {
    const wide = layoutStaff(together, { viewport: { width: 1366, height: 768 }, staffSpace: short.staffSpace, staffGap: 'wide' });
    const plain = layoutStaff(together, { viewport: { width: 1366, height: 768 }, staffSpace: short.staffSpace });
    const gapOf = (l: StaffLayout) => l.systems[0]!.staves[1]!.topLineY - l.systems[0]!.staves[0]!.bottomLineY;
    expect(gapOf(wide)).toBeGreaterThan(2 * short.staffSpace);
    expect(gapOf(plain)).toBe(gapOf(wide));
  });

  it('changes nothing on a single staff', () => {
    const one = chartWith([{ tick: 0, dur: 480, midi: 60 }, { tick: 480, dur: 480, midi: 64 }]);
    expect(layoutStaff(one, { viewport: { width: 1366, height: 768 }, staffGap: 'short' })).toEqual(layoutStaff(one, { viewport: { width: 1366, height: 768 } }));
  });
});
