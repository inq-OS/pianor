// The two-hand count of Wait mode, which the two-hands bonus pays for (ft_1_13, the bonus in src/core/scoring/handsBonus.ts).
import { describe, expect, it } from 'vitest';
import { chartWith } from '../../../tests/helpers/charts';
import type { JudgeEvent, NoteEvent, PieceCompleted } from './types';
import { WaitMode } from './wait';

const on = (midi: number, timeMs: number): NoteEvent => ({ kind: 'on', midi, velocity: 80, timeMs, source: 'test' });

/** Two two-hand steps (C4 over C3, D4 over D3), then a right-hand step alone. */
const twoHands = chartWith([
  { tick: 0, dur: 480, midi: 60 }, { tick: 0, dur: 480, midi: 48, track: 'lh' },
  { tick: 480, dur: 480, midi: 62 }, { tick: 480, dur: 480, midi: 50, track: 'lh' },
  { tick: 960, dur: 480, midi: 64 },
]);

/** Hands taking turns: never both hands in one step. */
const turns = chartWith([
  { tick: 0, dur: 1920, midi: 60 }, { tick: 1920, dur: 1920, midi: 48, track: 'lh' },
]);

function bothHands(chart: ReturnType<typeof chartWith>, events: NoteEvent[]) {
  const mode = new WaitMode(chart);
  const out: JudgeEvent[] = events.flatMap((e) => mode.handle(e));
  const done = out.find((e): e is PieceCompleted => e.type === 'PieceCompleted');
  expect(done).toBeDefined();
  return { bothHands: done!.result.bothHands, accuracy: done!.result.accuracy, mistakes: done!.result.mistakes };
}

describe('Wait mode: two-hand steps played together', () => {
  it('both keys of a step within 300 ms count as together, in either order', () => {
    expect(bothHands(twoHands, [on(60, 0), on(48, 20), on(50, 1000), on(62, 1290), on(64, 2000)]).bothHands).toEqual({ notes: 4, together: 4 });
  });

  it('keys 350 ms apart are right but not together: all stars, no bonus', () => {
    const result = bothHands(twoHands, [on(60, 0), on(48, 350), on(62, 1000), on(50, 1350), on(64, 2000)]);
    expect(result).toMatchObject({ accuracy: 1, mistakes: 0, bothHands: { notes: 4, together: 0 } });
  });

  it('a wrong key in a step costs that step its together count, and only that step', () => {
    const result = bothHands(twoHands, [on(61, 0), on(60, 10), on(48, 20), on(62, 1000), on(50, 1010), on(64, 2000)]);
    expect(result).toMatchObject({ mistakes: 1, bothHands: { notes: 4, together: 2 } });
  });

  it('hands taking turns have no two-hand step, so nothing counts', () => {
    expect(bothHands(turns, [on(60, 0), on(48, 1000)]).bothHands).toEqual({ notes: 0, together: 0 });
  });
});
