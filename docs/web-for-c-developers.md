---
covers: ["src/main.ts", "src/compose.ts", "src/io/", "src/game/practice/PracticeController.ts", "src/core/judge/", "package.json"]
---
# Pianor for a C/C++ developer

A map of this web project in terms a C or C++ developer already knows (firmware included): what each tool is, where code runs, and
how one key press travels from the keyboard to the screen. The rules themselves are in `CLAUDE.md` and
`docs/architecture.md`; this page only orients.

## The toolchain, translated

| Here | Closest C/C++ equivalent | What it does in this repo |
|---|---|---|
| Node.js (22.12 or newer) | The host toolchain | Runs the build, the tests and the `tools/` scripts on your PC. The game itself runs in the browser, not in Node |
| `npm`, `package.json`, `package-lock.json` | A package manager plus a pinned manifest (like a west manifest or a vendored SDK version) | `npm ci` installs exactly the versions in the lock file into `node_modules/` (never committed). The `scripts` section of `package.json` is the list of `npm run <name>` commands, like make targets |
| TypeScript (`tsc`, `npm run typecheck`) | The compiler's type checking, with `-Wall -Werror` | Types exist only at build time; the browser runs plain JavaScript. Strict mode is on, so a type error fails the build |
| Vite (`npm run dev`, `npm run build`) | The build system and linker | `npm run dev` serves the source to the browser and reloads it on save (no flash step); `npm run build` bundles everything into `dist/`, the "firmware image" a web server hosts |
| `tools/vite-pieces.ts` | A build step that converts resources into C arrays | Compiles every piece in `content/pieces/` (ABC text) into chart JSON at build time and hands it to the game as the module `virtual:pieces` |
| `tools/vite-keri.ts` | A build step that renders graphics into ROM tables | Paints the warden's room, the map of Keri and the scenes for each hour of the sky when the game is built (d111) and hands them to the game as the module `virtual:keri-pictures`, one file per picture and hour loaded when a scene shows it, like overlays paged in from flash (d143); the result is kept in `node_modules/.cache/pianor-keri` until the art's code or `content/world/keri.json` changes. `npm run art:render` paints one of them to a PNG file to look at |
| ESLint (`npm run lint`), `npm run analyze` | MISRA checker, Klocwork, cppcheck | Style, layer boundaries (who may import what) and deeper checks; see `docs/architecture/static-analysis.md` |
| Vitest (`npm test`) | Unit tests on the host (Unity, GoogleTest) | Runs `*.test.ts` in Node, without a browser, in about a minute |
| Playwright (`npm run test:e2e`) | Hardware-in-the-loop tests, with a simulator instead of the board | Starts a real Chromium, opens the game and plays it through the virtual EZ-220 |
| zod schemas | A packed-struct definition plus a validator | Checks every JSON file (pieces, saves, content) as it is loaded, and gives a readable error instead of undefined behaviour |

## Where the code runs

Everything the player sees runs in **one browser tab**, single-threaded: like a super loop with interrupts, there are no
threads and no locks. Work happens in callbacks the browser calls (a MIDI message arrived, a frame is due, a timer
fired), and each callback runs to the end before the next one starts. A long computation in a callback freezes the game,
the way a long ISR stalls a firmware.

- **Phaser** (the game framework) calls each screen's `update` about 60 times a second and draws on a canvas. A
  screen is a "scene" (`src/game/*Scene.ts`); switching scenes is a state machine transition.
- **Web MIDI** is the browser's MIDI driver API: it hands the game raw MIDI bytes with a timestamp. It needs Chrome or
  Edge, and the user has to allow it once.
- **Web Audio** plays the piano samples. Its clock (`AudioContext.currentTime`) is the hardware timer of this project:
  steady and independent of frame rate, so all musical time is measured on it (in ticks, 480 per quarter note), never in
  frames.
- **Saves** go to `localStorage`, a small key-value store per website in the browser (think emulated EEPROM). Each
  record has a `schemaVersion` and a migration, as a firmware would version its stored config.

## One key press, end to end

1. The EZ-220 sends three bytes over USB-MIDI, for example `0x90 0x3C 0x40` (note-on, middle C, velocity 64).
2. The browser calls `onmidimessage` in `src/io/midi/WebMidiKeyboard.ts`, which maps the event timestamp onto the audio
   clock and calls `parseMidiMessage` (`src/io/midi/parse.ts`, plain bit masks from `bytes.ts`). The result is a
   `NoteEvent` (`src/core/judge/types.ts`): `{ kind: 'on', midi: 60, velocity: 64, timeMs, source }`. From here on
   nothing knows about MIDI bytes or the browser.
3. `PracticeController` (`src/game/practice/PracticeController.ts`) passes the event to the play mode, `WaitMode` in
   `src/core/judge/wait.ts`, a pure state machine. It returns domain events such as `NoteJudged` (right note, or wrong
   with a reason: wrong octave, neighbour key, wrong letter) and `PieceCompleted`.
4. The scene (`src/game/PracticeScene.ts`) draws what the events and the play state say. It never decides whether a note
   was right.

Without the piano, the same path starts one step later: the virtual EZ-220 (`src/io/mock/VirtualEz220.ts`) is a fake
MIDI device that produces the same bytes, and the on-screen and computer keyboards produce `NoteEvent`s directly. That
is why every layer above `io` can be tested on any PC (`docs/testing.md` section 7).

## The layers, as a C program would have them

| Folder | C/C++ equivalent | Rule |
|---|---|---|
| `src/core/` | Application logic, portable C with no HAL calls | Pure TypeScript: no browser, MIDI, audio or Phaser. Unit-tested, 90% coverage gate |
| `src/io/` | The HAL and drivers | Small interfaces (`src/io/keyboard.ts`) with real and mock implementations behind them |
| `src/game/` | The UI task | Draws; reads `core` and the `io` interfaces only (lint-enforced) |
| `src/main.ts`, `src/compose.ts`, `src/profileSetup.ts` | `main()` and board init | The composition root: picks the real or mock drivers and wires them together |
| `content/` | Data tables in flash | Pieces, levels, monsters: data, so adding content needs no code change |
| `tools/` | Host-side code generators and scripts | Piece compiler and linter, generators, docs tooling, test selection |

## First hour

1. `npm ci`, then `npm run dev` and open the address it prints in Chrome. Add `?device=virtual` to get a simulated
   EZ-220, or play with the computer keyboard. Every such switch is in `docs/url-switches.md`.
2. `npm run demo` watches the game play itself; `npm run check` is the one command that must pass before a change is done.
3. Press F12 in Chrome for the developer tools: the Console tab shows errors and logs (like a UART), the Sources tab sets
   breakpoints in the TypeScript files.

## TODO

Work tags ([todo-tags.md](automation/todo-tags.md)); the closed issue in brackets keeps the earlier discussion.

- TODO(builder, R2): on Windows a running dev server holds a native file in `node_modules/` open, so `git pull` stops half-applied and leaves `node_modules/` incomplete (no `tsc`). Say in the first-hour steps to stop dev servers before pulling or installing, and how to recover (`npm ci`).
