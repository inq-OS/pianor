import { describe, expect, it } from 'vitest';
import { strings, t } from './strings';
import { stringsEt } from './strings.et';

describe('t', () => {
  it('returns the text for a key', () => {
    expect(t('app.title')).toBe('Pianor');
  });

  it('fills placeholders and leaves unknown ones visible', () => {
    expect(t('menu.level', { level: 2 })).toBe('Level 2');
    expect(t('results.accuracy', { percent: 90 })).toBe('90% right the first time');
    expect(t('menu.level')).toBe('Level {level}');
  });

  it('picks the singular word after a count of one and the plural after any other count', () => {
    expect(t('tug.fact', { right: 1, total: 1 })).toBe('1 of 1 note right');
    expect(t('tug.fact', { right: 0, total: 1 })).toBe('0 of 1 note right');
    expect(t('tug.fact', { right: 2, total: 3 })).toBe('2 of 3 notes right');
    expect(t('intro.teacher.practise', { n: 1 })).toBe('You learned it. Now practice it: play it 1 more time.');
    expect(t('intro.teacher.practise', { n: 3 })).toBe('You learned it. Now practice it: play it 3 more times.');
  });

  it('every singular-or-plural choice names a count its string fills', () => {
    for (const catalog of [strings, stringsEt]) {
      for (const [key, value] of Object.entries(catalog)) {
        const filled = new Set([...value.matchAll(/\{(\w+)\}/g)].map((m) => m[1]));
        for (const choice of value.matchAll(/\{(\w+)\|[^|{}]*\|[^|{}]*\}/g)) expect(filled.has(choice[1]), key).toBe(true);
      }
    }
  });

  it('has no empty strings', () => {
    for (const value of Object.values(strings)) {
      expect(value.length).toBeGreaterThan(0);
    }
  });

  it('writes English in US spelling: practice, color, harbor', () => {
    const british = /\b(practis\w*|colour\w*|harbour\w*|favourite\w*|centre\w*)\b/i;
    expect(Object.values(strings).filter((value) => british.test(value))).toEqual([]);
  });
});
