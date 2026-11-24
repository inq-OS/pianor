---
title: "Decisions: Stack and code"
---
# Decisions: Stack and code

Platform, libraries, build, hosting, performance and code structure. One entry per decision, oldest first. Index: [DECISIONS.md](DECISIONS.md).

## d001

**The game is a browser app on Web MIDI, Chrome or Edge only.** Features: ft_0_00, ft_0_01.

Web MIDI gives input and output (key lighting), runs on laptop and Android tablet, and needs no install. Changed by d007 (Phaser 4, not 3).

Check: untestable: platform choice (Chrome or Edge only); real Web MIDI needs a human on the EZ-220 (`docs/hardware-notes.md`)

## d007

**The game runs on Phaser 4.** Features: ft_0_00. Supersedes d001 (the Phaser 3 part).

Phaser 4.x (MIT) was npm `latest` at scaffold time; Phaser stays confined to `src/game`, so a switch only touches that folder. Check v4 docs, not Phaser 3 tutorials.

Check: `eslint.config.js` "src/core must not import Phaser."; `eslint.config.js` "src/io must not import Phaser."

## d008

**TypeScript 6 strict, Vite 8, Vitest 5, ESLint 10 flat config, with import boundaries as lint rules.** Features: ft_0_00.

TypeScript adds `noUncheckedIndexedAccess` and `exactOptionalPropertyTypes`. `src/core` may not import Phaser, io, game, tools or DOM/Web MIDI/Web Audio globals; `src/game` may not import io implementations. The canvas size is set by d105 and d110.

Check: `tsconfig.json` "noUncheckedIndexedAccess"; `tsconfig.json` "exactOptionalPropertyTypes"; `eslint.config.js` "src/core must not import io, game or tools."; `eslint.config.js` "src/game may import io interfaces only, not implementations."

## d065

**Flags and the piece catalogue reach scenes through `GameContext`; a production build ships approved pieces only.** Features: none.

`src/config.ts` is the one config object and only code reading the page address; `src/main.ts` copies flags into `GameContext.flags` and lint keeps `src/game` from importing root files or reading `location`. `PieceCatalogue` (`src/game/pieceCatalogue.ts`) in `GameContext.pieces` replaces the module piece functions; `virtual:pieces` omits unapproved pieces in a build, keeps their ids reserved (`omittedIds`, `bundledIds`), and dev pages sit behind `import.meta.env.DEV`.

Check: `tools/vite-pieces.test.ts` "a production build leaves out the drafts and lists their ids"; `src/game/pieceCatalogue.test.ts` "still reserves the ids of the pieces the build left out, and those of the dev samples"; `src/game/pieceCatalogue.test.ts` "offers drafts and the dev samples only when built to show drafts"; `src/config.test.ts` "is off in a production build, whatever the address says"

## d068

**Pianor is never hosted: it runs locally, every third-party part is FOSS-licensed, laptops are the target.** Features: ft_0_14.

It runs on the player's own machine or local network; no server of the project serves it, and a release is a zip the player downloads (d240). Code licences MIT, BSD, ISC, Apache-2.0 or MPL-2.0 (GPL-family only if Pianor becomes GPL; its code is MIT); assets CC0, CC-BY or CC-BY-SA credited in `docs/assets.md`; never NC, ND or personal-use licences. Target is a modest laptop at 1920x1080 (1366x768 minimum) in Chrome or Edge, served from `localhost` (a secure context for Web MIDI); PWA install and offline cache wait for tablet support.

Check: untestable: licence and hosting policy (nothing deployed, FOSS-only parts), checked by the maintainer and by review; `tools/start-local/browser.test.ts` covers only the local window

## d070

**Scene flow: screens are modules, start switches, overlays push and return a typed result, input goes through intents.** Features: ft_Y_13.

