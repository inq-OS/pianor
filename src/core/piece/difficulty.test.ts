// Covers core_08.AC1, core_08.AC2, core_08.AC3, core_08.AC6, core_08.AC7, core_08.AC9.
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { chartWith, graceAt } from '../../../tests/helpers/charts';
import { PPQ } from '../chart/time';
import { complexityOf } from '../properties/complexity';
import { DIFFICULTY_WEIGHTS, DIMENSIONS, confirmedPoints, difficultyOf, shownPoints, difficultyOfPassage, difficultySummary, lengthKind, partDifficulties, pointsOf, scaleOf } from './difficulty';

const Q = PPQ;
const BAR = 4 * Q;
type N = { tick: number; dur: number; midi: number; track?: string; tieNext?: boolean };
/** One bar of notes starting at `bar`, each `dur` long, on the given pitches. */
const run = (midis: number[], dur = Q, bar = 0, track = 'rh'): N[] => midis.map((midi, i) => ({ tick: bar * BAR + i * dur, dur, midi, track }));
const bar0 = (notes: N[], extra = {}) => difficultyOf(chartWith(notes, extra)).bars[0]!;

describe('lengthKind', () => {
  it('tells plain, dotted and tuplet lengths apart', () => {
    expect([4 * Q, 2 * Q, Q, Q / 2, Q / 4].map(lengthKind)).toEqual(['plain', 'plain', 'plain', 'plain', 'plain']);
    expect([3 * Q, 1.5 * Q, 0.75 * Q, 1.75 * Q].map(lengthKind)).toEqual(['dotted', 'dotted', 'dotted', 'dotted']);
    expect([Q / 3, (2 * Q) / 3, Q / 5].map(lengthKind)).toEqual(['tuplet', 'tuplet', 'tuplet']);
  });
});

describe('difficultyOf, per bar', () => {
  it('four quarter notes of one pitch are far easier than mixed triplets that jump (the worked example)', () => {
    const same = bar0(run([60, 60, 60, 60]));
    const triplets = bar0([...run([60, 64, 67], Q / 3), ...run([72, 65, 62], Q / 3).map((n) => ({ ...n, tick: n.tick + Q })), { tick: 2 * Q, dur: 2 * Q, midi: 60 }]);
    expect(same.features).toMatchObject({ presses: 4, rhythm: 0, leapPoints: 0, shifts: 0, accidentals: 0 });
    expect(triplets.features.rhythm).toBeGreaterThan(same.features.rhythm);
    expect(triplets.features.leapPoints).toBeGreaterThan(0);
    expect(triplets.features.shifts).toBeGreaterThan(0);
    expect(triplets.score).toBeGreaterThan(2 * same.score);
  });

  it('a bar with nothing to play scores 0 and does not pull the mean down', () => {
    const d = difficultyOf(chartWith([...run([60, 62, 64, 65]), ...run([67], Q, 2)]));
    expect(d.bars[1]).toMatchObject({ score: 0, features: { presses: 0 } });
    const two = difficultyOf(chartWith([...run([60, 62, 64, 65]), ...run([67], Q, 1)]));
    expect(d.score).toBe(two.score); // the empty bar adds neither to the mean nor to the length past 4 bars
  });

  it('counts onsets per second at the written tempo', () => {
    expect(bar0(run([60, 62, 64, 65])).features.onsetsPerSecond).toBe(2); // 4 quarters in 2 s at 120
    expect(bar0(run([60, 62, 64, 65]), { tempoMap: [{ tick: 0, bpm: 60 }] }).features.onsetsPerSecond).toBe(1);
  });

  it('counts the jump into a bar in that bar, and a chord is no jump', () => {
    const d = difficultyOf(chartWith([...run([60, 62, 64, 65]), ...run([72, 71], 2 * Q, 1)]));
    expect(d.bars[1]!.features.leapPoints).toBe(3); // F4 to C5 is a fifth (3 points), C5 to B4 a step
    const chord = bar0([{ tick: 0, dur: Q, midi: 60 }, { tick: 0, dur: Q, midi: 64 }, { tick: 0, dur: Q, midi: 67 }]);
    expect(chord.features).toMatchObject({ chordNotes: 2, leapPoints: 0 });
  });

  it('a hand that stays in five fingers never shifts; a run past them does', () => {
    expect(bar0([...run([64, 62, 60, 67])]).features.shifts).toBe(0); // E D C G: C position, whichever note comes first
    expect(bar0(run([60, 62, 64, 65, 67, 69, 71, 72], Q / 2)).features.shifts).toBe(1); // a C major scale
  });

  it('an accidental is a note the key signature does not give', () => {
    const inG = { keyMap: [{ tick: 0, fifths: 1, mode: 'major' }] };
    expect(bar0(run([66, 67]), inG).features.accidentals).toBe(0); // F sharp in G major
    expect(bar0(run([65, 67]), inG).features.accidentals).toBe(1); // F natural in G major
    expect(bar0(run([61, 60])).features.accidentals).toBe(1); // C sharp in C major
  });

  it('both hands sounding together, and two voices in one hand, make a bar harder', () => {
    const rh = run([60, 62, 64, 65]);
    const alone = bar0(rh);
    const together = bar0([...rh, { tick: 0, dur: BAR, midi: 48, track: 'lh' }]);
    expect(together.features.handsTogether).toBe(1);
    expect(together.score).toBeGreaterThan(alone.score);
    const chart = chartWith([...rh, { tick: 0, dur: BAR, midi: 55 }]);
    const twoVoices = difficultyOf({ ...chart, notes: chart.notes.map((n) => (n.midi === 55 ? { ...n, voice: 2 } : n)) }).bars[0]!;
    expect(twoVoices.features.extraVoices).toBe(1);
  });

  it('a tied-on note is not pressed again; a grace note is', () => {
    const tied = bar0([{ tick: 0, dur: 2 * Q, midi: 60, tieNext: true }, { tick: 2 * Q, dur: 2 * Q, midi: 60 }]);
    expect(tied.features.presses).toBe(1);
    const grace = bar0(run([60, 62, 64, 65]), { graces: [graceAt(Q, 64)] });
    expect(grace.features.presses).toBe(5);
    expect(grace.score).toBeGreaterThan(bar0(run([60, 62, 64, 65])).score);
  });

  it('counts only the notes the student plays, not accompaniment', () => {
    const rh = run([60, 62, 64, 65]);
    expect(bar0([...rh, ...run([48, 50, 52, 53], Q / 2, 0, 'bk')])).toEqual(bar0(rh));
  });
});

