import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import type { BarPlay } from '../progression/practiceLog';
import { DEFAULT_RAMP } from '../transport/tempoRamp';
import { IDEAL, barSeries, playedWell, proposeRamp, proposeStartPercent, sectionPlan, sectionPlays } from './sectionPlan';

const play = (over: Partial<BarPlay> = {}): BarPlay => ({
  at: '1998-10-30T10:00:00.000Z',
  pieceId: 'p1',
  bar: 0,
  notes: 4,
  firstTry: 4,
  timing: null,
  mode: 'wait',
  tempoPercent: 100,
  section: null,
  misses: [],
  ...over,
});

/** A clean play at the given tempo (every note right first time). */
const clean = (tempoPercent: number, over: Partial<BarPlay> = {}): BarPlay => play({ tempoPercent, ...over });
/** A badly played bar at the given tempo (half the notes wrong first time). */
const bad = (tempoPercent: number, over: Partial<BarPlay> = {}): BarPlay => play({ tempoPercent, notes: 4, firstTry: 2, ...over });

const playArb = fc
  .record({
    at: fc.constant('1998-10-30T10:00:00.000Z'),
    pieceId: fc.constant('p1'),
    bar: fc.integer({ min: 0, max: 8 }),
    notes: fc.integer({ min: 0, max: 12 }),
    firstTry: fc.integer({ min: 0, max: 12 }),
    timing: fc.option(fc.integer({ min: 0, max: 100 }), { nil: null }),
    mode: fc.constantFrom('wait' as const, 'tempo' as const),
    tempoPercent: fc.integer({ min: 1, max: 250 }),
    section: fc.constant(null),
    misses: fc.constant([] as BarPlay['misses']),
  })
  .map((p): BarPlay => ({ ...p, firstTry: Math.min(p.firstTry, p.notes) }));

describe('barSeries (core_10.AC7 graph input)', () => {
  it('core_10.AC7 keeps only the plays of that bar, oldest first, with accuracy and tempo', () => {
    const plays = [
      clean(90, { bar: 2, at: 'a' }),
      bad(70, { bar: 3, at: 'x' }),
      play({ bar: 2, notes: 5, firstTry: 3, tempoPercent: 80, mode: 'tempo', timing: 60, at: 'b' }),
    ];
    expect(barSeries(plays, 2)).toEqual([
      { at: 'a', accuracy: 1, tempoPercent: 90, mode: 'wait' },
      { at: 'b', accuracy: 0.6, tempoPercent: 80, mode: 'tempo' },
    ]);
  });

  it('core_10.AC7 a bar with no notes counts as accuracy 1', () => {
    expect(barSeries([play({ bar: 0, notes: 0, firstTry: 0 })], 0)[0]!.accuracy).toBe(1);
  });

  it('core_10.AC7 the ideal point is accuracy 1 at 100 percent', () => {
    expect(IDEAL).toEqual({ accuracy: 1, tempoPercent: 100 });
  });
});

describe('playedWell (core_10.AC7, the rule of content/curriculum/progression.json stats)', () => {
  it('core_10.AC7 needs 90 percent of the notes right first time', () => {
    expect(playedWell(play({ notes: 10, firstTry: 9 }))).toBe(true);
    expect(playedWell(play({ notes: 10, firstTry: 8 }))).toBe(false);
  });

  it('core_10.AC7 needs a timing of 70 or more when there is one', () => {
    expect(playedWell(play({ timing: 70 }))).toBe(true);
    expect(playedWell(play({ timing: 69 }))).toBe(false);
    expect(playedWell(play({ timing: null }))).toBe(true);
  });
});

describe('sectionPlays (core_10.AC7)', () => {
  it('core_10.AC7 keeps the plays whose bar is within first..last, inclusive, in order', () => {
    const plays = [play({ bar: 0, at: 'a' }), play({ bar: 1, at: 'b' }), play({ bar: 3, at: 'c' }), play({ bar: 4, at: 'd' })];
    expect(sectionPlays(plays, 1, 3).map((p) => p.at)).toEqual(['b', 'c']);
  });
});

