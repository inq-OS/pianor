import type { ProfileData, ProgressSummary } from './profile';

/**
 * What the player's card shows (ft_1_20.AC13: the shield in the room opens a window with the
 * player's stats, for now what the game already tracks): the level and its XP, and counts read from the save. Pure.
 */
export interface PlayerStats {
  level: number;
  xpIntoLevel: number;
  /** XP the level takes; null at the top level. */
  xpForLevel: number | null;
  totalXp: number;
  /** Pieces played to the end at least once, and all passes of all pieces. */
  piecesPlayed: number;
  passes: number;
  /** Pieces whose best pass earned five stars. */
  fiveStarPieces: number;
  /** Levels of the campaign's monsters beaten (three a monster). */
  campaignLevelsBeaten: number;
  /** XP from the note-name trainer (ft_0_17) and points from the ear trainer (ft_1_10). */
  noteTrainerXp: number;
  earPoints: number;
}

export function playerStats(profile: ProfileData, progress: ProgressSummary): PlayerStats {
  const pieces = Object.values(progress.pieces);
  return {
    level: progress.level.level,
    xpIntoLevel: progress.level.xpIntoLevel,
    xpForLevel: progress.level.xpForLevel,
    totalXp: progress.totalXp,
    piecesPlayed: pieces.length,
    passes: pieces.reduce((sum, p) => sum + p.completions, 0),
    fiveStarPieces: pieces.filter((p) => p.bestGrade === 5).length,
    campaignLevelsBeaten: profile.campaign.beaten.flat().filter(Boolean).length,
    noteTrainerXp: profile.trainerXp,
    earPoints: profile.earPoints,
  };
}
