# Light and value

## Where MI2 keeps its darks (all 93 VGA backgrounds, measured with refcat.py)
- **Day outdoors (15 rooms, wide ones left out):** median lightness L* 38. Very dark pixels (under L* 25): left edge 42%, right edge 43%, middle 34%, bottom fifth 40%, top fifth 28%. In 80% of rooms a side edge is darker than the middle, and in 80% the bottom is too.
- **Night outdoors (7 rooms):** median L* 27, top fifth 63% very dark (the night sky), every room has a darker side edge.
- So the lit thing sits in the middle, framed by dark wings and a dark foreground, even at noon.
- Ours: docks day median L* 64, crossroads day 60, garden day 71; their edges are as light as their middles (very dark: 0 to 16%). Docks night: median L* 20, 77% very dark in the middle and no lit planes.
- IDEA(painter): set a day scene's values before its colours: dark wings, a dark near band, the light in the middle third.

## Calibration
- Calibration: A 40%, B 60%, C 35% too dark, D 10% (A docks day pass 5, B crossroads day pass 4, C docks night pass 5, D garden day preview 2).
- The docks night reads too dark, which agrees with the gauge (night light spread 35 L* against MI2's 60 to 77).
- The gauge, fitted to these four plus four MI2 rooms at 100, gives 35, 43, 41 and 24: the same order for the two days at the ends, within about 15 points. What it misses (the crossroads at 60) is likely shape and quirk, which it does not count: the maintainer's eye outranks it.

## How much of a night is warm (measured; `find --tags woodtick,outdoor`, `find --tags light,night`)
- Share of pixels that are saturated, light and redder than blue: Woodtick's lamp-lit deck (mi2-bg-0-014) 22%, the whole town (mi2-bg-0-007) 7%, the night street (mi2-bg-4-089) 7%, Scabb's beach with its far fire (mi2-bg-0-004) 5%, the campfire close up (mi2-bg-0-005) 43%; the lonely jetty (mi2-bg-0-023) 0.2%.
- A lamp lights whole planes: the face toward it orange to yellow, the face round the corner navy, near-black right beside the warm; a pale halo in the air round the flame; lit windows as flat yellow-over-orange blocks; warm streaks on the water under the town.
- Ours at night: docks 0.4%, knoll 0.8%, crossroads 0.1%. Light and heat follow the docks, checked against the atlas, Woodtick above all. Recipe in [artists-notes/light-and-heat.md](../artists-notes/light-and-heat.md).

