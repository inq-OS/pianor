---
title: "Decisions: Game design"
---
# Decisions: Game design

The campaign, characters and challenges, the teacher and curriculum, Keri, progression and screens. One entry per decision, oldest first. Index: [DECISIONS.md](DECISIONS.md).

## d004

**`docs/authoring/au03-chart-format.md` is the one chart format; level 1 and 2 pieces use steps and repeats only.** Features: ft_0_02, ft_0_04.

Thirds are introduced at level 3.

Check: `tools/piece/lint.test.ts` "describes a leap with its interval, the notes, and what the level allows"

## d015

**Grand staff and two-hand play are in the MVP, with a bonus of up to +50% for notes pressed within 300 ms.** Features: ft_0_15.

The curriculum a beginner follows demands two hands. The bonus counts only notes pressed together and first try, never penalises and does not change stars.

Check: `src/core/scoring/handsBonus.test.ts` "adds up to 50% when every note was played together first try"

## d019

**The linter checks a compiled chart against the level table `content/curriculum/levels.json`, which is provisional.** Features: ft_0_04.

`lintPiece` is independent of how a chart was made and reports `piece.abc:line:column` with stable rule codes (capped at 8 per rule). Level switches default off: `handsTogether`, `chords`, `ties`, plus `bars: {min, max}`; a jump is measured in diatonic steps; a note outside a hand position is a warning. Difficulty score is `pitches + 2 x leap points + 3 x rhythm variety + 10 x hand independence + 0.25 x bars` (a first guess); the table awaits a confirmed curriculum.

Check: `tools/piece/lint.test.ts` "caps repeated reports of one rule and says how many were left out"; `tools/piece/lint.test.ts` "points at the note in the ABC file with line and column, and names bar and beat"

## d029

**The MVP gains a one-line staff (ft_0_16), with the piece editor planned after it.** Features: ft_0_16, ft_1_02.

A whole 8-bar two-hand piece drew at 13 px between lines at 1366x768; one line at a time gives 25 px for two hands and 32 px for one, which serves the big-notes rule. It adds per-player settings, so profile version 2.

Check: `src/core/layout/lines.test.ts` "one line of a two-hand piece: 20 px or more between staff lines at 1366x768"

## d030

**The editor has no limits, and own pieces get `license: "NaN"` and stay private.** Features: ft_1_02, core_08.

Anyone writes any piece; it is playable at once and earns XP, and the person who saves it is the approver (agents never approve, tests never save into real content). Own pieces live in browser storage or the gitignored `private/pieces/`, never in `content/pieces/` and never deployed; the lint rule `license` accepts `NaN` only for them. Pieces can be turned on and off per player (ft_1_02c).

Check: `tools/piece/license.test.ts` "ft_1_02b.AC3 warns about NaN in content/pieces and says why"

## d035

**The piece editor is built in parts a to d, and every edit is a pure function that returns a piece or a refusal reason.** Features: ft_1_02, ft_1_02a, ft_1_02b, ft_1_02c, ft_1_02d.

ft_1_02a is the editor, b own pieces as files, c pieces on and off per player, d dotted notes and piano entry. The editor writes the ABC and meta a person would write and runs `checkPiece` against the lowest level the piece fits (highest when none fits). Own pieces are stored on the device (localStorage key `pianor/v1/own-piece/<id>`, record `schemaVersion` 1, ABC plus meta), not per player, open from level 1 and have licence `NaN`. Only what the staff can draw can be made (white keys, whole to eighth, no dots, ties or chords at first); the title is a real text field over the canvas.

Check: `src/core/editor/pieceFile.test.ts` "ft_1_02b.AC1 export then import gives the same piece"; `src/core/editor/model.test.ts` "refuses a note that would cross the bar line or run into another note"

## d036

**The mascot is Kiur, a songbird, and the main menu offers the editor as a tab.** Features: ft_1_02a, ft_0_13.

`?editor` is on unless the address says `=0`; menu tabs are each as wide as their word with the chosen one drawn flat and dark with gold letters. Kiur is 24 x 20 with moods idle, cheer and thinking. Changed by d114 (Kiur is a tree pipit).

Check: `src/game/ui/pixel/kiur/kiurModel.test.ts` "takes 24 x 20 layout cells as the mascot, every mood the same size"

## d081

**UI text is kept per language in typed catalogs, the letter case is applied where text is drawn, and Estonian is the default.** Features: ft_0_18.

The English catalog (`src/core/text/strings.ts`) is the key source; `strings.et.ts` is `Record<StringKey, string>`, so a missing key fails typecheck; no i18n library. The active language is module state in `src/core/text/language.ts`, set once at boot, Estonian by default, `?lang=en` for English (used by e2e); unit tests run in English (`tools/test/englishText.ts`) unless they set the language. Catalogs hold sentence case; the pure `displayText` applies the case at the render boundary (`PixelText`, `keepCase` only with a reason in code). Changed by d086 (Estonian drawn in small capitals; no reserved mark rows).

Check: `src/core/text/language.test.ts` "ft_0_18.AC2 has an Estonian entry for every English key, and no extra ones"

## d082

**The admin password is a salted SHA-256 hash in one per-device record, outside every profile.** Features: ft_1_07, ft_0_14.

