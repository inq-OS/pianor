import { describe, expect, it } from 'vitest';
import { freeTitle, titleProblem } from './title';

describe('a piece title', () => {
  it('ft_1_02a.AC15 refuses an empty title or one of spaces', () => {
    expect(titleProblem('', [])).toBe('blank');
    expect(titleProblem('   ', [])).toBe('blank');
  });

  it('ft_1_02a.AC15 refuses a title another piece has, whatever its case and spaces', () => {
    const taken = ['Twinkle Star', 'Väike täht'];
    expect(titleProblem('twinkle star', taken)).toBe('taken');
    expect(titleProblem('  TWINKLE   star ', taken)).toBe('taken');
    expect(titleProblem('VÄIKE TÄHT', taken)).toBe('taken');
    expect(titleProblem('Twinkle Stars', taken)).toBeNull();
  });

  it('ft_1_02a.AC15 an imported or photographed piece whose title is taken gets the next free number', () => {
    expect(freeTitle('Waltz', [])).toBe('Waltz');
    expect(freeTitle('Waltz', ['waltz'])).toBe('Waltz 2');
    expect(freeTitle('Waltz', ['WALTZ', 'waltz 2'])).toBe('Waltz 3');
    expect(freeTitle('  ', [])).toBe('');
  });
});
