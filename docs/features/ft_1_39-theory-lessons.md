---
id: "ft_1_39"
title: "Theory lessons: a lesson book of everything there is to learn"
scope: "A lesson book under Practice theory that lists every topic of the learning catalog, written lessons as lessons and the rest as ghosted placeholders; each lesson runs the same six steps (Kiur shows with lit keys, the student copies, a pitfall card, tries whose help fades, a play-along in real music, a check played on the keys); a medal per lesson, reviews on later days, nothing locked"
effort: "large"
status: "slice 1 in progress: the catalog as data, the lesson format, the lesson runner and the first three lessons are built in core with unit tests; the book and the lesson screen are next"
completeness: 15
depends_on: ["ft_0_17", "ft_1_10", "ft_1_28", "ft_1_29", "ft_1_31", "ft_1_32", "ft_Y_06", "core_09"]
---
# ft_1_39: Theory lessons

Release R2 (plan). Index: [FEATURES.md](FEATURES.md). A lesson book under Practice theory (the stand's panel in the room) teaches music theory and notation one idea at a time, with pictures, lit keys, the classic mistakes, play-alongs and a check on the keys. The trainers already built (note names, scales and chords, the circle of fifths, the ear trainer) become the lessons' practice and their review.

AX-0: every step ends with the student playing; no page is only read, and every check is answered on the keys from the staff. AX-1: a step is finished by a run of clean answers, not a total. AX-2.1: feedback says what was played; a medal comes from the check's first-try share.

## Rules

1. **The book lists everything** ([d303](../decisions/game.md#d303)). Every row of [the learning catalog](../theory/learning-catalog.md) is in the book, by its area. A topic with a written lesson opens it; a topic without one is a ghosted placeholder showing its name only, not pressable. A new topic is a new catalog row, never deleted because it is not built.
2. **Nothing is locked.** Every written lesson is open at every level. The book marks a suggested next lesson, and the teacher can assign a lesson with a deadline in the curriculum (ft_1_26).
3. **Six steps, the same in every lesson** (content decides which steps a lesson has and their items):
   1. **Show.** Kiur plays the idea under the spotlight (ft_1_31) while the keys light on the on-screen keyboard and the EZ-220 (the light sounds there, wanted in a demonstration); the picture shows the same notes on the staff; one short line.
   2. **Copy.** The student plays back what Kiur showed, keys still lit.
   3. **Pitfall.** A card shows the lesson's classic mistake as a picture, then the student plays the tricky case. The card comes back by itself when a wrong note in the lesson has that reason (`classifyWrongNote`).
   4. **Try.** New items of the idea with fading help: lit at once, then lit after two wrong presses (ft_Y_06's rule), then unlit. `AX-3 provisional:` five clean items in a row finish the step.
   5. **Play-along.** A short phrase in Wait mode with the idea marked on the staff: from an approved piece the player has that shows it (found by the piece analysis, core_05, core_08), else a generated exercise.
   6. **Check.** `AX-3 provisional:` eight questions answered only on the keys, from the staff, no lights. The first-try share gives the medal.
4. **Pictures.** One pure layout draws a staff beside a keyboard from the lesson's data (notes, lit keys, brackets, arrows, numbers), painted at build time like the other pictures; labels are string keys over it, never text in the art; each colour has one meaning in every lesson. A preview tool shows a lesson's pictures before they are committed (d286).
5. **Key lights.** Show and Copy light both keyboards. Try lights only the on-screen keyboard until the EZ-220 is known to light a key without sounding it (`docs/hardware-notes.md`). Colours exist only on the on-screen keyboard.
6. **Medal, review and XP.** A medal per lesson, gold, silver or bronze by the check's first-try share as in ft_1_32, raised and never lowered. `AX-3 provisional:` a finished lesson comes back as a three-question review after 1, 3, 7 and 21 days, mixed with others, in the trainers' own screens; a missed review sends the lesson's Try step again, nothing taken away. A right note earns the theory XP of ft_0_17 (10, as in ft_1_29); Show earns none.
7. **Names** follow the B or H setting (H in Estonian), letter names only. Lesson text goes through string keys with Estonian (`write-ui-text`).
8. **A sign the staff cannot draw** has no lesson until core_09 draws it; its catalog row says `needs drawing`.
9. **After a lesson** the matching trainer opens on the same setting (the triad lesson opens the chord trainer on triads).
10. **Who teaches** ([d304](../decisions/game.md#d304)). Kiur shows and explains every lesson (AX-4); the teacher only assigns lessons and holds checks, as with pieces.
11. **Stoic, pointing words** (d304). At most twelve words per step; the picture carries the rest. A line does not describe a thing: it names the thing and an arrow points at it, and a thing that does several things gets one short label pointing at each part. No praise (AX-2.1).
12. **First lessons** are areas D and E of the catalog: half step, whole step, the major scale (slice 1).
13. **The path is a skill tree** ([d305](../decisions/game.md#d305)). Each lesson names the catalog ids it needs; the ids and these links form a tree with no loops. Nothing is locked: a lesson is *ready* once every lesson it needs has a medal, and the suggested next lesson is the ready lesson in the lowest stage. The book stays sorted by area (the map); the tree and its stages give the order. The teacher can move a lesson to another stage. The tree is drawn from the data, so a new lesson needs no picture of its own.

## The path (draft stages)

`AX-3 provisional:` the stages and links below are a first draft, ordered like the graded theory syllabi; they become data with slice 2.

| Stage | Topics (catalog ids) | Needs |
|---|---|---|
| 1 First steps | A1, A2, A4, A5, B1, B2, C1, C2 | A2 needs A1; B2 needs B1; C2 needs C1 |
| 2 Both hands, first rhythms | B3, B4, C3, C8, D1, D2, D3, K1 | B4 needs B2, B3; D1 needs A1, A2; D2 needs D1; D3 needs D2; C8 needs C2 |
| 3 The major scale | E1, C4, C6, C12, B5, D4, F1, I1 | E1 needs D2, D3; F1 needs B4; C6 needs C8; I1 needs C6 |
| 4 First chords | G1, E6, E2, E3, E4, F2, F3, M1, M2 | G1 needs E1, F1; E2 needs E1; E3, E4 need E2; F2 needs F1, D2 |
| 5 Keys and harmony | E5, G3, H2, H3, C14, J1, N1, N2 | E5 needs E3, E4; H2 needs G1, E6; H3 needs H2 |
| 6 Minor and sevenths | E7, E9, E10, E11, G5, G6, G7, G8, G9, G2, F4 | E7 needs E5; G5 needs G1, F2; G6 to G9 need G5 |
| 7 and on | the rest of the catalog, each after what it needs | |

Open projects that order learning this way: Exercism names each exercise's concepts and prerequisites in one checked config; Kwan joins learning goals by prerequisite links with mastery per goal; Skill Compass turns mastered topics into a list of what is next. Exercism locks; Pianor does not.

## Slices

| Slice | What | Effort |
|---|---|---|
| 0 | Previews of a lesson's screens and the book; the ergonomics review of them (d293) | simple |
| 1 | The book with every catalog row (ghosted where no lesson), the lesson runner's six steps, the picture layout and its preview tool, lessons for D1, D2 and E1 (half step, whole step, the major scale) | large |
| 2 | Medals, reviews on later days, the skill tree as data with its loop check, the suggested next lesson, a lesson assigned by the teacher | medium |
| 3 | Play-alongs found in the player's own approved pieces | medium |
| 4 | Lessons for the rest of the catalog, one or two areas a pull request, content only | large |

Lessons are content (`content/lessons/`, zod-validated, `schemaVersion`), each naming the catalog id it teaches; adding a lesson needs no code change.

## Slice 1 as built (so far)

- The catalog is `content/lessons/catalog.json` (`src/core/lessons/catalog.ts`); `tools/docs/learningCatalog.test.ts` keeps it equal to the catalog page, id by id and status by status. Every area and topic has a name under `lessons.area.<letter>` and `lessons.topic.<id>`, in English and Estonian.
- A lesson is one file in `content/lessons/` (`src/core/lessons/lesson.ts`): its topic and needs, Show (notes and marks), Pitfall (notes, marks and the wrong-note reason that brings its card back), Try and Check (an item generator: a half or whole step from a note, or a major scale from its tonic), Play-along (notes and marks). The first three: `half-step.json` (D1), `whole-step.json` (D2), `major-scale.json` (E1).
- `LessonRun` (`src/core/lessons/run.ts`) runs the six steps: what is awaited, the lit keys, Try's clean run and its fading light (`LESSON_RULES.fade`), the check's first tries and the medal (`medalOf` of ft_1_32), and 10 theory XP for each right note after the show.
- `AX-3 provisional:` step items are asked in the right hand between B3 and D5; the scales asked are C, G, D, A and E major, one octave up (flat keys wait until items are spelled, a TODO in `lesson.ts`); the major scale's check asks 4 scales, the steps' 8 items; the light is on at once for Try's first 2 items, after two wrong presses for the next 2, then off; the pitfall of all three lessons is the neighbour key.

## Acceptance criteria

- **ft_1_39.AC1** The book shows every row of the learning catalog under its area; a row with a lesson opens it, a row without one is drawn ghosted with its name and does nothing when pressed.
- **ft_1_39.AC2** Every written lesson opens at every player level.
- **ft_1_39.AC3** A lesson runs its steps in order; Try ends only after five clean items in a row; a wrong note whose reason matches the lesson's pitfall shows the pitfall card.
- **ft_1_39.AC4** Try lights the awaited key at once, then only after two wrong presses, then not at all, on the on-screen keyboard.
- **ft_1_39.AC5** The check is answered on the keys with no lights, and its first-try share sets a medal that is never lowered.
- **ft_1_39.AC6** Lessons are validated content naming a catalog id; a lesson naming an unknown id fails to load.

## TODO

- TODO(builder, R2): slice 0's previews and ergonomics review are done (second pass after the review). Still open from the review, for slice 1: Left and Right keys turn the book's pages, Enter opens the suggested lesson, Esc leaves; a press on a placeholder shows a short "not yet"; the "?" of a Try item pulses while it waits; a wrong note visibly empties the clean-run counter; the door uses the game's door picture.
- TODO(builder, R2): lesson items are bare MIDI, read with sharps, so the major scale asks only C, G, D, A and E; spell the items (`src/core/lessons/lesson.ts`), then add F, B flat and E flat major.
- TODO(builder, R2): with slice 2, `piece:lint`-style checking of the tree: every needed id exists in the catalog and there is no loop; test first.
- NEEDS-HUMAN: the EZ-220 silent-light test (ft_Y_06) decides whether Try can light the real keyboard.