A screen is one scene class plus its `src/game/<area>/` folder; screens meet only through `src/game/scenes.ts` and `GameContext`. `startScene` switches mode; an overlay (dialog, pause, confirmation) is pushed with `openOverlay(key, data)`, which pauses the caller and resolves with a typed `SceneResult` or `cancelled` (Esc and Back). Screens react to intents (`up`, `down`, `left`, `right`, `confirm`, `back`), so piano keys can drive them later; rules stay in `src/core`.

Check: `src/game/scenes.test.ts` "ft_1_15.AC3 launches the overlay, pauses the caller, and resolves with the result once the caller is resumed"; `src/game/scenes.test.ts` "ft_1_15.AC3 resolves cancelled when the overlay goes away without a choice (Esc, shutdown)"

## d077

**The pure piece compiler and linter live in src/core/piece; tools/piece keeps the CLIs and file access.** Features: ft_0_03, ft_0_04, core_08, ft_1_02b.

`abc.ts`, `compile.ts`, `lintRules.ts`, `difficulty.ts`, `diagnostics.ts`, `levelsTable.ts`, `status.ts` and `check.ts` are in `src/core/piece/`, under core's rules (no Phaser, DOM, io, game, tools or Node APIs) and coverage gate. Core reads no content files: callers pass the closed style list (`contentStyles` from `tools/piece/styles.ts`, `pieceStyles` from `src/game/menu/pieceStyles.ts`) and the level table. `tools/piece/` keeps the CLIs (`build.ts`, `lint.ts`), file access, the preview server API and the disk-reading tests; the browser already runs the compiler (editor, preview page).

Check: `eslint.config.js` "src/core is pure: no Node APIs. File access belongs in tools/ (the piece CLIs) or src/io."; `eslint.config.js` "src/core must stay pure: no DOM, Web MIDI or Web Audio."

## d105

**A browser window plays; the size line shows only when the window cannot hold the tested layout.** Features: ft_0_13, ft_0_14.

One tested size: the full screen of a modest laptop at 1920x1080, 1536x864 CSS pixels at `devicePixelRatio` 1.25 (1920x1080 physical); fit, layout and screenshot tests run only there, plus a guard spec at small windows. Every screen is laid out for at least the tested art area (`FRAME_MIN`, `src/core/layout/frame.ts`) at the largest whole zoom that fits; the one-line guard, string key `screen.tooSmall` ("TEE MIND SUUREMAKS + F11!"), shows only when the window cannot hold that area at 2x (`frameFits`). `npm run start:local` opens full screen; `?anysize=1` turns the guard off. Changed by d110 (the area is 320 x 180 layout cells, the guard needs the 640 x 360 canvas at 1x).

Check: `src/core/layout/frame.test.ts` "gives every window at least the layout area of a 1920x1080 full screen, 320 x 180 cells, by a smaller zoom (d105, d110)"; `src/core/layout/frame.test.ts` "plays in any window that holds the art canvas at 1x (2x per cell) or more"; `tests/e2e/screen-guard.spec.ts` "a window too small to play in shows only the line asking for F11, and the game waits until it is big again"; `tests/e2e/screen-guard.spec.ts` "?anysize=1 lets a developer play in a window of any size"; `tools/start-local/browser.test.ts` "opens the game as its own full-screen app window with its own profile"

## d127

**The scenery moves whatever the operating system says; only the game's own switch stands it still.** Features: ft_1_08, ft_1_17, ft_1_19.

The game no longer reads `prefers-reduced-motion`; `motionAllowed()` (`src/game/motion.ts`) is true unless `config.theme.reducedMotion` is set by the page switch `?motion=still` (also in a production build, handed over once by `setSceneryStill` in `src/main.ts`), and then the first frame shows. AX-3 provisional: a player who needs less motion gets a per-player saved setting later, not the system's switch. Why: an operating system's reduced-motion setting can be on for reasons other than the player's need, which froze the scenery.

