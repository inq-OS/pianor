// Covers core_01.AC3.
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import littleSteps from '../../../tests/fixtures/charts/little-steps.v2.json';
import { chartSchema } from '../chart';
import { DEFAULT_TEMPO_WINDOWS, timingOf } from '../judge/timing';
import { playheadAt } from './playhead';
import { SCORE_COLOURS, mixColour, scoreColour } from './scoreColour';
import { compilePiece } from '../piece/compile';
import { layoutStaff } from './staff';

const chart = chartSchema.parse(littleSteps); // four bars of 4/4
const wide = layoutStaff(chart, { viewport: { width: 1366, height: 600 } });
const paged = layoutStaff(chart, { viewport: { width: 700, height: 300 }, barsPerLine: 2, linesPerPage: 1 });

describe('playheadAt', () => {
  const S = wide.staffSpace;

  it('glides at one speed across the bar lines of a line: no jump where a bar ends', () => {
    const bars = wide.bars.filter((b) => b.system === wide.bars[0]!.system);
    expect(bars.length).toBeGreaterThan(1);
    const perTick = bars[0]!.width / (chart.bars[0]!.endTick - chart.bars[0]!.startTick);
    for (let i = 0; i + 1 < bars.length; i++) {
      const end = chart.bars[i]!.endTick;
      const before = playheadAt(wide, chart, end - 1).x;
      const after = playheadAt(wide, chart, end).x;
      expect(after - before).toBeCloseTo(perTick, 6);
      expect(playheadAt(wide, chart, end - 480).x).toBeCloseTo(after - 480 * perTick, 6);
    }
  });

  it('stays within a note head of every note it reaches, so the student can play when the line touches the note', () => {
    // A note that fills its bar is centred in it (a whole note in 4/4), not placed by time: the line meets it on the way.
    const timed = wide.notes.filter((n) => {
      const bar = chart.bars[n.bar]!;
      return chart.notes[n.index]!.dur !== bar.endTick - bar.startTick;
    });
    expect(timed.length).toBe(10);
    for (const note of timed) {
      const tick = chart.notes[note.index]!.tick;
      const distance = Math.abs(playheadAt(wide, chart, tick).x - note.column);
      expect(distance).toBeLessThanOrEqual(1.6 * S + 1e-9);
      // On a beat of 4/4 (the notes of a beginner's piece) it is at most one staff space off.
      if ((tick - chart.bars[note.bar]!.startTick) % 480 === 0) expect(distance).toBeLessThanOrEqual(1.0 * S + 1e-9);
    }
  });

  it('waits where the piece starts in the count-in, and at the final bar line after the piece', () => {
    expect(playheadAt(wide, chart, -1920).x).toBeCloseTo(playheadAt(wide, chart, 0).x, 6);
    const lastBar = wide.bars[3]!;
    expect(playheadAt(wide, chart, 99999).x).toBeCloseTo(lastBar.x + lastBar.width, 6);
    expect(playheadAt(wide, chart, 99999).system).toBe(lastBar.system);
  });

  it('never runs past the last bar line of its line', () => {
    for (const layout of [wide, paged]) {
      for (let tick = 0; tick < chart.bars[chart.bars.length - 1]!.endTick + 960; tick += 10) {
        const head = playheadAt(layout, chart, tick);
        const ends = layout.bars.filter((b) => b.system === head.system).map((b) => b.x + b.width);
        expect(head.x).toBeLessThanOrEqual(Math.max(...ends) + 1e-9);
      }
    }
  });

  it('spans the height of its line, and reports the page of its line', () => {
    const head = playheadAt(paged, chart, chart.bars[2]!.startTick + 100);
    expect(head.page).toBe(1);
    expect(head.system).toBe(1);
    expect(head.y1).toBeLessThan(paged.systems[1]!.topLineY);
    expect(head.y2).toBeGreaterThan(paged.systems[1]!.bottomLineY);
    expect(playheadAt(paged, chart, 0).page).toBe(0);
  });

  it('only ever moves right inside a line, and never backwards between lines', () => {
    fc.assert(
      fc.property(fc.integer({ min: -2000, max: 9000 }), fc.integer({ min: 0, max: 400 }), (tick, step) => {
        const a = playheadAt(paged, chart, tick);
        const b = playheadAt(paged, chart, tick + step);
        if (a.system === b.system) expect(b.x).toBeGreaterThanOrEqual(a.x - 1e-9);
        else expect(b.system).toBeGreaterThan(a.system);
      }),
    );
  });
});