describe('proposeStartPercent (core_10.AC7)', () => {
  it('core_10.AC7 a section played cleanly at 100 percent proposes 80', () => {
    expect(proposeStartPercent([clean(100, { bar: 1 }), clean(100, { bar: 2 })], 1, 2)).toBe(80);
  });

  it('core_10.AC7 a section never played proposes 80', () => {
    expect(proposeStartPercent([], 0, 3)).toBe(80);
    expect(proposeStartPercent([clean(60, { bar: 9 })], 0, 3)).toBe(80);
  });

  it('core_10.AC7 a section played only badly at 60 percent proposes 40', () => {
    expect(proposeStartPercent([bad(60, { bar: 1 }), bad(60, { bar: 2 })], 1, 2)).toBe(40);
  });

  it('core_10.AC7 starts from the best well-played tempo, 20 below it, rounded to tens', () => {
    expect(proposeStartPercent([clean(90), bad(120)], 0, 0)).toBe(70);
    expect(proposeStartPercent([clean(95)], 0, 0)).toBe(80); // 75 rounds to 80
    expect(proposeStartPercent([clean(84)], 0, 0)).toBe(60); // 64 rounds to 60
    expect(proposeStartPercent([bad(74), bad(64)], 0, 0)).toBe(40); // 44 rounds to 40
  });

  it('core_10.AC7 plays outside the bars of the section are ignored', () => {
    // The clean play at 40 percent would make the best well-played tempo 40 (start 30); outside the section it is ignored.
    expect(proposeStartPercent([clean(40, { bar: 9 }), bad(100, { bar: 1 })], 0, 2)).toBe(80);
  });

  it('core_10.AC7 only the last 24 plays within the section count', () => {
    const old = Array.from({ length: 6 }, () => clean(100));
    const recent = Array.from({ length: 24 }, () => bad(60));
    expect(proposeStartPercent([...old, ...recent], 0, 0)).toBe(40);
  });

  it('core_10.AC7 the start is never above 100 and never below 30', () => {
    fc.assert(
      fc.property(fc.array(playArb, { maxLength: 60 }), fc.integer({ min: 0, max: 8 }), fc.integer({ min: 0, max: 8 }), (plays, a, b) => {
        const first = Math.min(a, b);
        const last = Math.max(a, b);
        const start = proposeStartPercent(plays, first, last);
        return start >= 30 && start <= 100 && start % 10 === 0;
      }),
    );
  });
});

describe('proposeRamp (core_10.AC7)', () => {
  it('core_10.AC7 steps 5 percent every 2 clean laps towards 100 percent, from the default ramp', () => {
    expect(proposeRamp(80)).toEqual({ ...DEFAULT_RAMP, step: 5, stepUnit: 'percent', every: 2, onlyClean: true, target: 100, targetUnit: 'percent' });
  });

  it('core_10.AC7 is off when the start is already 100 percent', () => {
    expect(proposeRamp(100).step).toBe(0);
  });
});

describe('sectionPlan (core_10.AC7)', () => {
  it('core_10.AC7 combines the section, the start tempo and its ramp', () => {
    expect(sectionPlan([bad(60, { bar: 2 })], 2, 4)).toEqual({ first: 2, last: 4, startPercent: 40, ramp: proposeRamp(40) });
  });

  it('core_10.AC7 a section that starts at the piece tempo has its ramp off', () => {
    expect(sectionPlan([], 0, 0).ramp.step).toBe(5);
    expect(sectionPlan([clean(120)], 0, 0)).toEqual({ first: 0, last: 0, startPercent: 100, ramp: proposeRamp(100) });
    expect(sectionPlan([clean(120)], 0, 0).ramp.step).toBe(0);
  });
});
