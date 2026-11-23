---
id: "ft_0_11"
title: "Piece preview and first content"
scope: "Preview tool, approval workflow, menu paging, first pieces"
effort: "done"
status: "done; review and approval open (Human)"
completeness: 100
---
# ft_0_11: Piece preview tool and first content

Index: [FEATURES.md](FEATURES.md). A human reviews and approves the pieces.

## Rules

- `npm run piece:preview` is a page that loads an ABC file, shows lint output, renders the staff with the game's renderer, plays audio and allows play-along (`docs/authoring/au09-preview-tool.md`). It is built on the compile result (text in; chart, meta and diagnostics out; no file access in compile and lint), so a later importer's output previews on the same page.
- The content manifest and loader enforce the approval gate (`au08-approval.md`): `tools/vite-pieces.ts` provides `virtual:pieces` (every piece in `content/pieces/` compiled and linted; a piece with errors is left out and fails a production build); the menu shows drafts only in the dev server.
- The review board (`npm run piece:board`, `docs/authoring/au10-review-board.md`, d262) shows every draft as a sheet with a Play button on a private page in the Claude app; the maintainer picks Approve or Not yet from a phone, and a thread records an approve pick through the same checked write, only while the piece's files are still the ones the board showed.
- 11 draft pieces for levels 1 to 5 are in `content/pieces/`; the human reviews, listens, plays along and approves them (the level table they target is provisional). Generators are ft_0_12; import is not here.

## Acceptance criteria

- **ft_0_11.AC1** The human can review and approve pieces without running the full game.
- **ft_0_11.AC2** Unapproved pieces are hidden from the game outside dev mode.
- **ft_0_11.AC3** The maintainer can look at, listen to and approve a draft piece from a phone, and a piece that changed after it was looked at is never approved by that pick.
