---
covers: ["package.json", ".githooks/", ".claude/hooks/", ".mcp.json", "playwright.config.ts"]
---
# Commands

Every `npm run` script, what it does and when to use it. `npm run docs:check` fails if a script in `package.json` is missing here. The rules for agents are in `CLAUDE.md`; this page is the reference it points to.

## Scripts

- `npm install` runs `prepare`, which points git at `.githooks/`: the privacy rules (d165) on every commit's staged files and message, for any tool or person; and sets the `docs-index` merge driver, so two branches that both change generated docs tables (`FEATURES.md`, `DECISIONS.md`) merge without a conflict and the post-merge hook writes the tables again (commit them)
- `npm run dev`: dev server (shows draft pieces; progress saved in the browser per player). URL switches such as `?device=virtual`, `?lang=en`: `docs/url-switches.md`
- `npm run start`: dev server that opens the game on `127.0.0.1` (Vite's dev port, 5173 unless taken) in Vite mode `start`: draft pieces are hidden
- `npm run build`: typecheck and production build
- `npm run start:local`: build (approved pieces only), serve on `http://127.0.0.1:4173` offline and open it as its own full-screen window (Edge or Chrome in app mode, own browser profile); how a student plays on their own computer (ft_0_14, d068, d105)
- `npm test`: Vitest unit tests. `npm run test:changed`: only the tests that import a file changed against `origin/main` (seconds instead of one or two minutes; a change to `content/` or the lock file runs them all). `npm run test:coverage`: plus the 90% coverage gate on `src/core`, `src/io` and `tools/` (CI), without the art rules' test and the painters' picture tests. `npm run test:art`: those alone (`tools/art/pictureRules.test.ts` paints every picture at every hour, a minute or more, and keeps them until the painters' code changes; its own CI job)
- `npm run test:e2e`: Playwright end-to-end and screenshot tests (a bundle of the game built in mode development before the run, served on port 5180; `PW_DEV_SERVER=1` uses the dev server instead; on a new machine `npx playwright install chromium`; cloud sessions use the pre-installed Chromium or `PW_CHROMIUM_PATH`, and screenshot tests without a baseline skip). `-- --project=<area>` runs one area
- `npm run test:e2e:affected`: the areas the branch touches (against `origin/main`, uncommitted files included) plus `@smoke`; use it while working and before a commit that touches the game. Areas and the run log in `test-logs/`: `docs/testing.md` section 10
- `npm run test:e2e:smoke`: the seven `@smoke` tests (about two minutes)
- `npm run typecheck` (the native TypeScript 7 compiler, about 4 seconds; ESLint and knip keep using TypeScript 6's library), `npm run lint`
- `npm run analyze`: type-aware lint (`npm run analyze:types`), unused files and exports (`npm run analyze:unused`, knip), duplicated code (`npm run analyze:dupes`, jscpd); in CI. Reading findings: `docs/architecture/static-analysis.md`
- `npm run check`: typecheck, lint, the unit tests the branch touches (`test:changed`) and `docs:check`: the one command before saying a task is done (end-to-end is separate; `check:ci` and CI run every unit test)
- `npm run check:ci`: what the CI `check` and `art rules` jobs run (plus analyze, coverage, `piece:build`, `piece:lint`, production build; about 3 minutes on four cores): run it before pushing
- `npm run piece:lint [piecesDir] [--levels=path] [--strict]`: check every piece in `content/pieces/` against its level in `content/curriculum/levels.json` (errors fail, warnings are for review)
- `npm run piece:build [piecesDir] [outDir]`: compile `content/pieces/<id>/piece.abc` + `piece.meta.json` to `build/charts/<id>.chart.json` (errors as `file:line:column`)
- `npm run piece:generate -- <kind> --level N [--seed S] [--hand ..] [--bars N]`: a draft piece (five-finger, scale, reading-drill, echo, phrase); same seed, same piece; passes `piece:lint` by construction. `--regenerate <id>` checks or remakes one. `docs/authoring/au06-generators.md`
- `npm run piece:import -- <score.musicxml|.mxl> [--id ..] [--out ..] [--license .. --source ..]`: a MusicXML file to a draft game piece, by default in the gitignored `private/pieces/` (copyrighted wishes, licence `NaN`), which the game plays on this machine; `content/pieces` needs an open licence and a level it passes; refuses with bar and beat what it cannot write (ft_Y_04 slice 2)
- `npm run piece:photo [folder]`: a menu in the terminal that reads a scan, photo or PDF of a sheet (in `private/photo/in/`) with Audiveris, installed separately (AGPL, never bundled), into an own piece file for the piece maker's Import, plus a report of the bars to fill by hand; a MusicXML file skips Audiveris (ft_Y_04 slice 3)
- `npm run art:render -- <room|map|knoll> [day|dawn|dusk|night] [file.png] [zoom]`: paint one of Keri's pictures to a PNG (default in `test-logs/art/`) without starting the game; look at every picture before showing it (`docs/art-direction.md` section 5). `npm run art:render -- kit [family] [hour]`: the painter's kit on one sheet, every shared thing in every variant (d124). `npm run art:render -- ui <practice|note|scene|kit>`: the bubble, the strip and the backpack on a mock screen at 1920 x 1080 (ft_1_20)
- `npm run art:check -- <room|map|knoll> [day|dawn|dusk|night]`: measure a picture against the rules that can be measured (colour runs, clouds) and write it with composition guides to `test-logs/art/<picture>-<hour>-guides.png`; warnings for the painter (`paint-a-scene` skill)
- `npm run spike`: hardware spike page (`/spike.html`, `?device=virtual` for the simulated EZ-220); a human runs it on the real keyboard with `docs/hardware-test-checklist.md`
- `npm run piece:preview`: opens `/?demo=preview`, where a human reviews and approves pieces. Agents never approve on their own: a piece is approved by the maintainer, here or by a pick on a board (d262)
- `npm run piece:board`: the review board page of every draft piece (sheet, Play, Approve or Not yet) for the maintainer's phone, published as a private Artifact; `-- --apply <picks.json>` records the maintainer's picks (`docs/authoring/au10-review-board.md`)
- `npm run human:board`: the board of every `NEEDS-HUMAN` tag in the docs, grouped by what it needs (outside access such as CIPI first), written to `test-logs/board/human.html` and published by a thread as a private Artifact for the maintainer (`docs/automation/todo-tags.md`)
- `npm run demo`: opens `/?autoplay=1`: the game plays a scenario by itself with a virtual EZ-220 and an in-memory player (dev only). `?scenario=<id>` (`content/dev/scenarios.json`), `?piece=`, `?speed=`, `?seed=`: `docs/features/ft_Y_09-demo-director.md`
- `npm run docs:index`: regenerate the index tables and the `<!-- docs:... -->` blocks from front matter and code; never edit text between those markers by hand
- `npm run docs:check`: docs checks (front matter, generated blocks, links, paths, ids, `npm run` commands, criteria tags; `docs/decisions/workflow.md#d041`), also in CI
- `npm run docs:criteria`: which acceptance criteria have a test that names them. `npm run docs:stale`: docs whose covered code changed since a person verified them; `npm run docs:verify -- <doc>` stamps a doc a person re-read (agents do not run it). `npm run docs:touched -- <base>`: CI check that a pull request changing core, tools or the curriculum touches the docs (or says `docs: n/a`)

## Running tests and long jobs

- Do not run unit tests while end-to-end tests run (the load fails a 5-second timeout in the `piece:lint` test); rerun a failing end-to-end test alone before suspecting the code.
- Chrome's "AudioContext encountered an error from the audio device" is noise.
- In a Windows shell, write multi-line scripts to a file (a Python script in the scratchpad) instead of an inline heredoc with quotes; `git` CRLF warnings are harmless.
- Send long test output to a log file (`npm run test:e2e > <scratchpad>/e2e.log 2>&1`) and read only the summary and failing names (`grep -n -E "FAIL|passed|failed" <log>`); an end-to-end run also writes `test-logs/runs/<newest>/summary.md` and `failures/`.
- A full end-to-end run takes about 8 minutes with a GPU, 20 to 30 without (SwiftShader, `E2E_GPU=0`, CI). Use `npm run test:e2e:affected`.
- Screenshot baselines are one file per screen that every machine compares, tolerance 2 percent, made by the "Update screenshot baselines" workflow or a local `--update-snapshots` run of the visual area (a small control can slip through: look at the picture when a screen changes). No game text uses a font of the computer: the staff's font ships with the game, and the screenshot area draws without a GPU (`docs/decisions/workflow.md#d288`, d289).
- Playwright uses port 5180 (`PW_PORT=<n>` changes it) and never reuses a server already there, so a stale server fails the run: find the holder (`lsof -i :5180` or `netstat -ano | findstr :5180`) and stop it or change `PW_PORT`. `PW_REUSE_SERVER=1` reuses a server you started on purpose.

## Code graph (code-review-graph MCP)

Only where the `code-review-graph` MCP server runs (`.mcp.json`: wherever the tool is installed and its index built). When its tools are present, narrow scope with the graph before reading files: skills `explore-codebase`, `debug-issue`, `review-changes`, `refactor-safely` in `.claude/skills/`. Then read the source and its tests before changing anything; when graph and source disagree, the source wins, and an empty result may only mean "not indexed". Hooks in `.claude/settings.json` update the graph after edits and skip silently where it is not installed.
Agents without the MCP tools can use the CLI: `code-review-graph update` (refresh the index) and `code-review-graph search <name>` (find a symbol).
