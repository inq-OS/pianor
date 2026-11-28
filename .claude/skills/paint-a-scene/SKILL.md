---
name: paint-a-scene
description: Use in pianor before painting or repainting any place picture (a Keri scene, a room, the map, a menu background), to study references, paint in the agreed manner and check the result against the measured rules before showing the maintainer.
---

# Paint a scene

The handbook is [docs/art-direction.md](../../../docs/art-direction.md): read its rules (section 2) first. This skill is the order of work and the checks that can be measured. Where they disagree, the handbook is right.

"Monkey Island 2" means the game as first released in 1991, pixel art, never its later remake; its skies come from The Curse of Monkey Island (1997). Reference pictures are studied, never copied, traced or committed (d084).

## 0. Size the job first

Most of what a pass costs is reading and looking, not painting: every tool runs in seconds, but the full reading list is about 100,000 tokens and every picture opened stays in the context for the rest of the session. So size the job before reading:

- **A small change**: one thing in a picture that is already painted and shown (a colour, a stroke, a stone, a sprite, a frame, a fix the maintainer or a review asked for), with no new place and no new thing. Read the art direction and the artist's note of that thing, but not the Keri files, the decisions or the model scene's code (`docs/architect/painter-project.md` section 3), and skip sections 1 and 2b here. Look with `npm run art:diff -- <picture>` (below) instead of opening the four hours. The art review is the light one (`art-review` section 1b).
- **A pass on a place**: a new place, a new thing in it, or a repaint of much of it. Everything below.

When a small change grows past a quarter of the picture (`art:diff` says "a big change"), it is a pass: switch lanes.

## 1. Study before drawing

