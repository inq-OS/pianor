// Covers ft_1_32.AC2, ft_1_32.AC4, core_13.AC2, core_13.AC8.
import { describe, expect, it } from 'vitest';
import { chartWith } from '../../../tests/helpers/charts';
import type { BarPlay } from '../progression/practiceLog';
import { learnPlan } from './plan';
import { defaultLaneLook } from '../layout/beatLane';
import {
  afterRun, currentRun, DEFAULT_LEARN_SETTINGS, halfLearned, startOver, goldenBars, isLearned, learnProgressSchema, learnRewards, learnSettingsSchema, MAX_LEARN_TESTS, learnBeatLane, learnBeatLanes, learnHandsApart, learnLiveTempo, learnPaceClick, learnStepBars, measuredOutcome, medalOf, playsOn, sitDown, START_PROGRESS, withTest,
  type LearnProgress, type RunOutcome,
} from './progress';

const bars = (n: number) => chartWith(Array.from({ length: n }, (_, bar) => ({ tick: bar * 1920, dur: 480, midi: 60 + bar })));
const eightBars = bars(8);
/** The plan: per chunk four grow steps and its confirmation play, then the whole piece asked three times in a row. */
const three = learnPlan(eightBars);
/** The same plan with the whole piece asked once, so a test of one rule needs fewer runs. */
const plan = three.map((s) => (s.kind === 'whole' ? { ...s, runs: 1 } : s));

/** Play runs (true perfect, false stopped, or an outcome) on one day. */
const play = (from: LearnProgress, runs: readonly (boolean | RunOutcome)[], day = '1998-11-22', on = plan) =>
  runs.reduce((p, r) => afterRun(on, p, r === true ? 'perfect' : r === false ? 'stopped' : r, day, 60), from);
const all = (n: number) => Array.from({ length: n }, () => true);

