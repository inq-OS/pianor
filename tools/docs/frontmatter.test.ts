import { describe, expect, it } from 'vitest';
import { detectEol, parseFrontMatter, serializeFrontMatter, withFrontMatter } from './frontmatter';

describe('parseFrontMatter', () => {
  it('reads JSON values and returns the body', () => {
    const fm = parseFrontMatter('---\nid: "ft_0_01"\nn: 3\nlist: ["a","b"]\n---\n# Title\n');
    expect(fm).toEqual({ kind: 'ok', data: { id: 'ft_0_01', n: 3, list: ['a', 'b'] }, body: '# Title\n' });
  });

  it('reports a file without front matter as none', () => {
    expect(parseFrontMatter('# Title\n')).toEqual({ kind: 'none', body: '# Title\n' });
  });

  it('reads CRLF files', () => {
    const fm = parseFrontMatter('---\r\nid: "x"\r\n---\r\nbody\r\n');
    expect(fm).toEqual({ kind: 'ok', data: { id: 'x' }, body: 'body\n' });
  });

  it('skips blank lines inside the block', () => {
    const fm = parseFrontMatter('---\nid: "x"\n\n---\nbody');
    expect(fm.kind).toBe('ok');
  });

  it.each([
    ['an unclosed block', '---\nid: "x"\nbody'],
    ['a line that is not key: value', '---\nid "x"\n---\n'],
    ['a value that is not JSON', '---\nid: x\n---\n'],
    ['a repeated key', '---\nid: "x"\nid: "y"\n---\n'],
  ])('rejects %s', (_name, text) => {
    expect(parseFrontMatter(text).kind).toBe('error');
  });
});

describe('writing front matter', () => {
  it('serializes in key order and drops undefined values', () => {
    expect(serializeFrontMatter({ id: 'a', skipped: undefined, n: 2 })).toBe('---\nid: "a"\nn: 2\n---\n');
  });

  it('round-trips through the parser', () => {
    const data = { id: 'a', title: 'has "quotes", colons: and | pipes', list: ['x'] };
    const parsed = parseFrontMatter(serializeFrontMatter(data) + 'body');
    expect(parsed).toEqual({ kind: 'ok', data, body: 'body' });
  });

  it('replaces existing front matter and keeps the body and the line ending', () => {
    const out = withFrontMatter('---\r\nid: "old"\r\n---\r\n# T\r\n', { id: 'new' });
    expect(out).toBe('---\r\nid: "new"\r\n---\r\n# T\r\n');
  });

  it('adds front matter to a file without any', () => {
    expect(withFrontMatter('# T\n', { id: 'a' })).toBe('---\nid: "a"\n---\n# T\n');
  });

  it('detects the line ending', () => {
    expect(detectEol('a\r\nb')).toBe('\r\n');
    expect(detectEol('a\nb')).toBe('\n');
  });
});
