# Pianor releases and roadmap

## This week

**Goal: the student meets Puuvaim in the knoll, talks, and wins or loses one tug of phrases, end to end on the laptop.** The builder: take the old battle screens and core out (`ASAP(builder)` in [ft_1_21](../features/ft_1_21-challenges-with-characters.md)), then the tug in the scene from the `TODO(builder)` tags there (WP-10, WP-13). The painter: Puuvaim and the tug's look (`TODO(painter)` there). The maintainer: approve Puuvaim's phrases in the piece preview, then watch one play and write three lines in the architect thread.

**Also this week.** The builder takes these after the ASAP above, beside the tug; the goal wins if the two collide. In this order, each a `TODO(builder, R2)` in its feature file: the piece maker's drag-repeat handle ([ft_1_02d](../features/ft_1_02d-editor-extras.md)); the key-light settings rows, practice wiring and half-cost XP rule ([ft_Y_06](../features/ft_Y_06-key-light-hints.md); the real EZ-220 light still waits on the maintainer's silent-light test on the real keyboard); the circle of fifths ([ft_1_28](../features/ft_1_28-circle-of-fifths.md)); the scales and chords trainer, slices A to D ([ft_1_29](../features/ft_1_29-scales-and-chords.md)). The painter: the wheel's look and the trainers' icons, after the builder's first version of each.

**Real pieces, after those** (the goal: import and split 64 bars of a public-domain classical piece). In this order, each a `TODO(builder, R2)`: a real-piece level with no bar maximum and parts of any length ([ft_0_04](../features/ft_0_04-piece-linter.md)); the notation such a piece needs first, dotted quarter and eighth, sixteenths, first and second endings ([core_09](../features/core_09-notation-growth.md)); MusicXML import in the browser with parts proposed from double bars and repeats ([ft_Y_04](../features/ft_Y_04-piece-import.md)). Until then a real piece goes in as hand-written ABC with `phrases` for its parts (core_06).


The architect's working tool (roadmap questions are the architect's to decide). Each release is a GitHub milestone (R1 to R5, `Later pool`); when a grouping changes, change this file and the milestone together. Tracking rules: [labels.md](labels.md).

A release's work is the open issues in its milestone plus every doc tag carrying its release, `TODO(<project>, R2)` and the like (d116, [todo-tags.md](../automation/todo-tags.md#finding-work)); the release is the roadmap tag on a tag. Each release lists its content (feature ids), its gate in, its exit and what only the maintainer can do (the real EZ-220, playtests, approvals). **One release = at most one profile save bump** (d069). No dates: order and gates matter, the calendar does not. Order: R1, R2, R3, R4, R5; the Later pool takes items any time after their gate. Three tracks feed the releases: hardware (EZ-220 spike, key lights, EZ-220 sounds), art (sprite toolkit, monsters, tiles) and groundwork (refactors that keep the code from fighting the next release).

**R0 (done):** MVP features ft_0_00 to ft_0_16 except ft_0_01's measurements and ft_0_17, plus the piece editor (ft_1_02a, c), Tempo mode a to c (core_01), core_02 to core_05, sharps and flats (all slices), keyboard menus ft_Y_13, demo director ft_Y_09, the campaign's rules and save (ft_1_06 K1 to K3, K5), the shared play session and the scene and core groundwork. Much was built ahead of the student having the MVP, which is why R1 is small and first.

## Status

Open work is a doc tag (d116). Count a release's work with the grep in [todo-tags.md](../automation/todo-tags.md#finding-work).

