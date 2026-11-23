---
title: "Keri island: sources and facts"
---
# Keri island: sources and facts

Reference for [ft_1_18](features/ft_1_18-keri-island.md). Facts about the real island used by the game's art and story, each with its source. Anything marked `KERI-TODO` still waits for the maintainer to tell it; agents do not fill it from guesses.

## 1. Sources

- **Keri Selts MTÜ** (the society that runs the island), <https://keri.ee/>, read: "Keri saarest" (`/pages/keri-saarest`), "Keri loodus" (`/pages/keri-loodus`), "Keri tuletorn" (`/pages/keri-tuletorn`), "Kuidas saada saarevahiks?" (`/pages/kuidas-saada-saarevahiks`), weather station (`/pages/ilmajaam`). Text and photos are theirs, credited on the site. We use them as facts, never copy them.
- **Maa- ja Ruumiamet** (Estonian Land and Spatial Board) orthophoto and height layers, WMS `kaart.maaamet.ee/wms/fotokaart` (layers `EESTIFOTO`, `nDSM`, `reljeef`, projection L-EST97, EPSG:3301), fetched. Open data licence (<https://geoportaal.maaamet.ee/avaandmete-litsents>): free for any lawful use with credit, for example "Ortofoto: Maa- ja Ruumiamet 2026".
- **OpenStreetMap**, <https://www.openstreetmap.org/#map=19/59.698723/25.022740>, ODbL, credit "© OpenStreetMap contributors".
- **Estonian Wikipedia**, "Keri tuletorn", <https://et.wikipedia.org/wiki/Keri_tuletorn> (it refused the agent's requests with a rate limit, so the facts below come from keri.ee).

## 2. The island (keri.ee unless marked)

| Fact | Source |
|---|---|
| In the Gulf of Finland, a little over 3 nautical miles north of Prangli (7 km); 18 km from Leppneeme harbour, 33 km from Pirita; about 20 km north-east of the Viimsi peninsula; Porkkala in Finland is 40 km north-west | Keri saarest; Keri loodus |
| Part of Viimsi parish. The island is run by MTÜ Keri Selts; the lighthouse is kept by Transpordiamet | Keri saarest |
| Lies north-west to south-east, about 400 m long and 100 m wide (depending on the water), up to 4 m above the sea; the south-east end is higher. Under three hectares (Keri loodus says 0.3 ha, which does not fit 400 x 100 m) | Keri saarest; Keri loodus |
| About 500 m corner to corner, measured on the satellite image | satellite image |
| Lighthouse at 59.6987220 N, 25.0227421 E | satellite image |
| No real trees. Shores of big stones, granite boulders and coarse gravel, no sand; in a storm the stones move and the island "rattles" | Keri saarest; Keri loodus |
| A spit, Kagusäär, runs about a kilometre into the sea from the south-east tip; storms reshape it, sometimes it is under water | Keri loodus |
| Buildings: the lighthouse with its side building, cinema house (kinomaja), boat shed, woodshed, sauna, well house, the dwelling house (elumaja, the warden's house), a new generator house and the weather station; also the Kaleva memorial and a helicopter pad | Keri saarest |
| Climate: windy and maritime; stormy October to March, mostly from the west; thick fog in spring; best weather late July and August. On calm days a "warm-air lens" forms on the south-west shore in front of the dwelling house | Keri loodus |
| Wardens (saarevahid): volunteers live on the island in summer, alone or with companions, one week at a time in the warden's house, then hand over; they keep an eye on the island, receive guests, give tours. In winter the island is mostly empty | Kuidas saada saarevahiks? |

## 3. The lighthouse (keri.ee, "Keri tuletorn")

| Year | Fact |
|---|---|
| 1623 | Keri first on a sea chart (Blaeu's atlas): "a small bare gravel bank with a sea mark in the middle" |
| 1718 | Peter I orders stone towers on Keri and Vaindloo |
| 1719 | First light signals from Keri (fires), August |
| 1723 to 1724 | A wooden tower, built in Tallinn and put together on the island in August 1723; works as a lighthouse from August 1724 |
| 1803 | A 25 m truncated cone of limestone masonry with an eight-sided wooden pyramid on top; the light 32 m above the sea |
| 1858 | Today's shape: an iron tower made in St Petersburg replaces the rotten wooden part, for a Fresnel lens made in Paris by Henry-Lepaute (that lens was destroyed in 1941; today a smaller Soviet-era Fresnel lens with an LED light) |
| 1906 to 1912 | The light burned natural gas found on the island, until the gas well collapsed |
| 1937 | Iron hoops round the stone part against cracking |
| about 1990 | The north side of the stone part collapsed |
| 2021 | Restoration finished |

## 4. Reference pictures

Reference pictures are studied locally and never committed (section 6): photographs and marked maps of Keri in `keri/`, style references in `keri/style-reference-mi2/` and `keri/style-reference-mi3/` (each with what was studied; how to study more: [art-direction.md](art-direction.md) section 6), pictures shown for review in `keri/mvp/`, all under the gitignored `private/painter/`. What the agent noticed on them, picture by picture, is in [docs/keri/](keri/map.md). The numbers below are the ones other notes cite ("item 29").

| # | Picture | What it shows about Keri | Viewpoint | Used for |
|---|---|---|---|---|
| 1 | Satellite image with marks (Maa- ja Ruumiamet open data) | The whole island, north up, about 507 m corner to corner. The warden's house in the middle; the living room at its south-east end; its two front windows look out to sea (south); a window looks at the lighthouse (east); the northern shore, where the old campaign trail's sun was seen, walking toward the lighthouse | top view | map, room |
| 2 | Front view of the warden's house | The long front of the house, a grey tin roof, a porch in the middle, stones down to the sea; the living room at the right-hand end with its two front windows and a window round the corner | from the shore, the house's front faces south-west | room, later scenes |
| 2b | Satellite close-up of the house (Maa- ja Ruumiamet open data) | The house's long axis north-west to south-east; the living room at the south-east end; the south-western and south-eastern front windows and the eastern window round the corner, toward the lighthouse | top view | room |
| 3 to 6 | Drone photos: storm sky, the lantern at sunset with the house, evening, day with the south-east spit | Island shape, colours, lantern and dome, houses' roofs (blue, red, grey), stone shore | aerial | colours, feel |
| 7 | The lighthouse from below, evening light | Brick-coloured stone cone with hoops, dark red iron tower, gallery, bell, lantern | ground | the lighthouse sprite |
| 8 | The warden's living room | Bed with a blue-white cover, blue-white patterned rug, wooden floor, six framed lighthouse photos on the wall, a south window with flowered curtains and a desk with a blue lamp, a window on the left (toward the lighthouse), a second south window on the right | inside | room |
| 9 | Orthophoto, 0.33 m per pixel (Maa- ja Ruumiamet open data) | The island, 680 x 420 m around the lighthouse | top view | map |
| 10 | Height layers (nDSM heights of objects, relief; Maa- ja Ruumiamet open data) | Heights of buildings and ground | top view | map shading |
| 11 | Base map (põhikaart, layer pohi_vr2; Maa- ja Ruumiamet open data) | The dotted footpath round the island and the dashed tracks between the buildings and the lighthouse | top view | map paths |
| 12 | Four room photos | The iron stove with a glass door before a red brick wall; white walls with framed lighthouse photographs; the bed with the blue-white rug; chairs with green seats at the window; an armchair; a bunk bed | inside | room |
| 13 | Seven screenshots of Monkey Island 2: three rooms, four island maps | The manner for the room and the map: organic lines, warm local light, a painted tilted island with surf, clouds, a name scroll and a compass rose; never copied, never committed | style reference only | room (d111), map |
| 14 | Drone photo, the lantern at sunset, the knoll marked | The lighthouse, the warden's house and the meadow between them with the knoll | aerial | knoll, map |
| 15 | Drone photo from the north-west, the knoll marked, letters A to D | The whole island from the north-west with the knoll and four letters (A at the east tip, B north of the lighthouse, C at the north jetty, D in the sea south of the knoll with a red line) | aerial | knoll, map |
| 16 | Ground photo of a concrete path fork by a green hut | A cracked concrete slab path with a Y fork by a green board hut | ground | knoll, map paths |
| 17 | The feel of the knoll | Tall wind-blown grass, dry gold and green, small white flowers, a stone, bushes, the shore and a grey choppy sea under an overcast sky | ground, looking south | knoll scene |
| 18 | Screenshot of Monkey Island 2, the graveyard hill (`style-reference-mi2/`) | A round hill under a starry sky, its body painted with long sweeps that follow its roundness, crooked things on its top, a strip of verbs below; never copied, never committed | style reference only | the knoll's manner (d111) |
| 19 | Swirling clouds over an island, from The Curse of Monkey Island, 1997 (`style-reference-mi3/`) | Long ribbons of cloud that end in scrolls over a night island; never copied, never committed | style reference only | clouds (d111) |
| 20 | Nine backgrounds of The Curse of Monkey Island (of 21 looked at), three concept drawings and enlarged sky crops, fetched by the agent (`style-reference-mi3/`, with a README of sources and rules) | Day skies with curled clouds, night skies with ribbons and scrolls, the line drawing of the clouds; never copied, never committed | style reference only | clouds (d111) |
| 21 | Three screenshots of Monkey Island 2 (1991): a shore with a lighthouse and a dig in tall grass, the graveyard hill, a graveyard behind a fence (`style-reference-mi2/grass/`) | How that game paints grass and ground: all blades and broken marks, swells of light and dark, how the ground feels alive; studied into [scene-knoll.md](keri/scene-knoll.md) | style reference | knoll |
| 22 | The knoll's preview with a line drawn on it | Where the land's outline should run on the left: from the edge, level with the hill's top, down to the hill's shoulder; dog roses in the left front and rocky shore right-back | a mark on our picture | built (the left of the lip in `KNOLL_PLATEAU`; the knoll is a plateau) |
| 23 | Screenshot of the campfire in the opening of Monkey Island 2 (1991) (`style-reference-mi2/fire/`) | Trodden ground with grass leaning in over its ragged edge; crooked logs to sit on, shaped by light and shade; studied into [scene-knoll.md](keri/scene-knoll.md) | style reference | knoll |
| 24 | Aerial photograph of the warden's house from the south, the jetty marked "C terminal", a red dashed line north from it marked "Liitsiht", two red arrows on the shore | The house, the lattice mast, the jetty on the north shore behind the house's east end, boulders in the sea, a boat coming in | aerial, looking north | the docks ([scene-docks.md](keri/scene-docks.md)) |
| 25 | The jetty from above, marked "Kinnituskohad" (mooring points) | An aluminium walk on legs from the shingle to a big boulder, a lower landing with a ladder, rings to moor to, a blue rope into the water | aerial | the docks |
| 26 | Two screenshots of Monkey Island 2 (1991): docks at night on Woodtick and on Scabb Island | Plank walks on crooked legs, a lantern on a post, heaped round rocks, a big leaning post near the viewer; studied into [scene-docks.md](keri/scene-docks.md) | style reference | the docks |
| 27 | The crossroads photograph (item 16) beside items 24 and 25 | The warden's house stands just behind the viewer of the crossroads photograph | ground | [scene-crossroads.md](keri/scene-crossroads.md) |
| 28 | The lighthouse from a little left of the crossroads | A fat, nearly upright pale limestone drum about half the tower's height with a rim and a railing on top; a slim, tall rust-red iron column with a railed gallery, a railed lantern and a dome; a tall white flagpole near the camera | ground | crossroads |
| 29 | Nine ground photographs around the crossroads | The well house (blue-green boards, blue barrels at its foot), the sauna (mint-green boards, red-brown posts and porch, an orange-lichened corrugated roof, a brick chimney), the wild dog roses at least 3 m high right of the track to the lighthouse, the lighthouse close up (flared foot of the iron column, a bell, brackets under the gallery, a small window high in the drum), a guide pole by the warden's house, an outdoor gym by the well house | ground | crossroads, garden, the lighthouse everywhere |
| 30 | The lighthouse's lantern from the air at sunset | The lantern close by on the right: a railed gallery, tall panes between thin bars, eaves, a ribbed rust-brown dome with a capped vent; under it the island running north-west to its spit, the warden's house, shingle shores and boulders in the shallows, the sun low over the sea | air, a few metres south-south-east of the lantern at its height, looking north-west | the main menu's picture ([scene-lantern.md](keri/scene-lantern.md)) |

## 5. The island as the game draws it

From the marks on the reference pictures:

- **Map:** a caricature of the island ([d125](decisions/game.md#d125), sketch B, a fat Keri): 1.45 times as wide and turned 8 degrees (the compass shows north), its places and rocks larger than to scale, its north-west tip sharper and its south-east corner a sand strip under the water; before that north was up and the island was drawn about 15 per cent larger so that scenes can be pointed at. The island lies north-west to south-east; the warden's house in the middle, the lighthouse toward the south-east end. The map's manner: as the island maps of Monkey Island 2, a painted island seen at a tilt in the sea with a surf line and shallows, drifting clouds, a compass rose and small drawn landmarks; paths, not dots for stones; a strong lighthouse. The name is the painted word "Keri" (no scroll text), the buildings have real roofs, walls, windows, chimneys and the warden's porch, the ground is a meadow with shingle shores, and each scene has a painted place ([d111](decisions/art.md#d111) points 11 to 14, ft_1_18.AC2). The buildings were corrected against the orthophoto and the drone photos: the former `building-4` was the boat slipway and is now a path of kind `slipway`; there are new buildings `red-shed`, `wood-shed`, `shore-shed`, `hut-west` and `hut-middle` (green board huts; `hut-middle`, north of the crossroads' left arm, is the sauna, and `hut-west` is a small well house) and `north-shed`; the lattice mast is a landmark north of the warden's house; the first scene, the knoll (level 1), lies 50 m west and 2 m south of the lighthouse, placed by eye from a marker on three photographs (within about 15 m). Houses and the lighthouse are drawn taller than to scale so they read.
- **The warden's living room:** the south-east room of the warden's house. Drawn looking **south**, toward the two front windows, from a point inside the room (the view need not stand at the back wall and lines need not be straight; the room has to be cozy and inviting; one painted picture, [d111](decisions/art.md#d111)): on the left the south-eastern one (blue mark), on the right the south-western one (green mark); the front wall faces south-west. The **piano** stands between the two south windows. Side walls in perspective: on the **left** (east) the window looking at the lighthouse (orange mark); on the **right** (west) the fireplace and the door. The fireplace is an **iron stove** with a glass door in front of a red brick wall, its flue pipe into the bricks (from the reference photographs of Keri: a plain metal can of a stove); the walls are white plaster with framed lighthouse photographs. The **bed replaces the sofa**, with Kiur on it. Every object keeps what it does today (ft_1_07, ft_1_08). The things nearest the viewer that frame the picture (ceiling braces, a chest with books and rolled maps, and where firewood lay until the stacks of the warden's music) are props added as framing (the stacks), not things known to be in the real room.
- **The northern shore** (yellow circle): the mark for the old campaign trail, whose view looked out over the northern sea where the sun is seen. The trail and its dot on the map are removed ([d117](decisions/game.md#d117)); the mark stays in the world model as a place (`northShore` in `content/world/keri.json`) and may become a scene.
- **Around the crossroads (item 29):** the wild dog rose (metsik kibuvits) is thick between the crossroads and the lighthouse, especially on the right side of the track, where it almost covers the warden's house, and in reality at least 3 m high, with a few paths through it and branches arching over. The sauna is flimsy in reality and is painted in a better light than it is. The lighthouse is painted grand in every scene. North of the sauna the ground is much like another grassy knoll. A flagpole with Keri's flag stands near the warden's house, right of the path from the sauna. A guide pole (a signpost with arrows) stands by the warden's house, left of the path as one walks toward the house; an outdoor gym stands by the well house, right of the path toward the lighthouse. `KERI-TODO`: neither is in the world model.
- **The grassy knoll (scene 1):** between the warden's house and the lighthouse, south off the trail, a grassy rise with a bonfire place of embers and smoke, looking south to the sea ([scene-knoll.md](keri/scene-knoll.md)).
- **The docks (a scene, level 2):** the jetty on the north shore behind the warden's house's east end (items 24 to 26), seen from the shingle where it starts, looking out along it; wood and rope ([scene-docks.md](keri/scene-docks.md)).
- **The southern docks (the southern port):** the landing at the southern slipway, where the road from the lighthouse comes down to the shore (on the map: a road to the shore and a wooden pier with a landing). **The teacher arrives by boat here**, not at the north jetty (the docks scene). Most visitors land here (it is a wider stone dock; the north jetty is used by the warden and some special characters). Painted as the scene **harbour** (`port`), in the 1991 game's manner and not as the place is (it need not look one to one with the real place, and should look nice in the manner of Monkey Island): a heavy stone quay seen side-on from the west, only the sky, the sea, the quay and the visitors' boats in view, and an underwater world under it ([scene-port.md](keri/scene-port.md)).
- **The lantern over Keri (the main menu's picture):** the lighthouse's lantern from the air a few metres to its south-south-east, looking north-west over the island toward the setting sun (from a photograph: the tip of the lighthouse and an overview of the island); the island under it is projected from the world model, so every house stands where it stands ([scene-lantern.md](keri/scene-lantern.md)).
- **The hallway behind the room's door:** The door leads to a hallway: a wall with perhaps a coat hanger is rendered there, and the hallway goes straight ahead. It is seen through the doorway when the door is open (ft_1_20.AC15). What it holds (boarded walls, pegs with a cap, an oilskin and a scarf) is the painter's guess at a lighthouse warden's hallway, not known of the real house.
- `KERI-TODO`: where the door of the room leads on the map, and any other place the maintainer marks.

## 6. Pictures and the repository

- Only art we draw ourselves goes into the repository, with a row in `docs/assets.md` naming its sources (Maa- ja Ruumiamet, OpenStreetMap, keri.ee facts, the reference photographs of Keri).
- Reference photos stay out of git: some are other photographers' work, some show people, and anything committed stays in the history for good. They belong in the gitignored `private/keri/` (d026).
- Art traced closely from a photo the project holds no rights to follows d107 (private build-time constant) if it is wanted at all.
- **The photo map:** every reference picture of Keri, tied to where it was taken, the places it shows, the scenes it can feed and the code that paints them: `photos.json`, `places.json` (the ids of `content/world/keri.json`), `scenes.json`, `departures.json` and `lore.json`, with the orthophoto under the painter's 25 m grid and numbered sheets on which a camera's place is pinpointed. It holds the reference photographs of Keri and pictures from keri.ee's blog (study only; a picture with a face is left out, people are blurred where the place matters). Never in git: the gitignored `private/keri/`.

## 7. Later ideas (not in the MVP)

- Scenery true to place, time and season: the sun in the right place in every scene (the northern shore shows the sun most of the time; a scene facing south has the sun behind). The sun is computed for Keri (`src/core/sky/`); still needed: a sun azimuth per scene.
- Weather from the island's own weather station (keri.ee `/pages/ilmajaam`); the game runs offline (d068), so only as data fetched while online, or a dropped seam.
- An interactive map: players leave clues and treasures around the island for each other.
- Landmarks to visit as scenery without interaction: the sunken tracked tractor, the helicopter pad, the Kaleva plane memorial, a dead seal, a mummified seagull, the tar pit, the big rock.

## 8. Scenes where the beings are found (d112, ft_1_19)

There is no continuous, uniform trail: the beings to be tamed are found in **scenes**, places on Keri, each its own painted picture, opened from the map. The first place is the grassy knoll; nothing else is drawn until the maintainer names more.

| # | Needed from the maintainer | State |
|---|---|---|
| S1 | Which places on Keri are scenes (marks on the map or satellite image) | first place named: the grassy knoll; the others `KERI-TODO` |
| S2 | Photos or words for each place, with where the photo was taken from and its direction | the knoll: items 14 to 17 (section 4); the others `KERI-TODO` |
| S3 | What the beings are and which lives in which place | beings turn up at random in the open scenes ([d113](decisions/game.md#d113)); what they look like on Keri is `KERI-TODO` |
| S4 | Whether a being is seen at once or looked for in the picture; one being per scene or several | AX-3 provisional: seen at once, several per scene (d113) |

Levelling up opens new scenes. Notes on the map and each scene, with sources, what was noticed and improvement tips that wait for the maintainer: [map](keri/map.md), [the room](keri/scene-room.md), [the knoll](keri/scene-knoll.md).

The landmarks of section 7 (the sunken tractor, the helicopter pad, the plane memorial, the tar pit, the big rock) are places worth visiting; whether any of them is a scene is for the maintainer to decide.

## 9. Lore, the people of Keri and where the painted island departs from the real one

Section 6 holds for every picture of Keri from any source: such a picture is studied, never copied or committed, unless the maintainer says that one may be used.

- IDEA(architect, Later): Keri as an interactive tour guide, and even a standalone adventure game in the manner of the old adventure games, as a separate layer that is only documented for now. Not a feature: nothing is built, and no file in `docs/features/` describes it. The photo map of section 6 is what such a layer would stand on.

**Lore** (documented; nothing here is painted or built until the maintainer says so; the memorial is on the map):

- **The tractor under the ice.** A few decades ago in winter some locals drove a tracked tractor (linttrakto) around the northern coast; it fell through the ice and sank there. Nothing is rendered or built for it now, it is only documented, and it is to become a feature on the map at some point. It lies roughly halfway between the docks and the lighthouse, perhaps 50 metres off the coast. keri.ee's blog ("Kirjad Kerilt 1") tells it of the border guards of the Soviet time and says the wreck still lies in the same place, rusted smaller but plainly a tractor. The spot is O4 or O5: cells O4 and O5 of the painter's grid (section 10) lie off the north shore, due north of the lighthouse.
- **The Kaleva memorial.** Between the sauna and the lighthouse stands a memorial to the Kaleva plane crash; the wreck was found in 2024. Sources: <https://et.wikipedia.org/wiki/Reisilennuk_Kaleva_allatulistamine>, <https://forte.delfi.ee/artikkel/120298228/videod-keri-saarest-pohjas-leiti-ules-reisilennuki-kaleva-vr>, and a keri.ee blog post, where the island's keepers raise a flag with a mourning ribbon on the memorial's flagpole on the June day of mourning. A blog picture shows shore stones heaped round dark plaques, a flagpole and a tripod mark. The spot: in the middle of N8, on the base of an old building whose outline is visible in green on the orthophoto, about 35 m north-west of the lighthouse. The tripod mark stands at the memorial; the flag by the house flies from another pole (section 10). Wherever it is drawn, it is drawn with respect, never as a joke prop.
- **A sunken-wreck scene: an open question for the maintainer alone.** A possible future scene imitating the sunken-ship scenery of Monkey Island is held back on moral and ethical grounds. Nobody designs, paints or plans it; only the maintainer reopens it.

**Where the painted island departs from the real one.** Where a real Keri feature is changed to take on a feature of Monkey Island, it is mapped here. Only the maintainer decides a departure, with its reason; a difference nobody decided is a mistake to fix or a question to ask. The painter adds a row for each departure decided (the same list, with place ids, is `departures.json` in the photo map).

| Scene | On Keri | Painted | The rule | State |
|---|---|---|---|---|
| Knoll | no tree stands on the knoll | a big low tree with a twisted trunk, overhanging the knoll from the left | a tree in the manner of the first Monkey Island 2 picture, though none exists on Keri | painted |
| Docks | the north jetty's landing (`KERI-TODO`: what stands there today) | the walk goes round a big rock from the left, with a small roofed birdwatching tower on the rock | in the manner of Monkey Island 2; the tower can become a scene of its own later | painted |
| Docks | (the tower is itself an addition) | the tower lower and richer, after a thatched hut on stilts in Monkey Island 2's treehouse pictures | a low tower with features, after the treehouse hut | to paint |
| Every scene that shows it | the lighthouse as it stands | fatter and bigger than to scale | fat and indomitable; painted grand in every scene | painted |
| Crossroads | the sauna is a flimsy hut | the sauna in a better light | the sauna painted better than it stands | painted |
| Room | an iron stove with a glass door before the brick wall (photographs) | a pot-bellied stove on bowed legs, its fire behind bars, with a crooked pipe, after the stoves of the 1991 game's Woodtick | the stove and the other things in the room in Monkey Island 2's manner, after the atlas | painted with [d128](decisions/art.md#d128) |
| Crossroads | the photographs show autumn rust | the photograph's layout in summer green and gold | summer, not autumn | painted |
| Map | places and rocks at their true size | the places of interest and the rocks oversized, as on Monkey Island 2's island maps | places of interest and rocks deliberately oversized | painted |
| Map | the island about 480 m long and 110 m wide, north up | the island 1.45 times as wide across its short side and turned 8 degrees, so that the oversized places have room ([d125](decisions/game.md#d125)) | a fat Keri | painted |
| Map | the terrace is a deck before the house's door, some 30 m from the water | the terrace larger and further out on the shingle; no walk from it to the water | it may look as if it reaches the waterfront; no path or staircase leads down to it | painted |
| Map | plain houses: plastered or boarded walls, tin roofs, straight | crooked cottages: leaning walls, big sagging roofs in flat bands, louder colours, shutters at the windows, crooked chimneys; the huts' green a sea green; the lighthouse's stone with courses, rusted hoops and rust under them | houses with character in the Monkey Island manner, at the same sizes | painted |
| Map | the houses stand as measured | the houses spread apart, since each is drawn about twice its size | no house sits on another | painted |
| Map | the south-east corner is a long strip of sand that the waves and the wind reshape; at times it is under water, then it comes back | always under water, long, hooked back under the island, and the back of a sea creature that is hardly seen ([d125](decisions/game.md#d125) point 7) | the creature is noticed only by looking long enough | painted |
| Map | the north-west end as measured | the tip sharper | the western tip sharper, the water still rocky | painted as a wedge |
| Map | the power station, the mast, the sauna and the helicopter pad where they are measured | each at the place the map gives it; the southern slipway along the map's line | the map's own places (`moves` and `lines` in `MAP_SHAPE`) | painted |
| Map | a small well house west of the sauna | a well with a roof on two posts | the well house as an actual well | painted |
| Map | the warden's house 28 m long | four fifths of its length, six windows and the door | shorter, so that it does not compete with the surroundings | painted |
| Map | the ways by the lighthouse as traced; the well 4 m from the fork | the ways laid round the oversized tower: to its foot, on before the eastern houses, a road down to the southern dock; the sauna further north-east | every way leads somewhere; none goes round the tower | painted (`moves` and `lines` in `MAP_SHAPE`) |
| Map | the southern slipway: rails on a concrete tongue | a road to the shore and a wooden pier with a landing | the road ends at a dock, never in the water | painted |
| Harbour | a long narrow pier at the southern slipway, a metal deck on a rusty frame (orthophoto, blog photograph); the Baltic's bottom | a big, heavy stone quay with a parapet, standing on arches, boats moored behind it, nothing else in view; under it a warm sea's reef (fan corals, sponges, kelp, bright fish, jellyfish) | in the manner of Monkey Island: a much larger, heavier pier, a rich coral-like underwater world, no buildings or other features in view | painted, the map's pier a stone quay too |
| Terrace | a deck of boards before the house's door, some 30 m from the water, with benches, a pipe rail on white posts, a lifebuoy and a grill | from the deck's seaward edge a walk of boards on piles runs out over the shingle to a head over the water; on the head a small thatched watchtower, a storey up, with a long spyglass fixed on its floor, a lantern and a pennant; stout wooden rails; three torches at the deck's rail, lit from dusk on; a picnic table between two of the benches, a barrel and two crates; calm, with no small props (d278); the ground before the house lower, so that the whole beach is seen; no way down to the water ([scene-terrace.md](keri/scene-terrace.md)) | more features than the real terrace, further out over the beach, with character and no boat; wooden handrails and a small watchtower with a fixed spyglass; torches at night, since the terrace is the village plaza | painted, awaits the maintainer's look |
| Map | sea rocks of a size, low | no two alike, one absurdly big stack among them | one stack absurdly oversized | painted |
| Main menu (the lantern) | the lantern's optic (not studied) | a brass beehive of rings with a bull's eye in its belt, on a red drum; at night one flat pale beam out over the island | none yet: the painter's | painted, awaits the maintainer's word |
| Main menu (the lantern) | houses, mast and boulders at their true size | the houses about one and a half times as large, the mast taller and fatter, the boulders larger, as on the map | places of interest deliberately oversized, as on the map | painted |

## 10. Places pinpointed on the photo map

Places on the photo map are given by cells of the painter's grid: cells of 25 m, columns A to S from the west, rows 1 to 15 from the north, the lighthouse in the middle of O9. The metres are east and north of the lighthouse, as in `content/world/keri.json`; where only a cell was given, the spot inside it was read from the Maa- ja Ruumiamet orthophoto. Every picture is placed in the photo map (section 6).

| Place | Where | What is known |
|---|---|---|
| The lattice mast | the corner of I6 and J7, by the north-west gable of the warden's house, about (-137, 62) | between the north shed (elektrijaam) and the house, at the marker K97 |
| The boat slip | behind the house, from about (-112, 64) down to the north shore at (-107, 95) | a boat slip |
| The power station (Elektrijaam) | the grey flat-roofed building north-west of the house, I6 (`north-shed` in the world model) | the power station |
| The terrace | right in front of the main door of the warden's house, about (-123, 44), J7 | the terrace with red benches, before the main door, J7 mid-bottom |
| The garden | the south-east end of the house, about (-101, 45), K7: raised beds, red benches and tables | the benches at the south-east side of the house are the gardens (K7); "terrace" and "garden" are each used for their own place |
| The Kaleva memorial | N8, about (-29, 15) by the circle drawn on the orthophoto; before that the middle of N8 | on the base of an old building, its outline visible in green |
| The signpost ("Lohusalu 31 NM", "Pariis 1023 NM") | probably M8 | the cell is not certain |
| The engine room and the cinema (Kinomaja) | both in `building-3`, east of the lighthouse | the engine room is in the northern section, the cinema in the south |
| The knoll | the top right corner of L9, about (-68, 10) | in L9, not in M9 |
| The living room's windows | three room windows show on the house's seaward wall | the last two are the room that is rendered |
| The helicopter pad | the square drawn on the orthophoto, about (-225, 102), a concrete square about 12 m across (landmark `helipad` in the world model) | in the west, inside the tip's wedge |
| The terrace's place | the box drawn on the orthophoto: against the south-west face of the warden's house, about (-124, 38) (landmark `terrace`) | it may be more prominent than the real one |
| The sand strip | the island's very south-east corner and on from it into the sea; no measured shape, since it shifts | a long strip of sand that constantly changes shape by waves and wind, sometimes submerged and then reappearing; in storms the sea smashes into it and the waves explode |
| A bundle of big boulders | E5, by the helicopter pad | in E5 |
| The flagpole | between the warden's house and the sauna, north of the path (L7; the spot by eye): a tall white pole with a long blue, black and white pennant | between the house and the sauna |
| The tripod mark | at the Kaleva memorial, which has a flagpole of its own | at the memorial |
| The guide pole | the signpost above is the guide pole of the photographs | the same pole |
| The weather station | on top of the lattice mast | on top of the mast between the house and the power station |
| The lighthouse's side building (`building-2`, O9/P9) | beside the lighthouse | currently unoccupied and in need of renovation; probably the lighthouse's supplementary building |
| The new wooden shed (`red-shed`, O10) | south-west of the lighthouse, red roof | a recently built wooden shed with sleeping areas, a kitchen and a party area |
| The old boat shed (`wood-shed`, O11) | south of the lighthouse | an old boat shed |
| The mummy of a sea gull (`shore-shed`, Q11) | the small shed by the south pier; one of the landmarks of section 7 | a "mummy of a sea gull" and nothing else |

- TODO(painter, R2): the world model still has the knoll at (-50, -2), in M9; it belongs at about (-68, 10). The knoll's and the crossroads' views are laid out from the old spot, so move it with a look at both scenes and at the map (its fire place is drawn where the scene is).
- TODO(painter, Later): before a scene at the lighthouse is painted, or a picture of the photo map's lighthouse sheet (`sheets/keri-ee-3-lighthouse.jpg`) is first used to say where something stands, ask the maintainer to check that sheet: its camera spots are still guesses. It is checked when it is first needed, not before.
- `KERI-TODO`: the flagpole's exact spot; the layout of the warden's house.

- TODO(painter, R3): the garden scene is paused (d252); it is reworked when it is picked up again.
