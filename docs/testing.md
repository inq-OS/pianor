---
covers: ["tests/", "vite.config.ts", "playwright.config.ts", ".github/workflows/"]
---
# Testing strategy

Principle: almost all game rules live in pure TypeScript (`src/core`), so they can be tested fast, deterministically and without a piano, a screen or a student. The hardware and the student are tested separately, by humans, with checklists.

## 1. Test layers

| Layer | What | Tools | Where |
|---|---|---|---|
| Unit | Chart math, staff positions, judge, scoring, progression, battle rules, linter rules | Vitest | next to the module (`src/**/*.test.ts`, `tools/**/*.test.ts`) when it tests one module; `tests/<area>/` (practice, progression, editor, judge, content, integration) when it tests several together |
| Property-based | Invariants that must hold for any input (see section 2) | fast-check (MIT, `docs/dependencies.md`) | next to unit tests |
| Golden | ABC to chart compiler output (staff layout and generator goldens are planned) | Committed fixtures, compared by the test; `UPDATE_GOLDEN=1 npx vitest run tools/piece/compile.test.ts` rewrites them after a deliberate change | `tests/golden/` |
| Replay | Scripted or recorded MIDI event sequences replayed through the judge and scoring | Vitest + JSON fixtures | `tests/replays/` |
| Contract | Every implementation of an `io` interface (real Web MIDI wrapper, mock keyboard) passes the same behaviour suite | Vitest, shared test suite | `tests/contracts/` |
| Content | Every piece in `content/` lints and compiles; approved-only gate works | `piece:lint` in CI | CI |
| Architecture | Import boundaries and schema versions hold (section 4) | ESLint rules, Vitest | CI |
| Static analysis | Dropped promises, `any` values, useless casts, unused code, copy-paste | `npm run analyze` (`docs/architecture/static-analysis.md`) | CI |
| End-to-end / visual | Real browser, mock keyboard and virtual EZ-220, full practice sessions; screenshot checks of the staff and results | Playwright (Apache-2.0) | `tests/e2e/` |
| Hardware | Real EZ-220: connection, key lighting, latency | Manual checklist | `docs/hardware-test-checklist.md` |
| Playtest | A player plays; usability and difficulty | Structured notes, one file per session, never committed (d165) | the gitignored `private/playtests/` ([PLAYTESTS.md](playtests/PLAYTESTS.md)) |

## 2. What to test hardest (core invariants)

- **Chart / compiler:** every bar's durations sum to the meter; ticks are monotonic per voice; compile then serialise then parse round-trips; invalid ABC gives errors with line numbers, never a crash. Property tests generate random valid pieces within a level and assert the linter accepts them.
- **Staff layout:** pitch to staff position is correct for both clefs, including ledger lines and (once supported) accidentals; layout never overlaps notes at the one supported size (below).
- **Judge:** for any sequence of key events the state machine never gets stuck (a correct sequence always completes); note-on with velocity 0 behaves as note-off; chords in any press order are accepted; wrong-note verdict carries the right reason (wrong octave, neighbour key, wrong letter); the same input always yields the same output.
- **Scoring and progression:** XP is never negative; hints reduce reward but never punish below zero; level thresholds are monotonic; unlock rules are deterministic; saved data migrates from every older schema version.
- **Generators:** same seed gives identical output; every generated piece passes the linter at its target level.
- **Time:** the core takes an injectable clock; no test uses real timers or sleeps.

## 3. Test data and fixtures

- A small set of canonical pieces in `tests/fixtures/pieces/` covering each level and each notation feature (rests, ties, accidentals once supported, two hands).
- **Recorded sessions:** the hardware spike tool (ft_0_01) can export real MIDI event logs from the EZ-220 as JSON. Commit a few as replay fixtures, so the judge is tested against real timing, real velocity values and real wrong-note behaviour of a student, without needing the hardware in CI.
- A fake `navigator.requestMIDIAccess` for browser tests, because Web MIDI cannot be exercised in CI without hardware.

## 4. Architecture tests (keep future options open)