| Release | Open |
|---|---|
| R1 | **Done** |
| R2 | **Open now.** Count the tags with the grep above (about 50). Built since then: dynamic marks, repeat signs, ties, slurs and grace notes (d120, d121), the band on practice, the piece maker, the trainers and results (ft_1_20), the warm wood on every screen (d118), Kiur (d114). Open, in order: the pictures loaded per hour; the piece maker's drag-repeat handle (ft_1_02d); the circle of fifths (ft_1_28); scales and chords (ft_1_29); the band's item model and the other screens (ft_1_20); the v18 save round (rhythm practice, helper marks, the wheel, text settings; none started); pick-up bars (d120 slice 1); the key-light settings and wiring, the real light after the maintainer's silent-light test (ft_Y_06); the painter's inventory sheet and the staff screens ([painter-project.md](painter-project.md) section 7) |
| R3 | ft_1_21 (challenges with characters, d129), the campaign phase screens (now in the scenes of ft_1_19), the admin settings page, four character songs, harder campaign defaults, EZ-220 sounds; per-piece XP built, try-out open |
| R4 | "Living characters" (d132): the phrase book, the knowledge layer, question and answer, the birth month (ft_1_22, ft_1_23); the old turn battle on hold |
| R5 | the cold start (the pictures' weight), the world (open since d112) |
| Later | the trainers' two-player split (ft_1_29), the rhythm clock, vim-style editing, earned trophies, seasonal looks (ft_Y_14, now with the motion kit's weather seam), EZ-220 command keys |
| Keri (maintainer-driven, R2) | ft_1_18 and ft_1_19: the room, the map (a caricature of Keri since d125), the knoll, the docks and the crossroads are painted on one painter's kit (d124) and one motion kit; the garden is paused (d252). Each new scene adds about 1.3 MB to the game file until the pictures load per hour |

## R1 "First lessons": the MVP at the laptop (done)

**Theme:** the student starts the game on a modest laptop with one command (a single start script), reads and plays pieces on the EZ-220, names notes, earns XP. No internet. Draft pieces stay hidden unless a parent turns them on behind the admin password.

**Gate in:** none.

**Done when:** all MVP acceptance criteria (ft_0_00 to ft_0_17) met, `npm run check:ci` and a full end-to-end run pass, and the MVP release criteria in `FEATURES.md` hold.

**Save bump:** none.

**The maintainer by hand:**
1. Hardware spike on the real EZ-220 with `docs/hardware-test-checklist.md`, including section 11 (drums and voices); results in `docs/hardware-notes.md`. Unblocks key lights, EZ-220 sounds and Tempo latency calibration.
2. Test ft_0_14 on a modest laptop (Chrome or Edge, MIDI permission, one piece).
3. Approve a first set of pieces in `npm run piece:preview`.
4. **The first playtest**, notes in the gitignored `private/playtests/` ([PLAYTESTS.md](../playtests/PLAYTESTS.md)); only a plain rule or a tag comes into the repo.

## R2 "Practice toolkit"

**Theme:** the student sees where the hard spots are, practises rhythm on its own, sees progress over time, and helper marks fade as reading improves.

| Content | What | Size |
|---|---|---|
| ft_1_14 MVP slice | The sky and the room's window follow the real day (first on the trail, removed by d117; now the painted room, map and scenes): dawn, day, dusk, night as palette swaps, computed offline (d097); pulled forward from R3; polish slice stays R3 | medium |
| core_10 | Practice analysis: per-bar store keyed by musical address, Analyze button with a bar gradient, per-bar graph, 3 weakest sections with a start tempo and ramp; tricky spots with Kiur's "!!!" | large |
| – | Rhythm practice as its own levels: any key per hand zone, one-line rhythm staff, drum sound | large |
| core_01 slice d | Tempo latency calibration: a short tap-along at the start of each Tempo session, not one stored value per device (spike: median 77 to 129 ms between runs, steady inside a run; `docs/hardware-notes.md`) | simple |
| core_01 slice f | Tempo mode grades how long each note is held (d093): f1 core and f2 screen together, f3 stats; no save bump | medium |
| – | Opacity steps for finger numbers, bar numbers and played notes | simple |
| ft_1_02d | Finger numbers `!1!` to `!5!` below the note, on by default | medium |
| ft_1_02b | Dev-server save of own pieces | simple |
| ft_1_02d | Editor setting: the wheel on a note changes pitch (default) or length | simple |
| ft_1_02d | Editor keyboard navigation | medium |
| ft_1_02d | Editor: name a bar selection as a phrase | simple |
| core_06 | Piece parts (pulled forward from R3). Slice A: part cards that open section practice, parts nest but never cross, no stars, no save. Slice B after practice analysis: part stars derived from its records | medium |
| ft_1_08 | Organic menus: vine corners, clickable room, icon buttons with tooltips (ft_1_08; variant B) | medium |
| ft_0_16 | Settings fit a 320-wide view, with a test (maybe already fixed by the redesign) | trivial |
| ft_Y_06 | Key-light hints (setting and wiring). The spike showed a lit key also sounds its note, which gives the answer by ear (AX-0); first a person checks that channel 1 at volume 0 (CC 7) still lights the key. If it does not, hints light without the game sending notes only where the keyboard allows it, or ft_Y_06 is rethought | simple |
| core_09 | **First of the notation work.** Ties drawn on the staff, accidentals carried through them, allowed at every level, placed in the editor; a beginner piece needs them (d101); own-piece file bump only | medium |
| core_09 | Repeat signs `|: :|` drawn as written and the cursor jumps back; the chart keeps written bars plus a repeat list, unrolled for playing (d102); chart v3, own-piece file bump shared with ties; after ties | medium |
| core_09 | Dynamic marks *pp* to *ff* shown below the note (VAIKSELT/VALJULT beside them with hints on), set in the editor; not judged (d101) | simple |
| core_09 | Notation of real classics, one slice at a time: pick-up bars, repeats, drawn ties, dotted and sixteenth notes, triplets, two voices in one hand. Beginner pieces are often real classics; chart format only, no profile bump | large |
| ft_1_09 | Player room: the level as a pixel rank diploma above the piano (Kenney Ranks redrawn as pixel art), preview first; no save bump | simple |
| ft_1_12 | Redesign: the piano is the training room. One piece list (no Mängi tab and no Free play), looping play with the pass score past the last bar, one score screen with the development graph, optional stats pane | large |
| ft_1_10 | Pitch trainer by ear (ear symbol, no staff while listening): one note or two, length and repeat settings, ear level of 5 + N stars (brainstorm). Slice A (no save) may start once R1's open items are done, before the first playtest; slice B joins v16 | medium |

