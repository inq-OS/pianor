// Covers core_10.AC5 (bar heat, cooling) and core_10.AC6 (the 3 weakest sections).
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import type { BarPlay } from '../progression/practiceLog';
import { HEAT, barBadness, barHeat, pieceHeat, hottestBar, weakestSections } from './barHeat';

/** One bar play with the given fields; the rest is filler. */
const play = (over: Partial<BarPlay> = {}): BarPlay => ({
  at: '1998-10-30T10:00:00.000Z',
  pieceId: 'piece-a',
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

const clean = (over: Partial<BarPlay> = {}) => play({ notes: 4, firstTry: 4, ...over });
const hot = (over: Partial<BarPlay> = {}) => play({ notes: 4, firstTry: 0, ...over });

describe('bar heat constants (core_10)', () => {
  it('core_10.AC5 the tuning values are the ones in the feature plan', () => {
    expect(HEAT).toEqual({ decay: 0.7, minHeat: 0.15, maxSectionBars: 4, sections: 3 });
  });
});

describe('barBadness (core_10.AC5)', () => {
  it('core_10.AC5 a bar played right the first time, in Wait mode, has badness 0', () => {
    expect(barBadness(clean())).toBe(0);
  });

  it('core_10.AC5 the share of notes not right the first time is the badness in Wait mode', () => {
    expect(barBadness(play({ notes: 4, firstTry: 3 }))).toBeCloseTo(0.25);
    expect(barBadness(play({ notes: 4, firstTry: 0 }))).toBe(1);
  });

  it('core_10.AC5 a bar with no notes has first-try badness 0, not NaN', () => {
    expect(barBadness(play({ notes: 0, firstTry: 0 }))).toBe(0);
  });

  it('core_10.AC5 timing in Tempo mode adds (100 - timing) / 200, and the worse of the two counts', () => {
    expect(barBadness(play({ notes: 4, firstTry: 4, timing: 60, mode: 'tempo' }))).toBeCloseTo(0.2);
    expect(barBadness(play({ notes: 4, firstTry: 2, timing: 90, mode: 'tempo' }))).toBeCloseTo(0.5);
    expect(barBadness(play({ notes: 4, firstTry: 3, timing: 100, mode: 'tempo' }))).toBeCloseTo(0.25);
  });
});

describe('barHeat (core_10.AC5)', () => {
  it('core_10.AC5 a bar with no plays is null', () => {
    expect(barHeat([], 0)).toBeNull();
    expect(barHeat([clean({ bar: 2 })], 0)).toBeNull();
  });

  it('core_10.AC5 only plays of the given bar count', () => {
    const plays = [hot({ bar: 1 }), clean({ bar: 0 })];
    expect(barHeat(plays, 0)).toBe(0);
    expect(barHeat(plays, 1)).toBe(1);
  });

  it('core_10.AC5 a single play gives its own badness', () => {
    expect(barHeat([play({ bar: 3, notes: 4, firstTry: 2 })], 3)).toBeCloseTo(0.5);
  });

  it('core_10.AC5 the newest play has weight 1 and older plays decay by HEAT.decay each step back', () => {
    // Oldest first: a hot play (badness 1) then a clean one (badness 0). Newest weight 1, the hot one 0.7.
    const plays = [hot({ bar: 0 }), clean({ bar: 0 })];
    expect(barHeat(plays, 0)).toBeCloseTo(0.7 / 1.7);
  });

  it('core_10.AC5 cooling: each clean play after a hot one lowers the heat of the bar', () => {
    const plays: BarPlay[] = [hot()];
    const heats: number[] = [barHeat(plays, 0) ?? NaN];
    for (let i = 0; i < 3; i += 1) {
      plays.push(clean());
      heats.push(barHeat(plays, 0) ?? NaN);
    }
    expect(heats[0]).toBe(1);
    for (let i = 1; i < heats.length; i += 1) {
      expect(heats[i]).toBeLessThan(heats[i - 1] ?? NaN);
    }
    expect(heats[3]).toBeLessThan(heats[0] ?? NaN);
  });
});

describe('pieceHeat (core_10.AC5)', () => {
  it('core_10.AC5 gives one value per bar, null for bars without plays', () => {
    const heat = pieceHeat([hot({ bar: 1 }), clean({ bar: 2 })], 4);
    expect(heat).toHaveLength(4);
    expect(heat[0]).toBeNull();
    expect(heat[1]).toBe(1);
    expect(heat[2]).toBe(0);
    expect(heat[3]).toBeNull();
  });

  it('core_10.AC5 heat is always within 0 to 1 (property)', () => {
    const playArb = fc
      .record({
        bar: fc.integer({ min: 0, max: 3 }),
        notes: fc.integer({ min: 0, max: 20 }),
        timing: fc.option(fc.integer({ min: 0, max: 100 }), { nil: null }),
        mode: fc.constantFrom('wait' as const, 'tempo' as const),
        ratio: fc.double({ min: 0, max: 1, noNaN: true }),
      })
      .map(({ ratio, notes, ...rest }) => play({ ...rest, notes, firstTry: Math.floor(ratio * notes) }));

    fc.assert(
      fc.property(fc.array(playArb, { maxLength: 30 }), (plays) => {
        for (let bar = 0; bar < 4; bar += 1) {
          const heat = barHeat(plays, bar);
          if (heat !== null) {
            expect(heat).toBeGreaterThanOrEqual(0);
            expect(heat).toBeLessThanOrEqual(1);
          }
        }
      }),
    );
  });
});

describe('weakestSections (core_10.AC6)', () => {
  it('core_10.AC6 a piece played cleanly (no bar at or above minHeat) has no weak sections', () => {
    expect(weakestSections([0, 0, null, 0.1, 0])).toEqual([]);
    expect(weakestSections([])).toEqual([]);
    expect(weakestSections([null, null])).toEqual([]);
  });

  it('core_10.AC6 picks the HEAT.sections hottest runs, hottest first', () => {
    const heat = [0.5, 0.1, 0.9, 0.9, 0.2, null, 0.6, 0.3, 0.1, null, 0.8];
    // Runs at or above 0.15: [0] 0.5, [2,4] mean 0.667, [6,7] mean 0.45, [10] 0.8. The coolest one is left out.
    const sections = weakestSections(heat);
    expect(sections.map((s) => [s.first, s.last])).toEqual([[10, 10], [2, 4], [0, 0]]);
    expect(sections[1]?.heat).toBeCloseTo(2 / 3);
  });

  it('core_10.AC6 equally hot sections are ordered by the earlier bar first', () => {
    const heat = [0.5, null, 0.5, null, 0.5, null, 0.2];
    expect(weakestSections(heat).map((s) => s.first)).toEqual([0, 2, 4]);
  });

  it('core_10.AC6 a run of two or more hot bars is one section with the mean heat of its bars', () => {
    expect(weakestSections([0.2, 0.4, 0.6])).toEqual([{ first: 0, last: 2, heat: expect.any(Number) }]);
    expect(weakestSections([0.2, 0.4, 0.6])[0]?.heat).toBeCloseTo(0.4);
  });

  it('core_10.AC6 a run longer than HEAT.maxSectionBars is cut into chunks from the left', () => {
    const heat = Array.from({ length: 6 }, () => 0.5);
    expect(HEAT.maxSectionBars).toBe(4);
    expect(weakestSections(heat)).toEqual([
      { first: 0, last: 3, heat: 0.5 },
      { first: 4, last: 5, heat: 0.5 },
    ]);
  });

  it('core_10.AC6 a null bar splits runs and is never part of a section', () => {
    expect(weakestSections([0.5, null, 0.5])).toEqual([
      { first: 0, last: 0, heat: 0.5 },
      { first: 2, last: 2, heat: 0.5 },
    ]);
  });

  it('core_10.AC6 a bar just below minHeat does not qualify', () => {
    expect(weakestSections([HEAT.minHeat - 0.01, HEAT.minHeat])).toEqual([{ first: 1, last: 1, heat: HEAT.minHeat }]);
  });
});

describe('hottestBar', () => {
  it('core_10.AC6: picks the hottest bar of the section, the earlier on a tie, the first when none was played', () => {
    expect(hottestBar([0.1, 0.5, 0.9, 0.9], 1, 3)).toBe(2);
    expect(hottestBar([0.1, 0.5, 0.5], 1, 2)).toBe(1);
    expect(hottestBar([null, null, null], 1, 2)).toBe(1);
  });
});
