// Covers ft_1_07.AC6.
import { describe, expect, it } from 'vitest';
import { NAME_LETTERS, NAME_MAX, nameFrom, deleteLetter, typeLetter } from './nameEntry';

describe('NAME_LETTERS', () => {
  it('is the Estonian alphabet with X and Y: 30 single letters, each once', () => {
    expect(NAME_LETTERS).toHaveLength(30);
    expect(new Set(NAME_LETTERS).size).toBe(30);
    for (const letter of NAME_LETTERS) expect([...letter]).toHaveLength(1);
    expect(NAME_LETTERS).toEqual(expect.arrayContaining(['Õ', 'Ä', 'Ö', 'Ü', 'Š', 'Ž']));
    expect(NAME_LETTERS).not.toContain('Q');
    expect(NAME_LETTERS).not.toContain('W');
  });
});

describe('typeLetter', () => {
  it('adds the letter at the end', () => {
    expect(typeLetter('', 'M')).toBe('M');
    expect(typeLetter('MA', 'Ä')).toBe('MAÄ');
  });

  it('stops at the longest name a student can type', () => {
    const full = 'A'.repeat(NAME_MAX);
    expect(typeLetter(full, 'B')).toBe(full);
  });
});

describe('deleteLetter', () => {
  it('removes the last letter, even an accented one', () => {
    expect(deleteLetter('PÄÕ')).toBe('PÄ');
  });

  it('does nothing on an empty name', () => {
    expect(deleteLetter('')).toBe('');
  });
});

describe('a name typed into the text field (ft_1_07.AC6)', () => {
  it('ft_1_07.AC6 keeps the name letters in capitals, drops anything else and stops at the longest name', () => {
    expect(nameFrom('mõ1-ri ')).toBe('MÕRI');
    expect(nameFrom('šžäöü')).toBe('ŠŽÄÖÜ');
    expect(nameFrom('abcdefghijklmnop')).toBe('ABCDEFGHIJKL');
    expect(Array.from(nameFrom('õõõõõõõõõõõõõõ')).length).toBe(NAME_MAX);
  });
});

