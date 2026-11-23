---
id: "au08"
summary: "The human approval gate"
---
# au08: Human approval gate

Part of [piece authoring](AUTHORING.md).

A parent or teacher reviews each draft in the preview tool (`docs/authoring/au09-preview-tool.md`) and approves it with the **Approve for the student** button, or from a phone on the review board (`docs/authoring/au10-review-board.md`), whose picks a thread records with `npm run piece:board -- --apply` through the same checked write. The button asks first, then asks the dev server to change `"status": "draft"` to `"approved"` in that piece's `piece.meta.json` (only that value changes, so a review sees a one-line diff). The server checks the piece again itself: it refuses to approve a piece that does not compile or has any linter error. **Back to draft** works at any time. Warnings do not block, but the question shows how many there are, to be read first. The game's content loader ignores drafts outside dev mode (`offeredPieces`, unit-tested), and a piece with any compile or lint error is left out of a production build altogether. This keeps generated material appropriate and playable for the student.

**Only a human approves.** The write is a request any program on the machine could make, so this is a rule for agents too: never set `"approved"` by hand, by script or by calling the endpoint on its own judgement; the one exception is recording the option the maintainer picked on a pick board, named in the pull request (d262). The server accepts the request only from the preview page's own origin with a JSON body, so another website cannot do it, and the endpoint exists only on the dev server: a production build has no way to change a status.