describe('difficultyOf, per piece', () => {
  const easy = [0, 1, 2, 3].flatMap((b) => run([60, 62, 64, 62], Q, b));

  it('names the hardest bars, at most three, in bar order', () => {
    const hard = run([60, 67, 61, 72], Q / 3).concat(run([60, 72], (8 * Q) / 3).map((n) => ({ ...n, tick: n.tick + Q })));
    const d = difficultyOf(chartWith([...easy.filter((n) => n.tick >= BAR), ...hard]));
    expect(d.hardest).toEqual([0]);
    expect(difficultyOf(chartWith(easy)).hardest).toEqual([]);
  });

  it('a change of meter, key or tempo makes the piece harder', () => {
    const plain = difficultyOf(chartWith(easy)).score;
    expect(difficultyOf(chartWith(easy, { keyMap: [{ tick: 0, fifths: 0, mode: 'major' }, { tick: 2 * BAR, fifths: 1, mode: 'major' }] })).score).toBeGreaterThan(plain);
    expect(difficultyOf(chartWith(easy, { tempoMap: [{ tick: 0, bpm: 120 }, { tick: 2 * BAR, bpm: 100 }] })).piece.tempoChanges).toBe(1);
    expect(difficultyOf(chartWith(easy, { meterMap: [{ tick: 0, num: 4, den: 4 }, { tick: 2 * BAR, num: 4, den: 4 }] })).score).toBeGreaterThan(plain);
  });

  it('numbers bars as printed: a pick-up is bar 0', () => {
    const chart = chartWith(easy);
    const withPickup = { ...chart, bars: [{ index: 0, startTick: 0, endTick: Q }, ...chart.bars.slice(1).map((b, i) => ({ ...b, index: i + 1 }))] };
    expect(difficultyOf(withPickup).bars.map((b) => b.printed)).toEqual([0, 1, 2, 3]);
    expect(difficultyOf(chart).bars.map((b) => b.printed)).toEqual([1, 2, 3, 4]);
  });

  it('a faster tempo never makes a piece easier (property)', () => {
    fc.assert(
      fc.property(fc.integer({ min: 30, max: 300 }), fc.integer({ min: 0, max: 200 }), (bpm, more) => {
        const at = (b: number) => difficultyOf(chartWith(easy, { tempoMap: [{ tick: 0, bpm: b }] })).score;
        expect(at(bpm + more)).toBeGreaterThanOrEqual(at(bpm));
      }),
    );
  });
});

