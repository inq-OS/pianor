---
name: artists-notes
description: Use in pianor before painting, repainting or reviewing any thing that turns up in more than one picture (a stone, grass, a bush, a tree, a path, a lamp's light, water, a hut), to paint it by the house recipe every scene shares and find its examples in the atlas and in the photographs of Keri, and after the maintainer approves a new way of painting a thing, to write the recipe down.
---

# The artist's notes

Several threads paint one island. The artist's notes are the house recipes that keep it one hand: for each recurring thing, **which of our pictures does it right (the maintainer's pick), how it is painted there, and where to look in the MI2 atlas.** They live in [projects/painter/artists-notes/](../../../projects/painter/artists-notes/README.md), one file per thing. They are a common repository of the recurring items (foliage, plants, roads, stones), checked against the atlas from time to time.

This skill sits beside two others: `study-a-picture` learns from a picture (the pattern book, `projects/painter/vocabulary/`), `paint-a-scene` is the order of work for a whole picture. This one is about each thing in it.

## 1. Before painting: list the things, read their notes

1. Write down what the picture holds that another picture also holds or will hold: stones, grass, bushes, trees, paths, water, sky, wood, lamps and fire, houses.
2. Open the index (`projects/painter/artists-notes/README.md`) and read the note of each. A note gives the **model** (a scene and its functions), the kit's **types** of the thing, the **recipe** in steps, the **atlas** words, what **Keri** says, and where each picture stands.
3. A thing listed in `not-picked-yet.md` has no model: read what the reviews advised there, and expect to show the maintainer alternatives (section 4).

## 2. Look at the examples

Say the note's words to the atlas. One tag set covers every reference picture, whatever its source (the 1991 game, the photographs of Keri, our screens):

```
python3 -I .claude/skills/study-a-picture/refcat.py find  --tags stones,night          # ids and tags
python3 -I .claude/skills/study-a-picture/refcat.py find  --tags woodtick --long       # with what each shows and its path
python3 -I .claude/skills/study-a-picture/refcat.py sheet --tags plants,keri           # a contact sheet to open
python3 -I .claude/skills/study-a-picture/refcat.py swatches --subject rock            # the enlarged cut-outs of a subject
python3 -I .claude/skills/study-a-picture/refcat.py tags                               # every word that works, with counts
```

- **Broad words** are families: `stones`, `plants`, `water`, `buildings`, `furniture`, `sky`, `light`, `ground`, `boats`, `creatures`. Narrow tags (`rock`, `bush`, `hut`, `jetty`, `lamp`) work too.
- **Places of the 1991 game** by name: `woodtick`, `library`, `cliff`, `cemetery`, `bonfire`, `beach`, `treehouse`, `big-tree`, `swamp`, `mansion`, `cottage`, `waterfall`, `sunken-ship`, `fortress`, `tunnels`, `carnival`, and the islands `scabb`, `booty`, `phatt`, `dinky`.
- **Whose picture:** `mi2` (the 1991 game), `keri` (the real island), `ours`. `--without screenshot` keeps the clean backgrounds.
- The whole list, with what each place is: [projects/painter/vocabulary/atlas-words.md](../../../projects/painter/vocabulary/atlas-words.md). When the maintainer names a place or a thing (a named room, a named lamp), that word is the search.

Open the pictures and look; the list of ids is not the study. Keri's photographs say what the thing is on the island; the 1991 game says how to paint it. Studied, never copied (`study-a-picture`).

**The real island, by scene and by place.** The photographs of Keri are tied to places on the island, the places to our painted scenes, the scenes to their code (the Keri photo map: `private/keri/`, studied locally, never in git). The same tool reads that chain, so the thing you are about to paint can be looked at where it really stands:

```
python3 -I .claude/skills/study-a-picture/refcat.py about docks                             # one page: the place, the view, the code, what was changed on purpose, lore, its photographs
python3 -I .claude/skills/study-a-picture/refcat.py about sauna                             # the same for a place (refcat.py about lists them all)
python3 -I .claude/skills/study-a-picture/refcat.py sheet --scene knoll --tags stones       # the stones in the photographs that feed the knoll
python3 -I .claude/skills/study-a-picture/refcat.py find  --shows lighthouse --placed       # the lighthouse, only photographs with a confirmed place
python3 -I .claude/skills/study-a-picture/refcat.py find  --cell K7 --long                  # everything photographed from one 25 m cell
python3 -I .claude/skills/study-a-picture/refcat.py sheet --scene docks --tags stones --atlas             # the same stones, and under them the 1991 game's rooms most like them
python3 -I .claude/skills/study-a-picture/refcat.py sheet --scene docks --tags stones --atlas --ours test-logs/art/docks-day.png    # and ours as the last part
```

- `--scene`, `--shows`, `--cell` and `--placed` combine with `--tags` and `--without`. On a sheet the label carries the cell the photograph was taken in; `?` marks a place that is still a guess.
- **`--atlas [N]` pairs the two libraries.** It adds the N rooms of the 1991 game (8 unless said) that carry the asked words and share the most tags with the photographs found (setting, hour, subjects): what the thing is on Keri above, how the game paints it below, and with `--ours <file>` our own picture last. On `find` it lists those rooms with the tags they share. `about <scene>` names the five rooms most like the scene's photographs and the artist's notes of the things in them. The ranking is by tags, a hint where to look; the eye picks the room to learn from.
- **A guess is a guess.** Where a reference photograph was taken is confirmed, never guessed: `about` prints "not sure: KERI-TODO" for a place not confirmed, and `--placed` keeps to confirmed places. Never paint a landmark from a guessed photograph without asking.
- `about` reads the photo map and writes nothing. Its files (`photos.json`, `places.json`, `scenes.json`, `departures.json`, `lore.json`) are kept by the photo-map work; a correction goes there, not into a second list.

