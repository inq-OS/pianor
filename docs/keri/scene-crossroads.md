---
title: "Scene: the crossroads: notes, what was noticed, improvement tips"
---
# Scene: the crossroads: notes, what was noticed, improvement tips

These notes are what the agent saw on the reference pictures. They may be wrong, and nobody has confirmed them. The pictures stay out of the repository ([docs/keri.md](../keri.md) section 6). The crossroads photograph is the same one as input-log item 16 (file 20).

## What it is

The concrete path's Y fork west of the lighthouse. The track from the warden's house parts there: its left arm goes to the green board hut with the chimney, the sauna (`hut-middle`), and its right arm goes on to the lighthouse. The small well house (`hut-west`) stands right beside the viewer, and the knoll lies further to the right. It was named with the photograph; the warden's house stands just behind the photographer. Its place in the world model is the fork of the traced tracks, (-85, 38.5) m from the lighthouse (`scenes` in `content/world/keri.json`). AX-3 provisional: it opens at level 2, the next level after the knoll (d113: levelling up opens new scenes). Which level it opens at is not decided.

## Sources

The photograph of the fork ([keri.md](../keri.md) item 16), and the world model: the tracks (`track-to-lighthouse`, `track-to-north-house`), the houses' corners, the coast.

## Direction for the picture

- The view is the photograph's (sketch A), the warden's house just behind the viewer, in the knoll's summer green and gold. The hut on the left (north) is the sauna; next to and behind the viewer is a small well house; further to the right is the knoll.
- In the manner of Monkey Island 2, never trying to look realistic; quirkiness is good, taken from the 1991 game's own outdoor rooms (below: how the picture is made).
- The lighthouse is fat (indomitable) and painted grand, as in every scene, after the photograph of the real tower seen from slightly left of the crossroads. The sauna stands far enough back not to compete with it, and is painted in a better light than the flimsy real one.
- The ground between the crossroads and the lighthouse is a thicket of wild dog roses (kibuvits) at least 3 m high, thickest right of the track and higher from the sauna to the lighthouse, with a few paths going through and branches arching over. All the area to the left (north) next to the sauna is like another grassy knoll; the knoll on the right is low and long.

## What the 1991 game's outdoor rooms show (studied for pass 3)

Studied in the backgrounds of Monkey Island 2 (the 1991 original, rooms without characters; studied locally, never in git). Closest to this place are Booty Island's day rooms: the small hut on the shore, the street by the costume shop, the field of the spitting contest. The night rooms are the graveyard hill, the swamp and the shore under the big tree.

- Dark foliage frames the stage: big near leaf masses at the lower corners and over an upper corner, nearly black-green, lit only along their tops.
- A hut is taller than it is wide, under a steep, heavy roof that reaches far out. It leans, and its walls bulge.
- Grass is mostly flat planes and long curved ribbons of light and dark that follow the land. Tufts stand only along crests, edges and near the viewer. It is never a blade on every pixel.
- Shadows go violet and lights go warm. A path's shade is lavender.
- There is hardly any dither (0 to 2% of a picture, measured).
- Far land is rounded lumps with light tops and dark undersides.

## Noticed on the reference photograph

State: `drawn`, `not drawn`, or `unsure`.

