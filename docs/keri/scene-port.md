---
title: "Scene: the southern harbour: notes, what was noticed, improvement tips"
---
# Scene: the southern harbour: notes, what was noticed, improvement tips

These notes are the painter's. The reference photographs of Keri and the reference screenshots stay out of the repository ([docs/keri.md](../keri.md) section 6). On the map the southern pier is a stone quay with a square head, its beacon and two small boats (`southDock` in `mapPicture.ts`), so the map and the scene agree.

## What it is

The southern port, at the slipway south of the lighthouse: the wider stone dock where most visitors land, the teacher among them. The north jetty (the docks scene) is the warden's and a few special characters'. Its place in the world model is the slipway's foot by the water, (34.5, -90) m from the lighthouse (`scenes` in `content/world/keri.json`), where the map draws its pier. AX-3 provisional: it opens at level 2, as the docks and the crossroads do.

## Direction for the picture

- The southern docks, a wider stone dock where most visitors arrive, so that various boats can be shown; not the northern docks (used by the warden and some special characters).
- It need not match the real place one to one; it is painted in the 1991 game's manner, with its flavour, and its runs follow the atlas.
- The view looks west to east, with no coast, no buildings and no features: only the pier, much larger and heavier, the water and any boats that visitors came with, landing on the far side.
- The view has two stages: the pier with no underwater scenery, and the underwater one, where a click on the water pans the view down into a rich, coral-like world for future underwater characters.

## Pass 2: the atlas review and what changed

The first art review of the port found everything ruler-straight (the waterline, the parapet, the courses, the plumb head, the boats), no dark foreground, props as perfect boxes, the reef's fans as grids and its tubes as bars, no reflection under the quay, a weak lamp and no moonlit water at night. Pass 2 answers it:

- **Bent:** the courses rise and fall (`settle`), the quay's foot is lumpy (`footAt`), the face and the head lean back (`batter`), the parapet's blocks are lumpy, the bollards lean, the crates are skewed and the barrel leans.
- **Closed below:** the quay's dark reflection under its foot, broken into level dashes, a foam line where the water laps, and a dark band of near water along the picture's foot, as the 1991 rooms close below.
- **Props off the box:** a real coil of rope; two fat old mooring piles (one at the far left, one off the head) standing to the bed.
- **The reef organic:** the fans' ribs wobble and their hoops break, the tubes bend and flare, the kelp's blades come off one side at a time.
- **Night:** the moon stands high over the open water between the boats and lights a broad plane of it, and the beacon's lantern glows over the far sea, its warm dashes on the water under it.

The beacon post at the quay's head is the quay's own gear, as the bollards and the ladder are, not a building or a feature of the view (the view holds only the pier, the water and any boats that visitors came with); it is the one light at night.

## Pass 3: arches, boats and wonders

- The underwater arches stay, with just their top part visible above the water.
- Boats in the manner of the 1991 game's houseboat and small galleon. Franchise art is never copied, so these are two boats of our own in that manner: a tubby houseboat, a crooked little house on its deck and a grey seal carved at its bow, and a stubby carved galleon with a high stern castle and no letter or shield on it (`houseboat` and `galleon` in `portBoats.ts`). The houseboat lies at the quay while `PORT_MOORED` is provisional; the galleon is the teacher's and sails in with her arrival script (ft_1_27).
- More Monkey Island quirkiness, especially underwater, where the painter is free to invent; a locked treasure chest. The coral creatures need not exist in the real world.
- For now the galleon is the teacher's boat.

What changed: the three arches are full round heads that cross the water, no two alike (`PORT_ARCHES`): their crowns and wedge stones show above it, dark under them, their shoulders and piers under it. The ladder and the tyres hang on the piers between. Under the water are the wonders no real sea has (`portWonders.ts`): the locked chest and invented corals and creatures.

## Pass 4: smooth behind, grain on the things

- The sky, ground and plants may be separate layers with separate palettes; the sky and background are smooth as in Monkey Island, while the details, buildings and so on are pixel art with grain.

What was wrong: the sky had 11 tones over its 68 rows, mixed with an ordered dither and then moved about by the grain in long strokes, so the eye saw the steps between far-apart tones as noise. The 1991 game's skies have grain too, but between many near tones (80 to 100 colours in a patch of sky of the two screenshots), and that reads as smooth.

What changed:

