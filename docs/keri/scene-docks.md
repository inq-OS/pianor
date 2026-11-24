---
title: "Scene: the docks: notes, what was noticed, improvement tips"
---
# Scene: the docks: notes, what was noticed, improvement tips

These notes are what the painter saw on the reference pictures. They may be wrong, and nobody has confirmed them. The pictures stay out of the repository ([docs/keri.md](../keri.md) section 6); they are kept in the painter project's private folder under `painter/docks/`, with input-log items 24 to 26 (section 4 there).

## What it is

The jetty on the north shore behind the warden's house (it can be seen behind the warden's house; it looks like Monkey Island 2, not like modern equipment). A scene of [ft_1_19](../features/ft_1_19-scenes-of-beings.md), level 2 (AX-3 provisional: the knoll is level 1, and levelling up opens new scenes, d113). Its place in the world model (x -101, y 100 metres from the lighthouse) is the jetty's middle, set by eye from the reference aerial photograph on the orthophoto's shore, good to about 10 m.

## Sources

Reference pictures ([keri.md](../keri.md) section 4) items 24 (the aerial photograph with "C terminal", "Liitsiht" and two red arrows), 25 (the jetty from above with "Kinnituskohad") and 26 (two pictures of docks in Monkey Island 2 as first released in 1991, Woodtick and Scabb Island at night).

## Direction for the picture

- The northern jetty, which can be seen behind the warden's house, in the manner of Monkey Island 2 and never like modern equipment; the 1991 game's docks of Scabb Island are the kind of spot that serves as inspiration. The view is along the jetty from its root.
- Never trying to look realistic; quirkiness is good ([docs/art-direction.md](../art-direction.md) section 1).
- The walk comes round the big rock from the left side, and the landing area is behind the rock. The small roofed tower on the rock is a birdwatching tower, not a hut to stay in, and can become a scene of its own later.

## Noticed on the reference pictures

| What | On which picture | State |
|---|---|---|
| A walk on legs from the shingle out over shallow water to a big boulder | 24, 25 | drawn: wood and rope instead of aluminium and steel, going on round the boulder's left side |
| The landing (a grounding area) behind the boulder | 25 and the description given with it | drawn as a long deck at the walk's end behind the boulder, its right end showing past it, with a ladder down to the water |
| A small roofed birdwatching tower on the boulder | a description, not on a picture; the thatched lookout picked from the 1991 game's treehouses | drawn as a hut built straight on the stone, the stone its floor (no legs at all, the hut built directly on top of the stone; in a future scene the floor of the hut is the stone it stands on): stout corner posts set into the rock, a log sill, an open rail of thin balusters with a gap where the stair comes up, a round shaggy thatched roof with a knob and a gull on it, a spyglass on the rail; a stair from the walk up the rock. Earlier it was a tall tower on braced legs with a red shingle roof, too high and rather featureless |
| Mooring points ("Kinnituskohad"): rings on the boulder and in the water | 25 | drawn: an iron ring low on the boulder's face. Not drawn: the ring in the water and the blue rope to it |
| Granite boulders scattered in the shallow water, the pale stones of the bottom showing through | 24, 25 | drawn |
| A pale grey shingle shore of round stones | 24 | drawn, with a line of dried seaweed and the stones showing under the shallows |
| A boat coming in, far out | 24 | drawn (small, near the horizon) |
| "Liitsiht", a red dashed line north from the jetty with two red arrows on the shore | 24 | not drawn. `KERI-TODO`: are the two arrows the leading marks (two marks on shore that a boat lines up to find the jetty), and what do they look like? |
| The lattice mast and the warden's house | 24 | not drawn: both are behind the viewer in this view (take C showed them) |
| A boat slip from the back of the warden's house down to the north shore | the orange line drawn on the orthophoto (blog picture K160), recorded in `docs/keri.md` section 10 by the photo map thread | not drawn yet: its foot on the shore, about (-107, 95), lies about 15 degrees left of north and 17 m from the viewer, just inside the picture's left edge behind the dark corner rocks. TODO(painter, R2): show its ramp running into the water at the left edge once the world model has it. The lattice mast moved to about (-137, 62), still behind the viewer |
| The jetty's real length and height | 24, 25 | drawn longer and higher than measured, so it reads as the place's one big thing (rule 4) |