describe('learning progress', () => {
  it('starts on the first step, bar 1, note names allowed', () => {
    expect(currentRun(plan, START_PROGRESS)).toEqual({ kind: 'step', firstBar: 0, lastBar: 0, step: plan[0], noteNames: 'allowed' });
  });

  it('moves on after a perfect run and repeats the step after a stopped one', () => {
    const p = play(START_PROGRESS, [true, false, false, true]);
    expect(p.step).toBe(2);
    expect(currentRun(plan, p)).toMatchObject({ firstBar: 0, lastBar: 2 });
  });

  it('plays each finished chunk once more (the confirmation play), and ends on the whole piece', () => {
    expect(currentRun(plan, play(START_PROGRESS, all(4)))).toMatchObject({ firstBar: 0, lastBar: 3, step: { kind: 'confirm' } });
    const atWhole = play(START_PROGRESS, all(10));
    expect(currentRun(plan, atWhole)).toMatchObject({ firstBar: 0, lastBar: 7, step: { kind: 'whole' } });
    expect(isLearned(plan, play(atWhole, [false]))).toBe(false);
    const learned = play(atWhole, [true]);
    expect(isLearned(plan, learned)).toBe(true);
    expect(currentRun(plan, learned)).toBeNull();
    expect(play(learned, [false])).toMatchObject({ step: plan.length }); // learned stays learned
  });

  it('ft_1_32.AC2 the last step is three plays: the first two go on past a wrong key and count, a mistake only lowers the clef\'s medal', () => {
    const atWhole = play(START_PROGRESS, all(10), '1998-11-22', three);
    const twice = play(atWhole, ['flawed', true], '1998-11-22', three);
    expect(twice).toMatchObject({ wholeStreak: 2, misses: 1 });
    expect(isLearned(three, play(twice, [true], '1998-11-22', three))).toBe(true);
    expect(play(twice, [true], '1998-11-22', three).medals.at(-1)).toBe('silver');
    expect(play(atWhole, all(3), '1998-11-22', three).medals.at(-1)).toBe('gold');
  });

  it('ft_1_32.AC2 the third play must be perfect: a wrong key starts it again from the first bar, still the third play', () => {
    const atWhole = play(START_PROGRESS, all(10), '1998-11-22', three);
    const third = play(atWhole, [true, true, false, false], '1998-11-22', three);
    expect(third).toMatchObject({ wholeStreak: 2, misses: 2 });
    expect(currentRun(three, third)).toMatchObject({ firstBar: 0, lastBar: 7, step: { kind: 'whole' } });
    expect(playsOn(three[third.step]!, third)).toBe(false);
    expect(playsOn(three[atWhole.step]!, atWhole)).toBe(true);
    const learned = play(third, [true], '1998-11-22', three);
    expect(isLearned(three, learned)).toBe(true);
    expect(learned.medals.at(-1)).toBe('silver');
  });

  it('ft_1_32.AC2 a play with mistakes never counts for a step asked once: the step comes again, as after a stopped run', () => {
    expect(play(START_PROGRESS, ['flawed'])).toMatchObject({ step: 0, misses: 1 });
    expect(playsOn(plan[0]!, START_PROGRESS)).toBe(false);
  });

  it('keeps the tempo of the measured runs that counted: the confirmation plays and the whole run (ft_1_32.AC7)', () => {
    const atConfirm = play(START_PROGRESS, all(4));
    expect(atConfirm.bpm).toBeUndefined(); // a growing step is not measured
    const wobbled = play(atConfirm, ['unsteady']);
    expect(wobbled).toMatchObject({ step: 4, misses: 0, unsteady: 1 }); // nothing lost, nothing counted: it is asked again
    expect(wobbled.bpm).toBeUndefined();
    expect(play(wobbled, [true]).bpm).toEqual([60]);
    expect(play(wobbled, [true]).unsteady).toBeUndefined(); // the next step starts its own count
    expect(play(START_PROGRESS, all(11)).bpm).toEqual([60, 60, 60]);
  });

  it('a run with note names shown counts nothing, and the next one hides them', () => {
    const hinted = play(START_PROGRESS, ['hinted']);
    expect(hinted.step).toBe(0);
    expect(currentRun(plan, hinted)).toMatchObject({ firstBar: 0, lastBar: 0, noteNames: 'hidden' });
    const stoppedHidden = play(hinted, [false]);
    expect(currentRun(plan, stoppedHidden)).toMatchObject({ noteNames: 'hidden' }); // until a hidden run is perfect
    const confirmed = play(stoppedHidden, [true]);
    expect(confirmed.step).toBe(1);
    expect(currentRun(plan, confirmed)).toMatchObject({ noteNames: 'allowed' });
  });

  it('on a later day first replays the step before, once and perfectly (the recall check)', () => {
    const yesterday = play(START_PROGRESS, all(3), '1998-11-21'); // now on bars 1-4
    const today = sitDown(plan, yesterday, '1998-11-22');
    expect(currentRun(plan, today)).toMatchObject({ kind: 'recall', firstBar: 0, lastBar: 2 });
    const missed = play(today, [false]);
    expect(currentRun(plan, missed)).toMatchObject({ kind: 'recall' });
    const recalled = play(missed, [true]);
    expect(currentRun(plan, recalled)).toMatchObject({ kind: 'step', firstBar: 0, lastBar: 3 });
    expect(recalled).toMatchObject({ step: 3, misses: 0 }); // the recall does not grade the step
  });

  it('recalls at most one chunk: after a join, the last chunk joined', () => {
    // sixteen bars: four chunks, a join of 1-8 after the second and of 9-16 after the fourth, then the whole
    const long = chartWith(Array.from({ length: 64 }, (_, i) => ({ tick: i * 480, dur: 480, midi: 60 + (i % 5) })));
    const longPlan = learnPlan(long);
    const join = longPlan.findIndex((s) => s.kind === 'join');
    expect(longPlan[join]).toMatchObject({ firstBar: 0, lastBar: 7 });
    const afterJoin = play(START_PROGRESS, all(join + 1), '1998-11-21', longPlan);
    const next = sitDown(longPlan, afterJoin, '1998-11-22');
    expect(currentRun(longPlan, next)).toMatchObject({ kind: 'recall', firstBar: 4, lastBar: 7, step: { kind: 'confirm' } });
  });

  it('an uneven measured run that was asked again counts for the step\'s medal like a run that did not count (AX-1)', () => {
    const atConfirm = play(START_PROGRESS, all(4));
    expect(play(atConfirm, [true]).medals.at(-1)).toBe('gold');
    expect(play(atConfirm, ['unsteady', true]).medals.at(-1)).toBe('silver');
    expect(play(atConfirm, [false, 'unsteady', 'unsteady', true]).medals.at(-1)).toBe('bronze');
  });

  it('asks no recall on the same day, before any step, or once learned', () => {
    expect(sitDown(plan, play(START_PROGRESS, [true]), '1998-11-22').recall).toBe(false);
    expect(sitDown(plan, START_PROGRESS, '1998-11-23').recall).toBe(false);
    expect(sitDown(plan, play(START_PROGRESS, all(11), '1998-11-21'), '1998-11-22').recall).toBe(false);
  });
});