- Lint rule: `src/core` may not import Phaser, DOM globals, Web MIDI or Web Audio; `src/game` may not import `src/io` implementations directly (only the interfaces). Failing the rule fails CI.
- Every persisted or loaded format (chart, piece meta, save data, content packs) has a `schemaVersion`. A test loads a fixture of each previous version and migrates it. Adding a schema field without a migration test fails review. The list of formats, their versions and their migration tests is generated in [schemas](architecture/schemas.md).
- Contract tests make sure a new input device or output implementation can be swapped in without changing core.

## 5. CI gates

Run on every change: typecheck, lint (including boundary rules and size limits), static analysis (`npm run analyze`: type-aware lint, unused code, duplication; `docs/architecture/static-analysis.md`), unit, property, golden, replay, contract, content lint, and the end-to-end tests (on a pull request the areas it touches and the smoke tests, on `main` all of them; section 10). Coverage thresholds apply to `src/core`, `src/io` and `tools/` only, not to Phaser scene code: `npm run test:coverage` fails below 90% lines, branches, functions or statements (`vite.config.ts`; the command-line entry points and the two Vite plugins are excluded there). The art rules' test (`tools/art/pictureRules.test.ts`) paints every picture at every hour and is several times slower under coverage, so `test:coverage` leaves it out, and the painters' picture tests with it (`src/game/ui/pixel/keri/*Picture.test.ts`, `puuvaim.test.ts`: `src/game` is not measured, and coverage doubled their painting until four timed out; the gate on `src/core`, `src/io` and `tools/` holds without them, 98% of statements). `npm run test:art` runs them, in CI as its own `art rules` job beside `check` (`npm test` and `check:ci` still run them all). The art rules' test keeps what it painted for its checks (`tools/test/paintCache.ts`, in `node_modules/.cache/pianor-paint`, gzipped, about 14 MB): the key is every file the pictures are painted from (the painters' folders, `tools/art/paintSources.ts`, the same the build's cache is keyed on, `content/world/keri.json`, `tools/art/pictures.ts`, `package-lock.json` and the version of Node), so a run that changed none of them reads the pictures instead of painting them (85 seconds to 8 on a four-core cloud machine) and still runs every check. `PIANOR_PAINT_CACHE=0` paints afresh; the CI job keeps the cache between runs with `actions/cache` (`PIANOR_PAINT_CACHE_DIR`), and its weekly and manual runs paint afresh. A cold start of the dev server, the build or an end-to-end run first paints Keri's pictures (`tools/vite-keri.ts`, some seconds each, shared out among worker threads, one for each core but one, `tools/vite-keri-worker.ts`: about 25 seconds in all on four cores, over a minute on a slow machine, so Playwright waits up to three minutes for its server; kept in `node_modules/.cache/pianor-keri` until the art's code or `content/world/keri.json` changes); unit tests never load them. Docs are checked too: `npm run docs:check` (front matter, generated indexes up to date, links, paths and ids named in text, `npm run` commands, acceptance-criteria tags) runs in CI, and a pull request that changes core, tools or the curriculum must touch the docs (`npm run docs:touched`). Flaky tests are fixed or quarantined with a `TODO` tag in this file ([todo-tags.md](automation/todo-tags.md)). CI retries a failed end-to-end test once (`retries` in `playwright.config.ts`, for slow runners); a test that passed only on the retry is listed as flaky in the run log (`test-logs/runs/<run>/summary.md`) and needs a `TODO` tag (or a fix), it is not a pass to ignore.

## 6. Rules for agents

- Write the failing test first for any `core` or `tools` feature; commit tests with the code.
- Name the acceptance criterion a test covers (`ft_0_08.AC1`, in a comment or the test title) when the feature file tags its criteria; a feature cannot be marked done with an untagged-and-untested criterion (`npm run docs:criteria`).
- Never mark a feature done on the strength of a manual run alone when a replay or unit test can cover it.
- Do not claim hardware results. Hardware and student-facing checks are listed as "needs human" with the exact steps in the checklist.
- When a bug is found by a human (or the student), add a regression test or replay fixture that reproduces it before fixing. Work on a GitHub issue follows section 9. A bug an agent finds and notes as a `TODO` tag (no issue, d116) gets the same kind of test, tagged with the feature's acceptance criterion when it has one.

## 7. Testing without the EZ-220

Goal: everything except real-hardware facts and the student's experience can be built and verified on any machine with no keyboard attached, including in CI and for agents.

| Need | Without hardware |
|---|---|
| MIDI code path | Virtual EZ-220: a fake `MIDIAccess` with ports, hot-plug and raw bytes (`src/io/mock`); the real wrapper runs against it |
| Playing a piece | Virtual player scripts a whole performance (tempo, jitter, mistakes, chords), or the on-screen keyboard and QWERTY (with octave shift) by hand |
| Judge and scoring | Replay fixtures, scripted or recorded |
| Key lighting | Output goes to the on-screen keyboard; real lighting stays unverified until ft_0_01 |
| Latency and timing | Simulated latency and jitter in the mock, only to test that windows and clock mapping behave; never as evidence of real numbers |
| E2E | Playwright with the virtual device and virtual player. Speed depends mostly on rendering: headless Chromium draws WebGL on the CPU (SwiftShader, about 25 fps), so parallel tests starve each other. `playwright.config.ts` uses the real GPU on Windows (Direct3D 11, 60 fps; a full run went from 28 to about 8 minutes, and the screenshot baselines still match); `E2E_GPU=0` and CI keep SwiftShader. Without a GPU Chrome also copies every frame drawn on an animation frame back from SwiftShader and the page waits for it (~80 ms a frame), so every small save or load step waited a frame; there `openGame` opens the game with `?loop=timer`, which steps the game's loop on a timer: as many frames, the page free between them (a cloud run went from 36 to about 20 minutes) |
| Looking at the game without playing it | `npm run demo` (`/?autoplay=1`, dev only, ft_Y_09): a director plays a scenario from the menu to the results through the virtual EZ-220 with an in-memory player; scenarios are data in `content/dev/scenarios.json` and seeded, so the same seed gives the same run. Tempo mode is played on the game's own clock (`src/dev/autoplay/`) |
| Spike page (ft_0_01) | Runs against the virtual device so the page is verified before the human uses it |

Playwright's dev server port: the default is 5180; `PW_PORT=<n>` moves it (for example when another worktree already holds 5180). By default Playwright never reuses a server already on the port, because that server may run another worktree's code and the tests would pass or fail against the wrong build; it fails with "port already used" instead. Check what holds the port with `netstat -ano | findstr :5180` (Windows) or `lsof -i :5180` (Linux/macOS), and stop that process or pick another `PW_PORT`. Set `PW_REUSE_SERVER=1` only when you started that server yourself on purpose.

Rules:
- Fixtures not recorded from the real keyboard are labelled `synthetic` in their metadata. Replace or supplement them with real recordings after ft_0_01; keep both.
- A passing virtual run means the software is correct against its assumptions, not that the EZ-220 behaves like the virtual one. Anything about real behaviour (lighting, latency, driver quirks, sleep and reconnect) stays "needs human" and is listed in the hardware checklist.
- If the real device contradicts the virtual one, fix the virtual device first, add a regression test, then fix the code.
- Developing on a machine with no MIDI at all must work: the game starts, shows the on-screen keyboard and says (via a string key) that no keyboard was found.

## 8. Manual checklists

**Sound check (ft_0_07, needs a human with speakers or headphones):** open `?demo=audio&device=virtual`. (1) Press keys on screen and with Z X C V B: a piano sounds at once, with no crackle or delay you can notice. (2) "Play C major scale": eight even notes. (3) Metronome at 60, 100 and 160 BPM: steady, the first beat of a bar higher. (4) Write down the browser latency numbers the page shows (base + output) for `docs/hardware-notes.md`. (5) With the real EZ-220: play keys and check you hear the keyboard once, not twice (the game stays quiet for real MIDI by default; `?monitor=1` makes it sound too). Unverified assumption: the EZ-220 sounds through its own speakers or headphones while connected over USB.

**`docs/hardware-test-checklist.md`** (ft_0_01, run with `npm run spike`): plug-in and power order; note on/off and velocity; unplugging mid-play; key lighting; Local Control; the tap test; both browsers; recordings for replay fixtures; the go/no-go.

**`docs/playtests/PLAYTESTS.md`** holds the template; a session's notes go in the gitignored `private/playtests/`, never in the repo (d165). What a session teaches comes in only as a plain rule (a ledger entry) or a tag in the doc it belongs to.

## 9. Regression tests for GitHub issues

Every GitHub issue that changes behaviour, a bug or an improvement, leaves at least one test behind that guards it, so the same problem cannot come back unnoticed.

- **Name the behaviour.** The test title says what must hold, in words a reader understands without the issue, next to an acceptance-criteria tag when the feature has one, for example `it('the wheel over an empty place cycles the length (ft_1_02d.AC3)', ...)`. Issue and pull request numbers stay out of titles, comments and docs.
- **Pick the kind in this order:**
  1. A unit test (Vitest) next to the code it guards, in that module's existing test file, or a replay fixture in `tests/replays/`.
  2. When the change sits in a scene or a view, first move the decision into a pure helper (in `src/core`, or the helpers next to the scene) and unit test that; scenes hold no rules anyway.
  3. Only when the behaviour is drawing or wiring that no pure function holds: an end-to-end test in `tests/e2e/`. A screenshot baseline alone does not count: it is checked only when the visual area runs, and a screen without a baseline skips (`docs/decisions/workflow.md#d288`).
- **It fails without the change.** For a bug, write it first and see it fail on the unfixed code; the pull request shows that output. For an improvement it covers the new behaviour.
- **It stays.** A regression test is not deleted, skipped or loosened unless the maintainer agrees in the pull request. When the behaviour it guards changes on purpose, the test changes with it.
- A change that touches no behaviour (docs, CI or config only) needs no regression test; its pull request says so.

## 10. End-to-end areas and run logs

The end-to-end tests are split into areas in `tools/e2e/areas.ts`, each a Playwright project: practice, staff, menu, editor, preview, dev and visual. The table also names the source paths each area guards. Measured in a cloud session (4 cores, no GPU, `?loop=timer`), the whole suite of 331 tests takes about 16 minutes with three browsers (20.5 with two, 36 before `?loop=timer`); menu about 17 minutes of test time, practice 8, editor 6, dev 6, staff 5, visual 3.5 (its screenshot tests skip without a baseline for the platform), preview 1.5. Without a GPU `playwright.config.ts` runs one browser per core but one (at least two, at most four until more is measured): each browser's software GPU keeps about one core busy. With a GPU (Windows) it stays at two.

- `npm run test:e2e:affected` compares the branch with `origin/main` (or the ref given: `npm run test:e2e:affected -- <base>`), uncommitted and new files included, and runs the areas the changes touch plus the `@smoke` tests. A shared path (`SHARED_PATHS`: boot, the pixel kit, input and audio, chart, pieces, configuration, the test helpers) or a file that no area names runs every area; docs and unit tests alone run none. `--dry-run` only prints the choice and why; other options go to Playwright in the `--name=value` form.
- **One screen size (d105).** Every end-to-end, fit, layout and screenshot test runs at a 1920x1080 full screen at 125% scaling: 1536x864 CSS pixels at `deviceScaleFactor` 1.25 (a canvas of 1920x1080 physical pixels), set once in `tests/e2e/targetView.ts` and used by `playwright.config.ts`. No test sets another size, except `screen-guard.spec.ts`, which checks that a browser window on the laptop plays and that a window too small to play in (d105) shows only the `screen.tooSmall` line. Other sizes are not tested; every window gets at least the tested art area by a smaller zoom (d105), and `?anysize=1` turns the line off (`docs/url-switches.md`).
- `npm run test:e2e -- --project=editor` runs one area; `npm run test:e2e` runs them all.
- A new spec file goes into exactly one area, and a new source folder into the areas it can break. `tools/e2e/areas.test.ts` fails on a spec file in no area and on a path that no longer exists, so a rename shows up at once.
- CI (d090, GitHub's hosted runners): every pull request push runs the `check` and `art rules` jobs on Linux; a docs-only change skips their code steps (the docs check still runs). The `ci:e2e` label on a pull request adds the Linux end-to-end run of its affected areas plus the smoke tests, on adding the label and on every later push. A push to `main` runs no CI; the `check` job runs on `main` every day, and every area runs in the weekly scheduled run (weekly) and in a manual run (`workflow_dispatch`), so what a selection or a skipped run missed shows there at the latest; a check that fails on `main` is fixed first, ahead of other work. Agents run `npm run test:e2e:affected` themselves before pushing, so the label is for a second opinion on a risky change.
- **Screenshot baselines (d062, d288).** One baseline per screen (`*-chromium.png`, no platform in the name), made on Windows, where the game is played; Windows, Linux CI and cloud sessions compare against the same file with the 2 percent tolerance, because no text uses a font of the computer (the staff's font ships with the game) and Chrome runs without font hinting or LCD smoothing. A screen without a baseline skips (a local `--update-snapshots` run still writes them). The `visual (Windows)` CI job runs the visual area on GitHub's hosted Windows runner (d090) for a pull request with the `ci:visual` label and in the weekly and manual full runs, and keeps the expected, actual and diff images when a test fails. A change that moves pixels on purpose gets new baselines from the "Update screenshot baselines (Windows)" workflow (`gh workflow run update-snapshots.yml --ref <branch>`), which commits them to that branch (never to main); pull the branch and say in the pull request which screens changed: **the maintainer looks at the images before it merges**. Agents never regenerate baselines to make a red test green without that look.
- **Run log.** Every run writes `test-logs/runs/<start>_<areas>/` (gitignored; the newest 30 are kept): `summary.md` (per area: passed, failed, flaky, skipped and test time; why these areas ran; each failure with its first error line), `results.json` (every test) and `failures/<area>__<test>.txt` for each failed or flaky test (the whole error, the browser console when the test opened the game with `openGame`, and the test's output). Each run also adds one JSON line to `test-logs/history.jsonl` (time, commit, areas, counts and test time per area, failed tests) for trends. On CI the summary shows on the run's page and `test-logs/` is kept as the `e2e-run-log` artifact for 14 days. A `--reporter` option on the command line replaces the configured reporters, and with them the run log.

## 11. Lessons: what the tests missed (post-mortems)

Each rule comes from a bug that passed every test. Apply them to every feature with a screen, not only to the editor.

1. **Test what is drawn, not only the model data.** A feature is done when the thing the player sees changes. Assert the drawn result (for example the layout's ties or the chart the staff draws), not only the piece or the notes behind it. Ties were recorded and written to the ABC but never drawn, because the chart the staff uses dropped them.
2. **Run the exact user flow in e2e.** Repeat the steps the reporter gave, in the same order: select, then press the other buttons, then click the note. Do not replace them with a shorter path that passes for another reason.
3. **Assert note positions after each simulated click.** A click can land on another beat or length (a click on beat 3 landed on beat 2 in a test, so an ALL check passed for the wrong reason). Check the note list after every click before judging the result.
4. **A chart-versus-compiled comparison must cover each new feature.** Add the feature's cases (ties, chords, partly tied chords, repeats) to the property or unit tests that compare the editor's chart with the compiled ABC chart. Only untied notes were covered at first, so the mismatch of a partly tied chord went unseen.
5. **Reproduce a "nothing happens" report with the exact flow, and check the rendering first.** Before changing code, confirm what is on screen (is the arrow, the tie line, the message shown?) and whether the state changed. Then decide if the bug is in the data, the layout or the input.
6. **Verify on screen, not only in assertions, for visual features.** Look at a screenshot of the state a person would see. Note any assertion that is true but does not describe the visible result.

## TODO

Work tags ([todo-tags.md](automation/todo-tags.md)).

- TODO(builder, R2): `tests/e2e/practice-tools.spec.ts` "ft_1_12.AC8 in Tempo mode the space bar counts in at once, with no key pressed" fails under load and passes alone; wait on the game's own count-in state on the audio clock instead of a wall-clock window.
- TODO(builder, R2): `tests/e2e/note-trainer.spec.ts` "the letter naming switches between B and H and is saved (AC4)" fails every time in a cloud session, alone too: after the click the naming item still shows B. Find whether the click misses the item or the switch no longer toggles.
