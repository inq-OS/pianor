---
id: "ft_1_14"
title: "The sky follows the real day"
scope: "The painted room, the map of Keri and its scenes show dawn, day, dusk or night from the sun's real height over Keri, computed offline from the PC clock (first built for the campaign trail, removed by d117); one alternate palette per phase for the sky, cloud, moon and halo ramps; the room's window shows a sea view in the same phase; a look resolver that seasons and holidays (ft_Y_14) later extend"
effort: "medium"
status: "in progress: MVP slice built (sun, phase, look, palettes, room window); polish slice (R3) open"
completeness: 80
depends_on: ["ft_1_06"]
---
# ft_1_14: The sky follows the real day

Index: [FEATURES.md](FEATURES.md). decision [d097](../decisions/art.md#d097).

The painted room, the map of Keri and its scenes show the real time of day on Keri: a pale dawn, a blue day with a sun, an orange dusk, and night. In a Keri winter the day is short (sunset at 13 h 17 min UTC at the winter solstice). The trail this was first built for is gone (d117); each picture has one version per phase (ft_1_19.AC5).

## Rules

1. **Sun** (`src/core/sky/sun.ts`): the sun's elevation from a UTC instant and a place (NOAA low-precision formulas, about one minute of error). No dependency, no network. Time zone and summer time play no part; only a wrong PC clock gives a wrong sky.
2. **Phase** (`src/core/sky/skyPhase.ts`): `night` below -6 degrees, `dawn` or `dusk` from -6 to +3 (dawn while the sun rises), `day` above +3. Place (Keri's lighthouse, 59.698722 N, 25.0227421 E, `KERI`) and thresholds are one options object with these defaults.
3. **Look** (`src/core/sky/sceneLook.ts`): `sceneLook(instant, options)` returns `{ phase, season: null, weather: null, holidays: [] }`. Scenes read only this, so ft_Y_14 (seasons, weather, holidays) fills the rest without rewiring.
4. **Palettes** (`src/game/ui/pixel/sky/skyLooks.ts`): dawn, day and dusk each replace the four sky ramps of the night palette (sky 4, cloud 5, moon 3, halo 3), same lengths and dark-to-light order; night is the base palette. `paletteFor(look)` returns the full palette. Colours below are mock values (AX-3 provisional).
5. **Flags per phase** (polish slice, R3, not built): stars and specks off in day (built), faint (half) at dawn and dusk; in dawn, day and dusk the moon is drawn in the sun colours without craters; a campfire glow only at dusk and night.
6. **When it changes:** the phase is decided when a scene opens and does not change while it is open (AX-3 provisional).
7. **Dev switches:** `?sky=dawn|day|dusk|night` forces a phase (built); `?now=<ISO time>` sets the instant (polish slice); `docs/url-switches.md`. Nothing is saved.
8. **The room's window** shows the sea view in the same phase: sky, sun or moon, a cloud or two, the sea with a horizon and a strip of far shore, nothing from the campaign (`outside` in `src/game/ui/pixel/keri/roomSet.ts`, d111); the whole room is lit for the phase (daylight by day, lamps and fire from dusk to dawn). Same sky, cloud, moon and halo slots as item 4; stars only where item 5 allows.
9. **Polish slice (R3):** item 5 in full, `?now=`, one end-to-end screenshot per phase (Windows baselines from the workflow).
10. No save change, no new dependency. Not in this feature: seasons, weather, holidays, a fade between phases, the sun moving across the sky, a place other than Keri in settings.

## Acceptance criteria

- **ft_1_14.AC1** The computed sunrise and sunset (elevation -0.833 degrees) for Keri are within 3 minutes of the reference, in UTC: on the first of November, 5 h 41 min and 14 h 26 min; at the winter solstice, 7 h 19 min and 13 h 17 min; at the summer solstice, 1 h 00 min and 19 h 45 min. The builder checks these values against the NOAA solar calculator before writing the test.
- **ft_1_14.AC2** The phase is night below -6 degrees, dawn or dusk from -6 to +3 degrees by the direction of the sun, and day above +3 degrees; on Keri on the first of November it is night before 4 h 56 min UTC, dawn to 6 h 17 min, day to 13 h 50 min, dusk to 15 h 11 min, night after (within 3 minutes).
- **ft_1_14.AC3** The result depends only on the instant: the same instant gives the same phase whatever the computer's time zone.
- **ft_1_14.AC4** Retired (d117): the campaign map drew its sky in the phase's colours; the pictures of Keri are painted for each phase instead (d111).
- **ft_1_14.AC5** In every phase the stars keep the contrast the art tests ask of them against the phase's sky.
- **ft_1_14.AC6** `?sky=` and `?now=` set the phase and the instant; nothing is saved.
- **ft_1_14.AC8** The room's window shows a sea view (sky, sun or moon, sea, far shore) in the same phase as the map of Keri and its scenes, with nothing from the campaign in it, and the same `?sky=` switch sets it.
- **ft_1_14.AC7** The four phases look calm and right on the target laptop, in the room, on the map and in the scenes. [human]

## Phase colours (mock values, dark to light)

| Ramp | Dawn | Day | Dusk |
|---|---|---|---|
| sky (4) | 1e2a5a 3a4a80 8a7aa8 f0b8a8 | 3a7fd0 5a9de0 86c0ee b8def8 | 1a1840 3a2458 7a3a5e e0704a |
| cloud (5) | 2a3060 5a6090 a090b8 e8c0d0 fff0f0 | 4a6a9a 9ab0d0 cfdcec eef4fb ffffff | 2a1838 52304e 8e4a5e d8786a f4b08a |
| moon, as sun (3) | f0a070 ffd0a0 fff0d0 | e8a820 ffd040 fff0a0 | c2402a e8642e ffa050 |
| halo (3) | 9a7aa8 b896b4 d8b4bc | 6aa8e6 8cbcee b0d4f4 | 8a3a5a a8485a c45a58 |

## TODO

Work tags ([todo-tags.md](../automation/todo-tags.md)); the closed issue in brackets keeps the earlier discussion.

- TODO(builder, R3): a per-player setting that locks the sky to one time of day (follow the real time by default, or dawn, day, dusk or night), as a new row on the Settings screen below its rows; the forced phase goes through the one `sceneLook` seam (`src/core/sky/`), like the `?sky=` switch; a profile field joins the next shared save bump (d069). The point is that a player may like how one time of day looks and keep it.

- TODO(builder, R2): the Keri sunrise and sunset references in `src/core/sky/sun.test.ts` (AC1) were computed from the code, not read from the NOAA solar calculator; check one date against NOAA and fix the references if they differ.
