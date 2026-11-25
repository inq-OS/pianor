// Covers core_01.AC1, core_02.AC2, core_03.AC2.
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import littleSteps from '../../../tests/fixtures/charts/little-steps.v2.json';
import { chartWith, graceAt } from '../../../tests/helpers/charts';
import { chartSchema, type Chart } from '../chart';
import { compilePiece } from '../piece/compile';
import { Transport, metronomeFor } from './transport';

const chart = chartSchema.parse(littleSteps); // 4/4 at 70 bpm

describe('Transport: before the start', () => {
  const transport = new Transport(chart);

  it('knows nothing about time yet', () => {
    expect(transport.started).toBe(false);
    expect(transport.songStartMs).toBeNull();
    expect(transport.timeOfTick(0)).toBeNull();
    expect(transport.tickAt(1000)).toBeNull();
    expect(transport.countIn(1000)).toBeNull();
    expect(transport.metronome()).toBeNull();
  });
});

describe('Transport: the count-in', () => {
  it('counts one bar before tick 0: at 70 bpm in 4/4 that is four beats of 857 ms', () => {
    const transport = new Transport(chart);
    expect(transport.start(1000)).toBe(true);
    expect(transport.countInMs).toBeCloseTo((4 * 60000) / 70, 6);
    expect(transport.songStartMs).toBeCloseTo(1000 + (4 * 60000) / 70, 6);
    expect(transport.timeOfTick(0)).toBe(transport.songStartMs);
  });

  it('reports which beat of the count-in it is, and nothing once the song runs', () => {
    const transport = new Transport(chart);
    transport.start(0);
    const beat = 60000 / 70;
    expect(transport.countIn(0)).toEqual({ beat: 0, beats: 4, inBar: 0 });
    expect(transport.countIn(beat * 2.5)).toEqual({ beat: 2, beats: 4, inBar: 2 });
    expect(transport.countIn(beat * 3.99)).toEqual({ beat: 3, beats: 4, inBar: 3 });
    expect(transport.countIn(beat * 4)).toBeNull();
    expect(transport.countIn(-10)).toBeNull();
  });

  it('can count in more bars, or none', () => {
    const two = new Transport(chart, { countInBars: 2 });
    two.start(0);
    expect(two.countInMs).toBeCloseTo((8 * 60000) / 70, 6);
    const none = new Transport(chart, { countInBars: 0 });
    none.start(500);
    expect(none.songStartMs).toBe(500);
  });

  it('core_01.AC10 starts so that a given tick falls at a given time (the first note, with no count-in)', () => {
    const none = new Transport(chart, { countInBars: 0, tempoPercent: 50 });
    expect(none.startAtTick(480, 10_000)).toBe(true);
    expect(none.timeOfTick(480)).toBeCloseTo(10_000, 6);
    expect(none.songStartMs).toBeCloseTo(10_000 - (2 * 60000) / 70, 6);
    expect(none.startAtTick(0, 0)).toBe(false);
    const counted = new Transport(chart);
    counted.startAtTick(0, 5000);
    expect(counted.timeOfTick(0)).toBeCloseTo(5000, 6);
  });

  it('starts once: a second start is ignored until a reset', () => {
    const transport = new Transport(chart);
    expect(transport.start(100)).toBe(true);
    const at = transport.songStartMs;
    expect(transport.start(900)).toBe(false);
    expect(transport.songStartMs).toBe(at);
    transport.reset();
    expect(transport.started).toBe(false);
    expect(transport.start(900)).toBe(true);
  });
});

describe('Transport: tempo percent', () => {
  it('plays at half speed with every distance doubled', () => {
    const full = new Transport(chart);
    const half = new Transport(chart, { tempoPercent: 50 });
    full.start(0);
    half.start(0);
    expect(half.countInMs).toBeCloseTo(full.countInMs * 2, 6);
    const spanFull = full.timeOfTick(1920)! - full.timeOfTick(0)!;
    const spanHalf = half.timeOfTick(1920)! - half.timeOfTick(0)!;
    expect(spanHalf).toBeCloseTo(spanFull * 2, 6);
  });

  it('plays faster than the original above 100', () => {
    const fast = new Transport(chart, { tempoPercent: 125 });
    fast.start(0);
    expect(fast.timeOfTick(480)! - fast.timeOfTick(0)!).toBeCloseTo((60000 / 70) / 1.25, 6);
    expect(fast.metronome()!.bpm).toBeCloseTo(70 * 1.25, 6);
  });

  it('refuses a tempo that is not a positive number', () => {
    expect(() => new Transport(chart, { tempoPercent: 0 })).toThrow();
    expect(() => new Transport(chart, { tempoPercent: Number.NaN })).toThrow();
  });
});

