import { describe, expect, it } from 'vitest';
import { expandBlocks, listBlocks } from './blocks';

const upper = (name: string, args: string[]): string | { error: string } =>
  name === 'shout' ? args.join(' ').toUpperCase() : { error: `no block ${name}` };

describe('expandBlocks', () => {
  it('replaces what is between the markers and keeps the rest', () => {
    const text = 'before\n<!-- docs:shout a b -->\nold\nold2\n<!-- /docs:shout -->\nafter\n';
    const { text: out, errors } = expandBlocks(text, 'f.md', upper);
    expect(out).toBe('before\n<!-- docs:shout a b -->\nA B\n<!-- /docs:shout -->\nafter\n');
    expect(errors).toEqual([]);
  });

  it('is idempotent', () => {
    const once = expandBlocks('<!-- docs:shout x -->\n<!-- /docs:shout -->', 'f.md', upper).text;
    expect(expandBlocks(once, 'f.md', upper).text).toBe(once);
  });

  it('keeps CRLF line endings', () => {
    const out = expandBlocks('a\r\n<!-- docs:shout x -->\r\n<!-- /docs:shout -->\r\n', 'f.md', upper).text;
    expect(out).toBe('a\r\n<!-- docs:shout x -->\r\nX\r\n<!-- /docs:shout -->\r\n');
  });

  it('allows several blocks and blocks without arguments', () => {
    const text = '<!-- docs:shout -->\n<!-- /docs:shout -->\n<!-- docs:shout q -->\n<!-- /docs:shout -->';
    expect(expandBlocks(text, 'f.md', upper).text).toBe('<!-- docs:shout -->\n\n<!-- /docs:shout -->\n<!-- docs:shout q -->\nQ\n<!-- /docs:shout -->');
  });

  it('reports a block that is never closed, with its line', () => {
    const { errors, text } = expandBlocks('x\n<!-- docs:shout a -->\nmore', 'f.md', upper);
    expect(errors).toEqual(['f.md:2: block "shout" has no closing <!-- /docs:shout -->']);
    expect(text).toBe('x\n<!-- docs:shout a -->\nmore');
  });

  it('does not run into the next block when one is not closed', () => {
    const { errors } = expandBlocks('<!-- docs:shout a -->\n<!-- docs:shout b -->\n<!-- /docs:shout -->', 'f.md', upper);
    expect(errors).toHaveLength(1);
  });

  it('reports a renderer error and leaves the block as it was', () => {
    const text = '<!-- docs:nope -->\nkept\n<!-- /docs:nope -->';
    const { errors, text: out } = expandBlocks(text, 'f.md', upper);
    expect(errors).toEqual(['f.md:1: no block nope']);
    expect(out).toBe(text);
  });

  it('ignores markers inside code fences', () => {
    const text = '```\n<!-- docs:shout a -->\n<!-- /docs:shout -->\n```';
    expect(expandBlocks(text, 'f.md', upper).text).toBe(text);
  });
});

describe('listBlocks', () => {
  it('lists names and arguments, outside fences only', () => {
    const text = '<!-- docs:index features core -->\n<!-- /docs:index -->\n```\n<!-- docs:levels -->\n```\n<!-- docs:levels -->\n';
    expect(listBlocks(text)).toEqual([
      { name: 'index', args: ['features', 'core'] },
      { name: 'levels', args: [] },
    ]);
  });
});
