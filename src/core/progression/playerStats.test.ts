// Covers ft_1_20.AC13 (the player's card behind the shield in the room).
import { describe, expect, it } from 'vitest';
import progressionJson from '../../../content/curriculum/progression.json';
import fixture from '../../../tests/fixtures/saves/profile.v17.json';
import { parseProgressionConfig } from './config';
import { parseProfile } from './migrate';
import { deriveProgress, emptyProfile } from './profile';
import { playerStats } from './playerStats';

const config = parseProgressionConfig(progressionJson);

describe('the player\'s card (ft_1_20.AC13)', () => {
  it('ft_1_20.AC13 a new player has level 1 and nothing played', () => {
    const profile = emptyProfile('p1', 'Tuvi', '1998-11-12T00:00:00Z');
    expect(playerStats(profile, deriveProgress(profile, config))).toEqual({
      level: 1, xpIntoLevel: 0, xpForLevel: 100, totalXp: 0,
      piecesPlayed: 0, passes: 0, fiveStarPieces: 0,
      campaignLevelsBeaten: 0,
      noteTrainerXp: 0, earPoints: 0,
    });
  });

  it('ft_1_20.AC13 counts what the save holds: pieces, passes, five-star pieces, the campaign and the trainers', () => {
    const migrated = parseProfile(fixture, config);
    if (!migrated.ok) throw new Error(migrated.errors.join(', '));
    const profile = { ...migrated.profile, trainerXp: 12, earPoints: 7 };
    const progress = deriveProgress(profile, config);
    const stats = playerStats(profile, progress);
    expect(stats.totalXp).toBe(progress.totalXp);
    expect(stats.level).toBe(progress.level.level);
    expect(stats.piecesPlayed).toBe(Object.keys(progress.pieces).length);
    expect(stats.passes).toBe(profile.attempts.length);
    expect(stats.fiveStarPieces).toBe(Object.values(progress.pieces).filter((p) => p.bestGrade === 5).length);
    expect(stats.campaignLevelsBeaten).toBe(profile.campaign.beaten.flat().filter(Boolean).length);
    expect([stats.noteTrainerXp, stats.earPoints]).toEqual([12, 7]);
  });
});
