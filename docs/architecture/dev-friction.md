# Developer friction

A review of what slows down a person or an agent working on Pianor: the npm scripts, the tools in `tools/`,
the CI workflow, the Claude Code hooks and the error messages of the tooling.
What was fixed is listed with the pull request; the rest are proposals, biggest saving first. Times were measured in a
Claude Code cloud container (Linux, no GPU); the CI figures are estimates.

## Measured: the local loop

| Command | Time | Note |
|---|---|---|
| `npm run typecheck` | 10 s | |
| `npm run lint` | 9 s, 1.4 s with a warm cache | `--cache` proposed below |
| `npm test` | 20 s | 129 test files; Vitest says about 6 s more could go with `isolate: false` |
| `npm run docs:check` | 2 s | |
| `npm run analyze` | 30 s | 27 s of it is the type-aware lint |
| `affected-cli --dry-run` | 0.15 s | with plain `node --experimental-strip-types`, no `node_modules` needed |

`npm run check` is about 45 s, and the Stop hook (typecheck, lint, docs check) about 20 s on every stop with a dirty tree.

## Fixed

**Tooling (merged with this file).**
- `piece:lint --help` linted every piece, and `piece:build --help` tried to build from a folder named `--help`. Both now
  print their usage. A misspelt option (`--stict`, `--level=`) was ignored without a word, so `piece:lint --stict` passed
  with warnings; both tools now refuse an unknown option with exit code 2 and the usage (`tools/piece/cliArgs.ts`,
  Node's own `util.parseArgs` in strict mode, no new dependency).
- `piece:lint nope` said "No pieces found in nope (each piece is a folder with piece.abc ...)", which reads as if the folder
  were there but empty. It now says the folder does not exist. It still exits 0, as `ft_1_02b` specifies for a missing
  `private/pieces`.
- Every `vitest` and `vite` start printed a warning that the Vite config "uses features unsupported by configLoader
  native". The cause was one import without `.ts` in the config's import graph (`src/core/chart/migrate.ts`); the other
  21 files already had it. The warning is gone. Nothing stops it
  from coming back except someone noticing it (see below).

**CI, hooks and npm scripts.**
- CI (`.github/workflows/ci.yml`) runs two jobs on `ubuntu-latest` on every pull request push: `check` (typecheck,
  lint, analyze, unit tests with the coverage gate, the piece build and lint, the production build, the docs check and
  `docs:touched`; a docs-only change runs only the docs steps) and `art rules`. The browser jobs
  (`browser-tests.yml`) run only on a label: `ci:e2e` for the Linux end-to-end tests of the affected areas, `ci:visual`
  for the Windows screenshot tests; the weekly and manual runs start every area. `pr-events.yml` starts them when a label
  is added and reruns a failed check when the description is edited.
- The `check` job ran the typecheck twice (`npm run typecheck`, then `npm run build`, which starts with `tsc`). The build
  step is now `vite build` alone.
- The Stop hook's status line said it was running the whole check while it runs only typecheck, lint and the docs check (the
  unit tests are left out on purpose). It now says so, so nobody believes the tests ran.
- `npm run lint` uses ESLint's cache (in `node_modules/.cache/eslint/`, so nothing new to ignore): 9 s to 1.4 s when
  little changed, which is every Stop hook run and every `npm run check`. CI has no cache, so it still lints everything.
- `npm run check:ci` runs what the CI `check` job runs, in the same order (adds analyze, the coverage gate, the piece
  build and lint and the production build to `npm run check`). Before, `check` passing locally did not mean the
  `check` job would pass: `analyze` and the coverage gate were only in CI.

## Proposals, not done

Largest CI saving first.

1. **`playwright install --with-deps chromium` runs apt on every e2e run**, cache hit or not (about a minute). The
   official image `mcr.microsoft.com/playwright:v<version>-noble` as the job's `container:` has the browser and its
   libraries; the version must follow `@playwright/test` in `package-lock.json`, so a small check (or Renovate) is needed.
2. **Changing the pull request description does not rerun `docs:touched`.** CI runs on `opened`, `synchronize` and
   `reopened`, so writing `docs: n/a` after the check failed needs another push. A tiny separate workflow on `edited`
   that runs only `docs:touched` would fix it, but `tools/docs/cli.ts` loads remark at the top and so needs `npm ci`;
   splitting `touched` into its own entry point would let it run with type stripping like the affected areas.
   **Done:** `tools/docs/touched-cli.ts`, and `pr-events.yml` reruns the failed check on `edited`.
3. **`npm run check` runs typecheck, lint, tests and the docs check one after the other.** Typecheck and lint are
   independent; running them in parallel (for example `npm-run-all2 -p`, a new dev dependency, or two background jobs in
   a small Node script) saves about 10 s per check. Small, but it is in every agent's loop.
4. **Vitest `isolate: false`** would save about 6 s per run (its own hint). Risky: tests that change module state
   (fake timers, the profile store, `vi.mock`) would leak into the next file. Try it on one project of the config first.
5. **Extensionless imports.** 626 relative imports in `src` and `tools` have no `.ts`, against 366 that do. Only the
   Vite config's import graph needs them today (fixed above), but a mixed style means the next import added to that graph
   brings the warning back. Either a lint rule (`import-x/extensions`, a new dependency) or a one-off codemod plus a
   small check in `docs:check`-style tooling.
6. **The Stop hook runs on any untracked file**, including a scratch file an agent left in the repository, and then
   spends 20 s on checks that cannot have changed. It could look only at tracked changes and untracked files under
   `src`, `tools`, `tests`, `content` and `docs`.
7. **The `changes` job parses the text output of `affected-cli`** ("Running every area", "No end-to-end area is
   affected"). A `--json` or `--github-output` flag would make the contract explicit; the unit test in
   `tools/e2e/affected.test.ts` covers that the script runs without `node_modules`, not the wording.
8. **`piece:generate` and `docs:*` have their own argument parsing.** `piece:generate` already prints a usage and refuses
   bad input; `docs:verify` and `docs:touched` print a short usage; an unknown `docs` sub-command prints the list. They
   are fine as they are; if they grow, the `util.parseArgs` pattern in `tools/piece/cliArgs.ts` is the one to copy.