The record `pianor-admin/record` (own `schemaVersion: 1`, same `KeyValueStore` but outside the `pianor/` prefix so saves, store moves and player export never carry it) keeps a salt and `SHA-256(salt + ":" + password)` as lowercase hex (`src/io/admin/sha256.ts`, `crypto.subtle`; pure record/check in `src/core/admin/adminRecord.ts`). A missing, broken or unknown-version record falls back to the shipped default (password `pianor`); it is a child lock, not security. The gate takes the password typed on the keyboard shown as stars, no lockout; a change needs the old password, a non-blank new one, a matching repeat, and a new random 16-byte hex salt. The draft-pieces switch of `npm run start` is its own key `pianor-admin/drafts` (`1` or absent), effective after reload.

Check: `src/core/admin/adminRecord.test.ts` "reads back what it stored, and never keeps a plain-text password"; `src/core/admin/adminRecord.test.ts` "refuses a wrong old password first, then a blank new one, then a repeat that does not match"

## d087

**Every letter name the student sees follows the player's note naming: H for B natural, B for B flat.** Features: core_09, ft_0_17, ft_0_18, ft_1_02.

Every pitch or key letter shown follows the active player's `noteNaming` (`src/core/text/noteName.ts`; default `H` for a new Estonian player): hint labels, the note-name trainer and the piece maker's key button (`keyLabel` in `src/core/editor/key.ts`: `H`, `Hm`, `B`, `Bm`; `keyNames`: "B duur / g moll"); new screens use these helpers. A key keeps its own letter and sign (C flat major stays `Cb`), unlike a note hint (core_09.AC6). Stored and written data stay standard (ABC `K:` via `abcKey`, chart spellings, MIDI).

Check: `src/core/editor/key.test.ts` "names the key on the key button with the player"; `src/core/text/noteName.test.ts` "never gives a natural B the letter B in H mode"

## d088

**Every screen has one frame of toolbar, vine, main area and keyboard, drawn by PixelScene.** Features: ft_Y_12, ft_0_16.

The bands are toolbar, one vine line across the screen, the main area, and the auxiliary area (the on-screen keyboard); `PixelScene` draws the frame for every scene with a pure layout in `src/core/layout/frame.ts`, unit-tested at 320 art pixels wide. Global static items are the player's name, rank, XP, settings and Back; when space runs out the XP numbers go first, then screen items become icons, then a long name is cut (the name screen allows 12 letters, an imported save up to 40). Screens without a player (profile picker, admin) omit name, rank and XP; the first screen omits Back; settings omits its own gear. Height is about 20 art rows plus 3 for the vine. Dev pages (spike, keys, audio, preview, profile demos) are not framed. Changed by d099 (the keyboard switch is on the settings toolbar only) and d115 (items move to the action and inventory band at the foot).

Check: `src/core/layout/frame.test.ts` "fits the smallest screen with the longest name: the XP numbers go first"

## d095

**The tug plays the student's piece; a character sets only the level.** Features: ft_1_06, ft_1_21.

Level 1 plays the first half of the piece rounded up, levels 2 and 3 the whole piece (`tugPart`, `src/core/exchange/tug.ts`). Students can use pieces from their lessons, their own pieces and any piece turned on (AX-0.3).

Check: `src/core/exchange/tug.test.ts` "level 1 plays the first half of the piece, levels 2 and 3 the whole piece"

## d098

**Practice earns the piece XP and a piece level, not the player; levels lock no piece.** Features: ft_1_13, ft_0_10, ft_1_12, core_04.

Each finished pass earns its piece ft_0_10's XP, recomputed from the saved results whenever the profile is read (`deriveProgress`, a pure function of the history, no save bump); the piece level comes from `pieceLevels` in `content/curriculum/progression.json`, provisionally `[0, 50, 150, 300, 500, 750, 1050, 1400, 1800, 2250]`. A new attempt saves an XP breakdown with `total: 0`; player XP is the sum of saved totals plus tugs plus trainer XP, so earlier XP is kept. No piece is locked by level (pieces shown are those turned on, ft_1_02c); player levels open scenes only (d113). The score screen shows session piece XP, piece level and bar, and a card shows the level of a played piece.

Check: `src/core/progression/pieceLevel.test.ts` "ft_1_13.AC1: a piece earns the ft_0_10 XP of each of its passes, and its level comes from the piece curve"; `src/core/progression/pieceLevel.test.ts` "ft_1_13.AC3: a level-up announces no unlocked pieces: player levels lock no piece"

## d099

**The on-screen keyboard is hidden at first and its switch is on the settings screen only.** Features: ft_Y_12, ft_0_16. Changes d088.

Every visit starts with the on-screen keyboard hidden, in every mode and with or without a piano; computer keys still play, and `?keys=1` shows it from the start. The switch is a toolbar button at the right end of the settings screen's toolbar (`toolbarLayout`'s `keys`, `PixelScene.toolbarKeys`), lit while shown, lasting for the visit on every screen and not saved (`settings.keyboard.onScreen` drives nothing). Without a piano the practice screen points at the computer keyboard (`midi.notConnectedHidden`), and at both while the keys are shown. Reverses ft_Y_12 item 4.

Check: `src/core/layout/frame.test.ts` "puts the on-screen keyboard switch at the right end of the settings screen only, after its own items (d099)"

## d108

**One world model of Keri in real metres; every scene is a projection of it and art never hardcodes where a real thing is.** Features: ft_1_18, ft_1_14, ft_1_17, ft_Y_14.

