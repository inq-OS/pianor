---
title: "Decisions: Notation and pieces"
---
# Decisions: Notation and pieces

Chart model, ABC, the staff, notation features, pieces and their tools. One entry per decision, oldest first. Index: [DECISIONS.md](DECISIONS.md).

## d002

**Staff notation is core: the student reads every note from the staff.** Features: ft_0_05.

The goal is learning to read music. The own-built staff renderer is the most important MVP piece.


Check: untestable: product rule judged against AX-0 by the maintainer; no test can tell reading from not reading

## d009

**Chart format v1 is 0-based, with explicit rests and cross-field schema checks.** Features: ft_0_02.

Bars, notes and phrases are 0-based in the chart (meta phrases stay 1-based inclusive); rests are an explicit `rests` array (default empty); `octave` is -1..9. The schema checks midi against spelling, bar against tick, contiguous bars and meter changes on bar lines. Migration is `migrations[n]` upgrading n to n+1; fast-check is used for property tests.


Check: `src/core/chart/schema.test.ts` "defaults rests to an empty list"; `src/core/chart/schema.test.ts` "validates rests like notes"; `src/core/chart/migrate.test.ts` "a version-1 chart migrates to the C major key, and parses"

## d010

**The staff layout is a pure function in `src/core/layout/staff.ts` and `StaffView` only draws it.** Features: ft_0_05.

The staff space is auto-sized between 8 and 32 CSS px (`staffSpaceLimits`), bars spread evenly over systems. The canvas is drawn in physical pixels (`src/core/layout/canvasSize.ts`); the target screen is a modest laptop at 1920x1080 and 125% scaling, and tests check fit at 1920x1080, 1920x960, 1536x864, 1280x720, 1366x768 and 1024x600 with at least 16 px staff space on laptop-size screens. Clefs, rests and time digits are original curves and 3x5 bitmaps (`glyphs.ts`); the cursor is a highlight box (between paper and lines) plus an arrow, so colour is not the only cue; `?demo=staff` shows samples from `content/dev/charts/`.


Check: `src/core/layout/staff.test.ts` "fits and never overlaps at the supported viewports (property over sizes)"; `src/core/layout/staff.test.ts` "draws five staff lines per system, evenly spaced by the staff space"; `src/core/layout/canvasSize.test.ts` "draws the canvas in physical pixels: 1536x864 CSS pixels at 125% is the 1920x1080 screen"

## d018

**The ABC parser is our own, strict and dependency-free (`src/core/piece/abc.ts`).** Features: ft_0_03.

abcjs gave no warnings for unsupported syntax and no line and column, so every unsupported construct is one error with file, line and column and one mistake does not cascade. The pipeline is `parseAbc`, `compilePiece`, `buildPieces` (to `build/charts/<id>.chart.json`); `RH` and `LH` voices in meta `hands` become play tracks, `ACC` is accompaniment; pickup bars are refused because the bar grid starts at tick 0. Coverage gates `tools/` as well as `src/core/`.


Check: `tools/piece/compile.test.ts` "reports ABC problems with the file, line and column, and returns no chart"; `tools/piece/compile.test.ts` "a piece without V: lines is the one hand the meta names"

## d020

**Pieces in `content/pieces/<id>/` reach the game through `virtual:pieces`, compiled and linted by `tools/vite-pieces.ts`.** Features: ft_0_11, ft_0_04.

A piece with any error is left out and a production build fails on it; `game/content.ts` offers approved pieces always and drafts (plus dev samples) only on the dev server. `layoutStaff` refuses charts with more than the supported play tracks. Twinkle Twinkle needs A4 and a fifth, so it fits only level 5 under the starter table; `unlockLevel: 1` in its meta overrides.


Check: `tools/vite-pieces.test.ts` "a production build leaves out the drafts and lists their ids"; `tools/piece/check.test.ts` "checks the folder name against the id only for a saved piece"

## d022

**`layoutStaff` draws a grand staff for two played tracks, with one time axis and the cursor on the outer side.** Features: ft_0_15.