describe('scaleOf', () => {
  it('core_08.AC2 maps a score onto half stars 1 to 50, the Beginner grade on the ten steps of d138, never lower for a higher score (property)', () => {
    expect(scaleOf(0)).toBe(1);
    expect(scaleOf(1000)).toBe(50);
    expect(DIFFICULTY_WEIGHTS.scaleStarts.map(scaleOf)).toEqual([2, 3, 4, 5, 6, 7, 8, 9, 10]);
    expect(scaleOf(DIFFICULTY_WEIGHTS.beginnerEnd - 0.01)).toBe(10);
    expect(scaleOf(DIFFICULTY_WEIGHTS.beginnerEnd)).toBe(11);
    fc.assert(
      fc.property(fc.double({ min: 0, max: 300, noNaN: true }), fc.double({ min: 0, max: 300, noNaN: true }), (a, b) => {
        const [low, high] = a <= b ? [a, b] : [b, a];
        expect(scaleOf(low)).toBeLessThanOrEqual(scaleOf(high));
        expect(Number.isInteger(scaleOf(a))).toBe(true);
      }),
    );
  });
});

describe('difficultySummary', () => {
  it('says the points, the grade and stars, the confirmed number and the hardest bars as printed', () => {
    const easy = [0, 1, 2, 3].flatMap((b) => run([60, 62, 64, 62], Q, b));
    const hard = run([60, 67, 61, 72], Q / 3);
    const d = difficultyOf(chartWith([...easy.filter((n) => n.tick < 3 * BAR), ...hard.map((n) => ({ ...n, tick: n.tick + 3 * BAR }))]));
    expect(difficultySummary(d, 2)).toMatch(new RegExp(`^difficulty ${d.points}/100, beginner [\\d.]+ stars, proposed \\(confirmed 2 half stars, score ${d.score}, hardest bars 4\\)$`));
    expect(difficultySummary(difficultyOf(chartWith(easy)))).toMatch(/^difficulty \d+\/100, beginner [\d.]+ stars, proposed \(not confirmed, score [\d.]+\)$/);
  });
});

describe('pointsOf (d157)', () => {
  it('core_08.AC2 gives 1 to 100, two points per step of d138 in the Beginner grade, never fewer for a higher score (property)', () => {
    expect(pointsOf(0)).toBe(1);
    expect(pointsOf(10_000)).toBe(100);
    expect(pointsOf(DIFFICULTY_WEIGHTS.beginnerEnd - 0.01)).toBe(20);
    expect(pointsOf(DIFFICULTY_WEIGHTS.beginnerEnd)).toBe(21);
    fc.assert(
      fc.property(fc.double({ min: 0, max: 400, noNaN: true }), fc.double({ min: 0, max: 400, noNaN: true }), (a, b) => {
        const [low, high] = a <= b ? [a, b] : [b, a];
        expect(pointsOf(low)).toBeLessThanOrEqual(pointsOf(high));
        expect(Math.ceil(pointsOf(a) / 2)).toBe(scaleOf(a));
        expect(Number.isInteger(pointsOf(a))).toBe(true);
      }),
    );
  });

  it("a person's confirmed half stars are two points each", () => {
    expect([1, 10, 11, 50].map(confirmedPoints)).toEqual([2, 20, 22, 100]);
  });

  it('core_08.AC5 confirmed half stars are the stars a card shows: h half stars fill h / 2 stars of their grade', () => {
    for (let h = 1; h <= 10; h++) expect(complexityOf(confirmedPoints(h))).toEqual({ grade: 'beginner', stars: h / 2 });
    expect(complexityOf(confirmedPoints(11))).toEqual({ grade: 'intermediate', stars: 0.5 });
  });

  it('core_08.AC5 the game shows the confirmed half stars as points, else the proposal', () => {
    const proposed = difficultyOf(chartWith(run([60, 62, 64, 65])));
    expect(shownPoints(11, proposed)).toBe(22);
    expect(shownPoints(undefined, proposed)).toBe(proposed.points);
  });
});

