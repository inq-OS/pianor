---
id: "ft_0_04"
title: "Piece linter and levels"
scope: "Level rules from `levels.json`, `piece:lint`, difficulty score"
effort: "done"
status: "done; level table provisional (human review open)"
completeness: 100
---
# ft_0_04: Piece linter and levels

The rules of `docs/authoring/au05-linter.md` with `content/curriculum/levels.json` and the difficulty score; `npm run piece:lint` over `content/pieces/`. The starter level table is provisional (adjusted after the curriculum is clarified); the maintainer confirms or replaces it (AX-0.4: no school's book is needed).

## Acceptance criteria

- **ft_0_04.AC1** Each hard rule has a failing and a passing test fixture.
- **ft_0_04.AC2** Warnings are reported separately from errors, and the exit code is non-zero on errors.
- **ft_0_04.AC3** The level table is reviewed by the maintainer (AX-0.4: Pianor follows no school's method book). [human]

## TODO

Work tags ([todo-tags.md](../automation/todo-tags.md)).

- TODO(builder, R2): a real-piece level (whole pieces of any length must be importable). Today even level 5 refuses a real classical piece: at most 32 bars, C3 to C5, small leaps, no chords, five-finger fingering, parts of 2 to 8 bars (`phrase-length`), and the game leaves out any piece with a lint error (`tools/vite-pieces.ts`). Add one level in `content/curriculum/levels.json` that checks only what the staff can draw and the EZ-220 can play: no bar maximum, the full keyboard (MIDI 36 to 96), chords and ties on, no leap limit, no hand positions; parts of any length that nest (the `phrase-length` rule follows the level); the piece maker's `MAX_BARS` raised to match with pages. A synthetic 64-bar two-hand piece with chords and a 16-bar part lints clean at that level and builds. AX-0: real music is what school teaches.
