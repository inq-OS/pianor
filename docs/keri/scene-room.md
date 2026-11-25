---
title: "Scene: the warden's living room: notes, what was noticed, improvement tips"
---
# Scene: the warden's living room: notes, what was noticed, improvement tips

These notes are what the agent saw on the reference pictures. They may be wrong, and nobody has confirmed them. The pictures stay out of the repository ([docs/keri.md](../keri.md) section 6); they are named by their file number; input-log items 14 to 17 (section 4 there) are files 18 to 21.

## What it is

The player room is the south-east room of the warden's house, painted as one picture seen looking south ([ft_1_18.AC3](../features/ft_1_18-keri-island.md), [d111](../decisions/art.md#d111)). It is the home screen, not a scene ([ft_1_19](../features/ft_1_19-scenes-on-keri.md)), but it is kept here so every place has its notes.

## Sources

Input log items 1 and 2b (the marked satellite images), 2 (the front of the house), 8 (the living room photograph), 12 (four more room photographs) and 13 (the style screenshots, the Monkey Island rows). The room's view is described in `docs/keri.md` section 5.

## Noticed on the reference pictures

Only what those rows say. `drawn` only where d111 or ft_1_18.AC3 says it is in the picture, `unsure` otherwise.

| What | On which picture | State |
|---|---|---|
| Bed with a blue-white cover and a blue-white patterned rug, wooden floor | 8, 12 | drawn (ft_1_18.AC3) |
| Six framed lighthouse photographs on white plaster walls | 8, 12 | drawn (ft_1_18.AC3) |
| A south window with flowered curtains and a desk with a blue lamp | 8 | drawn (ft_1_18.AC3) |
| A window on the left that looks at the lighthouse, a second south window on the right | 8 | drawn (ft_1_18.AC3) |
| An iron stove with a glass door before a red brick wall | 12 | drawn as a pot-bellied stove with a barred door (a departure, `docs/keri.md` section 9) |
| Chairs with green seats at the window, an armchair, a bunk bed | 12 | unsure |
| The framing props (beams, chest, and bottom right firewood, stacks of the warden's music) are added as framing, not things known to be in the room | 13 | drawn (d111); the firewood was split pieces of every thickness from (d111) and gave way to the stacks of music (pass 4 below, d128) |

## The objects' two looks (ft_1_20.AC15)

Each object a press opens is painted at rest and awake; it is awake while the pointer is on it. The door leads to a hallway that goes straight ahead, with a wall and perhaps a coat hanger in it; the note trainer stands next to the piano, not in the middle of the room.

| Object | At rest | Awake |
|---|---|---|
| The piano | the lid down over the keys, a brass lock plate, the blue book of pieces shut on the music desk | the keys, the book open |
| The door | shut, on two iron strap hinges at the stove's side | the leaf swung into the room; through the doorway the hallway runs straight on: floor boards, blue-grey boarding under plaster, pegs with a cap, a yellow oilskin and a scarf |
| The note board (the stand, beside the piano) | an empty stave with the smear of a wiped note | three gold notes on the stave, each a step higher |
| Kiur on the bed (a button only once a character is met, ft_1_21.AC14) | asleep, his bill in his back feathers, a "z" or two | head up and turned to the student, eyes open, a gold note over him where the letters were: a sprite of his own (`KIUR_AWAKE`, `roomLife.ts`), laid at his place as the sleeping frames are, not cut from a second painting |

The gramophone under the lighthouse window was the fourth object until pass 8, when it went: its chest stays with a spyglass and a rolled chart on it, and is no button.

How it is made (`roomSet.ts`, `roomPicture.ts`): the set is built again with the objects awake (`ALL_AWAKE`) and painted once more, and each object keeps of that painting the pixels inside its own outline, at rest and awake together and `AWAKE_REACH` pixels round it, that differ from the room at rest. Cut wider, a second look would carry the soft light's small shifts all over the room (10,000 to 28,000 pixels). The door must hinge at the stove's side: hinged at the other, the leaf hides the doorway from the viewer at every angle. By night a thing that must be seen beside a lamp (the notes) shines a little by itself. A second look costs one more painting of the room an hour (about 2 s when the game is built) and about a quarter more of the packed picture. The left sea window had a second look in the sketches (its casement open, the curtain blown); it is not built, as the window is no button since the walk went (d117).

The frame of the picture: the top corners are calm under the door, the backpack and the gear: over each foreground brace the roof's near boards are one plain dark field (`foreground` in `roomSet.ts`). The near things (the sea chest, its basket and books, the bed's foot) take a low light from behind the viewer, the moon's cool one by night (`NEAR_FILL`, `NEAR_MOON`), and the chest's front is broad level boards with a lock plate, so the lower left is drawn and never one dark slab.

