---
covers: ["src/config.ts", "src/main.ts", "src/debugSetup.ts", "src/game/BootScene.ts", "src/game/StaffDemoScene.ts", "src/spike/main.ts", "src/dev/"]
---
# URL switches

The game has no settings file for developers: behaviour is switched with query parameters on the page address, for
example `http://localhost:5173/?device=virtual&lang=en` (the part after `?`, joined with `&`). This is the one list of
them. They are read once when the page loads, mostly in `src/config.ts` (`createConfig`); reload the page after changing
one. "Dev only" means the switch is ignored in a production build (`npm run build`), because `import.meta.env.DEV` is
false there.

## The game (`index.html`)

| Switch | What it does | Dev only | Read in |
|---|---|---|---|
| `device=virtual` | Uses the virtual EZ-220 (a fake Web MIDI device in `src/io/mock/`) instead of real MIDI, and plays the keys it receives through the game's piano | no | `src/config.ts` |
| `monitor=1` | The game also sounds the keys of a real MIDI keyboard (by default it stays quiet, since the EZ-220 makes its own sound) | no | `src/config.ts` |
| `keys=1` | Shows the on-screen keyboard from the start, with or without a piano (it starts hidden since d099; the switch on the settings screen's toolbar shows it too) | no | `src/main.ts` |
| `lang=en` | Shows the English text instead of the default Estonian (ft_0_18); the end-to-end tests open the page with it | no | `src/config.ts` |
| `motion=still` | Stands the scenery still on its first frame: the grass, sea, clouds, smoke and embers of the painted places, the room's screensaver, an aura's pulse. Without it the scenery moves, whatever the operating system's reduce-motion or animation-effects setting says (d127) | no | `src/config.ts` |
| `beings=1` | Shows the beings in the scenes on Keri (ft_1_19.AC8); without it a scene is clean until the beings are overhauled | no | `src/config.ts` |
| `actors=1` | Stands the demo cast (Kiur talking, a template villager, a labelled placeholder box) on the first standing places of each adventure scene (ft_1_24, WP-05), and the characters on their scene (Puuvaim in the knoll tree; press one to talk, ft_1_22) | yes | `src/config.ts` |
| `learn=0` | Opens every piece for practice as before, with no learning bar by bar first (ft_1_32); the end-to-end tests open the page with it unless a test asks for `learn=1`. Autoplay never learns | no | `src/config.ts` |
| `editor=0` | Hides the piece editor (ft_1_02a) in the menu | no | `src/config.ts` |
| `anysize=1` | Plays in a window of any size: without it, a window too small for the tested layout at 2x (under 768x432 physical pixels, d105) shows only the line asking for a bigger window and F11 | yes | `src/config.ts` |
| `players=test` | A new install starts with four test players (TUVI, VINT, KIUR, PÄÄSU) instead of asking for the first player's name (ft_1_07.AC1); the end-to-end tests open every page with it | yes | `src/config.ts` |
| `loop=timer` | Steps the game's loop on a timer instead of on the browser's animation frames. The end-to-end tests open the game with it on a machine without a GPU (cloud sessions, Linux CI): there Chrome copies every frame drawn on an animation frame back from its software GPU before the page may go on, so each small save or load step waited a whole frame | yes | `src/config.ts` |
| `debug=1` | Keeps the built-in debug log (ft_Y_15): the last 500 screens, keys, presses, notes played, piece-maker edits and errors, copied to the tab's session storage so a reload keeps them; a small down-arrow button in the bottom-left corner saves them as `pianor-debug-<time>.txt`. Works in `npm run start:local`. Off, nothing listens and a log call is one test | no | `src/config.ts` |
| `intro=1`, `intro=0` | The first-run intro (ft_1_31): `1` plays it on the next visit to the room whatever the player has played (to show it again), `0` never (the end-to-end tests set it, as every test page starts with a new player). Without it a new player gets it once | no | `src/config.ts` |
| `autoplay=1` | The game plays itself from the menu to the results with a virtual player and an in-memory profile (ft_Y_09); `npm run demo` opens it | yes | `src/config.ts` |
| `scenario=<id>` | With `autoplay=1`: which scenario from `content/dev/scenarios.json` (`clean-wait` by default) | yes | `src/config.ts` |
| `piece=<id>`, `speed=<n>`, `seed=<n>` | With `autoplay=1`: override the scenario's piece, speed (Wait mode) and random seed | yes | `src/config.ts` |
| `demo=keys` | Input stack test page: plays a short piece in Wait mode and logs every key and judge event (add `device=virtual` to use the virtual EZ-220) | yes | `src/main.ts` |
| `demo=audio` | Sound, clock and metronome test page (the manual sound check in `docs/testing.md` section 8) | yes | `src/main.ts` |
| `demo=profile` | The active player's progress, with export and import as JSON (a backup, or a move to another device) | yes | `src/main.ts` |
| `demo=preview` | The piece review page (`npm run piece:preview` opens it): staff, lint output, listen, play along, approve | yes | `src/main.ts` |
| `demo=analyse` | Score MusicXML files (`.musicxml`, `.xml`, `.mxl`) for difficulty, easiest first, with what the reader simplified and the difficulty panel per file; learned models from `private/models/` show as columns (ft_Y_04 slice 1, core_08) | yes | `src/main.ts` |
| `demo=staff` | The staff renderer on its own, piece by piece (switches below) | yes | `src/game/BootScene.ts` |
| `sky=dawn\|day\|dusk\|night` | Forces the hour of the sky (ft_1_14, d097) instead of the real sun over Keri: for the painted room, map of Keri and scenes, which each have one picture for every hour (d111) | yes | `src/config.ts` |
| `wind=0..3` or `wind=calm\|waves\|restless\|stormy` | Forces the wind over Keri's scenery (ft_1_06 AC12): in the knoll the grass, the sea, the clouds and the smoke follow it, on the map the clouds; without it each day has its own wind | yes | `src/config.ts` |
| `now=<ISO time>` | Sets the instant the sky phase is worked out from (an ISO date and time in UTC), for screenshots and tests (ft_1_14); the room also takes today from it for Kiur's reminders and the teacher's check-up (ft_1_27) | yes | `src/config.ts` |
| `demo=art` | The pixel font, Kiur, the icons, buttons and bars at this screen's zoom (`docs/sprites.md`) | yes | `src/game/BootScene.ts` |

With `demo=staff`, `src/game/StaffDemoScene.ts` also reads `piece=<n>` (the nth piece, from 1), `hints=n`, `f` or `nf`
(note names, finger numbers), `vw=<px>&vh=<px>` (lay out for a screen of that size) and `zoom=<n>&cx=<px>&cy=<px>`
(look closely at one region).

## The hardware spike page (`spike.html`)

| Switch | What it does | Read in |
|---|---|---|
| `device=virtual` | Runs the page against the simulated EZ-220 | `src/spike/main.ts` |
| `clicks=<n>` | Number of clicks in the tap test (4 to 64, default 16) | `src/spike/main.ts` |

## Adding a switch

Read it in `createConfig` (`src/config.ts`) into `AppConfig.flags` and test it in `src/config.test.ts`, rather than
calling `URLSearchParams` in a scene: one place keeps this list easy to keep true. A switch that only helps developers is
gated with `dev`. Then add its row here.
