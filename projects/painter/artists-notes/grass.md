# Grass and ground

**Model:** the knoll. The knoll is the model for grass, bushes and foliage. Code: the kit, `src/game/ui/pixel/keri/kit/grass.ts`, lifted pixel for pixel from `knollPicture.ts`. A slope is painted as fills on the scene's ground (`KitGround` in `kit/kit.ts`: its top edge, how far down a pixel is, its light, the trodden place, what is covered), back to front: `swells` (the turf with its swells and trodden earth), `gravel`, `moss`, `blades`, `blooms`; then the scene places `clump`s row by row toward the viewer. Where they go stays the scene's: the knoll's `KnollPainter.ground` answers for the plateau and `clumps()` lays the rows. Rule 23 of the art direction is the law behind it: ground is alive, never a flat tone with things set on it.

## Types

`npm run art:render -- kit grass` paints them all, each fill on a plain slope with a trodden oval. How to add one: [kit.md](kit.md).

| Type | What it is for | Variants | State |
|---|---|---|---|
| `grass/swells` (fill) | the turf of a slope: its body dark toward the viewer, low swells with a light top over a dark hollow, bare earth where it is trodden | `meadow`, `smooth` (less grain) | picked |
| `grass/gravel` (fill) | loose small pebbles in patches in the turf | `patches`, `thick` | picked as part of the knoll's turf (the knoll is the pick for grass, bushes and foliage; gravel itself was not named, and stones are the docks' pick) |
| `grass/moss` (fill) | soft cushions, dark under, a pale yellow-green top; covers the ground, so blades grow round them | `cushions`, `big` | picked |
| `grass/blades` (fill) | one short blade beside the other over the slope, far to near: short meadow, longer toward the viewer, dry gold mixed in, dry blades leaning over the rim of trodden earth | `meadow`, `tall`, `dry` | picked |
| `grass/blooms` (fill) | small white and yellow heads of low meadow plants, in loose patches | `meadow`, `rich` | picked |
| `grass/clump` | a clump of blades fanning out of the grass and bending with the gust (`brush.lean`): pale far off, green, dark near the viewer, dry with seed heads | `middle`, `short`, `far`, `dry`, `near` | picked |

Pieces for a scene's own placement: `grassDryness()` (where dry clumps go among green ones), `meadow()` (how short the grass is down a slope). Wanted as a candidate: a mossy stone showing through the turf (the knoll's `flags()`, which stays the scene's until it moves to the kit's stones).

## Recipe

1. **A value plan under everything.** The body of the ground runs dark toward the viewer and light along the crest and on the light's side (`hillTone()`), from the greens of the shared `grass` run, darkest to fourth tone.
2. **Swells.** Low mounds one before another: each has a pale top (26% of the run lighter) and the ground behind it dips into shade (30% darker), so a light edge lies over a dark one. Small by the crest, broad toward the viewer. Never level stripes.
3. **Scattered grain, never a pattern.** A pixel's tone moves up to about two places along the run by a scattered noise (`paint()` with `spread` 1.8). No checkerboard: ordered dither on grass reads as a screen.
4. **All blades.** About six pixels in ten carry a blade: 1.6 pixels long by the crest, longer by 0.036 for each row toward the viewer, each leaning a little with the wind. A blade is a few places up or down the run from the ground it stands on (most near the ground's tone, a few well lighter or darker), its top one place lighter, its foot one darker.
5. **Dry gold mixed into the green everywhere:** about one blade in six, most of them where the light lies and where feet have worn the turf (`dryness()`), from the `dry` run.
6. **Growth of every height.** Clumps in rows far to near: many low, few tall (`hash ** 2.4`), three to seven blades fanning out of one foot, dark low down and light at the tips, a line of shade at the foot (never a block). Dry clumps carry seed heads, a few green ones a white flower head.
7. **Depth by run, not by blur:** far meadow clumps from the pale `far` run, the hill's from `grass`, the ones nearest the viewer from the dark `near` run. The nearest row stands with its feet below the frame's edge and is the dark foreground band.
8. **Where feet go, the grass is short and paler** (the `LAWN` greens) and at bare earth a few dry blades lean in over the ragged edge.
9. **Low meadow life** in loose patches: moss as soft cushions, dark under and pale yellow-green on top; small white and yellow flower heads; patches of loose pebbles in the turf.
10. **The edge against the sky or the shore is ragged blades,** never a drawn line and never a brown strip (on the knoll's bank: the ledge need not be shown explicitly).
11. **The gust.** Clumps and stems bend through the shared motion kit (`paint/motion.ts` `lean`), eight looks; nothing else in the grass moves.

## Atlas

- `find --tags cemetery` (mi2-bg-0-016, mi2-bg-0-017; swatches grass-1, grass-2): night hills in long curved strokes that follow the slope, lit tops smooth, dark tufts only at the edges. The first reference for the knoll.
- `find --tags cliff` (mi2-bg-1-058, swatch grass-3): an acid-green lit top with a dark hanging edge.
- `find --tags cottage` (mi2-bg-2-038, swatch grass-4), `find --tags dinky` (mi2-bg-4-086, swatch grass-5): by day, flat lit green with darker blade strokes, a path cut in.
- `find --tags bonfire`: trodden ground with grass leaning in over its ragged edge.
- Pattern book: [vocabulary/plants.md](../vocabulary/plants.md).
- **Where the model and MI2 part:** by day MI2 keeps the middle distance as soft areas of grain and saves single blades for edges and the near corner; the knoll paints blades everywhere (rule 23: the ground feels alive). The knoll is the pick, so blades everywhere stands.

## Keri

- Tall wind-blown grass, dry gold and green, small white flowers (the reference photograph of the knoll). The crossroads was picked in summer green and gold, not the photographs' rust.
- `find --tags grass,keri` and `find --tags flowers,keri` list the photographs.

## Where each picture stands

| Picture | Grass |
|---|---|
| Knoll | the model |
| Crossroads | since its pass 9 the grass follows the knoll (not yet in a consistency review); it places the kit's types once the knoll's are lifted |
| Docks | only tufts on the shingle; they follow the clump recipe |
| Room | the grass through the left window is level green stripes: broken marks instead |
| Garden | paused for a total rework |

## Open

- IDEA(painter): MI2's soft middle distance (see "Atlas"); show the maintainer both on one strip before touching rule 23.
