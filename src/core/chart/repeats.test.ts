import { describe, expect, it } from 'vitest';
import { compilePiece } from '../piece/compile';
import { sliceChart } from './section';
import { unrollRepeats, writtenNotes, writtenTick, writtenView } from './repeats';
import { chartSchema, type Chart } from './schema';

const META = JSON.stringify({ id: 'rep', title: 'Rep', level: 1, status: 'draft', hands: ['RH'], phrases: [], source: 'test', license: 'CC0-1.0', generator: { kind: 'hand' } });
const chartOf = (body: string): Chart => {
  const out = compilePiece({ abc: `X:1\nT:Rep\nM:4/4\nL:1/4\nQ:1/4=100\nK:C\n${body}`, meta: META });
  expect(out.diagnostics.filter((d) => d.severity === 'error')).toEqual([]);
  return out.chart!;
};

describe('unrollRepeats', () => {
  // Covers core_09.AC17.
  it('the compiled chart keeps the written bars once, with the repeat', () => {
    const chart = chartOf('C4 |: D4 | E4 :| F4 |]');
    expect(chart.bars).toHaveLength(4);
    expect(chart.repeats).toEqual([{ startBar: 1, endBar: 2 }]);
    expect(chartOf('C4 | D4 |]').repeats).toBeUndefined();
  });

  // Covers core_09.AC18.
  it('plays the repeated bars twice, each note knowing its written note', () => {
    const play = unrollRepeats(chartOf('C4 |: D4 | E4 :| F4 |]'));
    expect(play.chart.notes.map((n) => n.spelling.step)).toEqual(['C', 'D', 'E', 'D', 'E', 'F']);
    expect(play.chart.notes.map((n) => n.bar)).toEqual([0, 1, 2, 3, 4, 5]);
    expect(play.writtenNote).toEqual([0, 1, 2, 1, 2, 3]);
    expect(play.writtenBar).toEqual([0, 1, 2, 1, 2, 3]);
    expect(play.chart.bars).toHaveLength(6);
    expect(play.chart.repeats).toBeUndefined();
    expect(writtenTick(play, 3 * 1920 + 10)).toBe(1920 + 10);
  });

  // Covers core_09.AC18.
  it('Kuula lights the written notes on the second pass', () => {
    const play = unrollRepeats(chartOf('C4 |: D4 | E4 :| F4 |]'));
    expect(writtenNotes(play, [3])).toEqual([1]);
    expect(writtenNotes(play, [5])).toEqual([3]);
  });

  it('a chart without repeats is played as written', () => {
    const chart = chartOf('C4 | D4 |]');
    expect(unrollRepeats(chart).chart).toBe(chart);
  });

  // Covers core_09.AC18.
  it('the staff shows the second pass fresh once it begins (the greying resets)', () => {
    const play = unrollRepeats(chartOf('C4 |: D4 | E4 :| F4 |]'));
    expect(writtenView(play, 4, 2)).toEqual([0, 1, 2, 5]); // first pass, at E
    expect(writtenView(play, 4, 3)).toEqual([0, 3, 4, 5]); // jumped back to |:
    expect(writtenView(play, 4, 6)).toEqual([0, 3, 4, 5]); // done
  });

  // Covers core_09.AC20.
  it('a section that holds a whole repeat keeps it; one that cuts it plays its bars once', () => {
    const chart = chartOf('C4 |: D4 | E4 :| F4 |]');
    expect(sliceChart(chart, 1, 3).repeats).toEqual([{ startBar: 0, endBar: 1 }]);
    expect(unrollRepeats(sliceChart(chart, 2, 3)).chart.notes).toHaveLength(2);
  });
});

describe('slurs across repeats (core_09.AC26)', () => {
  // Covers core_09.AC26.
  it('copies a slur inside a repeated stretch into each pass, shifted like its notes', () => {
    const play = unrollRepeats(chartOf('C4 |: (D E F G) :| A4 |]'));
    expect(play.chart.slurs).toEqual([
      { track: 'rh', voice: 1, startTick: 1920, endTick: 3360 },
      { track: 'rh', voice: 1, startTick: 3840, endTick: 5280 },
    ]);
  });

  // Covers core_09.AC26.
  it('drops a slur that reaches out of the stretch it starts in (defensive)', () => {
    const chart = { ...chartOf('C4 |: D4 | E4 :| F4 |]'), slurs: [{ track: 'rh', voice: 1, startTick: 1920, endTick: 5760 }] };
    expect(unrollRepeats(chart).chart.slurs).toBeUndefined();
  });
});

