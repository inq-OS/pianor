import { describe, expect, it } from 'vitest';
import { chartWith } from '../../../tests/helpers/charts';
import { buildSteps } from '../judge/steps';
import {
  DEFAULT_CRACK_RULES,
  advanceTime,
  evaluateFindKey,
  keyStepsOf,
  pressKey,
  slipWeights,
  startFindKey,
  type FindKeyPress,
  type KeyStep,
} from './findKey';

// synthetic steps: quarter notes in bar 1 unless given; the third is a chord
const step = (pitches: number[], beats = 1, bar = 1): KeyStep => ({ pitches, beats, bar });
const steps: KeyStep[] = [step([60]), step([62]), step([64, 67])];
const press = (timeMs: number, midi: number): FindKeyPress => ({ timeMs, midi });
const run = (presses: FindKeyPress[], over: { windowMs?: number; cracks?: number; nowMs?: number } = {}) =>
  evaluateFindKey(steps, presses, { cracks: 5, ...over });

const perfect = [press(100, 60), press(200, 62), press(300, 64), press(310, 67)];
// n = 16 steps of different pitches: base 100, one plain slip is one crack
const sixteen: KeyStep[] = Array.from({ length: 16 }, (_, i) => step([60 + i], 1, Math.floor(i / 4) + 1));

describe('slipWeights', () => {
  it('base is 100 x crackNotes / n: one plain slip is one crack in a part of crackNotes notes (ft_1_06.AC2)', () => {
    expect(slipWeights(sixteen, DEFAULT_CRACK_RULES)).toEqual(new Array(16).fill(100));
    const eight = sixteen.slice(0, 8);
    expect(slipWeights(eight, DEFAULT_CRACK_RULES)[0]).toBe(200);
  });

  it('a note longer than a quarter weighs more by lengthStep per extra beat (ft_1_06.AC2)', () => {
    const lengths = [1, 2, 3, 4, 1.5, 0.5].map((beats, i) => step([60 + i], beats, i + 1));
    const w = slipWeights(lengths, { ...DEFAULT_CRACK_RULES, crackNotes: 6 });
    expect(w).toEqual([100, 125, 150, 175, 112.5, 100]);
  });

  it('a repeated pitch weighs more by repeatStep per earlier same-pitch note in the bar (ft_1_06.AC2)', () => {
    const bar = [step([60]), step([60]), step([60]), step([60]), step([60], 1, 2), step([62], 1, 2)];
    const w = slipWeights(bar, { ...DEFAULT_CRACK_RULES, crackNotes: 6 });
    // the third C of C C C C is k = 2; the C in bar 2 starts again at k = 0
    expect(w).toEqual([100, 125, 150, 175, 100, 100]);
  });

  it('a chord repeats only when the same set of pitches comes again (ft_1_06.AC2)', () => {
    const chords = [step([60, 64]), step([64, 60]), step([60, 64, 67]), step([60])];
    expect(slipWeights(chords, { ...DEFAULT_CRACK_RULES, crackNotes: 4 })).toEqual([100, 125, 100, 100]);
  });

  it('one slip never weighs more than weightCap plain slips (ft_1_06.AC2)', () => {
    const held = [step([60], 4), step([60], 4), step([60], 4), step([60], 4)];
    // 1.75 x 1.75 = 3.06 for the last one, capped at 2.5
    expect(slipWeights(held, { ...DEFAULT_CRACK_RULES, crackNotes: 4 })).toEqual([175, 218.75, 250, 250]);
  });

  it('gives nothing for an empty part', () => {
    expect(slipWeights([], DEFAULT_CRACK_RULES)).toEqual([]);
  });
});

