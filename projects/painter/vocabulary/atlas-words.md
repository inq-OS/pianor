# Atlas words: what to say to find a picture

Every reference picture carries tags from **one set**, whatever its source: the 1991 game's rooms and screens, the photographs of Keri (the reference photographs and keri.ee's, in the photo map), our own screens. Say a word and any thread finds the examples:

```
python3 -I .claude/skills/study-a-picture/refcat.py find  --tags woodtick,light        # ids and tags
python3 -I .claude/skills/study-a-picture/refcat.py find  --tags stones,keri --long    # with what each shows and its path
python3 -I .claude/skills/study-a-picture/refcat.py sheet --tags plants,day,mi2        # a contact sheet to look at
python3 -I .claude/skills/study-a-picture/refcat.py tags                               # this page, live, with counts
```

Words joined by a comma must all hold ("stones, at night, in the 1991 game" is `stones,night,mi2`). `--without` leaves pictures out (`--without screenshot` keeps the clean backgrounds, `--without interface` drops screens with the verb band).

`refcat.py` takes the narrow tags, the place names, the broad words, `tags`, `rooms`, `--long`, the search through the Keri photo map, `about` and `--atlas` (section 5).

Words point directly to where to look in the atlas (a place such as library, woodtick or cliff), and one set of tags applies to all images where applicable (stones, plants, furniture, buildings, water, map and so on), so that relevant examples are found quickly.

## 1. The broad words

A family finds a picture that carries any one of its tags. `=water` asks for the one tag `water` alone (fresh water) instead of the family.

| Say | Finds pictures tagged | Pictures |
|---|---|---|
| `stones` | rock, shingle, cliff, stone-wall, grave | 171 |
| `plants` | grass, foliage, tree, bush, flowers, moss, jungle, swamp | 158 |
| `water` | sea, water, shore, waterfall, underwater | 201 |
| `buildings` | building, hut, lighthouse, tower, town, roof, jetty, bridge, fence, plaster, stone-wall, window, door, stairs | 365 |
| `furniture` | furniture, props | 198 |
| `sky` | sky, clouds, moon, stars | 130 |
| `light` | fire, lamp, moon | 113 |
| `ground` | path, sand, shingle, grass, moss | 138 |
| `boats` | ship, boat, wreck | 65 |
| `creatures` | figure, bird, animal | 31 |
| `items` | item, mug, bottle, tool, weapon, treasure, food, paper, book, rope, nautical | 150 |

Also understood: inventory (item), mugs, tankard, grog (mug), bottles, tools, papers, books, sea-items (nautical), curse (mi3), stone, rocks, boulders, pebbles, plant, trees, bushes, roses, flower, road, roads, paths, track, house, houses, pier, wharf, docks, graveyard, campfire, heat, lamps, lantern, ships, birds, animals, people, inside, outside, evening, morning.

## 2. The games by place

