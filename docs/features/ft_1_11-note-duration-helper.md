---
id: "ft_1_11"
title: "Note duration helper"
scope: "An optional helper on the staff that shows how long each note sounds, hand by hand: A a faint ghost head on every beat the note is still held, B a thin light band between the staff lines from the head to where the sound stops; one cycling setting per hand (Off, A, B, A+B) saved per player with no version bump"
effort: "simple"
status: "in review: built with unit and end-to-end tests; the maintainer's look on Windows is open"
completeness: 95
depends_on: ["ft_0_15", "ft_0_16"]
---
# ft_1_11: Note duration helper

An optional helper on the staff shows how long each note sounds, so the student holds it the right time (for example a left-hand half note under right-hand quarters in 3/4). Two looks, **A ghost heads** on the held beats and **B a thin band** in the white between staff lines, chosen from previews; each hand has its own setting: Off, A, B, A+B. Code: `src/core/layout/durationHelp.ts` (pure, unit tested); `StaffView.setDurationMarks` draws it.

## Rules

- **Band.** It runs from the note head to just before where the sound stops (the next beat's onset, or the bar line when the
  note is held to the end of the bar). It is painted only between staff lines: a note in a space gets a strip about a third of
  a staff space high through the middle of the space; a note on a line gets two thin strips, one on each side of the line,
  and the line stays clean. A note that fills its bar alone is drawn in the middle of the bar, so its band spans the bar.
- **Ties.** Tied notes (core_09) are one sound, so their band does not break: a note's band runs on
  to the head it is tied into, and over the bar line when the tie crosses it. A tie over a line break ends the band at the
  line's end and starts it again at the next line's first bar, after the clef, where the second half of the tie curve
  starts. Ghost heads stay as they are: the tied head is a real head on its beat.
- **Ghost heads.** On every beat after the note's own beat while it still sounds, a faint copy of its head stands at the same
  pitch, so the student can count "one, two" over a half note. The beat is the unit of the time signature's lower number (a
  quarter in 3/4 and 4/4). A note drawn in the middle of its bar gets none (they would stand before the head).
- **Setting.** One per hand. Off draws nothing; A draws the ghost heads, B the band, A+B both. A track's hand is its `hand`,
  or its clef when it has none (treble right, bass left).
- **Look.** Under the staff lines and the notes (its own layer), in the cursor's light blue, faint, with no outline, so it
  reads as help and never as a note to play (AX-0: the notation itself is not changed). No animation (AX-2).
- **Nothing else changes.** The judge, Wait and Tempo mode, the scores and the XP are the same with the helper on or off.

## Acceptance criteria

- **ft_1_11.AC1** The Settings screen has two cycling buttons side by side, "Note length, left hand" on the left and "Note
  length, right hand" on the right, as the hands sit at the piano, each with Off, A ghost notes, B band, A+B, then Off again. A button's
  picture shows its choice on its hand's staff (upper for the right hand, lower for the left). The choice is saved per player
  in `settings.durationHelp` (`{ RH, LH }`), an optional field: a save without it (every save before this feature) reads as
  both off, so there is no version bump (d069.3). A new player starts with both off.
- **ft_1_11.AC2** The band runs from the head to just before the end of the sound, to the bar line for a note held to the end
  of the bar, across the bar for a note drawn in its middle, and never covers a staff or ledger line.
- **ft_1_11.AC3** A ghost head stands on every beat the note is still held, never on its own beat or after the sound; the beats
  follow the time signature.
- **ft_1_11.AC4** Each hand's notes get its own choice: A only ghost heads, B only bands, A+B both, off nothing.
- **ft_1_11.AC5** The marks are drawn on their own layer under the staff lines and the notes.
- **ft_1_11.AC6** The practice staff (and every staff drawn through the play session: practice, battle, campaign) shows the
  marks the player chose, and none when off.
- **ft_1_11.AC7** [human] The maintainer checks the look on Windows, at the laptop size and the smallest size.
- **ft_1_11.AC8** Tied notes get one unbroken band: no gap before the tied head, none across the bar line, and over a line
  break from the line's end to after the next line's clef.

## Later

- A helper per bar (a later item): the same marks, switched on only for the bars the student picks with the
  A to B section tool. Not built.
- In Tempo mode the band could fill in as the playhead passes (stimulation may be added later, AX-2). Not built.
