// Covers ft_1_39.AC1: the catalog the game reads and the catalog page say the same.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import catalogJson from '../../content/lessons/catalog.json';

/** Every topic row of the page as `id status`, in the page's order. */
function pageRows(markdown: string): string[] {
  return [...markdown.matchAll(/^\| ([A-R]\d+) \| [^|]+ \| ([^|]+?) \|/gm)].map((m) => `${m[1]} ${m[2]}`);
}

describe('the learning catalog page and content/lessons/catalog.json', () => {
  it('ft_1_39.AC1 list the same topics with the same status, in the same order', () => {
    const page = readFileSync(new URL('../../docs/theory/learning-catalog.md', import.meta.url), 'utf8');
    const data = catalogJson.areas.flatMap((a) => a.topics.map((t) => `${t.id} ${t.status}`));
    expect(data).toEqual(pageRows(page));
  });
});
