// Covers core_09.AC8.
import { describe, expect, it } from 'vitest';
import { abcKey, keyLabel, keyNames } from './key';

describe('keys of the piece editor (core_09.AC8)', () => {
  it('names the major key and its relative minor for every key of the circle of fifths', () => {
    expect(keyNames(0)).toEqual({ major: 'C', minor: 'A' });
    expect(keyNames(1)).toEqual({ major: 'G', minor: 'E' });
    expect(keyNames(-3)).toEqual({ major: 'Eb', minor: 'C' });
    expect(keyNames(-7)).toEqual({ major: 'Cb', minor: 'Ab' });
    expect(keyNames(7)).toEqual({ major: 'C#', minor: 'A#' });
    // the signature button's name follows the letter naming too (d087)
    expect(keyNames(-2, 'H')).toEqual({ major: 'B', minor: 'G' });
    expect(keyNames(2, 'H')).toEqual({ major: 'D', minor: 'H' });
    expect(keyNames(-5, 'H')).toEqual({ major: 'Db', minor: 'B' });
    expect(keyNames(-7, 'H')).toEqual({ major: 'Cb', minor: 'Ab' });
  });

  it('writes the key for a K: line, with m for a minor key', () => {
    expect(abcKey(0, 'major')).toBe('C');
    expect(abcKey(1, 'minor')).toBe('Em');
    expect(abcKey(-2, 'major')).toBe('Bb');
    expect(abcKey(-7, 'minor')).toBe('Abm');
  });

  it('names the key on the key button with the player\'s letter naming: H for B natural and B for B flat (d087)', () => {
    expect(keyLabel(5, 'major', 'H')).toBe('H');
    expect(keyLabel(-2, 'major', 'H')).toBe('B');
    expect(keyLabel(2, 'minor', 'H')).toBe('Hm');
    expect(keyLabel(-5, 'minor', 'H')).toBe('Bm');
    expect(keyLabel(1, 'minor', 'H')).toBe('Em');
    expect(keyLabel(-7, 'major', 'H')).toBe('Cb'); // a key keeps its own letter: C flat major is not H major
    expect(keyLabel(-2, 'major', 'B')).toBe('Bb');
    expect(keyLabel(5, 'major', 'B')).toBe('B');
  });
});