## TODO

- TODO(painter, R2): by night the leaf of the open door is dim: give it a little light of its own, as the board's notes have. Seen on the night picture. (The piano has its two candles now.)
- TODO(painter, R2): the objects' second looks on the screenshot baseline of the room: the rest picture changed (lid down, board beside the piano, strap hinges, the horn turned), so its baseline is made again.
- TODO(painter, R2): the repaint changes every screenshot baseline that shows the room: they are made again in its pull request.
- TODO(painter, R2): a second look changes scattered single pixels along its object's edges (the pools' ragged borders move by a pixel when the set is built again awake). Harmless to the eye; cut them from the overlays to save packed size.
- TODO(painter, R2): the lighthouse in the window is the room's own small copy of the crossroads' tower (`roomView.ts`): lift both into the kit when a third scene paints it (d124).
- TODO(painter, Later): more heaps (row 7 below): a shelf of jugs by the stove.

## Improvement tips (not built; the maintainer picks)

None new today. The room's open questions stay in [ft_1_18](../features/ft_1_18-keri-island.md).

- TODO(painter, Later): the sea, the sky and the clouds outside the room's windows in the shared motion (`paint/motion.ts`, `windMotion.ts`), as on the knoll: drifting clouds, twinkling glints, in step with the one wind.

## Checked against the refined rules

The room was checked again against the refined art direction ([art-direction.md](../art-direction.md) rules 19 to 25, d111).

| Rule | Found | Done |
|---|---|---|
| 19 long runs | the room's runs have steps of 9 to 17 L*; walls, the door and the stove's glass show checkerboard dither | made long, then taken back: the room was again too 3D and not in the Monkey Island 2 style. A lit set keeps short runs (d111) |
| 20, 21 hue turns, pale highlights | kept by every run | nothing |
| 22 stage set | kept: piano and portrait in the middle band, stove and bed to the sides | nothing |
| 23, 24 ground and landforms | not a room's matter | nothing |
| 25 found or worn | the firewood was identical cylinders on a grid; then a piece hung off the pile (a log looked as if it were floating); the basket of charts was a checkered cone with tubes through its side (the old bag of maps looked wrong) | round pieces, halves and quarters, no two alike, stacked level on level; a woven basket whose rolls stand in it., the log pile still looked awkward and references were to be found in the atlas: sixty thin pieces seen from the side read as a row of pipes; then about twenty fat ones read from their pale cut ends; then the pile gave way to stacks of music (pass 4) |
| no laid-on shadow | kept | nothing |

Not changed, for the maintainer to judge: the books on the chest are plain slabs.

## The repaint toward the 1991 rooms (d128)

The room is painted **bent** (not straight, not bent hard), after the atlas: the stove in the manner of Monkey Island 2's, as its examples show, and the other things gone over the same way.