Treble above bass joined by a brace and shared bar lines, refusing more than two played tracks (`UnsupportedNotationError`); naming a `trackId` draws one hand. Notes sounding together share one x exactly, and a bar-filling note is centred only when nothing on either staff is shorter than the bar. The cursor arrow sits above treble and below bass, never between; each awaited note gets its own box, and a wrong key flashes all of them. The virtual player has `hands: 'together' | 'apart'`, apart meaning a 500 ms gap. A piece folder name must equal its meta `id` (linter-enforced).


Check: `src/core/layout/grandStaff.test.ts` "joins the staves with one brace per system and runs bar lines through both staves"; `src/core/layout/grandStaff.test.ts` "more than two played tracks"; `src/core/layout/grandStaff.test.ts` "aligns notes that sound together on one time axis, one above the other"; `src/io/mock/performance.test.ts` "apart presses one hand, then the other after a gap longer than the together window"

## d023

**Importers will emit ABC plus a draft meta file, not chart JSON.** Features: ft_Y_04.

The same compiler, linter, preview and approval gate then apply and a person can correct the result in plain text. `abc.ts`, `compile.ts`, `lintRules.ts`, `difficulty.ts` and `diagnostics.ts` may not import Node modules (lint rule). Only pieces you wrote or public-domain files may be imported.


Check: `eslint.config.js` "src/core is pure: no Node APIs. File access belongs in tools/ (the piece CLIs) or src/io."

## d025

**The piece preview tool runs at `/?demo=preview` and only a human approves pieces.** Features: ft_0_11.

`npm run piece:preview` reuses `checkPiece`, `layoutStaff`, `StaffView` and the real `PracticeScene` (no XP, no save). Approval is a button calling dev-server middleware (`GET /__pianor/pieces`, `POST /__pianor/status`), which rewrites only the `status` value of `piece.meta.json` after re-checking; a production build has no endpoints. `checkPiece` (text) and `checkPieceFolder` (files) are the one path for compile, id and level check, lint. The menu shows six pieces per page with Previous and Next when more than seven exist (`pageOf`).


Check: `tools/piece/previewApi.test.ts` "approves a clean draft and changes nothing else in the file"; `tools/piece/previewApi.test.ts` "refuses to approve a piece with lint errors, and leaves the file alone"; `tests/e2e/preview.spec.ts` "lists every piece on disk with its status, level, difficulty and problem counts, plus a scratch piece"

## d027

**Generators in `tools/generate/` write ABC plus meta and only output what the real linter accepts.** Features: ft_0_12.

Five generators (five-finger, scale, reading-drill, echo, phrase) run through `checkPiece`; output is a pure function of the request and seed (`src/core/random.ts`), with no melody in the source. A candidate is rejected when eight notes in a row (scale steps plus lengths) also appear in a human-written piece, and a content test regenerates committed generated pieces to catch drift. Generated titles carry the level (`Note Hunt 3.1`). The agent loop is `docs/authoring/au07-agent-composing.md`: compose, lint until clean, build, never approve.


Check: `tools/generate/generate.test.ts` "makes pieces that pass piece:lint with no error and no warning, for many seeds (property)"; `tools/generate/generate.test.ts` "byte for byte, for every kind, and a different seed gives a different piece"; `tools/generate/similarity.test.ts` "finds a run of eight notes that also appears in a known melody"

## d050

**An own piece is one versioned `<id>.pianor-piece.json` file, and licence `NaN` is allowed only for private pieces.** Features: ft_1_02b.

The file is JSON with `kind: "pianor-piece"`, `schemaVersion`, own id, author, the editor's piece and the ABC and meta text it makes (`src/core/editor/pieceFile.ts`; file I/O in `src/io/files/textFiles.ts`); a higher version is refused, a lower one migrated, and the fixture rewrite must stay byte-identical. Import refuses non-pieces, damaged content, any licence but `NaN`, non-own ids (`own-...`) and bundled ids, and always saves as a new own piece. `piece:lint` warns on `NaN` anywhere except a `private/pieces` folder. File version 2 adds key and note alters (d073).


Check: `src/core/editor/pieceFile.test.ts` "writes a readable file that says what it is and which version it is"; `tools/piece/license.test.ts` "ft_1_02b.AC3 warns about NaN in content/pieces and says why"; `tools/piece/license.test.ts` "ft_1_02b.AC3 accepts NaN without a warning under private/pieces"

## d066

**Piece styles are a closed list in `content/pieces/styles.json` and a `styles` field in the meta file.** Features: core_05.