describe('grace notes in the play chart (core_09.AC31)', () => {
  // Covers core_09.AC31.
  it('copies each grace into every pass of its bar, and leaves the notes as they are', () => {
    const written = chartOf('C4 |: {/g}D4 | E4 :| F4 |]');
    expect(written.graces?.map((g) => g.tick)).toEqual([1920]);
    const play = unrollRepeats(written);
    expect(play.chart.notes.map((n) => n.tick)).toEqual([0, 1920, 3840, 5760, 7680, 9600]);
    expect(play.chart.graces?.map((g) => g.tick)).toEqual([1920, 5760]);
    expect(play.chart.graces?.every((g) => g.slash)).toBe(true);
    expect(play.chart.graces?.every((g) => play.chart.notes.some((n) => n.tick === g.tick))).toBe(true);
    expect(play.chart.notes.map((n) => n.midi)).toEqual([60, 62, 64, 62, 64, 65]);
  });

  // Covers core_09.AC31.
  it('a chart with graces and no repeats is played as written, graces and all', () => {
    const chart = chartOf('{g}C4 | D4 |]');
    expect(unrollRepeats(chart).chart.graces).toEqual(chart.graces);
  });
});

describe('repeat signs on the staff', () => {
  // Covers core_09.AC19.
  it('draws a start at the first repeated bar, also at a line start, and an end at the last one', async () => {
    const { layoutStaff } = await import('../layout/staff');
    const chart = chartOf('C4 |: D4 | E4 :| F4 |]');
    const layout = layoutStaff(chart, { viewport: { width: 1366, height: 768 }, staffSpace: 'auto', barsPerLine: 1 });
    const signs = layout.repeatSigns!;
    expect(signs.map((r) => [r.system, r.side])).toEqual([[1, 'start'], [2, 'end']]);
    expect(signs[0]!.x).toBe(layout.bars[1]!.x);
    expect(signs[1]!.x).toBe(layout.bars[2]!.x + layout.bars[2]!.width);
    expect(signs[0]!.dotYs).toHaveLength(2);
  });
});

describe('first and second endings (core_09.AC45, core_09.AC46)', () => {
  const ENDINGS = 'C4 |: D4 | E4 |1 F4 :|2 G4 |] ';
  it('core_09.AC45 the compiled chart keeps the repeat with its endings; the schema refuses endings out of order or outside the repeat', () => {
    const chart = chartOf(ENDINGS);
    expect(chart.repeats).toEqual([{ startBar: 1, endBar: 3, endings: { first: { startBar: 3, endBar: 3 }, second: { startBar: 4, endBar: 4 } } }]);
    const bad = (endings: object) => chartSchema.safeParse({ ...chart, repeats: [{ startBar: 1, endBar: 3, endings }] }).success;
    expect(bad({ first: { startBar: 3, endBar: 3 }, second: { startBar: 4, endBar: 4 } })).toBe(true);
    expect(bad({ first: { startBar: 0, endBar: 3 }, second: { startBar: 4, endBar: 4 } })).toBe(false); // starts before the repeat
    expect(bad({ first: { startBar: 3, endBar: 2 }, second: { startBar: 4, endBar: 4 } })).toBe(false); // first does not end at :|
    expect(bad({ first: { startBar: 3, endBar: 3 }, second: { startBar: 5, endBar: 5 } })).toBe(false); // second not right after
    expect(bad({ first: { startBar: 3, endBar: 3 }, second: { startBar: 4, endBar: 9 } })).toBe(false); // past the last bar
  });

  it('core_09.AC46 plays the first ending on the first pass, and the second ending in its place on the second', () => {
    const play = unrollRepeats(chartOf(ENDINGS));
    expect(play.chart.notes.map((n) => n.spelling.step)).toEqual(['C', 'D', 'E', 'F', 'D', 'E', 'G']);
    expect(play.writtenNote).toEqual([0, 1, 2, 3, 1, 2, 4]);
    expect(play.writtenBar).toEqual([0, 1, 2, 3, 1, 2, 4]);
    expect(play.chart.notes.map((n) => n.tick)).toEqual([0, 1, 2, 3, 4, 5, 6].map((b) => b * 1920));
    expect(play.chart.repeats).toBeUndefined();
    // the staff shows the second pass fresh once it begins
    expect(writtenView(play, 5, 4)).toEqual([0, 4, 5, 3, 6]);
  });

  it('core_09.AC46 a first ending of the whole repeat plays the second ending straight after the jump; music after the second ending follows once', () => {
    const play = unrollRepeats(chartOf('|: C4 |1 D4 | E4 :|2 F4 || G4 |]'));
    expect(play.chart.notes.map((n) => n.spelling.step)).toEqual(['C', 'D', 'E', 'C', 'F', 'G']);
  });

  it('core_09.AC48 a section that holds the repeat and both endings keeps them; one that cuts an ending plays its written bars once', () => {
    const chart = chartOf(ENDINGS);
    expect(sliceChart(chart, 1, 4).repeats).toEqual([{ startBar: 0, endBar: 2, endings: { first: { startBar: 2, endBar: 2 }, second: { startBar: 3, endBar: 3 } } }]);
    expect(sliceChart(chart, 1, 3).repeats).toEqual([]);
    expect(unrollRepeats(sliceChart(chart, 1, 3)).chart.notes.map((n) => n.spelling.step)).toEqual(['D', 'E', 'F']);
  });
});
