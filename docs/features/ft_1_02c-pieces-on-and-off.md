---
id: "ft_1_02c"
title: "Pieces on and off"
scope: "Per-player list; hidden from the menu"
effort: "done"
status: "done; the real-tablet check is open (Human)"
completeness: 100
---
# ft_1_02c: Turning pieces on and off

Part of ft_1_02. A list of every piece (hand-written, generated and own) where the player turns each one on or off; a piece that is off is hidden from the menu, and turning it back on restores it with its stars. Index: [FEATURES.md](FEATURES.md).

## Rules

- **Save:** profile version 6 adds `settings.pieces = { hidden: [piece ids] }`; every piece not listed is on, so new pieces start on. The migration from version 5 leaves the list empty (d045).
- **Pure rules** (`src/core/progression/pieceSwitch.ts`): turn a piece on or off; the last piece that is on cannot be turned off. Only pieces the player can play now count as "on" (padlocked cards do not). Ids that match no piece are ignored, never an error.
- **Menu:** the menu shows only pieces that are on (`piecesThatAreOn` in `src/game/pieceList.ts`). **Make** still shows an own piece that is off, so it can be edited; the list screen shows every piece. If every piece on offer is off (a dev-only list that shrank), the menu says "All pieces are off" and Settings leads back to the list.
- **List screen: the library's card catalogue.** The Settings item "Choose pieces" opens `PiecesScene`: a cabinet of 24 drawers. Drawers that hold pieces are labelled with their letters, in the order of the Estonian alphabet; the rest have a blank front and do nothing. A drawer holds five pieces; a letter with more is split by its second letter (`Ma-Mi`, `Mo`), and further when needed; a title that does not start with a letter goes in a `#` drawer after them (`libraryDrawers`, `src/core/layout/libraryDrawers.ts`). A tap on a drawer opens it as index cards, title on the header and state under it ("On" in red ink or "Off"). A tap on a card toggles it; tapping the last piece that is on says "One piece must stay on." Escape or Back closes an open drawer, then returns to Settings. The pieces that are on are the ones written in the song list's book.
- **Out of the book in two presses.** Every piece in the player's book (not the piece maker's list) has a hide button, an eye struck through, under its i; the last piece that is on has none. Under the pointer a faint red stroke runs through the title, showing what the button does (d286). The first press only arms it: the card turns faint, its title is struck through in red, and the hide alone stays strong, ringed in red ink (its tooltip: "Press again to take it out"). A second press on the same button turns the piece off and the book is drawn without it; a second press within half a second (a double click, a held key) leaves it armed. A press on another piece's hide arms that one instead; Esc puts an armed hide back to rest before it leaves the book, and so does waiting four seconds (`pressHide` in `pieceSwitch`, AX-3 provisional: the half second and the four seconds).
- **Every piece from the book.** The book's strip ends with All pieces (the three stacked cards of Choose pieces): it opens the same catalogue, where a piece taken out is put back, and Back from it returns to the book it was opened from, not to Settings.
- **Stars and XP are never touched:** they live in the attempt log, so an off piece keeps its record. A level-up does not announce an unlock of a piece that is off.

## Acceptance criteria

- **ft_1_02c.AC1** Turning a piece off hides it from the menu and survives a reload, separately per player: another player still has it.
- **ft_1_02c.AC2** The migration from every older save version keeps every piece on, and migrating twice gives the same save.
- **ft_1_02c.AC3** The last unlocked piece that is on cannot be turned off (locked pieces do not count), and an id in the list that matches no piece is ignored without an error.
- **ft_1_02c.AC4** Turning a piece off and on again keeps its stars, XP and attempts.
- **ft_1_02c.AC5** End-to-end: the list screen is reached from Settings with real clicks, shows every piece with its state, and a piece is found by opening its drawer.
- **ft_1_02c.AC7** The pieces are filed in drawers of at most five by first letter, in the order of the Estonian alphabet, never two first letters in one drawer; a full letter is split by its second (and further) letter and each drawer is labelled with the range it holds; a drawer with no pieces has a blank front that does not respond.
- **ft_1_02c.AC8** In the book, a piece's hide shows under the pointer what it does, its first press only arms it (the card faint, its title struck through, nothing saved), a double click only arms it, and a later second press on the same piece takes it out of the book; Esc or waiting puts an armed hide back to rest, and the last piece that is on has no hide.
- **ft_1_02c.AC9** All pieces in the book's strip opens the catalogue of every piece, a piece taken out shows there as off and is put back with a tap, and Back returns to the book.
- **ft_1_02c.AC6** On the tablet, the list is easy to use with a finger and a parent or teacher understands the wording. [human]

## TODO

- NEEDS-HUMAN: AC6 on the real tablet. Verified on the virtual device only (`src/core/progression/pieceSwitch.test.ts`, `migrate.test.ts`, `tests/progression/profile-service.test.ts`, `src/game/pieceList.test.ts`, `tests/e2e/pieces.spec.ts`); no screenshot baseline added. The hide in the book (AC8, AC9) also needs a check with a finger on the tablet.
- TODO(builder, R2): when a piece is taken out of the book, show where it went (the card flies into All pieces, or that cell flashes), and let an armed hide's stroke fade over its four seconds.