describe('withTest (ft_1_32.AC8)', () => {
  const tempo = { bpm: 62, steadiness: 0.5, halts: 1, steady: false, spread: 0.404, robust: 0.126, drift: -0.084, bars: [1, 1.5, null] };

  it('keeps the measures of a measured run as whole percents, with its day and step, and changes nothing else', () => {
    const at = { ...START_PROGRESS, step: 4 };
    expect(withTest(at, tempo, '1998-11-22')).toEqual({
      ...at, tests: [{ day: '1998-11-22', step: 4, bpm: 62, sd: 40, mad: 13, drift: -8, halts: 1, steady: false }],
    });
  });

  it('keeps what was tested, the pace of each bar from the run\'s first bar, and each hand\'s spread (ft_1_32.AC9)', () => {
    const kept = withTest(START_PROGRESS, { ...tempo, hands: { RH: 0.081, LH: 0.2 } }, '1998-11-22', { kind: 'confirm', firstBar: 4 });
    expect(kept.tests![0]).toMatchObject({ kind: 'confirm', firstBar: 4, bars: [100, 150, 0], hands: { RH: 8, LH: 20 } });
    expect(learnProgressSchema.parse(JSON.parse(JSON.stringify(kept)))).toEqual(kept);
  });

  it('keeps the runs in order and only the latest', () => {
    let progress = START_PROGRESS;
    for (let i = 0; i < MAX_LEARN_TESTS + 2; i++) progress = withTest(progress, { ...tempo, bpm: 50 + i }, '1998-11-22');
    expect(progress.tests).toHaveLength(MAX_LEARN_TESTS);
    expect(progress.tests![0]!.bpm).toBe(52);
    expect(progress.tests!.at(-1)!.bpm).toBe(50 + MAX_LEARN_TESTS + 1);
  });

  it('keeps a record that can be saved whatever was measured', () => {
    const wild = withTest(START_PROGRESS, { ...tempo, spread: Number.POSITIVE_INFINITY, robust: Number.NaN, drift: -1e30 }, '1998-11-22');
    expect(wild.tests![0]).toMatchObject({ sd: 0, mad: 0, drift: -1000 });
    expect(learnProgressSchema.parse(wild)).toEqual(wild);
  });

  it('is saved and read back', () => {
    const kept = withTest(START_PROGRESS, tempo, '1998-11-22');
    expect(learnProgressSchema.parse(JSON.parse(JSON.stringify(kept)))).toEqual(kept);
  });
});

describe('measuredOutcome', () => {
  const uneven = { bpm: 60, steadiness: 0.5, halts: 1, steady: false, spread: 0.4, robust: 0.126, drift: -0.08, bars: [] };

  it('counts an even run with its tempo, and a run that is not measured without one', () => {
    expect(measuredOutcome(START_PROGRESS, { ...uneven, halts: 0, steadiness: 1, steady: true })).toEqual({ outcome: 'perfect', bpm: 60 });
    expect(measuredOutcome(START_PROGRESS, null)).toEqual({ outcome: 'perfect' });
  });

  it('ft_1_32.AC7 asks an uneven run again once at most: the student is never held at a step for the pace', () => {
    const atConfirm = play(START_PROGRESS, all(4));
    expect(measuredOutcome(atConfirm, uneven)).toEqual({ outcome: 'unsteady' });
    const once = play(atConfirm, ['unsteady']);
    expect(measuredOutcome(once, uneven)).toEqual({ outcome: 'perfect' }); // counts, with no tempo kept
  });
});

