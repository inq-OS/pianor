import { afterEach, describe, expect, it } from 'vitest';
import { setLanguage } from '../../../core/text/language';
import { stringsEt } from '../../../core/text/strings.et';
import { inkBounds } from './bitmap';
import { CAP_HEIGHT, drawnText, glyphFor, hasGlyph, LINE_GAP, LINE_HEIGHT, measure, renderText } from './font';

const ESTONIAN_CAPITALS = ['Õ', 'Ä', 'Ö', 'Ü', 'Š', 'Ž'];

afterEach(() => setLanguage('en'));

/** The top row of ink of a text drawn in Estonian, without a shadow. */
const inkTop = (text: string) => inkBounds(renderText(drawnText(text), { color: 1 }))!.top;

describe('the pixel font for Estonian letters (ft_0_18, d086)', () => {
  it('ft_0_18.AC3 Õ Ä Ö Ü Š Ž each have a glyph with the mark inside the seven-row capital height', () => {
    for (const ch of ESTONIAN_CAPITALS) {
      expect(hasGlyph(ch), ch).toBe(true);
      expect(glyphFor(ch).rows.length, ch).toBe(CAP_HEIGHT);
      expect(glyphFor(ch).rows[0], ch).toContain('#');
    }
    // the line over Õ and the dots over Ö differ, so the two letters read apart
    expect(glyphFor('Õ').rows[0]).not.toBe(glyphFor('Ö').rows[0]);
  });

  it('ft_0_18.AC2 every Estonian string, as drawn, has no missing-glyph block', () => {
    setLanguage('et');
    const missing = new Set<string>();
    for (const text of Object.values(stringsEt)) {
      for (const ch of drawnText(text.replace(/\{\w+\}/g, '0'))) if (!hasGlyph(ch)) missing.add(ch);
    }
    expect([...missing]).toEqual([]);
  });

  it('ft_0_18.AC3 d086 an uppercase letter is a full capital, a lowercase letter a small capital two rows lower', () => {
    setLanguage('et');
    expect(inkTop('M')).toBe(0);
    expect(inkTop('m')).toBe(CAP_HEIGHT - 5);
    // a small capital is as wide as the capital, so a label keeps its width
    expect(measure(drawnText('Tagasi'))).toBeGreaterThan(measure('Tagasi') - 3);
  });

  it('ft_0_18.AC3 d086 a text with Õ Ä Ö Ü is as tall as one without, and its marks start on the top row', () => {
    setLanguage('et');
    expect(renderText(drawnText('Mängi'), { color: 1 }).height).toBe(renderText(drawnText('Tagasi'), { color: 1 }).height);
    expect(renderText(drawnText('Üks'), { color: 1 }).height).toBe(renderText(drawnText('Kaks'), { color: 1 }).height);
    expect(inkTop('väljas')).toBe(0);
    expect(renderText(drawnText('Ä\nA'), { color: 1 }).height).toBe(2 * LINE_HEIGHT - LINE_GAP);
  });

  it('ft_0_18.AC3 English keeps its lowercase letters', () => {
    expect(drawnText('Back')).toBe('Back');
  });
});
