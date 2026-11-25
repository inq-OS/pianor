---
id: "ft_1_38"
title: "Close-ups on Keri: the island's places play music"
scope: "A place on Keri opens a close-up whose painted lines are the staff; there a built trainer runs as a job with a story reason (the lantern turned by an A-to-B loop, the sauna wall by rhythm, the well by ear, the woodshed by scales); one pacing shape (start where the student is, rounds that rise, a struggle rule, a rescue, a best mark); hints that never leave the student stuck; weak bars routed to jobs; lasting changes on the island derived from what was played"
effort: "large"
status: "planned: vision and slices written; nothing built"
completeness: 0
depends_on: ["ft_1_19", "ft_1_24", "ft_1_25", "core_03", "core_10"]
---
# ft_1_38: Close-ups on Keri

Keri's places stop being a wrapper around the trainers and become where the training happens. A hint from Kiur or a character names a place and a problem; the student walks there, presses one spot, and a close-up opens whose painting *is* the staff: log gaps, gallery rails, the five iron hoops of the tower, a hull's strakes, the woodpile's rows. A trainer already built runs inside it as a **job**, and what the student played changes the island for good. Decision: [d302](../decisions/game.md#d302). Index: [FEATURES.md](FEATURES.md). Beyond Keri (islets, the sea chart): [ft_Y_16](ft_Y_16-sea-chart-beyond-keri.md).

AX-0: every job is reading and playing from a staff; the picture paints the lines, the game's own notes stay on them. AX-1: rounds rise, a struggle is rescued and never lost. AX-2: a change on the island shows one measured fact and is only ever added.

## Rules

1. **The loop.** Hint, then walk, then press a spot, then the close-up, then the job, then a lasting change. A hint marks the spot (a glint); the spot is open with no hint too, and nothing on the island must be solved before the student may play (ft_1_19 rule 3).
2. **The picture is the staff.** Every close-up has five parallel things that are the staff's lines (or one line for a rhythm). The painter takes the line spacing from the staff layout (`src/core/layout`), a test checks that the painted lines sit on the layout's lines, and the staff view draws clefs, heads, stems, ledger lines and the cursor at the usual size over it. Behind a note the texture falls to two quiet tones; birds, stones and knots sit beside real notes, never in place of them.
3. **A job reuses a trainer.** A close-up names a drill (note names, ear, scale, chord, learn bar by bar, Wait or Tempo mode with an A-to-B loop, the tug, later the autotrainer) and plays the trainer's own rounds or the student's own weak bars (core_10), never a copy of a trainer.
4. **One pacing shape** for every job (one pure module, its numbers in one rules file, `AX-3 provisional:`):
   - it starts where the student is (`proposeStartPercent`, core_10.AC7, or the last step passed);
   - a clean round rises (tempo, range, length); a round that is not clean repeats at the same height, never below the day's start;
   - **the struggle rule** is measured from play: in Tempo mode ft_1_35's rule (a stop of three note lengths, or uneven bars in the last four); in Wait mode two wrong presses on one note or a round under 75 % right first try;
   - **the rescue**: the job's story beat (*the generator kicks in*, *the fisherman takes an oar*, *Kiur holds the plank*) while the help changes behind it (the last clean tempo, the click and the beat line, the note's name); the round goes on and counts as played, one rescue at most per round, and a rescued round never sets a best mark;
   - **the best mark** (best clean tempo, furthest stone, longest beat held without the click) is painted into the place and is there to be beaten.
   Calibration: about 90 % right first try finishes without a rescue, about 85 % takes one late rescue, careless play is rescued and goes round again.