describe('keyStepsOf', () => {
  // bars are 0-based in charts; the tied D runs from the last beat of bar 0 into bar 1
  const chart = chartWith([
    { tick: 0, dur: 480, midi: 60 },
    { tick: 480, dur: 960, midi: 64 },
    { tick: 480, dur: 480, midi: 67 },
    { tick: 1440, dur: 480, midi: 62, tieNext: true },
    { tick: 1920, dur: 960, midi: 62 },
    { tick: 2880, dur: 480, midi: 50, track: 'bk' },
  ]);

  it('gives each step its pitches, its bar and its length in beats with ties added (ft_1_06.AC2)', () => {
    expect(keyStepsOf(chart, buildSteps(chart))).toEqual([
      { pitches: [60], beats: 1, bar: 0 },
      { pitches: [64, 67], beats: 2, bar: 0 },
      { pitches: [62], beats: 3, bar: 0 },
    ]);
  });

  it('counts each note of a tied chord with its own tie chain, then takes the longest (ft_1_06.AC2)', () => {
    // C4 and E4 each held as a half note tied into a half note in the next bar: 4 beats, not 6
    const tiedChord = chartWith([
      { tick: 0, dur: 960, midi: 60, tieNext: true },
      { tick: 0, dur: 960, midi: 64, tieNext: true },
      { tick: 960, dur: 960, midi: 60 },
      { tick: 960, dur: 960, midi: 64 },
    ]);
    expect(keyStepsOf(tiedChord, buildSteps(tiedChord))[0]!.beats).toBe(4);
  });

  it('takes the longest note with its own ties when only the shorter note is tied (ft_1_06.AC2)', () => {
    // C4 is a half note; E4 is an eighth tied into a half note: the longest is 2.5 beats, not 4
    const chord = chartWith([
      { tick: 0, dur: 960, midi: 60 },
      { tick: 0, dur: 240, midi: 64, tieNext: true },
      { tick: 240, dur: 960, midi: 64 },
    ]);
    expect(keyStepsOf(chord, buildSteps(chord))[0]!.beats).toBe(2.5);
  });
});