describe('Transport: the metronome', () => {
  it('starts with the count-in bar, at the tempo of the piece and its beats per bar', () => {
    const transport = new Transport(chart);
    transport.start(250);
    expect(transport.metronome()).toEqual({ bpm: 70, beatsPerBar: 4, startAtMs: 250 });
  });

  it('counts three quarter beats in a 3/4 bar', () => {
    const waltz = { ...chart, meterMap: [{ tick: 0, num: 3, den: 4 }], bars: chart.bars.map((b, i) => ({ index: i, startTick: i * 1440, endTick: (i + 1) * 1440 })) };
    const transport = new Transport(waltz);
    transport.start(0);
    expect(transport.metronome()!.beatsPerBar).toBe(3);
    expect(transport.countInMs).toBeCloseTo((3 * 60000) / 70, 6);
  });
});

describe('Transport: tick and clock time are inverses', () => {
  it('maps a clock time to the tick under it, also during the count-in (negative ticks)', () => {
    const transport = new Transport(chart);
    transport.start(0);
    expect(transport.tickAt(transport.songStartMs!)).toBe(0);
    expect(transport.tickAt(transport.songStartMs! - 60000 / 70)).toBe(-480);
    expect(transport.tickAt(transport.timeOfTick(960)!)).toBe(960);
  });

  it('round-trips for any tick and tempo percent', () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 7680 }), fc.integer({ min: 20, max: 200 }), fc.integer({ min: 0, max: 5000 }), (tick, percent, startMs) => {
        const transport = new Transport(chart, { tempoPercent: percent });
        transport.start(startMs);
        expect(transport.tickAt(transport.timeOfTick(tick)!)).toBeCloseTo(tick, 6);
      }),
    );
  });
});

describe('metronomeFor and nextClickMs', () => {
  it('gives the clicks of a chart at a tempo percent, without a start', () => {
    expect(metronomeFor(chart)).toEqual({ bpm: 70, beatsPerBar: 4 });
    expect(metronomeFor(chart, 50)).toEqual({ bpm: 35, beatsPerBar: 4 });
  });

  it('core_09.AC22 counts the beats of a whole bar, not of a short pick-up, and counts in whole bars', () => {
    const pickup = { ...chart, bars: [{ index: 0, startTick: 0, endTick: 480 }, ...chart.bars.slice(1).map((b) => ({ ...b, startTick: b.startTick - 1440, endTick: b.endTick - 1440 }))] };
    expect(metronomeFor(pickup).beatsPerBar).toBe(4);
    const transport = new Transport(pickup);
    transport.start(1000);
    // one whole bar counted in, plus the three beats the pick-up lacks (core_09.AC23)
    expect(transport.tickAt(1000)).toBe(-1920 - 1440);
  });

  it('finds the next click on the beat grid of the count-in, for a click switched on later', () => {
    const transport = new Transport(chart);
    expect(transport.nextClickMs(0)).toBeNull();
    transport.start(1000);
    const beat = 60000 / 70;
    expect(transport.nextClickMs(500)).toBe(1000);
    expect(transport.nextClickMs(1000)).toBe(1000);
    expect(transport.nextClickMs(1000 + beat * 2.2)).toBeCloseTo(1000 + beat * 3, 6);
  });
});

