import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import littleSteps from '../../../tests/fixtures/charts/little-steps.v2.json';
import { chartSchema } from '../../core/chart';
import { DEFAULT_TEMPO_WINDOWS, TempoMode, WaitMode, buildSteps, type JudgeEvent, type NoteMissed, type PieceCompleted, type WrongNoteJudged } from '../../core/judge';
import { Transport } from '../../core/transport';
import type { TimedNoteEvent } from '../../io/mock/performance';
import shippedLittleSteps from '../../../content/dev/charts/little-steps.chart.json';
import { findScenario, scenarioSchema, type Scenario } from './scenario';
import { planMistakes, scenarioPerformance } from './scenarioPerformance';

const chart = chartSchema.parse(littleSteps);
const steps = buildSteps(chart).length;

const scenario = (extra: Record<string, unknown> = {}): Scenario =>
  scenarioSchema.parse({ id: 'test', title: 'Test', mode: 'wait', player: { style: 'clean' }, ...extra });
const messy = (extra: Record<string, unknown> = {}, player: Record<string, unknown> = {}): Scenario =>
  scenario({ player: { style: 'messy', skips: 0, ...player }, ...extra });

const asNote = (e: TimedNoteEvent) => ({ kind: e.kind, midi: e.midi, velocity: e.velocity, timeMs: e.atMs, source: 'test' }) as const;

function judgeWait(s: Scenario): JudgeEvent[] {
  const mode = new WaitMode(chart);
  return scenarioPerformance(chart, s).events.flatMap((e) => mode.handle(asNote(e)));
}

/** Tempo mode as the game runs it: a starting key, then every key at its time; the clock moves on to the end. */
function judgeTempo(s: Scenario): JudgeEvent[] {
  const transport = new Transport(chart);
  const mode = new TempoMode(chart, transport);
  const events: JudgeEvent[] = mode.handle({ kind: 'on', midi: 60, velocity: 80, timeMs: 1000, source: 'test' });
  const { events: keys } = scenarioPerformance(chart, s, { startMs: transport.timeOfTick(0)! });
  for (const e of keys) events.push(...mode.handle(asNote(e)));
  events.push(...mode.advance(transport.timeOfTick(chart.notes.at(-1)!.tick)! + 10_000));
  return events;
}

const wrongs = (events: JudgeEvent[]) => events.filter((e): e is WrongNoteJudged => e.type === 'NoteJudged' && e.verdict === 'wrong');
const missed = (events: JudgeEvent[]) => events.filter((e): e is NoteMissed => e.type === 'NoteMissed');
const completed = (events: JudgeEvent[]) => events.find((e): e is PieceCompleted => e.type === 'PieceCompleted')!;

describe('scenarioPerformance', () => {
  // ft_Y_09.AC3
  it('gives the same run for the same scenario and seed, and another run for another seed', () => {
    const s = messy({ seed: 11 });
    expect(scenarioPerformance(chart, s)).toEqual(scenarioPerformance(chart, s));
    expect(scenarioPerformance(chart, s)).not.toEqual(scenarioPerformance(chart, messy({ seed: 12 })));
    expect(scenarioPerformance(chart, messy({ seed: 11 }, { jitterMs: 60 }))).not.toEqual(scenarioPerformance(chart, s));
  });

  it('a clean player plays every note exactly on its time: no mistakes, accuracy 1', () => {
    const { events, mistakes, jitterMs } = scenarioPerformance(chart, scenario());
    expect(mistakes).toEqual([]);
    expect(jitterMs).toBe(0);
    expect(events.filter((e) => e.kind === 'on').map((e) => e.midi)).toEqual(chart.notes.map((n) => n.midi));
    expect(completed(judgeWait(scenario())).result).toMatchObject({ accuracy: 1, mistakes: 0 });
  });

  it('puts the first note at startMs and scales with speed', () => {
    const first = (s: Scenario, startMs?: number) => scenarioPerformance(chart, s, startMs === undefined ? {} : { startMs }).events.filter((e) => e.kind === 'on');
    expect(first(scenario(), 5000)[0]!.atMs).toBe(5000);
    expect(first(scenario({ speed: 2 }))[1]!.atMs).toBeCloseTo(first(scenario())[1]!.atMs / 2, 6);
  });

  // ft_Y_09.AC3
  it('a messy player makes exactly the planned wrong keys in Wait mode, each of its kind, and still finishes', () => {
    const s = messy({ seed: 3 }, { wrongKeys: 4 });
    const { mistakes } = scenarioPerformance(chart, s);
    expect(mistakes).toHaveLength(4);
    const events = judgeWait(s);
    expect(wrongs(events).map((e) => e.stepIndex)).toEqual(mistakes.map((m) => m.stepIndex));
    expect(wrongs(events).map((e) => e.reason)).toEqual(mistakes.map((m) => m.kind));
    expect(completed(events).result.mistakes).toBe(4);
  });

  // ft_Y_09.AC3
  it('a messy player in Tempo mode makes the planned wrong keys, skips the planned notes, and mistimes the rest', () => {
    const s = messy({ mode: 'tempo', seed: 7 }, { wrongKeys: 3, skips: 1, jitterMs: 220 });
    const { mistakes } = scenarioPerformance(chart, s);
    const events = judgeTempo(s);
    expect(wrongs(events)).toHaveLength(3);
    expect(missed(events).map((e) => e.stepIndex)).toEqual(mistakes.filter((m) => m.kind === 'skip').map((m) => m.stepIndex));
    const timing = completed(events).result.timing!;
    expect(timing.missed).toBe(1);
    expect(timing.played).toBe(chart.notes.length - 1);
    expect(timing.early + timing.late).toBeGreaterThan(0); // the colours have something to show
    expect(timing.score).toBeLessThan(100);
  });

  it('gives the same Tempo-mode result every time for the same seed', () => {
    const s = messy({ mode: 'tempo', seed: 7 }, { skips: 1 });
    expect(completed(judgeTempo(s)).result).toEqual(completed(judgeTempo(s)).result);
  });

  it('a clean Tempo-mode player is on time for every note', () => {
    const timing = completed(judgeTempo(scenario({ mode: 'tempo' }))).result.timing!;
    expect(timing).toMatchObject({ played: chart.notes.length, onTime: chart.notes.length, missed: 0, score: 100 });
  });

  it('never keeps a note from being played after the one that follows it, even fast and with a lot of jitter', () => {
    const { events, jitterMs } = scenarioPerformance(chart, messy({ speed: 8 }, { jitterMs: 300 }));
    expect(jitterMs).toBeLessThan(300);
    const ons = events.filter((e) => e.kind === 'on' && chart.notes.some((n) => n.midi === e.midi));
    expect(ons.length).toBeGreaterThan(0);
    expect(events.map((e) => e.atMs)).toEqual([...events.map((e) => e.atMs)].sort((a, b) => a - b));
  });
});

