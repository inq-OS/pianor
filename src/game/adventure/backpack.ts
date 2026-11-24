import { bandInventory } from '../../core/item/item';
import { t, type StringKey } from '../../core/text/strings';
import type { WorldState } from '../../core/island/worldState';
import type { ToolbarItem } from '../ui/pixel/PixelScene';
import { prizePicture } from '../ui/pixel/prizeArt';
import { CHARACTERS, ITEMS } from './scenesData';

/** The world's items as the backpack shows them: each character's prize ladder as its best rung (ft_1_21.AC18). */
export function keptEntries(world: WorldState | null): ReturnType<typeof bandInventory> {
  return bandInventory(world?.items ?? [], ITEMS, [...CHARACTERS.values()].flatMap((c) => (c.prizes ? [c.prizes] : [])));
}

/**
 * The student's items in the backpack (ft_1_21.AC15, ft_1_20, d282): what was won, each with its painted picture and named
 * in its tooltip (a ladder's prize says which rung it is, AC18); one with no picture yet shows its name. Pressing one does
 * nothing yet.
 */
export function backpackOf(world: WorldState | null): ToolbarItem[] {
  return keptEntries(world).map(({ item, rung }) => {
    const name = t(item.name as StringKey), picture = prizePicture(item.picture);
    const tooltip = rung ? t('item.rung', { name, at: rung.at, of: rung.of }) : name;
    return picture ? { label: name, icon: picture, fineIcon: true, tooltip, onClick: () => undefined } : { label: name, tooltip, onClick: () => undefined };
  });
}
