# Playtests

A session is about a student, so its notes never enter the repo (d165): write them in the gitignored `private/playtests/ptNN-name.md` with the template below. What a session teaches comes into the repo only as a plain rule (a ledger entry) or a tag in the doc it belongs to, with no names, dates, quotes or anything else about the student. Nothing here is filled in by an agent: only what a person saw.

## Sessions

<!-- docs:index playtests -->
| ID | Pieces | Main finding |
|---|---|---|
| none yet |  |  |
<!-- /docs:index -->

## How to run the first playtest (ft_0_09a)

1. Connect the EZ-220 over USB, open the game in Chrome or Edge (`npm run dev`, then `http://localhost:5173/`), and allow MIDI when the browser asks. The bottom line of the practice screen says "Piano: ..." when the keyboard is found, and the on-screen keys disappear.
2. Choose "Little Steps" first (right hand, C to G). Sit with the player; do not explain the staff unless they ask.
3. Let them try without hints, then with "Note names" and "Fingers" if they get stuck. Watch whether they look at the screen or at the keys.
4. Try one more piece (e.g. "Rest Waltz" or "High and Low") if they are still happy.
5. Copy the template below into a new private session file straight after, while it is fresh.

If the piano is not found: check the cable, close other programs using MIDI, try the other browser, and note what happened (this is hardware information for `docs/hardware-notes.md`).

## Template (copy into `private/playtests/ptNN-name.md`)

```
# ptNN: piece(s), level

- Who / device / browser / how it was connected:
- Duration:
- Understood without help:
- Where they stalled (note, bar, moment):
- Hint use (names / fingers / none) and whether it helped:
- Wrong-key feedback: did they read the message? Did it help?
- Staff size and readability (could they see the notes? too small, too big?):
- Mood and fun (1 to 5), and what they said:
- What to change (and link to the issue or commit):
```
