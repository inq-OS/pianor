// Covers ft_1_11.AC2, ft_1_11.AC3, ft_1_11.AC4, ft_1_11.AC8.
import { describe, expect, it } from 'vitest';
import { chartWith } from '../../../tests/helpers/charts';
import { chartSchema, type Chart } from '../chart';
import { DEFAULT_DURATION_HELP, durationMarkSchema, durationMarks, type DurationMark } from './durationHelp';

const both = (mark: DurationMark) => ({ RH: mark, LH: mark });
import { layoutStaff, type StaffLayout } from './staff';

const lay = (chart: Chart): StaffLayout => layoutStaff(chart, { viewport: { width: 1366, height: 600 }, barsPerLine: 2 });

// 4/4. Right hand: four quarters in bar 1, a dotted half and a quarter in bar 2. Left hand: C3 + G3 as half notes and
// nothing after them in bar 1, then a quarter and a dotted half (G2, on the bottom line) in bar 2.
const chart = chartWith([
  { tick: 0, dur: 480, midi: 72 }, { tick: 480, dur: 480, midi: 71 }, { tick: 960, dur: 480, midi: 69 }, { tick: 1440, dur: 480, midi: 67 },
  { tick: 1920, dur: 1440, midi: 72 }, { tick: 3360, dur: 480, midi: 67 },
  { tick: 0, dur: 960, midi: 48, track: 'lh' }, { tick: 0, dur: 960, midi: 55, track: 'lh' },
  { tick: 1920, dur: 480, midi: 48, track: 'lh' }, { tick: 2400, dur: 1440, midi: 43, track: 'lh' },
]);
const layout = lay(chart);
const S = layout.staffSpace;
const glyph = (index: number) => layout.notes.find((n) => n.index === index)!;
/** The y of every staff line of the glyph's staff, with its ledger lines. */
const linesNear = (index: number) => {
  const g = glyph(index);
  return [...layout.staffLines.filter((l) => l.system === g.system && l.staff === g.staff).map((l) => l.y), ...g.ledgerLines.map((l) => l.y)];
};

