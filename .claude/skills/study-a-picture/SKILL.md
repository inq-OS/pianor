---
name: study-a-picture
description: Use in pianor whenever the maintainer drops or points at a picture (a photograph, a game screenshot, a sketch, a screen of ours), to check whether it was seen before, study its details and add what it teaches to the painter's vocabulary.
---

# Study a picture

The painter learns from every picture the maintainer hands over. This skill takes one in: is it new, what is it, what does it teach, what it shows that we already know, where is that written down. It ends with a short reply, not a painting; painting is `paint-a-scene` and `use-free-art-packs`.

Two rules come first ([painter-project.md](../../../docs/architect/painter-project.md) rule 6, [art-direction.md](../../../docs/art-direction.md) section 6):

- **Pictures never go into git.** They are studied locally, in the gitignored `private/painter/`. Git gets words only: what was learned, in the painter's vocabulary.
- **Studied, never copied.** A game's picture teaches an approach (how many tones, where the light sits, how a rock is broken up); nothing of it is traced or named in the game.

## 1. Find the picture

A picture is a path or link the maintainer names; `file <path>` tells PNG from JPEG. Several at once are one batch: take them together.

## 2. Seen before?

```
python3 -I .claude/skills/study-a-picture/refcat.py check <file>...
```

`refcat.py` fingerprints the decoded pixels, so it does not care that a copy gets a new name or that a chunk inside a PNG was rewritten. The catalogue is `private/painter/references/catalog.json` (`PAINTER_REFS` moves it).

| Result | Meaning | Then |
|---|---|---|
| `exact` | the very same pixels | Do not add it again. Read what its entry `fed` and say so: "seen before as <title>; it gave <notes>". Study it again only if the maintainer asks something new about it |
| `near` (distance up to 10) | the same picture resized, recompressed or lightly cropped | Open both and compare. Same picture: treat as `exact`. A new crop or a better copy: add it, with a `--note` naming the entry it repeats |
| `loose` (11 to 18) | maybe the same scene or a sibling frame | Look at both; usually new |
| nothing | new | Go on |

The fingerprint misses a small crop out of a big sheet and a photograph of a screen. If a picture looks familiar, `refcat.py list` and look.

## 3. What is it?

Decide the kind from the picture and what came with it; ask in one line only when neither tells.

