---
id: "ft_0_16"
title: "One-line staff and settings"
scope: "One line of staff at a time with page turns, settings screen"
effort: "done"
status: "done; playtest questions open (Human)"
completeness: 100
---
# ft_0_16: One-line staff and settings

The staff shows a few lines at a time and turns the page as the student plays, so notes are big; a Settings screen lets each player choose. Decisions: d032, d055, d058. Index: [FEATURES.md](FEATURES.md).

## Rules

1. **Layout** (pure, `core/layout`): `layoutStaff` takes `barsPerLine` and `linesPerPage`; every line holds exactly that many bars except the last; later pages take the places of the first page, so a page never moves; `pageOfNotes` says which page shows a note. `layoutForSettings` (`core/layout/staffSettings.ts`) turns a player's settings into a layout. "All" lines keeps the whole-piece fit.
2. **Bars per line:** auto, 2 or 4. Auto takes whichever draws the bigger notes, 4 on a tie; with today's pieces that is 2 bars.
3. **Paging:** the staff view shows the page of the awaited notes and turns with a short fade, no movement, so the eye stays on the notes. Both hands share bars, so awaited notes are always on one line.
4. **Defaults:** `DEFAULT_STAFF_SETTINGS` is 2 lines, auto bars; one line is 20 px or more between staff lines, the two-line default 9 px or more. Saved players keep their choice; the migration from version 1 fills one line. The preview tool keeps the whole-piece view; the preview's play-along is the practice screen with the active player's settings.
5. **Sizes with one line** between staff lines: one-hand pieces 32 px at 1366x768 and 1280x720, 27 at 1024x600; two-hand 25, 23, 20; with eighth notes 23, 22, 17. A content test checks every piece fits (20 px or more on the laptop for one line).
6. **Settings screen** (`SettingsScene.setting`, all text through string keys, saved per player): each setting is one button showing its current choice and moving to the next when pressed, name to its right, two columns; the settings stand in rows of two: lines on screen, space between staves, bars per line, bar numbers, finger numbers, score view and the rest. Pictures on the buttons come from `settingArt.ts` (staff scraps, grand staff close or far, Tempo timing view, one or three Wobbles); bars per line is a staff scrap cut into its bars, 2 or 4 with the number over them and auto with a two-headed arrow the line's width (AX-3 provisional: the arrow); bar numbers show numbers (blank, 1, 1 2 3, 1 3 5, 1 5 9); the choice's name is the tooltip; Back is a door. Wait/Tempo lives on the practice tools strip (core_01) and the on-screen keyboard switch in the toolbar (ft_Y_12). `PixelScene.label` puts the top of capitals at `y` for normal text.
7. **Bar numbers (d055):** `settings.barNumbers = { mode }`: Off (default), First bar, Every bar, Every 2nd, Every 4th (bars 1, 3, 5 ... and 1, 5, 9 ...). `barNumbersToShow(mode, barCount, firstBar)` (`core/layout/barNumbers.ts`) picks them; `StaffView` draws small pixel digits just right of the bar line above the top line (above the upper staff on a grand staff). In a practised section (`sliceChart`) numbers are those of the whole piece and the section's first bar always has one (matches Shift+R, core_03). Practice and the tug show them; the preview does not; the editor (ft_1_02a) numbers every bar whatever the setting. Every bar is a value older saves never hold, so no version bump.
8. **Space between staves (d058):** Small (new player default; middle C sits on one ledger line halfway between the staves) or Wide (migrated saves keep it); `staffGap` option, `settings.staffGap`. Practice uses it; editor and preview keep wide. Hints of far notes can reach the other staff with Small. A tap on it puts "Space between staves: for pieces with both hands." on the hint line, which stays empty otherwise until saving fails.
9. **Turning the pages by hand:** on the practice screen the left and right arrow keys, Page Up and Page Down and the mouse wheel (down is the next page; not over a tempo-ramp value, which the wheel turns) show the page before or after. `AX-3 provisional:` it is a look only: the play waits where it was, and the next key judged turns back to the page of the awaited notes. On a staff of one page the arrow keys still move the computer keyboard's octave. While a section is being marked the same keys turn the page to mark on (core_03).

## Acceptance criteria

- **ft_0_16.AC1** Layout unit tests: each line holds exactly the chosen number of bars except the last.
- **ft_0_16.AC2** At 1366x768 one line of a two-hand piece is drawn at 20 px or more between staff lines and a 2-bar one-hand line at 28 px or more, with no overlap at 1366x768, 1280x720 and 1024x600.
- **ft_0_16.AC3** End-to-end: the virtual player plays a piece longer than one line through every page turn to the results screen.
- **ft_0_16.AC4** Settings survive a reload and are separate per player.
- **ft_0_16.AC5** A screenshot of a one-line page.
- **ft_0_16.AC6** At the playtest: 2 or 4 bars per line, and whether the page turn surprises the student. [human]
- **ft_0_16.AC7** Bar numbers: a setting with Off (default), First bar, Every bar, Every 2nd and Every 4th; `barNumbersToShow` (`core/layout/barNumbers.ts`) is unit tested, the save migrates from version 9 with the numbers off, and the practice staff follows the setting (end-to-end).
- **ft_0_16.AC8** On the practice screen the arrow keys and the wheel turn the staff's pages both ways, stopping at the first and last, and the next key played turns back to the awaited notes' page (end-to-end).

## TODO

- NEEDS-HUMAN: playtest: how a page turn feels to the student and whether they need to see the next line coming; 2 or 4 bars per line; two-line size on the laptop; whether a young student reads the setting pictures without help; the screens on a real tablet.
- NEEDS-HUMAN: how bar numbers look on the real tablet, whether 3-digit numbers (bar 100 and up) touch a high note name above the first note of a bar, and a new Windows screenshot baseline of the Settings screen.
