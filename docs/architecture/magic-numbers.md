# Magic numbers

Review, prompted by the observation that a C/C++ static analyser (MISRA, Klocwork, `-Wmagic`) would flag a lot of
this code. This is the map and the proposals. Group 2 items 1 to 4 and the layout grouping (below) were then implemented in the
same pull request. A second pass carried the layout grouping to every pixel scene and did items 5 to 8 and the
stray hex colours; items 9 and 10 stay proposals.

## Verdict

**Mostly not a problem, with a short list of real ones.** The "magic number" rule of C is aimed at values that mean something
and are written as bare digits in more than one place (a register offset, a buffer size, a timeout). Counting every literal
overstates it. The numbers split into three groups, and only the first is worth work.

Raw count: ESLint's `@typescript-eslint/no-magic-numbers`, ignoring 0, 1, -1 and 2, array indexes, enums and type literals,
reports **1,234 literals in 108 files** under `src/` and `tools/` (tests excluded). Where they are:

| Area | Hits | Nature |
|---|---|---|
| `src/game` | 643 | Pixel-art layout coordinates and sizes, drawn in art pixels (see "Layout" below) |
| `src/core` | 189 | Mostly staff geometry in staff spaces and music arithmetic; a few real constants |
| `src/spike` | 119 | Throwaway hardware test page, standalone by design |
| `src/io` | 103 | MIDI bytes, velocity range, audio envelope numbers |
| `tools/generate`, `tools/piece` | 106 | Music theory tables and generator weights |
| `src/dev`, `tools/e2e`, `tools/docs` | 74 | Demo and test tooling |

The most frequent values (4, 8, 3, 12, 5, 6, 10) are beats per bar, scale degrees, semitones per octave and pixel offsets, not
configuration.

The project is already in good shape where it matters: 231 named `UPPER_CASE` constants exist, the tick resolution is
`PPQ = 480` (`src/core/chart/time.ts:3`) with only 3 stray `480` literals, judge windows (`DEFAULT_TEMPO_WINDOWS`,
`STAR_THRESHOLDS`, `BOTH_HANDS_MAX_BONUS`) are named and exported, and progression numbers live in a zod-validated config.

## Group 1: harmless, leave alone

- **0, 1, 2, -1, array indexes, loop bounds** and `+ 1` style arithmetic.
- **Numbers that are the thing itself.** `12 * (octave + 1)` in a pitch formula, `% 12`, `STEP_SEMITONES` tables
  (`src/core/chart/pitch.ts`). A `SEMITONES_PER_OCTAVE = 12` constant would not make the formula clearer, only longer. The one
  exception is the 12 that is *not* an octave (menu spacing and the like), which the rule cannot tell apart.
- **Percent maths:** `/ 100`, `* 100`, "score 0 to 100". Fine, and `100` is the documented scale.
- **Table data:** the palette (`src/game/ui/pixel/palette.ts`; Keri's outdoor scenes: `keri/keriPalette.ts`), music-theory tables, sprite bitmaps. Data written
  as data is the opposite of a magic number.
- **Layout in `src/game`.** The scenes draw on a small art-pixel canvas that is scaled by a whole-number zoom
  (`PixelScene`). Coordinates such as `PixelBar(this, 36, 41, 150, 9, ...)` are positions on a hand-composed screen, read
  together with the picture. Naming each one (`MENU_BAR_X = 36`) would add ~600 constants that mean "this pixel", move the
  numbers away from the code that explains them, and be edited together anyway. A C analogue is a bitmap font table or an
  LCD layout in a display driver: positions are data.
- **A painted picture's numbers** (`src/game/ui/pixel/paint/`, `keri/`: sizes in metres, a lamp's strength, a cloud's spec, a run of colours) are the picture itself, as a sprite's rows of letters are. They stay with their picture, named where one number is used twice.
- **Test data**, fixtures and `synthetic` inputs.
- **`src/spike`**: a standalone hardware test page (`docs/hardware-test-checklist.md`) that must not import game code, so it
  cannot share constants with `src/io`. It repeats the MIDI bytes on purpose. Exclude it from any rule.

## Group 2: should be named (real findings)

Status: items 1 to 8 are **done**. Items 1 to 4: `io/midi/bytes.ts`, `core/chart/midi.ts`, `MS_PER_MINUTE` and `msPerBeat` in
`core/chart/time.ts`, one shared `DEFAULT_TOGETHER_WINDOW_MS`. Item 5: the named velocity curve in `io/audio/mapping.ts`, and the
bpm limits in `core/transport/practiceSpeed.ts` (`METRONOME_BPM`, `CLICK_MIN`/`CLICK_MAX`, `TEMPO_PERCENT`); the
metronome's 30 to 1000 is wider than the click speed's and the editor's 30 to 500 on purpose (a fast piece at 150 percent
or on a ramp keeps its pulse). Since then all of them come from one `PIECE_BPM` in `core/chart/time.ts` (the metronome's top is
`PIECE_BPM.max` times `RAMP_MAX_PERCENT`), and `practiceSpeed.test.ts` checks that. Battle schema limits: named in the battle schema. Item 6: the `CLICK` sound table and named scheduler defaults in `io/audio/Metronome.ts`. Item 7:
`LAST_SLOT_MS`, `MIN_HOLD_MS`, `MISTAKE_HOLD_MAX_MS` in `io/mock/performance.ts`. Item 8: `REFERENCE_VIEWPORT` in
`game/pieceList.ts` (no twin found). Items 9 and 10 are open.

