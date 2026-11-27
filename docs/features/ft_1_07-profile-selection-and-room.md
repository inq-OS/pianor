---
id: "ft_1_07"
title: "Profile selection and player room"
scope: "Open the game on a profile chosen from a list (a new install makes no player: it asks for the first player's name); a player's room (the profile screen: name, level, XP, Settings and Quit) with buttons for the training dummy (practice songs), the door (the map of Keri) and the book (song list); add a profile and an admin page. One character per profile for the MVP; three characters per profile is a future idea"
effort: "medium"
status: "slices 1 to 4 and the admin page built; bare piano (AC11) not built"
completeness: 80
depends_on: ["ft_0_10", "ft_0_18"]
---
# ft_1_07: Profile selection and player room

The game opens on a main menu of players; choosing one opens that player's room. A new install makes no player: it opens on the name box, and the name typed there is the first player (a new instance of the game has no premade profiles; before, four players were seeded). Index: [FEATURES.md](FEATURES.md).

## Rules

- Profiles live in `src/game/profile/ProfileService.ts`. With no player whose save can be read (a new install, or only damaged saves; [d277](../decisions/game.md#d277)) the service starts on an unsaved stand-in (`askFirstPlayer`, `needsFirstPlayer`) that is never written, and `BootScene` opens the name box without Back (`firstPlayerBox`); `createPlayer` makes the first real player. The end-to-end tests start on four test players instead (`?players=test`, dev only, `TEST_PLAYER_NAMES` in `src/core/progression/repository.ts`, wired in `src/profileSetup.ts`). Dev pages with a player in memory still get "Player 1".
- Main menu (`ProfilesScene`, `src/core/layout/mainMenu.ts`, [d126](../decisions/game.md#d126)): one painted picture, the lantern over Keri ([keri/scene-lantern.md](../keri/scene-lantern.md)), the game's name on a hung board at upper left, under it a parchment scroll with one written line per player (active one starred), an outlined "+" on the next free line, and at the sheet's head, in a fixed place whatever the player count, a keyboard (the bare piano) and the gear (Credits and Admin, behind the password gate, d082; default password `pianor`), named for what it holds ("Credits and admin" in its tooltip), not Settings. No heading, toolbar or band; the screen paints every row.
- Room: the profile screen (`ProfileDashboardScene`). Name, level and XP; Settings and Quit are on the toolbar (d088, Quit goes to the main menu). The room is a real room (ft_1_08): the upright piano and the objects are the buttons. Door opens the map of Keri ([ft_1_18](ft_1_18-keri-island.md)); book opens the piece list the piano opens ([ft_1_12](ft_1_12-training-piano.md)); a locked piece shows its level and cannot be played.
- Labels are Estonian capitals (ft_0_18).
- One character per profile in the MVP; a three-character party changes the save format only in its own round.
- Names are typed on the computer keyboard into the game's own name box (`NameScene`, `core/text/nameEntry`, [d295](../decisions/game.md#d295)): the song book closed (`paintCover`, `paint/book.ts`), a massive old book running off the screen's foot: worn leather, a rounded spine, the deep block of its leaves, brass corners and clasps, gilt vines and leaves, and no words on it, round a blank brass name plate that is the box, with a red caret that blinks between full and faint (never gone), delete and done; over the plate the game writes the ask in gilt letters (a new player: type your name; a rename: the new name for whom), also the field's accessible name; only the Estonian name letters are taken, up to 12. No letter buttons; a see-through text field over the box brings up a tablet's own keyboard (and lets a keyboard with no Estonian layout write Õ, Ä, Ö, Ü, Š and Ž), and the game draws the name. Where the page could not focus the field (a page in a frame), the first press anywhere on the screen focuses it. The main menu's line holds the longest name in the widest letters whole (`nameFit.test.ts`).
- Admin lock (`core/admin/adminLock`): the right password opens admin for 30 minutes, kept in memory only. A lock button on the admin toolbar locks at once; when time runs out an open admin screen returns to the gate.
- Admin page: export the active player, import a file as a new player, rename, delete. Save format unchanged.
- Delete (`AdminDeleteScene`, two columns of five): first tap on a name asks, second deletes; the last player cannot be deleted: a tap on it says so at once, with no question first.
- A device keeps at most 10 players; the "+" is gone at 10 and an import as a new player is refused. New players go at the end of the plates.
- `AX-3 provisional:` the keyboard opens the list of own pieces (only with the editor flag) and the gear a small menu of Credits and Admin, until the architect says what the bare piano opens and what Settings shows before a player is picked (mailed).
- Not verified (needs human): the room layout, pictures and name box on a tablet (that a tap on the box brings up its keyboard) and the laptop; a main menu with more than about seven players (extra names run below the screen; no scrolling yet).

## Acceptance criteria

- **ft_1_07.AC1** On a first start with no player saved, or none whose save can be read, no player is made: the game opens on the name box (no Back), and the name given there is the first and active player; nothing is saved before it. A damaged save is kept and shown on the main menu. Existing saves gain no players.
- **ft_1_07.AC2** The main menu is the first screen: the painted lantern picture with the parchment of players, the "+", the keyboard and the gear as in the rules above. The main menu has no Free play button (ft_1_12).
- **ft_1_07.AC3** Choosing a player opens that player's room: name, level and XP; Settings and Quit on the toolbar (d088).
- **ft_1_07.AC4** The room's door opens the map of Keri, the book the piece list (a locked piece shows its level and cannot be played); since ft_1_08 the objects are the buttons.
- **ft_1_07.AC5** All new labels are Estonian in capitals (ft_0_18). [human]
- **ft_1_07.AC6** An admin page can export the active player, import a file as a new player, rename the active player and delete players (from a list; the last cannot be deleted). Rename uses the name box: the name is typed on the computer keyboard (no letter buttons), up to 12 letters. The save format is unchanged.
- **ft_1_07.AC7** One character per profile in the MVP. [human]
- **ft_1_07.AC8** The right admin password opens admin features for 30 minutes (memory only, a reload locks); a lock button locks at once and returns to the main menu; when time runs out an open admin screen goes to the gate.
- **ft_1_07.AC9** Deleting a player: Admin, the password if locked, Delete player, the list; the first tap asks ("Delete ANNA?"), the second deletes; the last player cannot be deleted.
- **ft_1_07.AC10** New player asks for a name; a blank name or one another player has (any case, `core/progression/playerNames`) is refused with the reason, and Back adds nobody. Renaming follows the same rule. At most 10 players per device.
- **ft_1_07.AC11** The bare piano: the keyboard on the main menu opens a plain piano screen with no player, piece, judge, XP or save. It plays the sampled piano and writes every key played on a grand staff as it sounds (the played mark of ft_1_12.AC7; scrolling, or cleared at each new bar), so free play still trains reading (AX-0). Shown always, not only behind the editor flag. `AX-3 provisional:` the rule is the architect's; until built the keyboard keeps the provisional route to the own pieces. (Not built.)

## TODO

Work tags ([todo-tags.md](../automation/todo-tags.md)); the closed issue in brackets keeps the earlier discussion.

- TODO(builder, R2): build the bare piano of ft_1_07.AC11: a piano screen from the main menu's keyboard, with no player, piece, judge, XP or save, writing each played key on a grand staff as it sounds; then remove AC2's provisional route to the own pieces and the editor-flag gate on the keyboard.
- TODO(builder, R2): a save that fails to load must not vanish from the profiles screen: `listProfiles()` (`src/core/progression/repository.ts`) also returns the ids it could not read, and the screen shows one greyed tile per unreadable save (a broken-save picture, no name editing); the kept copy under `pianor/v1/corrupt/` is never deleted or overwritten (AX-2.1; AX-3 provisional).
- TODO(builder, R3): gameplay numbers on the admin hub: accuracy per difficulty, the door's tempo share, XP values, hint costs (the key-light hint at half cost), time-window multipliers; overrides over the content defaults in the per-device admin record (v2 with a tested migration), the rules in `src/core` still take plain numbers.