- **The sky is laid smooth:** a run of 23 tones (`scenePalette(..., { sky: 3 })`: no step of lightness over 3, where the shared run steps by up to 8), one tone to a row, no dither and no grain.
- **The water takes no grain:** the sea keeps the kit's own bands and dashes of light, and the water under the surface is flat bands with its shafts of light. The grain of scanned paint lies on the things only: the stone, the wood, the reef, the paint.
- **No chessboard in the water:** with the grain off, the ordered dither the kit's sea lays where a band shades into the next showed as a pattern (art review 4). The port turns it into short level dashes of the two tones (`calm` in `portPicture.ts`), and its own near water and the water under the surface are laid without dither.
- **Where the colours came from:** the picture holds 256 and was full, so the port names no grass run any more (12 places); the weed's and the kelp's greens are the bush's (`LEAF` in `portPicture.ts`, `leaf` in `portWonders.ts`).
- The boats stay as they were in pass 3 (no grain was added to them).

The landing:

- The stair does not just end: a small lower level reaches the waterline and smaller boats.
- The stair now ends on a low landing of stone a step over the water (`PORT_LANDING` in `portPicture.ts`): wet slabs before the quay's face and on round its head toward the pile, one course of long blocks for its near face with weed at the water, a stub of a bollard at its seaward corner and an iron ring in the quay's face over it for a small boat's line. Under the water it stands on two legs with a low round opening between them, in the sea's blues as the quay's foundation is.

## How the picture is made

- **One tall cut** (`src/core/layout/port.ts`): 640 fine pixels wide and 408 tall. The view on top is its first 248 rows. The view under the water is the 248 rows from row 160 down. Above the water the two views are the same paint (`portPicture.ts` copies the top view's first look), so the pan between them shows no seam.
- **On top** (`portPicture.ts`): the bare sky, smooth in a run of 23 tones (the clouds are their own pictures and drift), the sea from the kit (`water/sea`) with level dashes of light where the sun or the moon lies, then the quay. The quay is a parapet along its far edge, a strip of top slabs, a coping, and a face of big blocks laid by hand (`blockCourses`: no two courses the same height, no two blocks the same length), lit by the hour, with slime and barnacles at the water. On the quay are bollards, iron rings, tyres on ropes, a rusty ladder, a stair at the head down to the low landing, crates, a barrel, a coil of rope and the beacon post with the kit's lantern.
- **The boats** (`portBoats.ts`): each kind its own picture in two looks (it rises and settles), laid at a berth from the stern's point at the water. Their mooring lines run down behind the parapet, and the quay is laid again over them (`front`), so any boat fits any berth. The kinds are a white launch, the fisherman's tarred rowing boat, the border guard's grey patrol boat (no insignia), a sailing boat and an aluminium motorboat, and two of our own in the 1991 game's manner: a houseboat (a crooked red cottage on a tubby hull, washing on a line, a smoking stovepipe, a grey seal carved at the bow) and a stubby tarred galleon (a leaning stern castle with a carved sun, a banded mast, a furled patched sail). The galleon is the teacher's boat for now. Which boats lie there is `PORT_MOORED`, AX-3 provisional (below).
- **Under the water**: the water in five flat bands with shafts of light, a far reef's dark line and far fish. The quay's foundation is in the sea's blues on three round arches, with weed trailing from it. In front are three mounds of coral rock with fans, branching corals, tube sponges, brain corals, anemones, kelp up to the light, sea grass, a starfish, a crab, an urchin, an old anchor with bubbles, a school of silver fish, five bright fish, two jellyfish and a seahorse. Open sand is left where beings stand (`STAND_ON_BED`). Over the reef are the wonders (`portWonders.ts`), things no real sea has: the locked chest with gold light leaking from its lid, a crab walking off with its key, organ-pipe corals blowing bubbles in turn, candy-cane corals, gramophone-horn sponges, lantern corals that glow at dusk and night, an octopus in an amphora, a hermit crab in a teapot, a giant clam with a pearl, a fish that walks in boots, a shy one looking out from behind a pier, and a driftwood arrow pointing up, the way back.
- **In the game** (`sceneLife.ts`, `AdventureScene.ts`): `SceneLife.dive` gives a place a second view. A press on the near water pans the view down in 900 ms, and a press on the strip over the water up there, or Back, pans it up again. With reduced motion it switches at once.

## Open

- TODO(builder, R3): moor the boat of each visitor who is here today (the teacher's galleon, the fisherman's rowing boat, the border guard's patrol boat), from presence (ft_1_25), and nothing at a berth nobody came to (`PORT_MOORED` in `port.ts`).
- TODO(painter, R3): a berth at the low landing for the small boats (the rowing boat, the motorboat), lying in the near water before the quay; the boats' pictures are made to lie behind it today, their waterlines hidden.
- TODO(painter, R2): the smooth sky and the grain kept to the things in the other outdoor scenes (the docks' sky is grained in strokes today), once the maintainer has seen it here.
- IDEA: underwater characters on the bed's two open patches (future underwater characters).
