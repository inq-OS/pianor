# Living things: what moves in a place, and how

**Model:** the knoll for fire, the harbour for water and wind, the room for the small things indoors. The world uses the full capability of Phaser to be dynamic, so that organic randomness is not hard-coded statically; particle emitters are not against the vision (modern sparks and fireflies with 1990s pixel art are a good combination); and every future scene considers these small details too. Decision: [d156](../../../docs/decisions/art.md#d156). Code: `src/game/ui/pixel/` (`windField.ts`, `flicker.ts`, `motes.ts`, `flock.ts`, `sway.ts`, `wisps.ts`, `leap.ts`, `liveWater.ts`, `swimMotion.ts`), laid by `PixelScene` (`liveWater`, `liveLayer`, `motes`, `gulls`, `blend`).

A painted place is not done when its picture is. **For every place the painter answers five questions, in `src/game/adventure/sceneLiving.ts`: what fire, what water, what wind, what birds, what small life?** Each gets a sentence, or `none:` and why. `SceneLife.living` is required and `sceneLiving.test.ts` fails for a scene with no list or an empty answer, so a new scene cannot be added as a still picture without someone having decided so. A room or the map has no such list yet: walk the same five questions by hand.

## Types

| Kind | What there is | How it is made | State |
|---|---|---|---|
| fire | flames behind glass (the stove) | one smooth loop of drawings, tongues rising in turn, each blended into the next, at a pace that wanders (`flameAt`) | picked (the flame licks, never bites) |
| fire | embers, a lamp's, a lantern's light | looks blended at a strength that wanders with flares (`glowAt`, `PixelScene.blend`) | picked (approved) |
| fire | sparks | sharp dots, no glow; they rise slowly and nearly straight, cool white to red; about one in three climbs on into the sky (`sparksAt`) | picked (sharp dots, not glow; slightly slower; some of them reach the sky) |
| fire | smoke | one thin thread the gusts bend (`paint/smoke.ts`); by day and in the half light only | picked (a thin thread, not puffs of balls; no smoke during the night, none from boats) |
| water | the sea's strokes, glints, rings, surf | recorded by the painter, lit by the game (`paint/live.ts`, `liveWater.ts`) | picked (approved) |
| water | spray off rocks | drops thrown in a gust, falling back (`sprayAt`) | built, not yet judged alone |
| water | a moored boat | painted once; rides the swell by parts of a pixel, each boat in its own time (`bobAt`) | candidate |
| water | a jumping fish | now and then, an arc and a spreading ring; a silver side under a grey back, the ring two rows of dashes in the water's own pale tone, white only where it breaks the water (`leap.ts`) | candidate (art review 2: white strokes "read as brackets") |
| water | kelp, weed | painted once in still water, cut out, its rows swayed (`sway.ts` kind `weed`) | candidate |
| water | what changes its place under water from look to look (fans, anemones, sea grass, the wonders) | cut out of each look and stepped whole over looks that blend only the water's light (`PortPainter.moving`, `deepThings`) | candidate (art review 2: blended, they stood twice, half see-through) |
| water | fish, a school, jellyfish, bubbles | sprites on pure courses; the school as a flock (`swimMotion.ts`, `flock.ts`) | picked (approved) |
| wind | clouds, the looks' clock, water, smoke, gulls | all read one wind whose gusts cross the picture (`windField.ts`, `airOf`) | picked (approved) |
| wind | a pennant, washing on a line | painted once in still air, cut out with its contour, bent by the game (`sway.ts` kinds `flag`, `hang`) | candidate |
| birds | gulls | a flock (boids), each bird a three-look sprite, gliding mostly (`flock.ts`); over ground as pale as the bird (the map) a dark line under it (`gullLooks` with `edge`) | picked (approved); the line is a candidate |
| small | fireflies | soft glowing motes over grass, dusk to dawn (`firefliesAt`) | picked (the combination of modern sparks and fireflies with 1990s pixel art) |
| small | moths | sharp dots circling a lit lamp, warm as the lamp so they are not taken for stars (`mothsAt`) | candidate |
| small | dust in window light | soft specks drifting in the shaft, dawn and day (`dustAt`) | candidate |
| small | steam over a mug | short wisps leaving in their own time, in blocks of two by two as the room's sprites, bright at the mouth, gone half way up their box (`steamAt`) | candidate (mugs may steam; art review 2: a line one pixel thin "reads as a scratch") |
| small | a sleeper's letters | a z with each breath out, breaths of uneven length (`zzzAt`, `breathAt`) | candidate (Kiur may sleep with Zs) |

A candidate becomes picked when the maintainer has seen it and said yes; write the rule as one or two plain lines (no date, d165).

## Recipe

1. **Nothing organic is painted as a loop of frames.** The painter paints the thing once (or records where it may appear) and the game moves it. A loop repeats and steps; both are seen (a change of frame is very noticeable).
2. **Pure, from the time and the day's seed.** No dice while the game runs, no Phaser particle emitter: every motion is a function `(time, seed) -> pixels or places`, so the same moment always looks the same, tests and screenshots stay still, and reduced motion shows the first moment.
3. **Uneven on purpose.** Gaps between events, lengths of lives, paces and paths all come from the seed's dice or a slow noise; a clock that wanders must still only run forward (`windTime`, `flameAt`, `breathAt` show how).
4. **One wind.** Whatever the wind could move reads the place's `Air`: its clock for pace, its gust for strength, its way for direction. A new moving thing never brings its own wind.
5. **It follows the laws a student knows** (water follows natural laws): sparks rise and cool, spray falls back, steam thins, a flag is fast at its hoist, washing hangs from its line.
6. **Pixel art stays pixel art.** A moved thing lands on whole fine pixels; only a glow (fireflies, dust) is soft and laid on with light. Sharp is the default: ask before adding a glow (the sparks lost theirs).
7. **Calm before busy.** Fire licks, it does not bite; a boat rides, it does not hop. When a motion looks nervous, slow it and blend it before adding more of it.
8. **Blend tone, never place.** Two looks may melt into each other only where they differ in tone (light on water, a glow). A thing that stands in another place in the next look shows twice in a blend, half see-through: cut it out and step it whole, or move it live.
9. **A live thing is of its picture.** It is drawn at the size of the pixels round it (blocks of two by two in the room) and in the tones of what it lies on or is lit by: a ring in the water's pale tone, a moth warm as its lamp. Pure white and a line one fine pixel thin are the two things that read as a fault on the picture.
10. **To move a painted thing:** paint the picture without it, paint it once more with it, cut it out by its owner number so it keeps its contour (`BoatPainter.blownParts`, `PortPainter.kelps`), say its kind (`flag`, `hang`, `weed`), and lay it with `blownAt`.

## Open

- TODO(painter, R3): the knoll's and the crossroads' grass and roses stand still; sway the near stems as `weed`-like things on the wind.
- TODO(painter, R3): the crossroads' window has no light of its own; the map's surf still melts between two painted looks (now in no set rhythm); the harbour's quay reflection and the docks' swell still step through looks.
- TODO(painter, R3): from art review 2, not about motion and so left as they are: the letters of Kiur's sleep are hard to see at night (the room shades them as it shades him); the knoll's fire at night is a flat sheet of orange with no flames standing in it; the docks lantern's light on the hut is shaped like flames; the docks' moon path is a wide field of single dots.
- IDEA(painter): the sea's colours cycle by palette rotation, which adds nothing to the build size.
- IDEA(painter): Kiur blinks while awake; a far boat crossing the map's sea; rain and snow as motes on the wind when the weather means something.
- NEEDS-HUMAN: look at the candidates above on the target laptop and say which stay.
