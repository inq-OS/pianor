---
id: "ft_0_03"
title: "ABC compiler"
scope: "Own strict ABC parser, `piece:build`, errors with line and column"
effort: "done"
status: "done"
completeness: 100
---
# ft_0_03: ABC compiler (tools)

Index: [FEATURES.md](FEATURES.md).

`npm run piece:build` compiles `piece.abc` and `piece.meta.json` in `content/pieces/` into chart JSON. Own strict parser, no dependency (abcjs was rejected: `docs/authoring/au02-abc-subset.md`, d018). Tests: `tools/piece/`, `tests/golden/`.

## Rules

- Subset: one or two voices, treble or bass clef, key of C, meters 4/4, 3/4, 2/4, note values whole to eighth, rests, bar lines, tempo, fingering decorations. Later notation: core_09.

## Acceptance criteria

- **ft_0_03.AC1** The example in `docs/authoring/au01-piece-files.md` compiles to the expected chart (golden-file test).
- **ft_0_03.AC2** Unsupported syntax gives a clear error message with a line number.
