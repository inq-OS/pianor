---
id: "core_13"
title: "Seeing the beat"
scope: "Helpers that show the beat beside the click, each switched on or off per player and brought in or hidden by the autotrainer: a beat lane (a row of dots along the staff where a wave runs at the tempo, nudging each beat and note it passes, and in a learning run colouring each key against the student's own pace, with a click at that pace as a setting), the playhead drawn as a line on the staff, and a short flash on the first beat; key lights stay a note help (ft_Y_06), never a beat help"
effort: "medium"
status: "slices 1 and 2 built: the beat lane in Tempo mode, with the click in Wait mode and in learning runs, its settings, and up to three lanes tuned on a page with a preview; the line and the flash held until the maintainer starts them"
completeness: 50
depends_on: ["core_01", "core_02"]
---
# core_13: Seeing the beat

Index: [FEATURES.md](FEATURES.md). The click of core_02 is heard; these helpers show the same beat to the eye, for a student who does not yet hear where the beat falls, and for the walk of the autotrainer (ft_1_35 rule 6). AX-0: each shows **when**, never **which key**, so none of them lets a student play without reading the staff.

## Rules

1. **One beat source.** Every helper is drawn by pure layout functions in `src/core/layout/` (`beatLane.ts`) from the transport's tick in Tempo mode, or from the latest right key and a tempo in Wait mode (the click's, or the student's own pace in a learning run, rule 9); the scene only draws them. They never decide correctness.
2. **The beat lane** ([d299](../decisions/play.md#d299)). A row of faint dots along each line of the staff, drawn in ink under the staff lines and the notes: between the two staves of a grand staff, or above the staff (a single staff always has it above, clear of its highest head, stem and ledger line, and on the sheet); a dot that would touch a note head or its ledger line, such as middle C's between the staves, is left out so it never reads as a mark of the note. A ghost dot stands every thirty-second, close enough to read as a dotted line, a beat dot (a quarter, as the click counts) a little bigger and darker, the first beat of a bar bigger still, and a note dot under the column of every note or chord (a note off the grid, such as a whole note centred in its bar, has a dot of its own); `laneDots`. A wave runs along the lane at the tempo: each dot within a quarter of a beat of its crest is lifted in a narrow parabola, the beat and note dots most (`laneLift`). In Tempo mode the wave is the transport's tick, so it runs with the playhead and the click; in Wait mode it runs on from the latest right key at the click's tempo while the click is on, at most a bar, and waits there for the next key (`waveTick`). `AX-3 provisional:` the thirty-second ghosts, the sizes and lift, the lane's place above the staff, and no wave in Wait mode with the click off.
3. **The line on the staff.** The playhead that today only turns passed notes grey (core_01 rule 8, `playheadAt`) is also drawn as a thin vertical line moving through the bar. Tempo mode only (Wait mode has no playhead).
4. **Beat dots** are the beat lane (rule 2).
5. **The first-beat flash.** The staff's frame lights for a short moment on the first beat of each bar. Off by default (it is the loudest of them).
6. **Settings.** Each helper is one switch per player on the settings screen (the learning page or its own), saved as optional fields (d069.3, no save bump): the beat lane (`learn.beatLane`: between the staves, above the staff, or off; between by default), the line on by default, the flash off; the click at the student's pace in learning (`learn.paceClick`, rule 9) off. Each choice is a picture, an off one struck through. The autotrainer may show a helper that is off for the walk only and hides it again after (ft_1_35 rule 7).
7. **Key lights are not a beat help.** A key lit on the EZ-220 also sounds its note (`docs/hardware-notes.md`), and it shows which key to press, so lighting keys on the beat would give the answer by ear and by sight (AX-0). Key lights stay the note hint of ft_Y_06, used inside the autotrainer's fix only.
8. `AX-3 provisional:` the helpers, their defaults and that they follow the click's grid.
9. **The lane in a learning run** (d299, ft_1_32 rule 8). Learning has no click of its own, so the wave runs at the student's own pace (`learnPace`, `src/core/learn/livePace.ts`): the run's usual gap once three keys are played (the pace its evenness is judged by), the piece's baseline tempo before that, no wave before either. It runs on from each right key at that pace and waits a bar on, so a pause shows as the wave running ahead of the next note. Each key's dot keeps a colour for the run by how far its gap was from the gap the pace asks (`paceMark`, `paceColour`): green within 20% (the rushing margin), orange beyond, red beyond 50% (a gap the run's verdict does not count as even, d281). With `learn.paceClick` on, the metronome clicks at that pace from the next beat after each key, started afresh at every key so it follows the student (`paceClick`). `AX-3 provisional:` the 20% margin.

10. **Tuning the lanes** (core_13.AC8). The beat dots button on the settings' learning page opens a page of its own (`BeatLanesScene`) with a preview staff of two bars where the wave runs all the time and two keys show their pace colours, so every change shows before play. A player has up to three lanes (`learn.beatLanes`; absent, the one lane of `learn.beatLane`; none is off). Each lane has its place (between the staves or above), moved up or down in quarter staff spaces by dragging it on the preview or with the arrows; how strong each kind of dot is (the dotted line, the beat dots, the top staff's note dots, the bottom staff's, each strong, faint or hidden; a note dot whose staves are hidden falls back to its beat or ghost, `dotLook`); and the wave's height and width. Every choice is a picture, its words in the tooltip. `AX-3 provisional:` three lanes, the three steps of each choice, dragging only on that page.

## Acceptance criteria

- **core_13.AC1** The beat lane's dots (a ghost every thirty-second, a beat dot every quarter, the bar's first bigger, a dot under every note), the wave's place and its lift, the line's place and the flash are pure functions of the layout, the beat and the time (unit tests); on the practice screen the wave runs along the lane while the click runs (end-to-end).
- **core_13.AC2** Each helper is shown only while its switch is on and the click runs, and the switches survive a reload per player.
- **core_13.AC3** The autotrainer can show a helper for a walk and hide it again, leaving the player's own switch as it was.
- **core_13.AC4** The helpers keep step with the click heard from the speakers on the target laptop. [human]
- **core_13.AC5** In a learning run the wave follows the student's own pace (the run's, else the baseline) and each key's dot keeps a colour: even, a little early or late, or far off beyond the run's evenness margin; no wave and no colour before a pace is known.
- **core_13.AC6** With the learning click turned on (off by default), a learning run clicks at the student's pace from the next beat after each key once the pace is known; turned off, a learning run never clicks.
- **core_13.AC7** The lane runs between the two staves, or above the staff clear of its notes and on the sheet; it is drawn under the staff lines and the notes, so it never covers one, and no dot touches a note head or its ledger line.
- **core_13.AC8** A player can tune up to three lanes (which dots each shows and how strongly, the wave's height and width, its place, dragged on a preview), every change is shown on the running preview and saved for that player, and the practice screen draws the lanes as tuned.

## TODO

- TODO(builder, Later): the line and the flash, with ft_1_35, on the maintainer's word: their layout functions in `src/core/layout/` first (test first), then the views and the settings switches.
- TODO(painter, Later): the beat lane's dots and wave in the house manner (`drawLane` in `StaffView.ts`); they are the builder's sketch.
- NEEDS-HUMAN: try the lane and the learning click with a student on the real keyboard: whether the wave is easy to follow while reading, between or above, and the 20% margin.
