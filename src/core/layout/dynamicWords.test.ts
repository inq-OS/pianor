// Covers core_09.AC15.
import { describe, expect, it } from 'vitest';
import { wordFits } from './dynamicWords';

const S = 10;
describe('dynamic words (core_09.AC15)', () => {
  it('keeps a word that has room before the next mark on the same staff', () => {
    expect(wordFits([{ system: 0, staff: 0, column: 0, word: 'VAIKSELT' }, { system: 0, staff: 0, column: 2000, word: 'VALJULT' }], S)).toEqual([true, true]);
  });

  it('drops a word that would run into the next mark, and keeps the other', () => {
    expect(wordFits([{ system: 0, staff: 0, column: 0, word: 'VÄGA VALJULT' }, { system: 0, staff: 0, column: 60, word: 'p' }], S)).toEqual([false, true]);
  });

  it('ignores marks on another staff or system', () => {
    expect(wordFits([{ system: 0, staff: 0, column: 0, word: 'VÄGA VALJULT' }, { system: 0, staff: 1, column: 100, word: 'p' }, { system: 1, staff: 0, column: 100, word: 'p' }], S)).toEqual([true, true, true]);
  });
});
