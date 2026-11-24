---
title: "Scene: the village square: notes, what was decided, what is open"
---
# Scene: the village square: notes, what was decided, what is open

These notes are the painter's. The reference photographs of Keri and the reference screenshots stay out of the repository ([docs/keri.md](../keri.md) section 6).

## What it is

The open ground between the houses at the lighthouse: the lighthouse's side building (`building-2`), the cinema and engine-room house (`building-3`) and the old boat shed (`wood-shed`). The viewer stands at the lighthouse's south-west foot and looks east-south-east over the square toward the southern pier. Plan: `src/core/layout/square.ts`; painter: `src/game/ui/pixel/keri/squarePicture.ts`; scene: `content/scenes/square.json`.

## Sources

The world model's buildings (`content/world/keri.json`), which agree with the public orthophoto of the island, and [keri.md](../keri.md) sections 9 and 10 for what each house is. No ground photograph of this view was at hand.

## What was decided

- The viewer's spot is about 3 m west and 11 m south of the lighthouse (`SQUARE_VIEW`); the view runs from the north end of `building-3` on the left to the sea south of the old boat shed on the right.
- The side building's south wall is the left wing. The cinema house stands further back, is longer than it looks from here and runs on to the left behind the side building: the gap between the two is in depth, not sideways.
- The two houses must not blend: the cinema house has its own colours (a red roof, ochre walls, a blue and white awning). They are the painter's choice, not the real house's.
- The old boat shed's corner is the right wing; the lighthouse's own foot is the dark shape at the lower left. The new wooden shed is behind the viewer and the small shed by the shore is behind the cinema house: neither is in view.
- The square looks a little like a town plaza: flagstones in rings, benches, barrels. Its middle is a flower bed with a rose bush; no lamp stands in the plaza.
- No tractors or other machines.
- The plaza lies on a fat-bellied hill: past its brow the ground drops away to the dark tops of the wild rose thickets, and the shore and the pier are small and far below, as the lawn rolls off before the governor's mansion on Phatt Island in the 1991 game. This departs from the real island, which is low and flat.
- The pier runs from the far shore up to the right toward the horizon and is the port scene's own ([scene-port.md](scene-port.md)): a grey stone quay that stands up from the water with its shaded face toward the viewer, bollards, the red and white beacon at its head, the low landing with the rowing boat, the red houseboat.
- Keri's shore has a beak of shingle well left of the pier, small and far off, that reaches out and sweeps to the right. The dune strip continues its line beyond a gap of open water: a long, thin, low bank that runs on behind the pier right across the distance, about knee-high over the water (thin, never flat: a lit top over a dark foot), where the swell breaks in white bursts (in a storm they look like explosions). The orthophoto shows it leaving the island's south-east corner east of the pier and running on south-south-east, most of it shoal.
- One path leads past the cinema's doors into the gap behind the side building and on round the lighthouse; another leads over the brow to the pier.

## How the picture is made

- The view is a stage set, not a camera's: each thing stands in the order and on the side it has from the viewer's spot, larger and nearer than to scale, and the picture's lines are bent (`bend` in the plan: level lines bow down at the sides, what stands up fans out toward the top).
- From the 1991 game's town pictures: sunlit walls against violet cast shade, a dark shape near the viewer in each lower corner, houses each in its own colour, walls that lean and roofs that sag.
- The hour changes the colours and where the shade lies, never the drawing. By day the sun stands to the right and the boat shed's shade lies over the plaza's near right; at dusk the lighthouse's own long shadow lies across the square.
- The palette has no room left (250 of 256 places): a new material needs a run given up.

## What is open

- TODO(builder, R2): pressing the pier walks to the port (`squarePlan().pier` is its box in fine pixels); the scene has no exit yet.
- The plaza's paving follows the town streets of the 1991 game (Phatt Island's town, atlas `mi2-bg-2-027`): a pale ground of worn stone with no drawn joints, cobbles showing here and there as warm rounded blotches that grow toward the viewer, grey ones in the cast shade; the light and the shade carry the plane.
- The houses' walls follow the same town: stones of every size in loose courses, each its own flat blotch (the wall's wash, grey, an ochre or rusty one now and then), pale soft mortar and no dark joints. The viewer stands past the lighthouse, so the tower is not in the picture: on the left only the side building shows.
- The houses are built as the 1991 game's town houses and the later game's (the Phatt Island town, atlas `mi2-bg-2-027`; Puerto Pollo, the atlas's MI3 shelf `part1/003`): a house shows a near corner with one side in the light and one in deep shade, leans, and carries its own things: arches of pale stone with deep dark openings, beams sticking out under the eave with their shade, a pale verge down the gable, a lantern or a signboard (a picture, no words) on an iron arm, a box of flowers, a crooked stovepipe, dark timbers that are never straight. The side building keeps its boarded window and its door nailed shut; the cinema house its awning and poster.
- The picture is 180 rows tall, a scene's whole main area once the band is gone (ft_1_20); the other scenes are still 124. What is pressed lies in its upper 124 rows, and the near foreground (boulders, a crate and barrels by the shed, in the near shade) runs down to the screen's foot. While the band is still drawn it covers the lower 56 rows.
- TODO(painter, R2): the near foreground of the taller picture is a first pass: the big near slabs, the crate and the boulders want the finish the rest has.
- TODO(painter, R3): what stands still (`sceneLiving.ts`): the far sea, the pennants on the string, the grass on the brow.
- KERI-TODO: the real colours of the cinema house and of the side building, and what stands on the real square, if the painted plaza should follow them.
- NEEDS-HUMAN: the look of the scene in the game on the laptop; the level it opens at (2 is AX-3 provisional).
