import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('the music theory reference (docs/theory)', () => {
  it('ft_1_28.AC4 has its index and a circle-of-fifths page that the index links', () => {
    expect(existsSync('docs/theory/THEORY.md')).toBe(true);
    expect(existsSync('docs/theory/circle-of-fifths.md')).toBe(true);
    expect(readFileSync('docs/theory/THEORY.md', 'utf8')).toContain('(circle-of-fifths.md)');
  });
});
