// Covers ft_1_29.AC1, ft_1_29.AC2 (the round's result, objective, AX-2.1).
import { describe, expect, it } from 'vitest';
import { levelReached, roundResultLine } from './trainerResult';

describe('roundResultLine', () => {
  it('says how many notes of the round were right, and the XP', () => {
    expect(roundResultLine({ unit: 'notes', right: 9, total: 15, xp: 90 })).toBe('9 of 15 notes, 90 XP');
    expect(roundResultLine({ unit: 'notes', right: 0, total: 6, xp: 0 })).toBe('0 of 6 notes, 0 XP');
    expect(roundResultLine({ unit: 'notes', right: 12, xp: 120 })).toBe('Right notes: 12, 120 XP');
  });

  it('says how many chords were played in an open round, and the XP', () => {
    expect(roundResultLine({ unit: 'chords', right: 4, xp: 120 })).toBe('Chords played: 4, 120 XP');
    expect(roundResultLine({ unit: 'chords', right: 2, total: 5, xp: 60 })).toBe('2 of 5 chords, 60 XP');
  });
});

describe('levelReached', () => {
  it('is the new level only when the XP took the player up one', () => {
    expect(levelReached(3, 4)).toBe(4);
    expect(levelReached(3, 3)).toBeNull();
  });
});
