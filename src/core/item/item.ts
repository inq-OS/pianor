/**
 * The items a student can have (ft_1_20's item model, the part ft_1_21.AC15 needs): an id, its kind, the string key that
 * names it and, once the painter has drawn it, its picture key. `content/items/items.json`. Pure.
 * AX-3 provisional: one kind, `kept` (it stands in the backpack for what was won and does nothing more); the held,
 * worn and opening kinds and a held item's target come with ft_1_20.AC4 and AC5.
 */
import { z } from 'zod';
import { idSchema, type ItemId } from '../contracts';

export const itemDefSchema = z.object({
  id: idSchema,
  kind: z.enum(['kept']),
  /** Its name's string key. */
  name: z.string().min(1),
  /** Its picture in the backpack (`src/game/ui/pixel`); without one the backpack shows its name. */
  picture: z.exactOptional(z.string().min(1)),
}).strict();

export type ItemDef = z.infer<typeof itemDefSchema>;

const itemsFileSchema = z.object({
  schemaVersion: z.literal(1),
  note: z.exactOptional(z.string()),
  items: z.array(itemDefSchema),
}).strict();

/** The items file, checked: by id, each id once. */
export function parseItems(raw: unknown): ReadonlyMap<ItemId, ItemDef> {
  const file = itemsFileSchema.parse(raw);
  const byId = new Map<ItemId, ItemDef>();
  for (const item of file.items) {
    if (byId.has(item.id)) throw new Error(`content/items: ${item.id} is listed twice`);
    byId.set(item.id, item);
  }
  return byId;
}

/** The student's items (`WorldState.items`) as the backpack shows them: in the order they came, each once, known ones only. */
export function inventoryOf(ids: readonly ItemId[], catalog: ReadonlyMap<ItemId, ItemDef>): ItemDef[] {
  const seen = new Set<ItemId>();
  return ids.flatMap((id) => {
    const item = catalog.get(id);
    if (!item || seen.has(id)) return [];
    seen.add(id);
    return [item];
  });
}

/** One thing the backpack shows: an item, and for a rung of a prize ladder which rung it is of how many (1 the first). */
export interface InventoryEntry {
  readonly item: ItemDef;
  readonly rung?: { readonly at: number; readonly of: number };
}

/**
 * The backpack's items with the characters' prize ladders (ft_1_21.AC18: the prize is
 * upgraded for every level of a character beaten): a ladder stands once, as the highest rung the student holds, in the
 * place its first held rung came, so an upgrade takes the old prize's slot. Every rung stays in `WorldState.items`
 * (nothing earned is taken away, AX-1.1); only the backpack shows the best. Items on no ladder stand as `inventoryOf` gives.
 */
export function backpackInventory(ids: readonly ItemId[], catalog: ReadonlyMap<ItemId, ItemDef>, ladders: Iterable<readonly ItemId[]>): InventoryEntry[] {
  const ladderOf = new Map<ItemId, readonly ItemId[]>();
  for (const ladder of ladders) for (const id of ladder) ladderOf.set(id, ladder);
  const held = inventoryOf(ids, catalog);
  const heldIds = new Set(held.map((item) => item.id));
  const placed = new Set<readonly ItemId[]>();
  return held.flatMap((item): InventoryEntry[] => {
    const ladder = ladderOf.get(item.id);
    if (!ladder) return [{ item }];
    if (placed.has(ladder)) return [];
    placed.add(ladder);
    const best = ladder.reduce((top, id, i) => (heldIds.has(id) ? i : top), -1);
    return [{ item: catalog.get(ladder[best]!)!, rung: { at: best + 1, of: ladder.length } }];
  });
}
