# Trees

**Model:** the knoll's overhanging tree (`tree()`, `limb()`, `tier()` and `leafLump()` in `src/game/ui/pixel/keri/knollPicture.ts`, with its shape in `LIMBS` and `TIERS`), approved on the sketch. Keri has almost no trees. The reference: a tree like the one in the first MI2 picture, overhanging the knoll from the left side (it does not actually exist on Keri). That picture is the left end of Scabb's beach at night (mi2-bg-0-004). The tree is a departure from the real island on purpose (`knoll-overhanging-tree` in the departures list).

## Custom

The tree is custom to the knoll, not a kit type (one unique type of tree is allowed, and it stays the knoll's own). Its painters stay in the knoll's file. A second scene that wants a tree reads them for the recipe and paints its own; when two scenes want the same tree, it moves to `kit/trees.ts` (the kit's rules, [kit.md](kit.md)).

- **Limbs** are quadratic curves (`a` by `b` to `c`) of round wood, `r` thick at the start and thinning to `end` of that. The side facing the light is lit, the underside has an ink line, and fbm grooves wind round the limb along its length.
- **Tiers** are flat cushions of leaf, painted high ones first. The top is heaped in small lumps that each catch the light (`leafLump`), the underside is near-black with tufts hanging from it, and the sky shows through here and there. The leaf uses the near-grass and bush runs, so it sits in the same greens as the knoll's foliage.
- **Placement:** the trunk comes out of the dog-rose thicket in the left corner, so its foot is hidden (rule 6). The long limb sags out over the plateau, and the crown stops short of the fire's smoke.

## Recipe (from the atlas; the knoll's tree follows it)

1. **A tree is a wing.** It grows from a near corner, leans across the picture and hangs its crown over the top third: it frames the lit middle and is never the middle itself.
2. **Trunks twist.** Two or three trunks from one foot, each an S-curve that leans the way the wind has pushed it (on Keri: away from the west), thick at the foot, forking twice, no straight stretch longer than a few pixels. Roots run out among the stones.
3. **Dark against the lightest thing.** The trunks and the crown's underside are the darkest tones of the picture, set against the sea or the sky where it is palest: the tree reads by its outline first.
4. **A rim of light** one pixel wide along the side of each trunk that faces the light (the moon's blue at night, a warm green-brown by day); the rest of the trunk two or three near-black tones in long strokes along its length.
5. **The crown is flat and wide,** a low roof of leaf heaps, wider than the tree is tall. Leaves are clusters of short strokes lit on top, in three or four tones, over a near-black body; sky shows through in small ragged holes near the edge.
6. **Its foot is hidden** in boulders, grass spikes and shade, never a trunk standing on a clean line.
7. Painted with the bush recipe's lumps for the crown ([bushes-and-foliage.md](bushes-and-foliage.md)) and a stroke along a bent spine for the trunks (`stroke()` in `kit/shape.ts`).

## Atlas

- `find --tags beach,scabb` (mi2-bg-0-004, wide; its left third is the chosen reference; swatches foliage-6, rock-3): the twisted tree over the night shore.
- `find --tags big-tree` and `find --tags treehouse` (mi2-bg-1-060, mi2-bg-1-061): a giant trunk with pale bark in long vertical strokes and dark knots; branches as fat curved limbs.
- `find --tags tree,day` (mi2-bg-1-047, mi2-bg-4-097): day trunks in grey-blue with a lit side; crowns as dark leaf masses with lit clusters.
- `find --tags cottage`, `find --tags waterfall` (swatches foliage-4, foliage-5): palms as dark fronds with a lit upper edge. Shape only; Keri has no palms.
- `find --tags swamp`: trunks as black silhouettes before a lit distance.
- In MI2's day rooms a dark branch or frond hangs into an upper corner in most outdoor pictures (mi2-bg-1-051, mi2-bg-2-038, mi2-bg-1-052): the same job the knoll's tree is to do.

## Keri

- No tree stands on the knoll; the tallest plants are the dog roses (the departures list). KERI-TODO: which trees or tall shrubs Keri really has, and where (ask the maintainer before painting a tree anywhere else).

## Open

- IDEA(painter, R3): the tall dry seed heads in the knoll's top-left corner stand in front of the crown and look busy; lower them or take them out in a later pass the maintainer sees.