describe('medals', () => {
  it('gold for a step with no run that did not count, silver for one or two, bronze for more', () => {
    expect([0, 1, 2, 3, 9].map(medalOf)).toEqual(['gold', 'silver', 'silver', 'bronze', 'bronze']);
    const p = play(START_PROGRESS, [true, false, true, 'hinted', true, true, false, false, false, true]);
    expect(p.medals).toEqual(['gold', 'silver', 'silver', 'gold', 'bronze']);
  });

  it('a bar whose last three plays were perfect shines gold', () => {
    const at = (bar: number, firstTry: number, pieceId = 'p'): BarPlay => ({
      at: '1998-11-22T10:00:00Z', pieceId, bar, notes: 2, firstTry, timing: null, mode: 'wait', tempoPercent: 100, section: null, misses: [],
    });
    expect([...goldenBars([at(0, 2), at(0, 2), at(0, 2), at(1, 2), at(1, 1), at(1, 2), at(1, 2), at(2, 2), at(2, 2), at(0, 2, 'q')], 'p', '1998-11-21T00:00:00Z')]).toEqual([0]);
  });

  it('ft_1_32.AC4 only plays after the piece was learned raise a bar to gold, never the learning runs themselves', () => {
    const at = (time: string): BarPlay => ({
      at: time, pieceId: 'p', bar: 0, notes: 2, firstTry: 2, timing: null, mode: 'wait', tempoPercent: 100, section: null, misses: [],
    });
    const learning = ['1998-11-22T10:00:00Z', '1998-11-22T10:01:00Z', '1998-11-22T10:02:00Z'].map(at);
    expect(goldenBars(learning, 'p', null).size).toBe(0); // not learned yet
    expect(goldenBars(learning, 'p', '1998-11-22T10:02:00Z').size).toBe(0); // all three were learning runs
    const after = ['1998-11-22T11:00:00Z', '1998-11-23T09:00:00Z', '1998-11-23T09:01:00Z'].map(at);
    expect([...goldenBars([...learning, ...after], 'p', '1998-11-22T10:02:00Z')]).toEqual([0]);
  });

  it('ft_1_32.AC4 the progress keeps when the piece was learned', () => {
    const learned = play(START_PROGRESS, all(10), '1998-11-22', plan);
    expect(learned.learnedAt).toBeUndefined(); // one run short
    const done = afterRun(plan, learned, 'perfect', '1998-11-22', 60, '1998-11-22T10:05:00Z');
    expect(done.learnedAt).toBe('1998-11-22T10:05:00Z');
    expect(afterRun(plan, done, 'perfect', '1998-11-23', 60, '1998-11-23T08:00:00Z').learnedAt).toBe('1998-11-22T10:05:00Z');
    expect(learnProgressSchema.parse(done).learnedAt).toBe('1998-11-22T10:05:00Z');
  });
});

