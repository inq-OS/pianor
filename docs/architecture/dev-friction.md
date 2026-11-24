# Developer friction

A review of what slows down a person or an agent working on Pianor: the npm scripts, the tools in `tools/`,
the CI workflow, the Claude Code hooks and the error messages of the tooling.
Proposals are listed biggest saving first. Times were measured in a
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

## Proposals

Largest CI saving first.

1. **`playwright install --with-deps chromium` runs apt on every e2e run**, cache hit or not (about a minute). The
   official image `mcr.microsoft.com/playwright:v<version>-noble` as the job's `container:` has the browser and its
   libraries; the version must follow `@playwright/test` in `package-lock.json`, so a small check (or Renovate) is needed.
2. **`npm run check` runs typecheck, lint, tests and the docs check one after the other.** Typecheck and lint are
   independent; running them in parallel (for example `npm-run-all2 -p`, a new dev dependency, or two background jobs in
   a small Node script) saves about 10 s per check. Small, but it is in every agent's loop.
3. **Vitest `isolate: false`** would save about 6 s per run (its own hint). Risky: tests that change module state
   (fake timers, the profile store, `vi.mock`) would leak into the next file. Try it on one project of the config first.
4. **Extensionless imports.** 626 relative imports in `src` and `tools` have no `.ts`, against 366 that do. Only the
   Vite config's import graph needs them today, but a mixed style means the next import added to that graph
   brings the warning back. Either a lint rule (`import-x/extensions`, a new dependency) or a one-off codemod plus a
   small check in `docs:check`-style tooling.
5. **The Stop hook runs on any untracked file**, including a scratch file an agent left in the repository, and then
   spends 20 s on checks that cannot have changed. It could look only at tracked changes and untracked files under
   `src`, `tools`, `tests`, `content` and `docs`.
6. **The `changes` job parses the text output of `affected-cli`** ("Running every area", "No end-to-end area is
   affected"). A `--json` or `--github-output` flag would make the contract explicit; the unit test in
   `tools/e2e/affected.test.ts` covers that the script runs without `node_modules`, not the wording.
7. **`piece:generate` and `docs:*` have their own argument parsing.** `piece:generate` already prints a usage and refuses
   bad input; `docs:verify` and `docs:touched` print a short usage; an unknown `docs` sub-command prints the list. They
   are fine as they are; if they grow, the `util.parseArgs` pattern in `tools/piece/cliArgs.ts` is the one to copy.
