// Covers ft_1_10.AC5 (points only grow; a new player has none) and ft_1_10.AC9 (ear points are not XP: the level and the total XP do not read them).
import { describe, expect, it } from 'vitest';
import progressionJson from '../../../content/curriculum/progression.json';
import { parseProgressionConfig } from './config';
import { addEarPoints, deriveProgress, emptyProfile } from './profile';

const config = parseProgressionConfig(progressionJson);
const NOW = '1998-10-30T09:00:00.000Z';

describe('ear points in the profile (ft_1_10 AC5, AC9)', () => {
  it('a new player has no ear points and the defaults of the ear trainer', () => {
    const profile = emptyProfile('p', 'P', NOW);
    expect(profile.earPoints).toBe(0);
    expect(profile.settings.earTrainer).toEqual({ seconds: 1, repeat: true });
  });

  it('points add up and never go down', () => {
    const profile = emptyProfile('p', 'P', NOW);
    const once = addEarPoints(profile, 50);
    expect(once.earPoints).toBe(50);
    expect(addEarPoints(once, 0).earPoints).toBe(50);
    expect(addEarPoints(once, 100).earPoints).toBe(150);
  });

  it('rejects a negative or fractional amount', () => {
    const profile = emptyProfile('p', 'P', NOW);
    expect(() => addEarPoints(profile, -1)).toThrow(RangeError);
    expect(() => addEarPoints(profile, 2.5)).toThrow(RangeError);
  });

  it('ear points do not change the total XP or the level', () => {
    const profile = emptyProfile('p', 'P', NOW);
    const before = deriveProgress(profile, config);
    const after = deriveProgress(addEarPoints(profile, 5000), config);
    expect(after.totalXp).toBe(before.totalXp);
    expect(after.level).toEqual(before.level);
  });
});
