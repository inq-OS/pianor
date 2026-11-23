---
title: "Scene: the terrace: notes, what was noticed, improvement tips"
---
# Scene: the terrace: notes, what was noticed, improvement tips

These notes are the painter's. The reference photographs of Keri and the reference screenshots stay out of the repository ([docs/keri.md](../keri.md) section 6).

## What it is

The wooden deck right before the main door of the warden's house ([docs/keri.md](../keri.md) section 10: the terrace with red benches is right in front of the warden's house main door, J7 mid-bottom). The terrace and the garden are two places: the garden is the south-east end of the house. Its place in the world model is the deck's seaward part, (-128, 32) m from the lighthouse (`scenes` in `content/world/keri.json`), by the landmark `terrace` the map draws. AX-3 provisional: it opens at level 2, as the docks, the crossroads and the harbour do.

The house is big, so it gets more than one scene (marked on the drone photograph): the terrace, looking away from the house, slightly south-west; the right wing of the house, looking east from near the door toward the lighthouse; and the left side of the house, the facade. This is the first. The other two are their own scenes and pull requests (Open, below).

## Direction for the picture

- The front of the house, with the terrace given the Monkey Island treatment. The view looks away from the house, slightly south-west.
- The terrace has more features than the real one and reaches further out over the beach, with character of its own and nothing over the top: no boat.
- The handrails are wooden and stout; thin ones look as if one could fall down. The part that spans further above the beach may have a roofed section, such as a small watchtower two storeys up with a fixed long spyglass to scan the horizon.
- Torches burn at night. The terrace is where the village gathers: it is painted and furnished as its plaza.
- As on the map, it may look as if it reaches the waterfront, but nothing leads from the terrace down to the water: no stair, no path, no gangway.

## What is real and what is the painter's