describe('Transport: a click that joins later', () => {
  it('core_01.AC10 starts on the next beat of the grid and numbers it, so the bar\'s first beat stays accented', () => {
    const transport = new Transport(chart, { countInBars: 0 });
    expect(transport.metronomeFrom(0)).toBeNull();
    const beat = 60000 / 70;
    transport.start(1000);
    expect(transport.metronomeFrom(1000)).toMatchObject({ startAtMs: 1000, bpm: 70, beatsPerBar: 4 });
    expect(transport.metronomeFrom(1000)!.firstBeat).toBeUndefined();
    const later = transport.metronomeFrom(1001)!;
    expect(later.startAtMs).toBeCloseTo(1000 + beat, 6);
    expect(later.firstBeat).toBe(1);
  });
});

describe('Transport: the end of the chart', () => {
  it('is where the last bar ends on the clock, null before the start; with no count-in a looped lap starts there', () => {
    const transport = new Transport(chart, { countInBars: 0 });
    expect(transport.endMs).toBeNull();
    transport.start(1000);
    const lastBar = chart.bars[chart.bars.length - 1]!;
    expect(transport.endMs).toBe(transport.timeOfTick(lastBar.endTick));
    expect(transport.songStartMs).toBe(1000);
    const next = new Transport(chart, { countInBars: 0 });
    next.start(transport.endMs!);
    expect(next.tickAt(transport.endMs!)).toBe(0);
  });
});

describe('Transport: a click for the count-in only (a level-3 tug)', () => {
  it('the plan stops after the count-in beats', () => {
    const transport = new Transport(chart);
    transport.start(250);
    expect(transport.metronome({ countInOnly: true })).toEqual({ bpm: 70, beatsPerBar: 4, startAtMs: 250, beats: 4 });
    expect(transport.metronome()).toEqual({ bpm: 70, beatsPerBar: 4, startAtMs: 250 });
  });

  it('two bars counted in click eight beats', () => {
    const transport = new Transport(chart, { countInBars: 2 });
    transport.start(0);
    expect(transport.metronome({ countInOnly: true })!.beats).toBe(8);
  });
});

describe('Transport: a grace note on the first note is part of the count-in (core_09.AC34, d121)', () => {
  it('core_09.AC61 a grace group on the first note shares the last count-in beat out in its written order', () => {
    const transport = new Transport(chartWith([{ tick: 0, dur: 480, midi: 60 }, { tick: 480, dur: 480, midi: 64 }], { graces: [graceAt(0, 64), graceAt(0, 62)] }));
    transport.start(1000);
    expect(transport.countInGraces()).toEqual([{ midi: 64, atMs: 2500, endMs: 2750 }, { midi: 62, atMs: 2750, endMs: 3000 }]);
  });

  // 4/4 at 120 bpm: a beat is 500 ms; C first, with a grace D (62)
  const first = (graces: unknown[], extra: Record<string, unknown> = {}) =>
    chartWith([{ tick: 0, dur: 480, midi: 60 }, { tick: 480, dur: 480, midi: 64 }], { graces, ...extra });

  // Covers core_09.AC34.
  it('core_09.AC34 in 4/4 the count-in is tick, tick, tick, grace: the grace sounds on the last beat and ends at bar 1', () => {
    const transport = new Transport(first([graceAt(0, 62)]));
    expect(transport.countInGraces()).toEqual([]); // not started
    transport.start(1000);
    expect(transport.songStartMs).toBe(3000); // the count-in keeps its four beats
    expect(transport.countInGraces()).toEqual([{ midi: 62, atMs: 2500, endMs: 3000 }]);
    expect(transport.countIn(2600)).toEqual({ beat: 3, beats: 4, inBar: 3 });
  });

  it('core_09.AC34 the metronome agrees: it clicks the first three beats and leaves the last one to the grace', () => {
    const transport = new Transport(first([graceAt(0, 62)]));
    transport.start(1000);
    expect(transport.metronome()).toEqual({ bpm: 120, beatsPerBar: 4, startAtMs: 1000, silentAtMs: [2500] });
    expect(transport.metronome({ countInOnly: true })).toEqual({ bpm: 120, beatsPerBar: 4, startAtMs: 1000, beats: 4, silentAtMs: [2500] });
  });

  it('core_09.AC34 in 3/4, at another tempo percent and with two count-in bars it is still the last beat before bar 1', () => {
    const waltz = first([graceAt(0, 62)], { meterMap: [{ tick: 0, num: 3, den: 4 }], bars: [{ index: 0, startTick: 0, endTick: 1440 }] });
    const three = new Transport(waltz);
    three.start(0);
    expect(three.countInGraces()).toEqual([{ midi: 62, atMs: 1000, endMs: 1500 }]);
    const half = new Transport(first([graceAt(0, 62)]), { tempoPercent: 50, countInBars: 2 });
    half.start(0);
    expect(half.songStartMs).toBe(8000);
    expect(half.countInGraces()).toEqual([{ midi: 62, atMs: 7000, endMs: 8000 }]);
    expect(half.metronome()!.silentAtMs).toEqual([7000]);
  });

  it('core_09.AC34 nothing changes with no count-in, no grace on the first note, or a grace on a later note only', () => {
    const none = new Transport(first([graceAt(0, 62)]), { countInBars: 0 });
    none.start(0);
    expect(none.countInGraces()).toEqual([]);
    expect(none.metronome()).not.toHaveProperty('silentAtMs');
    const later = new Transport(first([graceAt(480, 65)]));
    later.start(0);
    expect(later.countInGraces()).toEqual([]);
    expect(later.metronome()).toEqual({ bpm: 120, beatsPerBar: 4, startAtMs: 0 });
  });
});


