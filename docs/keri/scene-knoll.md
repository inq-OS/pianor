---
title: "Scene: the grassy knoll: notes, what was noticed, improvement tips"
---
# Scene: the grassy knoll: notes, what was noticed, improvement tips

These notes are what the agent saw on the reference pictures. They may be wrong, and nobody has confirmed them. The pictures stay out of the repository ([docs/keri.md](../keri.md) section 6); they are named by their file number; input-log items 14 to 17 (section 4 there) are files 18 to 21.

## What it is

The first scene: a grassy knoll with a bonfire place (just embers and smoke left), between the warden's house and the lighthouse. It is level 1, so open from the start, and its place on the map is a ring of stones with embers and a thread of smoke. The picture is [ft_1_19.AC9](../features/ft_1_19-scenes-on-keri.md); the rules are in [d113](../decisions/game.md#d113) and the picture's manner in [d111](../decisions/art.md#d111). Its place in the world model (x -50, y -2 metres from the lighthouse) was set by eye from a marker on the photographs and is good to about 15 m.

## Sources

Input log items 14, 15 and 16 (drone and ground photographs with the knoll marked), 17 (the knoll's feel) and 3 to 6 (the drone photographs for colours).

## Direction for the picture

- 2D pixel art in the Monkey Island 2 manner, with soul, depth and quirkiness, never photorealistic or pushed towards 3D; the model for how a knoll is shown is that game's grassy knoll: a round hill under a starry sky, its body painted with long sweeps that follow its roundness, crooked things on its top, a strip of verbs below. More of the sea shows than of the land.
- No one stands in it but Puuvaim in his tree; the picture stays clean. The right side is open sea, with nothing standing at the right edge.
- The clouds are curls and swirls, never two alike, drawn after Monkey Island 3's skies (d111; the studied pictures and a note of the rules are in `style-reference-mi3/`): each cloud one stroke with a fine tail, a fattening streamer and a solid rolled head, no outline, two big fat ones behind three long thin ones, small ones low over the sea, all heads leading to the left as the wind of this view blows.
- The grass is alive, as Monkey Island 2 paints it: never a flat ground with tufts all or nothing, but every step between (see "How the picture is made").
- The knoll is not symmetric: the land carries on to the left edge level with the top and does not drop off; a hedge of dog roses (kibuvits) closes the lower left corner, taller and thicker than a bush, since the wild dog rose grows at least 3 m high; the land right-back is rocky shore.
- The fire circle is no perfect circle: trampled ground and a few crooked logs to sit on, never straight sawn ones, as round the campfire in the 1991 game's opening ("The fire place" below). Firewood is stacked at the fireplace.
- The knoll is a plateau that rises gradually from the house; its ground is rocky but soft with moss and low meadow plants, and an outdoor gym stands between the well house and the fireplace. Seen from the house, the sea's waterline meets the fireplace. The plateau cuts off abruptly with a drop to a rocky shore, where one could sit on the edge and hang one's feet over it: the grass just ends over the shingle, ragged with tufts and a few stones, the shingle beside it in a little shade, with no earth face. A broken dark turf line runs along the lip with tufts over it; shore stones lie in three hard bands, darker under the bank; patches of loose gravel and dry gold show in the turf; at night a warm pool of the embers' light lies over the trodden ground, the ring and the logs.
- The lighthouse is behind this view; any view of the knoll that shows it (the second view below, the beam at night) paints it grand.
- The worn path, the boulder and the dry stems are the painter's and open to the maintainer's review.

## Noticed on the reference pictures

State: `drawn` (it is in the scene or its map place), `not drawn`, or `unsure`.

| What | On which picture | State |
|---|---|---|
| Tall wind-blown grass, dry gold and green | 21 | drawn nearest the viewer (blades of every height, gold mixed into the green, bent by a gust through eight looks); the rest of the plateau is low meadow, as described |
| A plateau that rises gently from the house and breaks off over a rocky shore; rocky ground, moss, low meadow plants | the description and photographs | drawn (the lip across the picture with the sea over it; the cut on the right, where the grass ends over the shingle below with no bank drawn; flat stones sunk in the turf, moss cushions, small white and yellow flowers) |
| Firewood stacked at the fireplace | the description and photographs | not drawn: painted, then removed on review |
| Red slat chairs by the fireplace | photograph 3 | not drawn: the logs stand for the seats; `KERI-TODO`: ask the maintainer whether the chairs are wanted |
| Small white flowers among the grass | 21 | drawn |
| A stone at the lower left | 21 | not drawn: the art review found the boulder a sticker that pulled the eye into the corner; the tall roses close that corner now, and stones lie all over the plateau |
| Bushes left and right at the shore | 21 | drawn on the left, behind the ground that carries on; the right one was taken out, since the land right-back is rocky shore |
| Dog roses (kibuvits) | the description (at least 3 m high) | drawn (a thicket taller than the viewer up the left side, over the horizon at the edge; pink flowers and red hips). `KERI-TODO`: which rose grows on Keri and where; the thicket's place is the painter's |
| Rocky shore right-back of the knoll | the description | drawn (below the plateau's cut: slabs, shingle and boulders from the bank to the water) |
| Red-brown stalks (dock or sorrel) by the shore | 21 | not drawn: they read as fence posts (art review) |
| The shore and a choppy sea with white caps; the view from the knoll is to the sea | 21 | drawn: the sea is a wide band across the whole picture, with white caps, glints and surf on a shingle shore with boulders |
| A ship far out on the horizon | 21 | drawn (a small dark hull, left of the middle) |
| An overcast sky | 21 | not drawn: the sky is the hour's sky (ft_1_14) |
| The knoll lies between the warden's house and the lighthouse, south of the path | 18, 19, 20 | drawn (the scene's place in the world model; the map's fire place) |
| A concrete path fork by a green hut near the knoll | 20 | not drawn: it lies behind the viewer |
| The red shed and the wood shed by the lighthouse | 18, 19 | not drawn: they are left of the view now |
| The letter D in the sea south of the knoll, with a red line | 19 | unsure: meaning not known; ask the maintainer |

## How the picture is made

The grass and the bushes are painted by the painter's kit (d124; `src/game/ui/pixel/keri/kit/grass.ts` and `bushes.ts`), lifted out of this scene's painter because they are the model for every scene (grass, bushes and foliage of the knoll). The scene keeps where things go: its ground for the kit (`KnollPainter.ground`: the plateau's crest, how far down a pixel is, its light, the trodden place round the fire, the stones that cover the turf), the rows of clumps, the corner's roses and stems, the stones in the turf (`flags()`), the logs and the fire ring. The lift left the picture as it was at every hour, frame for frame, except one rose flower at the thicket's top edge: a flower now opens only among the thicket's own leaves, not where the shore's bush behind it happens to share their green.

The tree that overhangs the plateau from the left is not on Keri: it is added in the manner of the first Monkey Island 2 picture. It stood hidden too far left behind the roses: its trunk, the dry stems before it and Puuvaim's face moved 28 fine pixels right, so the twisted trunk stands out against the sea; the crown's far reach over the plateau stayed short of the fire's smoke. It is the knoll's own, not a kit type: a twisted trunk out of the roses, one long limb sagging over the plateau and a crown of flat dark tiers lit on top, with the sky between them. How it is painted: `projects/painter/artists-notes/trees.md`; the departure is listed in `docs/keri.md` section 9.

Pixel art painted when the game is built (d111; `src/game/ui/pixel/keri/knollPicture.ts`): small things in flat tones, and what shades off (the sky, the sea, the plateau's body, the stones) through the whole run of its material in bands and streaks, mixed between neighbours with a scattered grain, never an ordered dither (the art review measured our checkerboards at 5 to 9 times MI2's, whose backgrounds are scanned paint). Back to front: the sky with its clouds, each one stroke that rolls up into a head (d111), the sea with wave strokes, the rocky shore below the cut and the top of its bank, the plateau with its stones, moss, low meadow and grass, the fire ring by the lip, then the overhanging tree, the dog roses and the dry stems near the viewer. Its colours are Keri's shared palette (`keri/keriPalette.ts`, d111): named runs of grass, stone, shingle, sea and the rest, each with colours between its named tones so that no step of lightness is over 8 L* (201 colours with the game's own), and the four hours. The hour changes the colours, not the drawing; the night adds the moon, stars and the moon's glints on the water.

From the world model come only two things (`src/core/layout/knoll.ts`): the way the viewer looks, south-south-west, where the shore is nearest (about 40 m), and where the water's edge lies in each column of the picture, so the bay is the real one. No house stands that way. The knoll's shape is the given description drawn by the painter (`KNOLL_PLATEAU`): a plateau the viewer stands on, the ground rising gently to a lip that runs across the picture a little higher by the fire, never ruled, with the sea straight over it (you could sit on the lip with your feet over the edge); on the left it carries on to the edge (the red line drawn on it); past its shoulder on the right it breaks off at once, and its side runs down toward the viewer over the rocky shore. It replaced a round hill, as a child would draw it, that the reference photographs showed was not the knoll.

**The grass** (after three reference examples). What they share, looked at enlarged: no part of the ground is one flat tone; the field is broken marks of one to three pixels in many tones of one run (measured by the thread "Find math patterns in MI2 art": 16 to 35 tones in a patch, a colour running 1.3 to 1.6 pixels before it changes); the ground rises and dips in swells, each with a pale top over the dark foot of the one behind it, and every edge is ragged with blade tips; dry and earth colours are mixed into the green; single tall blades are few and stand out of the mass without a foot of their own. Ours had a smooth body of two or three tones with tufts set on it, each on a brown block. Now: under everything the body's tones with low swells in them (`SWELL`: a light top, a shaded hollow behind); over it one short blade beside the other, each a few places up or down the run from the ground it stands on, 2 pixels long by the crest and longer toward the viewer, shortest on the lawn the feet keep down round the fire; gold blades among the green everywhere and most of the blades where the grass is dry; then the tufts, of every height from just over the grass to a tall one, most of them low, with a line of shade for a foot. Measured the same way after the repaint: 16 to 20 tones in a patch, a colour running 1.3 to 1.7 pixels across. The blades stand still; the tufts bend with the wind.

**The fire place** (after the campfire example). What the example shows, looked at enlarged: the bare ground is no figure, its edge runs in and out and the grass leans in over it; the logs are found trunks, each crooked its own way, thick at one end and thin at the other, with no line round them: a pale worn streak along the top, warm wood under it, dark below, and a deep shade on the ground on the side away from the fire; an end is a dark hollow with a light rim, never a clean sawn face. Ours: the trodden ground (`clearing`) has lobes and a ragged edge, the ground is scuffed bare before the logs (the worn path the painter had added was taken out: a path is for the maintainer to tell, rule 14); the grass by the bare ground is dry and trampled; the ring's stones sit off the round and two have rolled out. Four logs (`KNOLL_LOGS`, drawn by `log`): one behind the fire by the lip, one left, one right, a short one in front, each with its own bend, taper and branch stub, clear of the places where the beings stand. `KERI-TODO`: what people really sit on by the fire on Keri (driftwood, sawn rounds, a bench).

Corners (d111): upper left, tall dry stems with seed heads before a thicket of dog roses that stands up the whole left side; the right side is open to the sky and the sea (a tall bush stood there first; it was awkward, and nothing has to stand there); below, dark grass that stands between the viewer and the picture.

What moves (the scenes are dynamic), with the motion every painted place shares (`paint/motion.ts`, `paint/smoke.ts`, `windMotion.ts`; [art-direction.md](../art-direction.md) rule 17):

- a gust that runs over the plateau to the left, the way the wind blows: eight looks of the grass, the stems, the sea and the gulls in a loop, the whole loop in 4.4 s on a calm day, 2.7 s in a breeze and 1.1 s in a storm. A calm day was still at first, which read as no movement at all: about one day in four is calm, so a calm now breathes slowly instead (AX-3 provisional, `windMotion.ts`). In the sea each row of wave strokes rocks on its own beat, the caps come and go, the glints twinkle each on its own beat and the surf breathes;
- the clouds, each its own picture over the bare sky, drifting to the left behind the stems and gulls (what stands before the sky in each look is laid over them), the nearer ones higher in the sky faster. The day picks where each starts, a row a little higher than painted, its own pace round the wind's and how many show (at least five, the big ones first; every one in a storm), since the clouds' movement, pattern and placement vary, especially once different weathers are considered. AX-3 provisional until the weather sets the cover;
- the embers (three strengths) and their light on the stones (stronger at night);
- the smoke: one thin thread, not puffs (more like a thin vine than puffs of balls), one pixel over the embers and winding wider as it rises, bent east toward its top by the wind, broken into rising pieces at its end; an 8 s loop.

The clouds' shapes were changed with it: the two top ones looked like inverses of each other and their proportions felt off (one rolled its head down and swept its tail up, the other the other way, both small heads on long tails). Of three sketches, A was picked: the left one a short heap with its bulk in the middle, the right one a long cloud that waves once with a curl breaking forward; the long one over the stems was made the same way (rises and falls once, a fuller head, a blunter tail). Every cloud still keeps rule 13's measures.

One thing the two sources disagree on: on the orthophoto the grass ends 10 to 20 m south of the knoll and bare stone lies between it and the water; on photograph 21 grass reaches almost to the shore. The picture followed the photograph at first, but the land right-back is rocky shore; now it is stone there and meadow on the left.

## Improvement tips (not built; the maintainer picks)

- Something crooked and of the place on the plateau, as the tombstones are on the reference screenshot: a driftwood log as a seat, a weathered post, a net float. Only what really lies there.
- The lighthouse beam sweeping over the sea at night.
- White caps only at wind 2 and 3 (today the sea has them at every wind; the grass, the clouds and the smoke already follow the wind).
- An overcast look, as on the reference photograph, on some days: the clouds' cover already varies by day, so the weather would only set it (and perhaps a darker cloud set).
- A second view from the knoll turned toward the lighthouse (it must be grand).
- Characters of Keri peeking from the tall grass rather than standing in the open (`KERI-TODO`: who they are).
- The room in the same manner, if one manner is chosen for all pictures (it is a lit set today).
- The fire's light (the pick in the consistency review: light and heat after the docks' lantern, checked against Woodtick): it lands only on what is lit already and falls off fast; a pixel warms by how high it sits in its own run (counted twice, so the lit faces of the ring's stones and the logs' tops glow and their shaded sides keep the night's blue), in steps of the ember run with no dither. At night it takes stone, shingle, dry grass, earth and ash; by day, dawn and dusk only earth and ash.
