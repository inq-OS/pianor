// Covers core_09.AC8.
import { afterEach, describe, expect, it } from 'vitest';
import { setLanguage } from '../text/language';
import { abcKey, keyName, keyNames, keyTonic } from './key';

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

  it('names the key with the player\'s letter naming and the flat sign, never a plain b: H for B natural and B for B flat (d087)', () => {
    expect(keyName(5, 'major', 'H')).toBe('H major');
    expect(keyName(-2, 'major', 'H')).toBe('B major');
    expect(keyName(2, 'minor', 'H')).toBe('h minor');
    expect(keyName(-5, 'minor', 'H')).toBe('b minor');
    expect(keyName(-7, 'major', 'H')).toBe('C♭ major'); // a key keeps its own letter: C flat major is not H major
    expect(keyName(-2, 'major', 'B')).toBe('B♭ major');
    expect(keyName(5, 'major', 'B')).toBe('B major');
    expect(keyName(-6, 'major', 'B')).toBe('G♭ major');
    expect(keyName(-7, 'minor', 'B')).toBe('a♭ minor');
    expect(keyName(6, 'major', 'B')).toBe('F# major');
    for (let fifths = -7; fifths <= 7; fifths++) {
      for (const mode of ['major', 'minor'] as const) for (const naming of ['B', 'H'] as const) expect(keyName(fifths, mode, naming)).not.toMatch(/^\S+b /);
    }
  });
});

describe('Estonian key names (d087)', () => {
  afterEach(() => setLanguage('en'));

  it('names all fifteen major keys the Estonian way with H naming: the letter and is or es, with Es, As and B for the flats', () => {
    const majors = Array.from({ length: 15 }, (_, i) => keyTonic(i - 7, 'major', 'H', 'et'));
    expect(majors).toEqual(['Ces', 'Ges', 'Des', 'As', 'Es', 'B', 'F', 'C', 'G', 'D', 'A', 'E', 'H', 'Fis', 'Cis']);
  });

  it('names all fifteen minor keys the Estonian way with H naming, in small letters', () => {
    const minors = Array.from({ length: 15 }, (_, i) => keyTonic(i - 7, 'minor', 'H', 'et'));
    expect(minors).toEqual(['as', 'es', 'b', 'f', 'c', 'g', 'd', 'a', 'e', 'h', 'fis', 'cis', 'gis', 'dis', 'ais']);
  });

  it('writes the whole key name with -duur and -moll in Estonian', () => {
    setLanguage('et');
    expect(keyName(6, 'major', 'H')).toBe('Fis-duur');
    expect(keyName(-3, 'major', 'H')).toBe('Es-duur');
    expect(keyName(-2, 'major', 'H')).toBe('B-duur');
    expect(keyName(5, 'major', 'H')).toBe('H-duur');
    expect(keyName(-7, 'major', 'H')).toBe('Ces-duur');
    expect(keyName(2, 'minor', 'H')).toBe('h-moll');
    expect(keyName(5, 'minor', 'H')).toBe('gis-moll');
  });

  it('keeps the letters and the flat sign in Estonian for a player who chose B naming, so B is never B flat there', () => {
    setLanguage('et');
    expect(keyName(-2, 'major', 'B')).toBe('B♭-duur');
    expect(keyName(5, 'major', 'B')).toBe('B-duur');
    expect(keyName(6, 'major', 'B')).toBe('F#-duur');
    expect(keyName(-6, 'minor', 'B')).toBe('e♭-moll');
  });

  it('keeps English key names English with H naming: F# major, not Fis', () => {
    expect(keyTonic(6, 'major', 'H', 'en')).toBe('F#');
    expect(keyTonic(-3, 'minor', 'H', 'en')).toBe('c');
    expect(keyTonic(-6, 'minor', 'H', 'en')).toBe('e♭');
  });
});
