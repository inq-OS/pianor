# MI3: The Curse of Monkey Island (1997), a second shelf beside the MI2 atlas

MI3 also has many good examples and stays true to the MI spirit; for example its inventory list has many nice sea-related sprites and various mugs.

**What it is for:** things MI2 has no clean picture of, above all **single objects drawn as inventory items** (mugs, bottles, sea things, papers, tools), and a second opinion on places both games have (a lighthouse, a graveyard, a ship's deck, a beach). **What it is not for:** the look of our painted places. That stays MI2 as released in 1991 (d111, [mi2-manner.md](mi2-manner.md)); MI3 is a later, smoother hand.

**Where:** `private/painter/references/game-1990s/mi3-1997/` (README there), never in git. 147 inventory items (`inventory/`, 144 catalogued as `mi3-inv-<name>`, three are pixel copies), 82 backgrounds in five parts (`backgrounds/part0..4`, 80 catalogued as `mi3-bg-<part>-<room>`, two copies), contact sheets in `sheets/`. Every one carries the tag `mi3`, never `mi2`: `refcat.py` refuses both on one picture, and `baseline`, `gauge`, `beside` and `--atlas` read only `mi2`, so the MI2 gauge and its calibration to the reviewed dial are untouched.

```
python3 -I .claude/skills/study-a-picture/refcat.py find  --tags mi3,mug          # the mugs
python3 -I .claude/skills/study-a-picture/refcat.py find  --tags mi3,nautical     # anchor, hook, map, rope, rum, hourglass, treasure...
python3 -I .claude/skills/study-a-picture/refcat.py find  --tags items --without mi3   # any item picture from elsewhere
python3 -I .claude/skills/study-a-picture/refcat.py find  --tags mi3,lighthouse   # Blood Island's lighthouse, by day's end and by night
```

## Inventory items (sheets mi3-inventory-all, -mugs, -sea)

- **One object, three-quarter view, on nothing.** Each item is an 80 x 56 cell (one eighth of the 640 screen's width), transparent round the object; the object fills about a quarter of the cell (median 26%, from 7% for a diamond to 61% for a map), centred, a little tipped toward the eye so its top shows (mug rims, jar lids, the pan's inside).
- **Few colours, fat shapes.** Median 10 colours an item (2 to 24): two or three tones of one material plus a highlight and a rim. Shapes are exaggerated and soft: a mug swells, the hourglass pinches hard, a rope lies in fat loops, papers curl and tear (`note`, `deathcertificate`, `map`).
- **A darker rim, not a black outline.** In 73% of items the edge pixels are darker than the inside: the material's own deepest tone, not black. Black stays for black things (`mug`, `tire`, `mallet`).
- **Light from the upper left, one hot speck.** A white or near-white speck or short streak on glass, metal and glaze (`mug2`, `jar`, `ring`, `anchor`), never more than one or two.
- **Checker dither for metal and glass only:** pewter (`grog`), steel (`anchor`, `scissors`), glass (`jar`); flat clean steps elsewhere.
- **Material by hue family:** brass and wood golden-ochre with brown lines (`mug4`, `mugcompass`, `rum`), pewter grey with checker (`grog`), glazed jug saturated blue with a white blaze (`mug2`, `mug3`, `mug5`), paper pale gold with brown script squiggles (never grey, the same as our room's papers).
- **Mugs:** the tankard `mug4`/`mugempty` is ochre wood or brass with two hoops, a knobbed handle and measure marks; `mugcompass` is the same with a compass in the drink; `grog`/`grog2` a dented pewter tankard (upright and tipped); `mug2`/`mug3`/`mug5` a round blue jug; `mug` a black coffee mug with a printed label.
- **Sea things:** `anchor` (steel, ring at the top), `hook` (a hand hook), `dinghy` (not a boat: a small yellow figure), `map` (torn parchment with a red X), `rope`/`rope2`, `rum`/`rumbarrel` (a small cask with stencilled RUM), `timeglass`, `torch` (a ship's lantern), `treasure`/`riches`, `sword`, `gun`, `rodhook`.
- **For our band and the room's stand** (ft_1_20 item pictures, the stand's trainer icons): draw one fat object a cell, darker rim of its own colour, one speck, 8 to 12 colours. There is no ear or crosshair among them: those are ours to draw in this manner.

## Backgrounds (sheets mi3-backgrounds-1..7)

- **Twice MI2's resolution** (640 x 480, scrolling rooms to 2096 wide), 256 colours like MI2 (median 198 a room, MI2 164).
- **Smoother paint:** the median lightness step between unlike neighbours is 3.0 L* (MI2 6.8), 29 tones a hue family (MI2 21.5), checker dither 4.6% (MI2 1.2%): soft airbrushed gradients, cartoon outlines, swirling skies.
- **Darker and more saturated nights:** half the pixels darker than L* 25, teal and violet swirls; Blood Island is almost all night.
- Good to look at for: Blood Island's lighthouse from below and from the top (`mi3-bg-3-06`, `mi3-bg-3-21`), the graveyard and crypts (`3-14`, `3-16` to `3-18`), the ship deck panoramas by day (`2-06` to `2-13`), beaches with sand and palms (`1-14`, `1-15`), the Plunder Island map (`1-01`), the barber's and the voodoo room (`1-05`, `1-26`).
- Numbers from `refcat.py`'s traits (MI3's 68 plain rooms against MI2's 82). They are for reading, never for the gauge.