Real, from the photographs (keri.ee's pictures and the reference photographs of Keri, study only): the deck of boards, half of it oiled red-brown and half grey; the rail of pipe on white posts; the red picnic benches with white gull shapes on their back boards; the lifebuoy on a post; the barrel grill; the shingle beach with its boulders in the shallows; the dog roses.

The painter's, for more features than the real terrace has and a reach further out over the beach, each for the maintainer to judge (a row in the departures table of [docs/keri.md](../keri.md) section 9):

- **The walk over the beach.** From the deck's seaward edge a walk of grey boards on crooked piles runs out over the shingle, a step lower than the deck, to a broader head that stands over the water (`REACH` in `src/core/layout/terrace.ts`): this is the reach over the beach. Its rail is stout wood (below). It is a deck, not a way down: nothing leads from it to the water or the shingle. (Passes 1 and 2 had the bow of an old boat here; it was too over the top.)
- **The watchtower on the head's seaward corner** (`TOWER` in the plan): four crooked posts, a boarded floor a storey up (2.4 m) with a parapet and a ladder to it, a thatched roof (reed, as roofs on the Estonian islands are) with a staff and a plain red pennant, and on the floor the long-eye, a long brass spyglass fixed on a post and pointing out along the horizon (`LONG_EYE`). A lantern hangs from an arm at its corner toward the walk. Under its floor is the roofed section, open.
- **Three torches** (`TORCHES` in the plan): crooked poles lashed at the deck's rail, their heads of three kinds. One stands by the barrel on the left and a low pair flanks the walk's mouth as a gate of fire. By day they are unlit; from dusk on each burns with a flame to the picture's scale and lays a warm pool on the boards.
- **On the deck:** a picnic table with a jug between two of the red gull benches (the real benches, set as a picnic set); the barrel grill by the seaward rail; the lifebuoy on a post of the walk's rail; a barrel and two bare crates in the near left corner.
- **One floor of oiled boards.** The real deck is half oiled red-brown and half grey. Here the terrace's own boards are all oiled, and the grey boards are the walk's.
- **The rails are wood** on the deck's seaward side, down both sides of the walk and round the head (`woodRail`): a stout post every metre or two, a broad pale handrail and two boards under it, none quite level. The photographs have a pipe rail on white posts; passes 1 to 3 had ropes and pipe, which were too thin.
- **The ground** before the house is lower than it is (1.6 m over the sea, the eye 3.6 m), so that the eye sees the whole beach. AX-3 provisional (`TERRACE_LAND` in `src/core/layout/terrace.ts`).

`KERI-TODO`: what really stands at the deck's seaward edge today.

## How the picture is made

- **The plan** (`src/core/layout/terrace.ts`, pure): the viewer stands on the deck's end by the door, the eye 3.6 m over the sea, and looks at bearing 240 (a little south of west), away from the house. The shore in each column comes from the world model's coast (`terraceShore`): the water's edge is 17 m ahead on the left and runs away to the right. The ground is the shingle's bank (`terraceRise`), the deck and the walk are measured in the deck's own frame (`onDeck`, `onReach`), and the places where beings stand are a row across the open boards at the walk's mouth, about 7 m ahead (`TERRACE_SPOTS`), where a figure of the game's size is to the picture's scale; the picnic set stands right of the row and nearer the eye, clear of it.
- **The picture** (`src/game/ui/pixel/keri/terracePicture.ts`): the bare sky, smooth in a long run of tones, one tone to a row (the clouds are their own pictures and drift; the sky and background are butter smooth); the sea from the kit (`water/sea`) with its dither taken out (`calm`), rings round the boulders, a far boat; the shingle with pebbles, wrack and dry tufts; boulders from the kit; a dog rose thicket closing the right side. Then the walk on its piles with its rails and the watchtower on its head, the deck's crooked boards running to one point, the rail, the grill, and the dark near things that close the picture below as the 1991 game's rooms do: the barrel and the crates at the left, the picnic set at the right, its near bench with its back and its gulls to the viewer. The grain of scanned paint lies on the things only, lighter on the boards.
- **By the hour:** the sun's glint lies on the water at the left by day and at the right at dusk; at night the moon stands over the right and the stars are out; the watchtower's lantern, the paper lanterns and the grill's coals glow at dusk and night, and the lantern and the coals each lay a pool of warm light on the boards under them (`pool`) and on what stands near (`warmed`), as layers that flicker with the game.
- **What lives** (`SCENE_LIVING.terrace` in `src/game/adventure/sceneLiving.ts`, `TERRACE_LIFE` in `sceneLife.ts`): the water is lit by the game (strokes, glints, rings, surf); one wind from the right drifts the clouds, flies the pennant (cut out, `sway.ts`) and bends the grill's smoke; gulls fly as a flock over the right; moths circle the lantern and sparks rise from the coals when they are lit.
- **Colours:** the picture holds exactly 256. It names no grass run (the tufts are in the dry grass's tones), and has three runs of its own: the deck's wood (the kit's), white paint (`hull`: the lifebuoy, the gulls, the jug) and the benches' red (`red`). The watchtower's thatch is in the dry grass's tones.

## Pass 1

Painted to about four fifths at the four hours, in the game with its living things, for the maintainer's first look. Known weak places, for the refining round:

- the gulls on the bench's back read as the letter M from behind;
- the compass rose is hard to read at the picture's size;
- the stern post where the bow meets the boards is a dark stump with no job;
- the right side's thicket and the far shingle behind the rail are thin.

## Pass 2: the art review, what does not hang on the boat

The first art review said "needs a pass": the invented boat is the main subject while the real red benches are one bench back in a corner; the deck is one bright orange field with no dark near band; the night is a murk (a near-black sea, a plum deck, lights that light nothing); the wood is too straight; the bench's gulls read as "M M"; the compass rose is a smear; the smoke is a string tied to a cloud. Whether the boat stays was for the maintainer (asked). Pass 2 answers what does not hang on that:

- **The deck is half oiled and half grey, as the real one is** (ke-079). The boards are oiled dark red-brown from the house out to about 5 m (`OILED`, a board or two at a time further or less far), and beyond that they are the weather's grey and run on into the boat's grey deck. So the near ground is dark from the things themselves (no shadow is laid on, art-direction rule 7), the orange field is gone, and the grey boards lead the eye to the bow.
- **The night is navy and lit:** the open sea is lifted off its darkest tones and the moon lays a path of level bars on it (`moonSea`); the grey boards are the moonlit plane; the grill's coals lay a warm pool on the boards round them, as its own layer that flickers with the game (`coals`, the kit's `lights/lamp` and a pool on the deck's plane).
- **Crooked:** the rail's posts lean and differ in height, its ropes hang slack.
- **Readable:** the bench's gulls have long shallow wings and a round body; the compass rose is four fat points, the north one red, and one bold ring; the grill's smoke is a short wisp that ends under the clouds (`TERRACE_SMOKE_RISE`; `smokeThread` takes a rise).

Left for the maintainer's word on the boat: where the bow joins the deck (the stern post, the boat's own vanishing point), the lantern that hangs in the open air and lights nothing, the fenders that read as paper lanterns, more of the red benches, the mast and yard ruler-straight.

The second art review still says "needs a pass", with the day's score up from 79 to 86 and the night's from 78 to 83 and now inside the 1991 nights' range. For the refining round:

- the oiled and the grey boards meet on too long and straight a line, so the grey reads as a runner laid on a brown floor: break the line board by board;
- the coals' pool is one flat slab with a ruled edge and warms nothing beside it (the rail's posts, the lifebuoy, the bench); the oiled boards and the bench go plum at night, not navy;
- the compass rose is now the loudest thing in the near ground and reads as something to press; the red benches should be the near subject;
- the left wing (the barrel, the crate) is too light by day, and the strip of ground between them reads as no thing;
- the boat's sheer strake is a row of like planks; the villager's blue coat sinks into the moonlit grey boards.

## Pass 3: no boat, a deck with features and character

After passes 1 and 2: a deck, but with added features and character; the boat was too over the top. The boat's bow, its mast, bowsprit, anchor, fenders and bunting and the compass rose are gone. In their place:

- **the walk on piles** out over the beach to a head over the water, with a lamp post, a pennant, a spyglass on a tripod, rods, a bench and a crate (the lamp post and the tripod gave way to the watchtower in pass 4);
- **the string of paper lanterns and flags**, lit at dusk and night;
- **the picnic set** as the near subject on the right: the real red gull benches, a table between them (the second art review asked for the red benches as the near subject);
- **one floor of oiled boards**, each strip two or three boards end to end and a board in seven worn paler, so no long seam between oiled and grey (the second review saw it as a runner laid on a brown floor);
- **light that lights its neighbours:** the lantern and the coals each lay a pool on the boards that keeps each board's own drawing and breaks up toward its rim, the dark boards dropping out first (no ruled edge), and the bench's end and the rail's posts by the grill take its warmth;
- **a fuller left wing:** a second crate behind the first closes the strip of ground between the barrel and the crate.

The beings' places moved left to the walk's mouth (`TERRACE_SPOTS`, `content/scenes/terrace.json`), clear of the picnic set.

The third art review says "needs a pass": day 87, dawn and dusk 99, night 80. Answered in the same pass:

- the warmth on the grill's neighbours was an ordered chessboard (rule 12): it is two flat steps with a ragged rim now, on a thing's lit tones only, and the pools have no dither;
- the lantern was a hard ring round a dark hole: the glow's heart is laid behind the lantern, and its pool on the head is smaller and fainter;
- the diagonal braces under the walk read as a stair down to the shingle (there is no way down): the piles are tied level;
- the pennant was red, white and red, which reads as a country's flag: it is plain red;
- a rail post's head showed over the grill and, warmed, read as a figure standing in the coals: the post is moved, and the coals have no halo on the shingle behind;
- the coil of rope was thin rings: it is a fat flat coil; the far bench on the head has no gulls (they read as a face at that size); the table's top is pale scrubbed wood, apart from the benches' red.

Known weak places at pass 3 (pass 4 took the spyglass away for the tower's long-eye; the rest stands): the oiled boards and the benches go plum at night where the 1991 nights are navy, and the far sea is near black (the night's gauge is out of range: dark 0.75, spread 52); the near deck's seams are long ruled lines with the kit's pale edge, which read as strips; the head is far off, so its spyglass and rods are a few pixels each; the villager's blue coat merges with the night sea.

## Pass 4: wooden handrails and the watchtower

After pass 3: the handrails are wooden, since thin ones look as if one could fall down; the part that spans further above the beach may have a roofed section, such as a small watchtower two storeys up with a fixed long spyglass to scan the horizon.

- **Rails:** every rope and pipe rail is a wooden one now, thick posts of oiled wood under a weathered handrail, with white posts gone (above).
- **The watchtower** stands on the head's seaward corner, at the picture's left, its roof in the sky and its floor over the horizon; the long-eye shows in the open between the parapet and the eave. The lamp post and the spyglass on a tripod are gone: the lantern and the pennant are the tower's.
- **The fourth art review**: the rails and the tower answer the ask, and it kept the chunky crooked rails, the thatch and the pennant. It found the rails standing one behind another as a lattice that hid the walk, the long-eye reading as a second tier of roof, the tower dead plumb and of the deck's one orange-brown, and the tower's lantern reading as a face at night. Answered before the maintainer's look: the tower's timber and the handrails' top boards are old wood gone silver (`SILVER4`, the walk's greys), one board under each handrail and fewer posts on the walk, the tower leans a little (`TOWER.lean`), the long-eye is a thin dark-brass tube on the tower's seaward side, clear against the sky, and the lantern has one upright bar.

