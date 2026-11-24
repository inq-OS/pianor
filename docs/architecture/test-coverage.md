# Test coverage and test strength

A review of how well the unit tests protect the code: where logic has no test, and where a test runs the
code but would not notice it breaking. It complements [maintenance.md](maintenance.md) (which listed
"coverage outside the gate" as a proposal) and [static-analysis.md](static-analysis.md). The proposals are at the end.

## In one paragraph

Line coverage is not the problem: `src/core` is at 99.6 % of lines and `tools/` at 97 to 100 %, well over the 90 % gate.
The questions worth asking are the next two: **does a test fail when the code is wrong** (test strength), and **what
logic outside the gated folders has no test at all**. For the first, a quick mutation probe (below) flipped one
operator at a time in `src/core` and ran the tests: about one change in five went unnoticed by the module's own tests,
almost all of them at a boundary (`<` against `<=`) or a tie-break. For the second, `src/io` was at 80 % of lines, with
the composition roots (`createInputs.ts`, `createAudio.ts`), the on-screen keyboard and the file picker untested. In
C/C++ terms: every function was being called by the test bench, but many limit checks were never driven to exactly
their limit.

## How it was measured

- **Coverage:** `npx vitest run --coverage` with `--coverage.include` widened to `src/**` and `tools/**` (the gate in
  `vite.config.ts` only reports `src/core` and `tools`), sorted by uncovered lines and by branch percentage.
- **Mutation probe:** a throw-away script (not committed) took up to five random places per file in `src/core` and
  made one change at each: `<` to `<=` and back, `>` to `>=`, `===` to `!==`, `&&` to `||`, `+ 1` to `- 1`,
  `Math.min` to `Math.max`, `return true` to `return false`. For each change it ran the tests of the file's own folder
  (`vitest run <folder> --bail 1`); a change that left every test green "survived". Survivors were then re-run against
  every test that imports the file (`vitest related`), which removes the ones that a test elsewhere (for example
  `tests/progression/`) does catch. 268 changes in 70 files took about 20 minutes.
  This is what a mutation-testing tool (StrykerJS for TypeScript, PIT for Java) does properly; see the proposals.

## Results

| Area | Lines before | Lines after | Note |
| --- | --- | --- | --- |
| `src/core` | 99.6 % | 99.7 % | gated; strength was the gap, not lines |
| `tools/` | 97 to 100 % | 97 to 100 % | `tools/generate/run.ts` branches 78 % before |
| `src/io` | 79.5 % | 96 % | not gated; see proposal 1 |
| `src/game` helpers (no Phaser) | mostly 95 to 100 % | same, plus the gaps below | scenes are left to end-to-end tests |

Mutation probe on `src/core`, 268 changes: 217 (81 %) failed a test of the module's own folder. Re-run against every
test that imports the file, 29 more were caught (tests in `tests/` and elsewhere), leaving 22. The tests catch
5 of those; the other 17 are listed in "Survivors that are fine": changes that cannot alter behaviour (equivalent
mutants), that only matter for input the code never receives, or proposal 3.

### Survivors that are fine

The 17 changes no test catches, and why none should:

- `time.ts`, `profile.ts` (attempt loop) and `config.ts`: a loop bound or a first-index check one step
  wider reads `undefined`, which the next comparison or `Number.isFinite` turns into "no change".
- `ties.ts` `next !== undefined && next !== index` to `||`: a missing continuation
  is then stored as `undefined` and never followed.
- `history.ts` trimming at `>= UNDO_LIMIT`: slicing an array of exactly the limit returns the same items.
- `migrate.ts` (profile v0) `completions + 1` to `- 1`: only `completions === 0` is ever read.
- `repository.ts` tie-break by id: the keys are already read in id order and the sort is stable.
- `timing.ts` (two) and `classify.ts`: at the edge both branches give the same answer (a score of 100 either way, an
  error of 0 is on time before its sign is looked at, a difference of 0 is never a wrong key).
- `rundown.ts` (two): differ only for a session with no round finished but an accuracy, which the free-play summary
  never produces.
- `hitTest.ts` (two): whether a tap exactly 1.6 note-heads away, or exactly half way between two staves, picks one
  thing or the other is arbitrary by design; a test would only freeze the current pixel.
- `staff.ts` rooms above the staff: a real gap, proposal 3.

## Proposals

1. **Report `src/io` coverage, and gate it.** `src/io` is at 96 % of lines and 92 % of branches.
   Adding `src/io/**/*.ts` to `coverage.include` in `vite.config.ts` at the same 90 % (the composition roots and the
   hardware wrappers are all testable with the fakes in `tests/helpers/`) would keep it there. A change to the CI gate,
   so for the maintainer to decide; `docs/testing.md` section 5 would change with it.
2. **Mutation testing as a periodic check.** StrykerJS (`@stryker-mutator/core` with the Vitest runner, Apache-2.0)
   does what the probe did, properly: all operators, every file, incremental runs, an HTML report. It is too slow for
   every pull request; a weekly or manual workflow on `src/core` with a "mutation score must not drop" rule is the usual
   use. A new dependency, so it needs a ledger entry and `docs/dependencies.md` before anything is added.
3. **Pin the staff's vertical rooms.** Swapping the treble and bass room above the staff (`staffRooms` in
   `core/layout/staff.ts`) changed no unit test; only a screenshot would notice. A small table test of the rooms per
   clef and range would make that change visible in the unit tests.
