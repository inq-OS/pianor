---
id: "ft_1_39"
title: "Theory lessons: a lesson book of everything there is to learn"
scope: "A lesson book under Practice theory that lists every topic of the learning catalog, written lessons as lessons and the rest as ghosted placeholders; each lesson runs the same six steps (Kiur shows with lit keys, the student copies, a pitfall card, tries whose help fades, a play-along in real music, a check played on the keys); a medal per lesson, reviews on later days, nothing locked"
effort: "large"
status: "planned: catalog and slices written; nothing built"
completeness: 0
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

## Slices

| Slice | What | Effort |
|---|---|---|
| 0 | Previews of a lesson's screens and the book; the ergonomics review of them (d293) | simple |
| 1 | The book with every catalog row (ghosted where no lesson), the lesson runner's six steps, the picture layout and its preview tool, lessons for D1, D2 and E1 (half step, whole step, the major scale) | large |
| 2 | Medals, reviews on later days, the suggested next lesson, a lesson assigned by the teacher | medium |
| 3 | Play-alongs found in the player's own approved pieces | medium |
| 4 | Lessons for the rest of the catalog, one or two areas a pull request, content only | large |

Lessons are content (a new folder under content, zod-validated, `schemaVersion`), each naming the catalog id it teaches; adding a lesson needs no code change.

## Acceptance criteria

- **ft_1_39.AC1** The book shows every row of the learning catalog under its area; a row with a lesson opens it, a row without one is drawn ghosted with its name and does nothing when pressed.
- **ft_1_39.AC2** Every written lesson opens at every player level.
- **ft_1_39.AC3** A lesson runs its steps in order; Try ends only after five clean items in a row; a wrong note whose reason matches the lesson's pitfall shows the pitfall card.
- **ft_1_39.AC4** Try lights the awaited key at once, then only after two wrong presses, then not at all, on the on-screen keyboard.
- **ft_1_39.AC5** The check is answered on the keys with no lights, and its first-try share sets a medal that is never lowered.
- **ft_1_39.AC6** Lessons are validated content naming a catalog id; a lesson naming an unknown id fails to load.

## TODO

- TODO(builder, R2): slice 0, previews and the ergonomics review, before slice 1.
- NEEDS-HUMAN: the EZ-220 silent-light test (ft_Y_06) decides whether Try can light the real keyboard.