/** A 4/4 piece at 100 bpm (a beat of 600 ms) whose first bar is a pick-up of `pickup` (ABC, L:1/8). */
function pickupPiece(pickup: string, last: string): Chart {
  const abc = `X:1\nT:Up\nM:4/4\nL:1/8\nQ:1/4=100\nK:C\n${pickup} | C2 D2 E2 F2 | ${last} |]`;
  const meta = JSON.stringify({ id: 'up', title: 'Up', level: 1, status: 'draft', hands: ['RH'], phrases: [], source: 'test', license: 'CC0-1.0', generator: { kind: 'hand' } });
  const out = compilePiece({ abc, meta });
  expect(out.diagnostics.filter((d) => d.severity === 'error')).toEqual([]);
  return out.chart!;
}

describe('Transport: a piece that starts with a pick-up (d120)', () => {
  const beat = 600;
  const oneBeat = pickupPiece('G2', 'G6');

  it('core_09.AC23 counts in from a downbeat: a whole bar plus the beats the pick-up lacks, so a one-beat pick-up in 4/4 falls on beat 4', () => {
    const transport = new Transport(oneBeat);
    transport.start(1000);
    expect(transport.countInMs).toBeCloseTo(7 * beat, 6);
    expect(transport.timeOfTick(0)).toBeCloseTo(1000 + 7 * beat, 6);
    // counted 1 2 3 4 | 1 2 3, and the pick-up is the fourth beat of the second bar of the count
    expect(transport.countIn(1000)).toEqual({ beat: 0, beats: 7, inBar: 0 });
    expect(transport.countIn(1000 + 4.5 * beat)).toEqual({ beat: 4, beats: 7, inBar: 0 });
    expect(transport.countIn(1000 + 6.9 * beat)).toEqual({ beat: 6, beats: 7, inBar: 2 });
    expect(transport.countIn(1000 + 7 * beat)).toBeNull();
  });

  it('core_09.AC23 the metronome starts on that downbeat, so beat 1 of every full bar is the accented one', () => {
    const transport = new Transport(oneBeat);
    transport.start(1000);
    const plan = transport.metronome()!;
    expect(plan).toMatchObject({ startAtMs: 1000, beatsPerBar: 4, bpm: 100 });
    expect(transport.metronome({ countInOnly: true })!.beats).toBe(7);
    // bar 1 (the first full bar) starts on click 8: the first click of a bar, the accented one
    const clickOfBar1 = (transport.timeOfTick(oneBeat.bars[1]!.startTick)! - plan.startAtMs) / beat;
    expect(clickOfBar1).toBeCloseTo(8, 6);
    expect(Math.round(clickOfBar1) % plan.beatsPerBar).toBe(0);
  });

  it('core_09.AC23 two bars counted in are two whole bars plus the missing beats', () => {
    const transport = new Transport(oneBeat, { countInBars: 2 });
    transport.start(0);
    expect(transport.countInMs).toBeCloseTo(11 * beat, 6);
    expect(transport.countIn(10 * beat)).toEqual({ beat: 10, beats: 11, inBar: 2 });
  });

  it('core_09.AC23 a pick-up of half a beat is counted in with the clicks before it; the last click is the beat it starts in', () => {
    const transport = new Transport(pickupPiece('G', 'G7'));
    transport.start(0);
    expect(transport.countInMs).toBeCloseTo(7.5 * beat, 6);
    expect(transport.metronome({ countInOnly: true })!.beats).toBe(8);
    expect(transport.countIn(7.2 * beat)).toEqual({ beat: 7, beats: 8, inBar: 3 });
  });

  it('core_09.AC23 with no count-in (a start on the first note, a looped lap) the click grid still has its bar line before the pick-up', () => {
    const transport = new Transport(oneBeat, { countInBars: 0 });
    transport.startAtTick(0, 5000);
    expect(transport.timeOfTick(0)).toBe(5000);
    expect(transport.countIn(5000)).toBeNull();
    expect(transport.metronome()!.startAtMs).toBeCloseTo(5000 - 3 * beat, 6);
    // the click joins on the pick-up, the fourth beat of its bar
    expect(transport.metronomeFrom(5000)).toMatchObject({ startAtMs: 5000, firstBeat: 3 });
    expect(transport.metronomeFrom(5001)).toMatchObject({ firstBeat: 4 });
  });

  it('a piece with no pick-up counts in as before', () => {
    const transport = new Transport(chart);
    transport.start(0);
    expect(transport.countIn(0)).toEqual({ beat: 0, beats: 4, inBar: 0 });
    expect(transport.metronome()!.startAtMs).toBe(0);
  });
});

