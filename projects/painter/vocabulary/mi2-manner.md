# What makes a picture MI2: measured

The front page of the MI2 atlas (study-a-picture section 9). Numbers come from `refcat.py baseline` over 80 of the 93 VGA backgrounds of the 1991 game (close-ups, maps, cut scenes and screenshots left out), kept in [mi2-gauge.json](mi2-gauge.json). Each is MI2's range from the 10th to the 90th percentile, at its own pixel size (320 wide). The subject pages hold the lessons per thing; this page holds what is true everywhere.

| Trait | MI2 1991 (10% to 90%) | Our passes | What it means |
|---|---|---|---|
| Colours in a picture | 119 to 175 | 60 to 90 outdoors | every material is a long run of near tones |
| Colours per hue family | 17 to 28 | 7 to 11 | five or six tones of one green is not enough; MI2 has twenty |
| Lightness step between unlike neighbours | 4.2 to 9.5 L* (median 6.7) | 4 to 7.6 | ours is already in range |
| Pixels unlike all four neighbours (paint grain) | 21% to 44% | 17% to 22% (much of it our dither) | see 1 |
| 2 x 2 checkerboards | 0.7% to 1.9% | 7.6% to 12% | see 1 |
| Very dark pixels (L* under 25), day outdoors | 27% to 44% | 1% to 6% | see 2 |
| Median lightness, day outdoors | L* 38 | L* 60 to 71 | see 2 |
| Run of one colour along a row | 0.9 to 2.1 (in 1/320 of the width) | 0.8 to 1.4 | ours is in range: painting at 640 wide does not make our marks smaller on screen |
| Median saturation | 0.35 to 0.83 | 0.44 to 0.68 | in range |

## 1. Scanned paint, not placed pixels
MI2's backgrounds were painted by hand and scanned down to 256 colours. Every area is a grain of three to six near tones, a third of the pixels differing from all four neighbours, with runs of one colour only 1.3 to 3 pixels long. There is almost no ordered dither: the checkerboard share is about a tenth of ours. A gradient (sky, sea, a lit wall) is laid as a noisy scatter of neighbouring tones, often in short horizontal dashes, never as a Bayer pattern. (Swatches sea-1, sea-6, sky-1, sky-5, grass-3.)
- IDEA(painter): a "grain" brush in `paint/`: for each area pick among 3 to 5 neighbouring tones of its run with a seeded noise biased by the light, instead of ordered dither between two. Then check `lone` and `dither` with `refcat.py gauge`.

## 2. Darker and richer, even by day
An MI2 day outdoors has its median at L* 38 and a third of its pixels under L* 25. The light is in a few lit planes (a cliff top, a sandy path, a sunlit wall); everything else is deep, saturated mid-dark. In 80% of day rooms the left or right edge is darker than the middle, and in 80% the bottom fifth is too: dark wings and a dark foreground frame the lit middle ([light.md](light.md)). Ours are pale all over (median L* 60 to 71, edges as light as the middle).
- IDEA(painter): before repainting a day scene, set its value plan first: a dark foreground band and dark wings, the lit area in the middle third, then colour.
- TODO(painter, R2): ask the architect whether `KERI_HOURS` in `keriPalette.ts` should lift the night and darken the day's shadows for every scene; the docks thread found the night multiplier [0.22, 0.31, 0.5] keeps every night under MI2's light spread (60 to 77 L*; the docks reach 35) whatever the scene does.

## 3. Long runs per hue
MI2 has 17 to 28 colours in each of its fullest hue families; we have 7 to 11. With the grain of point 1 the extra tones come almost for free: they are what makes the scatter read as paint.
