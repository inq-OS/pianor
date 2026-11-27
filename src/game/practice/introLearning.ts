import { START_PROGRESS, type LearnProgress } from '../../core/learn/progress';
import type { Chart } from '../../core/chart';
import { LearnSession, type LearnProfile } from './LearnSession';

/**
 * The player as the intro's lesson sees it (ft_1_31.AC8): the player's own learning settings, but the lesson's progress kept
 * only for the intro (`kept`, handed on from one run to the next by `keep`), so the lesson never counts as learning the piece
 * itself, and no practice log or plays of the piece that would let it count as learned already.
 */
export function introLearnProfile(base: LearnProfile, kept: LearnProgress | undefined, keep: (progress: LearnProgress) => void): LearnProfile {
  let now = kept ?? START_PROGRESS;
  return {
    get learnSettings() {
      return base.learnSettings;
    },
    learnProgressOf: () => now,
    saveLearnProgress: (_id, progress) => {
      now = progress;
      keep(progress);
      return Promise.resolve(true);
    },
    practiceFor: () => [],
    recordFor: () => undefined,
  };
}

/**
 * The learning of the intro's lesson (`lesson`, its bars of the piece) on `today`, or null once the lesson is learned: never
 * learned anew, as learning a learned piece again is for Kiur's Learn only (ft_1_32.AC24).
 */
export function openIntroLearning(base: LearnProfile, kept: LearnProgress | undefined, keep: (progress: LearnProgress) => void, lesson: Chart, today: string): LearnSession | null {
  return LearnSession.open(introLearnProfile(base, kept, keep), lesson, today);
}
