# Test coverage and test strength

A review of how well the unit tests protect the code: where logic has no test, and where a test runs the
code but would not notice it breaking. It complements [maintenance.md](maintenance.md) (which listed
"coverage outside the gate" as a proposal) and [static-analysis.md](static-analysis.md). What was fixed is in the pull
request that added this file; what is left is listed as proposals at the end.

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
test that imports the file, 29 more were caught (tests in `tests/` and elsewhere), leaving 22. The tests added here catch
5 of those; the other 17 are listed in "Survivors that are fine": changes that cannot alter behaviour (equivalent
mutants), that only matter for input the code never receives, or proposal 5.

### Bugs the new tests found (fixed)

- **`piece:generate --regenerate` crashed with a stack trace** when a piece's `piece.meta.json` was not valid JSON. It
  now prints "the meta file of ... is not valid" and exits with 2, like a meta file that is JSON but wrong.
  (`tools/generate/run.ts`, test in `tools/generate/run.test.ts`.)
- **On-screen keyboard: two fingers on one key played it twice.** On a tablet a second finger on a key that was already
  down sent a second note-on, and lifting the first finger sent a note-off while the key still looked pressed. A real
  key cannot be pressed twice; now the key sounds once and lifts with the last finger. In Wait mode on a piece with a
  repeated note the extra note-on could have moved the cursor on by one note. (`src/io/mock/OnScreenKeyboard.ts`,
  test in `src/io/mock/OnScreenKeyboard.test.ts`.) Needs human: try it with two fingers on the tablet.

### Tests added where there were none

- Editor undo history: limit of 200 steps, a new edit after an undo drops the redo, undo then redo is the identity
  (property).
- On-screen keyboard (press, release, two keys, two fingers on one key, lit keys, dispose) and the input composition
  root `createKeyboardInputs` (playable before MIDI is ready, missing Web MIDI is the status "unsupported", the virtual
  EZ-220 merges in, dispose). They use a small fake DOM in `tests/helpers/fakeDom.ts` instead of a new dependency
  (jsdom or happy-dom).
- Text files: the download link and the file picker, including cancel, no file and an unreadable file.
- Audio composition root: latencies reported in ms, and the unlock that keeps retrying on each tap until the browser
  lets sound start, then stops listening (without it a student would hear nothing).
- Tempo-mode timing windows (`timingOf`): the perfect and good windows include their edge, the score falls in a straight
  line, never below 0, is symmetric and never rises further from the beat (property).
- Profile service: Wait/Tempo mode and bar numbers are saved per player and survive a restart.
- Monster files: a broken file and a colour not in the palette fail with the file name; a picture of only outline and
  eye colours keeps its colours at every stage.
- The focus ring bitmap, and `piece:generate` help, word seeds, `--bars` that is not a number, a broken level table.
- A damaged save, any field of any version from 0 to 14 replaced by random JSON, is reported, never thrown (property).

### Tests made stronger

The probe's survivors that were real gaps, each now pinned by a test: a section of one bar is named "bar 3", and a
section out of range is refused by its own check (the old `toThrow()` also passed on a crash); a note and a rest may end
exactly on the last bar line; two hands exactly the together window apart still count as together; a click on a bar line
belongs to the bar that starts there; a tie in the keyboard focus goes to the first button; a score exactly on a star
boundary earns the star; equal wrong-key extents are allowed; monsters of the same level are picked by id whatever
the file order; a one-bar level in the campaign ladder; a find-the-key step list that is empty; a fractional or string
`schemaVersion` is called invalid, not "no migration"; the first attempt of a piece sets its start tempo; an own
piece whose author is blank says "a player"; a Tempo-mode press exactly at the end of its window counts and one
ms later is a miss; notes placed at the same time in the editor keep one order (right hand first, then low to high);
a broken save names the position of the attempt that is out of order; the idle detector accepts the same time
twice; the latency estimate keeps a tap exactly 100 ms from the median. Two assertions that could not fail
(`expect(...).toBeDefined()` on a value that is always defined) now check the verdicts and the beams they were about.

### Survivors that are fine

The 17 changes no test catches, and why none should:

- `findDoor.ts`, `time.ts`, `profile.ts` (attempt loop) and `config.ts`: a loop bound or a first-index check one step
  wider reads `undefined`, which the next comparison or `Number.isFinite` turns into "no change".
- `ties.ts` (was `steps.ts` and `playback.ts`) `next !== undefined && next !== index` to `||`: a missing continuation
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
- `staff.ts` rooms above the staff: a real gap, proposal 5.

## Proposals

1. **Report `src/io` coverage, and gate it.** With this pull request `src/io` is at 96 % of lines and 92 % of branches.
   Adding `src/io/**/*.ts` to `coverage.include` in `vite.config.ts` at the same 90 % (the composition roots and the
   hardware wrappers are all testable with the fakes in `tests/helpers/`) would keep it there. A change to the CI gate,
   so for the maintainer to decide; `docs/testing.md` section 5 would change with it.
2. **Mutation testing as a periodic check.** StrykerJS (`@stryker-mutator/core` with the Vitest runner, Apache-2.0)
   does what the probe did, properly: all operators, every file, incremental runs, an HTML report. It is too slow for
   every pull request; a weekly or manual workflow on `src/core` with a "mutation score must not drop" rule is the usual
   use. A new dependency, so it needs a ledger entry and `docs/dependencies.md` before anything is added.
3. **One tie-chain helper (done).** `core/judge/steps.ts` and `core/chart/playback.ts` built the same map from a tied
   note to its continuation with the same lines; both now use `tieLinks` in `core/chart/ties.ts`, which has its own test.
4. **One migration runner (done).** `migrateChart` and `migrateProfile` shared their version loop and checks word
   for word; both now call `upgradeToCurrent` in `core/upgrade.ts`, which has its own test.
5. **Pin the staff's vertical rooms.** Swapping the treble and bass room above the staff (`staffRooms` in
   `core/layout/staff.ts`) changed no unit test; only a screenshot would notice. A small table test of the rooms per
   clef and range would make that change visible in the unit tests.
6. **`src/game` logic outside scenes.** The helpers without Phaser are tested; what is left untested there is Phaser
   code (`PixelObjects`, `PieceInfoCard`, `StaffView`) and `game/content.ts` (which reads a Vite virtual module). The
   dev autoplay director (`src/dev/autoplay/director.ts`) is only run by the demo end-to-end tests. Both are acceptable
   where they are; a test seam for `content.ts` (pass the piece files in, as `loadMonsters` does) would let the
   draft and own-piece merge be unit-tested. **Done:** `PieceCatalogue` takes its sources as arguments and is
   unit-tested (`src/game/pieceCatalogue.test.ts`).
