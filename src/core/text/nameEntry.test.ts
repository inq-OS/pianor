// Covers ft_1_07.AC6.
import { describe, expect, it } from 'vitest';
import { NAME_LETTERS, NAME_MAX, finishedName, nameFrom, deleteLetter, typeLetter } from './nameEntry';

describe('NAME_LETTERS', () => {
  it('is the Estonian alphabet with Q, W, X and Y: 32 single letters, each once', () => {
    expect(NAME_LETTERS).toHaveLength(32);
    expect(new Set(NAME_LETTERS).size).toBe(32);
    for (const letter of NAME_LETTERS) expect([...letter]).toHaveLength(1);
    expect(NAME_LETTERS).toEqual(expect.arrayContaining(['Õ', 'Ä', 'Ö', 'Ü', 'Š', 'Ž', 'Q', 'W', 'X', 'Y']));
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

  it('takes a space or a hyphen only between letters: never first, never two in a row, never with no room for a letter after', () => {
    expect(typeLetter('', ' ')).toBe('');
    expect(typeLetter('', '-')).toBe('');
    expect(typeLetter('MARI', '-')).toBe('MARI-');
    expect(typeLetter('MARI-', ' ')).toBe('MARI-');
    expect(typeLetter('MARI-', '-')).toBe('MARI-');
    expect(typeLetter('ANNA', ' ')).toBe('ANNA ');
    expect(typeLetter('A'.repeat(NAME_MAX - 1), '-')).toBe('A'.repeat(NAME_MAX - 1));
  });

  it('takes nothing that is no name letter, space or hyphen', () => {
    expect(typeLetter('MARI', '1')).toBe('MARI');
    expect(typeLetter('MARI', '_')).toBe('MARI');
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
    expect(nameFrom('mõ1ri')).toBe('MÕRI');
    expect(nameFrom('šžäöü')).toBe('ŠŽÄÖÜ');
    expect(nameFrom('william quinn')).toBe('WILLIAM QUIN');
    expect(nameFrom('abcdefghijklmnop')).toBe('ABCDEFGHIJKL');
    expect(Array.from(nameFrom('õõõõõõõõõõõõõõ')).length).toBe(NAME_MAX);
  });

  it('ft_1_07.AC6 keeps a space or a hyphen between letters, never at the start and never two in a row', () => {
    expect(nameFrom('mari-liis')).toBe('MARI-LIIS');
    expect(nameFrom('anna maria')).toBe('ANNA MARIA');
    expect(nameFrom('  - anna')).toBe('ANNA');
    expect(nameFrom('mari -- liis')).toBe('MARI LIIS');
    expect(nameFrom('mari- liis')).toBe('MARI-LIIS');
    // a space just typed stays while the next letter is on its way
    expect(nameFrom('anna ')).toBe('ANNA ');
  });
});

describe('finishedName', () => {
  it('ft_1_07.AC6 drops a space or hyphen left at the end when the name is done', () => {
    expect(finishedName('ANNA ')).toBe('ANNA');
    expect(finishedName('MARI-')).toBe('MARI');
    expect(finishedName('MARI-LIIS')).toBe('MARI-LIIS');
    expect(finishedName('')).toBe('');
  });
});
