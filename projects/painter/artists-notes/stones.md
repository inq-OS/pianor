# Stones, boulders, shingle

**Model:** the docks. The docks are the model for stones. Code: the kit, `src/game/ui/pixel/keri/kit/stones.ts` (`boulder`, `pebble`) and `kit/shape.ts` (`lump()`, the round shape under both), lifted pixel for pixel from `docksPicture.ts`. Where the stones go stays the scene's: the docks' `pebbles()` lays the shingle far to near and `cornerRocks()` heaps the dark boulders in the near corners.

## Types

`npm run art:render -- kit stones` paints them all. How to add one: [kit.md](kit.md).

| Type | What it is for | Variants | State |
|---|---|---|---|
| `stones/boulder` | a heap of round lumps in flat bands: on the shore, in the water, dark in a near corner | `middle`, `small`, `big`, `in-water` (wet foot, foam ring), `foreground` (the dark end of the run) | picked |
| `stones/pebble` | one flat lump of four tones; the shingle is hundreds of them, far to near | `pebble`, `grey`, `brown` (red granite), `cobble`, `foreground` | picked |

Wanted as candidates: a flat slab or ledge (atlas `cliff`: mi2-bg-1-058), a stack of shore stones, a mossy stone showing through turf (the knoll). Custom: none (the boulder under the docks' hut is the kit's boulder, placed by `rock()`).

## Recipe

1. **A boulder is a heap, never one ball.** Three lumps for a small one, four or five for a big one, plus a broad low lump under them all so the heap stands on its foot. The middle lumps reach the top, the side ones sit lower; no two the same size (`lump()` wobbles each rim by its seed).
2. **Light it as one mass first, each lump only a little on its own:** a lit top and a lit side toward the hour's light, a hard shade side away from it. Lit per lump alone it reads as a pile of balls.
3. **Four flat bands, no gradient** (`Math.round(t * 3) / 3`): pale top, mid, belly, dark underside. The tone comes from the `stone` run of the shared palette; a faint blotchy noise (12% of the range) moves the band edges so they are not level lines.
4. **A dark seam where two lumps meet** (the two nearest lumps within 3.5% of each other): the darkest stone tone, one or two pixels wide. This is what makes it MI2: each lump reads as a shape.
5. **A pale rim** where a lump's top faces the light (the top 12% of a lump on the lit side goes one band up).
6. **Lichen as single pixels,** about 1 in 125, only on the lit bands, in a pale green of the `far` run. Never a patch.
7. **Where water laps it:** the lowest rows wet and weedy (dark bush green and near-green, mixed pixel by pixel), and a broken ring of foam at the foot that comes and goes with the sea's loop.
8. **Near the viewer, stones are the dark wings.** The corner heaps are painted from the dark end of the run only (`dark` 0.3 to 0.42) and are big: half a boulder cut by the frame's edge.
9. **Shingle:** pebbles far to near, each a small lump of a few flat tones, light on top and dark under, bigger toward the viewer; fewer and bigger rather than a fine speckle.
10. **The surface is grain, not speckle:** the scene's `grain()` pass (`paint/grain.ts`) moves pixels one place up or down the stone run in short dashes, so each band reads as paint.
11. **Ink line:** a big rock carries the ink edge in the darkest tone of its own run where it stands before something else. A small stone carries none (art-direction rule 25): its dark underside is its line.

## Atlas

- `find --tags beach,scabb` (mi2-bg-0-004, swatch rock-3): night boulders as heaped lumps in three blues with near-black seams. This is the picture the recipe was built on.
- `find --tags cliff` (mi2-bg-1-058 swatch rock-2, mi2-bg-2-037 swatch rock-1, mi2-bg-1-059): slabs with dark cracks and near-white lit faces; red-brown lumps with dark seams under a green top.
- `find --tags =rock,day,mi2`, `find --tags fortress,outdoor`: rock against sea in a storm.
- Pattern book: [vocabulary/rocks.md](../vocabulary/rocks.md). MI2 stone has steps of 6.6 to 7.5 L* between neighbours and about 40% lone grain.
- Checked (consistency review 1, `compare-stone.png`): the docks' plates and seams match rock-2 and rock-3; the docks' ring of ink round small sea rocks does not (MI2 has none).

## Keri

- The shore is shingle and rounded granite boulders; the north jetty's landing stands on one big boulder (the reference aerial photographs). `find --tags stones,keri` lists the photographs.
- The knoll's ground is rocky ground made comfy by moss and low meadow plants: stones show through the turf, with loose small pebbles in patches.

## Where each picture stands

| Picture | Stones |
|---|---|
| Docks | the model. To drop: the ink ring round the small sea rocks and shore stones |
| Knoll | soft pale lumps with no seams or bands, shingle a soft scatter: to move to the recipe (bands, seams, the knoll's own grain kept) |
| Crossroads | since its pass 9 both rocks place the kit's `stones/boulder` (`middle` and `small`, sized to the rock), painted through the picture's own bow and outline; its extra grain on the stone went (not yet in a consistency review) |
| Room | the brick chimney wall is an even grid: uneven bricks, a few chipped or darker, wavering mortar (review 2 of the room) |
| Map | rocks are to be oversized in the manner of MI2's island maps; the map's notes have it ([map.md](../../../docs/keri/map.md)) |

## Open

- Done: the docks call `kit/stones.ts` (pixel for pixel the same at four hours). Next: the knoll and the crossroads place the same types.
- TODO(painter, R2): the knoll's and the crossroads' stones by this recipe.
