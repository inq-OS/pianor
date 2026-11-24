---
id: "ft_Y_14"
title: "Seasonal and holiday looks"
scope: "Keri's scenes change with the season (winter snow, autumn leaves, summer), on holidays (Christmas, Halloween, jaanipäev and others) and, when the laptop is online, with the weather on Keri (rain, cloud, snow, blizzard, frost), by layers on top of the day phase of ft_1_14; nothing saved"
effort: "medium"
status: "idea, Later pool; hook designed in d097"
completeness: 0
depends_on: ["ft_1_14"]
---
# ft_Y_14: Seasonal and holiday looks

Later pool. Hook: [d097](../decisions/art.md#d097). Index: [FEATURES.md](FEATURES.md).

## Rules (planned)

- `sceneLook()` of [ft_1_14](ft_1_14-sky-follows-the-day.md) returns a `season` (from the date; for Keri, snow from December to March by default) and the `holidays` whose date range holds the day (Christmas, Halloween, jaanipäev, Easter computed, the student's own dates later). The ranges are content data, not code.
- **Layers, always in this order:** the base palette, then the day phase (ft_1_14), then the season's ramp overrides (snow on the shore and roofs, autumn colours), then holiday props: small extra sprites at named anchors of a scene's plan (a pumpkin by a hut, lights on the warden's porch, a bonfire for jaanipäev). Nothing is drawn on the staff or in front of notes.
- **Weather:** `sceneLook` also returns `weather` (`clear`, `cloudy`, `rain`, `snow`, `blizzard`, `fog`, `frost`), drawn as a layer between the season and the holiday props: grey cloud ramps, rain or snow particles, white frost on the shore. The game must keep working with no internet (d068), so the weather is optional: the browser asks a free, keyless service (Open-Meteo, data CC BY 4.0, credited in `docs/assets.md`) for Keri's current weather code at most once an hour, keeps the last answer for a few hours, and falls back to `clear` when offline. Only Keri's fixed position leaves the machine, never anything about the player. Needs its own decision file (the first network call in the game) and the `?weather=` dev switch for tests.
- **AX-0 first:** before props, weigh a holiday suggesting a seasonal public-domain piece (carols in December) in the piece list; the look is the sugar (AX-2: stimulation may be added, so this can grow later).

## Open before planning

No acceptance criteria until planned. Which seasons and holidays, the art for each (free packs first, `use-free-art-packs`), and whether the student can turn them off.

## TODO

Work tags ([todo-tags.md](../automation/todo-tags.md)).

- IDEA(builder, Later): seasons, holidays and later local weather as layers of `sceneLook`, as this file describes, for Keri's scenes. Weather from the network needs its own decision file first (the game's first network call, d068).
- IDEA(builder, Later): the seam the painter's motion kit left for the weather (art-direction rule 17): the kit needs two numbers, the wind (already in `SceneLook`) and a cloud cover 0 to 1, today picked from the day's number in `src/game/ui/pixel/windMotion.ts` (AX-3 provisional). When the weather is planned, the cover joins `SceneLook` in `src/core/sky` so the real weather sets both (architect); overcast and rain also want their own cloud pictures, which the maintainer sees first. Motion stays an art rule, not an acceptance criterion: what moves is the look, and a criterion names only what the student can do or see happen.
