---
id: "ft_1_10"
title: "Pitch trainer by ear"
scope: "No staff while listening: the game sounds one note or two, the student finds them on the keys; settings for the note length (1 to 3 s) and repeat; an ear level of 5 + N stars of 100 points, 100/50/25/12/6/0 points by misses"
effort: "medium"
status: "in progress: built and merged; the visual check is open"
completeness: 90
depends_on: ["ft_0_07", "ft_0_17"]
---
# ft_1_10: Pitch trainer by ear

Release R2. The note-name trainer (ft_0_17) asks "which key is this note on the staff?"; this one asks "which key is this sound?". Its symbol is an ear. No staff is shown while the student listens (AX-0: hearing pitch is part of being a musician). Idea from LOOM's mechanics, never its names or music. Built on ft_0_17's seeded targets (`pickTarget`, `Random.derive`), `classifyWrongNote` and `PixelScene`.

## Rules

- **Question.** One note (single mode) or two different notes (two-note mode). Each note sounds for the **duration** (whole seconds, 1 to 3) through the game's piano (`GameAudio`); in two-note mode X sounds, then Y. The student plays the notes in order. Any key press that is not the next expected note is a **miss**. A question ends when its last note is found; then the next one comes, without an end to the session (no lives: the student leaves when they like).
- **Repeat.** With repeat on, the whole question sounds again when no key was pressed for twice its sounding time (the duration times its number of notes), counted from the end of the last sound or the last press. With repeat off it sounds once.
- **Points.** A question scores by its misses: 0 misses 100, 1 miss 50, 2 misses 25, 3 misses 12, 4 misses 6, 5 or more 0. A two-note question is one question: its misses are added up.
- **Stars and level.** Ear level N needs **5 + N stars**; one star is **100 points**. Points never go down (AX-1.1); a question's points fill the current star, the rest flows into the next star and over a level-up into the next level. The level, the stars and the points of the current star all come from **one number, the total ear points** (level 1 takes 600 points, level 2 takes 700, ...).
- **Ear levels** are content, `content/trainer/ear-levels.json` with `schemaVersion: 1`: each row is a mode (single or two) and the keys questions are drawn from. A level beyond the last row uses the last row. Provisional table (AX-3, change it as data after playtests):

| Level | Mode | Keys |
|---|---|---|
| 1 | single | C4 E4 G4 |
| 2 | single | C4 to G4, white keys |
| 3 | single | C4 to C5, white keys |
| 4 | two | C4 E4 G4 |
| 5 | two | C4 to G4, white keys |
| 6 | two | C4 to C5, white keys |
| 7 | single | C4 to C5, all keys |
| 8 | two | C4 to C5, all keys |
| 9 and on | two | C3 to C6, all keys |

- **Steps.** Questions come from the row the ear level earned, or from the **step** the student chose: any row, up or down (levels never lock anything, AC13).

## Acceptance criteria

- **ft_1_10.AC1** The screen shows the ear symbol, the ear level and a bar of the points towards the next level (5 + N stars of 100 points), and no staff or note name while a question is open. A room entry with the ear icon opens it (art through the `use-free-art-packs` skill; text through `write-ui-text`). The entry is the ear picture in the stand's panel (ft_1_08.AC11). As little text as possible: the bar replaces any "Stars: n of N" line.
- **ft_1_10.AC2** A question is one note or two different notes from the level's keys, seeded (the same seed gives the same questions) and never the same as the previous question when the keys allow another; each note sounds for the duration setting; in two-note mode the notes must be played in order.
- **ft_1_10.AC3** Every wrong key press is a miss and dims one of the round's stars (AC10). The only words are "right letter, wrong octave" when `classifyWrongNote` says so (the architect's axiom call), until the next press; no other hint, no higher or lower, no "almost" (no hints: the ear decides, AX-1, AX-2.1).
- **ft_1_10.AC4** Points per question are 100, 50, 25, 12, 6, 0 for 0, 1, 2, 3, 4, 5 or more misses. They are not written on the screen: the round's stars say it (5 lit = 100 points, 0 lit = 0) and the level bar moves (stars and text must not say the same thing twice).
- **ft_1_10.AC5** Level, stars and the current star's points are derived from the total ear points: level N needs 5 + N stars of 100 points; leftover points carry over; nothing is ever taken away. A new level is the one bigger moment (AX-2.1): a card with "Ear level N" written big between two stars shows over the top of the staff for two seconds, once, and the level line is gold until the next question (not by colour alone).
- **ft_1_10.AC6** Duration (whole seconds 1 to 3, one button on the toolbar, an hourglass with the number of seconds, that cycles 1, 2, 3) and repeat (on/off, a loop picture, lit when on) are on the trainer's toolbar with the play-again ear; with repeat on, the question sounds again after twice its sounding time without a key press. The repeat time is computed in `src/core` from an injected clock, not from frames.
- **ft_1_10.AC7** Once a question's notes are found, the answer is shown: the note(s) on the staff (`noteChart`) with the note name (`NoteNaming` B or H) on each note, until the next question starts. AX-0: the sound is tied to its name and to reading.
- **ft_1_10.AC8** The rules are pure TypeScript in `src/core/trainer/` with unit tests for the points table, the level and star derivation, seeded questions, misses in two-note mode and the repeat time; an end-to-end test plays questions with the virtual keyboard.

