---
id: "ft_1_02e"
title: "Vim keys in the piece maker"
scope: "An opt-in, per-device vim layer over the piece maker's keys: normal, insert and visual mode, counts, motions, operators, undo, redo and repeat, and a : line, all driving the piece maker's own moves, edits and tools"
effort: "medium"
status: "built: the parser, motions, note and bar edits, insert mode by letter, visual bars, the : line, the mode line and F1 labels, with unit and end-to-end tests; open: the maintainer's use on a real keyboard, a slot in the bubble once ft_1_20 has it"
completeness: 85
depends_on: ["ft_1_02d"]
---
# ft_1_02e: Vim keys in the piece maker

Part of ft_1_02. For an author who knows vim, the piece maker reads keys the vim way: a count, an operator, a motion. It is off by default, so a student never meets modes (d284). Index: [FEATURES.md](FEATURES.md).

## Rules

1. **One set of actions.** The parser is pure (`src/core/editor/vim.ts`, `vimKey`) and gives commands; the scene carries them out with the moves of `keyCursor.ts`, the edits of `keyEdits.ts` and `bars.ts`, and the tools by their `EDITOR_KEYS` name through `shortcutActs`, the same names the band and the bubble read. There is no second set of editor actions.
2. **Switch.** Ctrl + Shift + V (`vimKeys` in `src/game/editor/shortcuts.ts`) or `:set novim` and `:set vim`; kept per device in the entry preferences (`vimKeys`, optional, absent is off, no version bump). On, the cursor shows at once.
3. **Mode line.** At the top left of the staff: `vim`, `-- insert --` or `-- visual --` and the keys typed so far, or the `:` line while it is typed.
4. **A place is a character, a bar is a line.** The cursor is the piece maker's keyboard cursor (ft_1_02d.AC15). A move in time lands on the note of its place nearest the cursor's pitch (`snapToNote`), so `l` then `x` takes the next note; `j` and `k` go one staff step.
5. **Normal mode.** Counts before everything. Motions: `h` `l` (and the arrows) a place, `j` `k` a staff step, `w` `b` a bar, `0` `^` `$` the bar's start and last place, `+` `-` the staff stops of Ctrl + down and up, `gg` the first bar, `G` the last, `{n}G`, `{n}gg` and `:{n}` bar n. Changes: `x` the note, `Ctrl-A` `Ctrl-X` a staff step up or down, `r{a-g}` the nearest pitch of that letter, `~` sharp, flat, natural; each change with its count is one undo step. Bars: `dd` cut, `yy` copy, `p` `P` paste after or before the cursor's bar, the same clip as Ctrl+C and Ctrl+V. `u` and `Ctrl-R` with counts; `.` repeats the last change, with a new count if typed.
6. **Insert mode.** `i` at the cursor, `a` after it, `o` `O` in a new empty bar after or before. The letters a to g write a note of that letter nearest the cursor's pitch (never more than a fourth away, the key signature's sharp or flat) with the selected length, and the cursor moves on, as Ctrl + Enter does; A to G add that note to the chord just written, the next of the letter above its top head, the cursor staying; `+` and `-` make the note just written sharp or flat; `r` a rest; `'` (or `.`, as `'` is a dead key on some layouts) and `,` move the note just written an octave up or down; Backspace takes out the note or chord before the cursor. Digits, Enter, the arrows and Ctrl keys are the plain piece maker's. Esc goes back to normal mode.
7. **Visual mode.** `v` or `V` selects bars from the cursor's bar; motions grow it; `d` `x` cut, `y` copy, `p` puts the clip in their place, `Ctrl-A` `Ctrl-X` move their notes a step; Esc, `v` or `V` end it.
8. **The `:` line.** `:w`, `:q` (asks if unsaved), `:q!`, `:wq`, `:x`, `:set novim`, `:{n}`, and any tool by its name (`:listen`) or its short word (`:play`, `:try`, `:time`, `:re`, `:acc`, `:dyn`, `:rep`, `:tap`, `:ph`, `:pb`, `:pn`, `:help`, `:e`, `:o`; `VIM_WORDS`). An unknown word says so.
9. **The plain keys.** In normal mode N, T, F, M and C keep their tools, keys that type nothing (F1, Delete, Enter, Page Up) and Ctrl keys other than A, X and R are the plain ones, and any other character does nothing. Esc in normal mode ends a half-typed command, a waiting pick and the bar selection, and never leaves the piece maker. The EZ-220 and the on-screen piano write notes in every mode. F1 names a tool whose letter vim takes by its `:` word or vim key, and a length by its N digit (`vimLabelOf`).
10. Verified on the virtual device and the computer keyboard only.

## Acceptance criteria

- **ft_1_02e.AC1** The vim keys are off by default; Ctrl + Shift + V turns them on and off and the setting survives on the device; a record from before reads as off; the mode line shows while they are on.
- **ft_1_02e.AC2** Motions with counts move the cursor as the arrows do, stop at the ends of the piece, and a move in time lands on the nearest head of the note there.
- **ft_1_02e.AC3** `x`, `Ctrl-A`, `Ctrl-X`, `r` and `~` change the note under the cursor, each with its count one undo step; `u` and `Ctrl-R` take counts; `.` repeats the last change, a new count replacing its own.
- **ft_1_02e.AC4** `dd`, `yy`, `p` and `P` cut, copy and paste whole bars at the cursor's bar with counts; visual mode selects bars with the motions and cuts, copies, replaces or moves them.
- **ft_1_02e.AC5** In insert mode a to g write the nearest note of that letter at the cursor with the selected length and move on; A to G stack a chord on the note just written and `+` and `-` make it sharp or flat; `r` writes a rest, `'` and `,` move the last note an octave, Backspace takes out the chord before the cursor; Esc returns to normal mode.
- **ft_1_02e.AC6** The `:` line runs `w`, `q`, `q!`, `wq`, `x`, `set novim`, a bar number and every tool by its name or short word; an unknown word is named in the message.
- **ft_1_02e.AC7** In normal mode N, T, F, M, C, the keys that type nothing and the plain Ctrl keys work as without vim; other characters do nothing; Esc never leaves; F1 shows the vim names of the tools.

## TODO

Work tags ([todo-tags.md](../automation/todo-tags.md)).

- NEEDS-HUMAN: write a piece with the vim keys on a laptop keyboard: whether the keys and the mode line feel right, and Ctrl-A in Chrome.
- TODO(builder, R2): once the bubble of ft_1_20 is built, the vim switch goes in slot 7 of the piece maker's empty-place bubble.
- IDEA(builder, Later): from the ergonomics review: `x` and `yl` fill a note register so `xp` swaps two notes; note-wise operators (`dl`, `d$`, `c`); `>>` and `<<` an octave in normal mode; a `:keys` page listing the vim keys; `e` as the bar's end.
