import { bush, rose, stem } from './bushes';
import { blades, blooms, clump, gravel, moss, swells } from './grass';
import { entry, fillEntry, type KitEntry, type KitFillEntry } from './kit';
import { lamp, lantern } from './lights';
import { slabs, trail } from './paths';
import { boulder, pebble } from './stones';
import { reflection, rings, sea } from './water';
import { planks, post } from './wood';

/**
 * Every type of the kit, family by family: what `npm run art:render -- kit` paints and `kit.test.ts` holds to the
 * kit's rules. A new type is added here in the pull request that paints it, with its row in its family's artist's
 * note (`projects/painter/artists-notes/kit.md` says how).
 */
export const KIT: readonly KitEntry[] = [
  entry(boulder),
  entry(pebble),
  entry(lantern),
  entry(lamp),
  entry(clump),
  entry(bush),
  entry(rose),
  entry(stem),
  entry(reflection),
  entry(post),
];

/**
 * Every fill of the kit: the types that paint a whole region of a scene's ground (a slope's turf, its blades), in the
 * order a slope is laid; then the paths, which lie on the turf; then the sea and the bands on it; then a deck's planks.
 */
export const KIT_FILLS: readonly KitFillEntry[] = [
  fillEntry(swells), fillEntry(gravel), fillEntry(moss), fillEntry(blades), fillEntry(blooms), fillEntry(slabs), fillEntry(trail),
  fillEntry(sea), fillEntry(rings), fillEntry(planks),
];