describe('Transport: the following clock (core_01.AC12)', () => {
  it('core_01.AC12 follow pins a tick to a clock time and runs on from there at the rate given', () => {
    const transport = new Transport(chart, { countInBars: 0, tempoPercent: 50 });
    transport.follow(480, 5000); // nothing before the start
    transport.start(1000);
    const beat = (60000 / 70) * 2; // 70 bpm at 50 percent
    expect(transport.rate).toBe(1);
    expect(transport.timeOfTick(480)).toBeCloseTo(1000 + beat, 6);
    transport.follow(480, 5000);
    expect(transport.timeOfTick(480)).toBeCloseTo(5000, 6);
    expect(transport.timeOfTick(960)).toBeCloseTo(5000 + beat, 6);
    expect(transport.timeOfTick(0)).toBeCloseTo(5000 - beat, 6);
    expect(transport.tickAt(5000 + beat / 2)).toBe(720);
    transport.follow(960, 9000, 0.8);
    expect(transport.rate).toBe(0.8);
    expect(transport.timeOfTick(1440)).toBeCloseTo(9000 + beat / 0.8, 6);
    expect(transport.tickAt(9000 + beat / 0.8)).toBe(1440);
    expect(transport.endMs).toBeCloseTo(transport.timeOfTick(chart.bars[chart.bars.length - 1]!.endTick)!, 6);
  });

  it('core_01.AC12 refuses a rate that is not a positive number, and reset forgets the pin', () => {
    const transport = new Transport(chart, { countInBars: 0 });
    transport.start(0);
    expect(() => transport.follow(0, 100, 0)).toThrow();
    expect(() => transport.follow(0, Number.NaN)).toThrow();
    transport.follow(0, 700, 1.1);
    transport.reset();
    transport.start(0);
    expect(transport.rate).toBe(1);
    expect(transport.timeOfTick(0)).toBe(0);
  });

  it('core_01.AC12 tick and clock time stay inverses after a pin', () => {
    fc.assert(fc.property(fc.integer({ min: 0, max: 3000 }), fc.integer({ min: 0, max: 100000 }), fc.double({ min: 0.5, max: 1.5, noNaN: true }), fc.integer({ min: 0, max: 5000 }), (pinTick, atMs, rate, tick) => {
      const transport = new Transport(chart, { countInBars: 0 });
      transport.start(0);
      transport.follow(pinTick, atMs, rate);
      expect(transport.tickAt(transport.timeOfTick(tick)!)).toBeCloseTo(tick, 6);
    }));
  });
});