describe('difficultyOfPassage', () => {
  // Bar 1 sits low (C position), bar 2 high (G5 position), bar 3 low again.
  const piece = chartWith([...run([60, 62, 64, 62], Q, 0), ...run([79, 81, 83, 81], Q, 1), ...run([60, 62, 64, 62], Q, 2)]);

  it('one contiguous range scores like the whole piece cut to those bars', () => {
    const whole = difficultyOf(piece);
    const first = difficultyOfPassage(piece, [{ first: 0, last: 0 }]);
    expect(first.bars).toEqual([whole.bars[0]]);
    expect(difficultyOfPassage(piece, [{ first: 0, last: 2 }]).score).toBe(whole.score);
  });

  it('A straight into C has no jump at the seam; A into B has one, and bars keep their written numbers', () => {
    const ac = difficultyOfPassage(piece, [{ first: 0, last: 0 }, { first: 2, last: 2 }]);
    const ab = difficultyOfPassage(piece, [{ first: 0, last: 1 }]);
    expect(ac.bars.map((b) => [b.index, b.printed])).toEqual([[0, 1], [2, 3]]);
    expect(ac.bars[1]!.features).toMatchObject({ leapPoints: 0, shifts: 0 });
    expect(ab.bars[1]!.features.leapPoints).toBeGreaterThan(0);
    expect(ab.bars[1]!.features.shifts).toBe(1);
    expect(ac.piece.keyChanges + ac.piece.tempoChanges + ac.piece.meterChanges).toBe(0); // the seam is no change
  });

  it('names the hardest bar by its written index, once, even when a range repeats', () => {
    const hardSecond = chartWith([...run([60, 62, 64, 62], Q, 0), ...run([60, 62, 64, 62], Q, 1), ...run([60, 67, 61, 72], Q / 3, 2)]);
    expect(difficultyOfPassage(hardSecond, [{ first: 0, last: 0 }, { first: 2, last: 2 }]).hardest).toEqual([2]);
    const loop = difficultyOfPassage(hardSecond, [{ first: 0, last: 0 }, { first: 2, last: 2 }, { first: 0, last: 0 }, { first: 2, last: 2 }]);
    expect(loop.hardest).toEqual([2]);
    expect(difficultySummary(loop)).toMatch(/hardest bars 3\)$/);
  });

  it('keeps a key change inside a range and drops a map entry the seam repeats', () => {
    const keyMap = [{ tick: 0, fifths: 0, mode: 'major' }, { tick: BAR + Q, fifths: 1, mode: 'major' }];
    const chart = chartWith([...run([60, 62, 64, 62], Q, 0), ...run([67, 66, 67, 69], Q, 1), ...run([67, 66, 67, 69], Q, 2)], { keyMap });
    expect(difficultyOfPassage(chart, [{ first: 0, last: 1 }]).piece.keyChanges).toBe(1); // the change inside bar 2 survives
    expect(difficultyOfPassage(chart, [{ first: 2, last: 2 }, { first: 2, last: 2 }]).piece.keyChanges).toBe(0); // G major at both seams
    expect(difficultyOfPassage(chart, [{ first: 2, last: 2 }, { first: 0, last: 0 }]).piece.keyChanges).toBe(1); // G back to C
  });

  it('refuses an empty passage and a range outside the bars', () => {
    expect(() => difficultyOfPassage(piece, [])).toThrow();
    expect(() => difficultyOfPassage(piece, [{ first: 2, last: 5 }])).toThrow();
  });
});

describe('partDifficulties', () => {
  it('scores each named part on its own bars', () => {
    const chart = chartWith([...run([60, 62, 64, 62], Q, 0), ...run([60, 67, 61, 72], Q / 3, 1)], { phrases: [{ name: 'Calm', startBar: 0, endBar: 0 }, { name: 'Storm', startBar: 1, endBar: 1 }] });
    const [calm, storm] = partDifficulties(chart);
    expect(calm!.name).toBe('Calm');
    expect(storm!.difficulty.points).toBeGreaterThan(calm!.difficulty.points);
    expect(storm!.difficulty.bars.map((b) => b.printed)).toEqual([2]);
  });
});

describe('parts: the score split by dimension', () => {
  const sum = (parts: Record<string, number>) => Object.values(parts).reduce((a, b) => a + b, 0);

  it('the parts of a bar and of a piece add up to its score (core_08.AC9)', () => {
    const d = difficultyOf(chartWith([...run([60, 64, 61, 72], Q / 2), ...run([60, 62], 2 * Q, 1)], { keyMap: [{ tick: 0, fifths: 2, mode: 'major' }] }));
    for (const b of d.bars) expect(sum(b.parts)).toBeCloseTo(b.score, 1);
    expect(sum(d.parts)).toBeCloseTo(d.score, 1);
    expect(Object.keys(d.parts)).toEqual([...DIMENSIONS]);
  });

  it('puts each kind of difficulty where it belongs', () => {
    const chord = bar0([{ tick: 0, dur: BAR, midi: 60 }, { tick: 0, dur: BAR, midi: 64 }, { tick: 0, dur: BAR, midi: 67 }]);
    expect(chord.parts.texture).toBeGreaterThan(0);
    expect(chord.parts.pitch).toBe(0);
    const leaps = bar0(run([60, 67, 60, 67]));
    expect(leaps.parts.pitch).toBeGreaterThan(0);
    const sharp = bar0(run([61, 60]));
    expect(sharp.parts.reading).toBeGreaterThan(0);
    const inD = difficultyOf(chartWith(run([62, 66, 69, 66]), { keyMap: [{ tick: 0, fifths: 2, mode: 'major' }] }));
    expect(inD.parts.reading).toBeGreaterThan(0); // the key signature is read
    expect(inD.parts.structure).toBe(0);
  });
});
