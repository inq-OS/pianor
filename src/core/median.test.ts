import { describe, expect, it } from 'vitest';
import { median } from './median';

describe('median', () => {
  it('takes the middle value of an odd count and the mean of the two middle ones of an even count, in any order', () => {
    expect(median([3, 1, 2])).toBe(2);
    expect(median([4, 1, 3, 2])).toBe(2.5);
    expect(median([-5])).toBe(-5);
  });

  it('gives null for no values and leaves its input unsorted', () => {
    expect(median([])).toBeNull();
    const values = [3, 1, 2];
    median(values);
    expect(values).toEqual([3, 1, 2]);
  });
});
