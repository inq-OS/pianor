# The painter's kit: one set of common things, to choose from

The kit is a dedicated set of templates, notes and sprites for commonly used items (stones, foliage and so on), with different types and options to choose from, expanded, refined and supplemented gradually. This does not prevent custom elements when a scene warrants them; one unique type of tree, for example, may be wanted.

The decision is [d124](../../../docs/decisions/art.md#d124). This page is the working agreement for every painted scene: what the kit is, how a thing gets into it, and who lifts what.

## 1. What it is

| Level | What | Example | Where |
|---|---|---|---|
| Family | a kind of thing; has an artist's note | stones | `src/game/ui/pixel/keri/kit/<family>.ts`, `artists-notes/<family>.md` |
| Type | one way that thing looks; one painter function (`KitItem`) | `stones/boulder`, `stones/pebble` | an export of the family's file, a row in `kit/index.ts` |
| Variant | a named set of a type's options | `small`, `in-water`, `foreground` | the type's `variants` |
| Custom | a thing only one scene has; not in the kit | the knoll's overhanging tree, the docks' tower | that scene's `<id>Picture.ts`, listed in the family's note |

Look at all of it: `npm run art:render -- kit` (or `kit stones`, `kit stones night`); the file lands in `test-logs/art/`. That sheet is what the maintainer picks from.

Place a type in a scene:

```ts
import { brushOn, optionsOf } from './kit/kit';
import { boulder } from './kit/stones';

const brush = brushOn(bitmap, SHARED, phase, LIGHT[phase].side, { sway: (p) => swing(look, FRAMES, p), lean: (x, y) => lean(x, y, look, FRAMES, WAY) });
boulder.paint(brush, x, foot, optionsOf(boulder, 'in-water', { wide: 40 }), seed);
```

A scene with clipping or layers of its own writes its own `KitBrush` (`put`, the palette's `run` and `fine`, the hour, the light's `side`, and for what moves `sway` for its loop and `lean` for the wind at a place). The scene's `scenePalette(own, use)` must name the runs a type `uses`; the kit says which one is missing.

## 2. The rules of a type

1. **From the shared palette only,** through the brush's runs: no hex colour in a kit file. It names its runs in `uses`.
2. **Placed by its foot:** `paint(brush, x, foot, options, seed)`; `x` its middle column, `foot` the row it stands on.
3. **A seed makes it:** the same seed the same thing, another seed another. No two alike (art-direction rule 25).
4. **It says how big it is** (`box`), so the sheet and a scene can make room.
5. **It follows the hour's light** through `brush.side` and the palette; it keeps no hour table of its own.
6. **What moves takes the scene's loop and wind** through `brush.sway` (a thing with its own rhythm: foam round a rock) and `brush.lean(x, y)` (the gust at the place it stands: a blade, a stalk); left out, the thing stands still. The kit imports no motion code.
7. **Its words are in its family's note:** the recipe in steps, the model and its rule, the atlas words, and its row in the note's "Types" table.
8. `kit/kit.test.ts` holds rules 1 to 4 for every type and variant by itself; add tests for what makes your type what it is (the docks' boulder: flat bands, a lit side that follows the light, a dark foreground one, a wet foot).

**A fill is a type too.** Some things are not placed by a foot: grass blades over a whole slope, the light and dark swells of a hill, gravel, moss. They paint a region and must ask the scene about its ground at every pixel. Such a type is a `KitFill`: `paint(brush, ground, options, seed)`, where `ground` is the scene's answer at (x, y) (inside the region or not, how far down the slope, the hill's light, trodden or open, bare where nothing may grow) and its bounds. The kit never reads a scene's plan (`src/core/layout/`) itself. `KitFill<O, G>` is in `kit.ts` (brought with the knoll's grass): `G` is what the fill asks its ground, `KitGround` (a slope: its top edge, how far down, its light, trodden, kept short, free, covered, and `cover()` to mark it) for the grass, or a fill's own (a path's along and across); each fill gives a `sample()` ground for the sheet, and the list is `KIT_FILLS` in `kit/index.ts`. It keeps the rules above with "inside its box" read as "inside its region and never on bare ground", and the sheet paints it on a plain sloped patch.

