# Magic numbers

Which numbers in the code are named and which stay literal, as a C/C++ static analyser (MISRA, Klocwork, `-Wmagic`) would
ask. Two proposals are open (items 9 and 10 below).

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

## Group 2: named, one place each

Values with a meaning that would otherwise be written more than once:

- MIDI status bytes in `io/midi/bytes.ts`; `MIDI_MAX` and the velocity floor in `core/chart/midi.ts`.
- Time in `core/chart/time.ts`: `PPQ`, `MS_PER_SECOND`, `MS_PER_MINUTE`, `msPerBeat`, and `PIECE_BPM`, from which every
  tempo range follows (the metronome's top is `PIECE_BPM.max` times `RAMP_MAX_PERCENT`; `practiceSpeed.test.ts` checks it).
  Click and tempo-percent ranges in `core/transport/practiceSpeed.ts`.
- One `DEFAULT_TOGETHER_WINDOW_MS` for both play modes.
- The velocity curve in `io/audio/mapping.ts`; the `CLICK` sound table and scheduler defaults in `io/audio/Metronome.ts`;
  `LAST_SLOT_MS`, `MIN_HOLD_MS`, `MISTAKE_HOLD_MAX_MS` in `io/mock/performance.ts`; `REFERENCE_VIEWPORT` in `game/pieceList.ts`.
- Colours: the pixel palette in `game/ui/pixel/palette.ts` (its own data, so literal there); the staff's ink and score
  colours in `core/layout/scoreColour.ts` (`STAFF_INK`, `SCORE_COLOURS`), reached from the game through `DEFAULT_THEME` and
  `hexCss`; the magenta "missing colour" in `bitmap.ts` is named.
- Migration constants in `progression/migrate.ts` are named and frozen on purpose: a migration never follows a later change
  of the live value.

Open:

| # | Finding | Where | Proposal |
|---|---|---|---|
| 9 | **The 44 px minimum touch target** and a few "for a finger" sizes, commented in `MenuScene.ts` | `src/game/MenuScene.ts:26` and neighbours | One `MIN_TOUCH_PX` in the pixel UI module, used by buttons, if more than one site repeats it. Check before doing |
| 10 | **Staff geometry in `src/core/layout/staff.ts`** (`0.7`, `0.15`, `0.4`, `2.6`, `7`, `3.2`, `32` max space) | `core/layout/staff.ts` | Partly named (`SYSTEM_GAP`, `LABEL_HALF`, `BAR_PAD_RIGHT`). The inline ones are clef and brace boxes in staff spaces; group them into one `CLEF_BOX` / `BRACE` table. Layout tests pin the output |

## Layout: rectangles, not arrays

The pixel scenes position things by hand. The numbers are coupled (the speech bubble starts at the XP bar's right edge plus
a gap), but they are not a list to loop over, so named boxes fit, not arrays. `src/core/layout/rect.ts` has a plain `Rect`
(`x, y, w, h`) with `rectRight`, `rectBottom` and `rectCentre`, and scenes derive dependent positions from named boxes
(`Math.max(BUBBLE_MIN_X, rectRight(XP_BAR) + BUBBLE_GAP)`). Shared shapes are small pure helpers in `core/layout`, each with
a test: `resultsLayout` (the results frame), `cardGrid` and `pagerBoxes` (card columns and the pager, drawn by
`PixelScene.pager`), `row` (boxes side by side with a gap). In `src/game`, `ui/pixel/playBars.ts` holds the top bar the play
screens share and `ui/pixel/SpeechBubble.ts` is Kiur's one bubble.

There are no classes for rectangles, lines or circles. Phaser already has shapes (`Phaser.Geom.Rectangle`,
`GameObjects.Rectangle`) and the pixel UI draws from bitmaps (`PixelImage`, `panelBitmap`, `PixelBar`), so a second shape
hierarchy would duplicate both. A plain data `Rect` in core stays testable without Phaser.

## Would an ESLint rule help?

Short answer: **a narrow one, yes; the broad one, no.**

`@typescript-eslint/no-magic-numbers` (installed with `typescript-eslint`; no new dependency), measured in two shapes:

1. **Whole repo, strict** (ignore 0, 1, 2, -1): 1,234 hits. Unusable. It would force 600 constants onto the pixel layouts and
   test-style geometry, and the team would learn to add `eslint-disable` comments, which defeats it.
2. **`src/core`, `src/io` (not `io/mock`), `tools/`, ignoring also 0.5, 100 and 1000**: 317 hits, of which 158 in `core`
   (dominated by `4`, `3`, `5`: beats, staff steps and pitch-class maths) and 67 in the generators (theory tables). Still too
   noisy to turn on as an error, and 7 of the 317 were "unused eslint-disable" noise from existing comments.

Recommendation, in order of cost:

1. **Do not enable `no-magic-numbers` repo-wide.** If it is wanted anyway, enable it as `warn` in
   `eslint.analyze.config.js` (the slow, advisory pass, see [static-analysis.md](static-analysis.md)) for `src/core/**` and
   `src/io/**` only, with `ignore: [0, 1, 2, -1, 0.5, 100, 1000]`, `ignoreArrayIndexes`, `ignoreEnums`,
   `ignoreNumericLiteralTypes`, `ignoreReadonlyClassProperties`, `ignoreTypeIndexes`, and excluding `*.test.ts`, `io/mock`,
   `spike`, `game`, and the generators' theory tables. That keeps the signal on the places where a constant carries meaning,
   and a warning never fails CI. The target is a number small enough to read in one sitting
   (under about 100), after which it could be promoted to `error` with the remainder annotated
   `// eslint-disable-next-line @typescript-eslint/no-magic-numbers -- <why>` like the complexity hotspots.
2. **A cheaper alternative with no new rule:** `grep -rn "60000\|0x90\|127" src` in review. Four numbers cause most of the
   risk.

## Open questions for the maintainer

- Is the advisory `warn` rule of point 1 wanted (a small config change plus a decision, since it touches the lint setup)?
- Item 9 touches how the pixel UI is designed; it is for whoever works on the next UI feature.