**Gate in:** R1 done and the first playtest written. Met: R1 is done, because the game is already played and watched for bugs; playtest notes follow as they come.

**Save bump:** v16 went to the practice log and v17 to the ear trainer, so the round split; the next one (v18) is shared by rhythm practice, the opacity steps, ft_Y_06 settings if needed, the editor's wheel setting and the text settings (capitals or normal text, Estonian or English, per player). The first pull request to land owns it (d069).

**Design rule:** the hand-zone setting is a **list of zones**, so a USB drum kit later needs no save change.

**The maintainer by hand:** try Tempo mode and rhythm in a playtest; confirm the rhythm levels' order; confirm the heatmap colours for a student.

## R3 "Character campaign"

**The characters and the teacher run as one programme** ([program-characters-teacher.md](program-characters-teacher.md)): stages 1 (foundations) and 2 (the gameplay MVP) make R3; stage 3 is R4 "Living characters". Held until the maintainer approves it.

**Theme:** characters met in the scenes of Keri, one after another: find the key (cracks), find the door (tempo), then the character's challenge, trading the phrases of the piece (ft_1_21; no battles since d129). The parent tunes the numbers while watching.

| Content | What | Size |
|---|---|---|
| ft_1_06 K4, K6, K7 | Campaign map and the three phase screens, on `PlaySession` and overlays (d070). The map as one trail is removed (d117); monsters are met in scenes on Keri (ft_1_19); the phase screens stay | large |
| ft_1_21, ft_1_22 slice A (d129, d132) | The tug of reputation with two or three visitors and a voice with no body (the knoll's bonfire), met by practising, a conversation first, an item for a win, a practice tug with Kiur; challenges with characters: the pure core (slice A), the challenge drawn over its scene as phase 3 (B), the rename of monster and battle and the removal of the battle screens (C), the painter's look (D, after the maintainer says what the characters are) | large |
| – | Admin settings page behind a parent gate; overrides content defaults | medium |
| – | Four original monster songs of 8, 16, 24 and 32 bars and their ladder levels; a person approves them | simple + human |
| – | Harder campaign defaults: cracks 4/3/2, key windows 2.5/1.75/1.25, door 60/80/95 | trivial |
| if the spike says yes | `SoundOutput` interface; gameplay sounds and drums from the EZ-220 | medium |
| ft_1_13 | Per-piece XP and level from practice; player XP only from the door; door opens the book, then the monster; pieces no longer locked by level, levels gate monsters (AX-0.3); derived from history, no save bump | medium |
| ft_Y_04 | MusicXML import in the browser, any length, parts proposed; long-piece budget on a modest laptop; after core_09 | large |

**Gate in:** `openOverlay` from d070 built with its first user.

**Save bump:** campaign state is already in v14. The admin settings are stored per device, outside the student's profile, with its own `schemaVersion`. Anything else in the profile is v16, one bump.

**Done when:** ft_1_06 AC1 to AC7 and ft_1_21 AC1 to AC10 pass; the campaign plays end to end in the scenes of ft_1_19 (the trail is removed, d117) with the virtual player (`npm run demo` gets a campaign scenario); AC8 (the student understands key and door) is a playtest.

**The maintainer by hand:** confirm the campaign defaults; say what the characters are on Keri (ft_1_21); approve the four character songs; playtest, tuning on the admin page.

## R4 "Living characters"

**Since d132:** characters teach phrases of their style into a phrase book (the classes come back as styles), the knowledge layer per player, question and answer as the advanced challenge, the birth month (ft_1_22 slices B and C, ft_1_23); one shared save round. The turn battle table below is the old plan.

The turn battle with classes and spells that R4 used to be is deleted ([d151](../decisions/workflow.md#d151)); the classes come back as music styles (d132).

## R5 "The world": overworld RPG

**Theme:** the campaign map becomes a small world: walk with the arrow keys, meet characters, enter battles; classes mapped to music styles.

**Open since d112:** the campaign's world is a set of painted scenes on Keri (ft_1_19), opened from the map. A tile overworld walked with the arrow keys (Grid Engine, Tiled) no longer fits that world; nothing below is decided again until the maintainer says how the world grows from scenes.

| Content | What |
|---|---|
| ft_Y_03 | Overworld, inventory, classes from the closed style list (d066) |
| Phaser review R3 to R8 | A world base scene (PixelScene's full redraw does not suit scrolling), Tiled maps as content, events as data with a pure core interpreter, a loading scene, world save |
| Candidate dependency | **Grid Engine** (Apache-2.0) for grid movement; **Tiled** as the map editor (a tool, GPL, not shipped; its JSON output is fine). Needs a decision file and `docs/dependencies.md` |

**Gate in:** R4's battle; the cold start measured on a modest laptop (Phaser is 357 kB gzipped); tiles in outline style A.

**Save bump:** one, for the world state (position, events done, inventory).

**The maintainer by hand:** world design (how big, who lives there); piano keys as movement (d070: arrow keys now).

## Later pool

| Item | Gate | Note |
|---|---|---|
| two-player split, lit keys for the trainers (ft_1_29) | ft_1_29 slices A to D; ft_Y_06's real output | Scales, chords, switcher and chord namer moved to R2 |
| rhythm clock, USB drum kit | rhythm practice done; a drum kit tested (needs human) | Zones as a list (R2) make the kit cheap |
| vim-style editing (opt-in) | bar selection and keyboard navigation done; a spec with the maintainer | Pure moves in `core/editor` make it a thin key layer |
| ft_Y_14 seasonal and holiday looks for the campaign scene | ft_1_14 built | Layers on the day phase through `sceneLook` (d097); weigh a seasonal public-domain piece first (AX-0) |
| EZ-220 command keys (hold an edge key, [key] labels on buttons, mode indicator), record in tempo | recording by playing done; a spec with the maintainer | vim-style editing builds on its latched mode |
| earned trophies, medals, paintings in the room; piano upgrades with rank | the rank diploma done; an architect design pass (earned only, AX-2) | Awards as content, derived from progress so no save bump if possible |
| core_09 rest (ties, pick-up bars, repeats) | none | Repeats also let campaign songs be AABA |
| Android tablets | the maintainer decides | Reopens hosting: Web MIDI needs a secure context, a tablet on the LAN is not `localhost` (HTTPS, PWA) |
| ft_Y_07 content packs | none | Drops cloud sync (d068); file-based packs and save export/import only; the feature file changes when it is planned |
| ft_Y_05 falling notes | rejected | AX-0.1: never built |
| Battle extras after R4 | R4 played | Tempo casts with timing crits, gapless loops (`repeatChart`, click following the tempo map), `jazz` and `metal` styles, ability levels (core_06), per-bar difficulty (core_08), difficulty modifiers (core_07), the confuser (ft_Y_08, needs key lights), ft_Y_10's riff library, own pieces as spells (need named phrases) |

## What gates what

| Gate | Unblocks | Who |
|---|---|---|
| EZ-220 spike results (ft_0_01) | core_01 d (sections 1 to 6 done), ft_Y_06 lighting (needs the silent-light test), EZ-220 sounds, ft_Y_08, the trainers' lit-key games | the maintainer |
| Playtest after each release | the next release's priorities | the maintainer |
| d070 `openOverlay` first use | campaign (R3), overworld (R5) | agent |
| One save bump per release (d069) | parallel save work in each release | architect watches |