`styles.json` (`schemaVersion: 1`, provisional) lists `{ id, nameKey }` with names in `src/core/text/strings.ts`, loaded by pure code in `src/core/properties/styles.ts`; starters `folk`, `classical`, `exercise`, `original`. `piece.meta.json` gets `styles: string[]` (default empty, meta `schemaVersion` stays 1); `piece:lint` rule `style` errors on an unknown style and warns on a committed piece with none (own pieces get none); the style is not a tag.


Check: `tools/piece/lint.test.ts` "a style the list does not have is an error that names the list"; `tools/piece/lint.test.ts` "a committed piece with no style"; `src/core/properties/styles.test.ts` "reads the style list of the content, and every style has a name in the strings"

## d067

**The chart key is a structured signature `{ tick, fifths, mode }`; chart schema version 2.** Features: core_09.

`keyMap[]` holds `fifths` (-7 to 7) and `mode` (`"major"` or `"minor"`), the MusicXML model, with the sharps and flats order in `src/core/chart/key.ts` (`keyAlters`). `CHART_SCHEMA_VERSION` is 2; `v1ToV2` maps `"C"` to `{ fifths: 0, mode: "major" }`, refuses other strings and writes fixed values.


Check: `src/core/chart/key.test.ts` "every fifths value from -7 to 7 alters exactly |fifths| letters, all one way"; `src/core/chart/migrate.test.ts` "a version-1 chart migrates to the C major key, and parses"; `src/core/chart/migrate.test.ts` "refuses a version-1 chart whose key is not C, since only C existed"

## d073

**Editor pieces carry a key and a per-note alter, stored as own-piece record 2 and piece file 2.** Features: core_09.

`EditorPiece` has `fifths` (-7 to 7) and `mode` (`major`/`minor`); every `EditorNote` has `alter` (-1, 0, 1), defaulting to the key's alter of its letter. `toAbc` writes `K:` and an accidental (`^`, `_`, `=`) only where a note differs from key and earlier accidentals of its bar; `toChart` uses the same spelling (property-tested equal). A press on the clef or key signature opens the circle of fifths, whose tick sets the key (`hitTest.ts`, ft_1_28.AC7). `OWN_PIECE_FORMAT` and `PIECE_FILE_VERSION` are 2; version 1 is migrated by `migrateEditorPieceV1` (`src/core/editor/migrate.ts`: `fifths: 0`, `mode: 'major'`, `alter: 0`), fixtures `piece-file.v1.json` (read only) and `piece-file.v2.json`.


Check: `tests/editor/keySignature.test.ts` "writes K: with the key, and a sharp, flat or natural only where a note differs from the key"; `tests/editor/ownPieceFormat.test.ts` "a version 1 record opens unchanged: the same notes in key C, the same ABC and meta, and it plays"; `src/core/editor/pieceFile.test.ts` "reads the committed version 1 file (synthetic fixture) as version 2: key C, every note natural (core_09.AC8)"; `src/core/editor/hitTest.test.ts` "a click on a sign of the key signature is a key hit on its staff (it opens the key choice)"

## d078

**The editor writes notes in order on shadow notes, with bars as wide as their notes and a staff that never resizes.** Features: ft_1_02a, ft_1_02d.

A new note or rest has the selected length (default quarter), shortened only to fit before the next note of its hand or the bar line (`autoLength`). A shadow note at the key's tonic marks every place a note can go (`slotsFor`: start of an empty bar, after the last note or rest, start of each gap); the Notes/Rests switch (key 0) writes rests, kept in an optional `rests` list beside `notes` (no version bump). Bars are as wide as their content (`StaffLayoutOptions.spacing`, `editorSpacing`; empty bar one note wide, lines not stretched); staff size and lines per page come from screen, hands, meter and key only (`editorFrame`: largest size where a bar of eighths fits a line and two lines fit, or one larger line when two would be under 12 px between lines), keeping room for ledger lines one out and for chords up to an octave; overflow goes to pages (`<`, `>`, Page Up, Page Down). Practice, Try it and Battle keep equal-width bars. Free placement and inserting between touching notes are not built (the latter belongs with the dev-server save of own pieces).


