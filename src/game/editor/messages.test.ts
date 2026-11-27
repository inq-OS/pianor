// Covers ft_1_02d.AC54: every message the piece maker says fits one line of the strip at its foot, in both languages.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { MESSAGE_PAD_X } from '../../core/layout/stripMessage';
import { language, setLanguage } from '../../core/text/language';
import { strings, type StringKey } from '../../core/text/strings';
import { stringsEt } from '../../core/text/strings.et';
import { drawnText, measure } from '../ui/pixel/font';

/** The strip's width at 320 art pixels, less its edges and the box's padding. */
const ONE_LINE = 320 - 2 * 2 - 2 * MESSAGE_PAD_X;

describe('the piece maker\'s messages (ft_1_02d.AC54)', () => {
  it('ft_1_02d.AC54 every fixed message fits one line of the strip, so none rises over the sheet', () => {
    const scene = readFileSync(new URL('../EditorScene.ts', import.meta.url), 'utf8');
    const keys = [...new Set([...scene.matchAll(/this\.say\(t\('([\w.-]+)'/g)].map((m) => m[1] as StringKey))];
    expect(keys.length).toBeGreaterThan(20);
    for (const key of keys) {
      for (const [lang, text] of [['en', strings[key]], ['et', stringsEt[key]]] as const) {
        // a number in a message is short; a name or a problem from elsewhere may still wrap
        if (/\{(problem|title|part|chord)\}/.test(text)) continue;
        const was = language();
        setLanguage(lang);
        const width = measure(drawnText(text.replace(/\{\w+\}/g, '99')));
        setLanguage(was);
        expect.soft(width, `${key}: ${text}`).toBeLessThanOrEqual(ONE_LINE);
      }
    }
  });
});