Check: `src/game/motion.test.ts` "moves by default, whatever the operating system says about motion (d127)"; `src/game/motion.test.ts` "stands still only when the game is told to"

## d137

**Scenes are `SceneData` files run by one `AdventureScene` on a world base scene, with actors, scripts and map walkers.** Features: ft_1_24, ft_1_19.

A scene is a `SceneData` file (picture, hotspots, standing places, exits, music tie); `AdventureScene` runs any of them, so a new scene is content plus a picture. It sits on a world base scene with sprites at the fine grid (d110), not `PixelScene`'s full redraw, because actors animate. Actors are `ActorDef`s (idle, talk, play, listen, walk; no art means a labelled box), short moments are `Script`s run by a pure interpreter, and pathfinding is A* over the world model's path graph on the map only (nobody walks inside a scene in the MVP). Pictures and actors load with their scene.

Check: `src/core/scene/actorRuntime.test.ts` "ft_1_24.AC3 a missing state falls back to idle"; `src/core/scene/actorRuntime.test.ts` "ft_1_24.AC3 takes exactly one of a sheet and a template"; `src/core/scene/scriptRunner.test.ts` "ft_1_24.AC6 walks an actor to a place at the walking speed, in the walk state, scale growing on the way"

## d143

**Painted pictures load per picture and hour when a scene shows them, as packed text in their own files.** Features: ft_1_24.

`virtual:keri-pictures` (`tools/vite-keri.ts`) is a table of loaders; each picture at each hour is its own module `virtual:keri-pictures/<picture>-<hour>`, built into its own file. `src/game/ui/pixel/keri/keriPictures.ts` loads on first ask (`loadedOnce` in `pack.ts`) and a scene asks with `PixelScene.loaded`, showing a three-dot loading view meanwhile; the main menu preloads the room at the current hour. Packed text stays over PNG (within 1 % on the wire, no canvas needed, one format); this cut the game file from 8.07 MB to 0.63 MB.

Check: `src/game/ui/pixel/pack.test.ts` "ft_1_18.AC3 every picture comes back as it went in: nothing, one pixel, noise, long runs and far repeats"; `src/game/ui/pixel/pack.test.ts` "ft_1_24.AC7 a picture is not there until it is loaded, then unpacked once and the same one after"

## d238

**A dependency is added only when the platform API cannot do the job, with a permissive licence and a row in `docs/dependencies.md` giving the reason; MIDI stays the raw Web MIDI API with no wrapper library.** Features: none.

MIT, BSD or Apache preferred, GPL only if the project were GPL (CLAUDE.md Stack and Working agreements, d006, d068).

Check: untestable: a review rule for dependencies, checked against docs/dependencies.md by the reviewer and the maintainer

## d239

**Content (pieces, characters, conversations, the curriculum, rules) is JSON or ABC data in `content/`, validated by zod schemas, and adding content needs no engine code change.** Features: none.

Thin engine, fat data (`docs/futureproofing.md` section 3, CLAUDE.md Architecture rules); each content file is parsed by its schema in a test.

Check: `src/core/progression/modifiers.test.ts` "loads and validates the shipped table"; `src/core/exchange/tug.test.ts` "content/challenge/rules.json parses and holds the defaults"; `tools/piece/compile.test.ts` "builds every piece into <id>.chart.json that the game can load"

## d240

**A release is a Windows zip made from a clean clone with no `private/` folder, holding the production build with approved pieces only and no personal data; the maintainer publishes it.** Features: ft_0_14.

`bash tools/release/pack.sh <version>` refuses where `private/` exists; the zip carries nothing from `private/` and no saves, a new install makes no player, the launcher is started once on Windows by a person, and the GitHub release is made as a draft (`docs/release.md`).

Check: `tools/release/pack.test.ts` "refuses a checkout with a private folder and builds without private pieces"; `tools/release/pack.test.ts` "leaves out the hardware check page and its script, and packs with zip or PowerShell"
