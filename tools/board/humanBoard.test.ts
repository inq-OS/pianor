import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
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

  it('finds the tags under docs and projects of a repository, in file order, and links each to its line', () => {
    const root = mkdtempSync(join(tmpdir(), 'pianor-human-'));
    afterAll(() => rmSync(root, { recursive: true, force: true }));
    mkdirSync(join(root, 'docs', 'features'), { recursive: true });
    mkdirSync(join(root, 'projects', 'painter'), { recursive: true });
    writeFileSync(join(root, 'docs', 'features', 'f.md'), '# F\n\n- NEEDS-HUMAN: request the CIPI files.\n');
    writeFileSync(join(root, 'projects', 'painter', 'n.md'), '- NEEDS-HUMAN: look at it on the laptop.\n');
    writeFileSync(join(root, 'docs', 'skip.txt'), '- NEEDS-HUMAN: not Markdown.\n');
    const items = collectItems(root);
    expect(items.map((i) => `${i.file}:${i.line} ${i.group}`)).toEqual(['docs/features/f.md:3 outside', 'projects/painter/n.md:1 laptop']);
    const html = renderHumanBoard(items, 'https://github.com/o/r');
    expect(html).toContain('2 item(s)');
    expect(html).toContain('https://github.com/o/r/blob/main/docs/features/f.md#L3');
    expect(html.indexOf('id="outside"')).toBeLessThan(html.indexOf('id="laptop"'));
  });

  it('escapes the text of an item and keeps its inline code', () => {
    const html = renderHumanBoard([{ file: 'docs/a.md', line: 1, text: 'check `a<b` & [the doc](x.md)', group: 'other' }], 'https://github.com/o/r');
    expect(html).toContain('check <code>a&lt;b</code> &amp; the doc');
  });
});
