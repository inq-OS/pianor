import { describe, expect, it, afterEach } from 'vitest';
import { defaultLetterCase, displayText, language, parseLanguage, setLanguage } from './language';
import { strings, t, type StringKey } from './strings';
import { stringsEt } from './strings.et';

const keys = Object.keys(strings) as StringKey[];
const placeholders = (text: string) => [...text.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();

afterEach(() => setLanguage('en'));

describe('the Estonian catalog (ft_0_18)', () => {
  it('ft_0_18.AC2 has an Estonian entry for every English key, and no extra ones', () => {
    // The type already forces this; the test also catches a catalog that was typed loosely (a cast or a spread).
    expect(Object.keys(stringsEt).sort()).toEqual([...keys].sort());
    for (const key of keys) expect(stringsEt[key], key).not.toBe('');
  });

  it('ft_0_18.AC2 keeps the placeholders of each English string, so `t` fills the same names', () => {
    for (const key of keys) expect(placeholders(stringsEt[key]), key).toEqual(placeholders(strings[key]));
  });

  it('ft_0_18.AC2 the Estonian text reads in Estonian when the language is Estonian', () => {
    setLanguage('et');
    expect(t('menu.settingsButton')).toBe('Seaded');
    expect(t('menu.level', { level: 3 })).toBe('Tase 3');
    expect(t('editor.problemAt', { bar: 2, problem: 'takt pole täis.' })).toBe('takt 2: takt pole täis.');
  });

  it('ft_0_18.AC5 the English catalog is used with `en`, and an unknown placeholder stays visible', () => {
    setLanguage('en');
    expect(t('menu.settingsButton')).toBe('Settings');
    expect(t('menu.level', {})).toBe('Level {level}');
  });
});

describe('the letter case (ft_0_18)', () => {
  it('ft_0_18.AC1 Estonian is shown in small capitals by default (d086), English as written', () => {
    expect(defaultLetterCase('et')).toBe('smallCaps');
    expect(defaultLetterCase('en')).toBe('normal');
    // small capitals keep the case as written: the font draws the lowercase letters as small capitals
    expect(displayText('Õige noodinimi, käed ja šaš', undefined, 'et')).toBe('Õige noodinimi, käed ja šaš');
    expect(displayText('Õige noodinimi, käed ja šaš', 'upper', 'et')).toBe('ÕIGE NOODINIMI, KÄED JA ŠAŠ');
    expect(displayText('Pianor tune', undefined, 'en')).toBe('Pianor tune');
  });

  it('ft_0_18.AC1 the explicit case wins over the language default', () => {
    expect(displayText('Tubli!', 'normal', 'et')).toBe('Tubli!');
    expect(displayText('Tubli!', 'upper', 'en')).toBe('TUBLI!');
  });

  it('ft_0_18.AC1 the active language is what `displayText` uses when none is given', () => {
    setLanguage('et');
    expect(language()).toBe('et');
    expect(displayText('Mängi')).toBe('Mängi');
    expect(displayText('Mängi', 'upper')).toBe('MÄNGI');
  });

  it('parses a language switch, and anything unknown is the default', () => {
    expect(parseLanguage('en')).toBe('en');
    expect(parseLanguage('et')).toBe('et');
    expect(parseLanguage('fr')).toBe('et');
    expect(parseLanguage(null)).toBe('et');
  });
});