| What | State |
|---|---|
| A cracked concrete slab path that forks in a Y, the stem coming from the viewer's left of centre | drawn: three strips of slabs a metre wide, joints, one crack across most slabs, broken edges with grass leaning in |
| Tall wind-blown grass, rust red and gold (the photograph is strongly coloured; the real grass may be paler) | drawn in the knoll's summer green with dry gold in patches (pick A) |
| The sauna: a green board hut with a brick chimney, a window in the gable toward the viewer, a door and a white sign on its long side, a small porch at its far end | drawn from `hut-middle`'s corners, 1.5 times its size so it reads, leaning and its ridge sagging, the chimney tall and crooked. `KERI-TODO`: what the sign shows (painted as a pale board with no text); whether the roof is brown or grey tin (the world model says tin; the photograph looks brown) |
| The lighthouse: a pale stone cone with dark hoops, a dark iron top with a gallery and lantern | drawn stout (fatter, indomitable) and, after the reference photograph of the tower: a fat limestone drum with a rim and railing, the slim tall iron column in the rust-red iron run, a railed gallery, a railed lantern (lit at night), a round dome; it leans a little |
| Bushes left and right of the lighthouse's foot | drawn as small round bushes along the far edge, now mostly inside the roses |
| Bushes between the houses (quite a few) | drawn: sixteen bushes over the middle ground, off the paths and the houses. AX-3 provisional: where each stands is the painter's, as the world model has no bushes |
| The knoll, further right | drawn from the world model's `knoll` scene: since pass 6 a low, long grassy rise past the lighthouse's arm, its top to the right where it runs out of the picture, gold along its crest, two bushes on it, its foot hidden in the roses |
| The dog roses (kibuvits) between the viewer and the lighthouse | a thicket of round heaps, most below the eye, some higher, from about 8 m ahead to the lighthouse's foot, cut by the paths, the houses and a glade here and there; pink flowers in drifts and a red hip now and then; long canes arching out over the paths. AX-3 provisional: the two trodden footpaths through it (`LANES`, one toward the knoll, one from the lighthouse's arm to the left) are the painter's; where the real ones run is `KERI-TODO` |
| The well house right beside the viewer | drawn as a wing at the right edge: the corner of its green board wall and the eave of its tin roof. `KERI-TODO`: in the world model `hut-west` stands 4 m before the fork, which in this view would put it before the lighthouse, where the photograph shows nothing; the model's well house or fork may want moving a few metres |
| A low building right of the lighthouse | drawn from the world model: the red shed (yellow walls, red roof), to scale |
| A thin mast or pole right of the lighthouse | not drawn: `KERI-TODO` what it is |
| A tall white flagpole with Keri's flag (the reference photographs) | not drawn: it stands near the warden's house, right of the path from the sauna (the reference photograph from the sauna toward the house), behind this view |
| The sea in a thin strip on the far left | drawn: the sea shows over the low island where the coast is near (from the world model's coast), and the land rises to hide it toward the south-east end (docs/keri.md: the south-east end is higher) |
| A dramatic sky of streaming white cloud | drawn as Keri's curled clouds (d111): a big heap high on the right, long streaks; they drift in the game (`paint/motion.ts`) |

## How the picture is made

Pixel art painted when the game is built, as the knoll is (d111; `src/game/ui/pixel/keri/crossroadsPicture.ts`, plan in `src/core/layout/crossroads.ts`). The viewer stands on the island 7 m back from the fork along the track and 1.4 m to its right, as the photograph was taken. The eye is 1.5 m high and looks east (bearing 98), between the hut and the lighthouse, through a wide lens of about 107 degrees, as wide as the photograph's. Everything placed comes from the world model through this view: the fork, the paths' lines, the hut's and the far houses' corners, the lighthouse, and the far shore's water line in every column. The hut is drawn 1.5 times its size so it reads. The lighthouse is drawn 112 fine pixels tall, smaller than true, as the photograph's wide lens shows it.

**The 1991 game's manner, pushed further (second pass, for more Monkey Island 2 quirkiness).** Nothing is ruler-straight or true to a camera: the land bows down toward the picture's sides as if the island were a ball (`BOW`, 14 fine pixels; the horizon is an arch and the sky goes down to meet it). The big shapes (the lighthouse, the sauna, the near bushes, the well house) have a dark line of their own colour round them (`outlined`). Light lies on a round thing in three to five bands with wobbly borders, never shading off smoothly. The sauna leans, the lighthouse is squat and fat. The near grass is laid as broad brush-stroke tufts, dark at the foot and light at the tips, with the field's light and dark masses showing between them. In the middle distance the field is flat ribbons that sweep along its swells, with only a sparse blade. Pass 3 also:
- draws the sauna 1.35 times further off than it stands (`SAUNA_BACK`), so the lighthouse leads;
- makes the sauna taller under a steep roof with a deep overhang;
- adds dark leaf masses at the lower corners, which sway with the gust;
- takes the dither out of the field, the lighthouse and the knoll.

Pass 4 (pass 3 was an improvement; go on):
- **Colour turns along each run**, as in the 1991 game: the grass, its gold, the path and the bushes are painted from runs that go violet in their shade (the limestone's dark tones) and warm in their light (cream and pale gold). They are built from the palette's own runs, so no colour is added (`LUSH`, `GOLD`, `PAVE`, `LEAF`).
- **The slabs are lavender** on the side away from the sun and cream on the sunny side, with violet joints and cracks.
- **The field's marks are two pixels square**, as big as the 1991 game's marks are at its half width.
- **The corner foliage has big pointed leaves** with a lit upper edge.
- **Small props.** All are AX-3 provisional, the painter's, and none is a known thing on Keri:
  - meadow flowers (white, yellow, the dog rose's pink) on some tufts;
  - four grey boulders in the grass by the path;
  - a wooden bucket hanging on the well house's corner.

Pass 5 follows the first art review (the art-review skill, verdict: needs a pass):
- The sky has short level dashes between its bands instead of checkerboards. The moon's halo is a solid ring with dashes.
- Single grain pixels, one step up or down the run, lie in the sky and the field, like scanned paint.
- The field is level dashes, staggered row by row. Tufts stand mostly along the path's edges, and flowers are fewer.
- A value plan: the near field and the left side are darker, so the lit middle distance leads.
- The bushes are no two alike (two to five lumps; leaning, flat-topped or ragged). Bushes and boulders lose their outline: only big shapes keep one.
- The lighthouse's hoops bow round it, the stone under each is in its shade, and its light and shade meet in a curve. Its left side first bulged and dented, which looked lopsided, so both sides are smooth again.
- Pass 7, after the nine photographs: the lighthouse is drawn 1.18 times larger, its foot sunk 10 pixels behind the roses before it (`TOWER`), the drum taller and fat, the iron column flared at its foot, a bell and a plate hung on it, brackets under the gallery, the rod running off the picture's top; the iron is a brighter rust red. Right of the lighthouse's track the roses stand up to about 3.5 m, a row of big bushes; left of the sauna's arm they thin to a meadow with drifts of white and rust-red flowers. The sauna has level mint-green clapboards in a kinder light, red-brown corner boards and porch posts, an orange-lichened roof, and leans less.
- Pass 8: north of the sauna a grassy rise along the line drawn for it (`RISE`, `northRise`): from the left edge it swells up behind the sauna's shoulder and comes down past it, over the near shore, so no sea shows there; gold along its crest, tall tufts on its skyline, no roses on it. Between the sauna's arm and the lighthouse's the roses stand high too, but in front of the drum never higher than the eye plus a little, so only its foot is hidden. AX-3 provisional: the rise's height is the painter's, from the drawn line.
- The dog roses are drawn as a height field on the ground (`roseAt`, `heaps`): a round heap in each cell of a 4.8 m grid, painted far to near with the grass, each heap lit as a ball (top and sun side), its leaves in round clusters fixed on the picture, and a heap's shade lying on the heaps just behind it, so the masses read apart.
- The lighthouse after the reference photograph of it: a fat, nearly upright limestone drum, a little wider at its foot, about half the tower's height; a pale rim and a thin railing round its flat top; a slim, tall rust-red iron column out of the middle with a small window; a railed gallery near its top; a short neck; a railed lantern with a round dome, a ball and a rod. Two dark hoops low on the drum, a small window high on the sun's side, the door at its foot. It leans and bellies only a little.
- The stem of the path wanders, and the slabs are of uneven lengths.
- The land hides the sea between the sauna and the lighthouse, as the photograph shows.
- At dusk the sky ahead stays cool and violet, because the sun sets behind the viewer.
- At night the sauna's window glows warm.

Pass 9 makes the island look painted by one hand. It follows the consistency review of the docks, the knoll and the crossroads (consistency review 1). The picks: stones as the docks paint them; grass, bushes and foliage as the knoll paints them; light and heat as the docks do, checked against the atlas (Woodtick).
- **The grass is the knoll's.** The ribbons and level dashes are gone, and so are the violet stripes at the foot of `LUSH`. The field's body is the knoll's green and dry gold (`TURF`, `TURF_DRY`) with a scattered grain. The swells are the knoll's (`swellEdges`, `relief`): mounds one before another, each a light top over the shade of the one behind, along a curve. Violet lies only deep in a swell's shade. Over the body, short blades of one to a few pixels stand on most pixels (`mark`), each a few places up or down the run from its ground. The longer blades and tufts stay.
- **The dog roses are the knoll's plant.** Their leaves use the knoll's thicket's dark greens in a broken grain of light and dark leaf, finer far off, in place of the rows of round clusters. The big heaps and their lumpy tops stay. A heap shades the one behind only where it rises over it, so its near slope has no dark line per row. Since the knoll's thicket is in the painter's kit (d124), the thicket paints through the kit's rose (`bushes/rose`): its leaves' run (`roseRun`), their grain (`roseTone`, a little stronger than this picture had, about 1,400 pixels of leaf moved) and its flowers and hips near (`roseFlower`). Its placement stays this picture's own, a height field of heaps cut by paths, and far off a flower is still one pixel. The kit's rose has a `tall` variant for a 3 m thicket near the viewer, that stands its full height over half its width before it falls.
- **The stones are the docks'.** The rock left of the path is a heap of round lumps: grey plates lit in four flat bands, a hard shade side, dark cracks where lumps meet, a pixel of lichen, and a line round it in the stone's darkest tone. The small rock has no line (rule 25). The path's slabs have a light grain. Since the painter's kit (d124) both rocks are the kit's `stones/boulder` (`middle` and `small`, sized to the rock), placed through the picture's own brush so the bow and the outline apply. The crossroads' own stone painter is gone. About 200 pixels on the two rocks moved when they did, and that is meant: the extra grain on the stone was this picture's own pass, not the stone's recipe.
- **The lamps light round them at night, as the docks' lantern does after Woodtick** (`lamp`, `glow`; atlas `mi2-bg-0-007`, `mi2-bg-0-014`). Over the bare sky round the lighthouse's lantern there is a round halo in two flat steps, `ember[3]` then `ember[2]`. On a thing, a pixel warms only if its tone sits at 0.3 or more of its own run, and the warmth falls off fast, so seams and shade keep the night's colour. The sauna's window warms the boards round it. Nothing above a lamp is lit, so the lantern's dome stays dark. Unlike the docks' lamp, these do not flicker: a lamp behind glass burns steady. Since the kit's lights are on main, this light is the kit's `lights/lamp` (with no lantern of its own and no water), laid on the finished picture through a brush that hands it nothing above the panes but the sky; about 60 pixels moved at night. The kit's lamps burn at dusk too. Here they burn at night only, because at dusk the low sun lights the sauna's gable and the lamp's warmth on those boards reads as a blot round the window (AX-3 provisional, the painter's; the maintainer may want it otherwise).
- Left as they are, as picked: the bow (`BOW`), the moon behind the cloud, and the dusk's value.

The paths as picked (`projects/painter/artists-notes/paths.md`): cobbled slabs plus earth trails: slab paths follow the Phatt cottage's cobbles (atlas `mi2-bg-2-038`) and footpaths follow the Booty hut's sand (`mi2-bg-1-051`). Keri keeps its concrete, painted worn.
- **Slabs** (`paintPaths`, the kit's `paths/slabs` and its run `concrete`). Each slab is its own stone: a little narrower than the path on either side, by a different amount for each, with rounded corners. Each slab sits a tone off its neighbours and is mottled in flat blotches a few pixels across. It is lighter in its middle and toward its far edge, darker along its near edge and sides, and lighter on its sunny side. A sunk one is darker all over. The run is cool and pale: the stone's greys up to the smoke's cool pale. The gaps between slabs are one or two pixels of dark grey, with moss in a few of them, and some slabs carry a crack. The path is the lightest plane of the ground, and at night it is the pale band the moon catches.
- **The earth trail** (`paintLanes`, the kit's `paths/trail` and its run `sand`). Warm blotches of sand and earth: cream where feet go, darker and redder toward the edges, with rust and ochre patches. Darker crumbs and lighter grains lie here and there, and small grey stones run along its right edge. It breaks into the grass in patches at its far end and along its edges. Where the trails run is still the painter's (`LANES`, AX-3 provisional, `KERI-TODO` above).
- Both are in the painter's kit (d124) as fills, `paths/slabs` and `paths/trail` (`kit/paths.ts`), `candidate` until the maintainer has seen them beside the two rooms. The picture keeps where its paths run: it hands the kit the slab paths' cross-sections far to near (with the stem's wander), and for each pixel near a footpath the lane nearest it, how far off its middle and how far it runs on. The kit keeps how they look. Two things moved in the lift. The trail's pale sand was this picture's limestone (`lime`), which no other scene has, so the kit paints it from the shared smoke and shingle: cream more than tan, as the Booty hut's sand measures (its commonest tones are about `#d7c7af` and `#d7cfbf`). And a slab's sunny side follows the kit brush's light side, so at day and dusk some slabs on the lit side sit one tone darker than before (about 400 pixels).

Gauge after pass 5 (calibrated, loose): day 55%, dawn 86%, dusk 95%, night 55%. Before: 42, 69, 79, 41. The night's light range (26 against MI2's 60 to 77) waits on the palette rework.

Back to front: the bare sky (the clouds are their own pictures and drift over it), the sea over the low island with its glints and surf, the ground's body (shingle at the far shore, pale level streaks far off, then the field with its swells), the paths' slabs, then row by row from far to near the grass blades. The houses, the lighthouse and the far bushes are put in when the rows reach their feet, so the grass before them hides their feet. The knoll and the dog roses' canes are put in the same way, and each row of the rose thicket is painted as the grass reaches it, so a nearer heap stands over a farther one and over a house's foot. The footpaths through the roses are laid with the ground, before the slabs. Last come the tall dark tufts nearest the viewer at the lower corners, the well house's corner at the right edge, and the dark foliage over the lower corners. A house is painted face by face from its corners: each wall, gable and roof plane the viewer sees, filled point by point, in flat tones by how it is turned to the hour's sun. Its lines bend a little.

Its colours are Keri's shared palette and four short runs of its own: `lime` (the lighthouse's limestone, violet in its shade and cream in the sun), `boards` (the sauna and the well house), `roof` and `iron` (the lighthouse's top and the red shed's roof). A picture holds 256 colours and the hours lengthen the runs at night (d123), so the scene names the shared materials it paints with (no `ash`, no `stem`) and its own runs stay short: 251 places at night.

What moves: a gust running through the grass and the corner tufts, the sea's strokes and its glints, the gulls, all in eight looks of the shared motion kit (`paint/motion.ts`). The clouds drift behind the lighthouse and the hut's roof.

## Improvement tips (not built; the maintainer picks)

- The lighthouse's beam sweeping over the sky at night (the map has one).
- On the map the lighthouse is red and white. On the photograph and here it is a pale stone cone with a dark iron top. One of the two may want to match the other.
- A thread of smoke from the knoll's bonfire place on the evenings the fire burns (the shared kit's `smokeFrames`).
- The well house's bucket or pump, once the maintainer says what is on it.