| Kind | What it is for |
|---|---|
| `keri-photo` | a reference photograph of the island, its houses, plants, birds, light. The truth about Keri: what a place looks like comes from here and nowhere else |
| `game-1990s` | a screenshot of an early 1990s adventure game (Monkey Island 2 as released in 1991, Fate of Atlantis): the manner |
| `game-other` | any other game, including later LucasArts (The Curse of Monkey Island's skies, d111) and the 2010 remake, which is never a reference for the look; note why it was sent |
| `ours` | a screenshot of Pianor itself, usually with a verdict on it: written as a plain rule, not a reference |
| `maintainer-sketch` | the maintainer's drawing or mark-up: an instruction, take it literally |
| `nature-photo` | a plant, animal, rock or sky that is not Keri's |
| `other` | anything else |

**Never invent what only the maintainer knows.** A Keri photograph does not tell which place it is unless the maintainer says so: write `KERI-TODO` and ask ([CLAUDE.md](../../../CLAUDE.md), Keri). **Privacy:** describe only what painting needs. No faces, names, house numbers, number plates or where anyone lives, in any file or message.

## 4. Look closely

```
python3 -I .claude/skills/study-a-picture/refcat.py look <file>
```

prints the size, the pixel scale (4 for a 320 x 200 game shown at 1280 x 800), the size of the art under it, the number of colours and the main ones. A game picture with a scale above 1 or a few hundred colours is real pixel art; thousands of colours in a game screenshot mean it was filtered or is a remake.

Then look with your own eyes. Crop the parts that teach something and enlarge them with nearest-neighbour until single pixels show (Pillow in a scratchpad script; read the PNG back to see it). Ask the questions of the art direction:

- **Materials:** how many tones a run has, how far apart, where the hue turns as it lightens (`paint-a-scene` section 3 has the measured numbers for MI2 and CMI); dither or none, and where.
- **Light:** from where, the hour, how shadows fall and what colour they are.
- **Form:** how a rock, a tree, grass, water, a wall, a cloud is broken into marks; edges, lines round things or none; what makes a thing look found and not made (art-direction rule 25).
- **Composition:** where the main thing sits, the horizon, the dark wings at the edges.
- **Interface and characters:** cell sizes, letters, icon outlines, how a figure stands out from the ground.
- **Motion,** if it is a sequence: what moves, how many frames.
- For a `keri-photo`: the true shapes, colours and things of the place, against `content/world/keri.json` and `docs/keri/`.

Note what our pictures do differently. That is the most useful part.

## 5. Map it to what we already know

A new picture is rarely of a new thing. Tie what it shows to what exists before writing anything down:

- **Other pictures of the same thing:** `refcat.py list --kind <kind>` and the vocabulary headings. Is this the same house, window, shore or rock as in an earlier photograph, from another side or another hour?
- **Keri's world:** the places in `content/world/keri.json`, the notes per picture in `docs/keri/`, and our painted pictures (`npm run art:render -- <room|map|knoll>`). Which place is this, which way is the camera looking, what in it is already painted?
- **The Keri photo map** (`private/keri/`, studied locally): which photographs are already tied to this place, and to which scene. `refcat.py about <place>` (or `about` alone for the list of places), `refcat.py find --cell K7 --long`, `refcat.py sheet --shows <place>`. A new photograph of Keri is added to that map by its keeper (the photo-map work), with where the maintainer says it was taken.
- **Our screens,** for a picture of type `ours`: which screen, which state, what the maintainer marked.

**Place it on the Keri grid.** A development-only map of the island in cells of 25 m, columns A to S from the west and rows 1 to 15 from the north, drawn from the world model (d108: metres from the lighthouse, which sits in the middle of O9). Never shown in the game. Pin where a photograph was taken and which way it looks, and the things in it that have a place:

```
python3 -I .claude/skills/study-a-picture/refcat.py pin K7 "<what>" --kind camera --bearing 120 --from <id>
python3 -I .claude/skills/study-a-picture/refcat.py pin -60,40 "<what>" --kind thing --from <id>
python3 -I .claude/skills/study-a-picture/refcat.py pins --cell K7     # what is already known there
python3 -I .claude/skills/study-a-picture/refcat.py map                # private/painter/references/keri-grid.png
```

A cell is good to 25 m; metres (`x,y`, east and north of the lighthouse) when the place is known better. A pin the maintainer did not give or confirm says so in its text, for example that it is by eye from the photo, about 20 m. To ask where something is, attach the map with your guess pinned and ask whether it is in a named cell or further west.

**When it is not certain, ask; never decide it yourself.** Draw it for the maintainer, with the same label on what might be the same thing:

```
python3 -I .claude/skills/study-a-picture/refcat.py mark <out.png> \
  <new>@x,y,w,h=A@x,y,w,h=B  <earlier>@x,y,w,h=A  <earlier2>@x,y,w,h=B
```

Boxes are in each picture's own pixels. The sheet puts the pictures side by side with coloured, labelled boxes and an enlarged crop of every box underneath, so it reads on a phone. Save it under `private/painter/references/questions/`, attach it, and ask one short question per label: "Is A the same window in both?", "Is B the north side of the house in the first picture?". Two or three labels per sheet at most.

Ask for more when the pictures cannot settle it: another angle of a side never seen, the same place at another hour, a wider shot to place a close-up. Say exactly which view would help ("the house from the sea side, standing on the shore").

Write the answer down as a plain fact (no date, no quote, d165): in the catalogue (`refcat.py note <id> "A = the kitchen window of <id2>"`), and, for a fact about a Keri place, in that place's file in `docs/keri/`. An answer still waited for is a `KERI-TODO` in the vocabulary entry, never a guess.

## 6. Catalogue it

```
python3 -I .claude/skills/study-a-picture/refcat.py add <file> --copy \
  --id <place>-<n> --kind <kind> --title "<what it is>" \
  [--source "<url, game and version, or 'maintainer'>"]
```

`--copy` keeps a copy under `references/<kind>/<id>.<ext>`, so a picture with a meaningless name can be found again. Leave it off for a picture already filed under a sensible name. A batch gets a README beside it, as the older reference folders have.

## 7. Write it into the vocabulary

The vocabulary is [projects/painter/vocabulary/](../../../projects/painter/vocabulary/README.md): one file per subject (rocks, plants, water, sky, light, buildings, characters, interface, motion; start a new subject when none fits). Each entry is something to paint with:

```
## Grey boulders in low sun
- Three tones of a grey that leans violet in shade, a fourth near-white only on the top edge facing the sun.
- Lichen as single pixels of ochre and grey-green, never a patch.
- Ours: `knollPicture.ts` paints the stones as one grey run with no lichen.
- IDEA(painter): lichen pixels on the knoll's stones.
```

- Words only, and the catalogue id in the heading so the picture can be found.
- Add to an entry that already covers the thing rather than starting a second one.
- What our pictures should change becomes a tag (`IDEA(painter)`, or `TODO(painter, R#)` if it was asked for; [todo-tags.md](../../../docs/automation/todo-tags.md)). A fact about a Keri place that belongs to a scene goes to that scene's file in `docs/keri/` instead, through a pull request.
- **Noticed, not needed now.** A detail that has no use today but might later (a weathervane on a roof, how the light falls in the hallway, a boat that could become a scene) is one line in `vocabulary/noticed.md`: `- IDEA(painter): <what, where in the picture> (<catalogue id>[, cell])`. If it has a place on Keri, also `refcat.py pin <cell> "<what>" --kind noticed --from <id>`. Do not study it further now; say it in one line in the reply ("noticed a weathervane on the warden's house, noted for later").
- Then record where it went: `refcat.py note <id> "vocabulary/rocks.md: grey boulders"`.

Put the vocabulary in a docs-only pull request, only files under `projects/painter/`, and merge it once `npm run docs:check` passes (`docs/architect/labels.md`). Batch a session's pictures into one commit.

## 8. Tell the maintainer

A few lines, plainly: seen before or new (and if seen, when and what it gave); what it is, if you had to decide; the three to five details that matter most; what it suggests for our pictures. Ask what only the maintainer can answer (which place, why it was sent) in one line. No praise of the picture, no list of everything noted: that is in the vocabulary.

## 9. The MI2 atlas: the 1991 game, always at hand

Every painter thread compares against the same library instead of searching the web again. Four parts, one tool (`refcat.py`), pictures studied locally and never committed:

| Part | What | Where |
|---|---|---|
| Library | Monkey Island 2 as released in 1991, studied as a reference: the VGA backgrounds without characters (`backgrounds/`) and the PC VGA screenshots with characters and the verb band (`screens/`), catalogued as `game-1990s` with tags | `references/game-1990s/mi2-1991/`, local only, README there |
| Swatches | boxes cut from library pictures, filed by subject; only coordinates are kept, the crop is drawn when asked | the catalogue (`swatches`) |
| Pattern book | what a subject's swatches teach, in words and measured numbers, each entry naming its swatches; `proportions.md` for sizes against the frame | `projects/painter/vocabulary/` (git, as mail) |
| Gauge | eight countable traits of a picture, placed in the range of comparable MI2 rooms; one percentage, calibrated against the maintainer's own dial | `refcat.py gauge`, `beside`; MI2's numbers in `projects/painter/vocabulary/mi2-gauge.json` |

**On a new machine** the library is empty, but its words and numbers are in git: `refcat.py init` makes the shelves (`private/painter/references/`, a README per shelf for where its batch came from, an empty catalogue, `private/keri/`), and `refcat.py import <folder> --shelf mi2-bg|mi2-screen|mi3-bg|mi3-inv --source "<where from>"` files a whole folder at once. A background named `<part>-<room>` (`0-004.png`) gets the id `mi2-bg-0-004` and, when `mi2-gauge.json` measured that room, its tags back; the rest need tags before `refcat.py baseline`, which refuses to drop a measured room the library lacks (`--shrink` allows it). The gauge works from `mi2-gauge.json` alone, before any picture is back; `find`, `sheet`, `--atlas`, `beside`, `swatches` and the copy guard need the pictures.

**Tags** come from one fixed set that every picture shares, whatever its source (`refcat.py tags` prints it with counts; [atlas-words.md](../../../projects/painter/vocabulary/atlas-words.md) is the same list to read): a setting (`outdoor`, `indoor`, `map`, `closeup`, `cutscene`, `title`, `underwater`, `aerial`), an hour (`dawn`, `day`, `dusk`, `night`), the subjects in it (`sea`, `rock`, `shingle`, `grass`, `bush`, `tree`, `path`, `wood`, `hut`, `lighthouse`, `jetty`, `lamp`, `furniture`, `figure` ...), a place of the 1991 game (`woodtick`, `library`, `cliff`, `cemetery`, `treehouse` ...), whose picture it is (`mi2`, `keri`, `ours`), and flags (`blurry` for MI2's few enlarged close-ups, `wide` for a scrolling room, `screenshot` for a game screen with characters). Only a picture with at most 256 colours can carry `mi2`: the 2010 remake has thousands and is refused. **A second shelf, MI3:** The Curse of Monkey Island (1997) in `references/game-1990s/mi3-1997/` (backgrounds `mi3-bg-*`, inventory items `mi3-inv-*`, setting `item`, subjects `mug`, `bottle`, `nautical` ..., family `items`), tagged `mi3`: never `mi2` and never in the gauge, `baseline`, `beside` or `--atlas`. What it teaches: [mi3.md](../../../projects/painter/vocabulary/mi3.md). Tag every picture you add (`add --tags`), with narrow tags.

**The words people say are families** of those tags: `stones`, `plants`, `water`, `buildings`, `furniture`, `sky`, `light`, `ground`, `boats`, `creatures` find a picture carrying any tag of the family (`=water` asks for the one tag). `find` and `sheet` search the catalogue and the Keri photo map (`private/keri/photos.json`; a photograph there with no `tags` of its own is tagged from its description, a first guess). The photographs can also be asked for by what they are tied to: `--scene <scene>` (they feed that painted scene), `--shows <place>` (they show that place of Keri), `--cell K7` (taken there), `--placed` (only the ones the maintainer placed); `refcat.py about <scene|place>` prints the whole chain for one scene or place: place, view, code, what was changed on purpose, lore, photographs, and for a scene the atlas rooms most like its photographs. `--atlas [N]` on `find` and `sheet` adds the N rooms of the 1991 game most like the pictures found (the asked words, then the most shared tags), so one sheet shows the thing on Keri and the game's way of painting it; `sheet --ours <file>` adds our own picture as the last part. `refcat.py rooms` gives each 1991 game screen the place and subjects of the background room it shows. A new tag goes into `TAGS` in `refcat.py` by pull request; `--new` only for a try.

```
python3 -I .claude/skills/study-a-picture/refcat.py find --tags mi2,outdoor,night --without blurry
python3 -I .claude/skills/study-a-picture/refcat.py find --tags stones,keri --long               # a family, in the photographs of Keri
python3 -I .claude/skills/study-a-picture/refcat.py find --tags woodtick,light --without screenshot
python3 -I .claude/skills/study-a-picture/refcat.py about docks                                             # Keri: one scene or place on one page
python3 -I .claude/skills/study-a-picture/refcat.py sheet --scene docks --tags stones --placed --atlas      # Keri's stones round the docks over the 1991 game's rooms most like them
python3 -I .claude/skills/study-a-picture/refcat.py sheet --tags mi2,outdoor,night     # contact sheets, labelled by id
python3 -I .claude/skills/study-a-picture/refcat.py crop <id> x,y,w,h --subject sea --note "three bands, foam as 1-pixel dashes"
python3 -I .claude/skills/study-a-picture/refcat.py swatches --subject sea --ours ours.png@x,y,w,h=docks
python3 -I .claude/skills/study-a-picture/refcat.py gauge ours.png --tags outdoor,night
python3 -I .claude/skills/study-a-picture/refcat.py beside ours.png --tags outdoor,night
```

- Boxes are in **art pixels** (a 1991 room is 320 wide; ours are 640). `swatches` enlarges by whole pixels and outlines ours in yellow.
- A subject with fewer than five swatches gets more before anyone paints it: `find` the rooms that have it, cut the best parts, write what they share into the subject's file in the pattern book (`## <what> (swatches sea-1, sea-4)`), with the numbers the gauge or `look` gives.
- **The gauge counts craft, not charm.** Colours, tones per hue, the lightness step between neighbours, checkerboard dither, how long a run of one colour is, darkness, light spread and saturation. Not quirk, character or composition: the eye and the maintainer decide those, and the verdicts in the pattern book outrank the number. It compares like with like (same setting and hour), widening only when fewer than five rooms match, and says what it compared with. `raise` or `lower` beside a trait says which way to move.
- **Calibration:** the maintainer dials a few pictures from 0 to 100 (a sheet of MI2 rooms and ours, unnamed); `refcat.py calibrate a.png=70:outdoor,night b.png=15 ...` fits the dial so the gauge agrees; add two or three MI2 rooms at 100 as anchors (`<room path>=100:outdoor,day`). Until then it prints "uncalibrated". Refit when the maintainer's sense and the number part.
- When the library grows (a new pick by the maintainer), `refcat.py baseline` measures the MI2 rooms again into `mi2-gauge.json`; it keeps the weights and the dial.
- **Studied, never copied.** No swatch is pasted, traced or named in the game; the gauge measures traits, never shapes.
