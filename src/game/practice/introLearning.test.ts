import { describe, expect, it } from 'vitest';
import { DEFAULT_LEARN_SETTINGS, START_PROGRESS, type LearnProgress } from '../../core/learn/progress';
import type { LearnProfile } from './LearnSession';
import { introLearnProfile } from './introLearning';

const player: LearnProfile = {
  learnSettings: DEFAULT_LEARN_SETTINGS,
  learnProgressOf: () => ({ ...START_PROGRESS, step: 7 }),
  saveLearnProgress: () => Promise.reject(new Error('the lesson must not save the piece')),
  practiceFor: () => [{ bar: 0, perfect: true } as never],
  recordFor: () => ({ completions: 5 }),
};

describe('the intro lesson learns on its own', () => {
  it('ft_1_31.AC8 starts from the beginning, keeps its steps for the next run only, and never saves the piece', async () => {
    const kept: LearnProgress[] = [];
    const lesson = introLearnProfile(player, undefined, (p) => kept.push(p));
    expect(lesson.learnProgressOf('twinkle-twinkle')).toEqual(START_PROGRESS);
    expect(lesson.practiceFor('twinkle-twinkle')).toEqual([]);
    expect(lesson.recordFor('twinkle-twinkle')).toBeUndefined();
    const next = { ...START_PROGRESS, step: 1 };
    await expect(lesson.saveLearnProgress('twinkle-twinkle', next)).resolves.toBe(true);
    expect(kept).toEqual([next]);
    // the next run of the lesson goes on from there
    expect(introLearnProfile(player, next, () => undefined).learnProgressOf('twinkle-twinkle')).toEqual(next);
  });
});
