import { START_PROGRESS, type LearnProgress } from '../../core/learn/progress';
import type { LearnProfile } from './LearnSession';

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
