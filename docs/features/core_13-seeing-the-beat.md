---
id: "core_13"
title: "Seeing the beat"
scope: "Helpers that show the beat beside the click, each switched on or off per player and brought in or hidden by the autotrainer: a beat ring (a circular metronome that lights each click, and in a learning run marks each key against the student's own pace, with a click at that pace as a setting), the playhead drawn as a line on the staff, a row of beat dots under the bar, and a short flash on the first beat; key lights stay a note help (ft_Y_06), never a beat help"
effort: "medium"
status: "slice 1 built: the beat ring with the click and in learning runs, its two settings; the line, the dots and the flash held until the maintainer starts them"
completeness: 40
depends_on: ["core_01", "core_02"]
---
# core_13: Seeing the beat

Index: [FEATURES.md](FEATURES.md). The click of core_02 is heard; these helpers show the same beat to the eye, for a student who does not yet hear where the beat falls, and for the walk of the autotrainer (ft_1_35 rule 6). AX-0: each shows **when**, never **which key**, so none of them lets a student play without reading the staff.

## Rules

1. **One beat source.** Every helper is drawn by pure layout functions in `src/core/layout/beat.ts` from the click's own beats (the metronome reports each with its time and the time to the next) or the transport's tick and the meter map; the scene only draws them. With the following clock (which keeps no steady beat) they follow the click's grid, and they are off when the click is off, except the beat ring in a learning run (rule 9). They never decide correctness.
2. **The beat ring** ([d299](../decisions/play.md#d299)). A circular metronome on the parchment, drawn in ink like the notes: one dot a beat of the bar (quarters, as the click counts), the first at the top and larger, going clockwise, and a hand from the centre. Each click lights its dot blue (the cursor's colour), fading by the next beat, and the hand reaches the next dot exactly when its click is due (`clickRing`). While the click runs or a learning run is played, the staff leaves a room of `RING_ROOM` staff spaces at its right and the ring stands there at the sheet's foot, about five staff spaces across (`ringBox`), under a learning run's prize column; it is painted live on the fine pixels (`beatRingArt.ts`). With the click off and no learning run the staff has its whole width. `AX-3 provisional:` the room's width and the place at the sheet's foot, where no note is.
3. **The line on the staff.** The playhead that today only turns passed notes grey (core_01 rule 8, `playheadAt`) is also drawn as a thin vertical line moving through the bar. Tempo mode only (Wait mode has no playhead).
4. **Beat dots.** Under each bar of the staff, one dot per beat of its meter; the dot of the current beat lights, the first one larger. They also show the count of a bar whose meter changes.
5. **The first-beat flash.** The staff's frame lights for a short moment on the first beat of each bar. Off by default (it is the loudest of the four).
6. **Settings.** Each helper is one switch per player on the settings screen (the learning page or its own), saved as optional fields (d069.3, no save bump): the beat ring (`learn.beatRing`), line, beat dots on by default, the flash off; the click at the student's pace in learning (`learn.paceClick`, rule 9) off. Each choice is a picture, an off one struck through. The autotrainer may show a helper that is off for the walk only and hides it again after (ft_1_35 rule 7).
7. **Key lights are not a beat help.** A key lit on the EZ-220 also sounds its note (`docs/hardware-notes.md`), and it shows which key to press, so lighting keys on the beat would give the answer by ear and by sight (AX-0). Key lights stay the note hint of ft_Y_06, used inside the autotrainer's fix only.
8. `AX-3 provisional:` the four helpers, their defaults and that they follow the click's grid.
9. **The ring in a learning run** (d299, ft_1_32 rule 8). Learning has no click of its own, so the ring follows the student's own pace (`learnPace`, `src/core/learn/paceRing.ts`): the run's usual gap once three keys are played (the pace its evenness is judged by), the piece's baseline tempo before that, nothing before either. Each right key lights the dot of its beat and leaves a mark on the inner circle where the hand was at the press, coloured by how far its gap was from the gap the pace asks: green within 20% (the rushing margin), orange beyond, red beyond 50% (a gap the run's verdict does not count as even, d281); a key off the pace also colours the whole circle, drawn thicker, while its dot is lit, so it shows by more than one dot's colour. The hand sweeps on from the key at the pace, once round at most, so a pause shows as the hand running past the next dot. With `learn.paceClick` on, the metronome clicks at that pace from the next beat after each key, started afresh at every key so it follows the student (`paceClick`). `AX-3 provisional:` the 20% margin.

## Acceptance criteria

- **core_13.AC1** The beat ring's lit dot and hand, the line's place, the lit beat dot and the flash are pure functions of the beat and the time, and reach their beat mark exactly on each beat at any tempo percent (unit tests); the ring lights each click on the practice screen and goes when the click stops (end-to-end).
- **core_13.AC2** Each helper is shown only while its switch is on and the click runs, and the switches survive a reload per player.
- **core_13.AC3** The autotrainer can show a helper for a walk and hide it again, leaving the player's own switch as it was.
- **core_13.AC4** The helpers keep step with the click heard from the speakers on the target laptop. [human]
- **core_13.AC5** In a learning run the ring follows the student's own pace (the run's, else the baseline), lights each key's beat and marks it even, early or late, and far off beyond the run's evenness margin; nothing before a pace is known.
- **core_13.AC7** The ring stands on the parchment right of every note, as large as the notes (about five staff spaces), only while it has beats to show; the staff takes its whole width again when the click stops.
- **core_13.AC6** With the learning click turned on (off by default), a learning run clicks at the student's pace from the next beat after each key once the pace is known; turned off, a learning run never clicks.

## TODO

- TODO(builder, Later): the line, the beat dots and the flash, with ft_1_35, on the maintainer's word: their layout functions in `src/core/layout/beat.ts` first (test first), then the views and the settings switches.
- TODO(painter, Later): the beat ring's picture (`beatRingArt.ts`) and the beat dots in the house manner; the ring is the builder's sketch.
- NEEDS-HUMAN: try the ring and the learning click with a student on the real keyboard: whether the ring on the sheet is easy to follow while reading, and the 20% margin.
