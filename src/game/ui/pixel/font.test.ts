import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { strings } from '../../../core/text/strings';
import { C } from './palette';
import { drawnText, CAP_HEIGHT, CELL_HEIGHT, LINE_HEIGHT, fitLine, glyphFor, hasGlyph, measure, renderText, wrap } from './font';

const dump = (text: string, options = { color: C.white }) => {
  const b = renderText(text, options);
  return Array.from({ length: b.height }, (_, y) => [...Array(b.width)].map((_, x) => (b.pixels[y * b.width + x] ? '#' : '.')).join(''));
};

describe('the glyphs', () => {
  it('cover every letter, digit and mark the game writes', () => {
    for (const ch of 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789 .,:;!?\'"-+=/()[]%<>…') expect(hasGlyph(ch), ch).toBe(true);
  });

  it('are at most five wide and the height of a capital, with two more rows for a tail', () => {
    for (const ch of 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789.,:;!?\'"-+=/()[]%<>') {
      const glyph = glyphFor(ch);
      expect(glyph.width, ch).toBeGreaterThan(0);
      expect(glyph.width, ch).toBeLessThanOrEqual(5);
      expect(glyph.rows.length, ch).toBeGreaterThanOrEqual(CAP_HEIGHT);
      expect(glyph.rows.length, ch).toBeLessThanOrEqual(CELL_HEIGHT);
      expect(new Set(glyph.rows.map((r) => r.length)).size, ch).toBe(1);
      expect(glyph.rows.every((r) => /^[#.]+$/.test(r)), ch).toBe(true);
    }
  });

  it('give tails only to g j p q y, and none to the rest of the lowercase letters', () => {
    for (const ch of 'abcdefghijklmnopqrstuvwxyz') expect(glyphFor(ch).rows.length, ch).toBe('gjpqy'.includes(ch) ? CELL_HEIGHT : CAP_HEIGHT);
  });

  it('are all different, so no two letters look alike', () => {
    const seen = new Map<string, string>();
    for (const ch of 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789') {
      const key = glyphFor(ch).rows.join('/');
      expect(seen.get(key), `${ch} looks like ${seen.get(key)}`).toBeUndefined();
      seen.set(key, ch);
    }
  });

  it('keep b d p q apart by shape, which a student learning to read needs', () => {
    expect(glyphFor('b').rows[0]).toBe('#....');
    expect(glyphFor('d').rows[0]).toBe('....#');
    expect(glyphFor('p').rows.length).toBeGreaterThan(CAP_HEIGHT);
    expect(glyphFor('p').rows[7]).toBe('#....');
    expect(glyphFor('q').rows[7]).toBe('....#');
  });

  it('show a block for a character it does not have', () => {
    expect(hasGlyph('♪')).toBe(false);
    expect(glyphFor('♪').rows).toEqual(['#####', '#...#', '#...#', '#...#', '#...#', '#...#', '#####']);
  });
});

describe('measure', () => {
  it('adds one pixel between letters and none after the last', () => {
    expect(measure('')).toBe(0);
    expect(measure('I')).toBe(glyphFor('I').width);
    expect(measure('II')).toBe(2 * glyphFor('I').width + 1);
  });

  it('makes narrow letters narrow and wide letters wide', () => {
    expect(measure('i')).toBeLessThan(measure('m'));
    expect(measure('l')).toBeLessThan(measure('w'));
    expect(measure('.')).toBe(1);
  });

  it('counts a space as three pixels between letters, like a letter gap and two more', () => {
    expect(measure('I I')).toBe(2 * glyphFor('I').width + 4);
    expect(measure('. .')).toBe(1 + 1 + 2 + 1 + 1);
  });
});

describe('fitLine', () => {
  it('takes the first text that fits on one line, else cuts the last one short with dots', () => {
    expect(fitLine(['Little Steps (bars 2 to 3)', 'Little Steps'], 500)).toBe('Little Steps (bars 2 to 3)');
    expect(fitLine(['Little Steps (bars 2 to 3)', 'Little Steps'], measure('Little Steps'))).toBe('Little Steps');
    const cut = fitLine(['Little Steps (bars 2 to 3)', 'Little Steps'], measure('Little Steps') - 1);
    expect(cut.endsWith('...')).toBe(true);
    expect(measure(cut)).toBeLessThanOrEqual(measure('Little Steps') - 1);
    expect(fitLine(['Little'], 1)).toBe('');
  });
});

describe('wrap', () => {
  it('breaks at spaces so no line is wider than the limit', () => {
    const text = 'So close! Try the key just below.';
    for (const maxWidth of [60, 90, 140]) {
      for (const line of wrap(text, maxWidth)) expect(measure(line)).toBeLessThanOrEqual(maxWidth);
    }
    expect(wrap(text, 1000)).toEqual([text]);
  });

  it('keeps a word that is too wide whole on its own line, and honours line breaks', () => {
    expect(wrap('aaaaaaaaaaaaaaaaaaaa bb', 20)).toEqual(['aaaaaaaaaaaaaaaaaaaa', 'bb']);
    expect(wrap('one\ntwo three', 1000)).toEqual(['one', 'two three']);
  });

  it('loses no words', () => {
    const text = 'Right note name, but too high. Try the same note lower down.';
    expect(wrap(text, 80).join(' ')).toBe(text);
  });
});

describe('renderText', () => {
  it('draws the letters in the given colour and nothing else', () => {
    const b = renderText('Hi', { color: C.gold });
    expect(new Set(b.pixels)).toEqual(new Set([0, C.gold]));
    expect(b.height).toBe(CELL_HEIGHT);
    expect(b.width).toBe(measure('Hi'));
  });

  it('draws a capital H as seven rows', () => {
    expect(dump('H')).toEqual(['#...#', '#...#', '#...#', '#####', '#...#', '#...#', '#...#', '.....', '.....']);
  });

  it('puts a tail below the line for g and keeps it inside the bitmap', () => {
    const rows = dump('g');
    expect(rows).toHaveLength(CELL_HEIGHT);
    expect(rows[8]).toBe('.###.');
  });

  it('adds a one-pixel shadow down and to the right, under the letters', () => {
    const plain = renderText('I', { color: C.white });
    const shaded = renderText('I', { color: C.white, shadow: C.ink });
    expect(shaded.width).toBe(plain.width + 1);
    expect(shaded.height).toBe(plain.height + 1);
    expect(shaded.pixels[0]).toBe(C.white);
    expect(new Set(shaded.pixels)).toEqual(new Set([0, C.white, C.ink]));
  });

  it('wraps long text and gives each line the room it needs', () => {
    const b = renderText('Reach level 5 to play this one', { color: C.white, maxWidth: 80 });
    expect(b.width).toBeLessThanOrEqual(80);
    expect(b.height).toBeGreaterThanOrEqual(2 * LINE_HEIGHT - 2);
  });

  it('aligns shorter lines to the left, centre or right of the widest', () => {
    const first = (align: 'left' | 'center' | 'right') => {
      const b = renderText('WWWWWW\nI', { color: C.white, align });
      const row = LINE_HEIGHT; // the first row of the second line
      const x = [...Array(b.width).keys()].find((i) => b.pixels[row * b.width + i] !== 0)!;
      return { x, width: b.width };
    };
    expect(first('left').x).toBe(0);
    expect(first('center').x).toBe(Math.floor((first('center').width - glyphFor('I').width) / 2));
    expect(first('right').x).toBe(first('right').width - glyphFor('I').width);
  });

  it('draws an empty string as a one-pixel empty bitmap rather than nothing', () => {
    const b = renderText('', { color: C.white });
    expect(b.width).toBeGreaterThanOrEqual(1);
    expect(b.height).toBeGreaterThanOrEqual(1);
  });
});

describe('every text the game shows can be drawn without a stand-in block', () => {
  const missing = (text: string) => [...drawnText(text)].filter((ch) => !hasGlyph(ch));

  it('in the string table (placeholders filled in)', () => {
    for (const [key, value] of Object.entries(strings)) {
      const filled = value.replace(/\{\w+\|([^|{}]*)\|([^|{}]*)\}/g, '$1 $2').replace(/\{[a-zA-Z]+\}/g, '7');
      expect(missing(filled), `${key}: ${value}`).toEqual([]);
    }
  });

  it('in the titles of the pieces and the dev charts', () => {
    const root = join(__dirname, '../../../..');
    const titles = readdirSync(join(root, 'content/pieces')).filter((d) => existsSync(join(root, 'content/pieces', d, 'piece.meta.json'))).map((d) => (JSON.parse(readFileSync(join(root, 'content/pieces', d, 'piece.meta.json'), 'utf-8')) as { title: string }).title);
    for (const f of readdirSync(join(root, 'content/dev/charts'))) titles.push((JSON.parse(readFileSync(join(root, 'content/dev/charts', f), 'utf-8')) as { title: string }).title);
    expect(titles.length).toBeGreaterThan(15);
    for (const title of titles) expect(missing(title), title).toEqual([]);
  });
});
