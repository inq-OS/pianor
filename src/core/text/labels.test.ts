import { describe, expect, it } from 'vitest';
import { fitsLabel, problemLabel, tagLabel } from './labels';

describe('labels built from string keys', () => {
  it('a tag reads through its string key, and an unknown tag falls back to its id with spaces', () => {
    expect(tagLabel('c-position')).toBe('C position');
    expect(tagLabel('my-new-tag')).toBe('my new tag');
  });

  it('a checker problem with a known rule reads through its key, with the bar in front when it has one', () => {
    expect(problemLabel({ rule: 'leap', bar: 3, message: 'bar 3, beat 2: a jump of a sixth (C4 to A4)' })).toBe('bar 3: a jump between two notes is too big.');
    expect(problemLabel({ rule: 'piece-length', message: 'the piece has 2 bars' })).toBe('the piece is too short or too long.');
  });

  it('a problem with no rule or an unknown rule keeps the checker text', () => {
    expect(problemLabel({ message: 'bar 1: something new' })).toBe('bar 1: something new');
    expect(problemLabel({ rule: 'brand-new-rule', bar: 1, message: 'bar 1: brand new' })).toBe('bar 1: brand new');
  });

  it('the levels a piece fits read as one level or a range from the string table', () => {
    expect(fitsLabel([])).toBeNull();
    expect(fitsLabel([2])).toBe('Fits level 2.');
    expect(fitsLabel([2, 3, 4])).toBe('Fits levels 2 to 4.');
  });
});
