# Static analysis

`npm run analyze` is the project's deep static analysis, the counterpart of what Klocwork, Coverity or PC-lint do for C and
C++. It is slower than `npm run lint` (about 40 seconds against 10), so the Stop hook does not run it; CI does, on every push
and pull request, in the `check` job. Decision: [d063](../decisions/workflow.md#d063).

## The three passes

| Command | Tool | What it finds | C/C++ analogue |
|---|---|---|---|
| `npm run analyze:types` | ESLint with the TypeScript type checker loaded (`eslint.analyze.config.js`) | Promises nobody waits for or that are passed where a plain callback is expected; values whose type is `any` or failed to resolve; casts that change nothing; text built from `undefined` or an object; a `switch` over a union that misses a member | Klocwork's dataflow checkers: unchecked return values, uninitialised use, redundant casts |
| `npm run analyze:unused` | knip (`knip.json`) | Files nothing imports, exports nobody uses, packages in `package.json` nothing uses (and imports of packages not listed) | Dead-code and unused-symbol reports; a linker map that shows unreferenced objects |
| `npm run analyze:dupes` | jscpd (`.jscpd.json`) | Copy-pasted blocks of 8 lines or more in `src/` and `tools/` (tests excluded); fails above 1% duplicated lines | Clone detection (Klocwork, PMD CPD) |

`npm run lint` keeps the fast, syntax-only rules, including the architecture boundaries (what `src/core`, `src/game` and the
spike page may import) and two size limits that apply to the TypeScript in `src/` and `tools/` (not to tests, the `.js` config
files or `.claude/hooks`): cyclomatic complexity 30 (the number of independent paths through a function) and nesting depth 5.

Why a separate config and not one ESLint run: type-aware rules need the whole program type-checked first (the same work as
`tsc`), which quadruples the lint time. The fast lint stays in the Stop hook loop; the slow one runs where waiting is free.

## Reading a finding

- **`no-floating-promises` / `no-misused-promises`.** In a browser game an `async` function's error does not crash anything:
  it becomes an "unhandled rejection" in the console and the screen just stops reacting. Either `await` it, handle the
  error with `.then(ok).catch(failed)` (not `.then(ok, failed)`, which misses an error thrown inside `ok`; lint forbids it), or, when the function catches its own errors, write `void f()` to say the result is
  dropped on purpose.
- **`no-unsafe-*`.** A value is `any`: the compiler checks nothing about it. Usually an untyped boundary (JSON, a
  `declare module`). Fix the type at the boundary, not with a cast at each use. The first run found one: the
  `virtual:pieces` declaration imported a relative path inside `declare module`, which TypeScript silently turns into an
  error type, so every piece's `meta` was `any` in the game.
- **`no-unnecessary-type-assertion`.** `x as T` or `x!` where `x` already is `T`. Harmless today, but a cast that stays after
  the type changes hides the next real mismatch. `--fix` removes them.
- **knip: unused export.** Delete it, or make it file-local. A type that is part of a data model on purpose (a chart bar,
  a save block) may stay exported with a `/** @public */` tag.
- **jscpd: clone.** Extract the shared part when both copies mean the same thing; leave it when they only look alike.

To silence a single finding, write the reason next to it:
`// eslint-disable-next-line <rule> -- <why>`. Never disable a rule file-wide.

## Complexity hotspots

These functions are above the complexity limit (30) or nesting limit (5) and carry a disable comment pointing here. Each is
a candidate for splitting; the comment goes when the split lands.

Split (the disable comments went with them): `lintPiece` (one function per rule, run from `RULES`), the ABC
scanner (`MusicLine` with `readChord`, `readRest` and `flushFinger`; the header fields are a table of readers),
`layoutStaff` (`planFrame`, `layoutSystems`, `layoutStaffNotes`, `layoutStaffRests`, glyph metrics in `GLYPH`) and
`generatePiece` (`validateRequest`, then the candidate loop). Split: `BattleResultsScene.draw` (the XP line and the
outcome panel it shares with `ResultsScene` live in `src/game/results/OutcomeScene.ts`).

None is left. A new one gets a table here: the function, its complexity, why it is big and how to split it.

## What was considered and not added

- **dependency-cruiser** (MIT): checks import rules and import cycles. The import rules already live in ESLint
  (`no-restricted-imports`), and a trial run found no cycles among 348 modules. Worth adding if a cycle ever
  appears.
- **eslint-plugin-sonarjs**: cognitive complexity and bug patterns, but LGPL-3.0 since version 1, and the project prefers
  MIT/BSD/Apache tools.
- **The full `strictTypeChecked` preset**: 2,200 findings on the first run, 1,000 of them the `!` non-null assertion that
  `noUncheckedIndexedAccess` makes necessary for array access, and 470 template literals with numbers. The rules above are
  the subset with real bug-finding value and no noise.
- **SonarQube / CodeQL**: server-side, heavier; not set up.
