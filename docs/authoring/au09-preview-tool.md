---
id: "au09"
summary: "The preview tool (`piece:preview`)"
---
# au09: Dev-time playground: the preview tool

Part of [piece authoring](AUTHORING.md).

`npm run piece:preview` starts the dev server and opens `/?demo=preview` (add `&device=virtual` to play along without a keyboard). The left panel lists every piece in `content/pieces/` as it is on disk, with status, level, difficulty and the number of errors and warnings, plus a **scratch** piece for pasting any ABC. Selecting a piece shows its facts (level, the levels it fits, licence), the linter's messages (click one to jump to its line) and its two files in boxes. The right side is the game's own staff renderer, so what you see is what the student sees (a piece the game cannot draw yet says why instead).

- **Listen** plays the piece with the sampled piano at 100%, 75% or 50% speed and lights the notes as they sound.
- **Play along** opens the real practice scene on this chart (Wait mode, with the on-screen, computer or MIDI keyboard) to check playability. It earns no XP and saves nothing; Back or Escape returns to the preview, with the result.
- **Note names** and **fingers** show the hints the student can switch on.
- **Approve for the student** and **Back to draft**: see `docs/authoring/au08-approval.md`.

Edits in the boxes are for trying things out: the page checks and redraws as you type, but nothing is written to the files (the scratch piece is kept for the browser session). Edit the files in your editor; the page reloads when they change. The page runs the same compiler and linter as `npm run piece:lint` (`checkPiece`), so the two never disagree.
