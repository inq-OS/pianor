---
id: "ft_1_20"
title: "Actions in a bubble at the pointer, a pinned strip and a backpack, in place of the band under every screen"
scope: "A right click (a long press on a tablet) opens a bubble of what can be done with the thing under the pointer; a screen pins its few most-used actions in one slim strip along its foot; the items a student keeps are in a backpack. It replaces the band of the classic point-and-click games (3 x 3 actions and an inventory) under every screen. Functions only; the look is the painter's"
effort: "large"
status: "in progress: the band is still drawn on every screen but the battle screens (d129); the bubble, the strip and the backpack (d282) are laid out in core (AC18 to AC21) and not drawn yet; held items (AC4) are open"
completeness: 25
depends_on: ["ft_0_13", "ft_Y_13", "ft_1_18", "core_09"]
---
# ft_1_20: Actions in a bubble, a pinned strip and a backpack

The band under every screen goes ([d282](../decisions/game.md#d282)): it took a third of the screen to show a few actions, most of them seldom used, and its empty slots on every place. In its place, three things, each where the hand already is:

- **The bubble.** A right click opens a ring of what can be done with the thing under the pointer, centred on the pointer so the hand moves least; on practice a right click anywhere opens it (no dead spot). Each option has a fixed slot (slot 0 straight up, then clockwise, two cells at least between neighbours), so the hand learns where it is, and shows its current value (Wait, 80%, lit when on). An option with choices opens them in a row beside the ring, on the side with room. A pick does it and closes the bubble; a worn option (note names, fingers) switches and leaves it open, so several can be set in a row. The centre is a Close target; Esc, a right click again or a press outside closes it too, and the press that closes is swallowed, never also hitting what is under it. A slot fires on press and release on the same slot. A piano key closes the bubble and still counts as played. Each option shows its keyboard key in its corner, so the bubble teaches the shortcuts; its name is in a tooltip bubble. Code: `bubbleLayout`, `bubblePage` in `src/core/layout/bubble.ts`.
- **Touch and keyboard.** A long press opens the bubble at 450 ms, with a ring filling round the finger from 150 ms; moving more than 12 screen pixels or lifting cancels; the lift after the long press never picks. On touch a finger down on a slot shows its name, the lift fires it, sliding off cancels. Shift + F10 and the context-menu key open the bubble at the keyboard focus; the arrows walk the slots clockwise, Enter picks, Esc closes and gives the focus back. Every cell and slot shows the focus ring. The door and the gear are never faded on a touch screen.
- **The strip.** A screen pins its most-used actions, and the ones whose state must stay visible, in one slim row along its foot (17 rows, cells 30 x 15, at most eight cells): left to right in a fixed order, the screen's main action (Play again, Done) at the right end in the same place on every screen, a destructive one (Delete) away from it at the left. A screen with nothing pinned has no strip and its main area takes every row. A screen with a bubble ends its left group with More (the bubble's own ring as its picture, its word VEEL when it fits, in the same place whatever is pinned), which opens the same bubble over the strip, so a student who never right-clicks, a touch screen and the keyboard all reach every action; it pulses gently on a player's first three visits of the screen. Right of More, the worn options that are on and not the default (a section, note names, fingers, the click) stand as small lit pictures; a press on one turns it off. A word is never cut short: a word wider than its cell takes as many cells as it needs (`cellSpan`), and a pinned action that does not fit goes into the bubble (`pinFlow`).
- **The backpack.** The items a student keeps (a character's prize, ft_1_21.AC15) are in a backpack, a picture in the top right corner two cells left of the gear on the room, the map and the scenes, there from the start; a new item makes it bounce once and wear a dot until it is opened, and Kiur says so once. A press opens its page of items over the picture, a second press or Esc closes it. No screen shows empty slots.
- **Teaching it.** On a player's first practice, Kiur points at More and says a press and hold (or a right click) on the staff opens it, with a picture of the mouse's right button and of a finger, and stops after the first time the bubble opens; it is kept with the first-run intro's flags (ft_1_31).

**The look** (`src/game/ui/pixel/bubbleArt.ts`, in layout cells, sized to `bubble.ts`): an option is a round plate 18 across (`optionPlate`), sitting on a band of wood round the centre (`ringBack`, 76 square, drawn at the bubble's `area`); the Close target is a sunk round plate with a cross (`closePlate`); a choice is a square plate (`choicePlate`) on a dark board two cells round the row (`choicesBack`, drawn at the first choice's x - 2, y - 2); a plate has six looks: plain, hover, down, on (a gold edge), off and main (a honey edge, the strip's main action); the keyboard's focus on an option is a gold ring (`optionFocus`); a long press fills a gold ring round the finger (`pressRing`); the strip's ground (`stripBitmap`) and its cells (`pinCell`, a span of cells joined); a worn option that is on is a gold chip with its picture in ink (`wornChip`); the backpack (`BACKPACK`, 14 x 15), its new-item dot (`NEW_ITEM_DOT`) and its leather page (`backpackPage`, the slots are the band's `trayBitmap(.., 'slot')`). More's picture is the ring (`TOOL_ICONS.more`); a picture in a bubble's plate is at most 14 wide (the section's is `sectionShort`). AX-3 provisional: the colours and the ring's width.

A screen whose actions all fit the strip and has nothing to point at pins them all and has no bubble (a short list a child sees beats a hidden one, AX-0, AX-2.4). The bubble is for the two screens with many actions on things: practice and the piece maker.

### Where each action goes (AX-3 provisional: the order and the slots, to be tuned by the maintainer on the laptop)

| Screen | Strip (left to right; main action at the right end) | Bubble (a right click, a long press, or More) |
|---|---|---|
| Practice (Wait, Tempo, a section, Free play) | Listen or Stop, Start again, Wait or Tempo (showing which), slower, the percent (BPM in its tooltip, a press back to 100), faster, More, then the lit worn options | anywhere on the screen: 0 Section or Whole piece; 1 Tempo ramp (while a section plays); 2 Click; 3 Circle of fifths; 4 Latest plays; 5 Analyse; 6 note names (worn); 7 fingers (worn) |
| Piece maker | Listen or Stop, Try it, Undo, Redo, the writer (Notes or Rests with its length, armed and ringed; a press opens the eight lengths, the wheel and the keys turn them: the one place a new note's length is chosen), More | on a note (selects it; inside a selection it acts on the whole selection, outside it the selection becomes the note): 0 length (the eight lengths); 1 accidental (sharp, flat, natural, none); 2 delete (no question: Undo is in the strip); 3 tie or slur (tie or slur, pick, all); 4 dynamic (pp to ff, none); 5 fingers (1 to 5, auto); 6 grace note; 7 copy. With bars selected, also paste and repeat. On an empty place of the staff: 0 notes or rests (the writer's mode); 1 paste (x1, x2, x4, at the place pressed); 2 repeat; 3 staff for played notes (auto, treble, bass); 4 the short tap (1/8, 1/4); 6 key (circle of fifths). On a bar's number or the time signature: the time panel |
| Piece book | the switches Own, Teacher's, Characters' | none |
| Note trainer | the step, the B or H naming, Circle of fifths | none |
| Ear trainer | the length, Repeat; Play again at the right end | none |
| Chord trainer | the step | none |
| Scale and chord shapes | the key, scale or triad, the hand | none |
| Score | More pieces; Play again at the right end | none |
| Settings | Report a bug, Choose pieces, Learning | none |
| Name | Delete; Done at the right end | none |
| Room, map, scenes | none (things are pressed in the picture, rule 7) | none; the backpack in the top right corner |

The door (Back) and the gear (Settings) stay in the top corners (rule 3). The piano's status (lit while connected, its name in the tooltip) is a small picture in the top strip left of the gear, not an action. Keys do what they did; every action keeps its key, and a key that is free may be added (faster and slower on the arrows, a selected note's length on the number keys) when no other use of it is lost.

AX-3 provisional: the painted places keep their 124-row picture centred in the rows they get until the painter paints them taller; while a conversation's choices or the tug are open (they use the old 56-row board, `BAND_ROWS`) the picture moves up so the board stands under it.

The sections below describe the band as it is drawn today; the builder deletes them with the band's code when the bubble replaces it.


Every screen gets the band of the classic point-and-click games along its foot: a 3 x 3 grid of the screen's actions and an inventory of items, the piece maker's marks among them. The painter draws it; the builder builds the functions. Decision: [d115](../decisions/game.md#d115). Reference was the 1991 Monkey Island 2 band, studied for arrangement only ([art-direction.md](../art-direction.md)). Painter: [painter-project.md](../architect/painter-project.md).

## Rules

Axioms: the band gives the staff room and never covers it (AX-0); it adds no reward or sound (AX-2); cells are at least 15 rows high, text is the game's font in Estonian capitals, one press does one thing, and there is no verb-and-object grammar on places (AX-2.4).

### The band (layout cells, d110; smallest screen 320 x 180)

| Part | Rows | What it holds |
|---|---|---|
| Main area | 124 | the screen: a painted place (room, map, knoll are exactly 124 rows, d111) or the staff |
| Action grid | 54 | 3 x 3 cells about 46 x 18, at the left |
| Inventory | 54 | an arrow column (up, down), then item slots about 38 x 27 in two rows, four columns at 320 wide, more on wider screens |

AX-3 provisional: the numbers are held by the layout's unit tests; the painter may move them inside the band's 56 rows. Code: `src/core/layout/band.ts` (`bandLayout`, `bandCells`, `bandItemPage`); `PixelScene` draws the band at every framed screen's foot. The band has no line of text: a cell, item or hotspot names itself in a tooltip bubble (a cell shows its word when it fits, else its picture), and a screen's message is Kiur's speech bubble in the corners' strip.

The top toolbar is retired but kept: the flag `BAND_KEEPS_TOOLBAR` in `src/core/layout/frame.ts` brings it back (Back, Settings, name, rank, XP; main area 101 rows). The battle screens set `keepsToolbar` until ft_1_21 replaces them (d129).

### Placing a button

1. **An action** (one press does something now) is a cell in the grid. A cell with no action is not drawn; its index stays.
2. **An item** is a thing with a state or that you put somewhere:
   - **held**: pressed, it rides on the pointer until put on a target or dropped (Esc, right click, second press on it). The piece maker's accidentals, tie, dynamics. The piece maker's notes and rests are two items, each showing its length and cycling it with the wheel; the one a click on the staff writes with is **armed**, drawn on a purple ground (`slotArmed`).
   - **worn**: one press switches it on or off, drawn lit. Note names, fingers, click, stats pane, ear trainer's repeat.
   - **opening**: one press opens a panel above the band, closed by a second press or Esc. The tempo ramp. (The piece maker's Piece panel is gone: its title is in the top strip, its bars are + and - after the last bar, its tempo and pick-up on the time panel a press on the staff's time signature opens.)
3. **Global actions** stay in place: **Back** (door) top-left, **Settings** (gear) top-right, drawn over the main area, faded until the pointer or focus is on them (`frameCorners`, `CORNER_FADED`; AX-3 provisional: how faded). A screen without them leaves the corner empty. The keyboard switch stays on the settings screen (d099).
4. **More than nine actions:** AX-3 provisional: the last cell becomes **More** (VEEL), turning the grid to the next set of eight.
5. **More items than slots:** the arrows page the inventory; a held item stays held when its page turns.
6. **Each cell has a fixed index** (0 to 8, row by row; items in order). The focus order of ft_Y_13 follows it, and a later piano mapping can name a cell by index.
7. **A painted place is used in its picture.** The room's piano, door, note board and gramophone (ft_1_08.AC7) and a scene's places and beings are pressed where painted and are not also grid actions. A thing shows it is pressable while the pointer is on it (AC14, AC15); keyboard focus walks them in fixed order (ft_Y_13). A thing answers in its box, larger than its painted shape (AX-3 provisional; a true-shape hit area only where boxes overlap). The map and scenes follow the room.

### The screens (AX-3 provisional mapping)

| Screen | Actions (besides Back, Settings) | Items |
|---|---|---|
| Room, map, knoll, scenes | none (rule 7) | none yet; room for the song bag and earned things |
| Practice | Listen or Stop, Start again, Wait or Tempo, slower, percent (BPM in tooltip; a press resets to 100), faster, section, Analyse | worn: note names, fingers, click, stats pane; opening: tempo ramp while a section plays (panel along the staff's foot); the piano (lit while connected, name in tooltip) |
| Piece maker | Listen or Stop, Try it, Save (tooltip says which levels fit), Undo, Redo, Delete, Copy, Paste (menu), More (Export, Import) | Piece (opening: bars, tempo, title); length (one item showing the note a click writes, opens a menu of five lengths as notes or rests, in-use lit, impossible ones greyed); worn rests; one accidental item (it shows the selected note's sharp, flat or natural; a press gives the next); one item for ties and slurs (a menu: tie or slur on the selected note, which one following from the notes; pick the note it goes to; tie all); grace note (arms a pick on the selected note; on a note that has one it removes it, core_09.AC35); selected note's dynamic; fingers (menu 1 to 5, AUTO); one repeat item (both signs on its picture: a press asks for the start bar, then the end bar; with bars selected, round them at once); the staff played notes go on; the short tap |
| Note trainer | the step, Again | the B or H naming (item) |
| Ear trainer | play again, the length | repeat (worn) |
| Score and battle results | Play again, back to the pieces | none |
| Battle | its action buttons | spellbook, song bag later |
| Lists and forms (d130) | their buttons that are not list entries (name's Delete and Done, settings' Report a bug and piece list, admin gate's Enter); a list stays in the main area | none |

Practice and the piece maker: no bars; the staff gets 104 of the 124 rows (87 and 72 before). Kiur and his bubble stand in the strip between the door and the gear; the page buttons of a section being marked sit at its right end; with the band the staff starts under that strip, and what stood beside the staff is drawn over it (`overStaff()`). Every band menu opens above its button, below only when there is no room. AX-3 provisional: Kiur in the strip, the piano as an item in place of the status line, no piece title on practice, Analyse as a word until it has a picture, the order of the piece maker's items. The admin page's tasks and the pages list stay lists in the main area. The desk screens fit the 124 rows (d130); every title starts right of the door (`PixelScene.titleX`).

A `ToolbarItem` may be `disabled`, keep its case, open a drop-down (`menu`) and hand back its button (`ref`). End-to-end tests find cells with `bandAction` and `sceneWords` in `tests/e2e/helpers.ts`.

### Held marks (an example)

A held mark is put on a note by clicking it (a tie: the first note, then the one it goes to; a dynamic on the note under the pointer). With a note selected, pressing an item applies it at once, so select-then-hotkey keeps working. Each item names its target kind (`note`, `bar`, `place on the staff`, `piece`), so a later mark (repeat signs, dots and triplets, dynamics between staves) is one new entry. The item model is pure (`src/core/`): id, kind, target, string key, picture key, and for a held mark the edit it makes through existing core functions (`core/editor/ties.ts`, dynamics and accidental edits). The scene keeps which item is held. Built so far: the items a student wins (`content/items/items.json`, `core/item/item.ts`: id, kind `kept`, name key, picture key; ft_1_21.AC15). Not built: the held, worn and opening kinds, a held item's target and held items riding on the pointer (AC4), focus by cell index (AC7).

### The room

`ProfileDashboardScene`: the name is written on the rank shield; the shield opens the player's card (`core/progression/playerStats.ts`). The note plant on the piano (`PLANT_STAGES` in `keri/roomLife.ts`) replaces an XP bar. Pressable groups are named in `PRESSABLE_GROUPS` (`keri/roomSet.ts`); `RoomPainter.hover` (`keri/roomPicture.ts`) draws the shield's contour. An overlay (Kiur at the door) keeps the plain frame.

## Acceptance criteria

- **ft_1_20.AC1** A pure layout function in `src/core/layout/` places the nine cells, the arrows and the item slots on any screen from 320 x 180 up; unit tests: nothing overlaps or leaves the band, cells are at least 15 rows high and a wider screen gets more item slots, never wider cells.
- **ft_1_20.AC2** `PixelScene` draws the band for every scene in place of the toolbar: a scene declares its actions and items (as it declares `toolbarItems()` today) and gets Back and Settings in the top corners (rule 3) without drawing them.
- **ft_1_20.AC3** The band has no line of text (text needed now and then is said by Kiur in a speech bubble there): a cell, item or hotspot names itself in a tooltip bubble as the toolbar did, and a screen's message is said by Kiur in a speech bubble. The player's name, rank and XP are in the room instead (AC13). (First written as a sentence line along the band's top.)
- **ft_1_20.AC4** A held item follows the pointer, is put on a target with a click and dropped with Esc, a right click or a second press on it; the item model is pure and unit-tested (each held mark makes the same edit as today's button).
- **ft_1_20.AC5** Worn items show lit while on; opening items open their panel above the band and close it again.
- **ft_1_20.AC6** Arrows page the inventory; More turns the action grid; Back and Settings never move.
- **ft_1_20.AC7** Keyboard focus (ft_Y_13) moves through the cells by their index; the existing hotkeys keep working.
- **ft_1_20.AC8** Practice and the piece maker have no bars of buttons above or below the staff; their staff gets every row above the band (at least 124 at 320 x 180, today 87 and 72).
- **ft_1_20.AC9** Every screen in the table above uses the band; no screen draws a toolbar or its own header.
- **ft_1_20.AC10** A URL switch shows the band before it is the default, so the painter and the builder can work beside the student's daily game ([url-switches.md](../url-switches.md)); it is removed when the band is the default.
- **ft_1_20.AC11** The maintainer and a student use the band on the laptop: the practice screen's staff is readable, the student finds Back, Listen and the hints without being shown. [human]
- **ft_1_20.AC12** The frame's layout has one flag for the top toolbar, off by default; a unit test lays out every screen size both ways, and turning it on needs no change in any scene.
- **ft_1_20.AC13** In the room the player's name is written into the rank shield in gold letters on its own grid (the name is part of the shield, not a separate bubble), the shield opens the player's card (the level, the XP and what the save counts: pieces played, passes, five-star pieces, battles won of fought, monster levels beaten, the note-name trainer's XP and the ear trainer's points; closed with its button, Esc, Back or a press beside it), and the note plant on the piano grows through five sizes as the level's XP fills, in place of an XP bar (the name goes on the shield, the shield opens a window of detailed stats and skills, showing what is tracked, and the XP bar is replaced by a room element that fills up, burns down or grows). AX-3 provisional: the plant, its place on the piano and its five sizes.
- **ft_1_20.AC14** In the room, a thing a press reaches is active while the pointer is on it (a thing that can be pressed shows it when the pointer floats over it; MVP: a simple contour highlight). The shield gets the contour: a light line round its painted shape with ink outside it. The four objects had it too until they got their second look (AC15). Actions done by clicking a thing in the room are not in the grid. AX-3 provisional: the line's colours and width.
- **ft_1_20.AC15** Each object of the room (the piano, the door, the note board, the gramophone) is painted in two looks, at rest and awake, and is awake while the pointer is on it, in place of the contour (each thing that can be pressed has two states that change on hover, for example the piano lid is closed and opens on hover, and so does the door; the painter's sheet of the looks was approved). At rest the piano's lid is down and its book shut, the door is shut, the board's stave is empty and the gramophone's horn is turned along the wall; awake the keys and the open book show, the door's leaf swings in and shows the hallway, three gold notes stand on the stave, and the horn turns to the room with two notes in the air ([scene-room.md](../keri/scene-room.md)). A second look changes the picture on and round its object only, at every hour and at each strength of the fire; one object is awake at a time. It is a look: what a press does is unchanged. AX-3 provisional: only the pointer wakes an object (not the keyboard's focus; a tablet has no pointer), and the contour is not drawn round an object that wakes.
- **ft_1_20.AC16** The mouse wheel works the inventory (the inventory pages should also turn by scrolling, and scrolling over an item with several choices cycles through them): over an item with choices (a menu, such as the piece maker's Length) it picks the next choice down or the one before up, in the menu's order, skipping those that cannot be picked and stopping at the ends; elsewhere on the inventory (its arrows, an empty slot, an item without choices) it turns the page, down the next. A screen's own wheel (the staff's pages, the length wheel, the book of pieces) leaves the inventory to the band (`src/core/layout/band.test.ts`, `tests/e2e/band.spec.ts`).
- **ft_1_20.AC18** No action shows a word cut short: a word wider than its cell takes as many cells as it needs (`src/core/layout/bubble.test.ts`, d282).
- **ft_1_20.AC19** A right click opens the bubble round the pointer, whole on the screen however near an edge, with each option in its fixed slot whatever how many the screen has, at least 15 rows high and none overlapping; more than eight options make the last slot More (`src/core/layout/bubble.test.ts`).
- **ft_1_20.AC20** An option with choices opens them in a row beside the bubble on the side with room, inside the screen and over no option (`src/core/layout/bubble.test.ts`).
- **ft_1_20.AC21** A screen with nothing pinned has no strip; its pinned actions take one row of 15-row cells left to right, and those that do not fit go into the bubble (`src/core/layout/bubble.test.ts`).
- **ft_1_20.AC22** Practice and the piece maker draw no band: the strip and the bubble hold every action of the table above, More opens the bubble, a long press opens it on a touch screen and the context-menu key at the keyboard focus, the press that closes it hits nothing under it, a piano key closes it and still counts, and every key works as before; the staff gets every row above the strip (end-to-end).
- **ft_1_20.AC23** No screen draws the band; the backpack on the room, the map and the scenes opens the items the student keeps (end-to-end).
- **ft_1_20.AC24** The maintainer uses practice and the piece maker on the laptop with the bubble and the strip, and moves any option whose place is awkward; a student finds Listen, Start again and Back without being shown. [human]

## TODO

Work tags ([todo-tags.md](../automation/todo-tags.md)); the closed issue in brackets keeps the earlier discussion.

- TODO(builder, R2): build the bubble, the strip and the backpack (d282) in `PixelScene`: a screen declares its pinned actions, its bubble options per target (note, staff place, bar number, the screen) and its kept items; `frameView` takes `pinRows`; the band, `bandLayout`, `bandCells`, `bandItemPage`, the 3 x 3 rows of this file and the band's sections below go. Practice and the piece maker first, then every screen of the table, the end-to-end helpers (`bandAction`) and the help cards of ft_1_33. Look at every screen at 1920 x 1080 before saying done.
- TODO(builder, R2): Kiur's first-run intro (ft_1_31) shows the More cell and a right click on the staff once; the help cards of ft_1_33 show the bubble.
- TODO(painter, R2): paint the places taller, so no wood shows under a picture once the band is gone (the bubble's, the strip's and the backpack's look is in `src/game/ui/pixel/bubbleArt.ts` and the pictures that were words in `toolArt.ts`; `npm run art:render -- ui <practice|scene|kit>` shows them at 1920 x 1080).
- TODO(builder, R2): items as a pure model in `src/core/` (id, kind held, worn or opening, target kind, string and picture keys); the piece maker's marks (length, rest, accidentals, tie, tie to a note, dynamics), now items in the band that act on the selected note, also become held items that ride on the pointer and are put on a note with a click (AC4). Waits on the painter's cursor that carries an item.
- TODO(painter, R2): with the band the default, the door and the gear lie faded over the song book's top corners and the first card's left end; the settings book's bookmark crosses its last right-hand row. Seen on the builder's screenshots.
- TODO(painter, R2): the settings tiles are still wood; make them parchment like the other felt screens (d130).
- TODO(painter, R2): the cursor that carries a held item (AC4), and a picture for each item that is not a music sign (the piece maker's slur, grace note, fingers and staff choice; the piano's status); free packs first (`use-free-art-packs`). The piece maker's music signs are drawn: `src/game/ui/pixel/itemArt.ts`, each a scrap of parchment with the sign in the staff's ink, every length as a note and a rest, sharp, flat, natural, tie, tie to a note, pp to ff and both repeat signs; an item or a menu choice shows one with `fineIcon: true`.
