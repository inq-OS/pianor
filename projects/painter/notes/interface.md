# The action and inventory band: the painter's notes

The interface follows the classic LucasArts style: a 3x3 grid of buttons and items, with the same principle used to place buttons and features (the piece maker's markups, ties, pp and ff work like inventory items). The architect's spec is `docs/features/ft_1_20-action-and-inventory-strip.md` (d115); the painter's work is tagged there (`TODO(painter, R2)` under its TODO heading: the kit and the item pictures in the game) and under [TODO](#todo) at the end of these notes (d116, `docs/automation/todo-tags.md`). The builder builds the functions (the `TODO(builder, R2)` tags in the same file).

Pictures are in the painter's local folder, never in git (d223).

## What the 1991 band measures (from the screenshots, 320 x 200)

| Part | Size | Look |
|---|---|---|
| The band | 56 of 200 rows | black ground, cut off from the picture by nothing but the change of colour |
| Sentence line | 8 rows | one line, centred, in the letters' violet |
| Verbs | three rows of 16, three columns of unequal width, 143 wide in all | words, left in their cell; a dark violet cell, violet letters, the chosen verb brighter |
| Arrows | a column about 14 wide | two cells, one over the other |
| Items | four by two, each about 40 x 24 | larger and richer than anything in the picture, a dark line round each, a glint; the cell's ground stays dark |

## The band as built

- **Sizes** (`src/core/layout/band.ts`): cells 46 x 18 from x 2 with a gap of 1 (rows touch), arrows 12 x 27 from x 145, slots 38 x 27 from x 159 with a gap of 1, the band's top row free.
- **Pictures in the cells, never words** (d118). A cell shows its picture whenever it has one; where there is no action no cell is drawn (AX-3 provisional).
- **No line of text in the band.** A thing names itself in a tooltip bubble; a short line, when one is needed, is a speech bubble from Kiur; the player's name is on a ribbon at the shield, the shield opens a card, and a plant on the piano grows with the XP.
- **The manner:** the band is one warm board; a plate or a slot is only cut into it, a dark line all round with a lighter line beside it (inside the top and left of a plate, inside the bottom and right of a slot or a pressed plate); letters and pictures are pale; a slot that holds an item, and a plate under the pointer, is a tone lighter. Nothing of any reference's art or colours is copied.
- **The room's things are not in the grid.** A thing that can be clicked shows a contour under the pointer: a light line two fine pixels wide with a dark one (the room's ink) outside it, so it reads on white plaster and on dark wood. It comes from the room's group layer (`layers.group` in `paint/painter.ts`; the groups are `G` in `keri/roomSet.ts`; ft_1_20.AC14). Later each such thing has two states that change on hover (the piano lid opens, the door opens): each state is the room painted once more with one thing changed, and only the pixels that differ are kept.
- **The door and the gear** are the game's own icons with no button ground, faded in the top corners and at full strength under the pointer.

## The palette and the looks

- **The palette** has 79 colours: 53, Kiur's 16, and 10 for the warm screens. `night`, `panel`, `panelLight`, `panelDark`, `dim` and `lock` are warm browns (0x2b1e17, 0x4b3625, 0x6d5136, 0x35261b, 0xcdb894, 0x6a5440); `groove` 0x1e1410 is the line cut round every panel, then `panelLit` 0x644a30, `honey` 0xdcbc82, `honeyDark` 0x8a6c44.
- **Cold tones used as paint keep names of their own**, so nothing painted changes: `duskDeep`, `duskDark`, `dusk`, `duskLight` (the portrait in the room, the room's palette) and `silverDark`, `silver` (the silver rank, the portrait's hair, the mug's steam, Kiur's "z").
- **The looks** (`LOOKS` in `frames.ts`): a panel is the board with `groove` round it; a button is the palette's brown ramp; a card is the board with a `honeyDark` line, `honey` under the pointer; gold stays for what is on, cream for the bubble. The shadow under the screens' letters and the edge of a bar are `groove`, not the navy `ink`. The page's own ground (`main.ts`, `index.html`) is `night`.
- **Left as it is, on purpose:** the staff (paper, ink, the blue pointer, the blue duration helpers, and the settings pictures that show them), the name field of the piece maker, the dots and lines of the results and analyse graphs, the rank colours, the navy `ink` outline of every sprite.
- **Tests:** `art.test.ts` holds every sprite ramp's mid shade off from `dusk`, `duskLight`, the ground and from `night` and `panel`; `frames.test.ts` holds the looks.

## Measured

- **Words.** An Estonian word of eight letters in small capitals is 47 cells (SALVESTA, AEGLASEM). This is one reason the cells hold pictures.
- **Items.** An item picture is at most 44 x 30 fine pixels; drawn at most 34 wide, nine fit side by side in 171 cells.
- **The same word twice.** UUESTI is "again" on the practice screen and "redo" in the piece maker; the pictures keep them apart.
- **On the real screens:** the corner door lies on the first letter of the practice title and on the piece maker's first button, the gear on the stars of the menu's top right card, and the map's credit line runs over the painted name. Rule 3 of the feature draws the corners over the main area; the bars move into the band later (the builder's tags).
- A PNG copied to another folder may gain extra chunks, so compare pixels, not bytes.

## What else changes its look when the band comes (a survey from the screen sheet and the code)

Nearly every button in the game is drawn by three things, so most of the look changes in one place: `frames.ts` (`panelBitmap`: panel, button and its hover and pressed looks, card, locked, bubble, active, tab), `PixelObjects.ts` (`PixelButton`: button, card, tab) and the frame in `PixelScene.ts`.

| What | Where it shows | To paint |
|---|---|---|
| The band's kit | every screen | ground, cell (plain, pointed at, pressed, focused, cannot be pressed), arrows, slot (plain, lit, held), the pointer and the item on it |
| Item pictures | piece maker, practice, trainers | about 35: lengths, rest, signs, ties, pp to ff, fingers, repeat signs, note names, fingers, click, stats, tempo ramp, the piece's sheet, options |
| Action pictures | every screen | about 30 (today's `toolArt.ts` and `iconArt.ts` are drawn for a 14-row button and are flat) |
| Panels that open above the band | the tempo ramp, the piece's options | a panel in the band's manner |
| Cards and tabs in the main area | piece list, parts, profiles, settings, the new piece's key choice | the same manner as the cells |
| Speech | practice (the bubble), menu | the bubble; the others are open |
| The focus ring | every screen (keyboard) | a ring that shows on the band's dark ground |
| The paper round the staff | practice, piece maker, trainers | 124 plain rows now; a painted frame is allowed (painter-project.md rule 4), nothing over the notes |
| Kiur | practice, menu, results, settings, credits | a head-and-shoulders picture if he speaks from the band |

## TODO

Work tags (d116, `docs/automation/todo-tags.md`). The band's kit itself is the `TODO(painter, R2)` line in `docs/features/ft_1_20-action-and-inventory-strip.md`; the lines here are what is left open beside it. The release is the band's (R2); the architect may move a line. The pull request that does a line deletes it.

- TODO(painter, R2): pictures for the cells the desk screens' buttons move into at the switch-over: the results' Again and Pieces (their wax seals, `paintSeal`, could lend the cell its picture), the name's Delete and Done, settings' Report a bug and Pieces. Until then they get the plain `TOOL_ICONS`.
- TODO(painter, R2): `results` on the all-screens sheet. It cannot be opened without data, so the band has not been looked at on it.
- NEEDS-HUMAN: the screenshot baselines must show the warm look (d118) and the parchment staff (d119). Delete this line when they do.