In a second maintenance pass the ms-per-second factor is `MS_PER_SECOND` in `core/chart/time.ts`, beside
`MS_PER_MINUTE`, and replaces the `* 1000` and `/ 1000` conversions in `io/audio` (SongClock, Metronome, SamplerPiano,
createAudio), the campaign and ear-trainer scenes. The admin lock's `30 * 60 * 1000` is `30 * MS_PER_MINUTE`. The staff's ink
and "wrong" red come from `core/layout/scoreColour.ts` (`STAFF_INK`, `SCORE_COLOURS.missed`) instead of repeated literals in
`StaffView.ts` and `PlaySession.ts`. The remaining hex colours sit in `game/ui/pixel/palette.ts`, which is the pixel palette's
own data, so they stay literal.

These are values with a meaning, written more than once or hard to find. Ordered by value.

| # | Finding | Where | Proposal |
|---|---|---|---|
| 1 | **MIDI status bytes** `0x90`, `0x80`, `0xf0`, `0xfe`, `0x7f` and the `0x80` status-bit mask written as hex in the parser and again in the virtual keyboard (comments in `parse.ts` say what they are) | `src/io/midi/parse.ts` (6), `src/io/mock/VirtualEz220.ts` (3) | a new file `bytes.ts` in `io/midi` (proposed): `NOTE_ON = 0x90`, `NOTE_OFF = 0x80`, `STATUS_MASK`, `CHANNEL_MASK`, `DATA_MASK`, `ACTIVE_SENSING`. Both files import it. The mock then cannot drift from the parser |
| 2 | **MIDI 127** (max velocity / max note) with two meanings | `core/chart/pitch.ts`, `playback.ts`, `schema.ts`, `judge/types.ts`, `io/audio/mapping.ts` (2), `io/audio.ts`, `io/mock/*` | `MIDI_MAX = 127` (also the highest note) in a new `midi.ts` in `core/chart` (proposed), plus `MIDI_VELOCITY_MIN = 1`. `core` cannot import `io`, so it lives in core and `io` imports it. Real benefit: the schema and the clamp can no longer disagree |
| 3 | **`60000`** (ms per minute), 9 copies, plus `/ 60_000` once | `core/chart/time.ts` (2), `core/transport/transport.ts` (3), `core/text/rundown.ts`, `io/audio/mapping.ts`, `dev/audioDemo.ts`, `spike/tapTest.ts` | `MS_PER_MINUTE` in `core/chart/time.ts` next to `PPQ`. Better still, one `msPerBeat(bpm)` helper: three of those lines are the same formula, and `mapping.ts:42` already is one |
| 4 | **`DEFAULT_TOGETHER_WINDOW_MS = 300` defined twice** (once exported in `judge/wait.ts`, once private in `judge/tempo.ts`) | `src/core/judge/wait.ts:16`, `tempo.ts:19` | Delete the copy in `tempo.ts` and import the one from `wait.ts` (or a shared `judge/windows.ts`). This is the clearest instance of the C-world risk: change one, forget the other, and the two play modes judge "together" differently |
| 5 | **Tempo clamp 30 to 240 bpm and velocity-curve shape (0.05, 0.95, 1.6)** inline | `src/io/audio/mapping.ts:36-46` | `BPM_MIN`, `BPM_MAX`; name the curve. The bpm limits almost certainly also exist in the UI (speed/tempo control); check and share |
| 6 | **Audio envelope and click numbers** (1600/1000 Hz, 0.35/0.22 gain, 0.002/0.05/0.06 s, 120 ms lookahead, 25 ms tick) | `src/io/audio/Metronome.ts` | A small `CLICK = { accentHz: 1600, ... }` object. The two timing options are already options with defaults; the sound shape is the part to name |
| 7 | **Judge and mock timings** (`hold` min 20 ms, cap 80, `400` slot fallback, `150` gap, `500`/`15` ms defaults) | `src/io/mock/performance.ts` | Defaults destructured in the signature are self-documenting, but `20`, `80`, `400` inside the body are not. Name those three |
| 8 | **`1280 x 720`** reference viewport for layout | `src/game/pieceList.ts:24` | Name it (`REFERENCE_VIEWPORT`); there is likely a twin in tests/e2e config. Low risk, one line |
| 9 | **The 44 px minimum touch target** and a few "for a finger" sizes, already commented in `MenuScene.ts` | `src/game/MenuScene.ts:26` and neighbours | One `MIN_TOUCH_PX` in the pixel UI module, used by buttons, if more than one site repeats it. Check before doing |
| 10 | **Staff geometry in `src/core/layout/staff.ts`** (`0.7`, `0.15`, `0.4`, `2.6`, `7`, `3.2`, `32` max space) | `core/layout/staff.ts` 50 hits | Partly named already (`SYSTEM_GAP`, `LABEL_HALF`, `BAR_PAD_RIGHT`). The inline ones are clef/brace boxes in staff spaces; group them into one `CLEF_BOX` / `BRACE` table. Medium value, and layout tests already pin the output |

