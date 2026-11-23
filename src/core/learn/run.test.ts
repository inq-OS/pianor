// Covers ft_1_32.AC3.
import { describe, expect, it } from 'vitest';
import { chartWith } from '../../../tests/helpers/charts';
import { WaitMode } from '../judge/wait';
import type { JudgeEvent, NoteEvent } from '../judge/types';
import { LearnRunJudge, stoppedBarPlay } from './run';

const chart = chartWith([{ tick: 0, dur: 480, midi: 60 }, { tick: 480, dur: 480, midi: 62 }, { tick: 960, dur: 480, midi: 64 }]);
const press = (midi: number, timeMs: number): NoteEvent => ({ kind: 'on', midi, velocity: 80, timeMs, source: 'test' });

/** Play `keys` through a Wait mode judge, hints as given, feeding a learning run. */
function playRun(keys: readonly number[], options: { noteNames?: boolean } = {}) {
  const mode = new WaitMode(chart, { hints: { noteNames: options.noteNames ?? false, fingers: true } });
  const run = new LearnRunJudge();
  let verdict = run.verdict;
  keys.forEach((midi, i) => {
    const events: JudgeEvent[] = mode.handle(press(midi, i * 500));
    verdict = run.push(events);
  });
  return verdict;
}

describe('LearnRunJudge', () => {
  it('is perfect when every note was right the first time, finger numbers shown or not', () => {
    expect(playRun([60, 62, 64])).toEqual({ state: 'perfect' });
  });

  it('stops at the first wrong key and says what it was', () => {
    const verdict = playRun([60, 63, 62, 64]);
    expect(verdict).toMatchObject({ state: 'stopped', wrong: { midi: 63, expectedMidi: 62, bar: 0, reason: 'neighbour-key' } });
  });

  it('is still going before the last note', () => {
    expect(playRun([60, 62])).toEqual({ state: 'going' });
  });

  it('calls a run with note names shown hinted, so it does not count', () => {
    expect(playRun([60, 62, 64], { noteNames: true })).toEqual({ state: 'hinted' });
  });

  it('keeps its verdict once the run has ended', () => {
    const run = new LearnRunJudge();
    const mode = new WaitMode(chart);
    run.push(mode.handle(press(61, 0)));
    expect(run.push(mode.handle(press(60, 100)))).toMatchObject({ state: 'stopped', wrong: { midi: 61 } });
  });
});

describe('stoppedBarPlay', () => {
  const info = { at: '1998-11-22T10:00:00Z', pieceId: 'p', mode: 'wait' as const, tempoPercent: 100, section: { first: 4, last: 4 } };

  it('logs the bar a run stopped in with its miss, so the mistake markers see the mistake that ended it (ft_1_32.AC5)', () => {
    const mode = new WaitMode(chart, { hints: { noteNames: false, fingers: false } });
    const events: JudgeEvent[] = [...mode.handle(press(60, 0)), ...mode.handle(press(63, 500))];
    const wrong = new LearnRunJudge().push(events);
    if (wrong.state !== 'stopped') throw new Error('expected a stop');
    expect(stoppedBarPlay(chart, events, wrong.wrong, info)).toEqual({
      at: info.at, pieceId: 'p', bar: 4, notes: 3, firstTry: 1, timing: null, mode: 'wait', tempoPercent: 100, section: info.section,
      misses: [{ tick: 480, track: 'rh', midi: 62 }],
    });
  });

  it('keeps an earlier late note of the bar as a miss too', () => {
    const mode = new WaitMode(chart, { hints: { noteNames: false, fingers: false } });
    const events: JudgeEvent[] = [...mode.handle(press(61, 0)), ...mode.handle(press(60, 300)), ...mode.handle(press(65, 600))];
    const wrong = events.find((e) => e.type === 'NoteJudged' && e.verdict === 'wrong' && e.midi === 65);
    if (wrong?.type !== 'NoteJudged' || wrong.verdict !== 'wrong') throw new Error('expected a wrong key');
    expect(stoppedBarPlay(chart, events, wrong, { ...info, section: null })!.misses).toEqual([{ tick: 0, track: 'rh', midi: 60 }, { tick: 480, track: 'rh', midi: 62 }]);
  });
});

describe('LearnRunJudge with a baseline tempo', () => {
  const four = chartWith([60, 62, 64, 65, 67, 69].map((midi, i) => ({ tick: i * 480, dur: 480, midi })));
  const keys = [60, 62, 64, 65, 67, 69];

  function playAt(times: readonly number[], baselineBpm: number | null) {
    const mode = new WaitMode(four);
    const run = new LearnRunJudge({ chart: four, baselineBpm });
    let verdict = run.verdict;
    times.forEach((timeMs, i) => { verdict = run.push(mode.handle(press(keys[i]!, timeMs))); });
    return verdict;
  }

  it('ft_1_32.AC11 stops a run that speeds up beyond the baseline, as soon as it does', () => {
    // quarter notes every 1000 ms, then every 600 ms: 100 BPM against a baseline of 60
    expect(playAt([0, 1000, 2000, 2600, 3200, 3800], 60)).toEqual({ state: 'rushed' });
    expect(playAt([0, 1000, 2000, 3000, 4000, 5000], 60)).toEqual({ state: 'perfect' });
  });

  it('ft_1_32.AC11 never stops for speed without a baseline', () => {
    expect(playAt([0, 600, 1200, 1800, 2400, 3000], null)).toEqual({ state: 'perfect' });
  });
});