5. **Rewards.** A job earns piece XP through the normal practice log (ft_1_13); it mints no player XP of its own. Its reward is the lasting change, written as a fact ("the beam turns: best 104 %"); a bigger moment only for a real milestone. `AX-3 provisional:` until the maintainer says otherwise.
6. **The island remembers.** Lasting changes come from one pure function of the practice log, the world document and the curriculum (`islandState`, beside `presence`), from best-ever values and running totals that only rise, so a weak day takes nothing away and little needs storing (ft_1_25.AC1). What is built (planks, a woodpile, pennants) stays; what follows the day (smoke, the night's beam) follows the sky like any look. Each change is a prop over the picture, never a repaint.
7. **Never stuck.** Kiur's hint ladder: idle in a scene, a line about place and sense; then the spot glints; then he names the spot; then he names the job. A hint changes what to look at, never how much to play. Glints show only after practice today.
8. **No part of the memorial.** The Kaleva memorial and the sunken tractor hold no close-up and no job.
9. **Real Keri first.** A close-up of a real interior or a thing not in [keri.md](../keri.md) waits for the maintainer's photo or word (`KERI-TODO`); a fiction (a clockwork lens, a bird tower, an oak sapling) is a departure the maintainer decides (keri.md section 9).
10. **Lore in layers.** The island opens in layers, each a deeper layer of its real past, and each opened by the player's level (d113), never by a puzzle: the wardens' present first, then the old wardens, then the gas years 1906 to 1912, then the iron tower and its Paris lens of 1858, then the stone tower of 1803 and the first fires of 1719. Characters, logbook pages and bottles tell the lore of the layers already open and only hint at the ones above. Each layer brings its own era's public-domain tunes.
11. **The lighthouse is the pinnacle.** The climb up the tower is the game's long arc and the lantern its summit, reached last: a student early in the game sees the tower from below, its door shut and its beam turning at night as a promise. The climb goes floor by floor, each floor a close-up and a deeper layer of the lore: the door and the stone drum's five iron hoops, the stair inside the stone, the iron column, the gallery, the lantern. `AX-3 provisional:` the floors open at player levels 5, 8, 12, 16 and 20 (the last rank); reaching the lantern and turning its light is the biggest moment the game gives (AX-2.1, a real milestone).

## The jobs (the catalogue; the maintainer picks the order)

| Place | The picture's staff | Job | Built on | Lasting change |
|---|---|---|---|---|
| Lighthouse lantern (the summit, rule 11) | the gallery's rails or the lens's prism rings | loop A to B, faster each clean lap; the generator rescues | core_03, core_01 | the beam sweeps the map and every night picture, at the best clean tempo |
| Sauna | log gaps as lines, the corner notches as bar lines | rhythm on the middle gap, each hand on its half of the keys; later the knots become notes to read | rhythm practice (core_01 TODO), core_13, ft_1_11 | Saturday smoke and a lit window; a mark for the longest run of even bars |
| Lighthouse's five iron hoops (the first floor of the climb) | the five hoops round the stone | a scale from the staff tightens a hoop, key by key | ft_1_29 | a hoop shines per key held |
| Generator house | the engine's belt as one line | a steady beat where the click drops out for one bar, then two | core_02, core_13 | the warden's windows lit at night; the longest gap held |
| Well house | the shaft's stone rings | a pebble's echo is a note or two found by ear, then written on the rim and played from it | ft_1_10 | water in the blue barrels |
| Woodshed | the woodpile's rows | a scale stacked log by log; triads lay the fire | ft_1_29 | the stack grows; it fires the sauna and the room's stove |
| Boat shed | the hull's strakes, its ribs as bar lines | learn a piece bar by bar, a strake per bar, then bring it to tempo | ft_1_32, ft_1_35 | a boat at the slip, the way to the islets (ft_Y_16) |
| Weather mast | rungs above a staff are ledger lines; the wind rose at the top | ledger notes by name, then a key on the circle of fifths and its scale | ft_0_17, ft_1_28, ft_1_29 | the vane and cups turn |
| Mast's wires | five wires with birds on them | a new flock each day: name the notes the birds sit beside | ft_0_17, ft_0_12 | a tally of flocks read |
| Docks' bird tower | the tower's guy ropes | a bird calls a phrase on the staff, the student answers | ft_1_22, ft_1_10 | birds come back to the scenes |
| Tide pool on the shore | the water's edge is middle C, the reflection the bass staff | grand-staff note names, the right hand above, the left below | ft_0_15, ft_0_17 | creatures in the pool as bass notes are known |
| Kagusäär spit | storm-placed stones as one sight-reading line, new each day | a first reading in Wait mode, read once | ft_0_12, ft_0_17 | a post at the furthest stone |
| Shore after a storm | tide marks as lines, settled boulders as notes | a new two-bar line each storm | ft_0_12 | a cairn counts the lines read |
| Fog on a scene | a staff along the scene's foot | each clean bar lifts one band of fog | ft_1_32 | the scene clears |
| Cinema house | the film strip, frames as bars | the silent-film pianist: chords from their names on cue, later a whole song in tempo | ft_1_29, ft_1_36 | a reel per piece; the student's best take is the film's music |
| Port's drying net | the head rope and mesh rows | the fisherman's phrases mended mesh by mesh | ft_1_22 | he fishes and sings a new line |
| Dog roses | five wires the roses climb | note names; a bloom on each line or space read at 90 % | ft_0_17 | the roses bloom where the student reads well |
| Living room's stove wall | the brick courses' mortar lines | a five-note warm-up | ft_0_17 | the stove glows that day |
| Warden's desk | the logbook's ruled pages | write four bars; the next warden plays them back a week later | ft_1_02 | the logbook fills (private, licence `NaN`) |
| Crossroads signpost | its arms stacked on a staff | play the arm's note and name the interval | new: an interval drill | an arm per interval |

## Across the island

- **Storm stones (the daily route).** Keri's stones move in storms. After each play, the bars core_10 marks weak appear as boulders on the map's paths, each tagged with its bars and the job that clears it; the job plays those bars of the student's own piece. A pure routing table: wrong letter or neighbour key to note names on those notes; wrong octave or middle C to the tide pool; a missed sharp to the mast's signal flags (core_09); clean but uneven to the sauna and the generator; even but slow to the lantern; one weak hand to the same job with that hand alone.
- **The warden's logbook.** One line per job, objective ("lens, third ring: G major, 92 % first try, 84 bpm"); a line opens its bars to practise again. The wardens hand the island over each week, as the real ones do.
- **Night windows.** On the night map a house's window lights once the job that lives there passes its first round, so the night island shows what was practised.
- **Errands.** A character sends the student through two to five jobs in its style (the fisherman's net and his crossing, the border guard's radio rhythm and then a twelve-bar blues traded in fours, the oak spirit's runo carved in five places, the teacher's concert in the cinema when three characters are beaten to their last rung). Each step is one job; an errand is one data file and its progress optional flags in the world document.
- **New characters (proposals).** A ghost of the gas years 1906 to 1912 by the boarded-up side building (the old pipe's sections are bars, leaks the wrong bars); Tuuleema, the wind mother, behind the storm stones; a näkk in the spring fog who sings a phrase to be answered an octave away; a driftwood kratt that must always be given work, the daily drill. Names from folklore or invented, never a real person (d247).
- **Discovery.** A message in a bottle with two to four bars; a tune drifting over the map, followed by ear and ending on a staff; the light's flash pattern as a rhythm at night; a backpack tuning fork for a daily A; the sea creature under the sand strip, which stirs only for the lowest C read from its ledger lines. Kiur's field notebook counts what was found in plain numbers; nothing is ever shown as missing.

## The seam in code (for the builder)

- `content/closeups/<id>.json` (zod, `schemaVersion`): scene, hotspot, picture, the staff's rectangle, the drill and its parameters, the pacing rules id, the best mark's kind and the outcome lines; a scene hotspot gets an optional `closeUp` id. Content only, no save change.
- A new `closeup` folder under `src/core/`: one `Drill` interface (start, a note, a tick, state, result) with adapters over the existing trainers; `pacing.ts`, `route.ts` and `jobs.ts` beside them, pure and unit-tested.
- `src/game/`: one `CloseUpScene` on `PixelScene` draws the picture, places a `StaffView` in the staff's rectangle and lets a small view animate the drill's events (the lens turning, a log sliding home); it never decides.
- Best marks and built things go in the world document keyed by close-up id; that may need a schema bump (`save-format-bump` skill).

## Slices

1. **A. The seam and the sauna.** The close-up runtime, `pacing.ts` with the struggle rule and the rescue, rhythm practice (its own feature file first, as core_01's TODO says) and the log wall; proves the painted staff at the bottom of the lore.
2. **B. The island remembers.** `islandState`, the warden's logbook, night windows, and the lore layers (rule 10) with the tower seen from below.
3. **C. Storm stones.** The routing table and the day's jobs on the map.
4. **D. The chain.** The well, the woodshed and the generator house, feeding the sauna and later the lantern.
5. **E. The rest of the catalogue,** one place at a time, in step with the other areas of the game.
6. **F. The climb.** The lighthouse floor by floor (rule 11), its lantern last: the A-to-B loop that turns the light, the generator's rescue, the beam at night on the map and in scenes.

## Acceptance criteria

Written per slice when it is planned.

## TODO

- TODO(architect, R2): turn slice A into acceptance criteria and a `TODO(builder)`.
- NEEDS-HUMAN: the levels at which the tower's floors open (rule 11); whether a job may mint player XP (today it does not, rule 5); whether daily looks such as the sauna's smoke may follow the day while best marks and built things stay.
- NEEDS-HUMAN: the departures this vision proposes (a clockwork lens turned by hand, the oak's sapling, a renovated side building, the pier that grows) are the maintainer's to accept or refuse.
- KERI-TODO: photos or words for the inside of the sauna, the well house, the woodshed, the boat shed, the cinema house and the side building, and which building is the generator house.
- IDEA(architect, Later): check whether the student's tug answer ever has no staff in view, against AX-0.1, when the tug is next touched.
