import { describe, expect, it } from 'vitest';
import type { JudgeEvent } from '../judge/types';
import { findKeyPressOf, pressEvents } from './findKeyPress';
import { advanceTime, startFindKey, type KeyStep } from './findKey';

const judged = (verdict: 'correct' | 'wrong', midi: number) => ({ type: 'NoteJudged', verdict, midi }) as unknown as JudgeEvent;

describe('findKeyPressOf (ft_1_06 phase 1)', () => {
  it('a right key is a press of that key at the given time', () => {
    expect(findKeyPressOf(judged('correct', 60), 1200)).toEqual({ midi: 60, timeMs: 1200 });
  });

  it('a wrong key is a press too: it slips the step in find the key', () => {
    expect(findKeyPressOf(judged('wrong', 62), 800)).toEqual({ midi: 62, timeMs: 800 });
  });

  it('other judge events press nothing', () => {
    expect(findKeyPressOf({ type: 'BarCompleted' } as unknown as JudgeEvent, 800)).toBeNull();
  });
});

describe('pressEvents (ft_1_06 phase 1, a judge batch)', () => {
  const steps: KeyStep[] = [
    { pitches: [60], beats: 1, bar: 1 },
    { pitches: [62], beats: 1, bar: 1 },
  ];
  const options = { windowMs: 10_000, cracks: 2 };

  it('right keys in order pass the part, in the order the judge reported them', () => {
    const batch = [judged('correct', 60), judged('correct', 62)] as JudgeEvent[];
    expect(pressEvents(startFindKey(steps, options), batch, 500).status).toBe('passed');
  });

  it('a wrong key in the batch slips the step, and the window is checked at the press time', () => {
    // two steps: each slip weighs 100 × 16 / 2 = 800, so a key with ten cracks survives one
    const roomy = { windowMs: 10_000, cracks: 10 };
    const slipped = pressEvents(startFindKey(steps, roomy), [judged('wrong', 61)] as JudgeEvent[], 500);
    expect(slipped).toMatchObject({ status: 'in-progress', score: 800 });
    expect(pressEvents(startFindKey(steps, roomy), [judged('correct', 60)] as JudgeEvent[], 10_000).status).toBe('window-expired');
  });

  it('ft_1_06.AC2 an expired attempt is replaced by a fresh start: its cracks are not kept and the window starts again', () => {
    const roomy = { windowMs: 10_000, cracks: 10 };
    const slipped = pressEvents(startFindKey(steps, roomy), [judged('wrong', 61)] as JudgeEvent[], 500);
    expect(slipped.cracks).toBeGreaterThan(0);
    const expired = pressEvents(slipped, [judged('correct', 60)] as JudgeEvent[], 10_000);
    expect(expired.status).toBe('window-expired');

    // the scene's retry: the same steps and options, nothing carried over
    const fresh = startFindKey(steps, roomy);
    expect(fresh).toMatchObject({ status: 'in-progress', cracks: 0, score: 0, step: 0 });
    expect(advanceTime(fresh, 9_999).status).toBe('in-progress');
    expect(advanceTime(fresh, 10_000).status).toBe('window-expired');
  });
});
