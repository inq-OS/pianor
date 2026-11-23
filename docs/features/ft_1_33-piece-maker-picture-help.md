---
id: "ft_1_33"
title: "Piece maker help as pictures"
scope: "F1 in the piece maker shows each simple mouse action as a picture (a small mouse with what is pressed, the staff before, an arrow, the staff after), and Kiur shows the keyboard keys on the staff under the intro's spotlight, in place of the list of lines"
effort: "simple"
status: "built: eight cards of mouse actions on sketched staves, Alt + left for the touchpad, the Keys button and Kiur's spotlight tour of the cursor, the bar and the band, with unit and end-to-end tests; open: the maintainer's look, the wheel on the band once ft_1_20 has it"
completeness: 75
depends_on: ["ft_1_02d", "ft_1_31", "ft_1_20"]
---
# ft_1_33: Piece maker help as pictures

The middle button placing a note was not discoverable, so F1 shows symbolically what each thing does instead of a wall of text, with an image of a mouse for each action and on-staff navigation with the keyboard, like the overlays of Kiur's intro. Index: [FEATURES.md](FEATURES.md).

AX-0: whoever writes a piece (the teacher, a parent, an older child) finds how to place a note at once, so more pieces get written for the student to read. Replaces the seven lines of keys over the staff that ft_1_02d.AC19 had.

## Rules

- **F1** shows the key on every tool, as before (ft_1_02d.AC19), and over the staff a panel of **cards, one per simple mouse action**, no words (the mouse hint shows the action directly on the staff, not just text; every simple action has a small mouse symbol with what is pressed and the resulting outcome). Each card: the held key's cap (Ctrl, Alt) if any, a small mouse with what is pressed lit (left gold, wheel teal, right red; a turned wheel has an up arrow, a drag an arrow), a few bars of staff with the pointer, an arrow, the same staff after. The cards: middle on the staff writes a note; Alt + left does the same on a touchpad; left on a note selects it (blue); the wheel on a note moves it a step; Ctrl + wheel makes it longer; middle on a note makes it longer; a left drag over bars selects them (a blue box). F1 or Esc closes the panel.
- The cards are data (`HELP_CARDS`, `src/core/editor/help.ts`); every card that is a press names it, and a test holds it to `mouseAction`, so the pictures cannot drift from what the buttons do. Placement is pure (`src/core/layout/helpCards.ts`); the pictures are own art drawn by code (`src/game/ui/pixel/mouseArt.ts`): the free packs could not be fetched from the session that built it (see TODO).
- **Keys**: a button on the panel (or Enter while it shows) starts Kiur's tour of the keyboard on the staff, through the first-run intro's spotlight (`IntroScene`, ft_1_31): the rest of the screen darkened, the thing framed, an arrow, Kiur's line. The cursor is shown first where writing goes on. Steps (`KEY_TOUR`): the cursor (the arrows, Ctrl + arrow), the cursor (Enter, Ctrl + Enter, Shift + Enter), the cursor (Shift + arrows, C), the cursor's bar (Ctrl + Shift + arrows, Ctrl + C, X, V, Insert), the band (each button shows its key; a key with choices then a number). A press, Space or Enter goes on, Esc ends it; the panel is there again after it.
- AX-3 provisional: the colours, the words, the order of the tour.

## Acceptance criteria

- **ft_1_33.AC1** F1 in the piece maker shows a card per simple mouse action, each a small mouse with what is pressed, the staff before and the staff after: place, Alt + left place (touchpad), select, remove, wheel (pitch), Ctrl + wheel (length), middle on a note (longer), drag (select bars); no list of key lines. Every press is held to what the button does by a test.
- **ft_1_33.AC2** The cards and the Keys button stay inside the panel and do not overlap; inside a card the parts go left to right and every mouse of a column stands in one line.
- **ft_1_33.AC3** Keys (or Enter) starts Kiur's spotlight tour on the staff: the cursor, its bar and the band, one at a time, each with its keys; Esc or the last step ends it back on the panel, and the piece is unchanged.
- **ft_1_33.AC4** [human] The maintainer checks the look and the Estonian wording on the laptop.

## TODO

- TODO(builder, R2): once the wheel pages the band and cycles an item's choices (ft_1_20.AC16), add its card to `HELP_CARDS` (the wheel over the band, its page turning) and its words to the tour's band step. The help must never show a wheel that does not work yet.
- TODO(painter, R2): look at the drawn mouse and staff sketches beside Kenney's CC0 input prompts (`input-prompts-pixel-16`) and take theirs if it reads better; the pack site was refused from the cloud session.
