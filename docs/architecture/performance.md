# Build and performance check

A review of the production build, the dependencies, start-up, the per-frame work in the scenes and the
path from a MIDI key to the judge and the piano sound. Measured in a Linux cloud container with the virtual EZ-220; nothing
here was measured on the real keyboard or the target tablet (that part needs a human).

## In one paragraph

The hot paths are in good shape. A key press goes from `MIDIMessageEvent` to the judge in one synchronous call chain,
with the event's own timestamp moved onto the audio clock, so frame rate never adds latency to judging. The per-frame work
is one playhead line in Tempo mode and nothing at all in Wait mode. The cost is at start: Phaser is 83% of the shipped
JavaScript. Dependencies have no known vulnerabilities and are at most a patch behind. In C/C++ terms: the ISR is short
and timestamped at the source, the main loop is idle, and the image is mostly the vendor library.

## Build output

`npm run build` on main before this change:

| Chunk | Size | Gzipped | What it is |
| --- | --- | --- | --- |
| `main` | 1,653 kB | 433 kB | Phaser (1,341 kB) and the game (272 kB) |
| `VirtualEz220` | 104 kB | 31 kB | zod (89 kB) and the virtual keyboard, shared with the spike page |
| `spike` | 21 kB | 8 kB | the hardware spike page |
| piano samples | 1.4 MB | (mp3) | 21 Salamander samples, fetched in parallel after start |

Sizes per source come from the build's source map (a script that sums mapped bytes per file; not committed).

## Fixed in the build and performance pull request

- **Phaser in its own chunk.** `vite.config.ts` puts `node_modules/phaser` into a `phaser` chunk. The game chunk is now
  279 kB (76 kB gzipped) and changes with every deploy; the Phaser chunk (1,374 kB, 357 kB gzipped) changes only with a
  Phaser update and stays in the browser cache. The first load is the same size.
- **The chunk-size warning means something again.** It fired on every build because of Phaser. The limit is now 1,400 kB,
  just above Phaser, so it fires when a chunk grows past that.
- **The config-loader warning is gone.** Every `vite` start printed that `src/core/chart/migrate.ts` imported
  `../issues` without an extension, which the native config loader planned for a future Vite will not accept (the
  config imports `tools/vite-pieces.ts`, which reaches that file). The import now names `../issues.ts`.
- `build.rollupOptions` became `build.rolldownOptions`, the Vite 8 name (the old one is an alias).

## Proposals and issues

- **Draft pieces ship in production.** All 17 drafts and the four dev sample charts are in the production
  bundle, hidden by `offeredPieces` but readable and about 60 kB. Leave them out of a build, keeping their ids reserved.
  **Done:** `virtual:pieces` leaves drafts out of a build and exports their ids as `omittedIds`; the dev samples and the
  dev pages sit behind `import.meta.env.DEV`. The main chunk went from 289 kB to 226 kB.
- **Phaser's size.** The prebuilt `phaser.esm.js` cannot be tree-shaken, so physics,
  tilemaps and the rest ship. Recommendation: measure time to menu on the target tablet first (ft_0_14), then decide
  between leaving it and a custom Phaser build.
- **Start-up order is a hidden dependency.** `main.ts` loads the editor's own pieces, calls `setOwnPieces`, and only then
  creates the profile service, whose `catalogue` reads `loadPieces()`, a function that reads that module-level list. The
  two awaits look independent and a `Promise.all` would quietly drop own pieces from unlock checks. Better: pass own
  pieces into `createProfileService` instead of through a module variable. Not filed: no bug today, and both awaits read
  local storage, so there is no time to win. **Done:** `createProfileService` takes the `PieceCatalogue`.
- **zod is in every page.** It is 89 kB (most of a 31 kB gzipped chunk) and only checks loaded data. Fine for now; if size matters later,
  validated content can be checked at build time and the game can trust the compiled JSON.
- **Offline and install (ft_0_14).** There is no web app manifest or service worker yet, so the game needs the network on
  every start and the 1.4 MB of samples are fetched each time the browser cache drops them. ft_0_14 covers it.

## Dependencies

- `npm audit`: 0 vulnerabilities.
- `npm outdated`: patch releases only (`vite` 8.3.4, `vitest` and `@vitest/coverage-v8` 5.0.5, `zod` 4.6.7,
  `@playwright/test` 1.64.1, `typescript-eslint` 8.71.2, `@types/node`). TypeScript 7 (the native compiler) is out; moving
  to it is a stack decision for the architect, not a patch. Package changes are merged by the maintainer, so none are in this PR.
- Unused dependencies: none (`npm run analyze:unused`, knip, passes).

## Hot paths, read and judged

- **MIDI in** (`src/io/midi/WebMidiKeyboard.ts`, `parse.ts`): one handler per input, no allocation beyond the
  `NoteEvent`, active sensing and clock bytes dropped at the first check. Time is `event.timeStamp` moved to the audio
  clock (`clock.fromDomTime`), not the time the handler ran, so a late frame does not make a note late.
- **Judge and view**: the controller judges inside the event; the scene redraws the notes' Graphics once per judged note
  (`StaffView.applyProgress`), not per frame. A text change makes a new small texture and frees the old one
  (`PixelImage.setBitmap`), and `PixelText.setText` skips unchanged text.
- **Per frame** (`PracticeScene.update`): returns at once in Wait mode. In Tempo mode it advances the clock, moves the
  playhead (one cleared and redrawn line) and turns the page only when the page changes.
- **Sound**: samples load in parallel; a note picks the nearest of 21 samples (a loop of 21, negligible). The
  `AudioContext` uses `latencyHint: 'interactive'`.
- **Metronome** (`src/io/audio/Metronome.ts`): a look-ahead scheduler on the audio clock, the standard pattern.

Not checked: real frame times on the tablet, the EZ-220's own MIDI latency (ft_0_01 spike), and memory over a long
session (a heap snapshot after an hour of play would show texture leaks if any). All three need a human or the device.

## TODO

Work tags ([todo-tags.md](../automation/todo-tags.md)); the closed issue in brackets keeps the earlier discussion.

- TODO(builder, R5): a small static splash in `index.html`, a title and a "loading" line shown before Phaser parses (no Phaser, no dependency).
- NEEDS-HUMAN: the cold time to the menu on a modest laptop at 1920x1080. A trimmed Phaser build is reconsidered only if it is over about 3 seconds. The painted pictures now weigh far more than Phaser (6.6 MB of a 7.1 MB game file), so measure with them; since d143 they load per picture and hour, and the game's own file is 0.63 MB.