What answers consistency review 2 (the room's):

| Found | Done |
|---|---|
| a teal night in the windows, unlike every outdoor night | the windows show the island painted flat from the shared palette (`roomView.ts`): navy, stars, a moon, the same sea and sky as the scenes |
| a thin unlit lighthouse | the crossroads' fat tower in small, as tall as its window, its lantern lit at night with a halo |
| near-black lines round everything | the line is the thing's own colour gone dark and violet; faint round a thing smaller than 300 pixels; a pale stroke on edges that look up |
| ruler-straight furniture and frames | the view fans and arches (`BEND`), each thing leans its own way (`Lean`), windows and door lean, beams sag, bricks are laid by hand |
| smooth computed light | the light is laid in flat pools with ragged borders |
| dawn and dusk alike away from the windows | the dawn is lilac and cool with the lamps low; only the dusk is orange |

The things, each studied in the atlas (`find --tags furniture,indoor`, `kitchen`) and drawn in its manner, never copied:

| Thing | Studied | Drawn |
|---|---|---|
| The stove | the inn's squat stove and the map maker's pot-belly in Woodtick, the plastered oven of the mansion's kitchen | a round belly in grey-blue iron on four bowed legs with paws, two riveted hoops, an oval door with a pale ring and the fire between bars in flat yellow, orange and red tongues, a cooking plate with the copper kettle, a pipe that kinks twice with a collar at each joint |
| The piano | the bar's upright in Woodtick | a thick top board that overhangs, fat turned legs under the key shelf, red-brown walnut whose panels read, two brass sconces with candles that burn when the lamps do and light its front |
| The chair and the desk | the map maker's spindle-backs | thin spindles under a bowed rail on splayed legs; a thick desk top on tapered legs |
| The bed | the inn room's bed | an arched headboard between two posts with a ball on each, two such posts at the foot |
| The tea table and the stool | the cottage's stools and thick tables | a thick top on a fat turned post with three feet; a plump cushion |

Not touched in pass 1: the gramophone, the easel, the door, the rug, the curtains and the framed photographs (the real room's; the windows, curtains and door were redrawn in pass 6). By day a soft light comes back from the room's near end (`FILL` in `roomSet.ts`), so the piano between its two bright windows is not a dark shape.

On pass 1 the pictures went grainy. The grain of scanned paint that had been laid over the room's runs (strength 0.08, as on the outdoor scenes) was taken out: on tones 9 to 17 L* apart it is flecks of another colour (art-direction section 8).

The atlas gauge (`refcat.py gauge --tags indoor,<hour>`): before the repaint day 64%, night 49%; after it day 85%, dawn 85%, dusk 79%, night 87% (with the grain 91, 86, 81 and 86: the grain is not worth its points).

Art review 1 of the repaint (a fresh reviewer, advisory): needs a pass. Answered in that pass: the rug lowered and cooled (`RUG_TONE`; it was the loudest thing on the screen and no button), the piano's boards run level (it read as speckle), the keys awake are a broad band tipped toward the viewer (they were a line two pixels high), the piano, the easel, the desk and the windows lean more (the middle third stood plumb), the dawn's tint is weaker (the note board had turned navy), and at night the fire is stronger and the door's lantern weaker. Left for the maintainer to judge: the desk lamp's cream shade on a blue foot (the review took the blue lamp for a blue shade), the level dashes on the plaster, the firewood's lower row of round ends, the cup's dark contour (it is a sprite of the game's own).

Pass 3 made the room calmer: less saturated, less going on, the piano's right leg clear of the wall, the log pile after the atlas:

| The problem | What was found | What was done |
|---|---|---|
| very saturated | bright, strongly coloured pixels (CIELAB chroma over 55 at L* over 45): 18% by day, 37% at dusk, 10% at night; the atlas's indoor day rooms 1 to 3%. Mean chroma 34 against their 24. The gauge's `saturation` trait had read "in range" | `GRADE.strong` 1.42 to 0.95 and the shade less blue; a lit surface past `GRADE.knee` held back, flames and lamp shades left pure (`HOT`); the fire, the lamps and the window light less orange (`HOURS`, the lamps in `roomSet.ts`); the door brown. Now 4% by day, 5% at dawn, 7% at dusk, 2% at night |
| so much going on | a fine pattern on every surface: the rug's lattice, stripes and checks on the bed, flowers, streaked plaster, bricks of every tone, pools with frayed borders | the rug a few big diamonds in faded blues, the bed's stripes and checks broader and duller, fewer and duller flowers, plaster in broad patches only, the bricks nearer one tone |
| the piano's right leg fading into the wall | the painter's reading: the piano's shadow on the wall beside the leg frayed into rows of dashes in the leg's own brown. One shadow ray a pixel leaves the soft light speckled in the dither's pattern, and cut into steps every border of a pool frays | the pools are cut from light evened once more (`calm`, `POOL.even`), the borders' rag is broader and weaker: every shadow in the room is a clean shape |
| the log pile still awkward | the atlas has one log pile (under the oven of the mansion's kitchen, mi2-bg-1-057) and crooked stacks of crates and boards (mi2-bg-2-034, 3-077, 4-090): few fat pieces, read from their ends, dark gaps between | about twenty fat pieces in six levels, their pale ends to the viewer with a ring and a crack, none flush, the pile lower toward the door |

Art review 2 of the repaint (on pass 3, advisory): needs a pass; the calm and the leg confirmed (it measured the same shares). Answered in that pass: the firewood's cut ends are warm tan and keep their colour in the dark foreground (`END_GLOW`; they read as grey drums), a pool's border on a wall is moved far less than on a floor (`POOL.ragWall`; the lobes read as stains), less even dither (`GRIT`; checker patches on the piano), the door's lantern weaker and the door darker (at night the door was the biggest warm plane), the rug lower (the palest large shape at night). Left:

- TODO(painter, R2): find why adding the pass-7 gramophone (more shapes in group `ear`; the gramophone went in pass 8) moved pool borders all over the room by day; a guess to test first: two surfaces in one plane, whose winner depends on the order of the set's search tree (`tree` in `paint/trace.ts`). A change to one thing should change only that thing's corner of the picture.
- TODO(painter, R2): review 2's open points: the piano is still the plainest thing in the room (its turned legs hardly show under the key shelf); the left third is crowded (bed, basket, chest, tea table, chair, desk overlap; the gramophone went in pass 8); at dusk the right third (bricks, door, lit floor) is the loudest part; a few broad lobes of light are left on the back wall.

The measure is a scratch script of the pass, not yet in the gauge:

- TODO(painter, R2): give the atlas gauge (`refcat.py gauge`) a `vivid` trait (the share of pixels with CIELAB chroma over 55 at L* over 45) and a mean-chroma trait; its `saturation` read the room "in range" while the room was too saturated (review notes).

Pass 4 put stacks of music notation where the logs lay in the foreground, the pages showing notes handwritten, crossed out and rewritten, after the map maker's office of Woodtick and a library: Monkey Island draws papers fat, not as thin strips, and its books are more than plain boxes. The tops of the stacks follow an outline drawn on the picture:

| What was wanted | What was found | What was done |
|---|---|---|
| stacks of music notation, with the drawn outline | the outline has a tall block in the corner with a level top, a lower one beside it whose top is a peak that falls toward the tall one, and a low one to their left, from about 440 of the picture's 640 fine pixels | three stacks on the floor where the firewood lay (`STACKS` in `keri/roomPapers.ts`): the corner one face on, the middle one turned a corner to the viewer and slumped toward it (`musicSlump`), a low one on the left. Only what stands above about 0.6 m shows, so the picture has their tops and upper edges |
| notes handwritten, crossed out, rewritten | a page lies flat under the eye: a ruled line must be 3 cm from the next to be a row of its own in the picture | `manuscript`: two staves ruled a little unevenly, note heads with stems and beams, bar lines, on every page a bar scribbled out with one stroke up and down and its notes written again over it in red ink, now and then a stave struck through or a mug's ring. The pages keep their own pale colour in the dark foreground by day and dusk (`Hour.pages`); by night the stacks are dark shapes |
| paper looks fat, not thin strips | the map maker's office (mi2-bg-0-008): a sheet is a slab with a pale face, a tan edge and a dark line under it; sheets lie fanned so every edge is seen | a sheet is 2.2 cm thick (`SHEET`; it was 1.2); a pile's side is its sheets' edges, each a pale band over a dark line (`sheaf`); the loose sheets on a stack lie each pushed back from the one under it |
| the way books are drawn looks bland | the library of Phatt (mi2-bg-2-030): thick boards past a pale block of pages, raised bands across the spine, dull covers of many colours, crooked piles; ours were boxes of one colour 3 to 6 cm thick | `fatBook`: boards, page block, bands, a pressed frame and now and then a pale label; two fat books under the music on the chest (one with its pages to the viewer; the pile no higher than before, so the gramophone stays whole), two on the desk, one on the tea table; a book among the sheets of each stack |

Art review 3 of the repaint (on pass 4 before the answers below, advisory): needs a pass; copy guard clear; the stacks stand on the drawn outline. Answered in that pass: the paper is warm ochre with brown ink (it was cool cream with navy lines, and the corner had become the palest part of the room), the staves stand further apart (evenly spaced lines read as writing paper), the middle stack's loose sheets are fanned further (it read as one rigid box), a spine has three raised bands (five with a dark line each read as a radiator), a book's block of pages is pale with a little light of its own, the tea table's book shows its pages, the chest's sheets lie on their books (one overhung), and the piano's book of pieces is a fat one too. Left for the maintainer: by day the stacks are still the palest thing along the bottom edge, and they are no button.

Pass 5 made the books and paper read as paper, not stone, after the library of Phatt (mi2-bg-2-030) and the map maker's house. Pass 4 had taken fat paper to mean thick paper: every sheet a slab 2.2 cm thick with ruled edges, three big pale slabs in the corner, the books dark blocks. Put beside the two rooms at the same size, what makes theirs paper and ours stone was this, and pass 5 answers it:

| What makes it stone | How the 1991 rooms do it | What was done |
|---|---|---|
| Only the tops showed: the stacks stood a metre from the eye, so the picture had three huge level pages and no side | the map maker's pile is known by its side: leaf on leaf in thin lines of cream, tan and brown, with the top sheets lying askew on it | the stacks stand further into the room (about 2.5 m from the eye, 0.2 to 0.45 m high, `STACKS` in `keri/roomPapers.ts`), their tops still on the drawn outline; a pile is a plain foot and then many thin sheaves (2 to 5 cm), each turned and pushed its own way, so its sides are ragged; a sheaf's side is leaf lines in three tones with a dark gap here and there (`sheaf`) |
| Ruler-straight edges and level faces | no edge is straight: sheets waver, corners lift, a sheet hangs over the pile's edge | a sheet is 7 mm thin (`SHEET`) and bends (`Bent` in `paint/trace.ts`): it droops where it hangs out of the pile, curls up at a corner, and nowhere lies quite flat (`sheetLift`); its outline is worn and one sheet in three has a corner torn off (`worn`); a sheaf sags toward its edges (`sagging`); the middle pile has slumped: its sheaves grow shorter upward like a stair and its top sheets lie down the stair |
| Grey paper: in the dark cool foreground a page went grey-blue, and with a light of its own it went flat | paper is golden in the light and orange-brown in the shade, never grey | paper and books in the foreground are painted in the room's light, not as dark shapes (`PAPERS` in `keri/roomSet.ts`); paper's shade is warm and its line brown (`GRADE.paper`, `LINE.paper` in `roomPicture.ts`); bare paper is laid in three tones in soft shapes, as a brush lays it (`washed`); what hangs down is a tone darker and unwritten |
| Books as dark blocks | the library's books are small, warm (brown, ochre, olive, dull red), with a pale strip of pages and a rounded back, lying crooked | a book is built of its parts (`book` in `keri/roomSet.ts`): two boards that reach past the page block, the block, a rounded back with three bands; small (20 to 27 cm), in the warm cloths of `COVERS`; four lie crooked on the chest with a sheet on them, two on the desk with a sheet over its edge, one on the tea table |
| A crossed-out bar was one big zigzag, which read as an ornament | a few short dark strokes | the bar is hatched out with short slanting strokes; the notes written again over it stay red |

A fat roll with its coil lies on the tall stack, as the map maker's charts lie.

Art review 4 of the repaint (on pass 5 before the answers below, advisory): needs a pass; copy guard clear; the chest's books look like a crooked pile of real books, the stacks stand on the drawn outline, but the music still looks like blocks and no page showed a staff. Answered in that pass: the stacks' pages are written half again as large (`LARGE_HAND`: at that distance five lines 3 cm apart ran into one band), with firmer ruled lines; the slumped pile has three sheets down its stair, each turned its own way, the last curled at its upper corner (it read as one cushion); a pile's side is a tone darker than the page on it, so it stands off the sunlit floor; the roll is paper-coloured, lit along its top, with the sheet wound three times at its end (it read as a pipe); the pale sheet on the chest's lid is gone (it lit the dark corner and looked like a button); the tea table's book is thinner and shows its back; the stacks have no light of their own by night. Left: the piano's book of pieces is still the blue shut book (it is the piano's own and changes when the piano is awake); dawn's light, from review 3. The share of bright, strongly coloured pixels: 3.8% by day, 5.3% at dawn, 7.9% at dusk, 2.0% at night (pass 4: 3.5, 5.1, 7.1, 2.0).

What was studied is in the pattern book ([paper and books](../../projects/painter/vocabulary/paper-and-books.md)).

After pass 5 references were gathered to refine the windows and the door. The atlas's rooms with windows and doors (`find --tags indoor,window`, `indoor,door`) were set beside ours at the same size (the windows and door sheet). Pass 6:

| What was found | In the 1991 rooms | What was done (`windowParts`, `doorParts` in `keri/roomSet.ts`) |
|---|---|---|
| Our windows had thin pale bars, so they read as delicate | a fat dark wooden frame with one thick cross (the guest room and hall of the mansion on Booty, mi2-bg-1-056, 1-055) | the frame is dark warm wood (`WINDOW_WOOD`), 8.5 cm, with one cross of 6.5 cm; a dark casing round the opening on the room's side. The lighthouse window has no cross: nothing cuts the tower (the lighthouse is painted grand in every scene; tested) |
| Hardly a sill | a thick sill that stands out of the wall, lit on top with its shadow under it, and the niche's depth seen | a sill 7.5 cm thick that stands 16 cm into the room |
| Flat curtains with a fine ripple and a busy print | a few big folds, each a lit, a mid and a dark stripe laid flat; a swag across the top | the curtains hang in four big folds in three flat tones (`folded`), the dark one cooled toward violet, and the folds gather at the tie and fan out above and below it (`curtainEdge`); the real room's flower print kept; a valance across each window's head with its lower edge in two round swags (`swagShape`) that cover the frame's head, shallower over the lighthouse so its lantern shows |
| The door the palest, flattest big shape on the right, its frame hardly seen | a frame darker than the leaf, a head over it, a step at the threshold; the leaf warmer and darker than the wall | a dark frame 14 cm wide with a head over it (`DOOR_FRAME`), a threshold step, a brown leaf with dark joints between its boards, kept as calm as pass 5's (a warmer one pushed the day's vivid share from 3.8 to 4.8 percent); the real door's two iron strap hinges kept |

Art review 5 (on the first render) found the cross bar on the sea's horizon, curtains that read as fine ticking, swags that let the frame's head poke up between them, a broad jamb over the lighthouse and a door too vivid by day; all five answered in the same pass: the bar sits at 74 percent of the window's height, above the horizon, the folds are twice as broad, the lighthouse window keeps a slim frame of plain wood, and the vivid share is day 3.9, dawn 2.2, dusk 5.6, night 1.7 percent (pass 5: 3.8, 5.3, 7.9, 2.0). Left open: the opened door's back is dark in its own shade under the pointer.

Not taken: the inn's pointed windows with diamond panes and the arched heads of the mansions (the real windows are square).

Pass 7 gave the cup on the table and the gramophone (ear training) the Monkey Island treatment, after the atlas:

| What was found | In the 1991 rooms | What was done (`keri/roomSet.ts`) |
|---|---|---|
| The mug was a flat sprite with a black line laid over the picture after it was painted, so it did not sit in the room's light | the tankards on the tables (mi2-bg-2-039): fat, a pale rim, a flat lit band and a shaded one, a chunky handle | `mug`: painted into the set on the tea table in the room's light like everything round it, fat, pot-bellied and a little askew (`MUG_R`, `MUG_H`), a cream body with a blue lip, a blue stripe and a blue handle so its shape reads in the table's shade, a broad pale lip all round the dark tea; the sprite is gone, its steam still rises from the same spot (tested) |
| The gramophone's horn was a smooth cone shaded in one long ramp | no gramophone in the atlas; the curled horn on the wall of the antique shop on Booty (mi2-bg-1-048) is beaten from panels, lit in flat bands, its bell flaring late | `horn`: a bell that flares late on a crooked neck, beaten from eight petals with dark seams, each petal's middle a step lighter; seen from the room the mouth is a bright rim, a band with the seams as notches and a dark throat set off the middle, so it reads as a hole; the box fatter, with a dark band round its waist and a crank on its side; the arm ends in a dark sound box; awake, its two notes are larger and stand clear of the bell |

Tried as the other choice: the antique shop's curled horn as a brass ear trumpet on a little stand in place of the gramophone. Its bell reads as a bugle's, and it no longer says that it plays music. Art review 6 (on the first render) found the tea lying on the mug like a lid, the throat a stain, the awake bell a cart wheel with eight spokes, the arm a plank and the notes small and half hidden; all answered in the same pass. It also saw tones shift along pool borders across the whole room (about 25,000 of the 2x picture's pixels by day, the piano's right panel lost a warm patch). The new gramophone alone does this, the mug does not; the painting is otherwise the same from run to run, so the cause is a new thing changing something picture-wide, not yet found (TODO below).

Pass 8 took the gramophone out, since nothing replaces it as a thing in the room: all trainers and minigames other than the piano are reached through the stand, whose press shows a choice of pictures, not text (a sharply listening ear for the ear trainer, a note in cross hairs for the note trainer, and so on; ft_1_08.AC11):

| What changed | How (`keri/roomSet.ts`, `ProfileDashboardScene`) |
|---|---|
| The gramophone and its button are gone | the chest under the lighthouse window stays (`ROOM.chest`, no button) with two quiet things on it: the warden's spyglass lying along the lid, a barrel in dark leather and two brass draws with dark rings at the joints (pale brass alone washed out to the chart's colour in the sun), and a rolled sea chart tied with a red string behind it; nothing on it wakes |
| The stand opens a panel of pictures | a board over the room, the room not darkened, one framed picture per trainer from `STAND_CHOICES` (`src/game/room/standChoices.ts`), drawn 64 x 48 fine pixels in the manner of the 1997 game's inventory (`standArt.ts`): a listening ear for the ear trainer, a note in a brass sight's cross hairs for the note names; a frame lights under the pointer, the name shows only in the delayed bubble |

Art review 7 (on the first render) found the ear a bean with a hole, the sight a clock's face (a white dial in a gold ring, the stem a hand at twelve, two staff lines) and the spyglass and chart one thin stick; all answered in the same pass: the ear has a rolled rim with a dark fold, the rim's root, the bowl, the flap before the hole and a lobe; the sight has five staff lines, a flag on the note and a leather barrel running off to the lower right; the spyglass and the chart are half again as thick and lie apart. Left for later: the portrait is still a flat sprite with a black line hanging plumb, each candle's flame is one pale pixel with no halo, and the stand gives no hint at rest that it opens anything.

## The reference rooms

Seven rooms of the 1991 game, sent as various room designs from Monkey Island 2 for reference and inspiration, after the room was again too 3D and not in the Monkey Island 2 style. Studied locally (a voodoo shop and a tent, a ship's hold with a desk and stairs, a kitchen, a bar with a piano, a cartographer's loft, harbour shacks at night, a library). Study only: never copied, traced or committed.

| Noticed in all of them | Our room today |
|---|---|
| Nothing is straight or plumb: walls lean, beams bow, door frames and shelves bulge, a piano and a table stand askew; the view is wide and its long lines curve | straight walls, plumb frames, square furniture: what a 3D program draws |
| Dark masses frame the picture: curtains, posts, ropes, chair backs near the viewer, almost black with a thin edge of colour. The lit room is an island in them. They are things, never a shadow laid over | the foreground props are lit like the rest of the room |
| Light lies in pools with painted edges: one or two warm sources, and a wall goes from yellow through orange and red-brown to violet-black within a short way | even daylight; the walls are one pale tone from end to end |
| Two hues carry a room: warm light (yellow, orange) against cool shadow (blue, violet); a shadow is never grey or brown-black | shadows are mauve-brown and soft |
| Hardly a neutral patch: wood, walls and floor are all saturated | large pale grey-beige plaster walls |
| Brush strokes follow the form: a board is three to five streaks of tone along its length; an edge that faces the light has a pale stroke beside its dark line | tone borders are an even checkerboard dither |
| Things lie in heaps and crooked stacks: books, jars, bottles, charts | tidy, evenly spaced |

What it asks of our room, and how far it is built (d111, art-direction rule 26); the rows not built wait for the maintainer:

| Asked | State |
|---|---|
| 1. The foreground props as dark shapes with a lit edge | half: the basket, the chest's books and the beams are darker and cooler than the room; no lit edge yet. The pages of the stacks of music keep their own pale colour by day, so the writing is read (`Hour.pages`), and are dark shapes by night |
| 2. Light in pools: the lamp, the fire and the windows stronger and shorter, the shadows deeper and blue-violet | built at every hour: flat pools with ragged borders, shorter lamps, the piano's candles (d128) |
| 3. Tone borders as streaks along the form in place of the checkerboard | built (`streak`) |
| 4. Lines that lean and bow: the walls, the beams, the door, the piano | built: the bent view, leaning things, windows and door, sagging beams (d128; B of three strengths was picked) |
| 5. A pale stroke along edges that face the light | built on edges that look up (a table's top, a lid, a sill) |
| 6. Warmer, more saturated walls | built (the grade); the walls are warm where light falls and violet in shade |
| 7. Heaps and crooked stacks | built (pass 5): three ragged stacks of music by the door, one slumped toward the next, and small crooked books on the chest; a TODO above for more |

- TODO(painter, R2): the basket's rolls are too thin.