Check: `src/core/editor/staff.test.ts` "a shadow note at every place a note can go, at the tonic of the key, in its column (ft_1_02a.AC10)"; `src/core/editor/staff.test.ts` "no note or rest moves the clef, the lines or the time signature, or changes the staff size (ft_1_02a.AC11)"; `src/core/editor/staff.test.ts` "bars that no longer fit a line go to the next line, and a page shows as many lines as the frame has (ft_1_02a.AC11)"

## d101

**Ties are drawn and allowed at every level; dynamic marks are shown, not judged.** Features: core_09, core_01.

Ties are drawn (curve away from the stem, split at a line break, one per chord head, first note's accidental carried into the next bar) and `ties: true` at every level in `levels.json`, so a beginner piece with ties can play. The editor places ties and dynamics; own-piece files bump `schemaVersion` once (d050), no profile bump. Dynamics are the closed set `pp p mp mf f ff`, each "from this note on", from ABC `!p!` decorations, stored in the note's `dynamic` field; drawn below the note (between the staves on the grand staff), with the Estonian word beside it when note-name hints are on, and never judged (EZ-220 velocity unmeasured).


Check: `src/core/layout/staff.test.ts` "draws one curve from the head to the tied-to head, across the bar line"; `src/core/layout/staff.test.ts` "splits a tie across a line break into two half curves"; `src/core/layout/staff.test.ts` "draws a dynamic mark under the hint labels of the note it starts at, and no other note"

## d102

**Repeats stay written once in the chart and are unrolled for playing, so the student reads the repeat sign.** Features: core_09, core_03, core_10.

The chart keeps written bars once with `repeats: [{ startBar, endBar }]` (each range played twice); chart `schemaVersion` 2 to 3, version-2 charts migrate with `repeats: []`. A pure `unrollRepeats(chart)` makes the flat play chart (each note keeps its written note index) for the judge, modes, audio and scoring; the staff lays out the written chart and the cursor jumps back at the end repeat. Sections (core_03) cut from the written chart; per-bar records (core_10) key on the written bar and count both passes. First/second endings, nested repeats, `D.C.`/`D.S.` and a tie across a repeat sign are refused. Why: expanding at compile time would let the student never read `|: :|`.


Check: `src/core/chart/repeats.test.ts` "the compiled chart keeps the written bars once, with the repeat"; `src/core/chart/repeats.test.ts` "plays the repeated bars twice, each note knowing its written note"; `src/core/chart/repeats.test.ts` "a section that holds a whole repeat keeps it"

## d106

**Multi-choice tools of the piece maker open a drop-down menu; a new piece opens on its staff, with no start screen.** Features: ft_1_02a, ft_1_02d.

A new piece opens on its staff in 4/4 and C; a press on the time signature opens the time panel (time, pick-up, tempo) and a press on the clef the circle of fifths, which sets the key (ft_1_02a.AC14, ft_1_28.AC7). A setting with more choices than a toggle opens a drop-down (`PixelScene.openMenu`, `src/core/layout/dropMenu.ts`): equal cells under the button, current choice lit, closed by a pick, outside press or Esc; paste (x1, x2, x4) and ties (tie, pick, all) use it.


Check: `src/core/layout/dropMenu.test.ts` "fills rows left to right and wraps after"; `src/core/layout/dropMenu.test.ts` "moves left to stay on the screen, and opens above its button when there is no room below"

## d119

**Every staff lies on a sheet of parchment painted in the game for the staff's size.** Features: ft_0_05, ft_1_02a.

`StaffView` gives every staff a pale skin with a torn darkened edge and a turned-up lower right corner on dark desk wood, with the ink staying `STAFF_INK`. The sheet gives way to the notes (AX-0): `src/core/layout/sheet.ts` shows desk only on a side where a torn edge stays clear of the standing ink, and where notes are written the skin never drops below the floor that keeps ink above 7 to 1 (`WRITING_FLOOR`, tested). The piece maker's staff is inset 12 fine pixels each side (`SHEET.staffInset`). It is painted in the game, under 0.1 s, by `paintParchment` (`src/game/ui/pixel/paint/parchment.ts`, cached by `sheetGround.ts` per size), the one painted picture outside `tools/vite-keri.ts`, held to the colour rules by `tools/art/parchmentRules.test.ts`; its colours are its own two runs (skin, desk), and `DEFAULT_THEME.paper` is `PARCHMENT_PAPER`.


Check: `src/game/ui/pixel/paint/parchment.test.ts` "keeps the skin pale where notes are written"; `src/game/ui/pixel/paint/parchment.test.ts` "paints every pixel of its area, from its two runs only, the same on every call"; `src/core/layout/sheet.test.ts` "narrows a strip so the torn edge stays clear of the ink"; `tools/art/parchmentRules.test.ts` "names its runs, and they are sound"

## d120

**Pick-up bars are a short first bar and slurs are drawn and graded as legato.** Features: core_09, core_01, core_02, core_10.

Pick-up: a short first bar is accepted, same length in every voice, and then the last bar must hold exactly the rest of that bar; without a pick-up every bar is whole; no new field and no `schemaVersion` bump; the full bar length comes from the meter map (`fullBarTicks`) and `pickupTicks(chart)` gives the shortfall, never `bars[0]`; no rests fill it; printed bar numbers make the pick-up bar 0 (meta `phrases[].bars` use them), the chart stays 0-based; Tempo mode and the metronome count in the full bars plus the missing beats. Slurs: optional `slurs: [{ track, voice, startTick, endTick }]` (no bump), compiled from ABC `( )`, over two or more different pitches, none overlapping in a voice, copied by `unrollRepeats`; nested, dotted and across-repeat slurs are refused. The staff draws the curve (two halves across a line break); in Tempo mode a slurred note except the last must be held to the next onset (release up to 30 ms early counts, overlap never lowers the score, d093 hold factor does the rest), in Wait mode the cursor only shows whether the previous key is still held, never a miss or XP loss; computer playback sustains slurred notes. The hint label is LEGAATO.


Check: `src/core/piece/abc.test.ts` "core_09.AC21 a short first bar is a pick-up: the next bar starts where it ends, and the last bar holds the rest of that bar"; `src/core/piece/abc.test.ts` "core_09.AC21 any other short bar is refused, with its position"; `src/core/chart/playback.test.ts` "holds each slurred note until the next note of its slur, and the last one as written"; `src/core/chart/repeats.test.ts` "copies a slur inside a repeated stretch into each pass, shifted like its notes"

## d121

**Grace notes (pre-notes) are drawn, heard and played, but never scored or required.** Features: core_09, ft_1_02, core_01, core_02.

Chart gains optional `graces: [{ track, voice, tick, pitch, slash }]` (no `schemaVersion` bump); a grace is not a chart note (no length, invisible to bars, judge, scoring, linter), at most one per main note of its own track and voice, pitch different from the main note, copied by `unrollRepeats`. ABC `{g}C` and `{/g}C` compile to it; several notes, a grace before a rest, chord, tie continuation or inside a slur's close are refused. The staff draws it at about 60 % size left of the main note with a flag and slash when slashed, and its letter in small type with hints on. In Wait and Tempo mode a press of the grace pitch just before its main note (Tempo: up to 250 ms) is ignored by the judge: never required, never wrong. Playback sounds it 60 ms before the onset at the main note's loudness; if the piece's first note has a grace it takes the last count-in beat's slot (3 + 1 count). The editor note carries one optional `grace: { step, octave, alter, slash }` through a band button (like ties), written as `{/g}`; own-piece files add an optional `grace` per note.


Check: `src/core/judge/tempo.test.ts` "core_09.AC33 ignores a press of the grace pitch just before its main note: no wrong note, no score, no mistake"; `src/core/judge/tempo.test.ts` "core_09.AC33 the same press without the grace in the chart is a wrong note (the baseline)"; `src/core/editor/pieceFile.test.ts` "core_09.AC36 a pre-note survives export and import as an optional grace field, with no file version bump (d121)"; `src/game/practice/countInGrace.test.ts` "core_09.AC34 nothing is queued before the lookahead, then it is queued exactly once"

## d155

**VexFlow re-evaluated for beams and sixteenths: we keep our own staff renderer and take VexFlow's beam rules as a reference only.** Features: core_09, ft_Y_04. Changes d024.

VexFlow 5 (MIT) lays out and draws in one step through its own render context and SMuFL font glyphs, so using it would give up the pure `layoutStaff` (core tests, the editor's hit tests, the duration help, cursor and per-note colours read its positions) and the pixel-art ink, for one feature (beams) that is a small pure function (`src/core/layout/beams.ts`). Its beam rules (notes grouped per beat in simple meters, one stem direction for a run from the mean of its heads, partial beams pointing to their beat neighbour) are studied and written in our own code; no VexFlow code or dependency comes in. Re-evaluate only if the renderer has to grow two voices in one hand or cross-staff beams.


Check: `src/core/layout/beams.test.ts` "core_09.AC40 beams the eighths of each beat: four eighths in a row are two pairs"; `src/core/layout/beams.test.ts` "core_09.AC40 never beams across a rest, a bar line or a beat"

## d163

**Triplets are written `(3`, kept in the chart as `tuplets` with each note's played length, and drawn at their written value.** Features: core_09.

The chart gains optional `tuplets: [{ track, voice, startTick, endTick, actual, normal }]` (no `schemaVersion` bump, the `slurs` precedent): a note's `dur` stays its played length (an eighth triplet 160 ticks), so the judge, the clock, playback and the difficulty estimator need no change, and the staff and linter take the written length from `writtenDurOf` (played times `actual / normal`). Only 3:2 triplets of eighths or quarters that start on a beat and stay in one bar are compiled (AX-3 provisional: the beat groups a beginner counts); the staff beams an eighth triplet as its own run with a small 3 on the beam and brackets the rest, the number on the stem side when all stems point down, above otherwise. Level 5 turns the `tuplets` switch on.


Check: `src/core/chart/tuplets.test.ts` "core_09.AC49 the compiler writes each triplet in the chart, the notes at 160 ticks, no schema version change"; `src/core/chart/tuplets.test.ts` "core_09.AC50 the written length of a triplet note is its played length times 3/2"; `src/core/layout/triplets.test.ts` "core_09.AC50 an eighth triplet in one beat is one beamed run, with no flags"

## d164

**Two voices in one hand: ABC `&` overlay to voice 2, stems by voice, one step per tick.** Features: core_09, core_01, core_02. Changes d155.

ABC `&` inside a bar writes the music after it, up to the bar line, to voice 2 of the same track, filling exactly as much as voice 1 (its own rests with `z`); a third voice, `(&`, `&)`, a voice-2 note past the bar line and (AX-3 provisional) a pitch one voice strikes while the other starts or still holds it are refused with their position, and the chart already allows voices 1 to 4, so there is no format change. In a bar of two voices the staff draws voice 1 stems up and voice 2 stems down whatever the pitch, raises voice 1's rests and lowers voice 2's, puts the lower head right when the two start a second apart, beams each voice on its own, puts ties and slurs on the stem side, and prints accidentals from the whole staff (a sign holds on its line for both voices to the bar line). The judge makes one step of every note starting on a tick, so Wait mode awaits both voices like a chord, a key still held from voice 1 is neither wrong nor a release, and Tempo mode grades each hold on its own; the level table gets an optional `voices` limit (absent means 1), 2 at level 5. d155 is re-evaluated: two voices are a stem rule and an offset on the own renderer, so VexFlow stays out.

Check: `src/core/piece/abc.voices.test.ts` "core_09.AC52 the music after & is voice 2 of the same bar, from its bar line"; `src/core/layout/staff.voices.test.ts` "core_09.AC53 heads of the two voices a second apart stand side by side, the lower one on the right, so the stems meet in one line"; `src/core/judge/voices.test.ts` "core_09.AC54 every note of both voices that starts on a tick is one step, like a chord"

## d195

**The piece maker's entry: few items that each cycle, a guessed next length, an Auto time and quick keys.** Features: ft_1_02a, ft_1_02d.

Ctrl+Up and Ctrl+Down jump the cursor through A2, G3, F4 and E5, never onto ledger lines; sharp, flat and natural are one cycling item (A); tie and slur one item (a tie when the same key follows, else a slur; T); repeat one item asking the start bar, then the end bar (K). The next length is guessed (an eighth after an eighth, a quarter after two eighths; complete the beat, fit the bar). The start screen's time has Auto, set by the first bar. Enter lengthens a note one step, Alt+Enter to the longest that fits. Saving a new piece called "My piece" or nothing asks for a name. Do not split these items again.


Check: `src/core/editor/keyCursor.test.ts` "ft_1_02d.AC15 Ctrl + up or down jumps A2, G3, F4, E5 and round, never onto a ledger line, keeping the time"; `src/core/editor/nextLength.test.ts` "ft_1_02d.AC20 after one eighth another, after two eighths the quarter again"; `tests/e2e/editor.spec.ts` "ft_1_02a.AC13 Save on a new piece with no name of its own opens the title to type"

## d196

**The note-length helper is a ghost head on each held beat (A) and a thin band to the end of the sound (B), switched per hand.** Features: ft_1_11.

Two cycling buttons in Settings, one per hand, each Off, A, B or A+B; the left hand's in the left column. Tied notes get one unbroken band through the bar line. Kept as an optional `settings.durationHelp`, no save bump.


Check: `src/core/layout/durationHelp.test.ts` "A draws only the ghost heads, B only the band, A+B both (ft_1_11.AC4)"; `src/core/layout/durationHelp.test.ts` "puts a ghost head on every beat the note is still held, never on its own beat or after it (ft_1_11.AC3)"

## d234

**Every committed piece is original or public domain, records its `source` and an open `license` in its meta, and copies no copyrighted music or third-party chart; anything else stays in the gitignored `private/` with licence `NaN`.** Features: ft_0_04, ft_Y_04, ft_1_02b.

The meta schema refuses a piece without source and licence, `piece:lint` refuses a licence that is not on the known list, and the importer writes into `content/pieces` only with an open licence, a source and a level the piece passes (CLAUDE.md product rules, `docs/authoring/AUTHORING.md`, d006, d050).

Check: `src/core/chart/schema.test.ts` "requires source and license, a valid id and a known status"; `tools/piece/lint.test.ts` "a licence that is not on the known list"; `tools/import/piece.test.ts` "ft_Y_04.AC12 into content/pieces only with an open licence, a source and a level it passes"

## d235

**MIDI note 60 is middle C (C4), and a chart stays inside the EZ-220's range, MIDI 36 to 96, and its level's range.** Features: none.

The level table (`content/curriculum/levels.json`) gives each level's range and `piece:lint` checks a piece against it (d019); the virtual EZ-220 speaks only 36 to 96 (d012).

Check: `src/core/chart/pitch.test.ts` "middle C is MIDI 60 and A4 is 69"

## d269

**First and second endings: ABC `|1` and `:|2` are read into the repeat's optional `endings`, played first ending on the first pass and second ending in its place on the second, and drawn as numbered brackets.** Features: core_09.

`|1`, `|[1` or `[1` opens a first ending that runs to the repeat's `:|`; `:|2`, `:|[2` or `[2` opens the second, which runs to the next `||`, `|]` or `|:`, or holds one bar. The chart's repeat gets `endings: { first, second }` (0-based bars, inclusive) with no `schemaVersion` bump, as `repeats` came in; an ending without a repeat, a third ending, a second not right after the first, a lone ending and one starting inside a bar are refused with their position. A section keeps a repeat only when it holds both endings.

Check: `src/core/piece/abc.test.ts` "core_09.AC45 reads |1 and :|2 as the endings of the repeat, in every spelling"; `src/core/chart/repeats.test.ts` "core_09.AC46 plays the first ending on the first pass, and the second ending in its place on the second"; `src/core/layout/endings.test.ts` "core_09.AC47 an ending across a line break is two pieces: the label and the left hook on the first, the right hook on the last"

## d292

**The piece maker has opt-in vim keys, off by default and kept per device, that drive the piece maker's own moves, edits and tools.** Features: ft_1_02e.

The parser is pure (`src/core/editor/vim.ts`) and its commands are carried out with the moves of `keyCursor.ts`, the edits of `keyEdits.ts` and `bars.ts`, and the tools by their `EDITOR_KEYS` name, so there is no second set of actions. A place in time is a character and a bar is a line; insert mode writes notes by letter, the nearest pitch of that letter. Ctrl + Shift + V or `:set novim` switches them; the setting is the optional `vimKeys` of the entry preferences, with no version bump.

Check: `src/core/editor/vim.test.ts` "ft_1_02e.AC5 i, a, o and O go into insert mode, where a to g write notes and Esc comes back"; `src/core/editor/entryPrefs.test.ts` "ft_1_02e.AC1 keeps the vim keys switch beside the short tap, off when absent or mistyped, with no version bump"
