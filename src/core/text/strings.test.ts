import { describe, expect, it } from 'vitest';
import { strings, t } from './strings';

describe('t', () => {
  it('returns the text for a key', () => {
    expect(t('app.title')).toBe('Pianor');
  });

  it('fills placeholders and leaves unknown ones visible', () => {
    expect(t('menu.level', { level: 2 })).toBe('Level 2');
    expect(t('results.accuracy', { percent: 90 })).toBe('90% right the first time');
    expect(t('menu.level')).toBe('Level {level}');
  });

  it('has no empty strings', () => {
    for (const value of Object.values(strings)) {
      expect(value.length).toBeGreaterThan(0);
    }
  });
});