`content/world/keri.json` (zod schema, `schemaVersion` 1, new fields optional) holds the island in local metres, origin at the lighthouse (59.6987220 N, 25.0227421 E), x east, y north, z up: coast, building footprints with heights and looks, paths, landmarks, and scenes (viewpoint, eye height, facing bearing, field of view; windows are scenes), each with its source. Pure `src/core/world/` (90% coverage) gives `toLocal`/`toGeo`, `bearingTo`, `distanceTo` and the sun's elevation and azimuth for the world's origin (not Tartu); scenes place things through a pure layout projection (map top view north up; side views map bearing to x, elevation to y), so the game stays offline (d068). Status: AX-3 provisional; the offline `tools/world/` builder, the sun's azimuth and the side views are not built, and an explorable real-size Keri is undecided and needs its own decision against AX-0.

Check: `src/core/world/world.test.ts` "ft_1_18.AC2 loads the shipped world file and refuses one without a schema version"

## d112

**Keri's places are painted scenes, each one picture opened from the map.** Features: ft_1_19, ft_1_18, ft_1_14, ft_1_17.

A scene is one painted picture seen from inside a place (as the room, d111), with a strip free under it; the map shows a place for each scene and pressing it opens the scene. Which places are scenes and what lives there come from the maintainer, never invented (`KERI-TODO`, ft_1_19).

Check: `src/core/layout/keriMap.test.ts` "ft_1_19.AC2 every scene of the world model has a button round its place"

## d113

**Levelling up opens scenes.** Features: ft_1_19, ft_1_18.

A scene carries a `level` in `content/world/keri.json` and is open when the level from total XP (`levelForXp`, `src/core/progression/xp.ts`) is at least that; the knoll (x -50, y -2 m from the lighthouse, good to about 15 m) is level 1. A scene not yet open is painted on the map but is no button. For each reference picture, the agent notes what it sees in `docs/keri/` (map, room, knoll) with improvement tips that are not built until picked.

Check: `src/core/world/openScenes.test.ts` "ft_1_19.AC2 a scene is open when the student"

## d115

**A band at the foot of the screen holds a 3 x 3 grid of actions and an inventory of items; places are used in their picture.** Features: ft_1_20, ft_0_13, ft_1_18, core_09.

The band (56 rows) replaces the top toolbar and the vine, so a painted place (124 rows) and the band fill the 180 rows; the toolbar stays in code behind one frame-layout flag, off by default (with it on the main area is 101 rows). An action is a cell; a thing with a state or put somewhere is an item (the piece maker's lengths, rest, accidentals, ties, dynamics are held items put on a note by a click; a pure model in `src/core/`). There is no sentence line (a cell names itself in a tooltip bubble, a screen's message is a Kiur speech bubble) and no verb-and-object grammar; Back and Settings are the door and the gear in the top corners, faded until the pointer is on them; the player's name is on the room's rank shield and a plant on the piano grows with XP. In a painted place (room, map, every scene) a thing is pressed in the picture only, not also in the grid, and shows a contour or second look under the pointer; a cell with no action is not drawn. Sizes and per-screen mapping are in ft_1_20; the painter draws the band, the 10x dev builds it, plain panels stay behind a URL switch until every screen uses it. Look set by d118. Changed by d282 (the bubble, the strip and the backpack replace the band).

Check: `src/core/layout/frame.test.ts` "ft_1_20.AC21 gives the main area 163 rows over a strip on the target screen and all 180 without one (d282)"

## d117

**After two idle minutes in the room a screensaver visits the open scenes.** Features: ft_1_17, ft_1_18, ft_1_19, ft_1_14.

The screensaver opens the first scene the student's level has opened, stays 45 seconds, then goes to the next in the world model's order, round and round (`src/core/visit/islandVisit.ts`); any key, note, tap, pointer move or Back returns to the room.

Check: `src/core/visit/islandVisit.test.ts` "ft_1_17.AC4 the screensaver goes round the open scenes in order and starts over"

## d125

**The map draws a caricature of Keri, 1.45 times as wide and turned 8 degrees, with places and rocks larger than to scale.** Features: ft_1_18, ft_1_19.

