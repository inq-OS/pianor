# The artist's notes: how Pianor paints each thing

One island, painted scene by scene, must look painted by one hand. These notes are the house recipes: for each thing that turns up in more than one picture (a stone, grass, a bush, a tree, a path, a lamp's light), **which of our pictures does it right, how it is painted there, and where to look in the MI2 atlas.** A painter reads the note before painting the thing and paints it that way; the `artists-notes` skill (`.claude/skills/artists-notes/SKILL.md`) is the order of work.

A common repository of artist's notes for the various items (foliage, plants, roads, stones and so on), checked against the atlas now and then.

How this differs from its neighbours:

| Where | Holds |
|---|---|
| [vocabulary/](../vocabulary/README.md) | what the pictures we studied do (the 1991 game, Keri's photographs): the pattern book |
| **artists-notes/** (here) | what **we** do: one agreed recipe per thing, with its model scene and code |
| [docs/art-direction.md](../../../docs/art-direction.md) | the rules of the whole look; where a note and a rule disagree, the rule stands until the maintainer changes it |
| `painter/keri-map/departures.json`, with its readable copy in `docs/keri.md` (the section on departures) | where the painted island departs from the real one on purpose (kept by the photo-map thread; one list, add rows there). `refcat.py about <scene>` prints a scene's rows, with the place, the code and the photographs that feed it ([atlas-words.md](../vocabulary/atlas-words.md) section 5) |

## The kit

The things themselves are painted by one shared kit, `src/game/ui/pixel/keri/kit/` (d124): a family of each note has types and variants to choose from, and `npm run art:render -- kit` paints them all on a sheet. How a thing gets into the kit, how it grows, what stays custom to a scene and who lifts what: [kit.md](kit.md).

## The notes

| Thing | The model (the pick) | Note | Say to the atlas |
|---|---|---|---|
| Stones, boulders, shingle | the docks (the docks do it right) | [stones.md](stones.md) | `stones`, `beach`, `cliff`, `stones,keri` |
| Grass and ground | the knoll | [grass.md](grass.md) | `grass`, `cemetery`, `cliff`, `grass,keri` |
| Bushes, roses, foliage | the knoll | [bushes-and-foliage.md](bushes-and-foliage.md) | `foliage`, `bush`, `jungle`, `bush,keri` |
| Trees | none painted yet; the reference is the twisted tree on Scabb's beach | [trees.md](trees.md) | `tree`, `beach,scabb`, `big-tree` |
| Roads and paths | two looks of the 1991 game: slabs as the Phatt cottage's cobbles, footpaths as the Booty hut's sand; Keri keeps its concrete, painted worn | [paths.md](paths.md) | `cottage`, `booty,hut`, `path`, `path,keri` |
| Light and heat (lamps, fire, lit windows) | the docks' method, pushed to Woodtick's strength (the docks, checked against the atlas, Woodtick above all) | [light-and-heat.md](light-and-heat.md) | `woodtick`, `light,night`, `bonfire`, `fortress` |
| Water: the sea | the docks since pass 10 (approved), after the Phatt dock's sea in the 1991 game (both the sea and the wood follow the Phatt dock): a dark far band, pale curling bands in the shallows, dark reflections | [water.md](water.md) | `dock`, `sea`, `water`, `water,keri` |
| Wood: planks, posts, logs | the docks since pass 10 (approved), after the Phatt dock's jetty: warm, chunky, crooked | [wood.md](wood.md) | `dock`, `woodtick`, `wood,outdoor` |
| Living things: fire, water, wind, birds, small life (what moves, and how) | the knoll for fire, the harbour for water and wind, the room for small things (approved, with notes on sparks, smoke and the stove) | [living-things.md](living-things.md) | `bonfire`, `dock`, `water`, `light,night` |
| Sky and clouds, the ink line, buildings | no pick yet | [not-picked-yet.md](not-picked-yet.md) | `sky`, `buildings` |

"Say to the atlas" are words for `python3 -I .claude/skills/study-a-picture/refcat.py find --tags <words>` (or `sheet --tags <words>` for a contact sheet). Every word that works is in [vocabulary/atlas-words.md](../vocabulary/atlas-words.md).

## What a note holds

```
# <Thing>
**Model:** <scene>, <who picked it and when, as a plain line>. Code: <file> `<function>`.
## Types             the kit's types of this family: what each is for, its variants, picked or candidate; and what is custom to one scene
## Recipe            the steps, with the numbers that matter
## Atlas             the words to say, the rooms and swatches worth opening, what they show
## Keri              what the real island says about this thing (photographs, what the maintainer told)
## Where each picture stands     scene by scene: follows the recipe, or what differs
## Open              TODO(painter, R#) / IDEA(painter) / NEEDS-HUMAN lines
```

## Keeping them true

- **Only the maintainer's word makes a model.** A note changes its model only on the maintainer's word (written as a plain line with no date, never a quote, d165). A painter who thinks another scene does a thing better shows the maintainer both side by side and asks.
- **A recipe is checked against the atlas now and then**: open the note's atlas words, put ours beside (`refcat.py swatches --subject <subject> --ours <picture>@x,y,w,h=<scene>`), and write what moved under "Atlas" as a plain line (no date).
- **When the model's code moves** (the shared painters are lifted into the kit, `src/game/ui/pixel/keri/kit/`: [kit.md](kit.md)), the note's "Code" line moves with it in the same pull request.
- A thing that turns up in a second picture and has no note gets one: paint it once, show the maintainer, write the note when the maintainer says yes. Until then it is a line in [not-picked-yet.md](not-picked-yet.md).
- Words only, no pictures (they stay). Pushed as mail, straight to `main`.