- **ft_1_10.AC9** The profile saves `earPoints` (a whole number that only grows, like `trainerXp`, d083) and the two settings (defaults: 1 second, repeat on); migration v16 to v17 sets 0 and the defaults; fixtures as `docs/testing.md` asks. Ear points are not added to the main XP.

- **ft_1_10.AC10** A row of **5 stars** stands in the middle of the screen above the staff, all lit when a question starts; each miss dims one, never below 0 (5 or more misses: 0 lit, and 0 points). After the round it stays as the round's result, with no result text. A dimmed star is the plain unlit star, never a cross. A two-note question shows two small slots under the stars that fill, with no name, as each note is found.
- **ft_1_10.AC11** After a round, **any key** goes on to the next question: a piano key (the EZ-220, the on-screen keys, the computer keyboard's note keys) or any other computer key except Esc (leave), Tab and the modifier keys, or a click or touch on the screen outside a button (there is no Next button). The key that goes on is never an answer: the next question sounds half a second later, and keys pressed before it sounds are ignored (not a miss). The answer stays at least half a second, so a double press cannot skip it (AC7). The rule is `earKeyAction` in `src/core/trainer/earTrainer.ts`.
- **ft_1_10.AC12** The answer's staff stands still: every answer of a level is drawn on the same staff at the same size and place, with room for any of the row's keys in the clef its first note brings. `earAnswerLayout` in `src/core/trainer/staffFrame.ts`.
- **ft_1_10.AC13** A step button on the toolbar (stairs with the step's number) opens every row of the ear levels table as a number to pick, the row in use lit; each one's tooltip says one note or two. Any row can be chosen, up or down, at any ear level, and a new question starts from it. Each visit starts on the row the ear level earned; choosing that row follows the level again. Points and the ear level count the same on every step. The rule is `earStepOf` and `chooseEarStep` in `src/core/trainer/earTrainer.ts`.

## AX-3 provisional choices

- AX-3 provisional: what an ear level changes; chose a content table of mode and keys, because it is one data file and harder levels mean more keys and two notes (AX-1).
- AX-3 provisional: repeat on by default (AX-1 would say off); chose on because AX-0 decides: a student who missed the sound guesses blind and learns nothing, while each repeat is one more time hearing the target. Duration default 1 second, the harder one (AX-1).
- AX-3 provisional: a two-note question is one question for points, so it pays like a single note for twice the work (AX-1).
- AX-3 provisional: the answer is shown after the question (AC7), no staff is shown while listening.
- AX-3 provisional: how long the answer stays at least before a key goes on, and the pause before the next question sounds (AC11); chose half a second each, the shortest that stops a double press from skipping the answer and lets the continuing key's own sound fade before the question (AX-0).
- AX-3 provisional: ear points stay their own track and give no main XP; the ear level is the reward (AX-2: smallest thing that works).
- AX-3 provisional: a step easier than the earned row pays the same points (the simplest; AX-1 might pay less for an easier row), and the chosen step is kept for the visit only, not saved, so each visit starts on the earned, harder row (AX-1).
- AX-3 provisional: the new level's card shows for two seconds, long enough to read and short enough to leave the answer to be read (AC5).
- AX-3 provisional: the question sounds with the game's sampled piano; the EZ-220's own voice and other timbres are later.
- AX-3 provisional: whether the round's stars show while the question is open; chose yes, dimming at each miss, because with no hint text a miss must still be seen at once (AX-2.1, objective feedback) and each miss dims one star, as it happens.

## Not in scope (later, see the brainstorm)

Chords (X + Y + ... sounded together), LOOM-style tunes to repeat, intervals, singing into a microphone, wrong-note detective in a known piece.

**Human:** whether a young student hears the laptop speakers' notes well; whether the level table is too slow or fast (playtest).

## TODO

Work tags ([todo-tags.md](../automation/todo-tags.md)); the closed issue in brackets keeps the earlier discussion.

- TODO(architect, R2): confirm the AX-3 provisional choices of the step (same points on an easier step, kept for the visit only) and the level card's two seconds.
- NEEDS-HUMAN: the visual check of the room and the trainer screen on the laptop (the screenshot baselines need making again after the room change), and a native speaker's check of the Estonian strings.