The step from measured island to map is one pure function `caricature(world, shape)` (`src/core/layout/keriMapShape.ts`) with every number in `MAP_SHAPE` (`src/core/layout/keriMap.ts`: fat, tail, tip, turn, swells, spreads, moves, lines); the true shape returns the measured island exactly, and the world model stays measured (only the map's plan and painter use the caricature, `plan.at` places a measured point). The island is 1.45 times as wide on its short side and turned 8 degrees counter-clockwise (north is no longer up; the compass rose turns with it); the lighthouse is drawn 3.3 times, houses about 3 times as tall on a ground plan about twice as large, the mast 2.4 times, with about fifteen large rocks in the sea. `spreads` push houses, landmarks, scenes and paths outward round the lighthouse, warden's house and power station; `tip` sharpens the north-west end; the south-east is no land but a sand strip (`SAND_ROOT`, `beyondCut`, `plan.sand`) drawn as an almost unrecognizable sea creature's back; `moves` (with optional `hold`) and `lines` (with `keep`) place things and paths where the maintainer marked. Departures are listed in `docs/keri.md` section 9.

Check: `src/core/layout/keriMapShape.test.ts` "ft_1_18.AC2 a fatter island is wider across its short side and as long as before"; `src/core/layout/keriMapShape.test.ts` "ft_1_18.AC2 the true shape changes nothing"

## d126

**The main menu is the lantern over Keri filling the screen, with the players down a parchment sheet, and paints every row itself.** Features: ft_1_07, ft_1_20.

The picture is the lighthouse lantern seen from above with the island projected from the world model (`src/core/layout/lantern.ts`, `src/game/ui/pixel/keri/lanternPicture.ts`), painted per hour, filling the whole 640 x 360 fine pixels with the lantern on the right. Players are lines of ink on a parchment scroll hanging under the game's name at the upper left (`src/core/layout/mainMenu.ts`, `src/game/ui/pixel/menuArt.ts`): ten at most, the active one marked with a red star, a name turning red and underlined under the pointer (`look: 'ink'`), an outlined "+" on the next free line (gone at ten, ft_1_07.AC10), and at the sheet's head a keyboard (the bare piano) and the gear (Credits and Admin) that never move; the sheet's buffs are the same at every hour and it has no heading. A scene sets `wholeScreen` and `frameView` to take the whole screen (`whole` in `FrameOptions`: no toolbar, vine or band, even with `?band=1`); only the main menu does. The game's name is drawn from string key `app.title` on a board over the corner, never in the picture. AX-3 provisional: the keyboard opens the own-piece list (editor flag) until the bare piano exists. An exception to d088.

Check: `src/core/layout/mainMenu.test.ts` "the picture is the whole target screen"; `src/core/layout/mainMenu.test.ts` "the sheet holds the most players a device may have"

## d129

**A character challenges the student in a scene, and the two trade the phrases of the student's piece.** Features: ft_1_21, ft_1_06, ft_1_19.

A challenge (VÄLJAKUTSE) is held with a character (TEGELANE), over the scene picture where it was met, with no stage of its own. The student's piece is cut into two-bar phrases (a pick-up joins the first bar); the character plays one, the student answers with the next, each answer is an exchange won when the share of notes right first try (on time in Tempo mode) reaches the level's share (60, 80, 95 per cent); a standing of three steps each way moves one step per exchange, the student wins at +3 and the character at -3, and if the part ends first it restarts with roles swapped. Levels are d100's (from memory, no staff; 1 Wait mode, 2 Tempo mode with click, 3 Tempo mode with only the count-in); feedback is one objective fact per exchange and wrong notes keep their reason; a won challenge pays the prize, a lost one half the prize times furthest standing over 3, nothing taken, retry at once. Numbers (three steps, the shares) are unverified with children.

Check: `src/core/exchange/tug.test.ts` "content/challenge/rules.json parses and holds the defaults: 3 steps, shares 60, 80, 95 per cent"; `src/core/exchange/tug.test.ts` "the student wins at +3 and the character at -3"

## d132

**Characters are met by practising, talked to first, teach phrases for a phrase book, and give an item for a won tug; every character ties to music.** Features: ft_1_21, ft_1_22, ft_1_23, ft_1_19, ft_1_20, ft_1_06, ft_1_07.

The challenge is the tug of reputation (one marker, three steps each way; Kiur's practice tug changed by d160); question and answer is the advanced-level challenge. A character can appear only after enough practice in the room (from the practice records, never time spent), semi-randomly in an open scene, replacing d113 point 2 for characters; a lost tug is followed by a cool-down counted in real practice, never hours. Pressing a character opens a conversation first; a won tug gives an item into the band's inventory (ft_1_20). Every character ties to music: it teaches a phrase of its style (three tries, shown on the staff and heard), a phrase becomes "mine" only when played clean in the room on a later day, and learned phrases go in the phrase book (no class screen); phrases are original or public domain. The knowledge layer (a character's field, with control-question levels) is optional, per player, switched under admin, and gated by playing; the birth date is stored as year and month only in the local save, never in reports or logs, and sets the default text level (ft_1_23).

Check: `src/core/island/presenceRules.test.ts` "needs the practice threshold, never time"; `src/core/exchange/teach.test.ts` "ft_1_22.AC3 the student has three tries"; `src/core/exchange/phraseBook.test.ts` "ft_1_22.AC5 lists every taught phrase by its character"

## d135

**A character's piece goes learn, practise, show.** Features: ft_1_06, ft_1_21, ft_1_22.

The three phases are learn (the character teaches the piece, ft_1_22), practise (in the room and trainers until the evaluation says good enough, core_12) and show (the tug, ft_1_21). The gate to the tug is the practice evidence the evaluation already keeps, not a separate timed screen.

Check: `src/core/exchange/tugGate.test.ts` "ft_1_06.AC15 it opens when the median of the last plays reaches the level"

## d138

**One difficulty scale 1 to 10 for phrases and pieces, proposed by the estimator and confirmed by a person.** Features: ft_1_22, core_08. Changed by d157: its ten steps are now the Beginner grade, the rest still holds.

Every phrase and piece may carry an integer `difficulty` 1 to 10 in its meta file (1 a few notes in five-finger position, one hand; 10 a whole piece in full complexity; anchors in `docs/architect/cast-and-phrases.md` section 3). The core_08 estimator proposes it, a person confirms it, and a generated draft carries it marked `proposed`; `piece:lint` checks the range. MVP phrases are 1 to 3, and levels (`content/curriculum/levels.json`) stay a separate field.

Check: `src/core/piece/difficulty.test.ts` "core_08.AC2 gives 1 to 100, two points per step of d138 in the Beginner grade"; `src/core/chart/schema.test.ts` "takes an optional difficulty"

## d139

**The curriculum model: play score, median level, consistency rule, Theil-Sen prediction, urgency, colours and medals.** Features: core_12, ft_1_26, ft_1_27.

All numbers are teacher-changeable defaults, AX-3 provisional. A curriculum piece (set only by the teacher) has a deadline and priority 1 to 10; a play scores 0 to 100: pitch 60 %, timing 30 %, tempo 10 % in Tempo mode (pitch 100 % in Wait), kept per hand. Level is the median of the last X=10 plays, spread their standard deviation; retained when at least Y=3 of the last X reach the expected level and at most Z=2 fall below, none by more than B=15. Expected = 85 + priority; predicted = Theil-Sen trend of daily medians over the last 14 practice days projected to the deadline, capped at 100, none under 3 practice days; delta = expected minus predicted; urgency = max(0, delta) x (1 + priority/10) / sqrt(days left + 1), priority 5 to 10 with positive delta first. Colour: purple under 3 plays, green by predicted over expected, strong green when retained and reached; medal by achieved over expected: bronze 85 to 95 %, silver 96 to 105 %, gold above. Pure functions in core_12 (core_12).

Check: `src/core/curriculum/evaluate.test.ts` "content/curriculum/evaluation.json parses and holds the defaults of d139"; `src/core/curriculum/evaluate.test.ts` "urgency = max(0, delta) * (1 + priority / 10) / sqrt(days left + 1)"; `src/core/curriculum/evaluate.test.ts` "medal by level over expected: bronze 85 to 95, silver 96 to 105, gold above"

## d140

**The teacher's screen sits behind the academic hat with her own password, on the same laptop, with requests through GitHub's form or mail.** Features: ft_1_26, ft_1_16.

The gate takes the teacher's own password, separate from the admin page's, stored as d082's salted hash in its own record, default `pianor` (the same word as the admin default, a record of its own, so changing one never changes the other), changeable; it is a child lock and says so. The teacher works on the same laptop (importing a curriculum from elsewhere is later). Requests (title, kind bug/improvement/feature/contact, text) open GitHub's new-issue page filled in as the bug report does (ft_1_16); "contact" opens the mail program with a contact address typed once into device settings, never in the repository. Calendar notes are private to the device, never logged or reported.

Check: `src/core/admin/teacherRecord.test.ts` "ft_1_26.AC1 opens with pianor by default, from a record of its own"; `src/core/admin/teacherRecord.test.ts` "is stored under its own key, outside the admin record and every profile"

## d157

**Difficulty is 0 to 100 points in five grades of 20 (Beginner, Intermediate, Advanced, Expert, Master), each shown as five stars of 4 points that fill partly; a confirmed `difficulty` counts half stars, 1 to 50.** Features: core_08, core_05. Changes d138.

The ten steps of d138 are the Beginner grade unchanged (two points each), so phrases, tug levels and every confirmed number keep their meaning and the meta field only widens from 1 to 10 to 1 to 50 (no schema version change). A grade's top is its own: 20 points is Beginner with five stars, 21 Intermediate with a quarter star. Above Beginner the estimator's points are AX-3 provisional until fitted to outside grades (Henle 1 to 9 through CIPI; roughly Intermediate ABRSM 1 to 3, Advanced 4 to 6, Expert 7 to 8, Master diploma and concert), because the rules score orders concert pieces poorly.

Check: `src/core/piece/difficulty.test.ts` "core_08.AC2 maps a score onto half stars 1 to 50"; `src/core/piece/difficulty.test.ts` "core_08.AC5 confirmed half stars are the stars a card shows"; `src/core/chart/schema.test.ts` "takes an optional difficulty, a whole number of half stars from 1 to 50"

## d160

**Kiur trains a tug on any piece, won at two steps, and a tug that stalls gets harder until it ends.** Features: ft_1_21. Changes d132 (Kiur's practice tug).

Pressing Kiur in the room opens the piece book; he tugs the piece picked at 2 steps each way (`practiceSteps`), at the highest level it is practised for, with nothing kept and no cool-down. In every tug, after 4 student phrases with no winner each further phrase needs 5 percentage points more of its notes (`stall` in `content/challenge/rules.json`), up to all of them (AX-1: harder, never a punishment). Kiur is a trainer for any piece with fewer pulls to a win, and every character eventually overpowers a stalling student.

Check: `src/core/exchange/tug.test.ts` "ft_1_21.AC17 the first four student phrases need the level share"; `src/core/exchange/tugPlay.test.ts` "ft_1_21.AC14 his tug is won and lost at practiceSteps (2)"

## d169

**Every character in `content/characters/` keeps the character rules of d270 to d274, checked by one pure function.** Features: ft_1_21, ft_1_22.

`characterProblems` in `src/core/character/rules.ts` lists every rule a character breaks, and `tests/content/characters.test.ts` runs it over every character file; a character still being made lists its known gaps there exactly. Not checked yet: the final level as the whole song in a tug (ft_1_32 slice 4).

Check: `src/core/character/rules.test.ts` "a character that keeps them all has no problem"; `tests/content/characters.test.ts` "there is at least one character to check"

## d170

**Game text is Estonian in capitals by default.** Features: ft_0_18.

Estonian ALL CAPS by default; d086's small capitals draw every letter as a capital, so no lowercase letter is shown.

Check: `src/core/text/language.test.ts` "ft_0_18.AC1 Estonian is shown in small capitals by default"

## d179

**Keri's place words: the north jetty is for the warden and special characters, most visitors land at the southern docks; the terrace is before the main door, the garden at the house's south-east end.** Features: ft_1_19, ft_1_27.

The northern docks (the north jetty, today's docks scene) are used by the warden and some special characters, and most visitors arrive at the southern docks, a wider stone dock, so a request to draw the docks so that various boats can be shown means the southern ones; the teacher uses the southern port for arrival. On the photo map the terrace is the deck with red benches right in front of the main door and the garden the benches and beds at the south-east end: two places, never mixed (`docs/keri.md` section 10).

Check: `src/core/layout/docks.test.ts` "ft_1_19.AC1 the docks are a scene of the world model on the north shore behind the warden"; `src/core/layout/port.test.ts` "ft_1_19.AC2 the harbour is a scene of the world model, at the southern slipway"

## d180

**Every place where a painting swaps a real Keri feature for an MI one is logged as a decision; lore and a tour-guide layer are documented only.** Features: ft_1_18, ft_1_19.

Every place where Keri is changed to take a feature from MI2 is recorded: a departure is a decision and gets a row in `docs/keri.md` section 9 (the first, the knoll's overhanging tree, which Keri does not have), and a difference nobody decided is a mistake to fix or a question to ask. The tractor under the ice and the Kaleva memorial are only written down, not painted, until the maintainer asks for them on the map; a tour guide or standalone adventure layer is an `IDEA`, never built toward unasked; a sunken-wreck scene is the maintainer's open question alone, never designed, painted or proposed.

Check: untestable: a record of decisions and what is left unpainted, judged by reading docs/keri.md section 9

## d189

**Screens say each thing once: no text that repeats a picture, no hint lines, symbol buttons, and a set of options is one cycling button; every grade is five stars.** Features: none.

On every screen, first seen on the ear trainer: a picture and a text saying the same thing keep the picture; results sit in the middle, note names on the staff; no hint lines; buttons small and out of the way. Each setting is one button showing its current choice as the student sees it in play and cycling on press. Every grade or rating is five stars, never three. Why: a young student should look at the music (AX-0).

Check: untestable: taste in screen design, judged by the maintainer

## d190

**At most ten players, each with a unique name; the admin unlocks with the password for 30 minutes and can lock again by hand.** Features: none.

A new player is asked for a name no other player has. The password is kept as d082 says.

Check: `src/core/progression/playerNames.test.ts` "ft_1_07.AC10 allows at most 10 players on a device"; `src/core/progression/playerNames.test.ts` "ft_1_07.AC10 refuses a name another player has, whatever its case or spaces"; `src/core/admin/adminLock.test.ts` "ft_1_07.AC8 the right password opens the admin features for 30 minutes"

## d191

**The book in the player's room stays hidden; everything goes through the piano.** Features: none.

The book has nothing of its own to offer.

Check: untestable: product rule on what stays hidden, judged by the maintainer

## d192

**A player named "tester" (letter case and spaces aside) has every scene open as soon as it is built, whatever the level.** Features: ft_1_19.

So a new scene can be tried before a player's progress opens it. Nothing is saved for it.

Check: `src/core/world/openScenes.test.ts` "opens every scene there is to the player called tester, whatever the level and the letter case"

## d193

**A student's curriculum level is not tracked; a piece's `level` is only the rule set it is linted against.** Features: none.

The game does not track an outside curriculum's level. Pick a piece's level for the difficulty it should have and never ask the maintainer to map content to a student's progress in outside lessons.

Check: untestable: a rule for agents on content work, not a behaviour

## d194

**The teacher lands at the southern port; walkers show on the map only while they move, each with its own visiting days, along the paths or the coast.** Features: ft_1_24, ft_1_25, ft_1_27.

The teacher's boat uses the southern slipway, not the north jetty. For every walking character: no dot on the map while it stands in a scene, a dot only while it moves between scenes; an arriving boat is seen on the map; not every day, some only on their own days (once a week, Sundays), set per character, not one global chance; most walk the map's paths and pavement, some (the fisherman) the coast; the fisherman stands at the southern port.

Check: `src/core/layout/port.test.ts` "ft_1_19.AC2 the harbour is a scene of the world model, at the southern slipway"; `src/core/world/world.test.ts` "ft_1_18.AC2 the boat slipway starts on the southern shore and ends in the sea"

## d232

**Nothing about Keri that the maintainer must tell is invented: a place, house, path, landmark or which place a photograph shows is written `KERI-TODO` and asked.** Features: ft_1_18, ft_1_19.

Places come from the world model (`content/world/keri.json`, d108) and the maintainer's word; a guessed photograph location is never painted as a landmark; props that only frame a picture are allowed and said to be props (CLAUDE.md Keri, `docs/art-direction.md` rule 14, `study-a-picture` and `artists-notes` skills, d112).

Check: untestable: whether a fact was invented is judged by the art review and the maintainer

## d233

**A challenge can be lost, but a loss still earns XP and never takes any away.** Features: ft_1_21, ft_0_10.

AX-1.1: a lost tug pays half the prize times the furthest standing over 3, leaving pays nothing, and no total ever goes down (CLAUDE.md, product rules; `docs/axioms.md`).

Check: `src/core/progression/profile.test.ts` "a lost battle pays what it paid, and nothing is ever taken away"; `src/core/exchange/tug.test.ts` "a won tug pays the prize"

## d247

**Characters on Keri carry names from folklore; the teacher alone keeps the generic name Õpetaja.** Features: ft_1_21, ft_1_22.

Adds to d169 (a character stays unnamed until known, teaches a specialty and plays a real public-domain piece, d270 to d273); the cast is in `docs/architect/cast-and-phrases.md`.

Check: untestable: naming of characters, judged by the maintainer

## d248

**The teacher's screens are administrative: no gameplay and no band, only the plain toolbar.** Features: ft_1_26.

They set the curriculum, so the band's actions, the inventory and the XP plant stay off them.

Check: untestable: what the teacher screens show, judged on the screen

## d249

**Asking a character who they are is a short lesson of its own, in folklore, science or philosophy.** Features: ft_1_21, ft_1_22.

Until the student asks, the name stays hidden (d270); the answer gives the name and the lesson. Names and ideas come from Estonian folklore (d247). Each character's tunes are public domain (traditional, or by a composer dead more than 70 years, in an own transcription), fit the character's spirit, and the character tells about each piece and where it comes from before teaching it.

Check: untestable: content of the characters' answers, judged by reading `docs/architect/cast-and-phrases.md`

## d250

**A pass on the map of Keri changes only the places it was asked to change, and never moves a place to make it easier to paint.** Features: ft_1_18.

A place that is hard to paint where it stands is painted there; every place is checked and a moved one comes back as misplaced (d125).

Check: untestable: which places a pass was asked to touch; the places themselves are held by d125

## d263

**The knoll's tree spirit is Tammehaldjas, a folk spirit whose tunes are a runo-manner line, the first half of Frère Jacques and the opening of Greensleeves; the node that teaches a phrase piece first says that piece's about line.** Features: ft_1_22.

The name is a folklore name as d247 asks (en "Oak spirit"; its ids stay `puuvaim`), shown once the student asks who it is (d249). Levels 1 to 3: a line in the runo song (regilaul) manner written for Pianor (CC0), the first half of the round Frère Jacques, the opening of Greensleeves in E minor in even quarters, at base tempos 92, 104 and 112 a quarter. Every phrase piece has a string `piece.<id>.about` in English and Estonian telling about the piece and who made it (d169's background told), and the pieces stay drafts until the maintainer approves them in the piece preview (d025).

Check: `src/core/character/content.test.ts` "plays only pieces with an open licence and a named source, and tells about each one it teaches"

## d267

**XP stays as it is built: the toolbar, the rank shield and the note plant; no new place earns or shows XP.** Features: ft_0_10, ft_1_09, ft_1_13.

Gates (a character's tug, a scene opening) read the piece level of core_12, not the player's XP. A lit key costs reward as ft_Y_06 says.

Check: `src/core/exchange/tugGate.test.ts` "ft_1_06.AC15 it opens when the median of the last plays reaches the level"

## d268

**Characters are built in order: the tree spirit, then the Prangli fisherman, then the border guard; each is learn, practise, show (d135) and its final level is a tug.** Features: ft_1_21, ft_1_22.

The cast and each character's sheet are in `docs/architect/cast-and-phrases.md`.

Check: untestable: the order of building work

## d270

**A character's name stays hidden until the student asks who it is.** Features: ft_1_22.

Only a talk node reached through a choice sets the character's known flag (`knownFlag`, `known-<id>`), so opening and closing a talk is not enough; until then the name shows as three question marks.

Check: `src/core/character/rules.test.ts` "ft_1_22.AC10 its name shows as ??? until the student asks who it is: only a node reached through a choice sets its known flag"

## d271

**A character's levels run from 1 with none skipped, and each teaches 4 to 16 bars of a piece.** Features: ft_1_21, ft_1_22.

Checked by `characterProblems` (d169) for every character.

Check: `src/core/character/rules.test.ts` "each level teaches a piece of 4 to 16 bars, the levels run 1, 2, 3 with none skipped"

## d272

**Each level's piece is a real public-domain piece or an open-licence line in the manner of a named folk tradition, never one made for the game.** Features: ft_1_21, ft_1_22.

The piece has `license: "public-domain"` and a `source` naming its real origin (not original, composed by or generated), or an open-licence line written in a named folk tradition (d263).

Check: `src/core/character/rules.test.ts` "each piece is a real public-domain piece, not one made for the game"

## d273

**Each level's piece has its background in one line, said in the talk that teaches it, and the talk teaches something of the character's specialty.** Features: ft_1_21, ft_1_22.

The background is the string key `piece.<id>.about`; the specialty lines are the character's `lessons`, string keys said in its talk, at least one.

Check: `src/core/character/rules.test.ts` "each piece has its background in one line, said where the talk teaches it, and the talk teaches a lesson on its specialty"

## d274

**Every level beaten gives a new, named, drawn rung of the character's prize ladder, and no rung is on two characters' ladders.** Features: ft_1_21.

Checked by `characterProblems` (d169) for every character and across all characters by the content test.

Check: `src/core/character/rules.test.ts` "ft_1_21.AC18 the prize ladder has a new, named, drawn rung for every level"

## d277

**A new instance of the game starts with no players; the first screen asks for the first player's name, and players are only ever added by the person.** Features: ft_1_07.

The same holds when every saved player is damaged: the damaged saves are kept and shown, and no default player is made in their place. Only the end-to-end tests' `?players=test` (dev only) and dev pages that keep a player in memory start with players.

Check: `tests/progression/profile-service.test.ts` "ft_1_07.AC1: a new install makes no player, and nothing is written until the first name is given"; `tests/progression/profile-service.test.ts` "ft_1_07.AC1: a start whose only saves cannot be read makes no player either: it asks for a name and keeps the damaged save"

## d278

**The piano is a sandbox: a piece picked there plays in full with no learning gate, except a character's piece, which is still learned bar by bar first; learning and tugging go through Kiur, and a tug needs a learned piece.** Features: ft_1_32, ft_1_21. Changes d160 (pressing Kiur).

Pressing Kiur in the room asks Learn or Tug, and either opens the piece book. Learn opens the piece in learning bar by bar even when it was played to the end before (`PracticeData.learn`); Tug lists only the pieces whose whole learning plan is done (`pieceLearned`) and takes the one picked to the room for his tug. Free plays never count as learning for the tug.

Check: `src/core/learn/route.test.ts` "ft_1_32.AC13 the piano plays any piece in full, and a piece of a character is learned first"; `src/core/learn/route.test.ts` "ft_1_32.AC14 a piece is learned for the tug only once its whole plan is done, never from free plays"

## d279

**An old wall telephone in the room rings while the teacher's curriculum holds a piece whose learning has not begun, and a press on it opens that piece in bar-by-bar learning.** Features: ft_1_34.

The call is about the new piece due first (the higher priority on the same day); with none new, a press picks up the most urgent piece still being learned without a ring; with every curriculum piece learned the telephone is quiet. A curriculum piece picked at the piano plays freely, as any piece not a character's (d278).

Check: `src/core/curriculum/phoneCall.test.ts` "ft_1_34.AC1 rings for a curriculum piece whose learning has not begun"; `src/core/curriculum/phoneCall.test.ts` "ft_1_34.AC2 a call goes to the new piece due first, the higher priority on the same day"

## d282

**The band under every screen goes: actions open in a bubble round the pointer on a right click, a screen pins its few most-used actions in one slim strip, and the items a student keeps are in a backpack.** Features: ft_1_20. Changes d115.

The bubble's options keep fixed slots (eight round a ring, slot 0 up, then clockwise), an option with choices opens them in a row beside it, and a long press or the context-menu key opens it too. The strip is one row of 15-row cells along the foot (17 rows, none on a screen with nothing pinned) and ends with More, which opens the bubble, so nothing is reached by the right click alone; a word is never cut short. Only practice and the piece maker have a bubble; a screen whose actions fit the strip pins them all. Which action goes where is the table in ft_1_20, AX-3 provisional until the maintainer tunes it on the laptop.

Check: `src/core/layout/bubble.test.ts` "ft_1_20.AC19 an option keeps its slot whatever how many options the screen has, so the hand learns it"; `src/core/layout/bubble.test.ts` "ft_1_20.AC21 a screen with nothing pinned has no strip, and anything pinned takes one row of 15-row cells"; `src/core/layout/bubble.test.ts` "ft_1_20.AC18 never cuts a word: a word wider than a cell takes as many cells of the row as it needs"

## d284

**A two-hand piece is learned with both hands together by default; hands apart is a learning setting the player chooses.** Features: ft_1_32.

The learning settings page has a two-hand pieces choice: both hands together (the default) or hands apart (each growing step by the right hand, the left hand, then both). It applies to the next piece begun; a piece in progress keeps the plan it began with. Changes rule 13 of ft_1_32, which had hands apart for every new piece.

Check: `src/core/learn/progress.test.ts` "ft_1_32.AC12 a new piece is learned with both hands together unless the player chose hands apart, and a piece begun keeps the plan it began with"

## d286

**No silent tool action: every tool shows the result it would make before it commits, on the screen where it acts.** Features: ft_1_02d, ft_1_20.

Applies to the piece maker and to every new screen or tool. A pick that waits for a target (a tie or slur's end note, a pre-note's pitch, a repeat's bars) marks what it started from and draws its mark faint where the pointer's click would put it; an item or held item shows its change on the note under the pointer before the press. The preview is a picture on the staff or the screen, never a line of text, and nothing is written until the click. A tool that puts a mark at a bar line or a note snaps to the nearest one while the pointer moves, and its preview and its click use that same place.

Check: `src/core/layout/preview.test.ts` "ft_1_02d.AC25 note A then the same key right after shows one tie between their heads, and nothing else"; `src/core/editor/staff.test.ts` "ft_1_02d.AC27 the repeat pick lights the bars from its start to the pointer, either way round, with its signs on their outer sides"

## d290

**Code, content, tests and docs use only the words of `docs/glossary.md`; a dropped idea leaves no trace.** Features: none.

A current thing named with a word the glossary bans is renamed with no change of behaviour. What belongs to no current feature is deleted with every mention of it: no stub file, no rejected row, no note that it was removed. Only a frozen migration step may read an old save key (d064), and only the glossary's list of banned words names them.

Check: untestable: the word check against the glossary comes with its own CI step