Two findings of a different kind, for completeness:

- **Hex colours outside the palette** (done in the second pass: the editor, preview and staff demo now take the staff's
  colours from `DEFAULT_THEME` in `StaffView.ts`, through `hexCss` in `palette.ts` where a CSS string is needed; the
  magenta "missing colour" in `bitmap.ts` is named; `SCORE_COLOURS` in `scoreColour.ts` was already a named table and stays
  in `core`, which cannot import the game's palette). Original finding: 32 `0xRRGGBB` literals in `src/game` (`0x2b6cff` three times, `0xfdf6e3` twice,
  `0xd7263d` twice, `0x1b1b2f` twice), plus the score colours in `src/core/layout/scoreColour.ts`. The pixel art has a
  16-colour palette precisely so colour lives in one place; these are the leaks. Route them through `palette.ts` or name them
  in `scoreColour.ts`. This is more a design-consistency fix than a magic-number one.
- **Migration constants** such as `V7_BATTLE_PLAYER_MAX_HP = 100` in `progression/migrate.ts` are already named and frozen on
  purpose; migrations must not follow a later change of the live value. Leave as is.

## Layout: rectangles, not arrays

The pixel scenes position things by hand. The numbers are coupled (the speech bubble starts at the XP bar's right edge plus a gap),
but they are not a list to loop over, so arrays and matrices do not fit; named boxes do. `src/core/layout/rect.ts` has a plain
`Rect` (`x, y, w, h`) with `rectRight`, `rectBottom` and `rectCentre`. `MenuScene` and `ResultsScene` now name their header,
XP bar, pager and column constants and derive dependent positions from them (`Math.max(BUBBLE_MIN_X, rectRight(XP_BAR) + BUBBLE_GAP)`).
Output is pixel-identical; no number changed.

Second pass, every other pixel scene. The shared shapes became small pure helpers in `core/layout`, each with a test:

- `resultsLayout` (`resultsLayout.ts`): the frame of Results, Battle results and the Free play rundown (left column, the two
  buttons at its foot, the numbers column). The three screens repeated `LEFT_WIDTH = 124`, `height - 42`, `height - 20` and
  `LEFT_WIDTH + 18`; now they cannot drift.
- `cardGrid` and `pagerBoxes` (`cardGrid.ts`): the card columns, rows per page and pager row that the menu and the piece
  switch list both computed by hand. The pager is drawn by one `PixelScene.pager` method.
- `row` (`row.ts`): boxes side by side with a gap, left to right or from a right edge. The editor's chained offsets
  (`206 + 19`, `246 + 22`, `width - 134`) are now rows of named widths.

In `src/game`: `ui/pixel/playBars.ts` holds the top bar shared by the practice, battle and editor screens (height, Back
button, title x, bubble x, button height and gaps), and `ui/pixel/SpeechBubble.ts` replaces the copy of Kiur's bubble code
that practice and battle each had. Settings draws its seven option rows with one `optionRow` helper instead of five copies
of the same loop. Credits, Pieces and Settings name their header positions.

Verified pixel-identical: 45 screenshots (menu, settings, pieces, credits, practice in three states, results, battle,
battle results lost and won as a series, rundown, editor, preview; at 1366x768, 1024x600 and 800x1280) taken on `main` and
on the branch, compared with zero pixels of tolerance. One oddity was kept rather than fixed: the editor's note-length
buttons start one art pixel further in than every other row (x 5, not 4). Fixing it would move them a pixel; it is noted in
the code.

Not added: classes for rectangles, lines or circles. Phaser already has shapes (`Phaser.Geom.Rectangle`, `GameObjects.Rectangle`)
and the pixel UI draws from bitmaps (`PixelImage`, `panelBitmap`, `PixelBar`), so a second shape hierarchy would duplicate both. A
plain data `Rect` in core stays testable without Phaser. Grow it only when a third scene needs the same helper.

## Would an ESLint rule help?

Short answer: **a narrow one, yes; the broad one, no.**

I ran `@typescript-eslint/no-magic-numbers` (already installed via `typescript-eslint`; no new dependency) in two shapes.

1. **Whole repo, strict** (ignore 0, 1, 2, -1): 1,234 hits. Unusable. It would force 600 constants onto the pixel layouts and
   test-style geometry, and the team would learn to add `eslint-disable` comments, which defeats it.
2. **`src/core`, `src/io` (not `io/mock`), `tools/`, ignoring also 0.5, 100 and 1000**: 317 hits, of which 158 in `core`
   (dominated by `4`, `3`, `5`: beats, staff steps and pitch-class maths) and 67 in the generators (theory tables). Still too
   noisy to turn on as an error, and 7 of the 317 were "unused eslint-disable" noise from existing comments.

Recommendation, in order of cost:

1. **Do the Group 2 items 1 to 4 by hand** (a day's work or less, and they are the only ones that carry real drift risk). Add a
   unit test only where behaviour could differ (item 4: both modes use the same default).
2. **Do not enable `no-magic-numbers` repo-wide.** If it is wanted anyway, enable it as `warn` in
   `eslint.analyze.config.js` (the slow, advisory pass, see [static-analysis.md](static-analysis.md)) for `src/core/**` and
   `src/io/**` only, with `ignore: [0, 1, 2, -1, 0.5, 100, 1000]`, `ignoreArrayIndexes`, `ignoreEnums`,
   `ignoreNumericLiteralTypes`, `ignoreReadonlyClassProperties`, `ignoreTypeIndexes`, and excluding `*.test.ts`, `io/mock`,
   `spike`, `game`, and the generators' theory tables. That keeps the signal on the places where a constant carries meaning,
   and a warning never fails CI. Re-count after items 1 to 4; the target is a number small enough to read in one sitting
   (under about 100), after which it could be promoted to `error` with the remainder annotated
   `// eslint-disable-next-line @typescript-eslint/no-magic-numbers -- <why>` like the complexity hotspots.
3. **A cheaper alternative with no new rule:** `grep -rn "60000\|0x90\|127" src` in review. Four numbers cause most of the
   risk.

## Open questions for the maintainer

- Do you want the advisory `warn` rule from point 2 added (small config change plus a decision file, since it touches the
  lint setup), or only the manual cleanup of items 1 to 4?
- Item 9 and the hex colours touch how the pixel UI is designed; they are left for whoever works on the next UI feature.

## TODO

Work tags ([todo-tags.md](../automation/todo-tags.md)); the closed issue in brackets keeps the earlier discussion.

- IDEA(builder, R4): on hold with the turn battle (d129): one named constant per shared battle limit in src/core/battle (bars of a special or defence 16, turn counts 20, HP and attack 10000), the tilt's and the base cast's `comboMaxLoops` from one constant, and a test that the schemas agree; no content or version change. Do it when R4 battle work next touches those files.
