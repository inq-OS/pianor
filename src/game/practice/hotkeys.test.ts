import { afterEach, describe, expect, it } from 'vitest';
import { setLanguage } from '../../core/text/language';
import { hotkeyLabel } from './hotkeys';

afterEach(() => setLanguage('en'));

describe('hotkeyLabel: the key in brackets after a name', () => {
  it('names the space bar in the language shown: Space in English, tühik in Estonian', () => {
    expect(hotkeyLabel('Start again', 'reset')).toBe('Start again [Space]');
    setLanguage('et');
    expect(hotkeyLabel('Uuesti algusest', 'reset')).toBe('Uuesti algusest [tühik]');
  });

  it('keeps a letter key as its letter', () => {
    setLanguage('et');
    expect(hotkeyLabel('Lõik', 'section')).toBe('Lõik [Shift+R]');
  });
});