describe('scoreColour', () => {
  const w = DEFAULT_TEMPO_WINDOWS;

  it('has no colour for a note that is not decided yet and red for a missed one', () => {
    expect(scoreColour(null, false)).toBeNull();
    expect(scoreColour(null, true)).toBe(SCORE_COLOURS.missed);
  });

  it('is black for a dead-on note and fades to grey at the edge of on time', () => {
    expect(scoreColour(timingOf(0), false)).toBe(SCORE_COLOURS.good);
    expect(scoreColour(timingOf(w.goodMs), false)).toBe(SCORE_COLOURS.goodFaded);
    const half = scoreColour(timingOf(w.goodMs / 2), false)!;
    expect(half).toBe(mixColour(SCORE_COLOURS.good, SCORE_COLOURS.goodFaded, 0.5));
  });

  it('is yellow just past on time and orange at the edge of the playing window, early or late alike', () => {
    expect(scoreColour(timingOf(w.goodMs + 1), false)).toBe(mixColour(SCORE_COLOURS.mistimed, SCORE_COLOURS.mistimedWorst, 1 / (w.windowMs - w.goodMs)));
    expect(scoreColour(timingOf(w.windowMs), false)).toBe(SCORE_COLOURS.mistimedWorst);
    expect(scoreColour(timingOf(-250), false)).toBe(scoreColour(timingOf(250), false));
  });

  it('mixes channel by channel and clamps', () => {
    expect(mixColour(0x000000, 0xffffff, 0)).toBe(0x000000);
    expect(mixColour(0x000000, 0xffffff, 1)).toBe(0xffffff);
    expect(mixColour(0x102030, 0x304050, 0.5)).toBe(0x203040);
    expect(mixColour(0x102030, 0x304050, 7)).toBe(0x304050);
    expect(mixColour(0x102030, 0x304050, -3)).toBe(0x102030);
  });
});

describe('playheadAt: a piece that starts with a pick-up (d120)', () => {
  const META = JSON.stringify({ id: 'up', title: 'Up', level: 1, status: 'draft', hands: ['RH'], phrases: [], source: 'test', license: 'CC0-1.0', generator: { kind: 'hand' } });
  const up = compilePiece({ abc: 'X:1\nT:Up\nM:4/4\nL:1/4\nQ:1/4=100\nK:C\nG | C D E F | G3 |]', meta: META }).chart!;
  const layout = layoutStaff(up, { viewport: { width: 1366, height: 600 } });

  it('core_09.AC24 crosses the pick-up at the speed of the piece: no faster than a whole bar, and no jump into bar 1', () => {
    const perTick = (from: number, to: number) => (playheadAt(layout, up, to).x - playheadAt(layout, up, from).x) / (to - from);
    const bar1 = up.bars[1]!.startTick;
    expect(bar1).toBe(480);
    // (half a beat: at a line's end the playhead waits at the bar line)
    expect(perTick(0, 240)).toBeCloseTo(perTick(bar1, bar1 + 240), 6);
    expect(playheadAt(layout, up, bar1).x - playheadAt(layout, up, bar1 - 1).x).toBeCloseTo(perTick(bar1, bar1 + 1), 6);
    // the last bar, which holds the rest of the pick-up's bar, too
    const last = up.bars[2]!;
    expect(perTick(last.startTick, last.startTick + 960)).toBeCloseTo(perTick(bar1, bar1 + 240), 6);
  });

  it('core_09.AC24 waits at the start of the pick-up during the count-in', () => {
    expect(playheadAt(layout, up, -2000).x).toBeCloseTo(playheadAt(layout, up, 0).x, 6);
  });
});
