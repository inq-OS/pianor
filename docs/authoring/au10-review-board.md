---
id: "au10"
summary: "The review board (`piece:board`): look, listen and approve drafts from a phone"
---
# au10: The review board

Part of [piece authoring](AUTHORING.md).

The preview tool (au09) needs the laptop. The review board is the way to approve from a phone: one page in the Claude app that shows every draft piece as a sheet, plays it, and takes the maintainer's pick. It is the tap-to-play pick board of [d262](../decisions/workflow.md#d262) for pieces (ft_0_11.AC3).

**What the maintainer sees.** For each draft: its title, level, hands, tempo and licence; the sheet, drawn from the piece's own ABC by abcjs (MIT, the one script the page loads, pinned in `tools/board/board.ts`); the compiler's and linter's warnings; **Play** at 100%, 75% or 50% speed (a simple built-in synth on the phone, both hands, the computer's part softer); a box for what should change; **Approve** and **Not yet**; and, folded away, the source and the ABC. A tally at the top counts what is left to look at. The sheet is abcjs's drawing, not the game's staff, so a doubt about how the student will see a bar is settled in the preview tool.

**How a thread runs it.**

1. `npm run piece:board` writes `test-logs/board/index.html` (gitignored) with every draft that compiles and passes its level; drafts with errors are listed as left out.
2. The thread publishes that file as a private Artifact with `capabilities: { db: { rules: [{ path: "picks", read: "view", write: "owner" }] }, user: {} }`, so only the owner (the maintainer) can pick, and gives the maintainer the link. Republishing to the same link keeps the picks.
3. Each pick is saved at once as `picks/<piece id>`: `{ pick: "approve" | "draft", hash, note, at }`. `hash` is the fingerprint of the piece's two files as the board showed them.
4. When the maintainer says they are done (or the thread looks), the thread reads the `picks` collection, writes it to a JSON file (a list of `{ id, pick, hash, note }`) and runs `npm run piece:board -- --apply <file>`. An approve pick sets `"status": "approved"` through the same checked write as the preview tool (au08), and only while the files still have the fingerprint the board showed; an edited piece is refused and goes on the next board. A "not yet" pick changes nothing and prints the note, which the thread turns into the fix.
5. The pull request that carries the status changes names the board's link (d262). An agent never picks on the board itself.

Nothing here hosts the game (d068): the board is a private review page of drafts, and the student's game still runs only on the student's machine.
