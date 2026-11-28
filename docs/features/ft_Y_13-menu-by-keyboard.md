---
id: "ft_Y_13"
title: "Menu by keyboard"
scope: "Move, select and go back in the menus with the PC keyboard (arrows, Enter or Space, Esc), with a visible focus outline"
effort: "medium"
status: "built (focus model, PixelScene support, menu-like screens)"
completeness: 85
depends_on: ["ft_0_06", "ft_0_13"]
---
# ft_Y_13: Menu by keyboard

The PC keyboard moves through the menus, so the player need not reach for the mouse. Index: [FEATURES.md](FEATURES.md).

## Rules

1. **Keys:** the arrow keys move the focus to the nearest enabled button in that direction (wrapping round at the edge), Enter or Space presses the focused button, Esc goes back. The first key pressed only shows the focus outline, so nothing is pressed or moved by surprise and a mouse user never sees an outline. A focus model in `src/core/layout/focus.ts` works on button rectangles and abstract directions (pure, unit tested). On a screen of rows and columns a move keeps its row; over a picture whose things stand in no rows (the room and the map, `FOCUS_LAYOUT.picture`) Left and Right go through the things in their order across the screen, and a thing far above or below (a corner) comes only when nothing lies nearer that way (AX-3 provisional: the weights).
2. **Where it applies:** the menu, pieces list, settings, credits, rundown, and results screens, all `PixelScene` buttons, so one place (`keyboardNavigation` in `PixelScene`) gives every screen the behaviour. A focused button is drawn with a ring of light gold inside an ink line, so it shows on parchment and on a dark ground alike. Screens that already bind Esc keep their own target; credits and both results screens go back to the menu.
3. **Not during play:** on the practice and editor screens the keys have their own meaning, so navigation is off there (practice has its own hotkeys, core_03).
4. **The book:** on the piece list the mouse wheel moves the focus ring along the pieces in reading order (down the left page, then the right), turning the page past its last or first piece; Ctrl + wheel, Page Down and Page Up turn the page and keep the ring's place on it. The first notch only shows the ring. The list stops at its ends and never wraps (`stepItem` in `src/core/layout/paging.ts`).
5. **Seam:** the piano-key mapping (B3 and D4 up and down, C4 select, A3 back; note-on only) is not built. The focus model takes abstract moves, so a piano-key source can be added later through the `Keyboard` input interface (ft_0_06) without changing scenes.

## Acceptance criteria

- **ft_Y_13.AC1** The focus model is unit tested: move by direction to the nearest enabled button, wrap or clamp, skip disabled buttons, activate, initial focus, focus kept or reset after a redraw.
- **ft_Y_13.AC2** End-to-end with the virtual EZ-220: from the menu a piece is chosen and the practice screen opened and left again using only the keyboard.
- **ft_Y_13.AC3** The focused button is visible in a screenshot (baseline per platform).
- **ft_Y_13.AC4** The piano-key mapping stays out and is noted as a seam (point 5). [human]
- **ft_Y_13.AC5** In the book the wheel moves the focus one piece a notch across the pages, Ctrl + wheel and Page Down / Page Up turn the page keeping the place, and the browser does not zoom (unit tested in `paging.test.ts`, end to end in `keyboard-navigation.spec.ts`).

## TODO

Work tags ([todo-tags.md](../automation/todo-tags.md)).

- IDEA(builder, Later): EZ-220 command keys, parked: hold a modifier key on the piano (the architect proposed C2 alone, not chords at both ends, which a student cannot reach) and every button shows and answers to a piano key ([C4]), with a mode indicator; fixed keys A3 = Back and C4 = OK; the labels are note names, so using them is reading practice (AX-0). Needs a spec round with the maintainer after record by playing.
