---
id: "ft_0_17"
title: "Note-name trainer"
scope: "A trainer that shows one note on the staff (its name only after a wrong press, AX-1); the student names it on the keyboard; three lives; letter names with a B or H setting; gentle steps and no time limits; earned XP is kept"
effort: "medium"
status: "built (screen, room entry, B/H toggle, lives, XP saved to the profile); playtest open (Human)"
completeness: 80
---
# ft_0_17: Note-name trainer

Index: [FEATURES.md](FEATURES.md).

A trainer under "Practice theory": one note on the staff, the student names it by pressing the key. A wrong press costs one of three lives and says why. No time limit.

## Rules

- Pure rules (lives, XP, wrong-press reason, seeded targets) in `src/core/trainer/noteTrainer.ts`; steps in `content/trainer/steps.json`; the one-note chart in `src/core/trainer/noteChart.ts`; the screen is `src/game/NoteTrainerScene.ts`, entered from the stand's panel in the room (the note in cross hairs, "Note names"; ft_1_08.AC11).
- The screen has almost no text (clean-screen review): no title, no hint, hearts for lives, and the step (stairs and its number, cycling 1 to 4) and B/H as toolbar buttons. The B/H toggle saves `settings.noteNaming`; it is not a Settings row.
- Each right name's XP is saved to the active profile at once (`addTrainerXp` in `core/progression/profile.ts`, save version 15, d083), so Again keeps it; the round's XP on screen restarts at 0.
- Provisional until a playtest: the step ranges, the XP per note, and the clef rule for a step that straddles middle C (AX-3).
- Tests: `tests/e2e/note-trainer.spec.ts` (menu area).
- TODO(builder, R2): the e2e test "the letter naming switches between B and H and is saved (AC4)" fails in the cloud on main since at least the lean pivot (the screen still shows B after the click). Find whether the click misses the B/H button or the screen is read before its redraw. Needs a human look: the room picture and the Windows screenshot baseline of the room.

## Acceptance criteria

- **ft_0_17.AC1** One note is shown on the staff without its name (the student reads it; AX-0, AX-1); after a wrong press the name stands on the note. The clef and the range come from the step being played.
- **ft_0_17.AC2** A wrong press costs one life and shows why, using `classifyWrongNote` in `src/core/judge/classify.ts`: the name on the note shows a wrong letter or a neighbour key; a wrong octave also says "right letter, wrong octave", and no other words (AX-3 provisional, as the ear trainer).
- **ft_0_17.AC3** The student has three lives, drawn as three hearts (a lost one grey); the third loss ends the round. XP earned in the round is kept, and the student can retry at once (a key after a short pause, a click on the screen, or the toolbar's loop).
- **ft_0_17.AC4** The letter naming setting is B or H, default B (`NoteNaming` in `src/core/text/noteName.ts`); it is a picture choice on the settings screen's learning page, as well as the note trainer's switch.
- **ft_0_17.AC5** The steps come from validated content with a `schemaVersion`.
- **ft_0_17.AC6** A menu entry "Practice theory" opens the trainer. Covered by a later task.
- **ft_0_17.AC7** The staff stands still: every note of a step, in either clef, is drawn on the same staff at the same size and place, and so are the steps that fit at the same size (steps 1 to 3); a step that needs a smaller staff (the whole keyboard) gets one of its own (AX-0: no step gets smaller notes for another step; AX-3 provisional). `noteTrainerLayout` in `src/core/trainer/staffFrame.ts`.