1. Know the place: the reference photographs of Keri and the world model (`content/world/keri.json`). `python3 -I .claude/skills/study-a-picture/refcat.py about <scene>` gives it on one page from the Keri photo map: where the place is, the view, the code, what was changed from the real island on purpose, and the photographs that feed the scene (`refcat.py sheet --scene <scene>` to open them, `--placed` for the ones the maintainer placed, `--tags <thing> --atlas` to see them over the 1991 game's rooms most like them). Invent no house, path or landmark: write `KERI-TODO` and ask (art-direction rule 14).
2. Look at ten or more real examples of what you paint. The 1991 game is in the MI2 atlas ([study-a-picture](../study-a-picture/SKILL.md) section 9): `refcat.py find --tags mi2,<setting>,<hour>` for the rooms (a broad word such as `stones` or `plants`, or a place of the game such as `woodtick` or `cliff`, works too: `projects/painter/vocabulary/atlas-words.md`), `refcat.py swatches --subject <subject>` for each subject in the scene, and the subject's page in `projects/painter/vocabulary/`; a subject with fewer than five swatches gets more first. The CMI skies are in the local references. Write what they share in the scene's file under `docs/keri/`.
3. **List the things in the picture and read their artist's notes** (the `artists-notes` skill, `projects/painter/artists-notes/`): stones, grass, bushes, trees, paths, lamps and fire each have a house recipe with a model scene, its code and its atlas words. Paint each by its recipe, with the kit's type of it where there is one (`src/game/ui/pixel/keri/kit/`; `npm run art:render -- kit` shows every type and variant to choose from); a thing with no note gets one after the maintainer has picked.
4. Read the measured study, `private/painter/keri/analysis/README.md` (local, not in git). It found **no golden ratio and no rule of thirds**: do not compose to them.

## 2. Paint

- Outdoors: flat pixel art, back to front, from Keri's shared palette (`keriPalette.ts`), with no private colours. Indoors: the lit set, painted over after its light is computed (rule 26: two hues, streaks, a dark foreground, a wobbling lens; place sprites through `lensPlace`). Which manner applies is in art-direction section 3.
- Long colour runs are laid as **bands and brush strokes that follow the form**, with ordered dither only between neighbours of one run. A computed smooth falloff over a volume is not allowed ("too 3D").
- Clouds come from `curlCloud.ts`, each its own spec. Streaks with no head are their own class.
- Ground is never one flat tone with things set on it (art-direction rule 23): grass is broken marks of 1 to 3 pixels in many tones of its run over swells of light and dark, with dry and earth colours mixed in and growth of every height; `blades` and `swellEdges` in `knollPicture.ts` are the model. A landform is not a symmetric ball in the middle, and a patch of ground is no oval (rule 24).
- A thing was found or worn, never made in a factory (rule 25): crooked, thicker at one end, broken ends, no two alike, shaped by light and shade and its shade on the ground, with no line round a small thing outdoors.

## 2b. Say what lives there

A place is not done when its picture is (the small details and nuances of one scene must carry into later scenes). Before showing a pass:

1. Read `projects/painter/artists-notes/living-things.md`: the kinds of life, how each is made, and the verdicts on them (sharp sparks that rise, fire that licks, no smoke at night, one wind).
2. Answer the five questions for the place in `src/game/adventure/sceneLiving.ts`: **fire, water, wind, birds, small life**. Each is a sentence saying what moves, or `none:` and why. `SceneLife.living` is required and `sceneLiving.test.ts` fails without it. For a room or the map, walk the same five by hand and say the answers in the scene's file under `docs/keri/`.
3. Paint nothing organic as a loop of frames. Paint the thing once and let the game move it with the shared tools (`windField.ts`, `flicker.ts`, `motes.ts`, `flock.ts`, `sway.ts`, `wisps.ts`, `leap.ts`, `liveWater.ts`); a thing the wind moves is painted in still air and cut out (recipe step 8 of the note).
4. Show it moving: a few seconds of the place recorded from the game goes to the maintainer beside the stills, since a still cannot show a fire that bites.

## 3. Check what can be measured

```
npm run art:render -- <picture> [hour]    # look at it
npm run art:check  -- <picture> [hour]    # measure it
```

**Look cheaply.** `art:render` writes 1x by default: pixel art loses nothing at 1x, and a 640 x 360 picture costs about 300 tokens to open where 2x costs 1,230 and a 1920 x 1080 screenshot 1,500 or more. For detail, crop and zoom the part (`art:diff` does it for a change), never open the whole picture larger. Open the kit one family at a time (`kit stones`): the whole kit is a sheet 11,000 pixels tall that is shrunk past reading when opened.

```
npm run art:diff -- <picture | kit [family] | figures | ui <sheet>> [hour] [--base <ref>]
```

`art:diff` paints the picture on the branch and on where the branch left `origin/main` (kept by commit, so later looks paint only the branch), at every hour, and writes **one** sheet: before, after and the changed pixels in magenta, cropped round the change and zoomed till single pixels show, one row per hour (`test-logs/art/<picture>-diff.png`). It prints each hour's changed pixels and what the sheet costs to open: a fire ring's stones a pixel wider are under 900 tokens for all four hours, against about 4,900 for the four renders at 2x. A change over a quarter of the picture gets the four hours at 1x on one sheet instead (about 1,230 tokens).

`art:check` prints the picture's runs of colours (lightness steps, hue turn), how many colours of each run the picture uses, and its clouds. It lists findings and writes `test-logs/art/<picture>-<hour>-guides.png` with the composition guides laid over. Its findings are warnings: the eye and the maintainer decide.

| Rule (measured in MI2 1991 and CMI 1997) | Check |
|---|---|
| A material's run: neighbours at most 8 L* apart (MI2 2 to 4.5): name the main tones in `MATERIALS`, the palette adds the in-betweens (`fine`, d111). Lay them as bands and strokes that follow the form | `art:check` steps; `keriPalette.test.ts` |
| The hue turns as a run lightens, about 3 to 6 degrees for each 10 L*: shadows towards violet or red, light towards yellow (warm and green things) or cyan (sky, sea) | `art:check` hue turn; `tools/art/paletteRules.test.ts`, `tools/art/pictureRules.test.ts` |
| A pale highlight (L* above 70) is greyer than the run's most saturated colour | `art:check` |
| Main subject near the middle (0.4 to 0.6 of the width), a smaller second thing off to one side, dark near shapes as wings on at most two edges (optional: a corner may stay open) | guides PNG, by eye |
| The horizon at the viewer's eye height for that place, never on the middle row | guides PNG, by eye |
| A cloud with a head: length 1.8 to 5.5 times its height, head 2 to 9 times the tail, head in the first or last quarter (a fat heap, under 3 times as long as high, carries its bulk nearer the middle). A streak: 7 to 17 times its height. No two clouds of a sky alike | `art:check` clouds, measured on the painted bitmaps |

`art:check` measures the whole runs (`fine`). Exempt: `bloom`, `stem` and `rose` (separate colours, not runs; the list is `APART` in `keriPalette.ts`). `sky`, `cloud` and `sea` are checked for steps only; `ember` is a light source. A near-grey run (shingle, stone, ash) has no hue to turn.

**Every picture is held to these by a test.** Put a new picture into `tools/art/pictures.ts` with its runs (the palette places of each, dark to light), the kinds of its runs that are no material (`sky`, `light`) and what moves in it. `tools/art/pictureRules.test.ts` then holds it, at all four hours, to: runs with no step over 8 L* whose hue turns to the light; at least 85% of the picture painted from its runs; at most 1% coarse dither (a checkerboard of two tones more than 8 L* apart); no run of its own idle at every hour; the same palette places at every hour; clouds in their ranges. The map makes its own runs long with `fineRun` (`paint/lab.ts`). **A lit set whose light is computed (the room) is `banded` in the table and keeps short runs** (steps up to 18 L*, coarse dither up to 3%): long runs made its light shade off smoothly and looked too three-dimensional; the test fails if a banded picture's runs all go long. The test fails while the build paints a picture that is not in the table.

## 4. Look, then show

**Beside MI2 before every showing.** `python3 -I .claude/skills/study-a-picture/refcat.py beside <picture.png> --tags <setting>,<hour>` puts the picture over the three closest 1991 rooms of the same kind with the gauge per trait. Send that sheet with every pass the maintainer sees, and say the gauge's number and how it moved since the last pass. A drop is explained or fixed before the maintainer sees it; the maintainer's eye still outranks the number.

**An art review before every showing**, and on every painter pull request: the `art-review` skill has a fresh reviewer gauge the pass, check it is no copy of an MI2 room, and critique it against the art direction. Its verdict is advice, sent beside the pictures; only the copy guard stops a merge.

**Pictures made for the maintainer are sent, not opened** (the laptop-size screenshots, the beside sheets): you judged the picture from the 1x look, the `art:diff` sheet and the gauge's numbers, and opening a 1920 x 1080 copy again only adds tokens. A small change still makes and sends everything d228 asks for (the laptop-size view at every hour beside the picture it replaces, the art review, the beside-MI2 sheet) and adds its `art:diff` sheet; only the opening is saved. Follow art-direction section 5: all four hours, the picture in the game, side by side with the reference at the same zoom. Pictures for the maintainer stay in a local folder (`private/painter/`), never in git. Write the verdict as a plain rule with no date (art-direction section 5, step 6; d165).
