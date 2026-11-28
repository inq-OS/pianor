---
id: "ft_0_17"
title: "Note-name trainer"
scope: "A trainer that shows one note on the staff (its name only after a wrong press, AX-1); the student names it on the keyboard; three lives; letter names with a B or H setting; gentle steps (white keys first) and no time limits; earned XP is kept, a round ends with its result line"
effort: "medium"
status: "built (screen, room entry, B/H toggle, lives, XP saved to the profile, slipped chords, round result, level line); playtest open (Human)"
completeness: 80
---
# ft_0_17: Note-name trainer

Index: [FEATURES.md](FEATURES.md).

A trainer under "Practice theory": one note on the staff, the student names it by pressing the key. A wrong press costs one of three lives and shows why on the staff. No time limit.

## Rules

- Pure rules (lives, XP, wrong-press reason, seeded targets) in `src/core/trainer/noteTrainer.ts`; steps in `content/trainer/steps.json`; the one-note chart in `src/core/trainer/noteChart.ts`; the screen is `src/game/NoteTrainerScene.ts`, entered from the stand's panel in the room (the note in cross hairs, "Note names"; ft_1_08.AC11).
- The screen has almost no text (clean-screen review): no title, no hint, hearts for lives, and the step (stairs with its number beside them, `ToolbarItem.value`, cycling 1 to 4) and B/H as toolbar buttons. The B/H toggle saves `settings.noteNaming`; it is not a Settings row. One line under the hearts says, in this order of need: the round's result once it is over, "right letter, wrong octave" after that miss, or a new player level.
- Each right name's XP is saved to the active profile at once (`addTrainerXp` in `core/progression/profile.ts`, save version 15, d083), so Again keeps it; the round's XP on screen restarts at 0.
- Provisional until a playtest: the step ranges, the XP per note, the clef rule for a step that straddles middle C, and the 40 ms window of a slipped chord (AX-3). TODO(architect, R2): confirm the slipped-chord window in a playtest on the real keyboard.
- Steps 1 and 2 ask white keys only (`whiteKeys` in `content/trainer/steps.json`): a beginner meets the letter names first; black keys come in steps 3 and 4.
- The round's result line is `roundResultLine` in `src/core/trainer/trainerResult.ts`, for every trainer that ends a round.
- Tests: `tests/e2e/note-trainer.spec.ts` (menu area).
- TODO(builder, R2): the e2e test "the letter naming switches between B and H and is saved (AC4)" fails in the cloud on main since at least the lean pivot (the screen still shows B after the click). Find whether the click misses the B/H button or the screen is read before its redraw. Needs a human look: the room picture and the Windows screenshot baseline of the room.

## Acceptance criteria

- **ft_0_17.AC1** One note is shown on the staff without its name (the student reads it; AX-0, AX-1); after a wrong press the name stands on the note. The clef and the range come from the step being played.
- **ft_0_17.AC2** A wrong press costs one life and shows why, using `classifyWrongNote` in `src/core/judge/classify.ts`: the key played shows as a named ghost note beside the awaited one, so a wrong letter or a neighbour key is read off the staff, and a wrong octave puts an 8 after it; no words (d312).
- **ft_0_17.AC3** The student has three lives, drawn as three hearts (a lost one grey); the third loss ends the round. XP earned in the round is kept, and the student can retry at once (a key after a short pause, a click on the screen, or the toolbar's loop).
- **ft_0_17.AC4** The letter naming setting is B or H, default B (`NoteNaming` in `src/core/text/noteName.ts`); it is a picture choice on the settings screen's learning page, as well as the note trainer's switch.
- **ft_0_17.AC5** The steps come from validated content with a `schemaVersion`.
- **ft_0_17.AC6** A menu entry "Practice theory" opens the trainer. Covered by a later task.
- **ft_0_17.AC7** The staff stands still: every note of a step, in either clef, is drawn on the same staff at the same size and place, and so are the steps that fit at the same size (steps 1 to 3); a step that needs a smaller staff (the whole keyboard) gets one of its own (AX-0: no step gets smaller notes for another step; AX-3 provisional). `noteTrainerLayout` in `src/core/trainer/staffFrame.ts`.
- **ft_0_17.AC8** Keys pressed together (within 40 ms of a press's first key: a slipped finger or a chord) are one press: right if any key is right, else one miss and one life (AX-3 provisional). `pressKey` in `src/core/trainer/noteTrainer.ts`.
- **ft_0_17.AC9** A right press after a wrong press has shown the note's name earns 0 XP (AX-1: the name was given away); the note still counts as found and the round goes on.
- **ft_0_17.AC10** Steps 1 and 2 ask white keys only; the later steps every key in their range.
- **ft_0_17.AC11** When the round is over, one objective line under the hearts says how many were right and the XP earned ("Right notes: 12, 110 XP"), until the next round starts.
- **ft_0_17.AC12** When the trainer's XP reaches a new player level, a short line under the hearts says the level for the rest of the round (a real milestone, AX-2). `ProfileService.addTrainerXp` returns the level reached.
