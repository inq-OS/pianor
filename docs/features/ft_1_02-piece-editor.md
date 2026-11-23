---
id: "ft_1_02"
title: "Piece editor, pieces on and off"
scope: "Click notes onto the staff; own pieces private (licence `NaN`); turn pieces on and off per player. Built in four parts:"
effort: "split"
status: "split into four parts, each with its own file"
---
# ft_1_02: Piece editor and turning pieces on and off

An "Add piece" screen where anyone writes a piece by clicking on the staff, without writing ABC, and a list where the player turns pieces on and off. Index: [FEATURES.md](FEATURES.md).

## Parts

- [ft_1_02a](ft_1_02a-editor-model-and-screen.md): the editor model, hit testing, ABC output and the editor screen, own pieces kept in the browser and playable in the game.
- [ft_1_02b](ft_1_02b-own-pieces-as-files.md): own pieces as files: export and import, the dev server saving into `private/pieces/`, licence `NaN` accepted for private pieces only.
- [ft_1_02c](ft_1_02c-pieces-on-and-off.md): turning pieces on and off, per player.
- [ft_1_02d](ft_1_02d-editor-extras.md): dotted notes, entering notes from the piano, and the other editor extras.

## Rules

1. **Model** (pure, unit and property tested): a draft piece (right hand, left hand or both; meter; bars) with place, change pitch, lengthen, shorten, delete, undo and redo. Empty time shows as rests. A note never crosses a barline or runs into the next note; an edit that would do so is refused and the view wiggles the note.
2. **Hit testing** (pure, on the layout the view draws): a screen point gives staff, pitch (by clef, ledger lines included) and time snapped to the nearest eighth.
3. **Interaction:** clicking an empty place puts a note of the current length there, with a faint preview note with its name following the pointer. Clicking a note lengthens it, Ctrl+click shortens it, the wheel over a note does either. Number keys choose the length; Delete, or Delete in the bubble a right click opens (ft_1_20), removes; Ctrl+Z and Ctrl+Y undo and redo. On a tablet an on-screen row of lengths and a delete button. Listen and try in Wait mode from the editor.
4. **Output:** the editor writes ABC plus a meta file (the ft_0_12 ABC writer), so its pieces take the same path as every other piece, with `checkPiece` diagnostics live against the chosen level; warnings never block saving. Meta: title from a text field, id from the title, `source` "written in Pianor by <name>", **`license: "NaN"`** (own pieces are often local children's and folk songs typed in for private use). They stay private: a hosted build saves them in IndexedDB, the dev server in the gitignored `private/pieces/<id>/`. They are never written to `content/pieces/` and never deployed; the lint rule `license` accepts `NaN` for these private pieces only.
5. **No limits:** anyone, parent or student, may write any piece. A saved piece is playable at once and earns XP like any piece of its level: the person who saves it is the human approving it (`status: "approved"` is set by that save; an agent or a test never saves into real content).
6. **Pieces on and off:** a per-player list; a piece that is off is hidden from the menu and battles and restores with its stars when turned on (ft_1_02c). First step toward the spellbook (ft_Y_01): later pieces and short riffs are abilities and the character picks a limited number of active spells.

## Acceptance criteria

Model and hit testing are unit and property tested (any sequence of edits keeps every bar exactly full and every note inside its bar; undo restores the exact previous state; hit testing round-trips with the layout for every staff position and eighth). An end-to-end test writes a two-bar piece with mouse and keys, saves it (licence `NaN`, outside `content/pieces/`), finds it in the menu, plays it with the virtual player and earns XP. An editor-written piece compiles and lints the same as the same piece written in ABC. Turning a piece off hides it from the menu and battles and survives a reload, separately per player. Touch controls are tested with synthetic pointer events. **Human:** write a piece with it on the laptop and on the tablet.

## TODO

Work tags ([todo-tags.md](../automation/todo-tags.md)); the closed issue in brackets keeps the earlier discussion.

- TODO(builder, R2): name a bar selection as a phrase. Optional `phrases` on `EditorPiece` with pure add, rename and remove (no overlaps); the bar operations keep phrases in step (property test: no phrase points past the last bar); a new own-piece record format and piece file version with migrations and a decision file (not the profile save); a labelled bracket above the treble staff; the editor's chart equals the compiled ABC plus meta. After the bar selection.
