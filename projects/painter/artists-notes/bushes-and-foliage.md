# Bushes, roses, foliage

**Model:** the knoll. The knoll is the model for grass, bushes and foliage. Code: the kit, `src/game/ui/pixel/keri/kit/bushes.ts`, lifted pixel for pixel from `knollPicture.ts`: `bush` (and `bushAt()` for lumps a scene has placed already) for any leafy heap, `rose` for the dog-rose thicket, `stem` for a tall dry stalk with its seed head.

## Types

`npm run art:render -- kit bushes` paints them all. How to add one: [kit.md](kit.md).

| Type | What it is for | Variants | State |
|---|---|---|---|
| `bushes/bush` | leafy lumps heaped on a foot, lit as one heap, flat patches of leaf, dark below | `heap`, `low`, `round` | picked |
| `bushes/rose` | a thicket of wild dog rose banked against a side, its top falling to the ground, pink flowers and red hips on the lit leaves. Options beyond its size: `keep` (the share of its width over which its top stays at full height before it falls) and `deep` (how far under its top its leaves go from lit to darkest) | `corner` (the knoll's, about 3 m), `low`, `tall` (the crossroads': a 3 m thicket near the viewer, 250 wide, 220 high, 23 lumps, standing its full height over half its width, its leaves lit deeper) | picked; `tall` is the crossroads' thicket in the kit's shape |
| `bushes/stem` | a tall dry stalk bending once, two withered leaves, a flat seed head of rays; bends with the gust | `tall`, `short`, `lone` | picked |

The rose hands out its look in pieces for a thicket a scene shapes its own way: `roseRun()` (its leaves, dark to light), `roseTone()` (the leaf blotches over the thicket's light), `roseFlower()` (a flower or a hip). The crossroads paints its thicket through them, and its 3 m heap is the variant `tall`. The scanned grain on a run's colour, which the crossroads and the paths share, is `fleck()` in `kit/shape.ts`.

## Recipe

1. **A bush is a heap of leafy lumps on a foot,** each lump round with a wobbling rim (`lump()`), the lumps of unlike sizes.
2. **Lit as one heap more than as its lumps** (60% by where the pixel sits in the whole bush, 40% by its own lump), or it reads as a pile of balls: light on top and on the light's side, dark below.
3. **Leaves in patches.** The tone moves in steps by a blotchy noise (cells about 4.5 by 3.2 pixels, strength 0.85 of the run): light and dark clusters of leaves, not a smooth ball and not a regular scallop pattern.
4. **Five tones,** from the darkest `near` green through the `bush` run. The top never fades into the pale `far` greens.
5. **The rim:** the outer tenth of a lump goes a little lighter on its upper side and to the darkest tone on its lower side. No drawn outline.
6. **Dog roses (kibuvits)** are one thicket, not single bushes: taller than the viewer (at least 3 m high and quite thick), its top a row of lumps that catch the light, under them leaves in light and dark heaps that darken downward. Flowers only where the light is on it: five petals as a small cross, pale toward the light, a yellow middle in the nearer ones; about one lit pixel in fifty starts a flower, and a quarter of those are red hips (two pixels) instead.
7. **A thicket is a wing.** It closes a side of the picture and stands dark against the sky or the sea.
8. **Tall dry stems** with flat seed heads may reach into an upper corner, dark before the sky; the gust bends their tops.

## Atlas

- `find --tags jungle,day` (mi2-bg-4-096 to 4-098, mi2-bg-1-052; swatches foliage-1, foliage-2): leaves as dark-edged clusters in four or five greens over a near-black green, far layers lighter and softer. Leaves are where MI2 puts its hardest contrast (steps up to 12.5 L*).
- `find --tags waterfall` (mi2-bg-2-036, swatch foliage-3): far bushes and hills as rounded lumps in three greens, lit on top, a dark seam between lumps.
- `find --tags mansion,outdoor`: clipped and wild bushes against stone walls.
- `find --tags beach,scabb` (swatch foliage-6): foliage at night as near-black blue masses with lighter blue rims on top.
- Pattern book: [vocabulary/plants.md](../vocabulary/plants.md).

## Keri

- Dog roses at least 3 m high, thickest right of the lighthouse track; the ground between the crossroads and the lighthouse lush with wild dog roses, branches arching over the paths; quite a few bushes between the houses.
- Cow parsley and tall dry umbels by the walls and in the meadow. `find --tags bush,keri` and `find --tags flowers,keri` list the photographs.

## Where each picture stands

| Picture | Bushes |
|---|---|
| Knoll | the model |
| Crossroads | since its pass 9 the roses follow the knoll's leaf colour and broken patches (not yet in a consistency review); **its big chunky mound shapes stay** (they carry the MI2 chunk). Custom: where the thicket stands (below) |
| Docks | no bushes |
| Garden | paused for a total rework |

## Custom

- **The crossroads' rose thicket, its placement.** The dog roses there are about 3 m tall and thick (the reference photographs) and are no thing at a foot: a height field on the ground (a 4.8 m grid of heaps), painted row by row with the grass and cut by the paths, the lanes and the glades. The placement stays in `crossroadsPicture.ts`; every pixel of it is painted through the kit's rose (`roseRun()`, `roseTone()` with a grain finer far off, and `roseFlower()` of `bushes/rose`), so the crossroads' rose and the knoll's are one plant.
- **The crossroads' far flowers.** Past about 38 m a flower is one pixel of pink and past 25 m a hip one pixel of red, where the kit's five petals would blur: the scene's own, in `crossroadsPicture.ts` (`rose()`).

## Open

- IDEA(painter): MI2's dark-edged single leaves at the very front of a thicket (foliage-1), for the bush nearest the viewer only.