describe('the note duration helper (ft_1_11)', () => {
  it('is off in both hands by default and draws nothing when off (ft_1_11.AC4)', () => {
    expect(DEFAULT_DURATION_HELP).toEqual({ RH: 'off', LH: 'off' });
    expect(durationMarkSchema.options).toEqual(['off', 'ghost', 'band', 'both']);
    expect(durationMarks(layout, chart, both('off'))).toEqual({ bands: [], ghosts: [] });
  });

  it('A draws only the ghost heads, B only the band, A+B both (ft_1_11.AC4)', () => {
    const ghost = durationMarks(layout, chart, both('ghost'));
    const band = durationMarks(layout, chart, both('band'));
    const all = durationMarks(layout, chart, both('both'));
    expect(ghost.bands).toEqual([]);
    expect(ghost.ghosts.length).toBeGreaterThan(0);
    expect(band.ghosts).toEqual([]);
    expect(band.bands.length).toBeGreaterThan(0);
    expect(all).toEqual({ bands: band.bands, ghosts: ghost.ghosts });
  });

  it('each hand gets its own choice (ft_1_11.AC4)', () => {
    const tracks = (marks: { note: number }[]) => [...new Set(marks.map((m) => chart.notes[m.note]!.track))].sort();
    const leftOnly = durationMarks(layout, chart, { RH: 'off', LH: 'both' });
    expect(tracks(leftOnly.bands)).toEqual(['lh']);
    expect(tracks(leftOnly.ghosts)).toEqual(['lh']);
    const mixed = durationMarks(layout, chart, { RH: 'band', LH: 'ghost' });
    expect(tracks(mixed.bands)).toEqual(['rh']);
    expect(tracks(mixed.ghosts)).toEqual(['lh']);
  });

  it('runs the band from the head to just before where the sound stops (ft_1_11.AC2)', () => {
    const { bands } = durationMarks(layout, chart, both('band'));
    // the left hand's C3 half note in bar 1: from its head to before beat 3, where nothing starts
    const c3 = bands.filter((b) => b.note === 6);
    expect(c3.length).toBeGreaterThan(0);
    const half = glyph(6);
    const beat3 = glyph(2).column; // the right hand's third quarter sits on beat 3
    for (const b of c3) {
      expect(b.x1).toBe(half.x);
      expect(b.x2).toBeLessThan(beat3);
      expect(b.x2).toBeGreaterThan(beat3 - S);
    }
    // the quarter in bar 2 ends where the dotted half starts
    for (const b of bands.filter((b) => b.note === 8)) expect(b.x2).toBeLessThan(glyph(9).x);
  });

  it('runs a note held to the end of its bar up to the bar line (ft_1_11.AC2)', () => {
    const { bands } = durationMarks(layout, chart, both('band'));
    const g = glyph(9);
    const bar = layout.bars[g.bar]!;
    for (const b of bands.filter((b) => b.note === 9)) {
      expect(b.x2).toBeLessThanOrEqual(bar.x + bar.width);
      expect(b.x2).toBeGreaterThan(bar.x + bar.width - S);
    }
  });

  it('paints only the white between two lines: never over a staff or ledger line (ft_1_11.AC2)', () => {
    const { bands } = durationMarks(layout, chart, both('both'));
    expect(bands.length).toBeGreaterThan(0);
    for (const b of bands) {
      expect(b.y2).toBeGreaterThan(b.y1);
      for (const y of linesNear(b.note)) expect(y <= b.y1 - 0.5 || y >= b.y2 + 0.5, `line at ${y} vs band ${b.y1}..${b.y2}`).toBe(true);
      // and stays within one staff space of its head
      expect(Math.abs((b.y1 + b.y2) / 2 - glyph(b.note).y)).toBeLessThan(S / 2);
    }
    // a note in a space has one strip; a note on a line has two, one on each side of the line
    const count = (index: number) => bands.filter((b) => b.note === index).length;
    for (const g of layout.notes) expect(count(g.index)).toBe(g.position % 2 === 0 ? 2 : 1);
  });

  it('puts a ghost head on every beat the note is still held, never on its own beat or after it (ft_1_11.AC3)', () => {
    const { ghosts } = durationMarks(layout, chart, both('both'));
    const beatsOf = (index: number) => ghosts.filter((g) => g.note === index).map((g) => g.x);
    // a half note: one ghost, on beat 2 (where the right hand's second quarter is)
    expect(beatsOf(6)).toEqual([glyph(1).column]);
    expect(beatsOf(7)).toEqual([glyph(1).column]);
    // quarters have none
    for (const index of [0, 1, 2, 3, 5, 8]) expect(beatsOf(index)).toEqual([]);
    // a dotted half on beat 1: beats 2 and 3; a dotted half on beat 2: beats 3 and 4
    expect(beatsOf(4)).toHaveLength(2);
    expect(beatsOf(9)).toHaveLength(2);
    expect(beatsOf(9)[0]).toBeCloseTo(beatsOf(4)[1]!, 6);
    for (const g of ghosts) {
      const head = glyph(g.note);
      expect(g.y).toBe(head.y);
      expect([g.rx, g.ry]).toEqual([head.headRx, head.headRy]);
      expect(g.x).toBeGreaterThan(head.x);
    }
  });

  it('counts the beats of the time signature: a dotted half in 3/4 gets two ghosts (ft_1_11.AC3)', () => {
    const notes = [{ tick: 0, dur: 960, midi: 48, track: 'lh' }, { tick: 0, dur: 480, midi: 72 }, { tick: 480, dur: 480, midi: 71 }, { tick: 960, dur: 480, midi: 69 }, { tick: 1440, dur: 1440, midi: 72 }, { tick: 1440, dur: 960, midi: 48, track: 'lh' }];
    const base = chartWith(notes.map((n) => ({ ...n, tick: 0, dur: 480 })));
    const fixed = chartSchema.parse({
      ...base,
      meterMap: [{ tick: 0, num: 3, den: 4 }],
      bars: [{ index: 0, startTick: 0, endTick: 1440 }, { index: 1, startTick: 1440, endTick: 2880 }],
      notes: base.notes.map((n, i) => ({ ...n, tick: notes[i]!.tick, dur: notes[i]!.dur, bar: Math.floor(notes[i]!.tick / 1440) })),
    });
    const marks = durationMarks(lay(fixed), fixed, both('both'));
    const count = (index: number) => marks.ghosts.filter((g) => g.note === index).length;
    expect(count(0)).toBe(1); // the left hand's half note: beat 2
    expect(count(4)).toBe(2); // the dotted half: beats 2 and 3
  });

  it('spans the whole bar for a note drawn in the middle of its bar, with no ghosts (ft_1_11.AC3)', () => {
    const whole = chartWith([{ tick: 0, dur: 1920, midi: 72 }, { tick: 1920, dur: 480, midi: 72 }]);
    const l = lay(whole);
    const marks = durationMarks(l, whole, both('both'));
    const bar = l.bars[0]!;
    const band = marks.bands.find((b) => b.note === 0)!;
    expect(band.x1).toBeLessThan(l.notes.find((n) => n.index === 0)!.x - S);
    expect(band.x1).toBeGreaterThan(bar.x);
    expect(marks.ghosts.filter((g) => g.note === 0)).toEqual([]);
  });

  it('runs one unbroken band across tied notes, also over the bar line (ft_1_11.AC8)', () => {
    // a half note tied into a quarter on beat 3, then a quarter on beat 4 tied over the bar line into a half note
    const tied = chartWith([
      { tick: 0, dur: 960, midi: 72, tieNext: true }, { tick: 960, dur: 480, midi: 72 },
      { tick: 1440, dur: 480, midi: 74, tieNext: true }, { tick: 1920, dur: 960, midi: 74 }, { tick: 2880, dur: 960, midi: 72 },
    ]);
    const l = lay(tied);
    const at = (index: number) => l.notes.find((n) => n.index === index)!;
    expect(at(2).system).toBe(at(3).system);
    const { bands } = durationMarks(l, tied, both('band'));
    const strips = (index: number) => bands.filter((b) => b.note === index);
    // in the bar: the half note's band reaches the tied head, where the tied note's own band starts
    for (const b of strips(0)) expect(b.x2).toBeGreaterThanOrEqual(at(1).x);
    // over the bar line: the quarter's band reaches the bar line, the tied half note's band starts there
    const line = l.bars[0]!.x + l.bars[0]!.width;
    for (const b of strips(2)) expect(b.x2).toBeGreaterThanOrEqual(line);
    for (const b of strips(3)) expect(b.x1).toBeLessThanOrEqual(l.bars[1]!.x);
    // a note that is not tied still stops before the next head
    for (const b of strips(3)) expect(b.x2).toBeLessThan(at(4).x);
    for (const b of strips(1)) expect(b.x2).toBeLessThan(at(2).x);
  });

  it("runs a tie across a line break to the line's end and on from the next line's start, after the clef (ft_1_11.AC8)", () => {
    // bar 2 ends the first line (two bars a line): its last quarter is tied into bar 3 on the next line
    const tied = chartWith([
      { tick: 0, dur: 1920, midi: 72 }, { tick: 1920, dur: 1440, midi: 72 }, { tick: 3360, dur: 480, midi: 74, tieNext: true },
      { tick: 3840, dur: 960, midi: 74 },
    ]);
    const l = lay(tied);
    const at = (index: number) => l.notes.find((n) => n.index === index)!;
    expect(at(3).system).not.toBe(at(2).system);
    const { bands } = durationMarks(l, tied, both('band'));
    // where the second half of the tie curve starts: after the clef, not over it
    const curve = l.ties.find((t) => t.to === 3)!;
    for (const b of bands.filter((b) => b.note === 3)) expect(b.x1).toBe(curve.x1);
    // and the first line's band runs to the line's end
    const line = l.bars[at(2).bar]!;
    for (const b of bands.filter((b) => b.note === 2)) expect(b.x2).toBe(line.x + line.width);
  });
});
