// Covers core_13.AC1, core_13.AC5.
import { describe, expect, it } from 'vitest';
import littleSteps from '../../../tests/fixtures/charts/little-steps.v2.json';
import { chartWith } from '../../../tests/helpers/charts';
import { chartSchema } from '../chart';
import { laneDots, laneLift, laneY, PACE_COLOURS, paceColour, waveTick, WAVE_REACH } from './beatLane';
import { layoutStaff } from './staff';

const chart = chartSchema.parse(littleSteps); // four bars of 4/4, one hand: quarters, halves and a whole note
const single = layoutStaff(chart, { viewport: { width: 1366, height: 600 } });
// two hands: a quarter on every beat in the right, a half in the left
const hands = chartWith([
  ...[0, 480, 960, 1440].map((tick, i) => ({ tick, dur: 480, midi: 64 + i })),
  ...[0, 960].map((tick) => ({ tick, dur: 960, midi: 48, track: 'lh' })),
]);
const grand = layoutStaff(hands, { viewport: { width: 1366, height: 700 } });

describe('laneDots', () => {
  it('core_13.AC1 puts a ghost dot every sixteenth, a beat dot on every quarter and a bigger one on each bar\'s first', () => {
    const dots = laneDots(single, chart, 'above');
    const bar = dots.filter((d) => d.tick >= 0 && d.tick < 1920);
    expect(bar).toHaveLength(16);
    expect(bar.filter((d) => d.kind === 'downbeat').map((d) => d.tick)).toEqual([0]);
    expect(bar.filter((d) => d.kind === 'beat').map((d) => d.tick)).toEqual([480, 960, 1440]);
    // left to right within a line, evenly in time
    for (let i = 1; i < bar.length; i++) expect(bar[i]!.x).toBeGreaterThan(bar[i - 1]!.x);
  });

  it('core_13.AC1 stands a note\'s dot under its column, and gives a note off the grid a dot of its own', () => {
    const dots = laneDots(single, chart, 'above');
    for (const glyph of single.notes) {
      const tick = chart.notes[glyph.index]!.tick;
      expect(dots.some((d) => d.note && d.tick === tick && Math.abs(d.x - glyph.column) < 0.01)).toBe(true);
    }
    // the whole note of the last bar is centred in it: its dot stands under it, apart from the bar's first beat
    const whole = single.notes.find((n) => chart.notes[n.index]!.dur === 1920)!;
    expect(dots.filter((d) => d.tick === 5760)).toHaveLength(2);
    expect(dots.find((d) => d.tick === 5760 && d.kind === 'downbeat')!.note).toBe(false);
    expect(dots.find((d) => d.tick === 5760 && d.note)!.x).toBeCloseTo(whole.column);
  });

  it('core_13.AC1 runs above the staff, clear of the notes, or halfway between the two staves', () => {
    const S = single.staffSpace;
    const top = single.systems[0]!.topLineY;
    const above = laneY(single, 0, 'above');
    expect(above).toBeLessThanOrEqual(top - 1.5 * S);
    expect(above).toBeGreaterThan(0); // on the sheet
    for (const n of single.notes.filter((g) => g.system === 0)) expect(above).toBeLessThan(Math.min(n.y - n.headRy, n.stem?.y2 ?? Infinity, n.stem?.y1 ?? Infinity));
    const [rh, lh] = grand.systems[0]!.staves;
    expect(laneY(grand, 0, 'between')).toBeCloseTo((rh!.bottomLineY + lh!.topLineY) / 2);
    // on a single staff there is no between: the lane goes above
    expect(laneY(single, 0, 'between')).toBe(above);
  });

  it('core_13.AC1 is one row for both hands: a chord of the two hands has one dot', () => {
    const dots = laneDots(grand, hands, 'between').filter((d) => d.tick === 0);
    expect(dots).toHaveLength(1);
    expect(dots[0]).toMatchObject({ note: true, kind: 'downbeat' });
  });

  it('has no dots when the lane is off', () => {
    expect(laneDots(single, chart, 'off')).toEqual([]);
  });

  it('counts a pick-up\'s beats back from its end', () => {
    // a bar of one quarter before the first full bar
    const pickup = chartSchema.parse({ ...hands, bars: [{ index: 0, startTick: 0, endTick: 480 }, { index: 1, startTick: 480, endTick: 2400 }], notes: hands.notes.filter((n) => n.track === 'rh').map((n, i) => ({ ...n, tick: i * 480, bar: i === 0 ? 0 : 1 })) });
    const layout = layoutStaff(pickup, { viewport: { width: 1366, height: 600 } });
    const dots = laneDots(layout, pickup, 'above');
    expect(dots.filter((d) => d.tick < 480).map((d) => d.kind)).toEqual(['beat', 'ghost', 'ghost', 'ghost']);
    expect(dots.find((d) => d.tick === 480)!.kind).toBe('downbeat');
  });
});

describe('laneLift', () => {
  it('core_13.AC1 lifts a dot fully at the crest and smoothly less away from it, none half a beat off', () => {
    expect(laneLift(960, 960, 480)).toBe(1);
    expect(laneLift(960, 960 + 120, 480)).toBeCloseTo(0.5);
    expect(laneLift(960, 960 - 120, 480)).toBeCloseTo(0.5);
    expect(laneLift(960, 960 + WAVE_REACH * 480, 480)).toBe(0);
    expect(laneLift(960, null, 480)).toBe(0);
  });
});

describe('waveTick', () => {
  it('core_13.AC5 runs on from the key at the pace and waits at its reach for the next key', () => {
    const anchor = { tick: 960, atMs: 1000 };
    // a quarter a second: 480 ticks a second
    expect(waveTick(anchor, 1000 / 480, 1000, 1920)).toBe(960);
    expect(waveTick(anchor, 1000 / 480, 1500, 1920)).toBeCloseTo(1200);
    expect(waveTick(anchor, 1000 / 480, 9000, 1920)).toBe(960 + 1920);
    expect(waveTick(anchor, 1000 / 480, 500, 1920)).toBe(960);
  });

  it('has no wave before a key or a pace', () => {
    expect(waveTick(null, 2, 0, 1920)).toBeNull();
    expect(waveTick({ tick: 0, atMs: 0 }, null, 0, 1920)).toBeNull();
  });
});

describe('paceColour', () => {
  it('core_13.AC5 colours a key green in step, orange a little off and red far off', () => {
    expect(paceColour({ side: 'even', far: false })).toBe(PACE_COLOURS.even);
    expect(paceColour({ side: 'late', far: false })).toBe(PACE_COLOURS.near);
    expect(paceColour({ side: 'early', far: true })).toBe(PACE_COLOURS.far);
  });
});
