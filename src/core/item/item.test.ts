// Covers ft_1_21.AC15 (a won tug's item stands in the backpack) on ft_1_20's item model.
import { describe, expect, it } from 'vitest';
import itemsJson from '../../../content/items/items.json';
import { strings } from '../text/strings';
import { backpackInventory, inventoryOf, parseItems } from './item';

const characters = import.meta.glob<{ prizes?: string[] }>('../../../content/characters/*.json', { eager: true, import: 'default' });

describe('the items (ft_1_20 item model)', () => {
  const catalog = parseItems(itemsJson);

  it('ft_1_21.AC15 every item is named by a string key, every rung of a character\'s prize ladder is an item, and no item is on two ladders', () => {
    expect(catalog.size).toBeGreaterThan(0);
    for (const item of catalog.values()) expect(item.name in strings, item.id).toBe(true);
    const onLadder = new Set<string>();
    for (const [path, c] of Object.entries(characters)) {
      for (const id of c.prizes ?? []) {
        expect(catalog.has(id), `${path}: ${id}`).toBe(true);
        expect(onLadder.has(id), `${path}: ${id} is on two ladders`).toBe(false);
        onLadder.add(id);
      }
    }
  });

  it('refuses a file of another version, a duplicate id and an unknown kind', () => {
    expect(() => parseItems({ schemaVersion: 2, items: [] })).toThrow();
    const leaf = { id: 'golden-leaf', kind: 'kept', name: 'item.goldenLeaf' };
    expect(() => parseItems({ schemaVersion: 1, items: [leaf, leaf] })).toThrow(/golden-leaf/);
    expect(() => parseItems({ schemaVersion: 1, items: [{ ...leaf, kind: 'thrown' }] })).toThrow();
  });

  it('ft_1_21.AC15 the inventory is the student\'s items in the order they came, each once; an id with no item is left out', () => {
    const two = parseItems({ schemaVersion: 1, items: [{ id: 'golden-leaf', kind: 'kept', name: 'item.goldenLeaf' }, { id: 'shell', kind: 'kept', name: 'x', picture: 'shell' }] });
    expect(inventoryOf(['shell', 'gone', 'golden-leaf', 'shell'], two).map((i) => i.id)).toEqual(['shell', 'golden-leaf']);
    expect(inventoryOf([], two)).toEqual([]);
  });

  it('ft_1_21.AC18 a ladder stands in the backpack once, as its highest rung held, in the place its first rung came, with its rung and the ladder\'s length', () => {
    const kept = (id: string) => ({ id, kind: 'kept', name: `item.${id}` });
    const five = parseItems({ schemaVersion: 1, items: ['leaf', 'acorn', 'gold', 'branch', 'seed', 'shell'].map(kept) });
    const ladder = ['leaf', 'acorn', 'gold', 'branch', 'seed'];
    const shown = backpackInventory(['shell', 'leaf', 'gold', 'acorn', 'gone'], five, [ladder]);
    expect(shown.map((e) => [e.item.id, e.rung])).toEqual([['shell', undefined], ['gold', { at: 3, of: 5 }]]);
    // a rung on its own is the ladder too; an item on no ladder stands as it is
    expect(backpackInventory(['seed'], five, [ladder]).map((e) => [e.item.id, e.rung])).toEqual([['seed', { at: 5, of: 5 }]]);
    expect(backpackInventory(['shell', 'shell'], five, [ladder]).map((e) => e.item.id)).toEqual(['shell']);
    expect(backpackInventory([], five, [ladder])).toEqual([]);
  });
});
