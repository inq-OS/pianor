// Covers ft_1_07.AC10 (a name given in the name box is shown whole on the main menu).
import { afterEach, describe, expect, it } from 'vitest';
import { MAIN_MENU } from '../../../core/layout/mainMenu';
import { setLanguage } from '../../../core/text/language';
import { NAME_LETTERS, NAME_MAX } from '../../../core/text/nameEntry';
import { drawnText, measure } from './font';

describe('a name on the main menu', () => {
  afterEach(() => setLanguage('en'));

  it.each(['en', 'et'] as const)('the longest name the name box takes, in its widest letters, fits a line of the sheet whole (%s)', (lang) => {
    setLanguage(lang);
    const widest = NAME_LETTERS.reduce((best, letter) => (measure(drawnText(letter)) > measure(drawnText(best)) ? letter : best));
    const name = widest.repeat(NAME_MAX);
    expect(measure(drawnText(name))).toBeLessThanOrEqual(MAIN_MENU.line.w - MAIN_MENU.line.margin);
  });
});
