# The painter's vocabulary

What the painter has learned from pictures, in words: how a thing is painted, one file per subject. Filled by the `study-a-picture` skill (`.claude/skills/study-a-picture/SKILL.md`) each time the maintainer drops a picture, and by the painter whenever a study teaches something.

**No pictures here.** The pictures stay, catalogued in `painter/references/catalog.json`; each entry below names its catalogue id so the picture can be found again (`python3 -I .claude/skills/study-a-picture/refcat.py list`).

## Subjects

Started so far: [rocks.md](rocks.md), [buildings.md](buildings.md), [water.md](water.md), [sky.md](sky.md), [plants.md](plants.md), [wood.md](wood.md), [light.md](light.md), [proportions.md](proportions.md), [maps.md](maps.md), [paper-and-books.md](paper-and-books.md).

**The MI2 atlas** (study-a-picture section 9): [mi2-manner.md](mi2-manner.md) is its front page, what makes a picture MI2 in measured numbers; [mi2-gauge.json](mi2-gauge.json) holds the numbers the gauge compares with (no pictures). [mi3.md](mi3.md) is a second shelf: The Curse of Monkey Island (1997), its inventory items above all; tagged `mi3`, never in the gauge; The Secret of Monkey Island as first released is a third, tagged `mi1`. [atlas-tags.json](atlas-tags.json) keeps the tags of every library picture the gauge does not measure, so a library gathered again gets them back. Entries name swatch ids (`sea-1`) as well as catalogue ids: `refcat.py swatches --subject sea` draws them.

One file each, started when the first entry needs it: `rocks.md`, `plants.md`, `water.md`, `sky.md`, `light.md`, `buildings.md`, `characters.md`, `interface.md`, `motion.md`. A new subject gets a new file and a line here.

**Finding a picture by a word:** [atlas-words.md](atlas-words.md) lists every tag, the broad words (`stones`, `plants`, `water`, `buildings`, `furniture`) and the 1991 game's places by name (`woodtick`, `library`, `cliff`); one tag set for every picture, whatever its source.

**What we do with all this** is in [the artist's notes](../artists-notes/README.md): one house recipe per thing (stones, grass, bushes, trees, paths, light), each with its model scene and its atlas words. This folder says what the studied pictures do; the notes say what Pianor does.

`noticed.md` is different: details seen in passing that have no use yet, one `IDEA(painter)` line each, kept in case a later scene or feature needs them.

## The Keri grid

A development-only map of the island in 25 m cells (columns A to S from the west, rows 1 to 15 from the north; the lighthouse is in the middle of O9), drawn from the world model (`content/world/keri.json`, d108). Entries name a cell when the thing has a place (`(shore-boulders, K7)`). Pins of cameras, things and noticed details live in the catalogue; `refcat.py map` draws them onto `private/painter/references/keri-grid.png`. Never shown in the game.

## An entry

```
## <what it shows, a few words> (<catalogue id>[, <catalogue id>])
- How it is painted: tones, light, marks, edges, in a sentence each.
- Ours: what our picture does differently, with the file.
- IDEA(painter): what we could change. / KERI-TODO: what only the maintainer can tell.
```

Add to an entry that covers the thing already instead of writing a second one. Facts about a Keri place go to that place's file in `docs/keri/`; this folder holds the manner.