describe('findKey, incremental', () => {
  it('passes when every step is played in order without a crack too many (ft_1_06.AC2)', () => {
    const s = run(perfect);
    expect(s.status).toBe('passed');
    expect(s.cracks).toBe(0);
    expect(s.score).toBe(0);
  });

  it('is in progress while steps remain (ft_1_06.AC2)', () => {
    expect(run(perfect.slice(0, 2)).status).toBe('in-progress');
    expect(run([]).status).toBe('in-progress');
  });

  it('a late press adds nothing (ft_1_06.AC2)', () => {
    const late = [press(100, 60), press(60000, 62), press(119000, 64), press(119500, 67)];
    expect(run(late, { cracks: 1 })).toMatchObject({ status: 'passed', score: 0 });
  });

  it('several wrong presses on one note count once, on the first one (ft_1_06.AC2)', () => {
    let s = startFindKey(sixteen, { cracks: 5 });
    s = pressKey(s, press(10, 61));
    expect(s).toMatchObject({ score: 100, cracks: 1, step: 0 });
    s = pressKey(s, press(20, 63));
    s = pressKey(s, press(30, 65));
    expect(s).toMatchObject({ score: 100, cracks: 1 });
    s = pressKey(s, press(40, 60));
    s = pressKey(s, press(50, 99));
    expect(s).toMatchObject({ score: 200, cracks: 2, step: 1 });
  });

  it('the key breaks at once on the N-th crack, before the part ends (ft_1_06.AC2)', () => {
    let s = startFindKey(sixteen, { cracks: 3 });
    for (let i = 0; i < 3; i++) {
      s = pressKey(s, press(i * 10, 99));
      if (i < 2) s = pressKey(s, press(i * 10 + 5, 60 + i));
    }
    expect(s).toMatchObject({ status: 'key-broken', cracks: 3, step: 2 });
    // a broken key takes no more presses
    expect(pressKey(s, press(100, 62))).toBe(s);
    expect(advanceTime(s, 999999)).toBe(s);
  });

  it('worked example level 1: 24 notes, N = 5, the eighth plain slip breaks the key (ft_1_06.AC2)', () => {
    const part = Array.from({ length: 24 }, (_, i) => step([48 + i], 1, Math.floor(i / 3) + 1));
    let s = startFindKey(part, { cracks: 5 });
    for (let i = 0; i < 7; i++) s = pressKey(pressKey(s, press(i, 99)), press(i, 48 + i));
    expect(s.score).toBeCloseTo(466.67, 1);
    expect(s).toMatchObject({ status: 'in-progress', cracks: 4 });
    s = pressKey(s, press(8, 99));
    expect(s).toMatchObject({ status: 'key-broken', cracks: 5 });
  });

  it('worked example level 3: 96 notes, N = 3, the eighteenth plain slip breaks the key despite rounding (ft_1_06.AC2)', () => {
    const part = Array.from({ length: 96 }, (_, i) => step([36 + (i % 48)], 1, i + 1));
    let s = startFindKey(part, { cracks: 3 });
    for (let i = 0; i < 17; i++) s = pressKey(pressKey(s, press(i, 99)), press(i, 36 + i));
    expect(s).toMatchObject({ status: 'in-progress', cracks: 2 });
    s = pressKey(s, press(18, 99));
    expect(s).toMatchObject({ status: 'key-broken', cracks: 3 });
  });

  it('finishing with fewer than N cracks earns the key (ft_1_06.AC2)', () => {
    const oneWrong = [press(100, 61), press(150, 60), press(200, 62), press(300, 64), press(310, 67)];
    // n = 3: base 533, so one plain slip is five cracks
    expect(run(oneWrong, { cracks: 6 })).toMatchObject({ status: 'passed', cracks: 5 });
    expect(run(oneWrong, { cracks: 5 }).status).toBe('key-broken');
  });

  it('a chord step accepts its keys in any order (ft_1_06.AC2)', () => {
    expect(run([press(1, 60), press(2, 62), press(3, 67), press(4, 64)]).status).toBe('passed');
  });

  it('a repeat press of a key already accepted in a chord step is a slip (ft_1_06.AC2)', () => {
    const chordSteps = [step([64, 67]), step([62])];
    const s = evaluateFindKey(chordSteps, [press(100, 64), press(200, 67), press(250, 64), press(300, 62)], {
      cracks: 99,
      rules: { ...DEFAULT_CRACK_RULES, crackNotes: 2 },
    });
    expect(s).toMatchObject({ status: 'passed', score: 100, cracks: 1 });
  });

  it('a press of a later step does not skip ahead (ft_1_06.AC2)', () => {
    expect(run([press(1, 62), press(2, 60)], { cracks: 99 })).toMatchObject({ status: 'in-progress', step: 1 });
  });

  it('expires when the window ends first, by a late press or by the time, and adds nothing (ft_1_06.AC2)', () => {
    expect(run([press(100, 60), press(120000, 62)])).toMatchObject({ status: 'window-expired', score: 0 });
    expect(run([press(100, 60)], { nowMs: 120000 }).status).toBe('window-expired');
    expect(run([press(100, 60)], { nowMs: 119999 }).status).toBe('in-progress');
    expect(run([press(100, 60), press(5001, 62)], { windowMs: 5000 }).status).toBe('window-expired');
    const expired = advanceTime(startFindKey(steps, { cracks: 5 }), 120000);
    expect(expired.status).toBe('window-expired');
    expect(pressKey(expired, press(1, 60))).toBe(expired);
  });

  it('finishing inside the window wins over a later time (ft_1_06.AC2)', () => {
    expect(run(perfect, { nowMs: 999999 }).status).toBe('passed');
  });

  it('orders presses by time and does not change its input (ft_1_06.AC2)', () => {
    const shuffled = [...perfect].reverse();
    const copy = shuffled.map((p) => ({ ...p }));
    expect(run(shuffled).status).toBe('passed');
    expect(shuffled).toEqual(copy);
  });

  it('pressKey returns a new state and leaves the old one as it was', () => {
    const s0 = startFindKey(steps, { cracks: 5 });
    const snapshot = structuredClone(s0);
    const s1 = pressKey(s0, press(1, 61));
    expect(s1).not.toBe(s0);
    expect(s0).toEqual(snapshot);
  });

  it('passes at once with no steps to play', () => {
    expect(evaluateFindKey([], [press(100, 60)], { cracks: 1 }).status).toBe('passed');
  });

  it('carries the number of cracks that break the key, and takes the rules from the options', () => {
    const s = startFindKey(sixteen, { cracks: 4, rules: { ...DEFAULT_CRACK_RULES, crackNotes: 8 } });
    expect(s.maxCracks).toBe(4);
    expect(pressKey(s, press(1, 99))).toMatchObject({ score: 50, cracks: 0 });
  });
});
