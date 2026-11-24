---
title: "Keri map: notes, what was noticed, improvement tips"
---
# Keri map: notes, what was noticed, improvement tips

These notes are what the agent saw on the reference pictures. They may be wrong, and nobody has confirmed them. The pictures stay out of the repository ([docs/keri.md](../keri.md) section 6); they are named by their file number; input-log items 14 to 17 (section 4 there) are files 18 to 21.

## What it is

The map of Keri is one painted picture of the island seen at a slant from the south, reached through the room's door ([ft_1_18.AC2](../features/ft_1_18-keri-island.md), [d111](../decisions/art.md#d111) points 8 and 11 to 14). It shows a painted place for every scene ([ft_1_19.AC2](../features/ft_1_19-scenes-on-keri.md), [d113](../decisions/game.md#d113)). Everything on it comes from the world model ([d108](../decisions/game.md#d108), `content/world/keri.json`) except the few things the picture adds for looks.

## The map as a caricature (d125)

The map is in the manner of the 1991 game's island maps, with the places of interest and the rocks deliberately oversized: a fat Keri ([d125](../decisions/game.md#d125)). What the study of those maps taught is in `projects/painter/vocabulary/maps.md`.

- **The shape:** `MAP_SHAPE` in `src/core/layout/keriMap.ts`: 1.45 times as wide across the short side, turned 8 degrees. Change a number there and the whole map follows; `caricature` (`src/core/layout/keriMapShape.ts`) also knows a shorter north-west tail and swells round places, unused so far.
- **Larger than to scale:** the lighthouse 3.3 times (`LIGHTHOUSE_DRAWN`), the houses, the mast, the knoll's plateau and fire, the docks' lookout on its rock, the sea rocks.
- **Land and sea:** dark olive land in brushed bands with dry patches; a bank's face under the southern shores; a deep sea in flat bands by distance with grain and thin dark ripple lines, pale shallows, no white surf; small pale wave strokes of two or three humps with a darker one under them, sparse; smoke from the sauna; at night the fire's glow on the knoll and the moon's light on the stones. The island's north-west tip is a sharp wedge, its point at the north-west corner and its southern side straight (`tip` in `MAP_SHAPE`).
- **The sand strip:** the south-east corner is sand under the water, no land (d125): by day the sea over it turns green and then a pale sand, at the other hours it is the sea's own paler tones, with a thin broken pale line where the sea breaks on it. It is the back of a sea creature for whoever looks long: a flank one tone darker than the water round it, two fins, an eye of two pixels in its broad end. Nothing else says so. The plan's cut runs through its root.
- **Sea rocks:** thick round the north-west end, a fair number off the north shore, few in the south and east, in clumps of big and small, as on the orthophoto. Each is a leaning slab with a pale top plane and two flat faces; no two alike: five builds from a single slab to a stack of seven, darker and paler stone, weed on some tops; the foot ragged and lifted at its ends with a dark broken reflection under it; round each a few arcs of unlike length at unlike distances. One absurdly big stack stands off the western third. The bundle of three boulders lies in the west (E5).
- **Places spread apart:** the houses are spread so that none sits on another (`spreads` in `MAP_SHAPE`): the cinema and engine room clear of the lighthouse's side building, the wooden shed off the lighthouse, the old boat shed nearer the water, the well house east of the warden's house, the power station west of it. The gull mummy's shed is small. Points written into `MAP_SHAPE` for the map alone: the helicopter pad, a square of concrete slabs, a pad's width east of the point inside the tip's wedge; the power station about 40 m west of where it is measured; the mast's foot between the power station and the house's end; the sauna further north-east, with the end of its path; the terrace further out over the shingle.
- **The northern docks:** the rock with the lookout stands at the shore's edge as the head of a small reef, two small rocks beside it; the boat slip from the shingle runs on to a landing at the rock's left foot. Dock and slip lie over the east part of the house, as on the orthophoto (`moves` for the scene, `lines` for the slip).
- **The southern dock:** a pale road down to the shore, and from the last land a pier of planks on posts with a landing across its end; the measured slipway's concrete tongue is part of the coast, so the pier runs on past it. The southern slipway runs from the path's crossing by the old boat shed down into the sea (`lines` in `MAP_SHAPE`); the world model's line still runs as traced.
- **Paths:** only the paved ones are drawn; the footpath round the island and the trodden line on the east shore are left out, since they clutter the space. The house is drawn twice its ground plan, so a way that starts under it starts at the nearer end of the pavement before its face. Bushes keep off the paved ways. A way runs from the house's west end to the power station (`track-to-power-station`), its course between the two by eye. By the lighthouse, the way from the west keeps its measured course to the knoll, comes to the tower's foot and goes on down to the wood shed; the way to the eastern houses leaves it at the foot and runs before their doors; the dock's road leaves that one (`lines` in `MAP_SHAPE`, with `keep` for the measured head).
- **The well and the memorial:** the well stands by the fork, west of it and south of the way from the house, as measured; the well house is a well with a roof on two posts. The Kaleva memorial (`memorial` among the world model's landmarks, at (-29, 15)) stands nearer the tower's foot than the fork, north of the way: shore stones heaped round three dark plaques on the low base of an old building, the pyramid of poles with its cross of boards over them, the flagpole with the flag beside it (studied from a blog picture, not copied).
- **The warden's house:** four fifths of its length, six windows and the door in the middle, a flat face and three chimneys, no porch. The roof over the door is a low, wide gable flush with the wall under a small roof that runs back into the big one, a cornice across its foot and a red half-round window in it. Its tin roof is pale blue as on the reference photograph (the world model still says `tin`; the map reads a large house's tin as painted). The terrace before its door is a deck with red benches over the shingle, pavement along the house's face, and no walk or stair down to the water.
- **The houses are crooked cottages** (d125): a house keeps its place and size and turns to the viewer the side that faces south. A house lying east to west shows its long wall, leaning, with dark panes between coloured shutters, a door on its step and violet shade under the eaves, under a roof as high as the wall that hangs over it, sags along its ridge and is laid in three flat bands with a glint on the ridge and a patch or two of rust; a house lying north to south shows its gable, the roof running back from it, both slopes seen from above. Chimneys are crooked. The colours are the photographs', louder; the huts' green boards are a sea green, so that a hut stands off the meadow; a hut's bare tin is a weathered warm grey. Houses keep their sizes and places; they are not drawn smaller or pulled in to the lighthouse's foot. More in [maps.md](../../projects/painter/vocabulary/maps.md) ("A village on an island map").
- **The lighthouse:** the proportions of the reference photographs, straight: the limestone foot over half the height and four times as wide as the iron tower, hooped in its lower half, one small window, its courses as short broken lines, light in flat bands round it with the shade turning violet, hoops of rusted iron with rust run down under them, damp green at the foot; a gallery with a rail on its top; the slim rust-red tower flares out on brackets under the upper gallery; a drum, the lantern with its own rail, a rusty dome with a capped vent (`TOWER` in `mapPicture.ts`).
- **The mast** at the house's gable with the weather station: tall, rust brown, tapering, with braces and stays and no trusses.
- **The knoll** has a leaning tree at its left and a little smoke (the scene's departure, section 9 of [keri.md](../keri.md)). The compass rose is small, clear of the island's east end.
- KERI-TODO: the southern slipway in `content/world/keri.json` runs as traced from the orthophoto, with its head 16 m from the gull mummy's shed; the map's line puts the head about 14 m further west, so that it leads towards the lighthouse. Ask the maintainer whether the traced line is wrong on the ground too.
- KERI-TODO: the power station, the mast and the helicopter pad stand where the map alone puts them; the world model has them where the orthophoto puts them. If the map's places are the true ones, the world model is to follow.
- KERI-TODO: the line of the way to the power station; which of the ways by the lighthouse are paved on the ground, and where the lighthouse's door is.
- **Kept free on purpose:** the sea off the north coast where the tractor lies ([keri.md](../keri.md) section 9): nothing is drawn there until the maintainer says so.
- TODO(painter, R2): the guide pole, the flagpole and the terrace as small drawn things; the day's sea darker and less saturated (the gauge against the 1991 maps: dark 0.08 against 0.25 to 0.45); the knoll's fire place moves when the scene moves in the world model.

## Sources

Input log items 1, 2, 2b, 3 to 6, 9, 10, 11 and 13 (the orthophoto, the marked satellite image, the drone photos, the height layers, the base map and the style screenshots), and items 14 to 17 (the four photographs). The decisions are in [d113](../decisions/game.md#d113).

## Noticed on the reference pictures

State: `drawn` (it is in the map picture), `not drawn`, or `unsure`.

| What | On which picture | State |
|---|---|---|
| The paths between the buildings are cracked concrete slabs, pale grey, about a metre wide, with a Y fork near a green hut; the map draws thin pale lines | 18, 20 | unsure (lines drawn; slabs not) |
| The two small huts are green board huts; one has a brick chimney | 18, 20 | drawn |
| A white notice board on the wall of one hut | 20 | not drawn |
| A white flagpole east of the warden's house | 18, 19 | not drawn |
| A slim lattice mast north-west of the house, near the north shore | 18, 19 | drawn (landmark) |
| A small pylon by the lighthouse | 18 | not drawn |
| A jetty with a boat on the north shore near the warden's house; probably a makeshift harbour between rocks, and letter C on photo 19 | 19 | drawn (the docks' walk and lookout; no boat) |
| A concrete helicopter pad with a grid pattern in the north-west part (keri.ee also lists it) | 19 | drawn (landmark `helipad`, the square drawn on the orthophoto) |
| The warden's house has a blue-grey tin roof; its face is flat, with a low gable over the door and a wooden terrace before it (the reference photograph from the shore) | 18, 19 | drawn without the porch, with the raised gable over the door |
| A low grey shed north-west of the house | 19 | drawn (`north-shed`) |
| Solar panels on the lighthouse gallery and a rust-coloured lantern dome | 18 | not drawn |
| The meadow is bright green in summer and gold and red later in the year | 18, 19, 21 | drawn as green with dry gold patches (seasons are ft_Y_14) |
| Pale shingle shores and boulders in the shallows | 18, 19, 21 | drawn |
| Green-brown weed shallows off the south shore; the sea on the map has teal shallows only | 19 | not drawn |
| The boat slipway runs from the southern shore into the sea | 18, 19 | drawn (path kind `slipway`, rails on sleepers) |
| Letters on photo 19: A at the east tip, B north of the lighthouse, C at the north jetty, D in the sea south of the knoll with a red line | 19 | unsure: only C is guessed; ask the maintainer |

## Improvement tips (not built; the maintainer picks)

- Draw the paths as pale cracked slabs with the Y fork by the green hut.
- Add the north jetty with its boat, the helicopter pad, the flagpole and the pylon.
- Add solar panels on the lighthouse gallery and a rust-coloured dome.
- Paint green-brown weed in the shallows off the south shore.
- Gold and red meadow in autumn, with the seasons.
- Ask the maintainer what A, B and D on photo 19 mark.

- TODO(painter, Later): the map's sea in the shared motion's loop of looks (`paint/motion.ts`: rocking strokes, twinkling glints, breathing surf) instead of its own two looks; its clouds already drift with the shared kit and the day's sky (`windMotion.ts`).

## Checked against the refined rules

With the room, checked again ([art-direction.md](../art-direction.md) rules 19 to 25, d111). The map's runs had steps up to 16 L* (the sea at night, parchment, stone); they are made long (142 to 174 colours), which shows as a smoother sea. Three shallows colours that no hour ever used were removed. The clouds keep their ranges. The island's shape, grass and shore come from the world model and were left alone; rules 23 to 25 ask nothing more of a map at this size.