describe('planMistakes', () => {
  const player = (wrongKeys: number, skips: number) => scenarioSchema.parse({ id: 'p', title: 'P', mode: 'tempo', player: { style: 'messy', wrongKeys, skips } }).player;

  it('plans nothing for a clean player', () => {
    expect(planMistakes(chart, scenario().player, 1)).toEqual([]);
  });

  it('plans distinct steps, never the first, as many as asked (or as many as fit), sorted by step (property)', () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 100_000 }), fc.integer({ min: 0, max: 20 }), fc.integer({ min: 0, max: 10 }), (seed, wrongKeys, skips) => {
        const planned = planMistakes(chart, player(wrongKeys, skips), seed);
        const stepsUsed = planned.map((m) => m.stepIndex);
        expect(new Set(stepsUsed).size).toBe(stepsUsed.length);
        expect(stepsUsed.every((i) => i >= 1 && i < steps)).toBe(true);
        expect(stepsUsed).toEqual([...stepsUsed].sort((a, b) => a - b));
        expect(planned.filter((m) => m.kind !== 'skip').length).toBe(Math.min(wrongKeys, steps - 1));
        expect(planned.filter((m) => m.kind === 'skip').length).toBe(Math.min(skips, steps - 1 - Math.min(wrongKeys, steps - 1)));
      }),
    );
  });

  it('every planned wrong key is really wrong for its step, so the judge names the planned reason (property)', () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 100_000 }), (seed) => {
        const s = messy({ seed }, { wrongKeys: 5 });
        const events = judgeWait(s);
        const planned = planMistakes(chart, s.player, seed);
        expect(wrongs(events).map((e) => e.reason)).toEqual(planned.map((m) => m.kind));
        expect(completed(events).result.mistakes).toBe(5);
      }),
      { numRuns: 60 },
    );
  });
});

describe('the shipped messy-tempo scenario', () => {
  // The end-to-end test plays it twice and wants the same verdicts: a note planned a few ms from the on-time edge would flip with
  // the live clock's noise, so every planned timing keeps a clear margin from that edge.
  it('keeps every planned timing at least 20 ms from the on-time edge, with early and late notes', () => {
    const shipped = chartSchema.parse(shippedLittleSteps);
    const s = findScenario('messy-tempo');
    const transport = new Transport(shipped);
    const mode = new TempoMode(shipped, transport);
    const events: JudgeEvent[] = mode.handle({ kind: 'on', midi: shipped.notes[0]!.midi, velocity: 80, timeMs: 1000, source: 'test' });
    for (const e of scenarioPerformance(shipped, s, { startMs: transport.timeOfTick(0)! }).events) events.push(...mode.handle(asNote(e)));
    events.push(...mode.advance(transport.timeOfTick(shipped.notes.at(-1)!.tick)! + 10_000));
    const errors = events.flatMap((e) => (e.type === 'NoteJudged' && e.verdict !== 'wrong' && e.timing ? [e.timing.errorMs] : []));
    expect(errors.length).toBeGreaterThan(0);
    for (const errorMs of errors) expect(Math.abs(Math.abs(errorMs) - DEFAULT_TEMPO_WINDOWS.goodMs), `error ${errorMs}`).toBeGreaterThanOrEqual(20);
    const timing = completed(events).result.timing!;
    expect(timing.early).toBeGreaterThan(0);
    expect(timing.late).toBeGreaterThan(0);
  });
});
