import { describe, expect, it } from 'vitest';
import { collectItems, groupOf, itemsOf, renderHumanBoard } from './humanBoard';

describe('the board of what waits on the maintainer', () => {
  it('takes only list items that start with the tag, with their file and line', () => {
    const md = ['# Doc', '- NEEDS-HUMAN: look at the knoll on the laptop.', 'The `NEEDS-HUMAN` tags are listed here.', '- Until the NEEDS-HUMAN test below, it stays off.', '  - NEEDS-HUMAN: request the CIPI files.'].join('\n');
    expect(itemsOf('docs/x.md', md)).toEqual([
      { file: 'docs/x.md', line: 2, text: 'look at the knoll on the laptop.', group: 'laptop' },
      { file: 'docs/x.md', line: 5, text: 'request the CIPI files.', group: 'outside' },
    ]);
  });

  it('puts an item in the first group whose need it names, outside access before everything', () => {
    expect(groupOf('when CIPI\'s files arrive, run the fit on the laptop')).toBe('outside');
    expect(groupOf('play it in Wait mode on the EZ-220 and approve it')).toBe('keyboard');
    expect(groupOf('the try-out with the student of piece XP')).toBe('student');
    expect(groupOf('approve Puuvaim\'s three phrases and read its Estonian lines')).toBe('pieces');
    expect(groupOf('approve them in the preview; more give the student more to learn')).toBe('pieces');
    expect(groupOf('tune the tint on the real display')).toBe('laptop');
    expect(groupOf('a native speaker\'s check of the strings')).toBe('estonian');
    expect(groupOf('AC6 on the real tablet')).toBe('tablet');
    expect(groupOf('lamps at dusk: one house rule, or each scene\'s choice?')).toBe('other');
  });

  it('finds the real tags of the repository and links each to its line', () => {
    const items = collectItems('.');
    expect(items.some((i) => i.file === 'docs/features/core_08-difficulty-estimator.md' && i.group === 'outside')).toBe(true);
    const html = renderHumanBoard(items, 'https://github.com/o/r');
    expect(html).toContain(`${items.length} item(s)`);
    expect(html).toContain('https://github.com/o/r/blob/main/docs/features/core_08-difficulty-estimator.md#L');
    expect(html.indexOf('id="outside"')).toBeLessThan(html.indexOf('id="laptop"'));
  });

  it('escapes the text of an item and keeps its inline code', () => {
    const html = renderHumanBoard([{ file: 'docs/a.md', line: 1, text: 'check `a<b` & [the doc](x.md)', group: 'other' }], 'https://github.com/o/r');
    expect(html).toContain('check <code>a&lt;b</code> &amp; the doc');
  });
});
