# Wood: planks, posts, logs

**Model:** the jetty at the Phatt dock in the 1991 game (mi2-bg-2-028), picked from a sheet of that room over our docks (the water and wood sheet). Both follow the Phatt dock: **jetty wood turns warm, chunky and crooked; the docks are repainted to it first.** Not taken: keeping ours (the docks' thin grey-brown weathered walk). **Our model is the docks** since their pass 10 (approved). Code: the kit, `src/game/ui/pixel/keri/kit/wood.ts`, lifted from `docksPicture.ts` pixel for pixel (merged); the knoll's logs in `knollPicture.ts`.

## Types

Lifted from the docks, `picked` on the approval of the docks, with the rule in each type's `model` ([kit.md](kit.md)). **The wood has its own run of six colours, `KIT_WOOD`** in `kit/wood.ts`: no shared material of the palette is wood, so a scene that places a wood type names it as its own run, `scenePalette({ wood: KIT_WOOD }, ...)`. The planks are a fill on a `DeckGround` (the deck as the scene's plank points); a post is placed by its foot and may take the scene's projected `spine`.

| Type | What it is for | The look | State |
|---|---|---|---|
| `wood/planks` (a fill) | a deck or a walk of boards: the jetty, a landing, steps | broad warm planks, each its own tone, a pale top edge, a near-black gap, dark beams under. Variants `deck`, `even`, `worn` | in the kit, `picked` |
| `wood/post` | a pile, a rail post, a pole | thick, leaning, warm brown, near-black on its shade side, darker where wet, a cream cut top. Variants `pile`, `in-water`, `thin`, `stump` | in the kit, `picked` |
| `wood/log` | a found trunk to sit on, driftwood | the knoll's crooked logs | not in the pick; compare after the docks |

Custom: the docks' hut, its thatch and its sign post are the scene's (a house is a place of Keri: [not-picked-yet.md](not-picked-yet.md)); they take the wood's colours, not a kit type.

## Recipe

After mi2-bg-2-028, measured on the room at its own 320 by 144 pixels:

1. **Warm.** The boards are red and orange browns (#843818, #944820, #9c4018, lit to #bc5020, shaded to #581810), not grey. Ours are grey-browns (#6a4c3c, #593d35, #7c5d47).
2. **Chunky.** By eye, a board is 6 to 10 of the room's pixels across where it is nearest, and about a dozen boards make the stretch of walk the room shows. Ours are much thinner for the picture's size, and many.
3. **Each board its own tone.** Neighbours differ by a step, one in four is clearly lighter or redder, and a board is lighter toward its lit end. No two rows of equal stripes.
4. **A pale top edge and a black gap.** Along each board's lit edge a line of the lightest wood tone, one pixel; between boards a gap of near-black (#080800, #201008), one to two pixels. About an eighth of the deck is gap.
5. **Crooked.** Boards are not parallel: ends stick out past the deck's edge by different amounts, some are tilted, one is short or missing. Posts lean, each its own way, and stand taller than the deck by different heights.
6. **Posts have pale caps.** The cut top of a pile is the lightest thing on it (cream to pale grey), its side goes from warm brown to near-black on the shade side.
7. **Under the deck is dark.** Near-black with a few warm strokes for the piles and braces, so the deck reads as a lit slab over a dark gap over bright water.
8. **Grain is paint grain:** up to half the pixels of a board are lone grain along its length; no drawn wood rings.
9. **At night** navy boards with cyan rims on the top edges; warm orange only within a few pixels of a lamp, on the faces that look at it ([light-and-heat.md](light-and-heat.md) rules 6 and 7).

## Atlas

- `find --tags dock` (mi2-bg-2-028): the model.
- `find --tags woodtick` (mi2-bg-0-007, mi2-bg-0-014): plank walks and decks at night, by lamplight.
- `find --tags wood,outdoor`: 48 pictures; `treehouse` (mi2-bg-1-061) for boards in a building.
- Pattern book: [vocabulary/wood.md](../vocabulary/wood.md) (swatches wood-1 to wood-5).

## Keri

- The north jetty is real (`about jetty`, `find --scene docks`); the painted walk goes round the big rock, as decided. Warm orange boards are a departure from the real weathered grey wood: a row for the departures list (in the photo map), to add when the repaint lands.
- The knoll's logs lie round the fire place.

## Where each picture stands

| Picture | Wood |
|---|---|
| Docks | **the model** since pass 10: broad warm boards each its own tone with pale top edges and dark gaps, thick leaning posts with cream caps, at all four hours; the hut keeps its shape and the sign post takes the wood's colours. Seen beside the room: our boards are still narrower than the room's and the dark under the deck shows less, as the walk is seen from above |
| Knoll | crooked found logs round the fire, brown: right in kind; to check against rule 1 after the docks |
| Crossroads | the sauna's and the well house's boards are painted clapboard (mint, red corner boards), a building's and not this recipe |

## Open

- Done: the docks' walk, landing and posts repainted and lifted as `wood/planks` and `wood/post`. They are `picked` and in the kit.
- TODO(painter, R2): a departure row "the jetty's boards are warm orange-brown, the real ones weathered grey" once it is painted.
