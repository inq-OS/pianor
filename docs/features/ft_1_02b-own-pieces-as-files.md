---
id: "ft_1_02b"
title: "Own pieces as files"
scope: "Export and import; dev server saves to `private/pieces/`; licence `NaN` for private pieces"
effort: "simple"
status: "slice built: licence rule, export and import; dev-server save open"
completeness: 67
---

# ft_1_02b: Own pieces as files

Export a piece from the editor as a file and import it on another device (part of ft_1_02, item 4). Own pieces are never written to `content/pieces/` and never deployed. Index: [FEATURES.md](FEATURES.md).

## Rules

1. **Licence** (`src/core/piece/lintRules.ts`, `folder.ts`): `license: "NaN"` gives no warning in a folder named `private/pieces` (`isPrivatePiecesDir`; `checkPiece` takes `privatePiece` for text outside a folder, which the editor uses) and a warning that says why anywhere else. It is a warning because a human reviews licences (`--strict` makes it fail). `npm run piece:lint private/pieces` lints the private folder; a missing or empty one prints "No pieces found" and exits 0. `private/` is gitignored (d026).
2. **Piece file** (`src/core/editor/pieceFile.ts`, pure, d050): `exportPieceFile` writes one JSON file (`kind: "pianor-piece"`, `schemaVersion: 1`, id, author, content version, the editor piece, ABC and meta text). `importPieceFile` reads it with zod and returns a reason and a message (string keys) instead of throwing. It refuses an id that is not an own id (`own-...`), a licence other than `NaN`, an id in the given `reservedIds` (bundled pieces), a newer `schemaVersion` (only v1 exists; the place for a migration is marked), and an editor piece that breaks any editor rule (`pieceProblem`: keyboard range, grid, bar line, no overlap, a hand the piece has). Fixture `tests/fixtures/pieceFiles/piece-file.v1.json` (synthetic).
3. **In the game:** `OwnPieces.exportFile` and `importFile` (an import is always a new own piece with a free id, never a replacement); `src/io/files/textFiles.ts` holds the download and file picker (the only DOM code), reached through the `files` interface of the game context (`src/io/files.ts`). The editor has Export and Import next to Save. Export saves first when there are changes. Import leaves the piece being written alone and says "Added ... to your pieces."
4. The ABC and meta inside a file are read and checked but not used: the receiving device writes its own from the editor piece when it saves, so editing the ABC by hand has no effect.
5. Tests: `tools/piece/license.test.ts`, `src/core/editor/pieceFile.test.ts` (property), `tests/editor/ownPieceFiles.test.ts`, `tests/e2e/editor.spec.ts`.
6. Not built: the dev server saving into and loading from `private/pieces/<id>/` (with the guards of the preview tool's endpoint), deleting an own piece, a picker for pieces on a phone. Not verified: download and import on a real tablet; the `editor-1366x768` baseline needs regenerating (the top bar changed).

## Acceptance criteria

- **ft_1_02b.AC1** Export then import gives the same piece: the editor piece, the ABC text and the meta text of the file (property test), with licence `NaN` kept. (The game then saves the imported editor piece as a new own piece and writes its own ABC and meta from it.)
- **ft_1_02b.AC2** A file that cannot be used is refused with a readable message and nothing is changed: not JSON, not a Pianor piece file, a newer file version, damaged content, a piece that is not an own piece, an id that belongs to a bundled piece. Reading never throws.
- **ft_1_02b.AC3** The licence rule warns for `NaN` in `content/pieces/` and not in `private/pieces/`; every other licence is judged as before.
- **ft_1_02b.AC4** In the editor, Export downloads the piece as a file and Import adds the piece in a chosen file as a new own piece (end-to-end test).
- **ft_1_02b.AC5** (not built) A piece saved from the dev server lands in `private/pieces/<id>/` and nowhere else.