## How the picture is made

Pixel art painted when the game is built, in the knoll's manner (d111; `src/game/ui/pixel/keri/docksPicture.ts`, its plan `src/core/layout/docks.ts`): small things in flat tones, what shades off through the whole run of its material, back to front. From the world model come the way the viewer looks (north-north-east, out along the jetty), where the viewer stands (on the shingle where the jetty starts) and where the water's edge is in each column (`docksShore`), so the bay between the two points of land is the real one: near on the left, opening out to the right. The jetty's way round the boulder (`JETTY`, `jettyAt`), the tower (`TOWER`), the boulders and the props are the painter's, placed in metres on the viewer's plan and seen through one bent lens (`docksProject`): what stands up fans out from the middle, the 1991 game's wide-angle look rather than a camera's (rule 3, and the rule that it must not try to look realistic). The horizon and level lines are straight: from pass 3 to pass 7 they bowed down toward the edges, and the curvature was questioned; `DOCKS.bow` is 0 since pass 8. Where the coast steps out (the spit on the right stands further out than the bay before it) the water's row is eased over a few columns (`docksShore`), so the land runs down into the sea rather than ending in a sheer edge.

What the two reference pictures of the 1991 game share, and what was taken: nothing is straight or level; planks are fat, each with a pale top and a dark gap behind it, and the walk sags between its legs; every leg leans its own way and is dark and weedy at the water; rocks are heaped round lumps lit in flat bands, with a hard shade side and a dark seam where two lumps meet; one big dark thing near the viewer leans across a corner (here a mooring post with rope wound on it); a lantern on a post is the warm light. The sea was the knoll's at first (bands of its run, wave strokes, glints). For more Monkey Island 2 quirkiness every thing has a dark line round it in the darkest tone of its own colour where it lies over what is behind it (a line one pixel thin keeps its colour), the rocks are lit in three flat bands with dark seams between their lumps, and the shingle has fewer, bigger stones. After the second art review the picture has a value plan as MI2's rooms do: dark rocks close both lower corners and the near shingle lies in a dark band of wet stones and weed, so the lit jetty and tower sit in the middle; at night a broad plane of the bay catches the moon in two flat bands and the lantern warms the tower in steps of the embers' run that keep the grain of the wood and shingles; each cloud has one head. Over it all lies the grain of scanned paint (`paint/grain.ts`, rule 12): the gauge against the MI2 atlas rose from 29, 58, 71 and 61 (day, dawn, dusk, night) to 61, 91, 98 and 78.

