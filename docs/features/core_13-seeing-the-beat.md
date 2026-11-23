---
id: "core_13"
title: "Seeing the beat"
scope: "Helpers that show the beat beside the click, each switched on or off per player and brought in or hidden by the autotrainer: a swinging pendulum, the playhead drawn as a line on the staff, a row of beat dots under the bar, and a short flash on the first beat; key lights stay a note help (ft_Y_06), never a beat help"
effort: "medium"
status: "designed, not started"
completeness: 0
depends_on: ["core_01", "core_02"]
---
# core_13: Seeing the beat

Index: [FEATURES.md](FEATURES.md). The click of core_02 is heard; these helpers show the same beat to the eye, for a student who does not yet hear where the beat falls, and for the walk of the autotrainer (ft_1_35 rule 6). AX-0: each shows **when**, never **which key**, so none of them lets a student play without reading the staff; that is also why falling notes stay out (ft_Y_05).

## Rules

1. **One beat source.** Every helper is drawn from the transport's tick (`Transport.tickAt`) and the meter map, by pure layout functions in a new src/core/layout/beat.ts; the scene only draws them. In Wait mode and with the following clock (which keeps no steady beat) they follow the click's own grid, and they are off when the click is off. They never decide correctness.
2. **The pendulum.** A small metronome arm beside the staff swings once per beat, side to side, reaching its end on the beat (an eased angle from the beat's phase), with the first beat of the bar marked by a brighter weight. Drawn in the pixel kit's manner (`use-free-art-packs` first).
3. **The line on the staff.** The playhead that today only turns passed notes grey (core_01 rule 8, `playheadAt`) is also drawn as a thin vertical line moving through the bar. Tempo mode only (Wait mode has no playhead).
4. **Beat dots.** Under each bar of the staff, one dot per beat of its meter; the dot of the current beat lights, the first one larger. They also show the count of a bar whose meter changes.
5. **The first-beat flash.** The staff's frame lights for a short moment on the first beat of each bar. Off by default (it is the loudest of the four).
6. **Settings.** Each helper is one switch per player on the settings screen (the learning page or its own), saved as optional fields (d069.3, no save bump): pendulum, line, beat dots on by default with the click, the flash off. The autotrainer may show a helper that is off for the walk only and hides it again after (ft_1_35 rule 7).
7. **Key lights are not a beat help.** A key lit on the EZ-220 also sounds its note (`docs/hardware-notes.md`), and it shows which key to press, so lighting keys on the beat would give the answer by ear and by sight (AX-0). Key lights stay the note hint of ft_Y_06, used inside the autotrainer's fix only.
8. `AX-3 provisional:` the four helpers, their defaults and that they follow the click's grid.

## Acceptance criteria

- **core_13.AC1** The pendulum's angle, the line's place, the lit dot and the flash are pure functions of the tick and the meter, and reach their beat mark exactly on each beat at any tempo percent (unit tests).
- **core_13.AC2** Each helper is shown only while its switch is on and the click runs, and the switches survive a reload per player.
- **core_13.AC3** The autotrainer can show a helper for a walk and hide it again, leaving the player's own switch as it was.
- **core_13.AC4** The helpers keep step with the click heard from the speakers on the target laptop. [human]

## TODO

- TODO(builder, R2): build with ft_1_35 slice 3: the layout functions first (test first), then the four views and the settings switches.
- TODO(painter, R2): the pendulum's picture and the dots in the house manner, after the builder's first sketch.
