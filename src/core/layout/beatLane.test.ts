// Covers core_13.AC1, core_13.AC5, core_13.AC8.
import { describe, expect, it } from 'vitest';
import littleSteps from '../../../tests/fixtures/charts/little-steps.v2.json';
import { chartWith } from '../../../tests/helpers/charts';
import { chartSchema } from '../chart';
import { defaultLaneLook, dotLook, LANE_LIMITS, LANE_STEPS, laneAt, laneDots, laneLift, laneY, PACE_COLOURS, paceColour, clickWaveTick, waveTick, WAVE_REACH, type LaneDot } from './beatLane';
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
  it('core_13.AC1 puts a ghost dot every thirty-second (a dotted line), a beat dot on every quarter and a bigger one on each bar\'s first', () => {
    const dots = laneDots(single, chart, 'above');
    const bar = dots.filter((d) => d.tick >= 0 && d.tick < 1920);
    expect(bar).toHaveLength(32);
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
    expect(dots.filter((d) => d.tick < 480).map((d) => d.kind)).toEqual(['beat', ...Array<string>(7).fill('ghost')]);
    expect(dots.find((d) => d.tick === 480)!.kind).toBe('downbeat');
  });
});

describe('laneLift', () => {
  it('core_13.AC1 lifts a dot fully at the crest and less away from it as a parabola, none a quarter of a beat off', () => {
    expect(laneLift(960, 960, 480)).toBe(1);
    expect(laneLift(960, 960 + 60, 480)).toBeCloseTo(0.75);
    expect(laneLift(960, 960 - 60, 480)).toBeCloseTo(0.75);
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

describe('laneDots near the notes', () => {
  it('core_13.AC7 keeps a dot that touches a note head, such as middle C between the staves', () => {
    // middle C in the right hand sits between the staves, on the lane
    const middle = chartWith([{ tick: 0, dur: 480, midi: 60 }, { tick: 480, dur: 480, midi: 64 }, { tick: 0, dur: 960, midi: 48, track: 'lh' }]);
    const layout = layoutStaff(middle, { viewport: { width: 1366, height: 700 }, staffGap: 'short' });
    const dots = laneDots(layout, middle, 'between');
    const c = layout.notes.find((n) => middle.notes[n.index]!.midi === 60)!;
    expect(dots.some((d) => d.note && d.tick === 0 && Math.abs(d.x - c.column) < 0.01)).toBe(true);
    expect(dots.filter((d) => d.tick < 1920)).toHaveLength(32);
  });
});

describe('a tuned lane', () => {
  it('core_13.AC8 moves the lane down or up by the staff spaces the player set, never off the sheet', () => {
    const S = grand.staffSpace;
    const at = (offset: number) => laneDots(grand, hands, 'between', offset)[0]!.y;
    expect(at(1) - at(0)).toBeCloseTo(S);
    expect(at(-1) - at(0)).toBeCloseTo(-S);
    expect(at(-100)).toBeGreaterThan(0);
  });

  it('core_13.AC8 knows which staves a note dot stands for', () => {
    const first = laneDots(grand, hands, 'above').find((d) => d.tick === 0)!;
    expect(first.staves).toEqual([0, 1]);
    const second = laneDots(grand, hands, 'above').find((d) => d.tick === 480)!;
    expect(second.staves).toEqual([0]); // the left hand holds its half note
  });

  it('core_13.AC8 draws each kind of dot as strong as the player set it, a hidden one not at all', () => {
    const look = defaultLaneLook();
    const ghost: LaneDot = { system: 0, x: 0, y: 0, tick: 60, kind: 'ghost', note: false, staves: [], grid: true };
    const beat: LaneDot = { ...ghost, tick: 480, kind: 'beat' };
    const bass: LaneDot = { ...beat, note: true, staves: [1] };
    expect(dotLook(ghost, look)).toEqual({ role: 'ghost', strength: 1 });
    const tuned = { ...look, dots: { ghost: 0, beat: 0.5, top: 1, bottom: 0 } };
    expect(dotLook(ghost, tuned).strength).toBe(0);
    expect(dotLook(beat, tuned)).toEqual({ role: 'beat', strength: 0.5 });
    // a bass note hidden: its dot falls back to the beat it stands on
    expect(dotLook(bass, tuned)).toEqual({ role: 'beat', strength: 0.5 });
    expect(dotLook({ ...bass, staves: [0, 1] }, tuned)).toEqual({ role: 'note', strength: 1 });
    // a note off the grid has nothing to fall back to
    expect(dotLook({ ...bass, grid: false, kind: 'ghost' }, tuned).strength).toBe(0);
  });

  it('core_13.AC8 a wider wave reaches further, and one of no width lifts nothing', () => {
    expect(laneLift(960, 960 + 240, 480, 1)).toBeCloseTo(0.75);
    expect(laneLift(960, 960 + 240, 480)).toBe(0);
    expect(laneLift(960, 960, 480, 0)).toBe(0);
  });

  it('core_13.AC8 puts a lane added by a click where the click was, from the nearer of above and between', () => {
    const S = grand.staffSpace;
    const between = laneY(grand, 0, 'between');
    const above = laneY(grand, 0, 'above');
    expect(laneAt(grand, 0, between + 0.6 * S)).toEqual({ place: 'between', offset: 0.5 });
    expect(laneAt(grand, 0, above - 0.3 * S)).toEqual({ place: 'above', offset: -0.25 });
    // never further than the player could move it
    expect(laneAt(grand, 0, between + 100 * S).offset).toBe(LANE_LIMITS.offset);
    // a single staff has only the lane above
    expect(laneAt(single, 0, laneY(single, 0, 'above') + S).place).toBe('above');
  });

  it('core_13.AC8 offers each tuning in steps from the most to the least, every step within the limits', () => {
    expect(LANE_STEPS.strength[0]).toBe(1);
    expect(LANE_STEPS.strength.at(-1)).toBe(0);
    for (const h of LANE_STEPS.height) expect(h).toBeLessThanOrEqual(LANE_LIMITS.height);
    for (const r of LANE_STEPS.reach) expect(r).toBeLessThanOrEqual(LANE_LIMITS.reach);
    expect(LANE_STEPS.height).toContain(defaultLaneLook().wave.height);
    expect(LANE_STEPS.reach).toContain(defaultLaneLook().wave.reach);
  });
});

describe('clickWaveTick', () => {
  // a 4/4 bar from tick 1920, a click at 120 BPM (500 ms a quarter) whose beat 2 (0-based 1) sounded at 10000 ms
  const bar = { startTick: 1920, endTick: 3840 };
  const beat = { beatInBar: 1, atMs: 10000 };

  it('core_13.AC9 stands on the beat dot of the click just heard, in the bar the student is at', () => {
    expect(clickWaveTick(bar, beat, 500, 10000, 480)).toBe(2400);
  });

  it('core_13.AC9 runs on toward the next beat at the click\'s tempo, reaching it as it sounds', () => {
    expect(clickWaveTick(bar, beat, 500, 10250, 480)).toBe(2640);
    expect(clickWaveTick(bar, beat, 500, 10500, 480)).toBe(2880);
  });

  it('core_13.AC9 never runs past the bar, and has no place without a click heard', () => {
    expect(clickWaveTick(bar, { beatInBar: 3, atMs: 10000 }, 500, 11000, 480)).toBe(3840);
    expect(clickWaveTick(bar, null, 500, 10000, 480)).toBeNull();
    expect(clickWaveTick(null, beat, 500, 10000, 480)).toBeNull();
  });
});