Say the place and get its rooms (the clean backgrounds, `mi2-bg-<part>-<room>`; `MI3` before a room is The Curse of Monkey Island's `mi3-bg-<part>-<room>`) and the game screens that show them (`mi2-scr-...`, with characters and often the verb band). An island's name finds everything on it. The names were given by eye; correct one with `refcat.py tag <id> --tags <place>`.

| Place | What it is | Rooms | Screens |
|---|---|---|---|
| `scabb` | Scabb Island (Part I): every room on it, and its map | 0-002, 0-004, 0-005, 0-006, 0-007, 0-008, 0-009, 0-011, 0-012, 0-013, 0-014, 0-015, 0-016, 0-017, 0-018, 0-019, 0-020, 0-021, 0-022, 0-023 | 61 |
| `woodtick` | Woodtick, Scabb's town of beached ships: plank walks, lamps, and its rooms | 0-006, 0-007, 0-008, 0-009, 0-011, 0-012, 0-013, 0-014, 0-015 | 30 |
| `bar` | the bar in Woodtick | 0-009, MI3 3-08 | 4 |
| `kitchen` | a kitchen (Woodtick's bar, the Booty mansion) | 0-006, 1-057 | 2 |
| `inn` | the inn in Woodtick | 0-011 | 1 |
| `cartographer` | the map maker's cabin in Woodtick | 0-008 | 2 |
| `woodsmith` | the woodsmith's workshop in Woodtick | 0-015 | 2 |
| `cemetery` | Scabb's graveyard: the fence and gate, the hill of graves, the crypt | 0-016, 0-017, 0-018, 0-019, MI3 3-14 | 13 |
| `crypt` | the crypt under the graveyard | 0-018, MI3 3-14, MI3 3-16, MI3 3-17, MI3 3-18 | 1 |
| `voodoo` | the voodoo house in the swamp | 0-021, MI3 1-26 | 4 |
| `beach` | a beach (Scabb's with the twisted tree, Phatt's under the cottage, Dinky's) | 0-004, 0-005, 2-037, 4-085, MI3 1-02, MI3 1-14, MI3 1-15, MI3 3-22 | 8 |
| `bonfire` | the campfire of the opening, on Scabb's beach | 0-004, 0-005 | 3 |
| `peninsula` | Scabb's peninsula with the jetty and the houseboat | 0-023 | 1 |
| `dock` | a jetty with a ship or a fisherman (Scabb's peninsula, Phatt's pier) | 0-023, 2-028 | 4 |
| `dread-ship` | the houseboat, inside, moored and at sea | 0-022, 0-023, 0-024 | 3 |
| `booty` | Booty Island (Part II): every room on it, and its map | 1-045, 1-046, 1-047, 1-048, 1-049, 1-050, 1-051, 1-052, 1-053, 1-054, 1-055, 1-056, 1-057, 1-058, 1-059, 1-060, 1-061, 1-062, 1-065, 1-066 | 57 |
| `stans` | the coffin shop on Booty | 1-046, 1-050 | 4 |
| `spitting` | Booty's street with the flags | 1-047 | 4 |
| `antique-shop` | the antique shop on Booty | 1-048 | 1 |
| `costume-shop` | the costume shop on Booty | 1-049 | 2 |
| `mansion` | a governor's mansion (Booty's and Phatt's), outside and in | 1-052, 1-053, 1-054, 1-055, 1-056, 1-057, 2-041, 2-042, 2-043, 2-044 | 26 |
| `big-tree` | the foot of Booty's big tree, with a small hut | 1-060 | 7 |
| `treehouse` | the huts up in Booty's big tree, and inside one | 1-060, 1-061, 1-062 | 9 |
| `sunken-ship` | the wreck on the sea bed off Booty | 1-065, 1-066 | 6 |
| `phatt` | Phatt Island (Part II): every room on it, and its map | 2-026, 2-027, 2-028, 2-029, 2-030, 2-031, 2-032, 2-033, 2-034, 2-035, 2-036, 2-037, 2-038, 2-039, 2-040, 2-041, 2-042, 2-043, 2-044 | 38 |
| `library` | Phatt's library, with its card drawers | 2-030, 2-031, 2-032 | 5 |
| `jail` | Phatt's jail | 2-029 | 2 |
| `alley` | a back alley (Phatt's, and the night street at the end) | 2-033, 2-034, 4-089 | 4 |
| `cottage` | the cottage on the small island off Phatt, its beach, room and cellar | 2-037, 2-038, 2-039, 2-040 | 9 |
| `fortress` | the fortress (Part III): the rock in a storm, and its fire-lit rooms | 3-068, 3-069, 3-070, 3-071, 3-072, 3-073, 3-074, 3-075, 3-076, 3-077, 3-078, 3-079 | 27 |
| `dinky` | Dinky Island (Part IV): beach, jungle paths, the clearing | 4-085, 4-086, 4-096, 4-097, 4-098 | 16 |
| `tunnels` | the tunnels under Dinky: storerooms, a lift, bare rooms | 4-087, 4-088, 4-090, 4-091, 4-092, 4-093 | 37 |
| `melee` | the night street at the end | 4-089 | 1 |
| `carnival` | the carnival at the end | 4-110, MI3 4-00-01, MI3 4-00, MI3 4-02, MI3 4-03, MI3 4-04, MI3 4-05 | 4 |
| `death-starfish` | MI3: LeChuck's ship and the opening at sea | MI3 0-1, MI3 0-2, MI3 0-3, MI3 0-4 | 0 |
| `plunder` | MI3: Plunder Island, Puerto Pollo | MI3 1-01, MI3 1-02, MI3 1-03, MI3 1-04, MI3 1-05, MI3 1-06-01, MI3 1-06, MI3 1-07, MI3 1-08, MI3 1-09, MI3 1-10, MI3 1-11, MI3 1-12, MI3 1-13, MI3 1-14, MI3 1-15, MI3 1-16, MI3 1-17, MI3 1-18, MI3 1-19, MI3 1-20, MI3 1-21, MI3 1-22, MI3 1-23, MI3 1-24, MI3 1-25, MI3 1-26, MI3 1-27, MI3 1-28 | 0 |
| `ship-combat` | MI3: the Sea Cucumber at sea and its fights | MI3 2-00, MI3 2-01, MI3 2-02, MI3 2-03, MI3 2-04, MI3 2-05, MI3 2-06, MI3 2-07, MI3 2-08, MI3 2-09, MI3 2-10, MI3 2-11, MI3 2-12, MI3 2-13 | 0 |
| `blood` | MI3: Blood Island | MI3 3-00, MI3 3-01, MI3 3-02, MI3 3-03, MI3 3-04, MI3 3-05, MI3 3-06, MI3 3-07, MI3 3-08, MI3 3-09, MI3 3-10, MI3 3-11, MI3 3-12, MI3 3-13, MI3 3-14, MI3 3-15, MI3 3-16, MI3 3-17, MI3 3-18, MI3 3-20, MI3 3-21, MI3 3-22, MI3 3-23, MI3 3-24, MI3 3-25, MI3 3-26, MI3 3-27 | 0 |
| `monkey-island` | MI3: Monkey Island and the end | MI3 4-00-01, MI3 4-00, MI3 4-01, MI3 4-02, MI3 4-03, MI3 4-04, MI3 4-05 | 0 |

Not on an island: the sea chart held in two hands (0-082), an island seen from the sea at night (0-109), a round window in a plank wall (0-010), a blank parchment (1-080), the houseboat and a second ship at sea (0-024, 1-081), the storm sea (3-083), the title and chapter cards (`title`).

## 3. Every tag

**setting:** outdoor (353), indoor (211), map (17), closeup (38), cutscene (11), title (8), underwater (13), aerial (24), item (144)

**hour:** dawn (0), day (160), dusk (32), night (87)

**subject:** sky (112), clouds (57), moon (3), stars (32), sea (133), water (33), shore (63), waterfall (6), rock (94), shingle (9), cliff (24), sand (17), stone-wall (61), grave (25), grass (58), foliage (81), tree (55), bush (7), flowers (17), moss (1), jungle (70), swamp (14), path (72), wood (166), plaster (40), roof (10), building (222), hut (60), lighthouse (69), tower (7), town (41), jetty (33), bridge (9), fence (10), mast (28), window (52), door (69), stairs (34), sign (51), ship (56), boat (8), wreck (9), fire (39), lamp (78), furniture (142), props (145), figure (12), bird (17), animal (2), interface (168), text (16), mug (9), bottle (16), tool (18), weapon (4), treasure (8), food (28), paper (24), book (4), rope (2), nautical (19)

**source:** mi2 (359), mi3 (225), keri (183), ours (3)

**flag:** blurry (1), wide (132), tall (17), dark-frame (4), screenshot (263)

- **setting** says what kind of picture it is; **hour** the light; **subject** what is in it; **source** whose it is (`mi2` the 1991 game, `mi3` The Curse of Monkey Island of 1997, never in the gauge, `keri` a photograph of the real island, `ours` a screen of Pianor); **flag** how to read it (`screenshot` a game screen with characters, `wide` a scrolling room, `blurry` an enlarged close-up).
- Counts move as pictures come in; `refcat.py tags --md` prints these tables again.

## 4. How pictures get their tags

- **A new picture** is tagged when it is catalogued (`refcat.py add ... --tags`, the `study-a-picture` skill). Use the narrow tags; the families follow by themselves.
- **A 1991 game screen** takes the place and subjects of the background room it shows (`refcat.py rooms` matches them by their pixels; 252 of 263 have a room, the rest are title cards and cut scenes tagged by eye).
- **The Keri photo map's photographs** (`painter/keri-map/photos.json`) are found too. A photograph with its own `tags` list uses it; one without is tagged from the words of its description and the places it shows, which is a first guess: `find` shows it, the eye decides.
- **A new tag** goes into `TAGS` in `refcat.py` (and into a family, if it belongs to one) through a pull request, then this page is printed again. A tag used with `--new` and never added shows under "in the catalogue but not in the set" in `refcat.py tags`.

## 5. Keri by scene and by place

The photographs of Keri are not only tagged: the Keri photo map ties each one to **where it was taken, the places it shows and the painted scenes it feeds**, and each scene to its code. It is part of the same reference tooling (it maps photos to the real map and locations), so the one tool reads it:

```
python3 -I .claude/skills/study-a-picture/refcat.py about                                   # the scenes and the places it knows, and the words it understands
python3 -I .claude/skills/study-a-picture/refcat.py about docks                             # a scene on one page
python3 -I .claude/skills/study-a-picture/refcat.py about sauna                             # a place on one page
python3 -I .claude/skills/study-a-picture/refcat.py sheet --scene knoll --tags stones       # the stones in the photographs that feed the knoll
python3 -I .claude/skills/study-a-picture/refcat.py find  --shows lighthouse --placed       # the lighthouse, only photographs whose spot was given
python3 -I .claude/skills/study-a-picture/refcat.py find  --cell K7 --long                  # everything photographed from one cell of the 25 m grid
python3 -I .claude/skills/study-a-picture/refcat.py sheet --scene docks --tags stones --atlas             # Keri's stones over the 1991 game's rooms most like them
python3 -I .claude/skills/study-a-picture/refcat.py sheet --scene knoll --tags plants --atlas 4 --ours test-logs/art/knoll-day.png   # Keri, the game, ours: one sheet
```

| Say | Finds |
|---|---|
| `about <scene>` (`map`, `room`, `knoll`, `crossroads`, `docks`, `garden`) | the scene's place and where it is, the view (camera spot and bearing), the code that paints it, its notes and the command that renders it, **what was changed from the real island on purpose** (the departures, with the rule and the MI2 picture each came from), its lore, how many photographs feed it and what they show, **the five atlas rooms most like those photographs**, and the artist's notes of the things in them |
| `about <place>` (`lighthouse`, `sauna`, `well`, `house`, `jetty`, `mast`, `memorial`, `knoll`, `terrace`, `garden` ...) | where the place is (cell and metres from the lighthouse), who said so, departures and lore tied to it, its photographs and which scenes they feed |
| `--scene <scene>` on `find` and `sheet` | the photographs that feed that scene |
| `--shows <place>` | the photographs that show that place |
| `--cell <K7>` | the photographs taken in that cell (columns A to S from the west, rows 1 to 15 from the north, 25 m; the lighthouse is in O9) |
| `--atlas [N]` on `find` and `sheet` | **the pairing with the MI2 atlas:** the N rooms of the 1991 game (8 unless said) that carry the asked words and share the most tags with the pictures found (setting, hour, subjects). On a sheet they go under the photographs, so the thing on Keri and the game's way of painting it are seen together; `--ours <file>` adds our own picture as a last part |
| `--placed` | only photographs whose spot was given (not guessed); without it guesses are included, marked `?` on a sheet |

These combine with `--tags` and `--without`: "the plants round the sauna, placed photographs only" is `--shows sauna --tags plants --placed`.

- **Where the files are:** `private/painter/keri-map/` (`photos.json`, `places.json`, `scenes.json`, `departures.json`, `lore.json`), and `private/keri/` the gitignored folder; `refcat.py` looks in both. Never in git.
- **Who keeps them:** the photo-map work. `refcat.py` only reads. A wrong place, a new departure or a piece of lore is corrected there (its readable copy is `docs/keri.md`), not in a second list.
- **The pairing is a hint, not a verdict.** Rooms are ranked by shared tags, so a beach with rocks comes up for a shore with rocks whatever its hour or mood. It says where to look; the eye picks the room to learn from, and a recorded pick (a departure's "after", a note's model) outranks it.
- **A guess stays a guess.** A place nobody has confirmed prints "not sure: KERI-TODO". Where a photograph was taken, and what stands where on Keri, is for the maintainer to say.
