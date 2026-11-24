# Maintenance sweep

A whole-codebase review: the static analysis added in d063, three read-only audits (core and
tools; game, io and dev; docs and tests), and what they found. This file lists
what is open and the proposals. Larger items are numbered below.

## In one paragraph

The architecture holds. `src/core` imports no Phaser, DOM, Web MIDI or Web Audio; time runs in ticks on an injected
clock; the judge talks to the tug, progression and the scenes only through versioned events; every persisted format has a
schema, a `schemaVersion` and a migration path; there are no import cycles (348 modules). The debt is of two kinds:
**copy-paste** of small things (music primitives in core, building blocks in scenes), and **async edges** in the scenes,
where a promise was started and nobody handled its failure or a second click. In C/C++ terms: the hardware layer is
clean, the application layer has grown by copying functions between files, and a few callbacks had no
re-entrancy guard.

## Open

| Item | What | Size |
|---|---|---|
| 1 | Profile migrations read today's defaults, so changing a default rewrites old saves | small, save format |
| 4 | Scenes: speech bubble, results panel, option rows, top bar and typed scene keys as shared blocks | small each |
| 5 | Core: one home for music primitives; split `lintPiece`, `parseAbc`, `layoutStaff`, `generatePiece` | medium to large |
| 6 | English in the editor's status line and the tag ids on the info card | small |
| 7 | Tests and docs tooling: untagged core features, path check scope | small each |

## Proposals and ideas not filed

These are judgement calls or questions for the maintainer rather than defects; listed so they are not lost.

- **XP bank bite.** `baseBite` in `src/core/scoring/xpBank.ts` returns at least 1 even when the configured `bitePercent`
  is 0, which the content schema allows, so the bite cannot be switched off from content. Either the schema says
  `min(1)` or the code returns 0. The maintainer's call.
- **Sections are recognised by their id** (`isSection` looks for `#bars-` in the chart id), and that decides whether XP is
  paid. A field on the chart, or `sliceChart` returning `{ chart, section }`, would be sturdier; it touches the chart
  schema, so it is an architect question.
- **Localised text in the data layer.** `core/chart/tempoLabel.ts` and `core/editor/pieceFile.ts` return English strings;
  returning keys and parameters would keep the chart model free of UI text.
- **Fixtures.** `docs/testing.md` aims for a canonical fixture per level and notation feature; there are two. A fixture
  each for rests, eighths, dotted half notes and chords would make the golden and replay tests broader.
- **Coverage outside the gate.** Only `src/core` and `tools/` are gated at 90%; a gate on `src/io` is proposal 1 in
  [test-coverage.md](test-coverage.md).
- **Move `CompositeKeyboard`** out of `src/io/mock/`: it is production code (it merges the real MIDI input).
- **Complexity limit.** Once the hotspots in [static-analysis.md](static-analysis.md) are split, lower the limit from 30
  to 20, the usual threshold in C metrics tools.