describe('learnRewards', () => {
  it('a quarter note per secured bar, a whole note per confirmed chunk, and the clef at the end, each with its medal', () => {
    expect(learnRewards(plan, START_PROGRESS, eightBars)).toEqual({
      chunks: [{ quarters: [], units: 4, merged: null }, { quarters: [], units: 4, merged: null }], piece: null,
    });
    const threeBars = play(START_PROGRESS, [true, false, true, true]);
    expect(learnRewards(plan, threeBars, eightBars).chunks[0]).toEqual({ quarters: ['gold', 'silver', 'gold'], units: 4, merged: null });
    expect(learnRewards(plan, play(threeBars, [true]), eightBars).chunks[0]!.merged).toBeNull(); // four quarters, not confirmed yet
    const chunkOne = play(threeBars, [true, true]);
    expect(learnRewards(plan, chunkOne, eightBars).chunks).toEqual([
      { quarters: ['gold', 'silver', 'gold', 'gold'], units: 4, merged: { note: 'whole', medal: 'silver' } },
      { quarters: [], units: 4, merged: null },
    ]);
    const learned = play(chunkOne, all(6));
    expect(learnRewards(plan, learned, eightBars).piece).toBe('silver');
  });

  it('three perfect plays of every bar raise them, their chunk and the piece to gold', () => {
    const learned = play(START_PROGRESS, [...all(5), false, false, false, ...all(6)]); // bar 5 took four runs
    expect(learnRewards(plan, learned, eightBars).chunks[1]!.merged).toEqual({ note: 'whole', medal: 'bronze' });
    expect(learnRewards(plan, learned, eightBars).piece).toBe('bronze');
    expect(learnRewards(plan, learned, eightBars, new Set([0, 1, 2, 3])).piece).toBe('bronze'); // not the bar that needs it
    const raised = learnRewards(plan, learned, eightBars, new Set([4]));
    expect(raised.chunks[1]!.quarters).toEqual(['gold', 'gold', 'gold', 'gold']);
    expect(raised.piece).toBe('gold');
  });

  it('merges a shorter last chunk into the note of its length', () => {
    const six = learnPlan(bars(6));
    const done = play(START_PROGRESS, all(8), '1998-11-22', six);
    expect(learnRewards(six, done, bars(6)).chunks.at(-1)!.merged).toEqual({ note: 'half', medal: 'gold' });
  });

  it('a bar of rests never keeps its chunk or the piece from gold', () => {
    // bar 2 has nothing to play: it is learned with bar 3 and never played on its own
    const chart = chartWith([0, 2, 3, 4, 5, 6, 7].map((bar) => ({ tick: bar * 1920, dur: 480, midi: 60 + bar })));
    const withRest = learnPlan(chart);
    const learned = play(START_PROGRESS, [false, false, false, ...Array.from({ length: withRest.length + 3 }, () => true)], '1998-11-22', withRest);
    expect(learnRewards(withRest, learned, chart).piece).toBe('bronze');
    expect(learnRewards(withRest, learned, chart, new Set([0, 2, 3, 4, 5, 6, 7])).piece).toBe('gold');
  });

  it('ft_1_32.AC2 a run with note names counts nothing in the whole runs and keeps their count, like a stopped one', () => {
    const atWhole = play(START_PROGRESS, all(10), '1998-11-22', three);
    expect(play(atWhole, [true, true, 'hinted'], '1998-11-22', three)).toMatchObject({ wholeStreak: 2, confirm: true });
  });

  it('ft_1_32.AC12 with hands apart a bar earns its note only once both hands played it, not after one hand alone', () => {
    const notes = [0, 1].flatMap((bar) => [{ tick: bar * 1920, dur: 480, midi: 64, track: 'rh' }, { tick: bar * 1920, dur: 480, midi: 48, track: 'lh' }]);
    notes.push({ tick: 1920, dur: 1920, midi: 52, track: 'bk' });
    const chart = chartWith(notes);
    const apart = learnPlan(chart, 1, true); // bar 1 RH, bar 1 LH, bar 1, bars 1-2 RH, LH, both, confirm
    expect(learnRewards(apart, play(START_PROGRESS, [true], '1998-11-22', apart), chart).chunks[0]!.quarters).toEqual([]);
    expect(learnRewards(apart, play(START_PROGRESS, all(2), '1998-11-22', apart), chart).chunks[0]!.quarters).toEqual([]);
    expect(learnRewards(apart, play(START_PROGRESS, all(3), '1998-11-22', apart), chart).chunks[0]!.quarters).toEqual(['gold']);
    expect(learnRewards(apart, play(START_PROGRESS, all(4), '1998-11-22', apart), chart).chunks[0]!.quarters).toEqual(['gold']);
    expect(learnRewards(apart, play(START_PROGRESS, all(6), '1998-11-22', apart), chart).chunks[0]!.quarters).toEqual(['gold', 'gold']);
  });

  it('a recall check never takes a note away', () => {
    const p = sitDown(plan, play(START_PROGRESS, all(2), '1998-11-21'), '1998-11-22');
    expect(learnRewards(plan, play(p, [false]), eightBars).chunks[0]!.quarters).toHaveLength(2);
  });
});

describe('the step size a piece is learned in', () => {
  it('ft_1_32.AC2 a piece started keeps the step size it began with, so its step index never points elsewhere', () => {
    expect(learnStepBars(START_PROGRESS, { ...DEFAULT_LEARN_SETTINGS, stepBars: 2 })).toBe(2); // not started: the setting
    const started = afterRun(learnPlan(eightBars, 1), START_PROGRESS, 'perfect', '1998-11-22', undefined);
    expect(learnStepBars({ ...started, stepBars: 1 }, { ...DEFAULT_LEARN_SETTINGS, stepBars: 2 })).toBe(1);
    expect(learnStepBars(started, { ...DEFAULT_LEARN_SETTINGS, stepBars: 2 })).toBe(1); // kept before the field: step 1, the only size offered then
    expect(learnProgressSchema.parse({ ...started, stepBars: 2 }).stepBars).toBe(2);
  });
});

describe('live tempo in learning', () => {
  it('ft_1_32.AC17 the live tempo is off unless the player turned it on, and a setting saved before it reads as off', () => {
    expect(learnLiveTempo(DEFAULT_LEARN_SETTINGS)).toBe(false);
    expect(learnLiveTempo(learnSettingsSchema.parse({ stepBars: 1, markers: true, markersFrom: 2 }))).toBe(false);
    expect(learnLiveTempo(learnSettingsSchema.parse({ ...DEFAULT_LEARN_SETTINGS, liveTempo: true }))).toBe(true);
  });
});

