# Light and heat: lamps, fire, lit windows

**Model:** the docks' method, pushed to Woodtick's strength. Light and heat follow the docks, checked against the atlas, Woodtick above all. Code: the kit, `src/game/ui/pixel/keri/kit/lights.ts` (`lights/lamp`, the light a lantern lays on what stands round it, and `lights/lantern`, the lamp itself), lifted from `docksPicture.ts` with the docks' pictures unchanged. A scene that lays the light on its own layer gives the brush an `under` that reads its picture (the docks' `lamp()`); `brushOn` reads its bitmap, the bare sky and sea being no thing. The knoll's fire (`embers()` in `knollPicture.ts`) uses the same `ember` run.

## Types

| Type | What it is for | Variants | State |
|---|---|---|---|
| `lights/lamp` | a lantern's warm light at dusk and night: a halo in two flat steps over the bare sky, warmth laid only on tones already lit and falling off fast (seams and shade keep the night), short warm dashes on the water under it; nothing by day | `pool`, `small` (reach 26), `no-water` | picked |
| `lights/lantern` | a small hanging lantern on a hook: an ink frame, pale glass by day, lit at dusk and night | `hanging` (by the hour), `lit`, `dark` | picked |

Wanted as candidates: `lights/window` (a lit window and the spill under it, the crossroads), `lights/fire` (the knoll's fire). Custom: none.

## Recipe

The method (the docks):

1. **Warm light is laid over the finished picture as its own layer,** a frame for each flicker, so it can breathe without repainting the scene. By day it is empty.
2. **It recolours what it falls on; it is not a glow drawn in the air.** Each lit pixel keeps its place in its own run (how light it was) and takes the tone at that place in the `ember` run, so wood stays wood and stone stays stone under the light.
3. **Flat steps, a ragged rim, no dither.** The light falls off in four steps with distance; its outer edge is broken by a noise on the angle, never a clean circle and never a smooth ramp (art-direction rule 6: warm, local, falling off; rule 26: never left as the light computes it).
4. **The dark stays dark.** A pixel that was near the dark end of its run is left as it was: MI2 keeps near-black right beside its warmest light.
5. **Over bare sky, only a small ragged ring** of the palest ember tone round the lamp.

The strength (Woodtick, which the docks do not reach yet):

6. **A lamp owns its neighbourhood.** On Woodtick's lamp-lit deck (mi2-bg-0-014) 22% of the picture is warm; across the whole town (mi2-bg-0-007) 7%; in the night street (mi2-bg-4-089) 7%. Our three night scenes have under 1% (docks 0.4%, knoll 0.8%, crossroads 0.1%). Aim for 5% to 10% of a night picture that has a lamp or a fire, more when the light is the subject.
7. **Plane by plane.** A whole face that looks at the lamp goes warm (orange in its mid tones, yellow at its lightest) and the face round the corner stays navy: the edge between them is the thing's own corner, hard. The docks' quarter-disc of orange on the tower's roof is the fault to avoid: light the roof's underside, the posts, the parapet's inner face and the rock under the tower as planes.
8. **A halo in the air:** a pale yellow disc round the flame, about three lamp-widths across, its edge scattered into the night blue as single pixels.
9. **Lit windows are flat blocks,** yellow above and orange-red below, with the frame's bars dark across them; a little warm spill on the sill and the ground under it.
10. **Light on water** is short vertical streaks, 2 to 6 pixels, under their source, in the lamp's colour (yellow-green on Woodtick's water), never a round blob.
11. **The moon does the cool side:** a one-pixel pale blue rim on the tops and the moon-side edges of things (the docks' `outline()` does this at night).
12. **By dusk the lamp is already lit** but reaches only half as far; the sky does the rest.

## Atlas

- `find --tags woodtick,outdoor` (mi2-bg-0-007 wide, mi2-bg-0-014; swatches wood-2, wood-3): the chosen reference. Lamps, lit doorways and windows in a navy town; warm planes, near-black beside them, cyan rims.
- `find --tags light,night,outdoor`: every night picture with a lamp or a fire, the night street (mi2-bg-4-089) and Scabb's beach among them.
- `find --tags bonfire` (mi2-bg-0-005): a fire lights the ground round it in rings of flat orange, the grass behind it stays dark with lit tips: the knoll's fire.
- `find --tags fortress,indoor`: rooms lit only by fire, everything in one warm run from near-black to yellow.
- `find --tags peninsula` (mi2-bg-0-023): a night with almost no warm light (0.2%): one lit window is the whole of it. Right for a lonely place; the docks at night are close to this today.
- Pattern book: [vocabulary/light.md](../vocabulary/light.md) (where MI2 keeps its darks), [vocabulary/wood.md](../vocabulary/wood.md) (wood by lamplight).
- Checked: the warm shares above, measured as the share of pixels that are saturated, light and redder than blue, on the atlas rooms and on the pictures of consistency review 1.

## Keri

- The lighthouse's lantern is the island's great light; by the grandness rule (in any scene it must be grand) it is lit at night in every picture that shows it, and it throws light on its own gallery and dome.
- The knoll has a fire place; the warden's house and the sauna have windows. KERI-TODO: what other lights the real island shows at night (a lamp at the jetty? the mast?); the docks' lantern is the painter's.

## Where each picture stands

| Picture | Light |
|---|---|
| Docks | the method's model. Pass 9 gave it the halo and the streaks on the water and broke up the quarter-disc on the roof; its strength is still far under Woodtick's (about 0.7% of the night picture warm by a rough count): light whole planes facing the lamp |
| Knoll | the fire glows from the ring's middle in a ragged warm patch that falls off fast; a ring stone is lit only on its side toward the fire (light over every stone read as lava) |
| Crossroads | the glow of the lit window and of the lighthouse's lantern is laid by `lights/lamp` (no kit lantern, no water), on the finished picture, without flicker (a lamp behind glass burns steady). **At night only:** with the kit's dusk rule the warmth on the sun-lit sauna gable read as a blot, so the scene keeps its lamps dark at dusk (AX-3 provisional in `docs/keri/scene-crossroads.md`). Its night picture is about 0.1% warm, far under rule 6 |
| Room | pass 3 (the colours were too saturated and hard to look at): indoors a lamp's light is amber, not orange (the fire 2.3 : 1.2 : 0.56, a lamp 1.5 : 1.08 : 0.62), a lit surface is held back toward its own brown and only the flame and the shade keep a pure colour; the pools are cut from evened light, so a shadow has a clean edge. Before that (d128): the set's computed light is laid in flat pools with ragged borders (`POOL` in `roomPicture.ts`), lamps out by day and full at night, the stove's fire as flat tongues behind bars, two candles on the piano; the lighthouse's lantern in the window has the kit's halo shape painted by `roomView.ts` (not yet `lights/lamp`) |

## Open

- NEEDS-HUMAN: lamps at dusk. The kit's lamp burns at dusk and at night (the docks); the crossroads keeps its lamps to night only because the warm patch read as a blot on a sun-lit wall. One house rule, or each scene's choice by where the sun stands?
- TODO(painter, R2): push `lights/lamp` toward Woodtick's strength by rules 6 to 10 (whole planes facing the lamp; 22% warm on Woodtick's lamp deck). A refined picked type changes every scene that places it: show the maintainer the kit's sheet before and after.
