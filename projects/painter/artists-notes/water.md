# Water: the sea

**Model:** the sea at the Phatt dock in the 1991 game (mi2-bg-2-028), picked from a sheet of that room over our docks (the water and wood sheet). Both follow the Phatt dock: **the sea gets a dark far band, pale swirls in the shallows and dark reflections; the docks are repainted to it first.** Not taken: keeping ours (the docks' even sea of level dashes, which consistency review 1 had advised keeping). **Our model is the docks** since their pass 10 (approved). Code: the kit, `src/game/ui/pixel/keri/kit/water.ts`, lifted from `docksPicture.ts` pixel for pixel (merged); the sea's swing and twinkle in `src/game/ui/pixel/paint/motion.ts`, the sea's five tones per hour in `keriPalette.ts` (`KERI_HOURS`, "from the dark line under the horizon to the pale shallows").

## Types

Lifted from the docks, `picked` on the approval of the docks, with the rule in each type's `model` ([kit.md](kit.md)). The sea and the rings are fills on a ground of their own, `SeaGround` (the rings with what `stands` in the water); a reflection is placed by the foot of the leg it lies under and paints only where the brush's `under` says bare water. The bands slide and the whitecaps come and go on the brush's `beat` (where the loop stands).

| Type | What it is for | The look | State |
|---|---|---|---|
| `water/sea` (a fill) | the open sea from the horizon to the shore | a pale line on the horizon, a broad dark band under it, a lighter body, turquoise shallows, level dashes. Variants `bay`, `narrow-band`, `drift-left` | in the kit, `picked` |
| `water/rings` (a fill) | the water round a post, a rock, a hull | pale bands that curl round the thing and trail off with the drift, sliding outward in the loop. Variants `posts`, `drift-left` | in the kit, `picked` |
| `water/reflection` | under a post or a leg | near-black broken blobs wider than the leg, water between them. Variants `leg`, `thick`, `thin` | in the kit, `picked` |
| `water/surf` | where the sea meets shingle or rock | a ragged near-white band, hard on the land side, broken into dots on the sea side | not in the pick; the docks' foam line stays until compared |

Custom: none.

## Recipe

After mi2-bg-2-028, measured on the room at its own 320 by 144 pixels:

1. **A pale line, then the darkest water.** The horizon is one row of pale blue (#98ccf4, lighter than the sky above it), and the row under it is navy (#143890, #18286c). There is no gradient between them.
2. **A broad dark far band.** The navy holds for about the top two fifths of the sea (lightness about 50 of 255), in six to eight near tones laid as short level dashes. Ours holds its dark line for a few rows only, at about 80.
3. **Lighter toward the viewer here.** Below the band the sea steps up through mid blue (#1c50ac) to a bright body (#247cd0, #1c68c4, about 110). This is the look of shallow water over a pale bottom at a shore, and it is the docks' case; an open sea seen from a height (the knoll) keeps the pattern book's "darker toward the viewer".
4. **Pale bands that curl.** In the shallows, bands of the two lightest tones, two to four pixels thick, swing round each post and rock and trail away in long S curves, each further from the last. They are bands of flat colour, not dashes and not foam.
5. **Dark reflections.** Straight under a post or the deck's edge lie broken near-black blobs, wider than the post, with water showing between them.
6. **Grain is the sea's own.** A third of the pixels may be lone grain; the level dashes stay in the far band and the body. The sky keeps none of it.
7. **It moves.** Every look of the motion kit must keep these: the far band holds still, the dashes rock, the curling bands slide along their own curves. A ring that jumps between looks is the fault to avoid.
8. **At night** two or three blues, almost flat; the curling bands are the palest thing near the shore and a lamp's light lies on the water as short upright streaks ([light-and-heat.md](light-and-heat.md)).

## Atlas

- `find --tags dock` (mi2-bg-2-028, mi2-bg-0-023): the model by day, and a dock at night with a nearly flat navy sea and one pale band at the shore.
- `find --tags sea,outdoor` (mi2-bg-1-081, mi2-bg-0-024): an open sea in broad dark wave bands with pale crests, and a bright sea of level dashes with white foam at a hull. On the sheet for comparison; not the pick.
- `find --tags booty,hut` and `find --tags cottage` (mi2-bg-1-051, mi2-bg-2-038): the two rooms the paths follow show the same sea: deep blue far off, white streaks near the shore.
- Pattern book: [vocabulary/water.md](../vocabulary/water.md) (swatches sea-1 to sea-7).

## Keri

- The sea is in every outdoor view. `find --tags water,keri` lists the photographs; `about docks` gives the jetty's.
- KERI-TODO: how the real water looks round the north jetty's posts (clear over stones, weed, ice in winter) is for the maintainer to say if it should show; the pick is the 1991 look.

## Where each picture stands

| Picture | The sea |
|---|---|
| Docks | **the model** since pass 10: the pale horizon row, the dark far band, a brighter body, pale bands curling round the walk's legs and the rocks at all four hours, dark reflections under every leg; the five tones per hour were enough, `keriPalette.ts` is untouched. Seen beside the room: our bands are thinner and more of them, spread over the whole bay, where the room has a few broad ones near the jetty |
| Knoll | a far sea seen from the plateau, dark with level strokes and white glints: rules 1 and 2 apply, rule 3 does not |
| Crossroads | almost none shows |
| Map | its own sea, drawn as a chart: not this recipe |

## Open

- Done: the docks' sea repainted and lifted as `water/sea`, `water/rings`, `water/reflection`. They are `picked` and in the kit.
- TODO(painter, R2): the knoll's far sea to rules 1 and 2 (after the docks).
- IDEA(painter): surf as its own type once two scenes paint a shore the same way.
