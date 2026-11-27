import { describe, expect, it } from 'vitest';
import { compareTitles } from './titleOrder';

describe('compareTitles', () => {
  it('ft_1_36.AC24 puts numbered titles in the order of their numbers, not of their digits', () => {
    const titles = ['Song 10', 'Song 2', 'Song 1', 'Song 12', 'Song 11'];
    expect([...titles].sort(compareTitles)).toEqual(['Song 1', 'Song 2', 'Song 10', 'Song 11', 'Song 12']);
  });

  it('ft_1_36.AC24 ignores case and keeps letters in alphabet order', () => {
    expect(['b', 'A', 'c'].sort(compareTitles)).toEqual(['A', 'b', 'c']);
  });
});