Known weak places, for the refining round: the night is plum on the deck's oiled boards and the benches, and the coals' warmth lies flat; the deck's seams are ruled; the coil of rope reads as a lid; the rods on the head are sticks; the bench under the tower is dark and small.

## Pass 5: torches, the village plaza

After pass 4: torches burn at night; the terrace is the village plaza, not a random place.

- **Where:** no torch stands before a being or behind one (a flame on a being's head), so the walk's two keep off the columns of the four places, and the head has none: its light is the watchtower's lantern. The pair at the mouth and the walk's further one are low (1.1 m) so that their flames stay under the string of lanterns. No two heads are alike: a fat bundle, an iron cup on a thin neck, a long thin bundle.
- **How they burn:** each torch is a layer of its own in the lamp's three looks (`torches` in `terracePicture.ts`), blended on its own beat (`glowAt`, `sceneLife.ts`), so no two flicker alike. A look is the flame (a tongue with a pale heart, taller and leaning another way in each), a halo in the air round it, darker than the flame, its rim scattered (`halo`), a pool on the boards in flat rings about the torch's foot (`pool`, `even`) and warmth on what stands by it (`warmed`, and the kit's `lights/lamp`). The two nearest the eye throw sparks. Leaves take no torchlight: scattered warm pixels on the thicket read as the bush on fire.
- **By the hour:** lit at dusk and night, as the kit's lamps are. The pools lie only at night: at dusk the low sun lights the boards brighter than the embers' reds, and a pool read as a stain. At night the torches' light covers about 8% of the picture (the light note's aim is 5% to 10%), where the lantern and the coals alone left the night plum (art reviews 3 and 4).
- **The fifth art review**: the torches answer the ask and the deck reads as a lit gathering place; it kept the flames. Answered before the maintainer's look: the pools were a rug on the pale board and rust on the walk's grained boards (now flat rings under each torch), two torches wore the kit's ring on the sky and five none (now each its own halo), one flame merged with a paper lantern (that torch is low now), and seven alike made a fence (three kinds of head).

Known weak places: the boards far from a torch are still plum at night, not navy (the shared night of the `wood` run; art reviews 3 to 5); the watchtower's lantern still wears the kit's burst; the coals, the coil and the ruled seams as before.

## Pass 6: calm

After pass 5 the terrace was too busy and out of character (d278). The plaza keeps what d176 asked for and what the real terrace has, and the small things round them go:

- the string of paper lanterns and flags and its three poles;
- four of the seven torches: the two down the walk and the two on the deck's right side; the right side's light at night is the grill's coals;
- the rods, the crate and the bench on the head: the watchtower stands alone there;
- the coil of rope, the net float on the crate, the mugs on the table;
- half the rail posts down the walk and round the head: a post every four metres or so, so the rails no longer stand one behind another as a lattice.

The near left corner is one dark wing (the barrel and two bare crates), the picnic set the near subject on the right, the watchtower the far thing on the left; the open walk between them leads the eye out to sea.

## Open

- NEEDS-HUMAN: the look of pass 6 (calm: three torches, no small props), and the painter's other additions above.
- TODO(painter, R2): the refining round on the weak places of passes 3 to 5 that pass 6 left (the plum night on the oiled boards, the ruled seams, the coals' flat warmth), after the maintainer's look.
- TODO(painter, R2): the right wing of the house, looking east from near the door toward the lighthouse, as its own scene and pull request.
- TODO(painter, R2): the left side of the house, the facade, as its own scene and pull request.
- NEEDS-HUMAN: the night on the target laptop. Each torch is a blended layer of its own, three over the lantern's and the coals'.
- TODO(builder, R3): beings and characters on the terrace's four places (`content/scenes/terrace.json` has no hotspot and no exit yet).
