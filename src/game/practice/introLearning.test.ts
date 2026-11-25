import { describe, expect, it } from 'vitest';
import { DEFAULT_LEARN_SETTINGS, START_PROGRESS, type LearnProgress } from '../../core/learn/progress';
import type { LearnProfile } from './LearnSession';
import { chartWith } from '../../../tests/helpers/charts';
import { introLearnProfile, openIntroLearning } from './introLearning';

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

describe('the intro lesson once learned', () => {
  it('ft_1_32.AC24 a lesson the intro has learned is not learned again', () => {
    const lesson = chartWith([60, 62, 64, 65].map((midi, i) => ({ tick: i * 480, dur: 480, midi })));
    const keep = () => undefined;
    expect(openIntroLearning(player, undefined, keep, lesson, '1998-11-22')).not.toBeNull();
    // the one-bar lesson's plan is two steps: done
    const learned: LearnProgress = { ...START_PROGRESS, step: 2, lastDay: '1998-11-22', stepBars: 1, handsApart: false, medals: ['gold', 'gold'], learnedAt: '1998-11-22T10:00:00.000Z' };
    expect(openIntroLearning(player, learned, keep, lesson, '1998-11-22')).toBeNull();
  });
});