## 3. Paint it by the recipe

- **Take it from the kit** (`src/game/ui/pixel/keri/kit/`, d124). The things every scene shares are painted by one function each: a family (stones) has types (`stones/boulder`, `stones/pebble`) and each type has named variants (`small`, `in-water`, `foreground`) and options. Look at them all first: `npm run art:render -- kit` (or `kit stones night`). Place one with `boulder.paint(brush, x, foot, optionsOf(boulder, 'in-water', { wide: 40 }), seed)`; the scene hands it a `KitBrush` (`brushOn`, or its own).
- **Call the model's code, do not write a second painter.** If the model's function still lives inside one scene's file, lift it into the kit in your pull request (and move the note's "Code" line with it) rather than copying it; the scene's picture must not change. A copied recipe drifts.
- **Need one the kit lacks?** A bigger, wetter or darker one is an option or a variant. A thing built another way is a new type: add it as a `candidate`, with its row in the note's "Types" table, and show the maintainer the sheet. It is `picked` only when the maintainer picks it.
- **Custom is allowed when the scene warrants it** (the shared recipes do not rule out one-off elements, for example one unique type of tree): a thing only this scene has is painted in the scene's file and listed under "Custom" in the family's note, with why. When a second scene wants it, lift it.
- The whole agreement, and who lifts what: [projects/painter/artists-notes/kit.md](../../../projects/painter/artists-notes/kit.md).
- Same runs of the shared palette (`keriPalette.ts`), same band count, same grain, same rule for the ink line as the note says.
- **The place changes, the hand does not.** What may differ from the model is what the place really differs in: how big, how many, how wet, how overgrown, which hour's light. Say in the scene's file under `docs/keri/` what you changed and why.
- If the recipe cannot do what this picture needs, do not bend it quietly: section 4.

## 4. When the recipe is missing or wrong

1. Paint the thing the best way you can find (the atlas first), on a strip beside the model, same zoom.
2. Show the maintainer both and ask which is the model from now on. One question, with pictures. Until the maintainer answers, the old recipe stands in every other picture.
3. A product question the axioms decide (does it help the student read the screen?) goes through `axiom-call`; a recipe nobody can decide yet is written `AX-3 provisional` in its note.

## 5. After the maintainer says yes: write it down

In the thing's note (a new file from the template in the index when it has none):

- **Model:** the scene, the pick as a plain line (no date, no quote, d165), the code's file and functions.
- **Types:** the kit's types of the thing with their variants, `picked` or `candidate`; what is custom to one scene, and why.
- **Recipe:** the steps and the numbers that matter (how many lumps, how many bands, how often a blade), so another thread can paint it without reading the code.
- **Atlas:** the words to say and the two or three rooms and swatches worth opening, with what they show. Add tags to pictures that lacked them (`refcat.py tag <id> --tags ...`).
- **Where each picture stands:** one row per picture: follows it, or what differs. A picture that must change gets a `TODO(painter, R#)` in the note's "Open" (d116: no issue).
- A row in the index table of `projects/painter/artists-notes/README.md`, and the thing's line out of `not-picked-yet.md`.

Put the notes in a docs-only pull request, only files under `projects/painter/`, and merge it once `npm run docs:check` passes (`docs/architect/labels.md`).

## 6. Where Keri is changed on purpose

A recipe may ask for a thing the real island does not have (a tree over the knoll, a tower on the jetty's rock, oversized landmarks on the map). Such a change is the maintainer's to decide, never the painter's, and it is written in **one** list, kept by the photo-map work: `painter/keri-map/departures.json`, with its readable copy in `docs/keri.md` (the section on departures). Add a row there when the maintainer decides one (the scene, what is real, what we paint, why, the rule as a plain line with no date, where in MI2 it came from). `refcat.py about <scene>` prints a scene's rows as "changed on purpose": read them before repainting, so a decided change is not "corrected" back to the real island. A departure nobody decided is a mistake: fix the picture or ask (`KERI-TODO`).

## 7. Check against the atlas now and then

The notes are checked against the atlas from time to time. When a scene gets a pass, when the library grows, and before a consistency review:

```
python3 -I .claude/skills/study-a-picture/refcat.py swatches --subject <subject> --ours <ours.png>@x,y,w,h=<scene>
```

puts our cut-out beside MI2's for that subject. Write what moved under the note's "Atlas" as a plain line (no date); if ours has drifted from the recipe, it is a `TODO` in the note; if the recipe itself looks wrong beside MI2, it is section 4.

**A consistency review** (the `art-review` skill, asked for several scenes at once) reads the notes first: a thing painted off its recipe is a finding, with the note's name. It covers the room too, for overall style; the outdoor recipes bind the room only where it shows the same thing (stone, the lighthouse through a window, lamp light).
