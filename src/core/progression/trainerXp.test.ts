import { describe, expect, it } from 'vitest';
import progressionJson from '../../../content/curriculum/progression.json';
import { parseProgressionConfig } from './config';
import { addTrainerXp, deriveProgress, emptyProfile } from './profile';

const config = parseProgressionConfig(progressionJson);
const profile = () => emptyProfile('p1', 'Test', '1998-10-27T09:00:00.000Z');

// Covers ft_0_17.AC3: the note-name trainer's XP is saved to the profile, counts towards the level, and is never taken away.
describe('trainer XP (ft_0_17.AC3)', () => {
  it('adds the XP to the total and the level', () => {
    const outcome = addTrainerXp(profile(), 30, config);
    expect(outcome.before.totalXp).toBe(0);
    expect(outcome.after.totalXp).toBe(30);
    expect(deriveProgress(outcome.profile, config).totalXp).toBe(30);
  });

  it('adds up over several right names and never lowers the total', () => {
    let current = profile();
    for (let i = 0; i < 5; i++) current = addTrainerXp(current, 10, config).profile;
    expect(deriveProgress(current, config).totalXp).toBe(50);
    expect(addTrainerXp(current, 0, config).after.totalXp).toBe(50);
  });

  it('ignores negative and fractional amounts: the XP is whole and never taken away', () => {
    const outcome = addTrainerXp(profile(), -5, config);
    expect(outcome.after.totalXp).toBe(0);
    expect(addTrainerXp(profile(), 10.6, config).after.totalXp).toBe(11);
  });
});
