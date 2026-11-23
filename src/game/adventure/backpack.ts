import { backpackInventory } from '../../core/item/item';
import type { WorldState } from '../../core/island/worldState';
import { t, type StringKey } from '../../core/text/strings';
import type { ToolbarItem } from '../ui/pixel/PixelScene';
import { prizePicture } from '../ui/pixel/prizeArt';
import { CHARACTERS, ITEMS } from './scenesData';

/** The world's kept items as the backpack shows them (ft_1_21.AC15, AC18): each character's prize ladder as its best rung. */
export function keptEntries(world: WorldState | null): ReturnType<typeof backpackInventory> {
  return backpackInventory(world?.items ?? [], ITEMS, [...CHARACTERS.values()].flatMap((c) => (c.prizes ? [c.prizes] : [])));
}

/**
 * The backpack's items (ft_1_20, d282): what the student won, each named in its tooltip. A kept item does nothing when
 * pressed. An item shows its painted picture (`prizeArt.ts`); one with no picture yet shows its name.
 */
export function keptItems(world: WorldState | null): ToolbarItem[] {
  return keptEntries(world).map(({ item, rung }) => {
    const name = t(item.name as StringKey), picture = prizePicture(item.picture);
    // a ladder's prize says which rung it is (AC18): "TÕRU (2/5)"
    const tooltip = rung ? t('item.rung', { name, at: rung.at, of: rung.of }) : name;
    return picture ? { label: name, icon: picture, fineIcon: true, tooltip, onClick: () => undefined } : { label: name, tooltip, onClick: () => undefined };
  });
}