describe('the beat lane and the click at the student\'s pace', () => {
  it('core_13.AC2 the beat lane runs between the staves and the click at the student\'s pace is off until the player changes them, and a setting saved before them reads so', () => {
    const old = learnSettingsSchema.parse({ stepBars: 1, markers: true, markersFrom: 2 });
    expect([learnBeatLane(DEFAULT_LEARN_SETTINGS), learnBeatLane(old)]).toEqual(['between', 'between']);
    expect([learnPaceClick(DEFAULT_LEARN_SETTINGS), learnPaceClick(old)]).toEqual([false, false]);
    const changed = learnSettingsSchema.parse({ ...DEFAULT_LEARN_SETTINGS, beatLane: 'above', paceClick: true });
    expect([learnBeatLane(changed), learnPaceClick(changed)]).toEqual(['above', true]);
    expect(learnBeatLane(learnSettingsSchema.parse({ ...DEFAULT_LEARN_SETTINGS, beatLane: 'off' }))).toBe('off');
  });
});

describe('tuned beat lanes', () => {
  it('core_13.AC8 a player with no tuned lanes has the one lane of the lane setting, and tuned lanes replace it, at most three', () => {
    expect(learnBeatLanes(DEFAULT_LEARN_SETTINGS)).toEqual([defaultLaneLook('between')]);
    expect(learnBeatLanes({ ...DEFAULT_LEARN_SETTINGS, beatLane: 'above' })).toEqual([defaultLaneLook('above')]);
    expect(learnBeatLanes({ ...DEFAULT_LEARN_SETTINGS, beatLane: 'off' })).toEqual([]);
    const two = [defaultLaneLook('above'), { ...defaultLaneLook('between'), offset: 1.5, dots: { ghost: 0, beat: 1, top: 0, bottom: 1 } }];
    expect(learnBeatLanes(learnSettingsSchema.parse({ ...DEFAULT_LEARN_SETTINGS, beatLanes: two }))).toEqual(two);
    expect(() => learnSettingsSchema.parse({ ...DEFAULT_LEARN_SETTINGS, beatLanes: [...two, ...two] })).toThrow();
    expect(() => learnSettingsSchema.parse({ ...DEFAULT_LEARN_SETTINGS, beatLanes: [{ ...two[0]!, offset: 99 }] })).toThrow();
  });
});

describe('hands apart in a piece begun', () => {
  it('ft_1_32.AC12 a new piece is learned with both hands together unless the player chose hands apart, and a piece begun keeps the plan it began with', () => {
    expect(DEFAULT_LEARN_SETTINGS.handsApart).toBe(false);
    expect(learnHandsApart(START_PROGRESS, DEFAULT_LEARN_SETTINGS)).toBe(false);
    expect(learnHandsApart(START_PROGRESS, { ...DEFAULT_LEARN_SETTINGS, handsApart: true })).toBe(true);
    // saved before the setting: both hands together
    expect(learnHandsApart(START_PROGRESS, learnSettingsSchema.parse({ stepBars: 1, markers: true, markersFrom: 2 }))).toBe(false);
    const begun = afterRun(plan, START_PROGRESS, 'perfect', '1998-11-22');
    expect(learnHandsApart({ ...begun, handsApart: true }, DEFAULT_LEARN_SETTINGS)).toBe(true);
    expect(learnHandsApart({ ...begun, handsApart: false }, { ...DEFAULT_LEARN_SETTINGS, handsApart: true })).toBe(false);
    expect(learnHandsApart(begun, { ...DEFAULT_LEARN_SETTINGS, handsApart: true })).toBe(false); // kept before the field: its plan had no hand steps
    expect(learnProgressSchema.parse({ ...begun, handsApart: true }).handsApart).toBe(true);
  });
});


describe('starting a half-learned piece over (ft_1_32.AC16)', () => {
  it('ft_1_32.AC16 back to the first step with no medals, on the player\'s settings now; the measured paces and runs stay', () => {
    const begun = { ...play(START_PROGRESS, all(5)), bpm: [80, 84], tests: [], stepBars: 1 as const, handsApart: true };
    expect(begun.step).toBeGreaterThan(0);
    const over = startOver(begun, { ...DEFAULT_LEARN_SETTINGS, stepBars: 2, handsApart: false }, '1998-11-23');
    expect(over).toEqual({ ...START_PROGRESS, lastDay: '1998-11-23', stepBars: 2, handsApart: false, bpm: [80, 84], tests: [] });
    // no recall check on that day: nothing is done yet
    expect(sitDown(plan, over, '1998-11-23').recall).toBe(false);
    expect(halfLearned(begun)).toBe(true);
    expect(halfLearned(over)).toBe(false);
    expect(halfLearned(START_PROGRESS)).toBe(false);
  });
});
