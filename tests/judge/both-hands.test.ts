// Covers ft_0_15.AC2, ft_0_15.AC3.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { chartSchema } from '../../src/core/chart';
import { WaitMode, buildSteps, type JudgeEvent, type NoteEvent } from '../../src/core/judge';
import { bothHandsMultiplier } from '../../src/core/scoring/handsBonus';
import { composePerformance } from '../../src/io/mock/performance';

const load = (name: string) => chartSchema.parse(JSON.parse(readFileSync(join(__dirname, `../golden/${name}.chart.json`), 'utf-8')));
const hands = load('hands-together');
const single = load('little-steps');

const play = (chart: typeof hands, options: Parameters<typeof composePerformance>[1] = {}, windowMs?: number) => {
  const mode = new WaitMode(chart, windowMs === undefined ? {} : { togetherWindowMs: windowMs });
  const events: JudgeEvent[] = composePerformance(chart, options).flatMap((e) =>
    mode.handle({ kind: e.kind, midi: e.midi, velocity: e.velocity, timeMs: e.atMs, source: 'test' } satisfies NoteEvent),
  );
  const piece = events.find((e): e is Extract<JudgeEvent, { type: 'PieceCompleted' }> => e.type === 'PieceCompleted')!.result;
  return { piece, events, mode };
};

describe('steps know their hands', () => {
  it('marks steps where both hands play, and steps with one hand', () => {
    expect(buildSteps(hands).map((s) => s.hands)).toEqual([
      ['RH', 'LH'], ['RH'], ['RH', 'LH'], ['LH'], ['RH', 'LH'], ['RH'], ['RH', 'LH'],
    ]);
  });

  it('a single-hand piece has one hand in every step', () => {
    expect(buildSteps(single).every((s) => s.hands.length === 1 && s.hands[0] === 'RH')).toBe(true);
  });
});

describe('two-hand play is measured for the bonus', () => {
  it('counts the notes of two-hand steps and, played together, all of them are together', () => {
    const { piece } = play(hands, { chordSpreadMs: 15 });
    expect(piece.bothHands).toEqual({ notes: 8, together: 8 });
    expect(piece.accuracy).toBe(1);
    expect(bothHandsMultiplier(piece)).toBeCloseTo(1 + 0.5 * (8 / 11), 10);
  });

  it('hands pressed far apart still finish the piece (nothing is punished) but earn no bonus', () => {
    const { piece } = play(hands, { chordSpreadMs: 600 });
    expect(piece.bothHands).toEqual({ notes: 8, together: 0 });
    expect(piece.accuracy).toBe(1);
    expect(bothHandsMultiplier(piece)).toBe(1);
  });

  it('the window is 300 ms by default and its edge counts as together', () => {
    expect(play(hands, { chordSpreadMs: 300 }).piece.bothHands.together).toBe(8);
    expect(play(hands, { chordSpreadMs: 301 }).piece.bothHands.together).toBe(0);
  });

  it('the window can be changed', () => {
    expect(play(hands, { chordSpreadMs: 450 }, 500).piece.bothHands.together).toBe(8);
    expect(play(hands, { chordSpreadMs: 100 }, 50).piece.bothHands.together).toBe(0);
  });

  it('the order of the hands does not matter', () => {
    for (const chordOrder of ['ascending', 'descending', 'shuffled'] as const) {
      expect(play(hands, { chordSpreadMs: 20, chordOrder, seed: 4 }).piece.bothHands.together).toBe(8);
    }
  });

  it('a wrong key in a two-hand step means that step is not together, even if the keys are quick', () => {
    const { piece } = play(hands, { chordSpreadMs: 15, mistakes: [{ stepIndex: 0, kind: 'neighbour-key' }] });
    expect(piece.bothHands).toEqual({ notes: 8, together: 6 });
    expect(piece.mistakes).toBe(1);
  });

  it('single-hand pieces have no two-hand notes and a multiplier of exactly 1', () => {
    const { piece } = play(single);
    expect(piece.bothHands).toEqual({ notes: 0, together: 0 });
    expect(bothHandsMultiplier(piece)).toBe(1);
  });

  it('bars and phrases carry their own two-hand counts that add up to the piece', () => {
    const { events, piece } = play(hands, { chordSpreadMs: 15 });
    const bars = events.flatMap((e) => (e.type === 'BarCompleted' ? [e.result] : []));
    expect(bars.map((b) => b.bothHands)).toEqual([{ notes: 2, together: 2 }, { notes: 2, together: 2 }, { notes: 2, together: 2 }, { notes: 2, together: 2 }]);
    expect(bars.reduce((sum, b) => sum + b.bothHands.together, 0)).toBe(piece.bothHands.together);
    const phrase = events.find((e) => e.type === 'PhraseCompleted');
    expect(phrase && 'result' in phrase && phrase.result.bothHands).toEqual({ notes: 8, together: 8 });
  });

  it('a hand played with ties or released keys is judged only by when its keys were pressed', () => {
    const mode = new WaitMode(hands);
    const on = (midi: number, timeMs: number): NoteEvent => ({ kind: 'on', midi, velocity: 80, timeMs, source: 't' });
    mode.handle(on(60, 0));
    mode.handle({ kind: 'off', midi: 60, velocity: 0, timeMs: 50, source: 't' }); // released early, still counts
    mode.handle(on(48, 200));
    expect(mode.getState().stepIndex).toBe(1);
  });
});
