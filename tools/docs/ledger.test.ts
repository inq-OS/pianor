import { describe, expect, it } from 'vitest';
import { isLedger, readLedger } from './items.ts';

const LEDGER = `---
title: Saves
---
# Saves

## d095

**The piece is the player's.** Features: ft_1_21, core_12.

A character sets only the difficulty.

## d096

**Tempo mode waits for its feature.** Features: none.

One line.

## d097

Missing its first line.
`;

describe('decision ledgers (d152)', () => {
  it('knows a ledger from the index and from other folders', () => {
    expect(isLedger('docs/decisions/saves.md')).toBe(true);
    expect(isLedger('docs/decisions/DECISIONS.md')).toBe(false);
    expect(isLedger('docs/decisions/sub/x.md')).toBe(false);
    expect(isLedger('docs/features/saves.md')).toBe(false);
    expect(isLedger('docs/decisions/notes.txt')).toBe(false);
  });

  it('reads one item per entry with its id, title and features', () => {
    const items = readLedger('docs/decisions/saves.md', LEDGER);
    expect(items.map((i) => i.fileId)).toEqual(['d095', 'd096', 'd097']);
    const [first, second] = items;
    expect(first?.file).toBe('saves.md#d095');
    expect(first?.meta).toMatchObject({ id: 'd095', title: "The piece is the player's", features: ['ft_1_21', 'core_12'] });
    expect(first?.body.startsWith('# d095: ')).toBe(true);
    expect(first?.body).toContain('A character sets only the difficulty.');
    expect(first?.body).not.toContain('d096');
    expect(second?.meta).toMatchObject({ features: [] });
  });

  it('reports an entry without its first line instead of dropping it', () => {
    const bad = readLedger('docs/decisions/saves.md', LEDGER)[2];
    expect(bad?.meta).toBeNull();
    expect(bad?.problem).toContain('d097');
  });

  it('reports a feature id the schema refuses', () => {
    const [item] = readLedger('docs/decisions/x.md', '## d001\n\n**T.** Features: nonsense.\n');
    expect(item?.meta).toBeNull();
    expect(item?.problem).toContain('d001');
  });
});
