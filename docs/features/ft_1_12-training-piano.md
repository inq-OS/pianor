---
id: "ft_1_12"
title: "Training piano"
scope: "The room's piano is training: one piece list (no mode tabs, no Free play), play that loops with a score past the last bar, one score screen with the development graph, an optional stats pane in place of the on-screen keyboard"
effort: "large"
status: "in progress: one piece list, looping play with a five-star grade, one score screen with the graph and the stats pane are built; the try-out with the student is open"
completeness: 95
depends_on: ["ft_0_09", "core_04", "ft_1_07", "ft_1_08"]
---
# ft_1_12: Training piano

Index: [FEATURES.md](FEATURES.md). The redesign of the piano; piece XP and levels are ft_1_13.

The room's piano is training only: it plays pieces and improves each piece; player XP and levels come from the door (ft_1_06, ft_1_13). One piece list, one score screen. AX-0: fewer screens between the student and the staff; AX-2: just enough game.

## Rules

1. **One piece list.** No mode tabs, no hint bubble (clean-screen rule). First card "+ New piece" (when the editor is on), then every piece the player has turned on. A card plays its piece (a tap plays at once). An own piece has a small pencil that opens the piece maker; a piece with parts (core_06) has a small parts button (AX-3 provisional). The room's piano is the one way to the list; the book is hidden. The main menu has no Free play; its Piece maker opens the same list with only own pieces. Challenges are the door's (ft_1_06). The "Many monsters" setting stays until the architect decides about the prototype.
2. **Looping play.** The piece plays until the student quits. Each pass is saved; after the last bar its score (five stars, accuracy) is drawn past the last bar for 2 seconds and play wraps to bar 1 (`core/layout/passScore.ts`). A section loop never scores. Escape or Back opens the one score screen (`ResultsScene`: session lines, XP of all passes added up by `mergeOutcomes`, level). There is no Free play and no `RundownScene`.
3. **Score screen.** Shows the piece's development graph (core_04's `historyGraph`, left out under 30 rows) in its numbers column. The `S` button opens the same screen without a session (title, best stars, numbers, graph). The score screen has two icon buttons (play again, the pieces) and no text.
4. **Stats pane.** A toolbar switch (four rising bars) puts a pane under Kiur's bar in place of the on-screen keyboard: the latest 8 full plays as bars from 50 to 100 percent, lines at the five-star grade edges (75, 85, 95 percent), a fitted trend line and the newest play's percent (`core/layout/statsPane.ts`). Kept for the session, not saved (AX-3 provisional: 8 plays, bars from 50 percent).
5. **Wrong keys.** No sentence after a wrong key: the key played shows as a faint named note beside the awaited one, spelled in the piece's key with ledger lines, in the wrong colour (`core/layout/playedMark.ts`, `StaffView.setPlayed`; AX-3 provisional: 2.6 head half-widths right of the column, until the next right key). The judge still gives the reason. Over every bar stands that play's count of wrong presses as a bare number, green at 0, red above (from `mistakes`, no save change).
6. **Pass numbers.** After each pass Kiur says its numbers in the bottom bar: share right the first time, wrong keys, the timing score in Tempo mode (`passLines` in `core/text/rundown.ts`). They show with the stars and stay 6 seconds into the next pass (a wrong note's feedback clears them). AX-3 provisional: 6 seconds.
7. **Five stars.** Every grade the player sees is out of five (`GRADE_STARS`, `passStarsFor` in `core/scoring/stars.ts`): stars past the last bar, a card's best (`PieceRecord.bestGrade`), the score screen, a part's best (`partStars`) and the stats lines; "New best!" means a higher five-star grade. An attempt still saves the three-star `stars` the XP rules read; the grade is worked out from the saved accuracy; the XP improvement bonus stays on the three-star scale.
8. **Space bar** restarts the piece, or the section being practised, from its first bar (`PracticeScene.resetPlay`, `reset: true`): the judge starts over, the click restarts, Tempo mode counts in at once, the unfinished pass is not scored, played keys stay in the session's numbers, a section keeps its lap and tempo ramp. No button. Shift+R goes back to the whole piece (AX-3 provisional).
9. **Kuula (listen)** switch (an ear; a square while it plays) plays the piece or section from its first note at the tempo percent, notes lit as they sound, keys not judged (`src/game/practice/ListenAlong.ts`, `PracticeData.listen`); no count-in, no click, no speech (AX-3 provisional); its end starts the piece over at bar 1; any other restart ends it; the space-bar reset keeps it. The staff stays on screen so the student reads while hearing (AX-0.1).
10. **Bookmarks and order.** Four ribbon bookmarks hang in the left page's outer margin, one under another (each a picture, its name in the tooltip): All (1 2 3), own pieces (the pencil), the teacher's (a white mortarboard) and the characters' (a head). The one the book is open at reaches past the book's edge in full colour and lies over the page's margin up to the pieces; a press on another opens the book there, at its first page. Under a bookmark the book shows only that group's pieces (a piece in two groups is under both); the new piece's staff only under All and own; an empty bookmark says so and keeps its bookmarks. The strip's first cell is the order: its picture is the order in use, and a press opens the six choices as pictures in a row: as listed (1 2 3), most stars first (a star), nearest deadline first (an hourglass; pieces with no deadline after), easiest first (the steps, by the piece's level), A to Z, and last played first (a clock; never played after). Ties keep the listed order (`orderBook`, `src/core/layout/bookOrder.ts`; `piecesUnderBookmark`, `src/game/pieceList.ts`). The left page's pieces sit nearer the spine than the right page's, which leaves the left page's outer margin to the bookmarks (the right page's outer margin is kept free for more). The book turns its pages without words: each page's number stands at its foot between two small ink diamonds (1 and 2 on the first spread), and a page's bottom outer corner is turned up while there is a page that way; a press on it turns the page (Previous and Next in its tooltip). AX-3 provisional: the bookmark and the order are kept for this visit of the game only, not saved; the ribbons and corners are the builder's simple drawing until the painter paints them.

## Acceptance criteria

- **ft_1_12.AC1** The piece list is one list, with no tabs and no Kiur bubble; a card starts practice of its piece; the main menu has no Free play; the room's piano is the one way to the piece list (the book is hidden).
- **ft_1_12.AC2** An own piece's card has a pencil that opens it in the piece maker; "+ New piece" is the list's first card; a piece with parts has a parts button that opens its part cards.
- **ft_1_12.AC3** Play loops: after the last bar the pass score is shown past it and play continues from bar 1; a section loop containing the last bar shows no score.
- **ft_1_12.AC4** Quitting a play shows one score screen with the session's passes and the piece's development graph.
- **ft_1_12.AC5** A toolbar switch shows a stats pane with the last N plays in place of the on-screen keyboard.
- **ft_1_12.AC6** Is the one list, the loop and the score past the last bar clear to the student? [human]
- **ft_1_12.AC7** No sentence after a wrong key: the key that was played shows as a faint named note beside the awaited one (what was played, not which way to go); the score screen has two small icon buttons (play again, the pieces) and no button text.
- **ft_1_12.AC8** The space bar starts the piece, or the section being practised, over from its first bar: the judge starts over, the click restarts, and in Tempo mode the count-in starts at once; the unfinished pass is not scored and the keys played so far stay in the session's numbers.
- **ft_1_12.AC9** A Kuula (listen) switch on the toolbar (an ear; a square while it plays) plays the piece, or the section, from its first note at the tempo percent with its notes lit on the staff as they sound; the keys are not judged meanwhile; at its end or on a press of the square the piece starts over at bar 1 to be played.
- **ft_1_12.AC10** The piece book marks each piece's groups at the right of its title (an own piece's pencil, a character's speech bubble in its colour, the teacher's hat, ft_1_26.AC8), and its bookmarks (All, own, the teacher's, the characters') each show that group's pieces only, All every piece.
- **ft_1_12.AC12** The book has no words for its pages: each page's number at its foot, and a turned-up corner on each side that can turn, which turns the page.
- **ft_1_12.AC11** The book's order button opens its choices as pictures, and each puts the pieces in its order (as listed, most stars, nearest deadline, easiest, A to Z, last played), ties in the listed order.

## TODO

Work tags ([todo-tags.md](../automation/todo-tags.md)); the closed issue in brackets keeps the earlier discussion.

- NEEDS-HUMAN: the try-out with the student of the one piece list, looping play, the score screen and the stats pane.
- TODO(builder, R2): under the band (ft_1_20) the score screen's main area is 124 rows, not 157, and after a session with its XP lines the development graph has less than `GRAPH_MIN_HEIGHT` rows left, so it is left out (AC4); the graph still shows on a piece's stats page. Give it room again (the play-again and pieces buttons are band cells now, so the left column's foot is free), with the painter's results look.
- TODO(architect, R3): AX-3 provisional (ft_1_12.AC10, AC11): the book's bookmark and order are kept for this visit of the game only (not saved). Confirm with the maintainer.
- TODO(painter, R2): paint the book's ribbon bookmarks, its turned-up page corners and its page numbers (rule 10); the builder's are flat cloth with a notch, a flat fold and the pixel font.
