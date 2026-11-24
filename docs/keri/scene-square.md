---
title: "Scene: the village square: notes, what was decided, what is open"
---
# Scene: the village square: notes, what was decided, what is open

These notes are the painter's. The reference photographs of Keri and the reference screenshots stay out of the repository ([docs/keri.md](../keri.md) section 6).

## What it is

The open ground between the houses at the lighthouse: the lighthouse's side building (`building-2`), the cinema and engine-room house (`building-3`) and the old boat shed (`wood-shed`). The viewer stands on the gallery on top of the lighthouse's stone foot and looks down south-east over the square toward the southern pier. Plan: `src/core/layout/square.ts`; painter: `src/game/ui/pixel/keri/squarePicture.ts`; scene: `content/scenes/square.json`.

## Sources

The world model's buildings (`content/world/keri.json`), which agree with the public orthophoto of the island, and [keri.md](../keri.md) sections 9 and 10 for what each house is. No ground photograph of this view was at hand.

## What was decided

- The viewer's spot is a raised one: the gallery on the lighthouse's stone foot (`SQUARE_VIEW`), painted lower than it truly is. The view looks down on the square, turned far enough right that the old boat shed stands whole in it. The 1990s towns are seen this way, never from a walker's eye (`projects/painter/vocabulary/viewpoint.md`).
- The side building lies below the viewer at the lower left and shows mostly its blue tin roof from above. The cinema house stands further back on the left, its red roof like a hat on it.
- The two houses must not blend: the cinema house has its own colours (a red roof, ochre walls, a blue and white awning). They are the painter's choice, not the real house's.
- The old boat shed stands whole on the plaza's right, its gable with the big door toward the viewer. What the viewer stands on shows along the bottom edge, dark: the gallery's stone rim and thin iron rail with one ball-topped stone post, and the tower's bell on its bracket at the upper right. The new wooden shed is behind the viewer and the small shed by the shore is behind the cinema house: neither is in view.
- The square looks a little like a town plaza: flagstones in rings, benches, barrels. Its middle is a flower bed with a rose bush; no lamp stands in the plaza.
- No tractors or other machines.
- The plaza lies on a fat-bellied hill: past its brow the ground drops away to the dark tops of the wild rose thickets, and the shore and the pier are small and far below, as the lawn rolls off before the governor's mansion on Phatt Island in the 1991 game. This departs from the real island, which is low and flat.
- The pier runs from the far shore up to the right toward the horizon and is the port scene's own ([scene-port.md](scene-port.md)): a grey stone quay that stands up from the water with its shaded face toward the viewer, bollards, the red and white beacon at its head, the low landing with the rowing boat, the red houseboat.
- Keri's shore has a beak of shingle well left of the pier, small and far off, that reaches out and sweeps to the right. The dune strip continues its line beyond a gap of open water: a long, thin, low bank that runs on behind the pier right across the distance, about knee-high over the water (thin, never flat: a lit top over a dark foot), where the swell breaks in white bursts (in a storm they look like explosions). The orthophoto shows it leaving the island's south-east corner east of the pier and running on south-south-east, most of it shoal.
- One path leads from the plaza to the cinema's doors; another winds in an S over the brow to the pier, drawn whole so the walk can be read.

## How the picture is made

- The view is a stage set, not a camera's: each thing stands in the order and on the side it has from the viewer's spot, larger and nearer than to scale, and the picture's lines are bent (`bend` in the plan: level lines bow down at the sides, what stands up fans out toward the top).
- From the 1990s games' town pictures: the eye a storey or more up, the ground a readable shape, roofs seen as planes, houses wider at the eave than at the foot and leaning, sunlit walls against violet cast shade, the stand-place dark along the bottom edge, houses each in its own colour, roofs that sag.
- The hour changes the colours and where the shade lies, never the drawing. By day the sun stands to the right and the boat shed's shade lies to its left over the plaza; at dusk the lighthouse's own long shadow lies across the square.
- The palette has no room left (250 of 256 places): a new material needs a run given up.

## What is open

- TODO(builder, R2): pressing the pier walks to the port (`squarePlan().pier` is its box in fine pixels); the scene has no exit yet.
- The plaza's paving follows the town streets of the 1991 game (Phatt Island's town, atlas `mi2-bg-2-027`): a pale ground of worn stone with no drawn joints, cobbles showing here and there as warm rounded blotches that grow toward the viewer, grey ones in the cast shade; the light and the shade carry the plane.
- The houses' walls follow the same town: stones of every size in loose courses, each its own flat blotch (the wall's wash, grey, an ochre or rusty one now and then), pale soft mortar and no dark joints.
- The houses are built as the 1991 game's town houses and the later game's (the Phatt Island town, atlas `mi2-bg-2-027`; Puerto Pollo, the atlas's MI3 shelf `part1/003`): each leans, is wider at the top, and carries its own things (a signboard on an iron arm, a lantern, beams, a crooked stovepipe, a net with floats).
- The picture is 180 rows tall, a scene's whole main area (ft_1_20). What is pressed lies in its upper 124 rows.
- TODO(painter, R2): the view from the gallery is a semi-sketch awaiting the maintainer's marks: the houses want more lean and bulge, one wall of each wholly in shade, stones only in patches, and the finish pass.
- TODO(painter, R3): what stands still (`sceneLiving.ts`): the far sea, the pennants on the string, the grass on the brow.
- KERI-TODO: the real colours of the cinema house and of the side building, and what stands on the real square, if the painted plaza should follow them.
- NEEDS-HUMAN: the look of the scene in the game on the laptop; the level it opens at (2 is AX-3 provisional).
