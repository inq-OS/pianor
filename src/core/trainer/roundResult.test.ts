// Covers ft_0_17.AC11: the end of a round says, in one objective line, how many were right and the XP earned.
import { afterEach, describe, expect, it } from 'vitest';
import { setLanguage } from '../text/language';
import { roundResultLine } from './roundResult';

describe('a trainer round result line (ft_0_17.AC11)', () => {
  afterEach(() => setLanguage('en'));

  it('ft_0_17.AC11: says the count and the XP, with one or many', () => {
    expect(roundResultLine(12, 110)).toBe('12 correct, 110 XP');
    expect(roundResultLine(1, 10)).toBe('1 correct, 10 XP');
    expect(roundResultLine(0, 0)).toBe('0 correct, 0 XP');
  });

  it('ft_0_17.AC11: in Estonian a number other than one takes the partitive', () => {
    setLanguage('et');
    expect(roundResultLine(12, 110)).toBe('12 õiget, 110 XP');
    expect(roundResultLine(1, 10)).toBe('1 õige, 10 XP');
  });
});