**A type may hand out its look in pieces.** Where a scene must place a thing its own way (the crossroads' rose thicket is a height field cut by paths, not heaps at a foot), the type exports what makes it look as it does, as functions of a pixel: the rose's leaf tone and its flower or hip. The placement is then custom to the scene, the look is still the kit's, and `paint()` builds the plain thing from the same pieces. A scene never copies those lines.

## 3. How a thing gets in, and how it grows

- **Lift, do not copy.** A model that lives inside a scene's file moves into the kit, and the scene calls the kit. Check that the scene's picture did not change (paint it before and after and compare the PNGs).
- **A new type or variant is a `candidate`:** painted, on the sheet, used by the scene that needed it (which says so in its file under `docs/keri/`). Show the maintainer the sheet with the candidate beside the picked types. On the maintainer's word it becomes `picked`, with the rule written in `model` as one or two plain lines (no date, d165).
- **Refining a picked type** changes every scene that places it. Show the maintainer the sheet before and after, and repaint the scenes to see what moved.
- **Options before types.** A bigger, wetter or darker one is an option or a variant. A new type is for a thing built another way (a slab is not a heap of lumps).
- **Custom is allowed,** when the scene warrants it. Paint it in the scene's file, and add a line to the family's note under "Custom": what, which scene, why it is not a kit type. When a second scene wants it, lift it.
- **Keri first.** A type is a thing that stands on Keri, or a decided departure (`docs/keri.md`, the departures). No palm, no cactus.

## 4. Who lifts what

Every family below that is "in the kit" is in the kit (the kit's frame, the docks, the knoll, the crossroads). A scene takes its rows when it is next worked on; the lift goes into that scene's pull request or one after it.

| Family | Types wanted first | Model today | Who | State |
|---|---|---|---|---|
| stones | `boulder`, `pebble` | docks `boulder()`, `pebble()` | lifted into the kit; **the docks** switched `docksPicture.ts` to them, the same pixels (`cornerRocks()` and `pebbles()` stay the scene's: they place kit types). The crossroads place `boulder` since its pass 9 | in the kit, `picked` |
| stones | candidates: a flat slab or ledge, a stack of shore stones, a mossy stone in turf | the knoll's stones in the turf; atlas `cliff` | **the knoll** (stones in turf), **the docks** (slab) | wanted |
| grass | placed: `clump` (middle, short, far, dry, near). Fills: `swells` (the turf with its light and dark swells), `gravel`, `moss`, `blades`, `blooms` | lifted from the knoll pixel for pixel | **the knoll** (brought `KitFill`) | in the kit, `picked` |
| bushes | `bush`, `rose` (with its look in pieces: `roseRun`, `roseTone`, `roseFlower`), `stem`. The meadow flowers are the grass fill `blooms` | lifted from the knoll pixel for pixel | **the crossroads** added the `tall` variant (a 3 m thicket, 250 wide, 220 high, 23 lumps) and the options `keep` and `deep`, which leave `corner` pixel for pixel; its thicket's placement stays custom and is painted through the pieces, and its far flowers stay one pixel. `fleck()` in `shape.ts` is the scanned grain on a run's colour | in the kit, `picked` |
| trees | none common yet. The knoll's overhanging twisted tree is the one **custom** tree (one unique type of tree is allowed) | atlas `beach,scabb` (mi2-bg-0-004) | **the knoll** painted it in `knollPicture.ts`; recipe in [trees.md](trees.md) | custom, painted |
| paths | fills: `slabs` (Keri's concrete, as the Phatt cottage's cobbles), `trail` (earth footpaths, as the Booty hut's sand) | the look is picked (cobbled slabs plus earth trails); the crossroads is the first painted to it, its sheet beside the two rooms is with the maintainer | **the crossroads** lifted both on the knoll's `KitFill` with grounds of their own (`kit/paths.ts`) | in the kit, `candidate` until the maintainer's word |
| lights | `lamp` (a warm pool), `lantern`, `window` (a lit window), `fire` | docks `lamp()`, `lantern()`, pushed to Woodtick's strength | **the docks** lifted `lamp` and `lantern` (with `under` on the brush and `skyline` on a type); **the crossroads** lays the glow of its lit window and of the lighthouse's lantern with `lights/lamp` (no lantern of the kit's, no water), at night only, where the kit's lamp burns at dusk too: see [light-and-heat.md](light-and-heat.md). The knoll's fire is still its own | `lamp`, `lantern` in the kit, `picked`; `fire` to lift; `window` only if a second scene wants the window itself |
| water | fills `sea` and `rings` (pale bands curling round a post or a rock), placed `reflection`; `surf` later | the docks since pass 10, after the Phatt dock (mi2-bg-2-028) | **the docks** lifted them pixel for pixel (`kit/water.ts`); the brush gained `beat` (where the loop stands) for what slides or comes and goes | in the kit, `picked` |
| wood | fill `planks` (a deck of boards), placed `post`; `log` later | the docks since pass 10, after the Phatt dock (mi2-bg-2-028) | **the docks** lifted them pixel for pixel (`kit/wood.ts`), with the kit's own run `KIT_WOOD` that a scene names as its own (`wood` is now a `KitRun`) | in the kit, `picked` |

The map draws places oversized as symbols; it does not place kit types, but a symbol of a thing should be read from the kit's sheet so the map's rock is the scene's rock.

## 5. Open

- TODO(painter, R2): the knoll's stones in the turf still use its own `flags()`; moving them to a kit type changes the picture, so it waits for a pass the maintainer sees.
- TODO(painter, R2): the knoll's fire as `lights/fire`, built on `lights/lamp`.
- TODO(painter, R2): the knoll's far sea follows [water.md](water.md) rules 1 and 2, now that the docks' sea is the model.
- IDEA(painter): a kit type as a moving overlay (frames cut by the motion kit, `paint/motion.ts`), for a thing that sways alone.
- IDEA(painter): `art:check -- kit` to hold each type's colour runs to the measured rules, as a picture is held.
