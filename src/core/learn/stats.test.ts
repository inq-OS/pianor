// Covers ft_1_32.AC9, ft_1_32.AC10.
import { describe, expect, it } from 'vitest';
import type { LearnTest } from './progress';
import { barProfile, filterTests, focusHints, measureSeries, seriesTrend, TREND_MIN_RUNS } from './stats';

const run = (over: Partial<LearnTest> = {}): LearnTest => ({ day: '1998-11-22', step: 4, bpm: 60, sd: 8, mad: 6, drift: 0, halts: 0, steady: true, kind: 'confirm', ...over });

describe('filterTests', () => {
  const tests = [run({ day: '1998-11-10' }), run({ day: '1998-11-16', kind: 'join' }), run({ day: '1998-11-22', kind: 'whole' }), run({ day: '1998-11-22' })];

  it('lets every run through by default, in order', () => {
    expect(filterTests(tests, { kind: 'all', days: 'all' }, '1998-11-22')).toEqual(tests);
  });

  it('keeps one kind of test', () => {
    expect(filterTests(tests, { kind: 'join', days: 'all' }, '1998-11-22')).toEqual([tests[1]]);
    expect(filterTests(tests, { kind: 'confirm', days: 'all' }, '1998-11-22')).toEqual([tests[0], tests[3]]);
  });

  it('keeps the last seven days, today among them, or today alone', () => {
    expect(filterTests(tests, { kind: 'all', days: 'week' }, '1998-11-22')).toEqual(tests.slice(1));
    expect(filterTests(tests, { kind: 'all', days: 'today' }, '1998-11-22')).toEqual(tests.slice(2));
  });

  it('shows a record kept before the kind was written only under every test', () => {
    const old = run();
    delete old.kind;
    expect(filterTests([old], { kind: 'all', days: 'all' }, '1998-11-22')).toHaveLength(1);
    expect(filterTests([old], { kind: 'confirm', days: 'all' }, '1998-11-22')).toHaveLength(0);
  });
});

describe('measureSeries', () => {
  it('gives the pace with a whisker of one standard deviation of the run in BPM', () => {
    expect(measureSeries([run({ bpm: 60, sd: 25, steady: false })], 'bpm')).toEqual([{ value: 60, reach: 15, steady: false, day: '1998-11-22' }]);
  });

  it('gives each of the other measures as kept', () => {
    const test = run({ sd: 12, mad: 9, drift: -4, halts: 2 });
    expect((['sd', 'mad', 'drift', 'halts'] as const).map((measure) => measureSeries([test], measure)[0]!.value)).toEqual([12, 9, -4, 2]);
  });

  it('gives the right hand as the value and the left as the other; none for a one-hand run', () => {
    expect(measureSeries([run({ hands: { RH: 7, LH: 19 } }), run()], 'hands').map(({ value, other }) => ({ value, other }))).toEqual([{ value: 7, other: 19 }, { value: null, other: null }]);
  });
});

describe('seriesTrend', () => {
  it('needs a few runs', () => {
    expect(seriesTrend(Array.from({ length: TREND_MIN_RUNS - 1 }, (_, i) => i))).toBeNull();
  });

  it('is the line through the runs, and a run with a stop does not bend it', () => {
    expect(seriesTrend([30, 26, 90, 18, 14])).toEqual({ first: 30, last: 14, perRun: -4 });
  });

  it('skips the runs with no value', () => {
    expect(seriesTrend([10, null, 14, 16, 18])).toMatchObject({ perRun: 2, first: 10, last: 18 });
  });
});

describe('barProfile', () => {
  it('gives the middle pace of each bar over the runs that measured it, by the piece\'s bars', () => {
    const tests = [run({ firstBar: 0, bars: [100, 140] }), run({ firstBar: 0, bars: [104, 160] }), run({ firstBar: 2, bars: [100, 0] })];
    expect(barProfile(tests)).toEqual([{ bar: 0, pace: 102, runs: 2 }, { bar: 1, pace: 150, runs: 2 }, { bar: 2, pace: 100, runs: 1 }]);
  });

  it('is empty for records kept before the bars were', () => {
    expect(barProfile([run()])).toEqual([]);
  });
});

describe('focusHints (ft_1_32.AC10)', () => {
  it('has nothing to say before the first run', () => {
    expect(focusHints([])).toEqual([]);
  });

  it('says the playing is even, with its tempo, when nothing shows', () => {
    expect(focusHints([run({ bpm: 58 }), run({ bpm: 60 }), run({ bpm: 62 })])).toEqual([{ kind: 'steady', bpm: 60 }]);
  });

  it('names the stops first, with the slowest bar when one is clearly slow', () => {
    const hints = focusHints([run({ halts: 2, firstBar: 4, bars: [100, 100, 210, 100] }), run({ halts: 1, firstBar: 4, bars: [100, 100, 170, 100] })]);
    expect(hints[0]).toEqual({ kind: 'stops', halts: 3, bar: 6 });
  });

  it('names a slow bar without a stop', () => {
    expect(focusHints([run({ firstBar: 0, bars: [100, 140] })])).toEqual([{ kind: 'slowBar', bar: 1, pace: 140 }]);
  });

  it('names rushing and slowing down by the middle drift of the latest runs', () => {
    expect(focusHints([run({ drift: 14 }), run({ drift: 12 }), run({ drift: 2 })])).toEqual([{ kind: 'rushing', drift: 12 }]);
    expect(focusHints([run({ drift: -20 })])).toEqual([{ kind: 'slowing', drift: 20 }]);
  });

  it('names the hand that wobbles clearly more', () => {
    expect(focusHints([run({ hands: { RH: 6, LH: 18 } })])).toEqual([{ kind: 'hand', hand: 'LH', spread: 18, other: 6 }]);
    expect(focusHints([run({ hands: { RH: 9, LH: 6 } })])).toEqual([{ kind: 'steady', bpm: 60 }]);
  });

  it('names uneven playing and a tempo that differs from test to test', () => {
    expect(focusHints([run({ mad: 22 })])).toEqual([{ kind: 'uneven', spread: 22 }]);
    expect(focusHints([run({ bpm: 52 }), run({ bpm: 70 })])).toEqual([{ kind: 'tempoVaries', from: 52, to: 70 }]);
  });

  it('looks at the latest three runs only, and says at most three things', () => {
    const old = run({ halts: 5 });
    expect(focusHints([old, run(), run(), run()])).toEqual([{ kind: 'steady', bpm: 60 }]);
    const bad = run({ halts: 1, drift: 20, mad: 30, hands: { RH: 5, LH: 30 }, steady: false });
    expect(focusHints([bad]).map((hint) => hint.kind)).toEqual(['stops', 'rushing', 'hand']);
  });
});
