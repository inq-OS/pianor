// Covers core_05.AC5.
import { describe, expect, it } from 'vitest';
import styleFile from '../../../content/pieces/styles.json';
import { strings } from '../text/strings';
import { parseStyleList, styleNameKeys } from './styles';

const list = parseStyleList({ schemaVersion: 1, styles: [{ id: 'folk', nameKey: 'style.folk' }, { id: 'classical', nameKey: 'style.classical' }] });

describe('the closed style list', () => {
  it('reads the style list of the content, and every style has a name in the strings', () => {
    const content = parseStyleList(styleFile);
    expect(content.styles.map((s) => s.id)).toEqual(['folk', 'classical', 'exercise', 'original']);
    for (const style of content.styles) expect(strings).toHaveProperty(style.nameKey);
  });

  it('refuses a list with a repeated id, a badly written id or a name key with no string', () => {
    expect(() => parseStyleList({ schemaVersion: 1, styles: [{ id: 'folk', nameKey: 'style.folk' }, { id: 'folk', nameKey: 'style.folk' }] })).toThrow(/folk/);
    expect(() => parseStyleList({ schemaVersion: 1, styles: [{ id: 'Folk Songs', nameKey: 'style.folk' }] })).toThrow();
    expect(() => parseStyleList({ schemaVersion: 1, styles: [{ id: 'jazz', nameKey: 'style.jazz' }] })).toThrow(/style\.jazz/);
    expect(() => parseStyleList({ schemaVersion: 2, styles: [] })).toThrow();
  });

  it('gives the name keys of the known styles of a piece, in its order, without repeats or unknown words', () => {
    expect(styleNameKeys(list, ['classical', 'jazz', 'folk', 'classical'])).toEqual(['style.classical', 'style.folk']);
    expect(styleNameKeys(list, [])).toEqual([]);
  });
});