Pass 10 repaints the water and the wood after the Phatt dock of the 1991 game (mi2-bg-2-028), picked from a sheet of that room over the docks: both follow the Phatt dock (the sea gets a dark far band, pale swirls in the shallows and dark reflections; the jetty's wood turns warm, chunky and crooked). The recipes are `projects/painter/artists-notes/water.md` and `wood.md`. Under one pale row on the horizon the sea holds its darkest navy for about two fifths of the way to the bay's shore in short level dashes of its near tones, steps through a row of mid blue to a brighter body that steps up again toward the viewer, and is palest in two steps over the shallows; nowhere a gradient. Round each leg and boulder pale bands of the sea's two lightest tones curl outward and trail off with the drift in long S curves, further apart away from the thing, the families of neighbouring legs running together (`rings`); they slide outward by one band over the loop, so no look jumps. Under every leg lie broken near-black blobs, wider than the leg (`reflections`). The planks are broad and few (0.42 m), each its own warm brown and lighter toward its lit end, with grain strokes along it, a pale top edge and a near-black gap that no shingle shows through; ends stick out by different amounts, now and then one is missing. The legs are thick (0.19 m), lean each its own way, are near-black on their shade side and darker where wet, and their cut tops are pale; they stand above the deck by different heights. Under the deck is dark. The hut keeps its shape (as picked) and takes the warm wood's colours; its thatch is straw (the dry grass's run over the wood's two darkest tones), so the hut stands apart from the walk. After the third art review the bands are only the sea's own pale tones (no white ring closes round a post or a rock; a boulder's bands open on its upstream side), the reflections are broad near-black blobs, the posts' cut tops are cream, and at night the far band is navy and the bands a step darker. Pass 10 was accepted. Its sea, bands, reflections, planks and posts were then lifted into the painter's kit pixel for pixel, picked on that acceptance (`src/game/ui/pixel/keri/kit/water.ts`: `water/sea`, `water/rings`, `water/reflection`; `kit/wood.ts`: `wood/planks`, `wood/post` and the warm run `KIT_WOOD`); the docks keep where the water and the jetty are (`seaGround`, the planks' and legs' points through the docks' lens) and the kit paints them.

Its boulders, pebbles, lantern and the lantern's light are the painter's kit's (d124, `src/game/ui/pixel/keri/kit/`: `stones/boulder`, `stones/pebble`, `lights/lantern`, `lights/lamp`), the docks being their model; where they go (`rock()`, `cornerRocks()`, `pebbles()`, the lamp's layer) and the hut, the walk and the landing are the scene's own.

Its colours are Keri's shared palette (only the nine materials it paints with, `use`, so the night of d123 fits in 256 colours) and one run of its own: `wood` (warm red and orange browns after the Phatt dock since pass 10, its shade toward violet and its light toward straw; before it a weathered grey-brown); the hut's thatch is the dry grass's run. The hour changes the colours, not the drawing; the night adds the moon, the stars and the moon's glints, and at dusk and night the lantern is lit and glows.

The main thing is the birdwatching hut on the boulder, a little right of the middle and standing over the horizon, the sky showing through its open rail and under its roof; the lantern hangs from a bracket at its near right post and glows at dusk and night. The glow follows Woodtick's lamps in the MI2 atlas (mi2-bg-0-007, mi2-bg-0-014; light and heat are checked against Woodtick): a round halo in two steps over the sky, warm light only on what is lit already and falling off fast (seams and shade keep the night's colour), and a broken column of warm dashes on the water under the lantern where the sea shows.

Corners (d111): lower left a heap of boulders at the water's edge; right the leaning mooring post with its hanging board and the jetty's near planks; the upper corners are open sky.

What moves (the shared motion kit, `paint/motion.ts`, `windMotion.ts`): the sea's strokes, the pale bands round the legs and boulders, the reflections, its glints, the surf, the foam round the legs and boulders, the gulls and the shore's grass in a gust's loop of eight looks; the clouds drift over the bare sky, behind the lamp post and the mooring post; the lamp's light flickers at dusk and night.

Props, not known on Keri (the maintainer may take any out): the lantern on the tower, the stair up the boulder, the landing's bollard, coil of rope, small barrel and ladder, the barrel and the crate on the near planks, the mooring post near the viewer with its board and painted fish, the rope rail, the gull on the hut's knob and the spyglass on its rail. `KERI-TODO`: whether a rowing boat moored at the landing is wanted (asked).

## Improvement tips (not built; the maintainer picks)

- The leading marks of "Liitsiht", once the maintainer says what they look like.
- A rowing boat tied at the lower landing, rocking with the loop.
- Kiur or a gull standing on the bollard.
- The blue mooring rope from the landing down into the water, as on the photograph.
- IDEA(painter, Later): the tower as a scene of its own (it can become an additional scene later): the view from its platform over the bay, with birds to watch.
- The other two viewpoints (B from the shore to the east, C back to the house) as more scenes or a second look.

TODO(painter, R2): places for characters to stand on the shingle or the jetty, once a character lives at the docks (ft_1_22).

TODO(painter, R2): the north docks' open list: navy boards at night, a softer lantern halo, the landing's stub behind the rock, a fish board, and the lamp's warmth matched to the Woodtick model.
